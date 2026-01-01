'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Package,
  Check,
  Loader2,
  Plus,
  X,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface LibraryProduct {
  id: string;
  name: string;
  originalUrl: string;
  thumbnailUrl: string;
  metadata?: {
    category?: string;
    colors?: string[];
  };
}

interface BatchProductSelectorProps {
  selectedProductIds: string[];
  onSelectionChange: (productIds: string[]) => void;
  maxProducts?: number;
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

export function BatchProductSelector({
  selectedProductIds,
  onSelectionChange,
  maxProducts = 20,
}: BatchProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useSWR<{ products: LibraryProduct[] }>(
    '/api/v1/products',
    fetcher
  );

  const products = data?.products || [];

  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.metadata?.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelected = (productId: string) => selectedProductIds.includes(productId);

  const toggleProduct = (productId: string) => {
    if (isSelected(productId)) {
      onSelectionChange(selectedProductIds.filter((id) => id !== productId));
    } else if (selectedProductIds.length < maxProducts) {
      onSelectionChange([...selectedProductIds, productId]);
    }
  };

  const selectAll = () => {
    const allIds = filteredProducts.slice(0, maxProducts).map((p) => p.id);
    onSelectionChange(allIds);
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-4">
      {/* Header with search and actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un produit..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={filteredProducts.length === 0}
          >
            Tout
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
            disabled={selectedProductIds.length === 0}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Selection counter */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          <Package className="h-4 w-4 inline mr-1.5" />
          {selectedProductIds.length} / {maxProducts} produits selectionnés
        </span>
        {products.length === 0 && !isLoading && (
          <Link
            href="/products"
            className="text-violet-600 hover:text-violet-700 flex items-center gap-1 text-sm"
          >
            Ajouter des produits
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Products grid */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium mb-1">
              Aucun produit dans votre bibliothèque
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Ajoutez d'abord des produits pour pouvoir les utiliser en lot
            </p>
            <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white">
              <Link href="/products">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter des produits
              </Link>
            </Button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">Aucun produit trouve pour "{searchQuery}"</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[400px] overflow-y-auto">
            {filteredProducts.map((product) => {
              const selected = isSelected(product.id);
              const disabled = !selected && selectedProductIds.length >= maxProducts;

              return (
                <button
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  disabled={disabled}
                  className={cn(
                    'group relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                    selected
                      ? 'border-violet-600 ring-2 ring-violet-200'
                      : 'border-slate-200 hover:border-violet-300',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <img
                    src={product.thumbnailUrl || product.originalUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Hover overlay with name */}
                  <div
                    className={cn(
                      'absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-1 transition-opacity',
                      selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    {selected && (
                      <div className="w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center mb-1">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <p className="text-xs text-white text-center line-clamp-2 font-medium">
                      {product.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Add more products link */}
      {products.length > 0 && (
        <div className="text-center">
          <Link
            href="/products"
            className="text-sm text-violet-600 hover:text-violet-700 inline-flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter de nouveaux produits a ma bibliothèque
          </Link>
        </div>
      )}
    </div>
  );
}
