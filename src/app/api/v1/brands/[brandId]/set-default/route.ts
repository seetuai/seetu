import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ brandId: string }>;
}

/**
 * POST /api/v1/brands/[brandId]/set-default - Set brand as default
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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

    // Already default
    if (brand.isDefault) {
      return NextResponse.json({ success: true, brand });
    }

    // Remove default from all user's brands and set new default
    await prisma.$transaction([
      prisma.brand.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      }),
      prisma.brand.update({
        where: { id: brandId },
        data: { isDefault: true },
      }),
    ]);

    const updatedBrand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    return NextResponse.json({ success: true, brand: updatedBrand });
  } catch (error) {
    console.error('Error setting default brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
