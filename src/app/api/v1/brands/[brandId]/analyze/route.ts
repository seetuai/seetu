import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface RouteParams {
  params: Promise<{ brandId: string }>;
}

const APIFY_BASE_URL = 'https://api.apify.com/v2/acts';
const APIFY_INSTAGRAM_ACTOR = 'apify~instagram-profile-scraper';

/**
 * POST /api/v1/brands/[brandId]/analyze - Analyze brand from Instagram
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

    const body = await req.json();
    const { instagramHandle } = body as { instagramHandle?: string };

    const handle = instagramHandle || brand.instagramHandle;

    if (!handle) {
      return NextResponse.json(
        { error: 'Handle Instagram requis' },
        { status: 400 }
      );
    }

    // Clean handle
    const cleanHandle = handle.replace(/^@/, '').trim();

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      return NextResponse.json(
        { error: 'Service de scraping non configuré' },
        { status: 500 }
      );
    }

    // Step 1: Fetch images from Instagram via Apify
    const actorUrl = `${APIFY_BASE_URL}/${APIFY_INSTAGRAM_ACTOR}/run-sync-get-dataset-items?token=${apifyToken}`;

    const apifyRes = await fetch(actorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [cleanHandle],
        resultsLimit: 12,
        resultsType: 'posts',
        addParentData: true,
      }),
    });

    if (!apifyRes.ok) {
      console.error('Apify error:', await apifyRes.text());
      return NextResponse.json(
        { error: 'Erreur lors de la récupération Instagram' },
        { status: 500 }
      );
    }

    const apifyData = await apifyRes.json();

    // Extract images and captions
    const images: string[] = [];
    const captions: string[] = [];

    if (Array.isArray(apifyData)) {
      for (const item of apifyData) {
        if (item.displayUrl && images.length < 12) {
          images.push(item.displayUrl);
          if (item.caption) captions.push(item.caption);
        } else if (item.thumbnailSrc && images.length < 12) {
          images.push(item.thumbnailSrc);
          if (item.caption) captions.push(item.caption);
        }
        if (item.latestPosts && Array.isArray(item.latestPosts)) {
          for (const post of item.latestPosts) {
            if (post.displayUrl && images.length < 12) {
              images.push(post.displayUrl);
              if (post.caption) captions.push(post.caption);
            }
          }
        }
      }
    }

    if (images.length < 3) {
      return NextResponse.json(
        { error: 'Profil non trouvé ou pas assez de photos publiques' },
        { status: 400 }
      );
    }

    // Step 2: Call brand analyze endpoint
    const analyzeRes = await fetch(new URL('/api/v1/brand/analyze', req.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        imageUrls: images,
        captions: captions.length >= 3 ? captions : undefined,
        source: 'instagram',
        socialHandle: cleanHandle,
      }),
    });

    const analyzeData = await analyzeRes.json();

    if (!analyzeRes.ok || !analyzeData.success) {
      return NextResponse.json(
        { error: analyzeData.error || 'Erreur lors de l\'analyse' },
        { status: 500 }
      );
    }

    const brandDNA = analyzeData.brandDNA;

    // Step 3: Update brand with DNA
    const updatedBrand = await prisma.brand.update({
      where: { id: brandId },
      data: {
        instagramHandle: cleanHandle,
        visualDNA: {
          source: brandDNA.source,
          socialHandle: brandDNA.socialHandle,
          sourceImageUrls: brandDNA.sourceImageUrls,
          analyzedAt: brandDNA.analyzedAt,
          palette: brandDNA.palette,
          visual_tokens: brandDNA.visual_tokens,
          photography_settings: brandDNA.photography_settings,
          voice_profile: brandDNA.voice_profile,
          vibe_summary: brandDNA.vibe_summary,
          analysis_summary_fr: brandDNA.analysis_summary_fr,
        } as Prisma.InputJsonValue,
        verbalDNA: brandDNA.verbal_dna ? brandDNA.verbal_dna as Prisma.InputJsonValue : undefined,
        analyzedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      brand: updatedBrand,
      imagesAnalyzed: images.length,
    });
  } catch (error) {
    console.error('Error analyzing brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
