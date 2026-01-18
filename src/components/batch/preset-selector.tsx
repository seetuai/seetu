'use client';

import { useState } from 'react';
import {
  Store,
  ShoppingBag,
  BookOpen,
  Sparkles,
  Moon,
  Star,
  Heart,
  Flag,
  Gift,
  Sun,
  Check,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchPreset {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  category: string;
  icon: string;
}

interface PresetSelectorProps {
  presets: Record<string, BatchPreset[]>;
  selectedPresetId: string | null;
  onSelect: (presetId: string | null) => void;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  store: Store,
  'shopping-bag': ShoppingBag,
  'book-open': BookOpen,
  sparkles: Sparkles,
  moon: Moon,
  star: Star,
  heart: Heart,
  flag: Flag,
  gift: Gift,
  sun: Sun,
};

const CATEGORY_LABELS: Record<string, { en: string; fr: string }> = {
  marketplace: { en: 'Marketplace', fr: 'Marketplace' },
  catalog: { en: 'Catalog', fr: 'Catalogue' },
  campaign: { en: 'Campaign', fr: 'Campagnes' },
  social: { en: 'Social', fr: 'Reseaux Sociaux' },
};

export function PresetSelector({
  presets,
  selectedPresetId,
  onSelect,
}: PresetSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);

  const handlePresetClick = (presetId: string) => {
    if (selectedPresetId === presetId) {
      onSelect(null);
    } else {
      onSelect(presetId);
      setShowCustom(false);
    }
  };

  const handleCustomClick = () => {
    setShowCustom(!showCustom);
    onSelect(null);
  };

  return (
    <div className="space-y-6">
      {/* Custom option */}
      <button
        onClick={handleCustomClick}
        className={cn(
          'w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4',
          showCustom
            ? 'border-violet-600 bg-violet-50'
            : 'border-slate-200 hover:border-slate-300'
        )}
      >
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            showCustom ? 'bg-violet-100' : 'bg-slate-100'
          )}
        >
          <Settings
            className={cn(
              'h-6 w-6',
              showCustom ? 'text-violet-600' : 'text-slate-500'
            )}
          />
        </div>
        <div className="flex-1">
          <p
            className={cn(
              'font-semibold',
              showCustom ? 'text-violet-700' : 'text-slate-900'
            )}
          >
            Configuration Personnalisee
          </p>
          <p className="text-sm text-slate-500">
            Choisissez manuellement le style
          </p>
        </div>
        {showCustom && (
          <div className="w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center">
            <Check className="h-4 w-4 text-white" />
          </div>
        )}
      </button>

      {/* Preset categories */}
      {Object.entries(presets).map(([category, categoryPresets]) => (
        <div key={category}>
          <h3 className="text-sm font-medium text-slate-500 mb-3">
            {CATEGORY_LABELS[category]?.fr || category}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {categoryPresets.map((preset) => {
              const Icon = ICONS[preset.icon] || Sparkles;
              const isSelected = selectedPresetId === preset.id;

              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    isSelected
                      ? 'border-violet-600 bg-violet-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        isSelected ? 'bg-violet-100' : 'bg-slate-100'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5',
                          isSelected ? 'text-violet-600' : 'text-slate-500'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'font-medium text-sm truncate',
                          isSelected ? 'text-violet-700' : 'text-slate-900'
                        )}
                      >
                        {preset.nameFr}
                      </p>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {preset.descriptionFr}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
