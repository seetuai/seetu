/**
 * POST /api/v1/webhooks/billboard-payment
 * GET /api/v1/webhooks/billboard-payment (redirect handler)
 *
 * Webhook endpoint for billboard payment callbacks from Wave
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWaveClient } from '@/lib/wave';
import { processPaymentSuccess, processPaymentFailure } from '@/lib/billboard/payments';
import { onPaymentComplete } from '@/lib/billboard/whatsapp/message-handler';

// WhatsApp bot number for redirects
const WHATSAPP_BOT_NUMBER = process.env.WHATSAPP_BOT_NUMBER || '221781362728';

// Handle redirect callbacks (success/error URLs from Wave)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const paymentId = searchParams.get('payment_id');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://seetu.sn';

  console.log('[BILLBOARD_PAYMENT_WEBHOOK] GET redirect:', { status, paymentId });

  if (!paymentId) {
    // Redirect to billboard page
    return NextResponse.redirect(`${baseUrl}/billboards`);
  }

  // Get payment details with whatsappPhone
  const payment = await getPaymentWithPhone(paymentId);

  if (!payment) {
    console.error('[BILLBOARD_PAYMENT_WEBHOOK] Payment not found:', paymentId);
    return NextResponse.redirect(`${baseUrl}/billboards?error=payment_not_found`);
  }

  // If success status, verify with Wave API
  if (status === 'success' && payment.externalRef) {
    try {
      const wave = getWaveClient();
      const isSuccessful = await wave.isPaymentSuccessful(payment.externalRef);

      if (isSuccessful) {
        console.log('[BILLBOARD_PAYMENT_WEBHOOK] Wave payment verified successful:', paymentId);

        // Process the payment
        await processPaymentSuccess(paymentId, payment.externalRef, 'wave');

        // Notify WhatsApp user if applicable
        if (payment.contentId) {
          try {
            await onPaymentComplete(payment.contentId, paymentId);
          } catch (error) {
            console.error('[BILLBOARD_PAYMENT_WEBHOOK] Failed to notify WhatsApp:', error);
          }
        }

        // Redirect to WhatsApp if user came from bot, otherwise to web
        if (payment.whatsappPhone) {
          // Redirect back to WhatsApp chat with the bot
          const whatsappUrl = `https://wa.me/${WHATSAPP_BOT_NUMBER}?text=Paiement%20confirmé%20✓`;
          return NextResponse.redirect(whatsappUrl);
        }

        // Redirect to success page (for web users)
        return NextResponse.redirect(
          `${baseUrl}/billboards/my-content?payment=success&id=${payment.contentId}`
        );
      } else {
        console.log('[BILLBOARD_PAYMENT_WEBHOOK] Wave payment not yet completed:', paymentId);
        // Payment might still be processing
        if (payment.whatsappPhone) {
          return NextResponse.redirect(
            `https://wa.me/${WHATSAPP_BOT_NUMBER}?text=Paiement%20en%20cours...`
          );
        }
        return NextResponse.redirect(
          `${baseUrl}/billboards/my-content/${payment.contentId}?payment=pending`
        );
      }
    } catch (error) {
      console.error('[BILLBOARD_PAYMENT_WEBHOOK] Wave verification error:', error);
      if (payment.whatsappPhone) {
        return NextResponse.redirect(
          `https://wa.me/${WHATSAPP_BOT_NUMBER}?text=Erreur%20paiement`
        );
      }
      return NextResponse.redirect(
        `${baseUrl}/billboards/my-content/${payment.contentId}?payment=error`
      );
    }
  } else if (status === 'error') {
    // Payment failed
    await processPaymentFailure(paymentId);
    console.log('[BILLBOARD_PAYMENT_WEBHOOK] Payment failed:', paymentId);
    if (payment.whatsappPhone) {
      return NextResponse.redirect(
        `https://wa.me/${WHATSAPP_BOT_NUMBER}?text=Paiement%20échoué`
      );
    }
    return NextResponse.redirect(
      `${baseUrl}/billboards/my-content/${payment.contentId}?payment=failed`
    );
  }

  // Default redirect
  if (payment.whatsappPhone) {
    return NextResponse.redirect(`https://wa.me/${WHATSAPP_BOT_NUMBER}`);
  }
  return NextResponse.redirect(`${baseUrl}/billboards/my-content`);
}

// Handle POST webhooks (if Wave sends any)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    console.log('[BILLBOARD_PAYMENT_WEBHOOK] POST received:', JSON.stringify(body, null, 2));

    // Wave might send webhook notifications
    // Extract the checkout session ID if present
    const sessionId = body.id || body.checkout_session_id;
    const paymentStatus = body.payment_status;

    if (sessionId && paymentStatus === 'succeeded') {
      // Find payment by external ref (Wave session ID)
      const payment = await findPaymentByExternalRef(sessionId);

      if (payment) {
        await processPaymentSuccess(payment.id, sessionId, 'wave');

        // Notify WhatsApp user
        if (payment.contentId) {
          try {
            await onPaymentComplete(payment.contentId, payment.id);
          } catch (error) {
            console.error('[BILLBOARD_PAYMENT_WEBHOOK] Failed to notify WhatsApp:', error);
          }
        }

        console.log('[BILLBOARD_PAYMENT_WEBHOOK] Payment processed via webhook:', payment.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[BILLBOARD_PAYMENT_WEBHOOK] POST error:', error);
    return NextResponse.json({ received: true });
  }
}

// Helper to find payment by Wave session ID
async function findPaymentByExternalRef(externalRef: string) {
  const { prisma } = await import('@/lib/prisma');
  return prisma.billboardPayment.findFirst({
    where: { externalRef },
    select: { id: true, contentId: true },
  });
}

// Helper to get payment with whatsappPhone
async function getPaymentWithPhone(paymentId: string) {
  const { prisma } = await import('@/lib/prisma');
  return prisma.billboardPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      contentId: true,
      externalRef: true,
      whatsappPhone: true,
    },
  });
}
