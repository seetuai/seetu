import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generatePerformanceInsights } from '@/lib/performance-analysis';
import type { PerformanceInsights } from '@/lib/performance-analysis';

// ═══════════════════════════════════════════════════════════════
// GET - Get performance analytics for a brand
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify brand ownership
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        userId: user.id,
      },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

    // Check for cached insights
    if (!refresh && brand.performanceInsights) {
      const cached = brand.performanceInsights as unknown as PerformanceInsights;
      const cacheAge = Date.now() - new Date(cached.lastAnalyzedAt).getTime();
      const ONE_HOUR = 60 * 60 * 1000;

      // Return cached if less than 1 hour old
      if (cacheAge < ONE_HOUR) {
        return NextResponse.json({
          insights: cached,
          cached: true,
          cacheAge: Math.round(cacheAge / 1000),
        });
      }
    }

    // Fetch Instagram posts for analysis
    const posts = await prisma.instagramPost.findMany({
      where: { brandId },
      orderBy: { engagementScore: 'desc' },
    });

    if (posts.length === 0) {
      return NextResponse.json({
        insights: null,
        message: 'No Instagram posts found. Analyze your brand first to get performance insights.',
        postCount: 0,
      });
    }

    // Generate fresh insights
    const insights = generatePerformanceInsights(posts);

    // Cache insights in brand
    await prisma.brand.update({
      where: { id: brandId },
      data: {
        performanceInsights: insights as unknown as Record<string, unknown>,
      },
    });

    return NextResponse.json({
      insights,
      cached: false,
      postCount: posts.length,
    });
  } catch (error) {
    console.error('[ANALYTICS] Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// POST - Manually trigger re-analysis of Instagram posts
// ═══════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify brand ownership
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        userId: user.id,
      },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Fetch all posts and regenerate insights
    const posts = await prisma.instagramPost.findMany({
      where: { brandId },
      orderBy: { engagementScore: 'desc' },
    });

    if (posts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No Instagram posts to analyze',
      });
    }

    // Generate fresh insights
    const insights = generatePerformanceInsights(posts);

    // Update cache
    await prisma.brand.update({
      where: { id: brandId },
      data: {
        performanceInsights: insights as unknown as Record<string, unknown>,
      },
    });

    return NextResponse.json({
      success: true,
      insights,
      postCount: posts.length,
    });
  } catch (error) {
    console.error('[ANALYTICS] Error refreshing analytics:', error);
    return NextResponse.json(
      { error: 'Failed to refresh analytics' },
      { status: 500 }
    );
  }
}
