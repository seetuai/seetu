import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getBatchJobProgress } from '@/lib/batch-processor';

// ═══════════════════════════════════════════════════════════════
// GET - Get batch job progress
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const progress = await getBatchJobProgress(id);

    if (!progress) {
      return NextResponse.json(
        { error: 'Batch job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('[BATCH_PROGRESS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get batch progress' },
      { status: 500 }
    );
  }
}
