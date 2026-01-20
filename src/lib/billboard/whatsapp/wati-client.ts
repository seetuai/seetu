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
      // WATI API requires phone number in URL path
      const result = await this.request<{ result: boolean; info?: string }>(`/api/v1/sendSessionMessage/${params.phone}`, {
        method: 'POST',
        body: JSON.stringify({
          messageText: params.message,
        }),
      });

      return { success: result.result, messageId: result.info };
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
      // WATI API requires phone number in URL path
      const result = await this.request<{ result: boolean; info?: string }>(`/api/v1/sendInteractiveButtonsMessage/${params.phone}`, {
        method: 'POST',
        body: JSON.stringify({
          body: params.body,
          buttons: params.buttons,
        }),
      });

      return { success: result.result, messageId: result.info };
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
      // WATI API requires phone number in URL path
      const result = await this.request<{ result: boolean; info?: string }>(`/api/v1/sendInteractiveListMessage/${params.phone}`, {
        method: 'POST',
        body: JSON.stringify({
          body: params.body,
          buttonText: params.buttonText,
          sections: params.sections,
        }),
      });

      return { success: result.result, messageId: result.info };
    } catch (error) {
      console.error('[WATI] Send list error:', error);
      return { success: false };
    }
  }

  /**
   * Get contact info
   */
  async getContact(phone: string): Promise<WatiContact | null> {
    try {
      const result = await this.request<{ result: boolean; contact_info?: WatiContact }>(
        `/api/v1/getContacts/${phone}`
      );
      return result.contact_info || null;
    } catch (error) {
      console.error('[WATI] Get contact error:', error);
      return null;
    }
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
      // WATI webhook format parsing
      const message: WatiMessage = {
        id: body.id as string || '',
        phone: body.waId as string || body.phone as string || '',
        type: 'text',
        timestamp: new Date(body.timestamp as string || Date.now()),
      };

      // Determine message type and content
      if (body.type === 'text' || body.text) {
        message.type = 'text';
        message.text = (body.text as { body?: string })?.body || body.text as string || '';
      } else if (body.type === 'image' || body.image) {
        message.type = 'image';
        const media = body.image as Record<string, string>;
        message.mediaUrl = media?.url || media?.link;
      } else if (body.type === 'video' || body.video) {
        message.type = 'video';
        const media = body.video as Record<string, string>;
        message.mediaUrl = media?.url || media?.link;
      } else if (body.type === 'button' || body.button) {
        message.type = 'button_reply';
        const button = body.button as Record<string, string>;
        message.buttonId = button?.payload || button?.id;
        message.buttonText = button?.text;
      } else if (body.type === 'list_reply' || body.list_reply) {
        message.type = 'list_reply';
        const list = body.list_reply as Record<string, string>;
        message.listId = list?.id;
        message.listTitle = list?.title;
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
