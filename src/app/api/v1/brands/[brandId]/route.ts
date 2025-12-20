import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ brandId: string }>;
}

/**
 * GET /api/v1/brands/[brandId] - Get a single brand
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { brandId } = await params;

    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        userId: user.id,
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marque non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ brand });
  } catch (error) {
    console.error('Error fetching brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/brands/[brandId] - Delete a brand
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { brandId } = await params;

    // Check if brand exists and belongs to user
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        userId: user.id,
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marque non trouvée' }, { status: 404 });
    }

    // Count user's brands
    const brandsCount = await prisma.brand.count({
      where: { userId: user.id },
    });

    if (brandsCount <= 1) {
      return NextResponse.json(
        { error: 'Vous devez avoir au moins une marque' },
        { status: 400 }
      );
    }

    // If deleting the default brand, set another as default
    if (brand.isDefault) {
      const anotherBrand = await prisma.brand.findFirst({
        where: {
          userId: user.id,
          id: { not: brandId },
        },
      });

      if (anotherBrand) {
        await prisma.brand.update({
          where: { id: anotherBrand.id },
          data: { isDefault: true },
        });
      }
    }

    // Delete the brand
    await prisma.brand.delete({
      where: { id: brandId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
