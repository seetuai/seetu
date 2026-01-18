/**
 * WhatsApp Session Manager
 *
 * State machine for managing WhatsApp billboard booking conversations
 *
 * States:
 * - START: Initial state, waiting for media
 * - AWAITING_MEDIA: Sent welcome, waiting for media upload
 * - AWAITING_BILLBOARD: Media validated, waiting for billboard selection
 * - AWAITING_PAYMENT: Billboards selected, waiting for payment
 * - CONFIRMED: Payment complete, order in queue
 * - EXPIRED: Session timed out
 */

import { prisma } from '../../prisma';
import { WhatsAppSessionState } from '@prisma/client';

// Session expires after 30 minutes of inactivity
const SESSION_TIMEOUT_MINUTES = 30;

export interface SessionData {
  contentId?: string;
  selectedBillboardIds?: string[];
  paymentId?: string;
  messageCount?: number;
  lastMediaUrl?: string;
}

export interface Session {
  id: string;
  phone: string;
  name: string | null;
  state: WhatsAppSessionState;
  data: SessionData;
  currentContentId: string | null;
  expiresAt: Date;
}

/**
 * Get or create a session for a phone number
 */
export async function getOrCreateSession(
  phone: string,
  name?: string
): Promise<Session> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000);

  // Try to find existing session
  let session = await prisma.whatsAppSession.findUnique({
    where: { phone },
  });

  if (session) {
    // Check if expired
    if (session.expiresAt < now) {
      // Reset expired session
      session = await prisma.whatsAppSession.update({
        where: { phone },
        data: {
          state: 'START',
          sessionData: {},
          currentContentId: null,
          lastMessageAt: now,
          expiresAt,
          name: name || session.name,
        },
      });
    } else {
      // Update last activity
      session = await prisma.whatsAppSession.update({
        where: { phone },
        data: {
          lastMessageAt: now,
          expiresAt,
          name: name || session.name,
        },
      });
    }
  } else {
    // Create new session
    session = await prisma.whatsAppSession.create({
      data: {
        phone,
        name,
        state: 'START',
        sessionData: {},
        lastMessageAt: now,
        expiresAt,
      },
    });
  }

  return {
    id: session.id,
    phone: session.phone,
    name: session.name,
    state: session.state,
    data: session.sessionData as SessionData,
    currentContentId: session.currentContentId,
    expiresAt: session.expiresAt,
  };
}

/**
 * Update session state
 */
export async function updateSessionState(
  phone: string,
  state: WhatsAppSessionState,
  data?: Partial<SessionData>
): Promise<Session> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000);

  // Get current session to merge data
  const current = await prisma.whatsAppSession.findUnique({
    where: { phone },
  });

  const currentData = (current?.sessionData as SessionData) || {};
  const mergedData = { ...currentData, ...data };

  const session = await prisma.whatsAppSession.update({
    where: { phone },
    data: {
      state,
      sessionData: mergedData,
      currentContentId: data?.contentId || current?.currentContentId,
      lastMessageAt: now,
      expiresAt,
    },
  });

  return {
    id: session.id,
    phone: session.phone,
    name: session.name,
    state: session.state,
    data: session.sessionData as SessionData,
    currentContentId: session.currentContentId,
    expiresAt: session.expiresAt,
  };
}

/**
 * Set session content ID
 */
export async function setSessionContent(
  phone: string,
  contentId: string
): Promise<void> {
  await prisma.whatsAppSession.update({
    where: { phone },
    data: {
      currentContentId: contentId,
      sessionData: {
        ...((await prisma.whatsAppSession.findUnique({ where: { phone } }))
          ?.sessionData as SessionData),
        contentId,
      },
    },
  });
}

/**
 * Set selected billboards in session
 */
export async function setSelectedBillboards(
  phone: string,
  billboardIds: string[]
): Promise<void> {
  const current = await prisma.whatsAppSession.findUnique({
    where: { phone },
  });

  const currentData = (current?.sessionData as SessionData) || {};

  await prisma.whatsAppSession.update({
    where: { phone },
    data: {
      sessionData: {
        ...currentData,
        selectedBillboardIds: billboardIds,
      },
    },
  });
}

/**
 * Set payment ID in session
 */
export async function setPaymentId(
  phone: string,
  paymentId: string
): Promise<void> {
  const current = await prisma.whatsAppSession.findUnique({
    where: { phone },
  });

  const currentData = (current?.sessionData as SessionData) || {};

  await prisma.whatsAppSession.update({
    where: { phone },
    data: {
      sessionData: {
        ...currentData,
        paymentId,
      },
    },
  });
}

/**
 * Reset session to start state
 */
export async function resetSession(phone: string): Promise<Session> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000);

  const session = await prisma.whatsAppSession.update({
    where: { phone },
    data: {
      state: 'START',
      sessionData: {},
      currentContentId: null,
      lastMessageAt: now,
      expiresAt,
    },
  });

  return {
    id: session.id,
    phone: session.phone,
    name: session.name,
    state: session.state,
    data: {},
    currentContentId: null,
    expiresAt: session.expiresAt,
  };
}

/**
 * Mark session as expired
 */
export async function expireSession(phone: string): Promise<void> {
  await prisma.whatsAppSession.update({
    where: { phone },
    data: {
      state: 'EXPIRED',
    },
  });
}

/**
 * Get session by phone
 */
export async function getSession(phone: string): Promise<Session | null> {
  const session = await prisma.whatsAppSession.findUnique({
    where: { phone },
  });

  if (!session) return null;

  return {
    id: session.id,
    phone: session.phone,
    name: session.name,
    state: session.state,
    data: session.sessionData as SessionData,
    currentContentId: session.currentContentId,
    expiresAt: session.expiresAt,
  };
}

/**
 * Get session by content ID
 */
export async function getSessionByContentId(contentId: string): Promise<Session | null> {
  const session = await prisma.whatsAppSession.findFirst({
    where: {
      currentContentId: contentId,
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    phone: session.phone,
    name: session.name,
    state: session.state,
    data: session.sessionData as SessionData,
    currentContentId: session.currentContentId,
    expiresAt: session.expiresAt,
  };
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();

  const result = await prisma.whatsAppSession.updateMany({
    where: {
      expiresAt: { lt: now },
      state: { not: 'EXPIRED' },
    },
    data: {
      state: 'EXPIRED',
    },
  });

  return result.count;
}

/**
 * Delete old expired sessions (older than 7 days)
 */
export async function deleteOldSessions(daysOld: number = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = await prisma.whatsAppSession.deleteMany({
    where: {
      state: 'EXPIRED',
      expiresAt: { lt: cutoff },
    },
  });

  return result.count;
}

/**
 * Check if state transition is valid
 */
export function isValidTransition(
  currentState: WhatsAppSessionState,
  newState: WhatsAppSessionState
): boolean {
  const validTransitions: Record<WhatsAppSessionState, WhatsAppSessionState[]> = {
    START: ['AWAITING_MEDIA', 'START'],
    AWAITING_MEDIA: ['AWAITING_BILLBOARD', 'START', 'EXPIRED'],
    AWAITING_BILLBOARD: ['AWAITING_PAYMENT', 'AWAITING_MEDIA', 'START', 'EXPIRED'],
    AWAITING_PAYMENT: ['CONFIRMED', 'AWAITING_BILLBOARD', 'START', 'EXPIRED'],
    CONFIRMED: ['START'], // Can start a new order
    EXPIRED: ['START'], // Can restart
  };

  return validTransitions[currentState]?.includes(newState) || false;
}

/**
 * Get human-readable state description (French)
 */
export function getStateDescription(state: WhatsAppSessionState): string {
  const descriptions: Record<WhatsAppSessionState, string> = {
    START: 'Démarrage',
    AWAITING_MEDIA: "En attente d'image/vidéo",
    AWAITING_BILLBOARD: 'Sélection des panneaux',
    AWAITING_PAYMENT: 'En attente de paiement',
    CONFIRMED: 'Commande confirmée',
    EXPIRED: 'Session expirée',
  };

  return descriptions[state] || state;
}
