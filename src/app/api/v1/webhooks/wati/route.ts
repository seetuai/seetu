/**
 * POST /api/v1/webhooks/wati
 *
 * Webhook endpoint for WATI WhatsApp messages
 * Receives incoming messages and routes them to the message handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWatiClient } from '@/lib/billboard/whatsapp/wati-client';
import { handleIncomingMessage } from '@/lib/billboard/whatsapp/message-handler';

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const wati = getWatiClient();
    const signature = request.headers.get('x-wati-signature') ||
                      request.headers.get('x-hub-signature-256');

    if (signature && !wati.verifyWebhookSignature(rawBody, signature)) {
      console.error('[WATI_WEBHOOK] Invalid signature');
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
      console.error('[WATI_WEBHOOK] Invalid JSON');
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // Log incoming webhook for debugging
    console.log('[WATI_WEBHOOK] Received:', JSON.stringify(body, null, 2));

    // Parse message from webhook payload
    const message = wati.parseWebhookMessage(body);

    if (!message) {
      // Not a message event (could be status update, etc.)
      console.log('[WATI_WEBHOOK] Non-message event, ignoring');
      return NextResponse.json({ received: true });
    }

    if (!message.phone) {
      console.error('[WATI_WEBHOOK] No phone number in message');
      return NextResponse.json({ received: true });
    }

    // Handle the message asynchronously (don't block webhook response)
    // In production, this would be queued
    handleIncomingMessage(message)
      .then((result) => {
        if (!result.success) {
          console.error('[WATI_WEBHOOK] Handler error:', result.error);
        }
      })
      .catch((error) => {
        console.error('[WATI_WEBHOOK] Handler exception:', error);
      });

    // Return quickly to acknowledge webhook
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WATI_WEBHOOK] Error:', error);
    // Still return 200 to prevent retries for non-recoverable errors
    return NextResponse.json({ received: true, error: 'Internal error' });
  }
}

// WATI may send GET for webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Handle WhatsApp/Meta webhook verification
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    // Verify token matches our configured secret
    const expectedToken = process.env.WATI_WEBHOOK_SECRET;

    if (token === expectedToken) {
      console.log('[WATI_WEBHOOK] Webhook verified');
      return new NextResponse(challenge || 'OK', { status: 200 });
    }

    console.error('[WATI_WEBHOOK] Verification token mismatch');
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 403 }
    );
  }

  return NextResponse.json({ status: 'WATI webhook endpoint active' });
}
