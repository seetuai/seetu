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
        // If user sends media, process it directly for new order
        if (message.type === 'image' || message.type === 'video') {
          await updateSessionState(message.phone, 'AWAITING_MEDIA');
          return await handleMediaState(message, session);
        }
        // Otherwise prompt for new order
        await wati.sendMessage({
          phone: message.phone,
          message: 'Envoyez une image ou vidéo pour une nouvelle pub.',
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

  // Short processing message
  await wati.sendMessage({
    phone: message.phone,
    message: '⏳ Traitement en cours...',
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

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ||
      (message.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const extension = message.type === 'video' ? 'mp4' : 'jpg';
    const filename = `billboard-whatsapp-${message.phone}-${Date.now()}.${extension}`;

    const upload = await uploadBuffer(
      BUCKETS.UPLOADS,
      buffer,
      filename,
      contentType
    );

    // Create content record
    const content = await prisma.billboardContent.create({
      data: {
        whatsappPhone: message.phone,
        whatsappName: session.name,
        mediaType: message.type,
        originalUrl: upload.url,
        status: 'pending_payment',
      },
    });

    // Update session with content ID
    await setSessionContent(message.phone, content.id);

    // Update session state and send billboard list directly
    await updateSessionState(message.phone, 'AWAITING_BILLBOARD');
    await sendBillboardList(message.phone);

    return { success: true };
  } catch (error) {
    console.error('[WA_HANDLER] Media upload error:', error);
    await wati.sendMessage({
      phone: message.phone,
      message: '❌ Erreur. Réessayez avec une autre image/vidéo.',
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

  // Need text or list_reply for selection
  if (message.type !== 'text' && message.type !== 'list_reply') {
    await sendBillboardList(message.phone);
    return { success: true };
  }

  // Get available billboards
  const billboards = await prisma.billboard.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true, pricePerSlot: true },
  });

  let selectedIds: string[] = [];

  // Handle list reply (from interactive list)
  if (message.type === 'list_reply' && (message.listId || message.listTitle)) {
    console.log('[WA_HANDLER] List reply received:', { listId: message.listId, listTitle: message.listTitle });
    const listValue = message.listId || message.listTitle || '';

    // Check for "all" selection
    if (listValue === 'all' || listValue.toLowerCase().includes('tous')) {
      selectedIds = billboards.map(b => b.id);
    } else {
      // Try to find by ID first
      const byId = billboards.find(b => b.id === listValue);
      if (byId) {
        selectedIds = [byId.id];
      } else {
        // Try to match by name (WATI may return the row title)
        const byName = billboards.find(b =>
          b.name.toLowerCase() === listValue.toLowerCase() ||
          b.name.toLowerCase().includes(listValue.toLowerCase()) ||
          listValue.toLowerCase().includes(b.name.toLowerCase())
        );
        if (byName) {
          selectedIds = [byName.id];
        }
      }
    }
  } else {
    // Handle text input - use LLM or simple matching
    const userSelection = message.text || '';
    if (!userSelection.trim()) {
      await sendBillboardList(message.phone);
      return { success: true };
    }
    console.log('[WA_HANDLER] Parsing billboard selection:', userSelection);
    selectedIds = await parseBillboardSelectionWithLLM(userSelection, billboards);
  }

  const selectedBillboards = billboards.filter(b => selectedIds.includes(b.id));

  if (selectedBillboards.length === 0) {
    await sendBillboardList(message.phone);
    return { success: true };
  }

  // Update session with selected billboards
  const billboardIds = selectedBillboards.map(b => b.id);
  await setSelectedBillboards(message.phone, billboardIds);

  // Calculate price
  const billboardSlots: Record<string, number> = {};
  billboardIds.forEach(id => {
    billboardSlots[id] = 1;
  });
  const pricing = await calculatePrice(billboardSlots);

  // Create payment
  if (!session.currentContentId) {
    await wati.sendMessage({
      phone: message.phone,
      message: '❌ Erreur. Envoyez "reprendre" pour recommencer.',
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

    // Build recap message
    const billboardNames = selectedBillboards.map(b => b.name).join(', ');
    const recapBody = `📋 *Récapitulatif*\n\n` +
      `📺 ${selectedBillboards.length > 1 ? 'Panneaux' : 'Panneau'}: ${billboardNames}\n` +
      `💰 Total: ${pricing.totalCfa} F CFA` +
      (pricing.discount > 0 ? ` (${pricing.discountReason})` : '');

    // Send CTA button for payment
    await wati.sendCTAButton({
      phone: message.phone,
      body: recapBody,
      footer: 'Paiement sécurisé via Wave',
      buttonText: '💳 Payer maintenant',
      url: payment.checkoutUrl,
    });

    return { success: true };
  } catch (error) {
    console.error('[WA_HANDLER] Payment creation failed:', error);
    await wati.sendMessage({
      phone: message.phone,
      message: '❌ Erreur de paiement. Réessayez ou envoyez "support".',
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
 * Send billboard list to user using interactive list
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
      message: 'Aucun panneau disponible. Réessayez plus tard.',
    });
    return;
  }

  // Use interactive list for billboard selection
  const listResult = await wati.sendList({
    phone,
    body: '✅ Fichier reçu! Choisissez où diffuser votre pub:',
    buttonText: 'Voir les panneaux',
    sections: [
      {
        title: 'Panneaux disponibles',
        rows: [
          // Add "All billboards" option first
          {
            id: 'all',
            title: '📺 Tous les panneaux',
            description: `${billboards.length} panneaux - Meilleure visibilité`,
          },
          // Add individual billboards
          ...billboards.map((b) => ({
            id: b.id,
            title: b.name,
            description: `${b.address} • ${b.pricePerSlot} F`,
          })),
        ],
      },
    ],
  });

  // Fallback to text if list fails
  if (!listResult.success) {
    let message = '✅ Fichier reçu! Choisissez un panneau:\n\n';
    billboards.forEach((b, i) => {
      message += `${i + 1}. ${b.name} - ${b.pricePerSlot} F\n`;
    });
    message += '\nRépondez avec le numéro ou "tous"';
    await wati.sendMessage({ phone, message });
  }
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
