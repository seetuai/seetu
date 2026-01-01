import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════
// POST - Create multiple products from uploaded images
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { images } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    if (images.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 images allowed' },
        { status: 400 }
      );
    }

    // Get user's default brand
    const brand = await prisma.brand.findFirst({
      where: {
        userId: user.id,
        isDefault: true,
      },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'No brand found. Please create a brand first.' },
        { status: 400 }
      );
    }

    // Create products for each image
    const products = await Promise.all(
      images.map(async (img: { imageUrl: string; name: string }, index: number) => {
        const product = await prisma.product.create({
          data: {
            brandId: brand.id,
            name: img.name || `Product ${index + 1}`,
            thumbnailUrl: img.imageUrl,
            originalUrl: img.imageUrl,
          },
        });
        return product;
      })
    );

    return NextResponse.json({
      success: true,
      productIds: products.map((p) => p.id),
      count: products.length,
    });
  } catch (error) {
    console.error('[PRODUCTS_BATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create products' },
      { status: 500 }
    );
  }
}
