/**
 * WATI WhatsApp API Client
 *
 * Client for interacting with the WATI WhatsApp Business API
 * Used for the WhatsApp billboard booking flow
 */

export interface WatiConfig {
  apiUrl: string;
  apiToken: string;
  webhookSecret?: string;
}

export interface SendMessageParams {
  phone: string;
  message: string;
}

export interface SendTemplateParams {
  phone: string;
  templateName: string;
  parameters?: Record<string, string>;
  mediaUrl?: string;
}

export interface SendMediaParams {
  phone: string;
  mediaUrl: string;
  caption?: string;
  mediaType: 'image' | 'video' | 'document';
}

export interface SendButtonParams {
  phone: string;
  body: string;
  buttons: Array<{
    type: 'reply';
    reply: {
      id: string;
      title: string;
    };
  }>;
}

export interface SendListParams {
  phone: string;
  body: string;
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

export interface SendCTAButtonParams {
  phone: string;
  body: string;
  footer?: string;
  buttonText: string;
  url: string;
}

export interface WatiContact {
  phone: string;
  name: string;
  firstName?: string;
  lastName?: string;
  profilePic?: string;
}

export interface WatiMessage {
  id: string;
  phone: string;
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'button_reply' | 'list_reply';
  text?: string;
  mediaUrl?: string;
  buttonId?: string;
  buttonText?: string;
  listId?: string;
  listTitle?: string;
  timestamp: Date;
}

export class WatiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'WatiError';
    this.status = status;
    this.details = details;
  }
}

class WatiClient {
  private config: WatiConfig;

  constructor(config?: Partial<WatiConfig>) {
    this.config = {
      apiUrl: config?.apiUrl || process.env.WATI_API_URL || '',
      apiToken: config?.apiToken || process.env.WATI_API_TOKEN || '',
      webhookSecret: config?.webhookSecret || process.env.WATI_WEBHOOK_SECRET,
    };

    if (!this.config.apiUrl || !this.config.apiToken) {
      console.warn('[WATI] API URL or token not configured');
    }
  }

  /**
   * Make authenticated request to WATI API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new WatiError(
        error.message || `WATI API error: ${response.status}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Send a text message
   */
  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; messageId?: string }> {
    try {
      // WATI API uses form-data format for sendSessionMessage
      const formData = new URLSearchParams();
      formData.append('messageText', params.message);

      const url = `${this.config.apiUrl}/api/v1/sendSessionMessage/${params.phone}`;
      console.log('[WATI] Sending message to:', params.phone);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${this.config.apiToken}`,
        },
        body: formData.toString(),
      });

      const result = await response.json();
      console.log('[WATI] Send message response:', response.status, result);

      if (!response.ok) {
        throw new WatiError(
          result.message || `WATI API error: ${response.status}`,
          response.status,
          result
        );
      }

      return { success: result.result !== false, messageId: result.info };
    } catch (error) {
      console.error('[WATI] Send message error:', error);
      return { success: false };
    }
  }

  /**
   * Send a template message (for first contact or marketing)
   */
  async sendTemplate(params: SendTemplateParams): Promise<{ success: boolean; messageId?: string }> {
    try {
      const body: Record<string, unknown> = {
        template_name: params.templateName,
        broadcast_name: `billboard-${Date.now()}`,
      };

      // Add parameters if provided
      if (params.parameters) {
        body.parameters = Object.entries(params.parameters).map(([name, value]) => ({
          name,
          value,
        }));
      }

      // Add media if provided
      if (params.mediaUrl) {
        body.media = {
          url: params.mediaUrl,
        };
      }

      // WATI API requires phone number in URL path
      const result = await this.request<{ result: boolean; info?: string }>(`/api/v1/sendTemplateMessage/${params.phone}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return { success: result.result, messageId: result.info };
    } catch (error) {
      console.error('[WATI] Send template error:', error);
      return { success: false };
    }
  }

  /**
   * Send media (image, video, document)
   */
  async sendMedia(params: SendMediaParams): Promise<{ success: boolean; messageId?: string }> {
    try {
      // WATI uses sendSessionFile for all media types with phone in URL
      const result = await this.request<{ result: boolean; info?: string }>(`/api/v1/sendSessionFile/${params.phone}`, {
        method: 'POST',
        body: JSON.stringify({
          url: params.mediaUrl,
          caption: params.caption,
        }),
      });

      return { success: result.result, messageId: result.info };
    } catch (error) {
      console.error('[WATI] Send media error:', error);
      return { success: false };
    }
  }

  /**
   * Send interactive button message
   */
  async sendButtons(params: SendButtonParams): Promise<{ success: boolean; messageId?: string }> {
    try {
      console.log('[WATI] Sending buttons to:', params.phone);

      // WATI API uses query parameter for phone number
      const url = `${this.config.apiUrl}/api/v1/sendInteractiveButtonsMessage?whatsappNumber=${params.phone}`;
      const body = {
        body: params.body,
        buttons: params.buttons.map(b => ({
          text: b.reply.title,
        })),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiToken}`,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log('[WATI] Buttons response:', response.status, responseText);

      const result = responseText ? JSON.parse(responseText) : {};

      if (!response.ok || result.result === false) {
        throw new Error(result.message || 'Buttons message failed');
      }

      return { success: true, messageId: result.info };
    } catch (error) {
      console.error('[WATI] Send buttons error:', error);
      return { success: false };
    }
  }

  /**
   * Send interactive list message
   */
  async sendList(params: SendListParams): Promise<{ success: boolean; messageId?: string }> {
    try {
      console.log('[WATI] Sending list to:', params.phone, 'sections:', JSON.stringify(params.sections));

      // WATI API uses query parameter for phone number
      const url = `${this.config.apiUrl}/api/v1/sendInteractiveListMessage?whatsappNumber=${params.phone}`;

      // WATI format: rows only have title and description (no id field in the API)
      const body = {
        header: '',
        body: params.body,
        footer: '',
        buttonText: params.buttonText,
        sections: params.sections.map(section => ({
          title: section.title,
          rows: section.rows.map(row => ({
            title: row.title.substring(0, 24), // Max 24 chars
            description: row.description?.substring(0, 72) || '', // Max 72 chars
          })),
        })),
      };

      console.log('[WATI] List request body:', JSON.stringify(body));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiToken}`,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log('[WATI] List response:', response.status, responseText);

      const result = responseText ? JSON.parse(responseText) : {};

      if (!response.ok || result.result === false) {
        throw new Error(result.message || result.info || 'List message failed');
      }

      return { success: true, messageId: result.info };
    } catch (error) {
      console.error('[WATI] Send list error:', error);
      // Fallback to text message with numbered options
      let fallbackMsg = params.body + '\n\n';
      params.sections.forEach(section => {
        section.rows.forEach((row, i) => {
          fallbackMsg += `${i + 1}. ${row.title}\n`;
        });
      });
      fallbackMsg += '\nRépondez avec le numéro de votre choix.';
      return this.sendMessage({ phone: params.phone, message: fallbackMsg });
    }
  }

  /**
   * Send CTA URL button message (for payment links etc)
   * Note: CTA URL buttons require WhatsApp Business API and may need pre-approved templates
   */
  async sendCTAButton(params: SendCTAButtonParams): Promise<{ success: boolean; messageId?: string }> {
    try {
      console.log('[WATI] Sending CTA button to:', params.phone);

      // WATI API uses query parameter for phone number
      const url = `${this.config.apiUrl}/api/v1/sendInteractiveCTAButtonMessage?whatsappNumber=${params.phone}`;
      const body = {
        header: '',
        body: params.body,
        footer: params.footer || '',
        buttons: [
          {
            type: 'url',
            text: params.buttonText.substring(0, 25), // Max 25 chars
            url: params.url,
          },
        ],
      };

      console.log('[WATI] CTA button request body:', JSON.stringify(body));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiToken}`,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log('[WATI] CTA button response:', response.status, responseText);

      const result = responseText ? JSON.parse(responseText) : {};

      if (!response.ok || result.result === false) {
        throw new Error(result.message || result.info || 'CTA button failed');
      }

      return { success: true, messageId: result.info };
    } catch (error) {
      console.error('[WATI] Send CTA button error:', error);
      // Fallback to plain text with link
      return this.sendMessage({
        phone: params.phone,
        message: `${params.body}\n\n💳 Payer: ${params.url}`,
      });
    }
  }

  /**
   * Get contact info
   * Note: WATI /api/v1/getContacts is for listing all contacts, not by phone
   * Contact info is optional - we proceed without it if unavailable
   */
  async getContact(phone: string): Promise<WatiContact | null> {
    // WATI doesn't have a direct "get contact by phone" endpoint
    // The contact info is nice-to-have but not required for the flow
    // Return null to proceed without contact details
    return null;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      console.warn('[WATI] Webhook secret not configured');
      return true; // Allow in development
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Parse incoming webhook message
   */
  parseWebhookMessage(body: Record<string, unknown>): WatiMessage | null {
    try {
      // Log full payload for debugging media messages
      const msgType = body.type || body.messageType;
      if (msgType === 'image' || msgType === 'video' || body.media) {
        console.log('[WATI] Media webhook payload:', JSON.stringify(body, null, 2));
      }

      // WATI webhook format parsing - extract phone from various possible locations
      const phone = body.waId as string ||
                    body.phone as string ||
                    body.whatsappNumber as string ||
                    (body.contact as Record<string, string>)?.wa_id ||
                    '';

      const message: WatiMessage = {
        id: body.id as string || body.messageId as string || '',
        phone,
        type: 'text',
        timestamp: new Date(body.timestamp as string || body.created as string || Date.now()),
      };

      // Determine message type and content
      // WATI uses different structures depending on webhook version
      const messageType = body.type || body.messageType;

      if (messageType === 'text' || body.text) {
        message.type = 'text';
        const textObj = body.text as Record<string, string> | string;
        message.text = typeof textObj === 'string' ? textObj : textObj?.body || '';
      } else if (messageType === 'image' || body.image) {
        message.type = 'image';
        // WATI puts the image URL directly in body.data as a string
        // Format: "https://live-mt-server.wati.io/384776/api/file/showFile?fileName=..."
        if (typeof body.data === 'string' && body.data.includes('showFile')) {
          message.mediaUrl = body.data;
        } else {
          const media = (body.image || body.media) as Record<string, string>;
          message.mediaUrl = media?.url || media?.link || media?.data || body.mediaUrl as string;
        }
        console.log('[WATI] Extracted image URL:', message.mediaUrl);
      } else if (messageType === 'video' || body.video) {
        message.type = 'video';
        // WATI puts the video URL directly in body.data as a string
        if (typeof body.data === 'string' && body.data.includes('showFile')) {
          message.mediaUrl = body.data;
        } else {
          const media = (body.video || body.media) as Record<string, string>;
          message.mediaUrl = media?.url || media?.link || media?.data || body.mediaUrl as string;
        }
        console.log('[WATI] Extracted video URL:', message.mediaUrl);
      } else if (messageType === 'document' || body.document) {
        message.type = 'document';
        // WATI puts the document URL directly in body.data as a string
        if (typeof body.data === 'string' && body.data.includes('showFile')) {
          message.mediaUrl = body.data;
        } else {
          const media = (body.document || body.media) as Record<string, string>;
          message.mediaUrl = media?.url || media?.link || media?.data || body.mediaUrl as string;
        }
      } else if (messageType === 'button' || body.button) {
        message.type = 'button_reply';
        const button = body.button as Record<string, string>;
        message.buttonId = button?.payload || button?.id;
        message.buttonText = button?.text;
      } else if (messageType === 'list_reply' || messageType === 'interactive' || body.list_reply || body.listReply || body.interactive) {
        message.type = 'list_reply';
        // WATI can send list replies in various formats
        const list = (body.listReply || body.list_reply || body.interactive) as Record<string, unknown>;
        const nestedList = (list?.list_reply || list?.listReply) as Record<string, string> | undefined;

        // Try various paths to get the selected item's id and title
        message.listId =
          body.selectedId as string ||
          body.selectedRowId as string ||
          list?.id as string ||
          list?.selectedId as string ||
          nestedList?.id ||
          nestedList?.selectedId;
        message.listTitle =
          body.selectedTitle as string ||
          body.title as string ||
          list?.title as string ||
          list?.selectedTitle as string ||
          nestedList?.title ||
          nestedList?.selectedTitle;

        console.log('[WATI] Parsed list reply:', { listId: message.listId, listTitle: message.listTitle, rawList: list });
      }

      return message;
    } catch (error) {
      console.error('[WATI] Parse webhook error:', error);
      return null;
    }
  }

  /**
   * Check if WATI is configured
   */
  isConfigured(): boolean {
    return !!(this.config.apiUrl && this.config.apiToken);
  }
}

// Singleton instance
let watiInstance: WatiClient | null = null;

export function getWatiClient(): WatiClient {
  if (!watiInstance) {
    watiInstance = new WatiClient();
  }
  return watiInstance;
}

export { WatiClient };
export default getWatiClient;
