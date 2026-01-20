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
import { uploadBuffer, BUCKETS } from '../../storage';
import { createBillboardPayment } from '../payments';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini for natural language understanding
const genAI = process.env.GOOGLE_AI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
  : null;

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
    // Download media from WATI - requires authentication for WATI file URLs
    const watiApiToken = process.env.WATI_API_TOKEN || '';
    const fetchHeaders: Record<string, string> = {};

    // Add auth for WATI URLs (they require Bearer token)
    if (message.mediaUrl.includes('wati.io')) {
      fetchHeaders['Authorization'] = `Bearer ${watiApiToken}`;
    }

    console.log('[WA_HANDLER] Downloading media from:', message.mediaUrl.substring(0, 80) + '...');
    const response = await fetch(message.mediaUrl, { headers: fetchHeaders });

    if (!response.ok) {
      console.error('[WA_HANDLER] Media download failed:', response.status, response.statusText);
      throw new Error(`Failed to download media: ${response.status}`);
    }

    console.log('[WA_HANDLER] Media downloaded successfully, size:', response.headers.get('content-length'));

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log('[WA_HANDLER] Buffer created, size:', buffer.length);

    const contentType = response.headers.get('content-type') ||
      (message.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const extension = message.type === 'video' ? 'mp4' : 'jpg';
    const filename = `billboard-whatsapp-${message.phone}-${Date.now()}.${extension}`;

    console.log('[WA_HANDLER] Uploading to storage:', filename, contentType);

    const upload = await uploadBuffer(
      BUCKETS.UPLOADS,
      buffer,
      filename,
      contentType
    );

    console.log('[WA_HANDLER] Upload complete:', upload.url);

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

    console.log('[WA_HANDLER] Content record created:', content.id);

    // Update session with content ID
    await setSessionContent(message.phone, content.id);

    // For MVP: Skip queue-based validation/moderation and go directly to billboard selection
    // TODO: Enable queue-based processing when workers are deployed
    console.log('[WA_HANDLER] MVP mode: Skipping queue, moving to billboard selection');

    // Update content status (simulating validation pass)
    await prisma.billboardContent.update({
      where: { id: content.id },
      data: { status: 'pending_payment' },
    });

    // Update session state and send billboard list
    await updateSessionState(message.phone, 'AWAITING_BILLBOARD');
    await wati.sendMessage({
      phone: message.phone,
      message: templates.MEDIA_VALIDATION_SUCCESS,
    });
    await sendBillboardList(message.phone);

    console.log('[WA_HANDLER] Billboard selection list sent');
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
 * Parse billboard selection using LLM (natural language understanding)
 */
async function parseBillboardSelectionWithLLM(
  userMessage: string,
  billboards: Array<{ id: string; name: string; address: string; pricePerSlot: number }>
): Promise<string[]> {
  if (!genAI) {
    console.warn('[WA_HANDLER] Gemini not configured, falling back to simple matching');
    return simpleBillboardMatch(userMessage, billboards);
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
      responseMimeType: 'application/json',
    },
  });

  const billboardList = billboards.map((b, i) => `${i + 1}. "${b.name}" (${b.address})`).join('\n');

  const prompt = `Tu es un assistant qui aide à sélectionner des panneaux publicitaires.

PANNEAUX DISPONIBLES:
${billboardList}

MESSAGE DU CLIENT: "${userMessage}"

TÂCHE: Identifie quels panneaux le client veut sélectionner. Le client peut:
- Nommer directement: "Sea Plaza", "le panneau de la corniche"
- Dire "tous", "all", "tous les panneaux"
- Donner des numéros: "1", "le premier", "1 et 3"
- Utiliser des mots-clés: partie du nom, quartier, etc.

Retourne un JSON avec les IDs des panneaux sélectionnés:
{"selected_ids": ["id1", "id2"], "understood": true, "clarification": null}

Si tu ne comprends pas ou si aucun panneau ne correspond:
{"selected_ids": [], "understood": false, "clarification": "Message de clarification en français"}

PANNEAUX AVEC IDS:
${billboards.map(b => `- id: "${b.id}", name: "${b.name}"`).join('\n')}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    console.log('[WA_HANDLER] LLM billboard selection:', parsed);

    if (parsed.understood && parsed.selected_ids?.length > 0) {
      return parsed.selected_ids;
    }
    return [];
  } catch (error) {
    console.error('[WA_HANDLER] LLM parsing error:', error);
    return simpleBillboardMatch(userMessage, billboards);
  }
}

/**
 * Simple fallback billboard matching (without LLM)
 */
function simpleBillboardMatch(
  userMessage: string,
  billboards: Array<{ id: string; name: string; address: string }>
): string[] {
  const msg = userMessage.toLowerCase().trim();

  // Check for "all" / "tous"
  if (msg === 'tous' || msg === 'all' || msg.includes('tous les panneaux')) {
    return billboards.map(b => b.id);
  }

  // Check for number references
  const numberMatch = msg.match(/\d+/g);
  if (numberMatch) {
    const indices = numberMatch.map(n => parseInt(n) - 1);
    return indices
      .filter(i => i >= 0 && i < billboards.length)
      .map(i => billboards[i].id);
  }

  // Try to match by name
  const matches: string[] = [];
  for (const b of billboards) {
    const nameLower = b.name.toLowerCase();
    const addressLower = b.address.toLowerCase();
    if (nameLower.includes(msg) || msg.includes(nameLower) ||
        addressLower.includes(msg) || msg.includes(addressLower)) {
      matches.push(b.id);
    }
  }

  return matches;
}

/**
 * Handle billboard selection state
 */
async function handleBillboardSelection(
  message: WatiMessage,
  session: Session
): Promise<HandlerResult> {
  const wati = getWatiClient();

  // Need text input for selection
  if (message.type !== 'text' && message.type !== 'list_reply') {
    await sendBillboardList(message.phone);
    return { success: true };
  }

  // Get user's selection text
  const userSelection = message.type === 'list_reply' && message.listTitle
    ? message.listTitle
    : message.text || '';

  if (!userSelection.trim()) {
    await sendBillboardList(message.phone);
    return { success: true };
  }

  // Get available billboards
  const billboards = await prisma.billboard.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true, pricePerSlot: true },
  });

  // Use LLM to parse natural language selection
  console.log('[WA_HANDLER] Parsing billboard selection:', userSelection);
  const selectedIds = await parseBillboardSelectionWithLLM(userSelection, billboards);

  const selectedBillboards = billboards.filter(b => selectedIds.includes(b.id));

  if (selectedBillboards.length === 0) {
    // Didn't understand, ask for clarification
    await wati.sendMessage({
      phone: message.phone,
      message: `Je n'ai pas trouvé de panneau correspondant à "${userSelection}".\n\nVoici les panneaux disponibles:\n${billboards.map((b, i) => `• ${b.name}`).join('\n')}\n\nQuel panneau souhaitez-vous?`,
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

  try {
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
  } catch (error) {
    console.error('[WA_HANDLER] Payment creation failed:', error);
    await wati.sendMessage({
      phone: message.phone,
      message: `Une erreur est survenue lors de la création du paiement. Veuillez réessayer en envoyant le nom du panneau à nouveau.\n\nSi le problème persiste, envoyez "support" pour nous contacter.`,
    });
    return { success: false, error: 'Payment creation failed' };
  }
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
