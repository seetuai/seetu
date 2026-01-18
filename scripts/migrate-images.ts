/**
 * Migrate local images to Supabase Storage
 * Run with: npx tsx scripts/migrate-images.ts
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const prisma = new PrismaClient();

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

async function uploadFile(localPath: string, bucket: string): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(localPath);
    const filename = path.basename(localPath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    // Create a unique path in storage
    const storagePath = `migrated/${Date.now()}-${filename}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error(`  Failed to upload ${filename}:`, error.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (err) {
    console.error(`  Error uploading ${localPath}:`, err);
    return null;
  }
}

async function migrateProducts() {
  console.log('\n📦 Migrating product images...\n');

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { originalUrl: { startsWith: '/uploads/' } },
        { thumbnailUrl: { startsWith: '/uploads/' } },
      ],
    },
  });

  console.log(`Found ${products.length} products with local images`);

  for (const product of products) {
    console.log(`\nProduct: ${product.name || product.id}`);

    let newOriginalUrl = product.originalUrl;
    let newThumbnailUrl = product.thumbnailUrl;

    if (product.originalUrl?.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), 'public', product.originalUrl);
      if (fs.existsSync(localPath)) {
        const url = await uploadFile(localPath, 'uploads');
        if (url) {
          newOriginalUrl = url;
          console.log(`  ✓ Original: ${url}`);
        }
      } else {
        console.log(`  ✗ Original file not found: ${localPath}`);
      }
    }

    if (product.thumbnailUrl?.startsWith('/uploads/') && product.thumbnailUrl !== product.originalUrl) {
      const localPath = path.join(process.cwd(), 'public', product.thumbnailUrl);
      if (fs.existsSync(localPath)) {
        const url = await uploadFile(localPath, 'uploads');
        if (url) {
          newThumbnailUrl = url;
          console.log(`  ✓ Thumbnail: ${url}`);
        }
      }
    } else if (newOriginalUrl !== product.originalUrl) {
      newThumbnailUrl = newOriginalUrl;
    }

    if (newOriginalUrl !== product.originalUrl || newThumbnailUrl !== product.thumbnailUrl) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          originalUrl: newOriginalUrl,
          thumbnailUrl: newThumbnailUrl,
        },
      });
      console.log(`  ✓ Database updated`);
    }
  }
}

async function migrateStudioSessions() {
  console.log('\n🎨 Migrating studio session images...\n');

  const sessions = await prisma.studioSession.findMany({
    where: {
      generatedUrls: { isEmpty: false },
    },
  });

  console.log(`Found ${sessions.length} studio sessions to check`);

  for (const session of sessions) {
    const urls = session.generatedUrls as string[];
    const localUrls = urls.filter(u => u.startsWith('/uploads/'));

    if (localUrls.length === 0) continue;

    console.log(`\nSession: ${session.id}`);
    const newUrls: string[] = [];

    for (const url of urls) {
      if (url.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), 'public', url);
        if (fs.existsSync(localPath)) {
          const newUrl = await uploadFile(localPath, 'generated');
          if (newUrl) {
            newUrls.push(newUrl);
            console.log(`  ✓ ${path.basename(url)} -> Supabase`);
          } else {
            newUrls.push(url); // Keep original if upload fails
          }
        } else {
          console.log(`  ✗ File not found: ${url}`);
          newUrls.push(url);
        }
      } else {
        newUrls.push(url); // Keep non-local URLs
      }
    }

    await prisma.studioSession.update({
      where: { id: session.id },
      data: { generatedUrls: newUrls },
    });
    console.log(`  ✓ Database updated`);
  }
}

async function migrateGenerationJobs() {
  console.log('\n🖼️ Migrating generation job images...\n');

  const jobs = await prisma.generationJob.findMany({
    where: {
      outputUrl: { startsWith: '/uploads/' },
    },
  });

  console.log(`Found ${jobs.length} generation jobs with local images`);

  for (const job of jobs) {
    console.log(`\nJob: ${job.id}`);

    if (job.outputUrl?.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), 'public', job.outputUrl);
      if (fs.existsSync(localPath)) {
        const url = await uploadFile(localPath, 'generated');
        if (url) {
          await prisma.generationJob.update({
            where: { id: job.id },
            data: { outputUrl: url },
          });
          console.log(`  ✓ Migrated: ${url}`);
        }
      } else {
        console.log(`  ✗ File not found: ${localPath}`);
      }
    }
  }
}

async function main() {
  console.log('🚀 Starting image migration to Supabase Storage...\n');

  await migrateProducts();
  await migrateStudioSessions();
  await migrateGenerationJobs();

  console.log('\n✅ Migration complete!');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
