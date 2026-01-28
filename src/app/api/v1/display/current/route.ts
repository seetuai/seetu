/**
 * GET /api/v1/display/current
 *
 * Get currently playing content for a billboard player
 * Used by billboard display software to fetch what to show
 *
 * Authentication: X-Billboard-Key header
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentlyPlaying, getNextContent } from '@/lib/billboard/queue-manager';
import { verifyDisplayToken } from '@/lib/display/display-token';

export async function GET(request: NextRequest) {
  try {
    // Authenticate billboard via API key or display token
    const apiKey = request.headers.get('X-Billboard-Key');
    const displayToken = request.headers.get('X-Display-Token');

    if (!apiKey && !displayToken) {
      return NextResponse.json(
        { error: 'Missing authentication header' },
        { status: 401 }
      );
    }

    let billboard: { id: string; name: string; defaultContentUrl: string | null; slotDurationSecs: number } | null = null;

    if (displayToken) {
      const tokenResult = verifyDisplayToken(displayToken);
      if (!tokenResult.valid || !tokenResult.billboardId) {
        return NextResponse.json(
          { error: 'Invalid or expired display token' },
          { status: 401 }
        );
      }
      billboard = await prisma.billboard.findUnique({
        where: { id: tokenResult.billboardId },
        select: { id: true, name: true, defaultContentUrl: true, slotDurationSecs: true },
      });
    } else if (apiKey) {
      billboard = await prisma.billboard.findUnique({
        where: { apiKey },
        select: { id: true, name: true, defaultContentUrl: true, slotDurationSecs: true },
      });
    }

    if (!billboard) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Get currently playing content
    let current = await getCurrentlyPlaying(billboard.id);

    // If nothing is playing, get next in queue
    if (!current) {
      current = await getNextContent(billboard.id);
    }

    // If still nothing, return default content
    if (!current) {
      return NextResponse.json({
        billboardId: billboard.id,
        billboardName: billboard.name,
        content: null,
        defaultContent: billboard.defaultContentUrl,
        slotDurationSecs: billboard.slotDurationSecs,
        message: 'No content in queue, showing default',
      });
    }

    // Get the processed video URL
    const processedUrls = current.content.processedUrls as Record<string, string>;
    const mediaUrl = processedUrls?.mp4 || processedUrls?.video || processedUrls?.url || processedUrls?.original;

    return NextResponse.json({
      billboardId: billboard.id,
      billboardName: billboard.name,
      content: {
        queueId: current.id,
        contentId: current.contentId,
        mediaUrl,
        mediaType: current.content.mediaType,
        durationSeconds: current.content.durationSeconds || billboard.slotDurationSecs,
        position: current.position,
        status: current.status,
      },
      slotDurationSecs: billboard.slotDurationSecs,
    });
  } catch (error) {
    console.error('[API] GET /display/current error:', error);
    return NextResponse.json(
      { error: 'Failed to get current content' },
      { status: 500 }
    );
  }
}
