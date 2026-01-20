/**
 * Billboard Payments
 *
 * Handles payment creation and processing for billboard ads
 * Integrates with Wave API for mobile money payments
 */

import { prisma } from '../prisma';
import { getWaveClient } from '../wave';
import { BillboardPaymentStatus, PaymentMethod } from '@prisma/client';
import { addToQueue } from './queue-manager';
import { enqueueTranscoding } from '../queues/billboard-queue';
import { RESOLUTIONS } from './transcoding';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://seetu.sn';

export interface CreatePaymentParams {
  contentId: string;
  billboardIds: string[];
  amountCfa: number;
  userId?: string;
  whatsappPhone?: string;
}

export interface PaymentResult {
  id: string;
  checkoutUrl: string;
  status: BillboardPaymentStatus;
}

/**
 * Create a billboard payment
 */
export async function createBillboardPayment(
  params: CreatePaymentParams
): Promise<PaymentResult> {
  const { contentId, billboardIds, amountCfa, userId, whatsappPhone } = params;

  // Verify content exists
  const content = await prisma.billboardContent.findUnique({
    where: { id: contentId },
  });

  if (!content) {
    throw new Error('Content not found');
  }

  // Create payment record first
  const payment = await prisma.billboardPayment.create({
    data: {
      contentId,
      userId,
      whatsappPhone,
      billboardIds,
      amountCfa,
      paymentMethod: 'wave', // Default, will be updated by payment provider
      status: 'pending',
    },
  });

  try {
    // Create Wave checkout session
    const wave = getWaveClient();

    if (!wave.isConfigured()) {
      throw new Error('Wave API not configured');
    }

    const successUrl = `${BASE_URL}/api/v1/webhooks/billboard-payment?status=success&payment_id=${payment.id}`;
    const errorUrl = `${BASE_URL}/api/v1/webhooks/billboard-payment?status=error&payment_id=${payment.id}`;

    const session = await wave.createCheckoutSession({
      amountCfa,
      clientReference: payment.id,
      successUrl,
      errorUrl,
    });

    // Update payment with checkout URL and external ref
    await prisma.billboardPayment.update({
      where: { id: payment.id },
      data: {
        checkoutUrl: session.wave_launch_url,
        externalRef: session.id,
      },
    });

    return {
      id: payment.id,
      checkoutUrl: session.wave_launch_url,
      status: 'pending',
    };
  } catch (error) {
    // Mark payment as failed
    await prisma.billboardPayment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });

    console.error('[BILLBOARD_PAYMENT] Creation failed:', error);
    throw new Error('Failed to create payment');
  }
}

/**
 * Process successful payment
 */
export async function processPaymentSuccess(
  paymentId: string,
  externalRef?: string,
  paymentMethod?: string
): Promise<void> {
  // Get payment details
  const payment = await prisma.billboardPayment.findUnique({
    where: { id: paymentId },
    include: {
      content: true,
    },
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status === 'completed') {
    console.log('[BILLBOARD_PAYMENT] Payment already processed:', paymentId);
    return;
  }

  // Update payment status
  await prisma.billboardPayment.update({
    where: { id: paymentId },
    data: {
      status: 'completed',
      paidAt: new Date(),
      externalRef: externalRef || payment.externalRef,
      paymentMethod: mapPaymentMethod(paymentMethod),
    },
  });

  // Update content status to processing
  await prisma.billboardContent.update({
    where: { id: payment.contentId },
    data: { status: 'processing' },
  });

  // Get target resolution from first billboard
  const billboard = await prisma.billboard.findFirst({
    where: { id: { in: payment.billboardIds } },
    select: {
      resolutionWidth: true,
      resolutionHeight: true,
    },
  });

  // Enqueue transcoding job
  await enqueueTranscoding({
    contentId: payment.contentId,
    originalUrl: payment.content.originalUrl,
    mediaType: payment.content.mediaType as 'image' | 'video',
    targetWidth: billboard?.resolutionWidth || RESOLUTIONS.LANDSCAPE_HD.width,
    targetHeight: billboard?.resolutionHeight || RESOLUTIONS.LANDSCAPE_HD.height,
    addOverlay: true,
  });

  console.log('[BILLBOARD_PAYMENT] Payment processed successfully:', paymentId);
}

/**
 * Add content to queues after transcoding completes
 */
export async function addContentToQueues(contentId: string): Promise<void> {
  // Get payment to find billboard IDs
  const payment = await prisma.billboardPayment.findFirst({
    where: { contentId },
    select: { billboardIds: true },
  });

  if (!payment) {
    console.error('[BILLBOARD_PAYMENT] No payment found for content:', contentId);
    return;
  }

  // Add to queue for each billboard
  await addToQueue(contentId, payment.billboardIds);

  console.log(
    `[BILLBOARD_PAYMENT] Content ${contentId} added to ${payment.billboardIds.length} queues`
  );
}

/**
 * Process payment failure
 */
export async function processPaymentFailure(paymentId: string): Promise<void> {
  await prisma.billboardPayment.update({
    where: { id: paymentId },
    data: { status: 'failed' },
  });

  // Update content status back to pending payment
  const payment = await prisma.billboardPayment.findUnique({
    where: { id: paymentId },
    select: { contentId: true },
  });

  if (payment) {
    await prisma.billboardContent.update({
      where: { id: payment.contentId },
      data: { status: 'pending_payment' },
    });
  }
}

/**
 * Process refund
 */
export async function processRefund(paymentId: string): Promise<void> {
  const payment = await prisma.billboardPayment.findUnique({
    where: { id: paymentId },
    select: { contentId: true },
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  // Update payment status
  await prisma.billboardPayment.update({
    where: { id: paymentId },
    data: { status: 'refunded' },
  });

  // Remove content from queues if not yet played
  await prisma.billboardQueue.deleteMany({
    where: {
      contentId: payment.contentId,
      status: 'queued',
    },
  });
}

/**
 * Create payment using platform credits (for logged-in users)
 */
export async function createCreditPayment(
  params: CreatePaymentParams & { creditsCost: number }
): Promise<PaymentResult> {
  const { contentId, billboardIds, amountCfa, userId, creditsCost } = params;

  if (!userId) {
    throw new Error('User ID required for credit payment');
  }

  // Check user credits
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditUnits: true },
  });

  if (!user || user.creditUnits < creditsCost * 100) {
    throw new Error('Insufficient credits');
  }

  // Create payment record
  const payment = await prisma.billboardPayment.create({
    data: {
      contentId,
      userId,
      billboardIds,
      amountCfa,
      paymentMethod: 'bonus', // Using platform credits
      status: 'completed',
      paidAt: new Date(),
    },
  });

  // Debit credits
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditUnits: { decrement: creditsCost * 100 } },
    }),
    prisma.creditLedger.create({
      data: {
        userId,
        delta: -(creditsCost * 100),
        balanceAfter: user.creditUnits - creditsCost * 100,
        reason: 'billboard',
        refType: 'billboard_payment',
        refId: payment.id,
        description: `Billboard ad - ${billboardIds.length} screen(s)`,
      },
    }),
  ]);

  // Process immediately since already paid
  await processPaymentSuccess(payment.id);

  return {
    id: payment.id,
    checkoutUrl: '', // No checkout needed
    status: 'completed',
  };
}

/**
 * Get payment by ID
 */
export async function getPayment(paymentId: string) {
  return prisma.billboardPayment.findUnique({
    where: { id: paymentId },
    include: {
      content: {
        select: {
          id: true,
          status: true,
          processedUrls: true,
        },
      },
    },
  });
}

/**
 * Get payments for user
 */
export async function getUserPayments(userId: string) {
  return prisma.billboardPayment.findMany({
    where: { userId },
    include: {
      content: {
        select: {
          id: true,
          mediaType: true,
          originalUrl: true,
          processedUrls: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get payments for WhatsApp phone
 */
export async function getWhatsAppPayments(phone: string) {
  return prisma.billboardPayment.findMany({
    where: { whatsappPhone: phone },
    include: {
      content: {
        select: {
          id: true,
          mediaType: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Map payment method string to enum
 */
function mapPaymentMethod(method?: string): PaymentMethod {
  if (!method) return 'wave';

  const methodLower = method.toLowerCase();
  if (methodLower.includes('orange')) return 'orange_money';
  if (methodLower.includes('visa') || methodLower.includes('card')) return 'visa';
  return 'wave';
}
