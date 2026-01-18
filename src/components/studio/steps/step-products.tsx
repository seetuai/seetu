'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { useWizardStore } from '@/lib/stores/wizard-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Upload,
  Pen,
  Check,
  Loader2,
  MessageSquare,
  Package,
  Plus,
  X,
  Sparkles,
  ArrowRight,
  ScanSearch,
  MousePointerClick,
} from 'lucide-react';

interface LibraryProduct {
  id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl: string;
  category?: string;
  metadata?: {
    category?: string;
    subcategory?: string;
    colors?: string[];
    materials?: string[];
    style?: string;
    description?: string;
    keywords?: string[];
    suggestedContexts?: string[];
  };
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  return {
    ...data,
    products: data.products?.map((p: any) => ({
      ...p,
      imageUrl: p.originalUrl || p.imageUrl,
    })),
  };
};

export function StepProducts() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(true);
  const [editingNote, setEditingNote] = useState(false);

  // Name input dialog state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [pendingThumbnailUrl, setPendingThumbnailUrl] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<any>(null);
  const [newProductName, setNewProductName] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);

  // Multi-product detection state
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedProducts, setDetectedProducts] = useState<Array<{
    id: string;
    description: string;
    bbox: { x_min: number; y_min: number; x_max: number; y_max: number };
    svgPath?: string;
    segBbox?: { x_min: number; y_min: number; x_max: number; y_max: number };
  }>>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showProductSelectionDialog, setShowProductSelectionDialog] = useState(false);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [showNameEditStep, setShowNameEditStep] = useState(false);

  const {
    products,
    activeProductIndex,
    setActiveProduct,
    addProduct,
    removeProduct,
    updateProductName,
    updateProductNote,
    updateProductAnalysis,
    nextStep,
  } = useWizardStore();

  const [editingName, setEditingName] = useState(false);

  const { data, isLoading, mutate } = useSWR<{ products: LibraryProduct[] }>(
    '/api/v1/products',
    fetcher
  );

  const libraryProducts = data?.products || [];
  const activeProduct = products[activeProductIndex];

  const isProductAdded = (productId: string) => {
    return products.some(p => p.id === productId);
  };

  const handleSelectFromLibrary = async (product: LibraryProduct) => {
    if (isProductAdded(product.id)) {
      removeProduct(product.id);
      toast.success(`${product.name} retiré`);
      return;
    }

    // Check if we have actual analysis data (not just bbox metadata)
    const hasAnalysis = product.metadata?.category || product.metadata?.colors?.length;
    let savedAnalysis = hasAnalysis ? {
      category: product.metadata?.category || product.category || '',
      subcategory: product.metadata?.subcategory || '',
      name: product.name || '',
      colors: product.metadata?.colors || [],
      materials: product.metadata?.materials || [],
      style: product.metadata?.style || '',
      description: product.metadata?.description || '',
      suggestedContexts: product.metadata?.suggestedContexts || [],
      keywords: product.metadata?.keywords || [],
    } : undefined;

    // If no analysis, run it now (needed for caption generation)
    if (!savedAnalysis) {
      setIsAnalyzing(true);
      toast.info('Analyse du produit en cours...');
      try {
        const analyzeRes = await fetch('/api/v1/studio/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: product.imageUrl }),
        });
        if (analyzeRes.ok) {
          const analysisData = await analyzeRes.json();
          savedAnalysis = {
            category: analysisData.category || '',
            subcategory: analysisData.subcategory || '',
            name: analysisData.name || product.name || '',
            colors: analysisData.colors || [],
            materials: analysisData.materials || [],
            style: analysisData.style || '',
            description: analysisData.description || '',
            suggestedContexts: analysisData.suggestedContexts || [],
            keywords: analysisData.keywords || [],
          };
          // Save analysis to database for future use
          fetch(`/api/v1/products/${product.id}`, {  // Uses [productId] route
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              metadata: { ...product.metadata, ...savedAnalysis }
            }),
          }).catch(() => {}); // Fire and forget
        }
      } catch (err) {
        console.warn('Failed to analyze product:', err);
      }
      setIsAnalyzing(false);
    }

    addProduct({
      id: product.id,
      url: product.imageUrl,
      thumbnailUrl: product.thumbnailUrl || product.imageUrl,
      name: product.name,
      analysis: savedAnalysis,
    });

    setShowLibrary(false);
    toast.success(`${product.name} sélectionné`);
  };

  const handleRemoveProduct = (productId: string, productName?: string) => {
    removeProduct(productId);
    toast.success(`${productName || 'Produit'} retiré`);
  };

  // When file is selected, upload, detect products, then show selection dialog
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    setPendingFile(file);
    setIsUploading(true);
    setPendingAnalysis(null);
    setPendingImageUrl(null);
    setPendingThumbnailUrl(null);
    setNewProductName('');
    setDetectedProducts([]);
    setSelectedProductIds([]);

    try {
      // Create FormData for upload
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      // Upload the file first
      const uploadRes = await fetch('/api/v1/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url, thumbnailUrl } = await uploadRes.json();

      setPendingImageUrl(url);
      setPendingThumbnailUrl(thumbnailUrl || url);
      setIsUploading(false);
      setIsDetecting(true);

      // Detect products with Moondream (for SVG outlines)
      const detectFormData = new FormData();
      detectFormData.append('file', file);

      const detectRes = await fetch('/api/v1/studio/detect', {
        method: 'POST',
        body: detectFormData,
      });

      if (detectRes.ok) {
        const { products: detected, totalCount } = await detectRes.json();
        console.log('[STUDIO] Detected products:', detected);

        // Products detected with SVG paths from Moondream
        if (detected && detected.length > 0) {
          // Auto-select all products
          setSelectedProductIds(detected.map((p: any) => p.id));
          setDetectedProducts(detected);
          console.log('[STUDIO] Products with SVG paths:', detected.map((p: any) => ({
            name: p.description,
            hasSvgPath: !!p.svgPath,
            pathLength: p.svgPath?.length || 0
          })));

          // Show the dialog with outlines ready
          setIsDetecting(false);
          setShowProductSelectionDialog(true);

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
      }

      // Single product or detection failed - proceed with analysis
      setIsDetecting(false);
      await analyzeSelectedProduct(file, url, thumbnailUrl);
    } catch (error) {
      console.error('Upload/detect error:', error);
      toast.error("Erreur lors de l'upload ou de la détection");
      setPendingFile(null);
      setPendingImageUrl(null);
      setPendingThumbnailUrl(null);
      setPendingAnalysis(null);
      setIsUploading(false);
      setIsDetecting(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Analyze a single product with Gemini
  const analyzeSelectedProduct = async (file: File, imageUrl?: string, thumbUrl?: string) => {
    setIsAnalyzing(true);
    setShowProductSelectionDialog(false);

    try {
      const url = imageUrl || pendingImageUrl;
      const thumbnailUrl = thumbUrl || pendingThumbnailUrl;

      // Analyze the product with Gemini
      const analyzeFormData = new FormData();
      analyzeFormData.append('file', file);

      const analyzeRes = await fetch('/api/v1/studio/analyze', {
        method: 'POST',
        body: analyzeFormData,
      });

      if (analyzeRes.ok) {
        const { analysis } = await analyzeRes.json();
        setPendingAnalysis(analysis);
        // Pre-fill name with AI suggestion
        setNewProductName(analysis.name || '');
      }

      setIsAnalyzing(false);
      // Show analysis results dialog
      setShowNameDialog(true);
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error("Erreur lors de l'analyse");
      setIsAnalyzing(false);
    }
  };

  // Handle product selection from multi-product dialog - go to name edit step
  const handleProductSelection = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('Sélectionnez au moins un produit');
      return;
    }

    // Get selected products
    const selectedProducts = detectedProducts.filter(p => selectedProductIds.includes(p.id));

    if (selectedProducts.length === 0) {
      toast.error('Aucun produit sélectionné');
      return;
    }

    // Initialize names with detected descriptions
    const initialNames: Record<string, string> = {};
    selectedProducts.forEach(p => {
      initialNames[p.id] = p.description;
    });
    setProductNames(initialNames);

    // Show name edit step
    setShowProductSelectionDialog(false);
    setShowNameEditStep(true);
  };

  // Handle final save after name editing
  const handleSaveWithNames = async () => {
    const selectedProducts = detectedProducts.filter(p => selectedProductIds.includes(p.id));

    // Check all names are filled
    const missingNames = selectedProducts.some(p => !productNames[p.id]?.trim());
    if (missingNames) {
      toast.error('Veuillez donner un nom à chaque produit');
      return;
    }

    setShowNameEditStep(false);
    setIsAnalyzing(true);

    try {
      // Create each selected product with user-provided name
      for (const product of selectedProducts) {
        const finalName = productNames[product.id]?.trim() || product.description;
        const createResponse = await fetch('/api/v1/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: finalName,
            imageUrl: pendingImageUrl,
            thumbnailUrl: pendingThumbnailUrl,
            metadata: {
              bbox: product.bbox,
              svgPath: product.svgPath,
              segBbox: product.segBbox,
              detectedAs: product.description,
            },
          }),
        });

        if (!createResponse.ok) {
          console.error('Failed to create product:', finalName);
          continue;
        }

        const savedData = await createResponse.json();
        const productId = savedData.product?.id || savedData.id;

        // Add to wizard store
        addProduct({
          id: productId,
          url: pendingImageUrl!,
          thumbnailUrl: pendingThumbnailUrl || pendingImageUrl!,
          name: finalName,
        });

        toast.success(`"${finalName}" ajouté !`);
      }

      mutate(); // Refresh product list
      handleCancelUpload(); // Reset state
      setShowLibrary(false);
    } catch (error) {
      console.error('Error creating products:', error);
      toast.error('Erreur lors de la création des produits');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle product selection
  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Cancel the upload
  const handleCancelUpload = () => {
    setPendingFile(null);
    setPendingImageUrl(null);
    setPendingThumbnailUrl(null);
    setPendingAnalysis(null);
    setNewProductName('');
    setShowNameDialog(false);
    setDetectedProducts([]);
    setSelectedProductIds([]);
    setShowProductSelectionDialog(false);
    setProductNames({});
    setShowNameEditStep(false);
  };

  // Proceed to save product after reviewing analysis and confirming name
  const handleConfirmUpload = async () => {
    if (!pendingImageUrl || !newProductName.trim()) {
      toast.error('Veuillez entrer un nom pour le produit');
      return;
    }

    setShowNameDialog(false);
    const productName = newProductName.trim();

    try {
      // Save to products library with the user-provided name
      const saveRes = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productName,
          imageUrl: pendingImageUrl,
          thumbnailUrl: pendingThumbnailUrl,
          category: pendingAnalysis?.category,
          metadata: pendingAnalysis ? {
            category: pendingAnalysis.category,
            subcategory: pendingAnalysis.subcategory,
            colors: pendingAnalysis.colors,
            materials: pendingAnalysis.materials,
            style: pendingAnalysis.style,
            description: pendingAnalysis.description,
            keywords: pendingAnalysis.keywords,
            suggestedContexts: pendingAnalysis.suggestedContexts,
          } : {},
        }),
      });

      let productId = `prod-${Date.now()}`;

      if (saveRes.ok) {
        const savedData = await saveRes.json();
        productId = savedData.product?.id || savedData.id;
      }

      // Add to wizard store with analysis
      addProduct({
        id: productId,
        url: pendingImageUrl,
        thumbnailUrl: pendingThumbnailUrl || pendingImageUrl,
        name: productName,
        analysis: pendingAnalysis ? {
          category: pendingAnalysis.category || '',
          subcategory: pendingAnalysis.subcategory || '',
          name: productName,
          colors: pendingAnalysis.colors || [],
          materials: pendingAnalysis.materials || [],
          style: pendingAnalysis.style || '',
          description: pendingAnalysis.description || '',
          suggestedContexts: pendingAnalysis.suggestedContexts || [],
          keywords: pendingAnalysis.keywords || [],
        } : undefined,
      });

      mutate();
      setShowLibrary(false);
      toast.success('Produit ajouté !');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setPendingFile(null);
      setPendingImageUrl(null);
      setPendingThumbnailUrl(null);
      setPendingAnalysis(null);
      setNewProductName('');
    }
  };

  const canProceed = products.length > 0;

  // Build French description of the product
  const getProductDescription = () => {
    if (!activeProduct?.analysis) return null;
    const { category, colors, materials, description } = activeProduct.analysis;

    const parts: string[] = [];
    if (description) {
      parts.push(description);
    } else {
      if (category) parts.push(`C'est un produit de type "${category}"`);
      if (colors?.length) parts.push(`de couleur ${colors.slice(0, 2).join(' et ')}`);
      if (materials?.length) parts.push(`en ${materials.slice(0, 2).join(' et ')}`);
    }

    return parts.length > 0 ? parts.join(', ') + '.' : null;
  };

  return (
    <div className="space-y-4">
      {/* No product selected yet */}
      {products.length === 0 && (
        <>
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-center">
            <Sparkles className="h-8 w-8 text-violet-500 mx-auto mb-2" />
            <p className="text-sm text-violet-800 font-medium">
              Commençons ! Quel produit souhaitez-vous photographier ?
            </p>
            <p className="text-xs text-violet-600 mt-1">
              Sélectionnez depuis votre bibliothèque ou uploadez une nouvelle image
            </p>
          </div>

          {/* Library Products */}
          {libraryProducts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Ma Bibliothèque ({libraryProducts.length})
              </p>
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {isLoading ? (
                  <>
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </>
                ) : (
                  libraryProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => handleSelectFromLibrary(product)}
                      className="flex gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-all hover:border-violet-300 hover:bg-violet-50"
                    >
                      <div className="w-[45px] h-[45px] bg-slate-200 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={product.thumbnailUrl || product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">
                          {product.name}
                        </div>
                        {product.metadata?.colors && (
                          <div className="text-xs text-slate-500 truncate">
                            {product.metadata.colors.slice(0, 2).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center">
                        <Plus className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />

          {/* Loading state while uploading/detecting/analyzing */}
          {(isUploading || isDetecting || isAnalyzing) && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-center">
              {isDetecting ? (
                <ScanSearch className="h-6 w-6 text-violet-500 mx-auto mb-2 animate-pulse" />
              ) : (
                <Loader2 className="h-6 w-6 text-violet-500 mx-auto mb-2 animate-spin" />
              )}
              <p className="text-sm text-violet-800 font-medium">
                {isUploading ? 'Upload en cours...' : isDetecting ? 'Détection et segmentation...' : 'Analyse du produit en cours...'}
              </p>
              <p className="text-xs text-violet-600 mt-1">
                {isUploading
                  ? "L'image est en cours d'envoi"
                  : isDetecting
                  ? "Moondream détecte et segmente les produits"
                  : "L'IA analyse les caractéristiques du produit"}
              </p>
            </div>
          )}

          {!isUploading && !isDetecting && !isAnalyzing && (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed border-slate-300 text-slate-600 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 h-12"
            >
              <Upload className="h-4 w-4 mr-2" />
              Uploader une nouvelle image
            </Button>
          )}
        </>
      )}

      {/* Product selected - Show analysis */}
      {products.length > 0 && activeProduct && (
        <>
          {/* Analyzing state */}
          {isAnalyzing && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-center">
              <Loader2 className="h-6 w-6 text-violet-500 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-violet-800">Analyse du produit en cours...</p>
            </div>
          )}

          {/* Product card with analysis */}
          {!isAnalyzing && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Product image */}
              <div className="relative h-[140px] bg-slate-100">
                <img
                  src={activeProduct.thumbnailUrl || activeProduct.url}
                  alt={activeProduct.name || 'Produit'}
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() => handleRemoveProduct(activeProduct.id, activeProduct.name)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Analysis info */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {editingName ? (
                      <Input
                        value={activeProduct.name || ''}
                        onChange={(e) => {
                          updateProductName(activeProduct.id, e.target.value);
                          // Also update in database
                          fetch(`/api/v1/products/${activeProduct.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: e.target.value }),
                          });
                        }}
                        onBlur={() => setEditingName(false)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                        autoFocus
                        className="text-sm font-semibold h-8"
                        placeholder="Nom du produit"
                      />
                    ) : (
                      <h3
                        onClick={() => setEditingName(true)}
                        className="font-semibold text-slate-900 cursor-pointer hover:text-violet-600 flex items-center gap-1"
                      >
                        {activeProduct.name || 'Produit'}
                        <Pen className="h-3 w-3 text-slate-400" />
                      </h3>
                    )}
                    {activeProduct.analysis?.category && (
                      <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                        {activeProduct.analysis.category}
                        {activeProduct.analysis?.subcategory && ` • ${activeProduct.analysis.subcategory}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Detection summary */}
                {getProductDescription() && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Ce que j'ai détecté :
                    </p>
                    <p className="text-sm text-slate-700">{getProductDescription()}</p>
                  </div>
                )}

                {/* Colors and materials tags */}
                {(activeProduct.analysis?.colors?.length || activeProduct.analysis?.materials?.length) && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeProduct.analysis?.colors?.map((color) => (
                      <span
                        key={color}
                        className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600"
                      >
                        {color}
                      </span>
                    ))}
                    {activeProduct.analysis?.materials?.map((mat) => (
                      <span
                        key={mat}
                        className="text-xs bg-amber-50 px-2 py-0.5 rounded-full text-amber-700"
                      >
                        {mat}
                      </span>
                    ))}
                  </div>
                )}

                {/* Note section */}
                <div className="border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setEditingNote(!editingNote)}
                    className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"
                  >
                    <Pen className="h-3 w-3" />
                    {activeProduct.note ? 'Modifier ma note' : 'Ajouter une précision'}
                  </button>

                  {editingNote && (
                    <div className="mt-2">
                      <Input
                        value={activeProduct.note || ''}
                        onChange={(e) => updateProductNote(activeProduct.id, e.target.value)}
                        placeholder="ex: Je veux le montrer en bleu, zoom sur le logo..."
                        className="text-sm h-9"
                      />
                    </div>
                  )}

                  {activeProduct.note && !editingNote && (
                    <p className="text-sm text-slate-600 mt-1 italic">"{activeProduct.note}"</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Multiple products indicator */}
          {products.length > 1 && (
            <div className="flex gap-2 items-center">
              <p className="text-xs text-slate-500">{products.length} produits sélectionnés:</p>
              <div className="flex gap-1">
                {products.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setActiveProduct(i)}
                    className={cn(
                      'w-8 h-8 rounded border-2 overflow-hidden transition-all',
                      i === activeProductIndex
                        ? 'border-violet-500 ring-2 ring-violet-200'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add another product */}
          {showLibrary && libraryProducts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLibrary(false)}
              className="text-slate-500"
            >
              Voir moins
            </Button>
          )}

          {!showLibrary && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLibrary(true)}
              className="w-full text-slate-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un autre produit
            </Button>
          )}

          {/* Library when adding more */}
          {showLibrary && products.length > 0 && libraryProducts.length > 0 && (
            <div className="space-y-2 max-h-[120px] overflow-y-auto border-t border-slate-100 pt-3">
              {libraryProducts.filter(p => !isProductAdded(p.id)).map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleSelectFromLibrary(product)}
                  className="flex gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-all hover:border-violet-300 hover:bg-violet-50"
                >
                  <div className="w-[35px] h-[35px] bg-slate-200 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={product.thumbnailUrl || product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex items-center min-w-0">
                    <span className="text-sm text-slate-700 truncate">{product.name}</span>
                  </div>
                  <Plus className="h-4 w-4 text-slate-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </>
      )}

      {/* Next Button */}
      <Button
        onClick={nextStep}
        disabled={!canProceed || isAnalyzing || isDetecting}
        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold h-11"
      >
        {isAnalyzing || isDetecting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isDetecting ? 'Détection en cours...' : 'Analyse en cours...'}
          </>
        ) : (
          <>
            C'est bon, passons à la suite
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>

      {/* Product Analysis & Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={(open) => !open && handleCancelUpload()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Analyse du produit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Image preview */}
            {pendingImageUrl && (
              <div className="relative h-[160px] bg-slate-100 rounded-lg overflow-hidden">
                <img
                  src={pendingImageUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Analysis results */}
            {pendingAnalysis && (
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-violet-600 font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Ce que j'ai détecté :
                </p>

                {/* Category */}
                {pendingAnalysis.category && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-violet-200 text-violet-800 px-2 py-0.5 rounded-full">
                      {pendingAnalysis.category}
                      {pendingAnalysis.subcategory && ` • ${pendingAnalysis.subcategory}`}
                    </span>
                  </div>
                )}

                {/* Description */}
                {pendingAnalysis.description && (
                  <p className="text-sm text-slate-700">{pendingAnalysis.description}</p>
                )}

                {/* Colors and Materials */}
                <div className="flex flex-wrap gap-1.5">
                  {pendingAnalysis.colors?.map((color: string) => (
                    <span
                      key={color}
                      className="text-xs bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-600"
                    >
                      {color}
                    </span>
                  ))}
                  {pendingAnalysis.materials?.map((mat: string) => (
                    <span
                      key={mat}
                      className="text-xs bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-amber-700"
                    >
                      {mat}
                    </span>
                  ))}
                </div>

                {/* Suggested contexts */}
                {pendingAnalysis.suggestedContexts?.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs text-slate-500 mb-1">Contextes suggérés :</p>
                    <p className="text-xs text-slate-600">
                      {pendingAnalysis.suggestedContexts.slice(0, 3).join(' • ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Name input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Nom du produit <span className="text-red-500">*</span>
              </label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="ex: Sac à main Elegance, Robe Dakar..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && newProductName.trim() && handleConfirmUpload()}
              />
              <p className="text-xs text-slate-500">
                {pendingAnalysis?.name
                  ? "Nom suggéré par l'IA. Vous pouvez le modifier si besoin."
                  : "Donnez un nom descriptif à votre produit"}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelUpload}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={!newProductName.trim()}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-Product Selection Dialog */}
      <Dialog open={showProductSelectionDialog} onOpenChange={(open) => !open && handleCancelUpload()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MousePointerClick className="h-5 w-5 text-violet-500" />
              Plusieurs produits détectés
            </DialogTitle>
            <DialogDescription>
              Sélectionnez les produits que vous souhaitez ajouter
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image with detected products highlighted */}
            <div className="relative bg-slate-900 rounded-xl overflow-hidden" style={{ minHeight: '200px', maxHeight: '350px' }}>
              {pendingImageUrl && (
                <div className="flex items-center justify-center h-full" style={{ minHeight: '200px' }}>
                  <div className="relative inline-block max-w-full max-h-[350px]">
                    {/* The actual image */}
                    <img
                      src={pendingImageUrl}
                      alt="Uploaded product"
                      className="block max-w-full max-h-[350px] h-auto w-auto"
                      style={{ objectFit: 'contain' }}
                    />

                    {/* Dark overlay when we have SVG paths */}
                    {detectedProducts.some(p => p.svgPath) && (
                      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                    )}

                    {/* Per-product overlays - SVG paths rendered inside each bbox */}
                    {detectedProducts.map((product, idx) => {
                      const colors = ['#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#06b6d4'];
                      const color = colors[idx % colors.length];
                      const isSelected = selectedProductIds.includes(product.id);

                      // Clamp bbox values to 0-1 range
                      const bbox = {
                        x_min: Math.max(0, Math.min(1, product.bbox?.x_min ?? 0)),
                        y_min: Math.max(0, Math.min(1, product.bbox?.y_min ?? 0)),
                        x_max: Math.max(0, Math.min(1, product.bbox?.x_max ?? 1)),
                        y_max: Math.max(0, Math.min(1, product.bbox?.y_max ?? 1)),
                      };

                      return (
                        <div
                          key={product.id}
                          onClick={() => toggleProductSelection(product.id)}
                          className="absolute cursor-pointer group"
                          style={{
                            left: `${bbox.x_min * 100}%`,
                            top: `${bbox.y_min * 100}%`,
                            width: `${(bbox.x_max - bbox.x_min) * 100}%`,
                            height: `${(bbox.y_max - bbox.y_min) * 100}%`,
                            zIndex: isSelected ? 30 : 20,
                          }}
                        >
                          {/* SVG path rendered inside bbox */}
                          {product.svgPath ? (
                            <svg
                              viewBox="0 0 1 1"
                              preserveAspectRatio="none"
                              className="w-full h-full overflow-visible"
                            >
                              <path
                                d={product.svgPath}
                                fill={isSelected ? `${color}40` : `${color}20`}
                                stroke={color}
                                strokeWidth="2px"
                                vectorEffect="non-scaling-stroke"
                                style={{
                                  filter: `drop-shadow(0 0 3px ${color})`,
                                  transition: 'all 0.2s ease',
                                }}
                              />
                            </svg>
                          ) : (
                            /* Fallback dashed box if no SVG path */
                            <div
                              className="w-full h-full border-2 border-dashed rounded"
                              style={{ borderColor: color, backgroundColor: `${color}15` }}
                            />
                          )}

                          {/* Colored label at top */}
                          <div
                            className="absolute left-0 px-2 py-1 text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap"
                            style={{
                              top: '-28px',
                              backgroundColor: color,
                              color: 'white',
                              boxShadow: `0 2px 10px ${color}`,
                            }}
                          >
                            {product.description}
                          </div>

                          {/* Selection indicator */}
                          {isSelected && (
                            <div
                              className="absolute w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                              style={{
                                top: '-10px',
                                right: '-10px',
                                backgroundColor: color,
                                boxShadow: `0 2px 8px ${color}`,
                              }}
                            >
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Product list */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {detectedProducts.length} produit(s) détecté(s) :
              </p>
              <div className="grid grid-cols-1 gap-2 max-h-[120px] overflow-y-auto">
                {detectedProducts.map((product, idx) => {
                  const isSelected = selectedProductIds.includes(product.id);
                  const borderColors = ['border-violet-500', 'border-green-500', 'border-orange-500', 'border-pink-500', 'border-cyan-500'];
                  const bgColors = ['bg-violet-50', 'bg-green-50', 'bg-orange-50', 'bg-pink-50', 'bg-cyan-50'];
                  const dotColors = ['bg-violet-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];

                  return (
                    <div
                      key={product.id}
                      onClick={() => toggleProductSelection(product.id)}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all',
                        isSelected
                          ? `${borderColors[idx % borderColors.length]} ${bgColors[idx % bgColors.length]}`
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className={cn('w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold', dotColors[idx % dotColors.length])}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{product.description}</p>
                      </div>
                      <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center', isSelected ? `${borderColors[idx % borderColors.length]} ${dotColors[idx % dotColors.length]}` : 'border-slate-300')}>
                        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick select buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedProductIds(detectedProducts.map(p => p.id))}>
                Tout sélectionner
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedProductIds([])}>
                Tout désélectionner
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelUpload}>
              Annuler
            </Button>
            <Button
              onClick={handleProductSelection}
              disabled={selectedProductIds.length === 0}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Continuer avec {selectedProductIds.length} produit(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Name Editing Dialog - Step 2 after selection */}
      <Dialog open={showNameEditStep} onOpenChange={(open) => !open && handleCancelUpload()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pen className="h-5 w-5 text-violet-500" />
              Nommer vos produits
            </DialogTitle>
            <DialogDescription>
              Donnez un nom à chaque produit sélectionné
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[350px] overflow-y-auto">
            {detectedProducts
              .filter(p => selectedProductIds.includes(p.id))
              .map((product, idx) => {
                const colors = ['border-violet-300 bg-violet-50', 'border-green-300 bg-green-50', 'border-orange-300 bg-orange-50', 'border-pink-300 bg-pink-50', 'border-cyan-300 bg-cyan-50'];
                const dotColors = ['bg-violet-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];

                return (
                  <div key={product.id} className={cn('p-3 rounded-lg border-2', colors[idx % colors.length])}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold', dotColors[idx % dotColors.length])}>
                        {idx + 1}
                      </div>
                      <span className="text-xs text-slate-500">
                        Détecté : {product.description}
                      </span>
                    </div>
                    <Input
                      value={productNames[product.id] || ''}
                      onChange={(e) => setProductNames(prev => ({ ...prev, [product.id]: e.target.value }))}
                      placeholder="Nom du produit..."
                      className="bg-white"
                    />
                  </div>
                );
              })}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setShowNameEditStep(false);
              setShowProductSelectionDialog(true);
            }}>
              Retour
            </Button>
            <Button
              onClick={handleSaveWithNames}
              disabled={detectedProducts.filter(p => selectedProductIds.includes(p.id)).some(p => !productNames[p.id]?.trim())}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Enregistrer {selectedProductIds.length} produit(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
