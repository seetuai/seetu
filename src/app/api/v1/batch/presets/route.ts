import { NextResponse } from 'next/server';
import { getPresetsGrouped, BATCH_PRESETS } from '@/lib/batch-presets';

/**
 * GET /api/v1/batch/presets
 * Get available batch presets
 */
export async function GET() {
  try {
    const groupedPresets = getPresetsGrouped();

    return NextResponse.json({
      presets: BATCH_PRESETS,
      grouped: groupedPresets,
    });
  } catch (error) {
    console.error('[BATCH_PRESETS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch presets' },
      { status: 500 }
    );
  }
}
