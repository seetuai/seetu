'use client';

import { useState, useEffect } from 'react';
import {
  Upload,
  Sparkles,
  Loader2,
  Package,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BatchUpload } from '@/components/batch/batch-upload';
import { BatchProgress } from '@/components/batch/batch-progress';
import { PresetSelector } from '@/components/batch/preset-selector';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Step = 'upload' | 'preset' | 'configure' | 'processing' | 'complete';
type Presentation = 'product_only' | 'on_model' | 'ghost';
type SceneType = 'studio' | 'real_place' | 'ai_generated' | 'solid_color';

interface UploadedFile {
  url: string;
  name: string;
}

interface BatchPreset {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  category: string;
  icon: string;
}

export default function BatchPage() {
  const [step, setStep] = useState<Step>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [isCreatingProducts, setIsCreatingProducts] = useState(false);
  const [isStartingBatch, setIsStartingBatch] = useState(false);

  // Presets
  const [presets, setPresets] = useState<Record<string, BatchPreset[]>>({});
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Custom style settings (when no preset selected)
  const [presentation, setPresentation] = useState<Presentation>('product_only');
  const [sceneType, setSceneType] = useState<SceneType>('studio');
  const [solidColor, setSolidColor] = useState('#FFFFFF');

  // Load presets on mount
  useEffect(() => {
    fetch('/api/v1/batch/presets')
      .then((res) => res.json())
      .then((data) => {
        if (data.grouped) {
          setPresets(data.grouped);
        }
      })
      .catch(console.error);
  }, []);

  const handleFilesUploaded = (files: UploadedFile[]) => {
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleCreateProducts = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Veuillez uploader des images');
      return;
    }

    setIsCreatingProducts(true);

    try {
      // Create products individually (the batch endpoint may not exist)
      const createdIds: string[] = [];

      for (const file of uploadedFiles) {
        try {
          const res = await fetch('/api/v1/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name.replace(/\.[^.]+$/, ''),
              originalUrl: file.url,
              thumbnailUrl: file.url,
            }),
          });

          const data = await res.json();
          if (res.ok && data.id) {
            createdIds.push(data.id);
          }
        } catch (err) {
          console.error('Failed to create product:', err);
        }
      }

      if (createdIds.length === 0) {
        throw new Error('Aucun produit cree');
      }

      setProductIds(createdIds);
      setStep('preset');
      toast.success(`${createdIds.length} produits crees`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de creation');
    } finally {
      setIsCreatingProducts(false);
    }
  };

  const handleStartBatch = async () => {
    if (productIds.length === 0) {
      toast.error('Aucun produit a generer');
      return;
    }

    setIsStartingBatch(true);

    try {
      const body: {
        productIds: string[];
        presetId?: string;
        styleSettings?: {
          presentation: Presentation;
          sceneType: SceneType;
          solidColor?: string;
        };
      } = {
        productIds,
      };

      if (selectedPresetId) {
        body.presetId = selectedPresetId;
      } else {
        body.styleSettings = {
          presentation,
          sceneType,
          solidColor: sceneType === 'solid_color' ? solidColor : undefined,
        };
      }

      const res = await fetch('/api/v1/studio/generate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur de generation');
      }

      setBatchJobId(data.batchJobId);
      setStep('processing');
      toast.success('Generation demarree!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de generation');
    } finally {
      setIsStartingBatch(false);
    }
  };

  const handleBatchComplete = () => {
    setStep('complete');
  };

  const handleReset = () => {
    setStep('upload');
    setUploadedFiles([]);
    setProductIds([]);
    setBatchJobId(null);
    setSelectedPresetId(null);
  };

  const showCustomConfig = !selectedPresetId && step === 'preset';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Generation en lot
        </h1>
        <p className="text-slate-500 mt-1">
          Uploadez plusieurs produits et generez des images avec un style coherent
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 px-4">
        {[
          { key: 'upload', label: 'Upload', icon: Upload },
          { key: 'preset', label: 'Style', icon: Sparkles },
          { key: 'processing', label: 'Generation', icon: Package },
        ].map((s, i) => {
          const StepIcon = s.icon;
          const isActive = step === s.key || (s.key === 'preset' && step === 'configure');
          const isComplete =
            (s.key === 'upload' && ['preset', 'configure', 'processing', 'complete'].includes(step)) ||
            (s.key === 'preset' && ['processing', 'complete'].includes(step)) ||
            (s.key === 'processing' && step === 'complete');

          return (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                    isActive
                      ? 'bg-violet-600 text-white'
                      : isComplete
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                  )}
                >
                  <StepIcon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    'text-xs mt-2 font-medium',
                    isActive
                      ? 'text-violet-600'
                      : isComplete
                      ? 'text-green-600'
                      : 'text-slate-500'
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    'w-20 h-0.5 mx-2',
                    isComplete ? 'bg-green-500' : 'bg-slate-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-6">
            <BatchUpload
              maxFiles={20}
              onFilesUploaded={handleFilesUploaded}
            />

            {uploadedFiles.length > 0 && (
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  {uploadedFiles.length} image(s) prete(s)
                </p>
                <Button
                  onClick={handleCreateProducts}
                  disabled={isCreatingProducts}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {isCreatingProducts ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creation des produits...
                    </>
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Preset Selection Step */}
        {step === 'preset' && (
          <div className="space-y-6">
            <div className="text-center pb-4 border-b border-slate-100">
              <p className="text-lg font-medium text-slate-900">
                {productIds.length} produits prets
              </p>
              <p className="text-sm text-slate-500">
                Choisissez un preset ou configurez manuellement
              </p>
            </div>

            <PresetSelector
              presets={presets}
              selectedPresetId={selectedPresetId}
              onSelect={setSelectedPresetId}
            />

            {/* Custom configuration (when no preset selected) */}
            {showCustomConfig && (
              <div className="space-y-6 pt-6 border-t border-slate-100">
                {/* Presentation */}
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-3 block">
                    Type de presentation
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'product_only', label: 'Produit seul' },
                      { value: 'on_model', label: 'Sur modele' },
                      { value: 'ghost', label: 'Mannequin invisible' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPresentation(opt.value as Presentation)}
                        className={cn(
                          'p-4 rounded-lg border-2 text-center transition-all',
                          presentation === opt.value
                            ? 'border-violet-600 bg-violet-50 text-violet-700'
                            : 'border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <span className="font-medium text-sm">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scene Type */}
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-3 block">
                    Type de scene
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'studio', label: 'Studio' },
                      { value: 'solid_color', label: 'Couleur unie' },
                      { value: 'real_place', label: 'Lieu reel' },
                      { value: 'ai_generated', label: 'Genere par IA' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSceneType(opt.value as SceneType)}
                        className={cn(
                          'p-4 rounded-lg border-2 text-center transition-all',
                          sceneType === opt.value
                            ? 'border-violet-600 bg-violet-50 text-violet-700'
                            : 'border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <span className="font-medium text-sm">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Solid Color Picker */}
                {sceneType === 'solid_color' && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-3 block">
                      Couleur de fond
                    </Label>
                    <div className="flex gap-3">
                      {['#FFFFFF', '#F5F5F5', '#E5E5E5', '#000000'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setSolidColor(color)}
                          className={cn(
                            'w-12 h-12 rounded-lg border-2 transition-all',
                            solidColor === color
                              ? 'border-violet-600 ring-2 ring-violet-200'
                              : 'border-slate-300'
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <input
                        type="color"
                        value={solidColor}
                        onChange={(e) => setSolidColor(e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Credit estimate */}
            <div className="bg-violet-50 rounded-lg p-4 text-center">
              <p className="text-sm text-violet-700">Cout estime</p>
              <p className="text-2xl font-bold text-violet-600">
                {productIds.length} credits
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setStep('upload')}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <Button
                onClick={handleStartBatch}
                disabled={isStartingBatch}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isStartingBatch ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Demarrage...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Lancer la generation
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {(step === 'processing' || step === 'complete') && batchJobId && (
          <div className="space-y-6">
            <BatchProgress
              batchJobId={batchJobId}
              onComplete={handleBatchComplete}
            />

            {step === 'complete' && (
              <div className="text-center pt-4 border-t border-slate-100">
                <Button onClick={handleReset} variant="outline">
                  Nouveau lot
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
