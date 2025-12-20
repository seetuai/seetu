import { GoogleGenerativeAI } from '@google/generative-ai';
import type { BrandDNA, SocialSource, LightingStyle, FramingStyle, TextureBias, HumanPresence, VoiceTone, LanguageStyle, VerbalDNA, CaptionStructure, AddressStyle, PrimaryLanguage } from '@/types';

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY;

function getGenAI() {
  if (!GEMINI_API_KEY) return null;
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return {
      data: base64,
      mimeType: contentType,
    };
  } catch (error) {
    console.error('Error fetching image:', url, error);
    return null;
  }
}

/**
 * Analyze Verbal DNA from captions
 */
async function analyzeVerbalDNA(captions: string[], model: any): Promise<VerbalDNA | null> {
  const cleanCaptions = captions
    .filter(c => c && c.trim().length > 0)
    .slice(0, 12);

  if (cleanCaptions.length < 3) {
    return null;
  }

  const captionsCorpus = cleanCaptions.join('\n\n---\n\n');

  const prompt = `You are a Linguistic Analyst specializing in Social Media for the African market.
Analyze these ${cleanCaptions.length} Instagram captions from a brand.

YOUR TASK: Extract their "Verbal DNA" - the exact patterns that make their writing unique.

CAPTIONS TO ANALYZE:
${captionsCorpus}

Return a JSON object with this EXACT structure:

{
  "primary_language": "VALUE",
  "tone": "Descriptive tone",
  "tone_adjectives": ["adjective1", "adjective2", "adjective3"],
  "address_style": "VALUE",
  "language_mix": "Detailed description of language mixing patterns",
  "wolof_expressions": ["expression1", "expression2"],
  "emoji_palette": ["emoji1", "emoji2", "emoji3", "emoji4", "emoji5"],
  "emoji_frequency": "VALUE",
  "caption_structure": "VALUE",
  "typical_length": "VALUE",
  "formatting_quirks": "Description of formatting habits",
  "uses_hashtags_in_caption": true/false,
  "signature_hashtags": ["hashtag1", "hashtag2"],
  "signature_phrases": ["phrase1", "phrase2"],
  "cta_style": "Description of how they sell",
  "exemplars": ["best_caption_1", "best_caption_2", "best_caption_3"]
}

CRITICAL VALUES:
primary_language: "english" | "french" | "french_wolof_mix" | "wolof_dominant" | "arabic_mix"
address_style: "tutoiement" | "vouvoiement" | "mixed"
emoji_frequency: "heavy" | "moderate" | "minimal" | "none"
caption_structure: "storytelling" | "bullet_points" | "short_punchline" | "question_hook" | "quote_based"
typical_length: "short" | "medium" | "long"

Return ONLY valid JSON, no markdown or explanation.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in verbal DNA response:', responseText);
    return null;
  }

  const verbalResult = JSON.parse(jsonMatch[0]);

  return {
    tone: verbalResult.tone || 'Professional',
    tone_adjectives: verbalResult.tone_adjectives || ['Professional'],
    address_style: (verbalResult.address_style || 'mixed') as AddressStyle,
    primary_language: (verbalResult.primary_language || 'french') as PrimaryLanguage,
    language_mix: verbalResult.language_mix || 'Standard French',
    wolof_expressions: verbalResult.wolof_expressions || [],
    emoji_palette: verbalResult.emoji_palette || [],
    emoji_frequency: verbalResult.emoji_frequency || 'moderate',
    caption_structure: (verbalResult.caption_structure || 'short_punchline') as CaptionStructure,
    typical_length: verbalResult.typical_length || 'short',
    formatting_quirks: verbalResult.formatting_quirks || 'Standard formatting',
    uses_hashtags_in_caption: verbalResult.uses_hashtags_in_caption ?? true,
    signature_hashtags: verbalResult.signature_hashtags || [],
    signature_phrases: verbalResult.signature_phrases || [],
    cta_style: verbalResult.cta_style || 'Soft - Link in bio',
    exemplars: verbalResult.exemplars || cleanCaptions.slice(0, 3),
    example_captions: cleanCaptions,
  };
}

/**
 * Generate a French summary
 */
async function generateFrenchSummary(brandDNA: BrandDNA, model: any): Promise<string | null> {
  const prompt = `Tu es un directeur artistique qui vient d'analyser l'identité visuelle d'une marque sénégalaise.

Voici les résultats de ton analyse:
- Couleurs: ${brandDNA.palette.primaryName || 'dominante'}, ${brandDNA.palette.secondaryName || 'secondaire'}, ${brandDNA.palette.accentName || 'accent'}
- Style visuel: ${brandDNA.visual_tokens.join(', ')}
- Éclairage préféré: ${brandDNA.photography_settings.lighting}
- Composition: ${brandDNA.photography_settings.framing}
- Résumé du vibe: ${brandDNA.vibe_summary}
${brandDNA.verbal_dna ? `- Ton de communication: ${brandDNA.verbal_dna.tone}` : ''}

Écris un paragraphe chaleureux en français (3-4 phrases) qui résume cette identité de marque.
Commence par "Votre marque..." ou "J'ai analysé votre univers..." et termine par quelque chose d'encourageant.

Retourne UNIQUEMENT le paragraphe, pas de guillemets ni de formatage.`;

  const result = await model.generateContent(prompt);
  const summary = result.response.text().trim();

  return summary.replace(/^["']|["']$/g, '');
}

export interface AnalyzeBrandParams {
  imageUrls: string[];
  captions?: string[];
  source: SocialSource;
  socialHandle?: string;
}

export interface AnalyzeBrandResult {
  success: boolean;
  brandDNA?: BrandDNA;
  error?: string;
}

/**
 * Analyze brand from images and captions
 */
export async function analyzeBrand(params: AnalyzeBrandParams): Promise<AnalyzeBrandResult> {
  const { imageUrls, captions, source, socialHandle } = params;

  const genAI = getGenAI();
  if (!genAI) {
    return { success: false, error: 'Service d\'analyse non configuré (GOOGLE_AI_API_KEY manquant)' };
  }

  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length < 3) {
    return { success: false, error: 'Au moins 3 images sont nécessaires pour une analyse précise' };
  }

  // Fetch up to 12 images and convert to base64
  const imagesToAnalyze = imageUrls.slice(0, 12);
  const imagePromises = imagesToAnalyze.map(url => fetchImageAsBase64(url));
  const images = (await Promise.all(imagePromises)).filter(Boolean);

  if (images.length < 3) {
    return { success: false, error: 'Impossible de charger suffisamment d\'images' };
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
  });

  const prompt = `Tu es un expert en branding et direction artistique pour une plateforme de génération d'images IA.

Analyse ces ${images.length} images du feed social d'une marque africaine/sénégalaise.
Tu dois extraire le "Brand DNA" - les tokens et paramètres techniques qui permettront de répliquer le style visuel de cette marque.

Retourne un objet JSON avec cette structure EXACTE:

{
  "palette": {
    "primary": "#HEXCODE",
    "secondary": "#HEXCODE",
    "accent": "#HEXCODE",
    "primaryName": "nom de la couleur en français",
    "secondaryName": "nom de la couleur en français",
    "accentName": "nom de la couleur en français"
  },
  "visual_tokens": ["token1", "token2", "token3", "token4", "token5"],
  "photography_settings": {
    "lighting": "VALEUR",
    "framing": "VALEUR",
    "texture_bias": "VALEUR",
    "human_presence": "VALEUR",
    "demographic": "description démographique si humains présents"
  },
  "voice_profile": {
    "tone": "VALEUR",
    "language_style": "VALEUR"
  },
  "vibe_summary": "description courte du style global en français"
}

VALEURS POSSIBLES:
lighting: "studio_soft" | "studio_hard" | "natural_sunlight" | "golden_hour" | "neon_night" | "overcast_diffused"
framing: "minimalist_centered" | "flat_lay" | "low_angle_lifestyle" | "close_up_detail" | "chaotic_lifestyle" | "editorial_fashion"
texture_bias: "clean_matte" | "glossy_polished" | "gritty_film" | "organic_natural" | "high_contrast"
human_presence: "product_only" | "hands_only" | "partial_body" | "full_body" | "face_included"
tone: "professional" | "playful" | "inspiring" | "luxurious" | "friendly"
language_style: "fr_sn_urban" | "fr_sn_wolof_mix" | "fr_classic" | "en_casual" | "en_professional"

Retourne UNIQUEMENT du JSON valide, pas de markdown ni d'explication.`;

  const contentParts: Array<{ inlineData: { mimeType: string; data: string } } | string> = [];

  for (const img of images) {
    if (img) {
      contentParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data,
        },
      });
    }
  }

  contentParts.push(prompt);

  const result = await model.generateContent(contentParts);
  const response = result.response;
  const text = response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in brand analysis response:', text);
    return { success: false, error: 'Analyse échouée - réponse invalide' };
  }

  const analysisResult = JSON.parse(jsonMatch[0]);

  const brandDNA: BrandDNA = {
    source: source || 'photos',
    socialHandle: socialHandle,
    sourceImageUrls: imagesToAnalyze,
    analyzedAt: new Date().toISOString(),
    palette: {
      primary: analysisResult.palette?.primary || '#000000',
      secondary: analysisResult.palette?.secondary || '#FFFFFF',
      accent: analysisResult.palette?.accent || '#FF0000',
      primaryName: analysisResult.palette?.primaryName,
      secondaryName: analysisResult.palette?.secondaryName,
      accentName: analysisResult.palette?.accentName,
    },
    visual_tokens: analysisResult.visual_tokens || [],
    photography_settings: {
      lighting: (analysisResult.photography_settings?.lighting || 'natural_sunlight') as LightingStyle,
      framing: (analysisResult.photography_settings?.framing || 'minimalist_centered') as FramingStyle,
      texture_bias: (analysisResult.photography_settings?.texture_bias || 'clean_matte') as TextureBias,
      human_presence: (analysisResult.photography_settings?.human_presence || 'product_only') as HumanPresence,
      demographic: analysisResult.photography_settings?.demographic,
    },
    voice_profile: {
      tone: (analysisResult.voice_profile?.tone || 'professional') as VoiceTone,
      language_style: (analysisResult.voice_profile?.language_style || 'fr_classic') as LanguageStyle,
    },
    vibe_summary: analysisResult.vibe_summary || 'Style moderne africain',
  };

  // Analyze Verbal DNA if captions are provided
  if (captions && captions.length >= 3) {
    try {
      const verbalDNA = await analyzeVerbalDNA(captions, model);
      if (verbalDNA) {
        brandDNA.verbal_dna = verbalDNA;
      }
    } catch (error) {
      console.error('Verbal DNA analysis error:', error);
    }
  }

  // Generate French summary
  try {
    const summary = await generateFrenchSummary(brandDNA, model);
    if (summary) {
      brandDNA.analysis_summary_fr = summary;
    }
  } catch (error) {
    console.error('Summary generation error:', error);
  }

  return { success: true, brandDNA };
}
