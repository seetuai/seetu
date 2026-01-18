/**
 * Batch Generation Presets
 * Pre-configured style settings for common use cases
 */

import type { BatchStyleSettings } from './batch-processor';

export interface BatchPreset {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  category: 'marketplace' | 'catalog' | 'campaign' | 'social';
  icon: string;
  settings: BatchStyleSettings;
}

export const BATCH_PRESETS: BatchPreset[] = [
  // Marketplace presets
  {
    id: 'marketplace-ready',
    name: 'Marketplace Ready',
    nameFr: 'Marketplace',
    description: 'Clean white background, perfect for online stores',
    descriptionFr: 'Fond blanc, parfait pour les boutiques en ligne',
    category: 'marketplace',
    icon: 'store',
    settings: {
      presentation: 'product_only',
      sceneType: 'solid_color',
      solidColor: '#FFFFFF',
    },
  },
  {
    id: 'ecommerce-gray',
    name: 'E-commerce Gray',
    nameFr: 'E-commerce Gris',
    description: 'Neutral gray background, professional look',
    descriptionFr: 'Fond gris neutre, look professionnel',
    category: 'marketplace',
    icon: 'shopping-bag',
    settings: {
      presentation: 'product_only',
      sceneType: 'solid_color',
      solidColor: '#F5F5F5',
    },
  },

  // Catalog presets
  {
    id: 'catalog-consistent',
    name: 'Catalog Consistency',
    nameFr: 'Catalogue Uniforme',
    description: 'Studio lighting with brand style applied',
    descriptionFr: 'Eclairage studio avec style de marque',
    category: 'catalog',
    icon: 'book-open',
    settings: {
      presentation: 'product_only',
      sceneType: 'studio',
    },
  },
  {
    id: 'lifestyle-studio',
    name: 'Lifestyle Studio',
    nameFr: 'Studio Lifestyle',
    description: 'Modern studio with contextual elements',
    descriptionFr: 'Studio moderne avec elements contextuels',
    category: 'catalog',
    icon: 'sparkles',
    settings: {
      presentation: 'product_only',
      sceneType: 'ai_generated',
    },
  },

  // Campaign presets
  {
    id: 'tabaski-campaign',
    name: 'Tabaski Campaign',
    nameFr: 'Campagne Tabaski',
    description: 'Festive golden tones, celebration vibes',
    descriptionFr: 'Tons dores festifs, ambiance celebration',
    category: 'campaign',
    icon: 'moon',
    settings: {
      presentation: 'product_only',
      sceneType: 'ai_generated',
    },
  },
  {
    id: 'ramadan-campaign',
    name: 'Ramadan Campaign',
    nameFr: 'Campagne Ramadan',
    description: 'Elegant night tones, spiritual ambiance',
    descriptionFr: 'Tons nuit elegants, ambiance spirituelle',
    category: 'campaign',
    icon: 'star',
    settings: {
      presentation: 'product_only',
      sceneType: 'ai_generated',
    },
  },
  {
    id: 'magal-campaign',
    name: 'Magal Campaign',
    nameFr: 'Campagne Magal',
    description: 'Traditional Mouride colors and motifs',
    descriptionFr: 'Couleurs et motifs Mourides traditionnels',
    category: 'campaign',
    icon: 'heart',
    settings: {
      presentation: 'product_only',
      sceneType: 'ai_generated',
    },
  },
  {
    id: 'independence-day',
    name: 'Independence Day',
    nameFr: 'Fete Independance',
    description: 'Senegalese green, yellow, red patriotic theme',
    descriptionFr: 'Theme patriotique vert, jaune, rouge',
    category: 'campaign',
    icon: 'flag',
    settings: {
      presentation: 'product_only',
      sceneType: 'ai_generated',
    },
  },

  // Social presets
  {
    id: 'christmas-campaign',
    name: 'Christmas/New Year',
    nameFr: 'Noel/Nouvel An',
    description: 'Festive red and gold, holiday spirit',
    descriptionFr: 'Rouge et or festif, esprit de fete',
    category: 'social',
    icon: 'gift',
    settings: {
      presentation: 'product_only',
      sceneType: 'ai_generated',
    },
  },
  {
    id: 'summer-vibes',
    name: 'Summer Vibes',
    nameFr: 'Ambiance Ete',
    description: 'Bright, sunny outdoor feel',
    descriptionFr: 'Ambiance exterieure lumineuse et ensoleillee',
    category: 'social',
    icon: 'sun',
    settings: {
      presentation: 'product_only',
      sceneType: 'ai_generated',
    },
  },
];

/**
 * Get preset by ID
 */
export function getPresetById(id: string): BatchPreset | undefined {
  return BATCH_PRESETS.find((p) => p.id === id);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: BatchPreset['category']): BatchPreset[] {
  return BATCH_PRESETS.filter((p) => p.category === category);
}

/**
 * Get all preset categories with their presets
 */
export function getPresetsGrouped(): Record<string, BatchPreset[]> {
  return {
    marketplace: getPresetsByCategory('marketplace'),
    catalog: getPresetsByCategory('catalog'),
    campaign: getPresetsByCategory('campaign'),
    social: getPresetsByCategory('social'),
  };
}

/**
 * Get moodboard note for campaign presets
 */
export function getCampaignMoodboardNote(presetId: string): string | undefined {
  const campaignNotes: Record<string, string> = {
    'tabaski-campaign': 'Tabaski celebration atmosphere, festive golden accents, warm family gathering feeling, traditional elegance with modern touch',
    'ramadan-campaign': 'Ramadan spiritual elegance, night sky tones, crescent moon motifs, peaceful and serene atmosphere, subtle golden lantern lighting',
    'magal-campaign': 'Grand Magal de Touba celebration, traditional Mouride green and white colors, religious devotion, cultural pride, community gathering',
    'independence-day': 'Senegalese Independence Day celebration, patriotic green yellow red, national pride, African unity, modern Senegal',
    'christmas-campaign': 'Christmas and New Year festive spirit, red and gold decorations, holiday warmth, gift giving joy, celebration atmosphere',
    'summer-vibes': 'Bright sunny Senegalese summer, beach vibes, colorful and energetic, outdoor lifestyle, tropical freshness',
  };
  return campaignNotes[presetId];
}
