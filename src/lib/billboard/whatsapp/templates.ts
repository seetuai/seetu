/**
 * WhatsApp Message Templates (French)
 *
 * All user-facing messages for the WhatsApp billboard booking flow
 */

import { formatPriceCFA } from '../pricing';

// ═══════════════════════════════════════════════════════════════
// WELCOME & ONBOARDING
// ═══════════════════════════════════════════════════════════════

export const WELCOME_MESSAGE = `Bienvenue sur Seetu Billboards!

Diffusez votre publicité sur les panneaux numériques de Dakar en quelques minutes.

Pour commencer, envoyez-moi votre image ou vidéo (max 60 secondes, min 1280x720).`;

export const RETURNING_USER_MESSAGE = (name?: string) =>
  `Rebonjour${name ? ` ${name}` : ''}!

Envoyez-moi votre nouvelle publicité (image ou vidéo) pour l'afficher sur nos panneaux.`;

// ═══════════════════════════════════════════════════════════════
// MEDIA HANDLING
// ═══════════════════════════════════════════════════════════════

export const MEDIA_RECEIVED = `Super! J'ai bien reçu votre fichier.

Je vérifie la qualité et le contenu... Cela prend quelques secondes.`;

export const MEDIA_VALIDATION_SUCCESS = `Votre fichier est conforme!

Maintenant, choisissez les panneaux où vous souhaitez diffuser votre publicité.`;

export const MEDIA_VALIDATION_ERROR = (error: string) =>
  `Désolé, votre fichier ne peut pas être utilisé.

Raison: ${error}

Veuillez envoyer un nouveau fichier (format: MP4, MOV, JPG, PNG - max 50MB, min 1280x720).`;

export const MEDIA_MODERATION_REJECTED = (reason: string) =>
  `Désolé, votre contenu ne peut pas être diffusé.

Raison: ${reason}

Le contenu doit respecter nos directives communautaires. Envoyez un autre fichier si vous le souhaitez.`;

export const MEDIA_MODERATION_PENDING = `Votre contenu est en cours de vérification par notre équipe.

Vous recevrez une notification dès qu'il sera approuvé (généralement sous 1 heure pendant les heures ouvrables).`;

// ═══════════════════════════════════════════════════════════════
// BILLBOARD SELECTION
// ═══════════════════════════════════════════════════════════════

export const BILLBOARD_SELECTION_INTRO = `Voici nos panneaux disponibles à Dakar:`;

export const formatBillboardOption = (
  index: number,
  name: string,
  address: string,
  pricePerSlot: number,
  slotDurationMins: number,
  queueLength: number
) => {
  const queueInfo = queueLength > 0 ? ` (${queueLength} en attente)` : ' (disponible maintenant)';
  return `${index}. ${name}
   📍 ${address}
   💰 ${formatPriceCFA(pricePerSlot)} / ${slotDurationMins} min${queueInfo}`;
};

export const BILLBOARD_SELECTION_PROMPT = `Dites-moi simplement quel(s) panneau(x) vous intéresse(nt).

Par exemple: "Sea Plaza" ou "tous les panneaux" ou "Corniche et Almadies"`;

export const BILLBOARD_INVALID_SELECTION = `Je n'ai pas trouvé de panneau correspondant.

Dites-moi le nom du panneau souhaité, par exemple "Sea Plaza" ou "tous".`;

export const BILLBOARD_SELECTION_CONFIRMED = (count: number) =>
  `Vous avez sélectionné ${count} panneau${count > 1 ? 'x' : ''}.`;

// ═══════════════════════════════════════════════════════════════
// PRICING & PAYMENT
// ═══════════════════════════════════════════════════════════════

export const formatPriceSummary = (
  billboards: Array<{ name: string; price: number }>,
  subtotal: number,
  discount: number,
  total: number,
  discountReason?: string
) => {
  let message = `Récapitulatif de votre commande:\n\n`;

  for (const b of billboards) {
    message += `• ${b.name}: ${formatPriceCFA(b.price)}\n`;
  }

  message += `\nSous-total: ${formatPriceCFA(subtotal)}`;

  if (discount > 0) {
    message += `\n${discountReason || 'Réduction'}: -${formatPriceCFA(discount)}`;
  }

  message += `\n\nTotal à payer: ${formatPriceCFA(total)}`;

  return message;
};

export const PAYMENT_PROMPT = `Pour finaliser votre commande, cliquez sur le lien de paiement ci-dessous.

Modes de paiement acceptés: Wave, Orange Money, Visa`;

export const formatPaymentLink = (checkoutUrl: string) =>
  `Payez ici: ${checkoutUrl}`;

export const PAYMENT_SUCCESS = `Paiement reçu! Merci.

Votre publicité est en cours de préparation pour diffusion.`;

export const PAYMENT_FAILED = `Le paiement n'a pas abouti.

Veuillez réessayer ou contacter notre support si le problème persiste.`;

export const PAYMENT_EXPIRED = `Votre session de paiement a expiré.

Envoyez "reprendre" pour recommencer le processus.`;

// ═══════════════════════════════════════════════════════════════
// QUEUE & CONFIRMATION
// ═══════════════════════════════════════════════════════════════

export const formatQueueConfirmation = (
  positions: Array<{
    billboardName: string;
    position: number;
    estimatedTime: Date | null;
  }>
) => {
  let message = `Votre publicité est en file d'attente!\n\n`;

  for (const p of positions) {
    const timeStr = p.estimatedTime
      ? formatTime(p.estimatedTime)
      : 'Bientôt';
    message += `• ${p.billboardName}\n`;
    message += `  Position: ${p.position} | Diffusion: ~${timeStr}\n`;
  }

  message += `\nVous recevrez une notification avec la preuve de diffusion.`;

  return message;
};

export const formatPlaybackProof = (
  billboardName: string,
  proofUrl: string,
  playedAt: Date
) => `Votre publicité a été diffusée!

📺 ${billboardName}
🕐 ${formatDateTime(playedAt)}

Preuve de diffusion: ${proofUrl}

Merci d'avoir choisi Seetu Billboards!`;

// ═══════════════════════════════════════════════════════════════
// ERROR & HELP
// ═══════════════════════════════════════════════════════════════

export const UNKNOWN_COMMAND = `Je n'ai pas compris votre message.

Commandes disponibles:
• Envoyez une image ou vidéo pour démarrer
• "aide" - Obtenir de l'aide
• "annuler" - Annuler la commande en cours
• "statut" - Voir le statut de vos publicités`;

export const HELP_MESSAGE = `Seetu Billboards - Aide

Comment ça marche:
1. Envoyez votre image ou vidéo publicitaire
2. Choisissez les panneaux où diffuser
3. Payez via Wave, Orange Money ou Visa
4. Votre publicité est diffusée!

Formats acceptés:
• Vidéo: MP4, MOV (max 60s, max 50MB)
• Image: JPG, PNG (min 1280x720)

Besoin d'aide? Écrivez "support" pour contacter notre équipe.`;

export const ORDER_CANCELLED = `Votre commande a été annulée.

Envoyez une nouvelle image ou vidéo pour recommencer.`;

export const SESSION_EXPIRED = `Votre session a expiré après 30 minutes d'inactivité.

Envoyez une nouvelle image ou vidéo pour recommencer.`;

export const SUPPORT_CONTACT = `Pour contacter notre support:

📱 WhatsApp: +221 XX XXX XX XX
📧 Email: support@seetu.sn
🕐 Disponible: Lun-Ven 9h-18h`;

// ═══════════════════════════════════════════════════════════════
// STATUS UPDATES
// ═══════════════════════════════════════════════════════════════

export const formatContentStatus = (
  status: string,
  contentId: string,
  queuePositions?: Array<{ billboardName: string; position: number }>
) => {
  const statusMessages: Record<string, string> = {
    pending_validation: 'En cours de vérification...',
    pending_moderation: 'En cours de modération...',
    pending_payment: 'En attente de paiement',
    processing: 'En cours de traitement...',
    ready: 'Prêt pour diffusion',
    rejected: 'Refusé',
  };

  let message = `Statut de votre publicité:\n`;
  message += `📋 ${statusMessages[status] || status}\n`;

  if (queuePositions && queuePositions.length > 0) {
    message += `\nPositions dans les files:\n`;
    for (const p of queuePositions) {
      message += `• ${p.billboardName}: #${p.position}\n`;
    }
  }

  return message;
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-SN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('fr-SN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
