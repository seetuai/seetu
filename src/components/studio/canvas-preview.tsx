'use client';

import { useState, useEffect } from 'react';
import { useWizardStore } from '@/lib/stores/wizard-store';
import {
  Wand2,
  Info,
  Download,
  Plus,
  ImageIcon,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Pencil,
  Film,
  Library,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VideoGenerationModal } from './video-generation-modal';

export function CanvasPreview() {
  const [feedbackInput, setFeedbackInput] = useState('');
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isSavingAsProduct, setIsSavingAsProduct] = useState(false);

  // Zoom state
  const [zoom, setZoom] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const {
    products,
    activeProductIndex,
    generatedImages,
    activeGeneratedImageIndex,
    isGenerating,
    iterationFeedback,
    setIterationFeedback,
    setGenerating,
    addGeneratedImage,
    getBrief,
    reset,
    useBrandStyle,
  } = useWizardStore();

  const activeProduct = products[activeProductIndex];
  // Use the actively selected image, not just the latest
  const activeGeneratedImage = generatedImages[activeGeneratedImageIndex];
  const isLatestVersion = activeGeneratedImageIndex === generatedImages.length - 1;

  // Reset edited caption and zoom when active image changes
  useEffect(() => {
    if (activeGeneratedImage?.caption) {
      setEditedCaption(activeGeneratedImage.caption);
      setIsEditingCaption(false);
    }
    // Reset zoom when switching images
    setZoom(1);
    setPanPosition({ x: 0, y: 0 });
  }, [activeGeneratedImage?.caption, activeGeneratedImageIndex]);

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.5, 4));
  const handleZoomOut = () => {
    setZoom(z => {
      const newZoom = Math.max(z - 0.5, 1);
      if (newZoom === 1) setPanPosition({ x: 0, y: 0 });
      return newZoom;
    });
  };
  const handleResetZoom = () => {
    setZoom(1);
    setPanPosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(z => Math.min(z + 0.25, 4));
    } else {
      setZoom(z => {
        const newZoom = Math.max(z - 0.25, 1);
        if (newZoom === 1) setPanPosition({ x: 0, y: 0 });
        return newZoom;
      });
    }
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleCopyCaption = () => {
    if (activeGeneratedImage?.caption) {
      navigator.clipboard.writeText(activeGeneratedImage.caption);
      setCopiedCaption(true);
      toast.success('Caption copiée!');
      setTimeout(() => setCopiedCaption(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    if (products.length === 0) {
      toast.error('Ajoutez au moins un produit');
      return;
    }

    // Set the feedback before regenerating
    if (feedbackInput.trim()) {
      setIterationFeedback(feedbackInput.trim());
    }

    setGenerating(true);

    try {
      const brief = getBrief();
      // Override with current feedback input
      if (feedbackInput.trim()) {
        brief.iterationFeedback = feedbackInput.trim();
      }

      const res = await fetch('/api/v1/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...brief,
          useBrandStyle, // Pass the toggle state for caption generation
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Generation failed');
      }

      if (result.outputUrl) {
        // Save feedback before clearing for version history
        const usedFeedback = feedbackInput.trim() || undefined;
        addGeneratedImage(result.outputUrl, result.caption, usedFeedback);
        setFeedbackInput(''); // Clear feedback after successful generation
        setIterationFeedback(''); // Clear stored feedback
        toast.success('Nouvelle version générée!');
      } else {
        throw new Error('No output URL in response');
      }
    } catch (error) {
      console.error('Regeneration error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!activeGeneratedImage?.url) return;

    try {
      // Fetch the image to bypass CORS download restrictions
      const response = await fetch(activeGeneratedImage.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `seetu-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
      toast.success('Image téléchargée!');
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      window.open(activeGeneratedImage.url, '_blank');
      toast.error('Téléchargement direct échoué - ouvert dans un nouvel onglet');
    }
  };

  const handleNewSession = () => {
    reset();
  };

  const handleSaveAsProduct = async () => {
    if (!activeGeneratedImage?.url) return;

    setIsSavingAsProduct(true);
    try {
      const response = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeProduct?.name ? `${activeProduct.name} - Variation` : `Création ${new Date().toLocaleDateString('fr-FR')}`,
          imageUrl: activeGeneratedImage.url,
          metadata: {
            source: 'studio_generation',
            originalProductId: activeProduct?.id,
            caption: editedCaption || activeGeneratedImage.caption,
            generatedAt: new Date().toISOString(),
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la sauvegarde');
      }

      toast.success('Image ajoutée à votre bibliothèque produits!', {
        action: {
          label: 'Voir',
          onClick: () => window.open('/library', '_blank'),
        },
      });
    } catch (error) {
      console.error('Save as product error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsSavingAsProduct(false);
    }
  };

  return (
    <main className="flex-1 bg-slate-100 relative flex flex-col">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pb-24 flex flex-col items-center justify-center">
        {/* Instagram-style Post Card */}
        <div className="relative z-10 w-[600px] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Image Area */}
        <div className="relative aspect-square">
          {/* Empty State - Before Generation */}
          {!activeGeneratedImage?.url && !isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-slate-50">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <ImageIcon className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-slate-800 text-lg font-medium mb-2">
                Votre création apparaîtra ici
              </h3>
              <p className="text-slate-500 text-sm max-w-[300px]">
                Configurez vos options dans le panneau de gauche, puis cliquez sur Générer
              </p>
              {activeProduct && (
                <div className="mt-6 px-4 py-2 bg-white rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500">Produit sélectionné:</p>
                  <p className="text-slate-800 text-sm font-medium">
                    {activeProduct.name || 'Produit'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <div className="absolute inset-0 bg-white flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-slate-200 border-t-violet-600 animate-spin" />
                <Wand2 className="absolute inset-0 m-auto h-8 w-8 text-violet-600" />
              </div>
              <p className="text-slate-800 text-lg font-medium mt-6">Génération en cours...</p>
              <p className="text-slate-500 text-sm mt-2">Cela peut prendre quelques secondes</p>
            </div>
          )}

          {/* Generated Image - After Generation with Zoom */}
          {activeGeneratedImage?.url && !isGenerating && (
            <>
              <div
                className={cn(
                  "absolute inset-0 overflow-hidden bg-slate-900",
                  zoom > 1 ? "cursor-grab" : "cursor-zoom-in",
                  isDragging && "cursor-grabbing"
                )}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={activeGeneratedImage.url}
                  alt="Generated"
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                  style={{
                    transform: `scale(${zoom}) translate(${panPosition.x / zoom}px, ${panPosition.y / zoom}px)`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                  }}
                />
              </div>

              {/* Zoom Controls Overlay */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/70 rounded-lg p-1 z-10">
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  className="p-1.5 rounded hover:bg-white/20 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Zoom arrière"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-white text-xs font-medium px-2 min-w-[45px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 4}
                  className="p-1.5 rounded hover:bg-white/20 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Zoom avant"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                {zoom > 1 && (
                  <button
                    onClick={handleResetZoom}
                    className="p-1.5 rounded hover:bg-white/20 text-white transition-colors ml-1"
                    title="Réinitialiser le zoom"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Version indicator */}
              {generatedImages.length > 1 && (
                <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full pointer-events-none">
                  Version {activeGeneratedImageIndex + 1}
                </div>
              )}

              {/* Zoom hint */}
              {zoom === 1 && (
                <div className="absolute bottom-3 left-3 bg-black/50 text-white/70 text-[10px] px-2 py-1 rounded pointer-events-none">
                  Scroll pour zoomer
                </div>
              )}
            </>
          )}
        </div>

        {/* Caption Area - IG Style */}
        {activeGeneratedImage?.caption && !isGenerating && (
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-start justify-between gap-2">
              {isEditingCaption ? (
                <Textarea
                  value={editedCaption}
                  onChange={(e) => setEditedCaption(e.target.value)}
                  className="flex-1 text-sm text-slate-800 leading-relaxed resize-none min-h-[60px] max-h-[120px]"
                  autoFocus
                  onBlur={() => setIsEditingCaption(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditingCaption(false);
                      setEditedCaption(activeGeneratedImage.caption || '');
                    }
                  }}
                />
              ) : (
                <p
                  className="text-sm text-slate-800 leading-relaxed flex-1 whitespace-pre-wrap max-h-[100px] overflow-y-auto cursor-pointer hover:bg-slate-50 rounded p-1 -m-1"
                  onClick={() => {
                    setEditedCaption(activeGeneratedImage.caption || '');
                    setIsEditingCaption(true);
                  }}
                  title="Cliquez pour modifier"
                >
                  {editedCaption || activeGeneratedImage.caption}
                </p>
              )}
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditedCaption(activeGeneratedImage.caption || '');
                    setIsEditingCaption(true);
                  }}
                  className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                  title="Modifier la caption"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    const textToCopy = editedCaption || activeGeneratedImage.caption;
                    if (textToCopy) {
                      navigator.clipboard.writeText(textToCopy);
                      setCopiedCaption(true);
                      toast.success('Caption copiée!');
                      setTimeout(() => setCopiedCaption(false), 2000);
                    }
                  }}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    copiedCaption
                      ? 'bg-green-100 text-green-600'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                  title="Copier la caption"
                >
                  {copiedCaption ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Cliquez sur le texte pour modifier • Copier avec le bouton
            </p>
          </div>
        )}
        </div>

        {/* Feedback Input - Show after generation */}
        {activeGeneratedImage?.url && !isGenerating && (
          <div className="w-[600px] mt-4 z-10">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-3">
              <div className="flex gap-2">
                <Input
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && feedbackInput.trim()) {
                      handleRegenerate();
                    }
                  }}
                  placeholder="Décrivez les modifications souhaitées... (ex: plus lumineux, angle différent)"
                  className="flex-1 border-slate-200 text-sm"
                />
                <Button
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-4"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Améliorer
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                Appuyez sur Entrée ou cliquez sur Améliorer pour générer une nouvelle version
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-200 flex items-center justify-between px-10 z-20">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Info className="h-4 w-4" />
          <span>
            {activeGeneratedImage?.url
              ? 'Image générée avec succès!'
              : "L'IA respectera vos notes textuelles en priorité."
            }
          </span>
        </div>

        <div className="flex items-center gap-3">
          {activeGeneratedImage?.url && (
            <>
              <Button
                variant="outline"
                onClick={handleDownload}
                className="border-slate-300"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowVideoModal(true)}
                className="border-violet-300 text-violet-600 hover:bg-violet-50"
              >
                <Film className="h-4 w-4 mr-2" />
                Animer
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveAsProduct}
                disabled={isSavingAsProduct}
                className="border-emerald-300 text-emerald-600 hover:bg-emerald-50"
              >
                {isSavingAsProduct ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Library className="h-4 w-4 mr-2" />
                )}
                Sauvegarder
              </Button>
              <Button
                onClick={handleNewSession}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle création
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Video Generation Modal */}
      {activeGeneratedImage?.url && (
        <VideoGenerationModal
          open={showVideoModal}
          onOpenChange={setShowVideoModal}
          sourceImageUrl={activeGeneratedImage.url}
        />
      )}
    </main>
  );
}
