/**
 * WhatsApp Message Handler
 *
 * Routes incoming WhatsApp messages to appropriate handlers
 * based on session state and message content
 */

import { getWatiClient, WatiMessage } from './wati-client';
import {
  getOrCreateSession,
  updateSessionState,
  setSessionContent,
  setSelectedBillboards,
  setPaymentId,
  resetSession,
  Session,
  SessionData,
} from './session-manager';
import * as templates from './templates';
import { prisma } from '../../prisma';
import { getBillboardPricing, calculatePrice, formatPriceCFA } from '../pricing';
import { getContentQueuePositions } from '../queue-manager';
import { enqueueValidation } from '../../queues/billboard-queue';
import { uploadBuffer, BUCKETS } from '../../storage';
import { createBillboardPayment } from '../payments';

interface HandlerResult {
  success: boolean;
  error?: string;
}

/**
 * Main message handler - routes based on state
 */
export async function handleIncomingMessage(
  message: WatiMessage
): Promise<HandlerResult> {
  const wati = getWatiClient();

  try {
    // Get or create session
    const contact = await wati.getContact(message.phone);
    const session = await getOrCreateSession(message.phone, contact?.name);

    console.log(
      `[WA_HANDLER] Message from ${message.phone} (state: ${session.state}): ${message.type}`
    );

    // Check for special commands first
    const commandResult = await handleSpecialCommands(message, session);
    if (commandResult) return commandResult;

    // Route based on session state
    switch (session.state) {
      case 'START':
      case 'AWAITING_MEDIA':
        return await handleMediaState(message, session);

      case 'AWAITING_BILLBOARD':
        return await handleBillboardSelection(message, session);

      case 'AWAITING_PAYMENT':
        return await handlePaymentState(message, session);

      case 'CONFIRMED':
        // After confirmation, allow new orders
        await wati.sendMessage({
          phone: message.phone,
          message: templates.RETURNING_USER_MESSAGE(session.name || undefined),
        });
        await updateSessionState(message.phone, 'AWAITING_MEDIA');
        return { success: true };

      case 'EXPIRED':
        // Restart session
        await wati.sendMessage({
          phone: message.phone,
          message: templates.SESSION_EXPIRED,
        });
        await resetSession(message.phone);
        return { success: true };

      default:
        await wati.sendMessage({
          phone: message.phone,
          message: templates.UNKNOWN_COMMAND,
        });
        return { success: true };
    }
  } catch (error) {
    console.error('[WA_HANDLER] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle special commands (aide, annuler, statut, support)
 */
async function handleSpecialCommands(
  message: WatiMessage,
  session: Session
): Promise<HandlerResult | null> {
  if (message.type !== 'text' || !message.text) return null;

  const text = message.text.toLowerCase().trim();
  const wati = getWatiClient();

  if (text === 'aide' || text === 'help') {
    await wati.sendMessage({
      phone: message.phone,
      message: templates.HELP_MESSAGE,
    });
    return { success: true };
  }

  if (text === 'annuler' || text === 'cancel') {
    await resetSession(message.phone);
    await wati.sendMessage({
      phone: message.phone,
      message: templates.ORDER_CANCELLED,
    });
    return { success: true };
  }

  if (text === 'statut' || text === 'status') {
    if (session.currentContentId) {
      const positions = await getContentQueuePositions(session.currentContentId);
      const content = await prisma.billboardContent.findUnique({
        where: { id: session.currentContentId },
        select: { status: true },
      });

      await wati.sendMessage({
        phone: message.phone,
        message: templates.formatContentStatus(
          content?.status || 'unknown',
          session.currentContentId,
          positions.map(p => ({
            billboardName: p.billboardName,
            position: p.position,
          }))
        ),
      });
    } else {
      await wati.sendMessage({
        phone: message.phone,
        message: 'Aucune commande en cours.',
      });
    }
    return { success: true };
  }

  if (text === 'support') {
    await wati.sendMessage({
      phone: message.phone,
      message: templates.SUPPORT_CONTACT,
    });
    return { success: true };
  }

  if (text === 'reprendre') {
    // Resume from payment if pending
    if (session.state === 'AWAITING_PAYMENT' && session.data.paymentId) {
      const payment = await prisma.billboardPayment.findUnique({
        where: { id: session.data.paymentId },
        select: { checkoutUrl: true, status: true },
      });

      if (payment?.status === 'pending' && payment.checkoutUrl) {
        await wati.sendMessage({
          phone: message.phone,
          message: `${templates.PAYMENT_PROMPT}\n\n${templates.formatPaymentLink(payment.checkoutUrl)}`,
        });
        return { success: true };
      }
    }

    // Otherwise restart
    await resetSession(message.phone);
    await wati.sendMessage({
      phone: message.phone,
      message: templates.WELCOME_MESSAGE,
    });
    return { success: true };
  }

  return null; // Not a special command
}

/**
 * Handle media upload state
 */
async function handleMediaState(
  message: WatiMessage,
  session: Session
): Promise<HandlerResult> {
  const wati = getWatiClient();

  // If first contact, send welcome
  if (session.state === 'START') {
    await updateSessionState(message.phone, 'AWAITING_MEDIA');

    // Check if this message already contains media
    if (message.type !== 'image' && message.type !== 'video') {
      await wati.sendMessage({
        phone: message.phone,
        message: templates.WELCOME_MESSAGE,
      });
      return { success: true };
    }
  }

  // Check for media
  if (message.type !== 'image' && message.type !== 'video') {
    await wati.sendMessage({
      phone: message.phone,
      message: templates.WELCOME_MESSAGE,
    });
    return { success: true };
  }

  if (!message.mediaUrl) {
    await wati.sendMessage({
      phone: message.phone,
      message: templates.MEDIA_VALIDATION_ERROR("Impossible de télécharger le fichier"),
    });
    return { success: true };
  }

  // Acknowledge receipt
  await wati.sendMessage({
    phone: message.phone,
    message: templates.MEDIA_RECEIVED,
  });

  try {
    // Download and upload media to storage
    const response = await fetch(message.mediaUrl);
    if (!response.ok) {
      throw new Error('Failed to download media');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ||
      (message.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const extension = message.type === 'video' ? 'mp4' : 'jpg';

    const upload = await uploadBuffer(
      BUCKETS.UPLOADS,
      buffer,
      `billboard-whatsapp-${message.phone}-${Date.now()}.${extension}`,
      contentType
    );

    // Create content record
    const content = await prisma.billboardContent.create({
      data: {
        whatsappPhone: message.phone,
        whatsappName: session.name,
        mediaType: message.type,
        originalUrl: upload.url,
        status: 'pending_validation',
      },
    });

    // Update session with content ID
    await setSessionContent(message.phone, content.id);

    // Enqueue validation job
    await enqueueValidation({
      contentId: content.id,
      originalUrl: upload.url,
      whatsappPhone: message.phone,
    });

    return { success: true };
  } catch (error) {
    console.error('[WA_HANDLER] Media upload error:', error);
    await wati.sendMessage({
      phone: message.phone,
      message: templates.MEDIA_VALIDATION_ERROR(
        error instanceof Error ? error.message : 'Erreur lors du téléchargement'
      ),
    });
    return { success: false, error: 'Media upload failed' };
  }
}

/**
 * Handle billboard selection state
 */
async function handleBillboardSelection(
  message: WatiMessage,
  session: Session
): Promise<HandlerResult> {
  const wati = getWatiClient();

  // Parse billboard selection (comma-separated numbers)
  if (message.type !== 'text' && message.type !== 'list_reply') {
    await sendBillboardList(message.phone);
    return { success: true };
  }

  // Get selection from message
  let selectedIndices: number[] = [];

  if (message.type === 'list_reply' && message.listId) {
    selectedIndices = [parseInt(message.listId)];
  } else if (message.text) {
    // Parse comma-separated numbers
    const matches = message.text.match(/\d+/g);
    if (matches) {
      selectedIndices = matches.map(m => parseInt(m));
    }
  }

  if (selectedIndices.length === 0) {
    await wati.sendMessage({
      phone: message.phone,
      message: templates.BILLBOARD_INVALID_SELECTION,
    });
    return { success: true };
  }

  // Get billboards and validate selection
  const billboards = await prisma.billboard.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, pricePerSlot: true },
  });

  const selectedBillboards = selectedIndices
    .filter(i => i >= 1 && i <= billboards.length)
    .map(i => billboards[i - 1]);

  if (selectedBillboards.length === 0) {
    await wati.sendMessage({
      phone: message.phone,
      message: templates.BILLBOARD_INVALID_SELECTION,
    });
    return { success: true };
  }

  // Update session with selected billboards
  const billboardIds = selectedBillboards.map(b => b.id);
  await setSelectedBillboards(message.phone, billboardIds);

  // Calculate price
  const billboardSlots: Record<string, number> = {};
  billboardIds.forEach(id => {
    billboardSlots[id] = 1; // 1 slot per billboard
  });

  const pricing = await calculatePrice(billboardSlots);

  // Confirm selection
  await wati.sendMessage({
    phone: message.phone,
    message: templates.BILLBOARD_SELECTION_CONFIRMED(selectedBillboards.length),
  });

  // Send price summary
  await wati.sendMessage({
    phone: message.phone,
    message: templates.formatPriceSummary(
      selectedBillboards.map(b => ({ name: b.name, price: b.pricePerSlot })),
      pricing.subtotal,
      pricing.discount,
      pricing.totalCfa,
      pricing.discountReason
    ),
  });

  // Create payment
  if (!session.currentContentId) {
    await wati.sendMessage({
      phone: message.phone,
      message: 'Erreur: contenu introuvable. Envoyez "reprendre" pour recommencer.',
    });
    return { success: false, error: 'No content ID in session' };
  }

  const payment = await createBillboardPayment({
    contentId: session.currentContentId,
    billboardIds,
    amountCfa: pricing.totalCfa,
    whatsappPhone: message.phone,
  });

  await setPaymentId(message.phone, payment.id);
  await updateSessionState(message.phone, 'AWAITING_PAYMENT');

  // Send payment link
  await wati.sendMessage({
    phone: message.phone,
    message: `${templates.PAYMENT_PROMPT}\n\n${templates.formatPaymentLink(payment.checkoutUrl)}`,
  });

  return { success: true };
}

/**
 * Handle payment state
 */
async function handlePaymentState(
  message: WatiMessage,
  session: Session
): Promise<HandlerResult> {
  const wati = getWatiClient();

  // Check if user wants to retry payment or cancel
  if (message.type === 'text' && message.text) {
    const text = message.text.toLowerCase().trim();

    if (text === 'payer' || text === 'reprendre') {
      // Resend payment link
      if (session.data.paymentId) {
        const payment = await prisma.billboardPayment.findUnique({
          where: { id: session.data.paymentId },
          select: { checkoutUrl: true, status: true },
        });

        if (payment?.status === 'pending' && payment.checkoutUrl) {
          await wati.sendMessage({
            phone: message.phone,
            message: `${templates.PAYMENT_PROMPT}\n\n${templates.formatPaymentLink(payment.checkoutUrl)}`,
          });
          return { success: true };
        }
      }
    }
  }

  // Default: remind about payment
  await wati.sendMessage({
    phone: message.phone,
    message: `Votre commande est en attente de paiement.\n\nRépondez "payer" pour recevoir le lien de paiement, ou "annuler" pour annuler la commande.`,
  });

  return { success: true };
}

/**
 * Send billboard list to user
 */
async function sendBillboardList(phone: string): Promise<void> {
  const wati = getWatiClient();

  const billboards = await prisma.billboard.findMany({
    where: {
      isActive: true,
      status: { not: 'maintenance' },
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      address: true,
      pricePerSlot: true,
      slotDurationSecs: true,
      _count: {
        select: {
          queueItems: {
            where: { status: 'queued' },
          },
        },
      },
    },
  });

  if (billboards.length === 0) {
    await wati.sendMessage({
      phone,
      message: 'Aucun panneau disponible pour le moment. Réessayez plus tard.',
    });
    return;
  }

  // Build billboard list message
  let message = `${templates.BILLBOARD_SELECTION_INTRO}\n\n`;

  billboards.forEach((b, index) => {
    message += templates.formatBillboardOption(
      index + 1,
      b.name,
      b.address,
      b.pricePerSlot,
      Math.round(b.slotDurationSecs / 60),
      b._count.queueItems
    );
    message += '\n\n';
  });

  message += templates.BILLBOARD_SELECTION_PROMPT;

  await wati.sendMessage({ phone, message });
}

/**
 * Handle validation complete callback
 * Called by worker when validation passes
 */
export async function onValidationComplete(
  contentId: string,
  success: boolean,
  error?: string
): Promise<void> {
  const content = await prisma.billboardContent.findUnique({
    where: { id: contentId },
    select: { whatsappPhone: true },
  });

  if (!content?.whatsappPhone) return;

  const wati = getWatiClient();
  const phone = content.whatsappPhone;

  if (!success) {
    await wati.sendMessage({
      phone,
      message: templates.MEDIA_VALIDATION_ERROR(error || 'Validation échouée'),
    });
    return;
  }

  // Validation passed, wait for moderation
  // (moderation will trigger next step)
}

/**
 * Handle moderation complete callback
 * Called by worker when moderation completes
 */
export async function onModerationComplete(
  contentId: string,
  approved: boolean,
  reviewRequired: boolean,
  rejectionReason?: string
): Promise<void> {
  const content = await prisma.billboardContent.findUnique({
    where: { id: contentId },
    select: { whatsappPhone: true },
  });

  if (!content?.whatsappPhone) return;

  const wati = getWatiClient();
  const phone = content.whatsappPhone;

  if (!approved && !reviewRequired) {
    await wati.sendMessage({
      phone,
      message: templates.MEDIA_MODERATION_REJECTED(rejectionReason || 'Contenu non conforme'),
    });
    await resetSession(phone);
    return;
  }

  if (reviewRequired) {
    await wati.sendMessage({
      phone,
      message: templates.MEDIA_MODERATION_PENDING,
    });
    return;
  }

  // Moderation passed, send billboard selection
  await updateSessionState(phone, 'AWAITING_BILLBOARD');
  await wati.sendMessage({
    phone,
    message: templates.MEDIA_VALIDATION_SUCCESS,
  });
  await sendBillboardList(phone);
}

/**
 * Handle payment complete callback
 * Called by webhook when payment succeeds
 */
export async function onPaymentComplete(
  contentId: string,
  paymentId: string
): Promise<void> {
  const content = await prisma.billboardContent.findUnique({
    where: { id: contentId },
    select: { whatsappPhone: true },
  });

  if (!content?.whatsappPhone) return;

  const wati = getWatiClient();
  const phone = content.whatsappPhone;

  // Get queue positions
  const positions = await getContentQueuePositions(contentId);

  await updateSessionState(phone, 'CONFIRMED');
  await wati.sendMessage({
    phone,
    message: templates.PAYMENT_SUCCESS,
  });

  await wati.sendMessage({
    phone,
    message: templates.formatQueueConfirmation(
      positions.map(p => ({
        billboardName: p.billboardName,
        position: p.position,
        estimatedTime: p.estimatedPlayTime,
      }))
    ),
  });
}

/**
 * Handle playback proof delivery
 * Called when content finishes playing
 */
export async function onPlaybackComplete(
  contentId: string,
  billboardName: string,
  proofUrl: string,
  playedAt: Date
): Promise<void> {
  const content = await prisma.billboardContent.findUnique({
    where: { id: contentId },
    select: { whatsappPhone: true },
  });

  if (!content?.whatsappPhone) return;

  const wati = getWatiClient();

  // Send proof
  await wati.sendMedia({
    phone: content.whatsappPhone,
    mediaUrl: proofUrl,
    caption: templates.formatPlaybackProof(billboardName, proofUrl, playedAt),
    mediaType: 'image',
  });
}
