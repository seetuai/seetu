/**
 * Billboard Content Moderation
 *
 * Uses Google's Gemini Vision API to analyze content for:
 * - Nudity/adult content
 * - Violence/gore
 * - Hate speech/symbols
 * - Political content
 * - Inappropriate text
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Moderation categories and their severity levels
export type ModerationCategory =
  | 'nudity'
  | 'violence'
  | 'hate_speech'
  | 'political'
  | 'explicit_text'
  | 'drugs_alcohol'
  | 'gambling'
  | 'copyright';

export interface CategoryResult {
  category: ModerationCategory;
  detected: boolean;
  confidence: number; // 0-1
  description?: string;
}

export interface ModerationResult {
  approved: boolean;
  categories: CategoryResult[];
  overallRisk: 'low' | 'medium' | 'high';
  rejectionReason?: string;
  reviewRequired: boolean;
  rawAnalysis?: string;
}

// Threshold for auto-rejection
const AUTO_REJECT_THRESHOLD = 0.8;
// Threshold for manual review
const REVIEW_THRESHOLD = 0.5;

/**
 * Initialize Gemini client
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured (GEMINI_API_KEY or GOOGLE_AI_API_KEY)');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Download image and convert to base64
 */
async function imageUrlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  return {
    data: base64,
    mimeType: contentType,
  };
}

/**
 * Parse Gemini's response into structured moderation result
 */
function parseAnalysis(analysisText: string): {
  categories: CategoryResult[];
  overallRisk: 'low' | 'medium' | 'high';
} {
  const categories: CategoryResult[] = [];
  let overallRisk: 'low' | 'medium' | 'high' = 'low';

  // Default categories to check
  const categoryChecks: ModerationCategory[] = [
    'nudity',
    'violence',
    'hate_speech',
    'political',
    'explicit_text',
    'drugs_alcohol',
    'gambling',
    'copyright',
  ];

  const lowerAnalysis = analysisText.toLowerCase();

  for (const category of categoryChecks) {
    // Look for confidence scores in format "category: 0.X" or mentions
    const categoryRegex = new RegExp(`${category.replace('_', '[_\\s]?')}[:\\s]*(\\d+\\.?\\d*|high|medium|low|yes|no|detected|not detected)`, 'i');
    const match = analysisText.match(categoryRegex);

    let confidence = 0;
    let detected = false;
    let description: string | undefined;

    if (match) {
      const value = match[1].toLowerCase();
      if (value === 'high' || value === 'yes' || value === 'detected') {
        confidence = 0.9;
        detected = true;
      } else if (value === 'medium') {
        confidence = 0.6;
        detected = true;
      } else if (value === 'low') {
        confidence = 0.3;
      } else if (value === 'no' || value === 'not detected') {
        confidence = 0;
      } else {
        confidence = parseFloat(value);
        detected = confidence > REVIEW_THRESHOLD;
      }
    } else {
      // Simple keyword detection as fallback
      const keywords: Record<ModerationCategory, string[]> = {
        nudity: ['nudity', 'naked', 'explicit', 'nsfw', 'adult content'],
        violence: ['violence', 'gore', 'blood', 'violent', 'weapon'],
        hate_speech: ['hate', 'racist', 'discriminatory', 'offensive symbol'],
        political: ['political', 'election', 'campaign', 'propaganda', 'party'],
        explicit_text: ['profanity', 'vulgar', 'obscene text', 'explicit language'],
        drugs_alcohol: ['drugs', 'alcohol', 'smoking', 'substance'],
        gambling: ['gambling', 'casino', 'betting', 'lottery'],
        copyright: ['copyright', 'trademarked', 'brand logo', 'watermark'],
      };

      for (const keyword of keywords[category]) {
        if (lowerAnalysis.includes(keyword)) {
          confidence = 0.7;
          detected = true;
          description = `Potential ${category.replace('_', ' ')} content detected`;
          break;
        }
      }
    }

    categories.push({
      category,
      detected,
      confidence,
      description,
    });

    // Update overall risk
    if (confidence >= AUTO_REJECT_THRESHOLD) {
      overallRisk = 'high';
    } else if (confidence >= REVIEW_THRESHOLD && overallRisk !== 'high') {
      overallRisk = 'medium';
    }
  }

  return { categories, overallRisk };
}

/**
 * Moderate image content using Gemini Vision
 */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Get image as base64
    const imageData = await imageUrlToBase64(imageUrl);

    // Moderation prompt
    const prompt = `You are a content moderation system for digital billboards in Dakar, Senegal.
Analyze this image for the following content categories and provide a confidence score (0.0-1.0) for each:

1. NUDITY: Any nudity, partial nudity, sexually suggestive content
2. VIOLENCE: Gore, blood, weapons, violent imagery
3. HATE_SPEECH: Racist symbols, hate speech text, discriminatory content
4. POLITICAL: Political party logos, election content, political figures, propaganda
5. EXPLICIT_TEXT: Profanity, vulgar language visible in the image
6. DRUGS_ALCOHOL: Drug paraphernalia, alcohol promotion, smoking
7. GAMBLING: Casino, betting, lottery promotion
8. COPYRIGHT: Visible trademarked logos, copyrighted content (excluding the product itself)

For each category, respond in this exact format:
CATEGORY: confidence_score (0.0-1.0) | detected: yes/no | notes: brief description

Then provide:
OVERALL_RISK: low/medium/high
RECOMMENDATION: approved/rejected/review_required
REJECTION_REASON: (only if rejected or review required)

Be strict but fair - this is for public billboard display in a major African city.
Cultural context: Senegal is a predominantly Muslim country with conservative public standards.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data,
        },
      },
      prompt,
    ]);

    const analysisText = result.response.text();
    const { categories, overallRisk } = parseAnalysis(analysisText);

    // Determine if auto-rejected
    const highRiskCategories = categories.filter(c => c.confidence >= AUTO_REJECT_THRESHOLD);
    const mediumRiskCategories = categories.filter(c => c.confidence >= REVIEW_THRESHOLD && c.confidence < AUTO_REJECT_THRESHOLD);

    let approved = true;
    let reviewRequired = false;
    let rejectionReason: string | undefined;

    if (highRiskCategories.length > 0) {
      approved = false;
      rejectionReason = `Content flagged for: ${highRiskCategories.map(c => c.category.replace('_', ' ')).join(', ')}`;
    } else if (mediumRiskCategories.length > 0) {
      approved = true; // Tentatively approved, but needs review
      reviewRequired = true;
    }

    return {
      approved,
      categories,
      overallRisk,
      rejectionReason,
      reviewRequired,
      rawAnalysis: analysisText,
    };

  } catch (error) {
    console.error('[MODERATION] Error:', error);

    // If moderation fails, flag for manual review
    return {
      approved: false,
      categories: [],
      overallRisk: 'medium',
      rejectionReason: 'Moderation system error - manual review required',
      reviewRequired: true,
      rawAnalysis: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Moderate video content by extracting key frames
 * For now, uses first frame only - can be extended to sample multiple frames
 */
export async function moderateVideo(videoUrl: string, thumbnailUrl?: string): Promise<ModerationResult> {
  // If we have a thumbnail, moderate that
  if (thumbnailUrl) {
    return moderateImage(thumbnailUrl);
  }

  // Otherwise, flag for manual review (video frame extraction would require FFmpeg)
  return {
    approved: false,
    categories: [],
    overallRisk: 'medium',
    rejectionReason: 'Video content requires manual review',
    reviewRequired: true,
  };
}

/**
 * Quick text-based content check for captions/messages
 */
export async function moderateText(text: string): Promise<{
  approved: boolean;
  issues: string[];
}> {
  // Basic profanity and inappropriate content check
  const forbiddenPatterns = [
    /\b(fuck|shit|ass|bitch|damn|hell)\b/i,
    /\b(kill|murder|death|die)\b/i,
    /\b(hate|racist)\b/i,
    /\b(vote|election|campaign|parti\s*politique)\b/i,
  ];

  const issues: string[] = [];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      issues.push(`Potentially inappropriate content detected matching pattern: ${pattern.source}`);
    }
  }

  return {
    approved: issues.length === 0,
    issues,
  };
}

/**
 * Check if moderation service is available
 */
export function isModerationAvailable(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
}
