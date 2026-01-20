import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectProducts } from '@/lib/moondream';
import { safeFetchImage, isValidImageUrl, validateLocalPath } from '@/lib/safe-fetch';

/**
 * POST /api/v1/studio/detect
 * Detect multiple products in an image using Moondream
 */
export async function POST(req: NextRequest) {
  // Verify auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const imageUrl = formData.get('imageUrl') as string | null;

    let imageBase64: string;
    let mimeType: string;

    if (file) {
      // Handle file upload
      const buffer = await file.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString('base64');
      mimeType = file.type || 'image/jpeg';
    } else if (imageUrl) {
      // Handle image URL
      if (imageUrl.startsWith('/')) {
        // Local file - only in development with path validation
        const pathValidation = validateLocalPath(imageUrl);
        if (!pathValidation.valid) {
          return NextResponse.json(
            { error: pathValidation.error },
            { status: 400 }
          );
        }
        const fs = await import('fs/promises');
        const path = await import('path');
        const buffer = await fs.readFile(pathValidation.safePath!);
        imageBase64 = buffer.toString('base64');
        const ext = path.extname(imageUrl).toLowerCase();
        mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      } else {
        // Remote URL - use SSRF-protected fetch
        if (!isValidImageUrl(imageUrl)) {
          return NextResponse.json(
            { error: 'URL not allowed. Use Supabase Storage or approved image CDNs.' },
            { status: 400 }
          );
        }
        const { buffer, mimeType: fetchedMimeType } = await safeFetchImage(imageUrl);
        imageBase64 = buffer.toString('base64');
        mimeType = fetchedMimeType;
      }
    } else {
      return NextResponse.json(
        { error: 'Either file or imageUrl is required' },
        { status: 400 }
      );
    }

    console.log('[DETECT API] Starting product detection...');

    // Detect products with Moondream
    const result = await detectProducts(imageBase64, mimeType);

    console.log('[DETECT API] Detection complete:', result.totalCount, 'products found');

    return NextResponse.json(result);
  } catch (error) {
    console.error('[DETECT API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to detect products', details: String(error) },
      { status: 500 }
    );
  }
}
