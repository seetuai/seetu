/**
 * POST /api/v1/webhooks/billboard-payment
 * GET /api/v1/webhooks/billboard-payment (redirect handler)
 *
 * Webhook endpoint for billboard payment callbacks from NabooPay
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, verifyTransactionDetails } from '@/lib/naboopay';
import { processPaymentSuccess, processPaymentFailure, getPayment } from '@/lib/billboard/payments';
import { onPaymentComplete } from '@/lib/billboard/whatsapp/message-handler';

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const signature = request.headers.get('x-naboopay-signature');
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('[BILLBOARD_PAYMENT_WEBHOOK] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error('[BILLBOARD_PAYMENT_WEBHOOK] Invalid JSON');
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    console.log('[BILLBOARD_PAYMENT_WEBHOOK] Received:', JSON.stringify(body, null, 2));

    // Extract payment info from webhook
    const orderId = body.order_id as string;
    const status = body.status as string;
    const amount = body.amount as number;
    const paymentMethod = body.payment_method as string;
    const metadata = body.metadata as Record<string, string> | undefined;

    // Get our payment ID from metadata
    const paymentId = metadata?.payment_id;
    const contentId = metadata?.content_id;

    if (!paymentId) {
      console.error('[BILLBOARD_PAYMENT_WEBHOOK] No payment_id in metadata');
      return NextResponse.json({ received: true });
    }

    // Verify transaction with NabooPay API (extra security)
    if (orderId && amount) {
      const verification = await verifyTransactionDetails(orderId, amount);
      if (!verification.valid) {
        console.error('[BILLBOARD_PAYMENT_WEBHOOK] Transaction verification failed:', verification.error);
        return NextResponse.json(
          { error: 'Transaction verification failed' },
          { status: 400 }
        );
      }
    }

    // Process based on status
    if (status === 'completed' || status === 'success' || status === 'paid') {
      await processPaymentSuccess(paymentId, orderId, paymentMethod);

      // Notify WhatsApp user if applicable
      if (contentId) {
        try {
          await onPaymentComplete(contentId, paymentId);
        } catch (error) {
          console.error('[BILLBOARD_PAYMENT_WEBHOOK] Failed to notify WhatsApp:', error);
          // Don't fail for notification errors
        }
      }

      console.log('[BILLBOARD_PAYMENT_WEBHOOK] Payment processed successfully:', paymentId);
    } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      await processPaymentFailure(paymentId);
      console.log('[BILLBOARD_PAYMENT_WEBHOOK] Payment failed:', paymentId, status);
    } else {
      console.log('[BILLBOARD_PAYMENT_WEBHOOK] Unhandled status:', status);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[BILLBOARD_PAYMENT_WEBHOOK] Error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

// Handle redirect callbacks (success/error URLs)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const paymentId = searchParams.get('payment_id');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://seetu.sn';

  if (!paymentId) {
    // Redirect to billboard page
    return NextResponse.redirect(`${baseUrl}/billboards`);
  }

  // Get payment details
  const payment = await getPayment(paymentId);

  if (!payment) {
    return NextResponse.redirect(`${baseUrl}/billboards?error=payment_not_found`);
  }

  // Redirect based on status
  if (status === 'success') {
    // Payment successful - redirect to content page
    return NextResponse.redirect(
      `${baseUrl}/billboards/my-content?payment=success&id=${payment.contentId}`
    );
  } else if (status === 'error') {
    // Payment failed - redirect back to payment page
    return NextResponse.redirect(
      `${baseUrl}/billboards/my-content/${payment.contentId}?payment=failed`
    );
  }

  // Default redirect
  return NextResponse.redirect(`${baseUrl}/billboards/my-content`);
}
