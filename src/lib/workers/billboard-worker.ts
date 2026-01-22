/**
 * Billboard Worker
 * Processes billboard content through the validation, moderation, and transcoding pipeline
 */

import { Worker, Job } from 'bullmq';
import { redis, isRedisConfigured } from '../redis';
import {
  BILLBOARD_QUEUES,
  type ValidationJobData,
  type ModerationJobData,
  type TranscodingJobData,
  registerMemoryProcessor,
  enqueueModeration,
  enqueueTranscoding,
} from '../queues/billboard-queue';
import { validateMedia } from '../billboard/validation';
import { moderateImage, moderateVideo } from '../billboard/moderation';
import { transcodeVideo, imageToVideo as ffmpegImageToVideo, RESOLUTIONS } from '../billboard/transcoding';
import { uploadBillboardMedia, imageToVideo as cloudinaryImageToVideo, isCloudinaryConfigured } from '../cloudinary';
import { prisma } from '../prisma';
import { ContentStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════
// VALIDATION WORKER
// ═══════════════════════════════════════════════════════════════

/**
 * Process validation job
 */
async function processValidation(
  job: Job<ValidationJobData> | ValidationJobData
): Promise<void> {
  const data = 'data' in job ? job.data : job;
  const { contentId, originalUrl } = data;

  console.log(`[BILLBOARD_WORKER] Validating content: ${contentId}`);

  try {
    // Run validation
    const result = await validateMedia(originalUrl);

    if (!result.valid) {
      // Mark as rejected
      await prisma.billboardContent.update({
        where: { id: contentId },
        data: {
          status: 'rejected',
          rejectionReason: result.errors.join('; '),
          mediaMetadata: result.metadata ? JSON.parse(JSON.stringify(result.metadata)) : undefined,
        },
      });
      console.log(`[BILLBOARD_WORKER] Content rejected: ${result.errors.join('; ')}`);
      return;
    }

    // Update with metadata and move to moderation
    await prisma.billboardContent.update({
      where: { id: contentId },
      data: {
        status: 'pending_moderation',
        mediaType: result.mediaType || 'image',
        durationSeconds: result.metadata?.duration
          ? Math.round(result.metadata.duration)
          : null,
        mediaMetadata: result.metadata ? JSON.parse(JSON.stringify(result.metadata)) : undefined,
      },
    });

    // Enqueue moderation job
    await enqueueModeration({
      contentId,
      mediaUrl: originalUrl,
      mediaType: result.mediaType || 'image',
    });

    console.log(`[BILLBOARD_WORKER] Validation passed, queued for moderation: ${contentId}`);
  } catch (error) {
    console.error(`[BILLBOARD_WORKER] Validation error:`, error);

    await prisma.billboardContent.update({
      where: { id: contentId },
      data: {
        status: 'rejected',
        rejectionReason: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// MODERATION WORKER
// ═══════════════════════════════════════════════════════════════

/**
 * Process moderation job
 */
async function processModeration(
  job: Job<ModerationJobData> | ModerationJobData
): Promise<void> {
  const data = 'data' in job ? job.data : job;
  const { contentId, mediaUrl, mediaType, thumbnailUrl } = data;

  console.log(`[BILLBOARD_WORKER] Moderating content: ${contentId}`);

  try {
    // Run moderation based on media type
    const result =
      mediaType === 'video'
        ? await moderateVideo(mediaUrl, thumbnailUrl)
        : await moderateImage(mediaUrl);

    // Store moderation result
    await prisma.billboardContent.update({
      where: { id: contentId },
      data: {
        moderationResult: JSON.parse(JSON.stringify({
          approved: result.approved,
          categories: result.categories,
          overallRisk: result.overallRisk,
          reviewRequired: result.reviewRequired,
        })),
      },
    });

    if (!result.approved && !result.reviewRequired) {
      // Auto-rejected
      await prisma.billboardContent.update({
        where: { id: contentId },
        data: {
          status: 'rejected',
          rejectionReason: result.rejectionReason || 'Content violates community guidelines',
        },
      });
      console.log(`[BILLBOARD_WORKER] Content auto-rejected: ${result.rejectionReason}`);
      return;
    }

    if (result.reviewRequired) {
      // Needs manual review - keep in pending_moderation
      console.log(`[BILLBOARD_WORKER] Content flagged for manual review: ${contentId}`);
      return;
    }

    // Moderation passed, move to payment pending
    await prisma.billboardContent.update({
      where: { id: contentId },
      data: {
        status: 'pending_payment',
      },
    });

    console.log(`[BILLBOARD_WORKER] Moderation passed, awaiting payment: ${contentId}`);
  } catch (error) {
    console.error(`[BILLBOARD_WORKER] Moderation error:`, error);

    // Flag for manual review on error
    await prisma.billboardContent.update({
      where: { id: contentId },
      data: {
        moderationResult: {
          error: error instanceof Error ? error.message : 'Unknown error',
          reviewRequired: true,
        },
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// TRANSCODING WORKER
// ═══════════════════════════════════════════════════════════════

/**
 * Process transcoding job
 */
async function processTranscoding(
  job: Job<TranscodingJobData> | TranscodingJobData
): Promise<void> {
  const data = 'data' in job ? job.data : job;
  const {
    contentId,
    originalUrl,
    mediaType,
    targetWidth,
    targetHeight,
  } = data;

  console.log(`[BILLBOARD_WORKER] Transcoding content: ${contentId}`);

  try {
    // Update status to processing
    await prisma.billboardContent.update({
      where: { id: contentId },
      data: { status: 'processing' },
    });

    // Try Cloudinary first (recommended for production)
    if (isCloudinaryConfigured()) {
      console.log(`[BILLBOARD_WORKER] Using Cloudinary for processing: ${contentId}`);

      let result;
      if (mediaType === 'video') {
        result = await uploadBillboardMedia(originalUrl, {
          contentId,
          mediaType: 'video',
          targetWidth,
          targetHeight,
        });
      } else {
        // For images, use Cloudinary's image processing
        result = await uploadBillboardMedia(originalUrl, {
          contentId,
          mediaType: 'image',
          targetWidth,
          targetHeight,
        });
      }

      if (result.success) {
        await prisma.billboardContent.update({
          where: { id: contentId },
          data: {
            status: 'ready',
            processedUrls: {
              url: result.secureUrl,
              thumbnail: result.thumbnailUrl,
              publicId: result.publicId,
            },
            durationSeconds: result.duration ? Math.round(result.duration) : (mediaType === 'video' ? 30 : 10),
          },
        });

        console.log(`[BILLBOARD_WORKER] Cloudinary processing complete: ${contentId}`);
        return;
      }

      console.warn(`[BILLBOARD_WORKER] Cloudinary failed, trying fallback: ${result.error}`);
    }

    // Fallback: Check if FFmpeg is available locally
    const ffmpegAvailable = await checkFfmpeg();

    if (ffmpegAvailable) {
      console.log(`[BILLBOARD_WORKER] Using FFmpeg for processing: ${contentId}`);

      let result;
      if (mediaType === 'video') {
        result = await transcodeVideo(originalUrl, {
          targetWidth,
          targetHeight,
          generateThumbnail: true,
        });
      } else {
        result = await ffmpegImageToVideo(
          originalUrl,
          {
            targetWidth,
            targetHeight,
            generateThumbnail: true,
          },
          10
        );
      }

      if (result.success) {
        await prisma.billboardContent.update({
          where: { id: contentId },
          data: {
            status: 'ready',
            processedUrls: {
              mp4: result.videoUrl,
              thumbnail: result.thumbnailUrl,
            },
            durationSeconds: result.duration ? Math.round(result.duration) : 10,
          },
        });

        console.log(`[BILLBOARD_WORKER] FFmpeg transcoding complete: ${contentId}`);
        return;
      }

      console.warn(`[BILLBOARD_WORKER] FFmpeg failed: ${result.error}`);
    }

    // Final fallback: use original file as-is
    console.log(`[BILLBOARD_WORKER] No processing available, using original file: ${contentId}`);

    await prisma.billboardContent.update({
      where: { id: contentId },
      data: {
        status: 'ready',
        processedUrls: {
          original: originalUrl,
          thumbnail: originalUrl,
        },
        durationSeconds: mediaType === 'video' ? 30 : 10,
      },
    });

    console.log(`[BILLBOARD_WORKER] Content ready (no processing): ${contentId}`);
  } catch (error) {
    console.error(`[BILLBOARD_WORKER] Transcoding error:`, error);

    // If all processing fails, still mark as ready with original file
    console.log(`[BILLBOARD_WORKER] Falling back to original file: ${contentId}`);

    await prisma.billboardContent.update({
      where: { id: contentId },
      data: {
        status: 'ready',
        processedUrls: {
          original: originalUrl,
          thumbnail: originalUrl,
        },
        durationSeconds: mediaType === 'video' ? 30 : 10,
      },
    });
  }
}

/**
 * Check if FFmpeg is available
 */
async function checkFfmpeg(): Promise<boolean> {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// WORKER SETUP
// ═══════════════════════════════════════════════════════════════

let validationWorker: Worker<ValidationJobData> | null = null;
let moderationWorker: Worker<ModerationJobData> | null = null;
let transcodingWorker: Worker<TranscodingJobData> | null = null;

/**
 * Start all billboard workers
 */
export function startBillboardWorkers(): void {
  if (isRedisConfigured() && redis) {
    // Validation worker
    validationWorker = new Worker<ValidationJobData>(
      BILLBOARD_QUEUES.VALIDATION,
      async (job) => {
        await processValidation(job);
      },
      {
        connection: redis,
        concurrency: 3, // Can run multiple validations in parallel
      }
    );

    validationWorker.on('completed', (job) => {
      console.log(`[BILLBOARD_WORKER] Validation job ${job.id} completed`);
    });

    validationWorker.on('failed', (job, error) => {
      console.error(`[BILLBOARD_WORKER] Validation job ${job?.id} failed:`, error);
    });

    // Moderation worker
    moderationWorker = new Worker<ModerationJobData>(
      BILLBOARD_QUEUES.MODERATION,
      async (job) => {
        await processModeration(job);
      },
      {
        connection: redis,
        concurrency: 2, // Limited by Gemini API rate limits
      }
    );

    moderationWorker.on('completed', (job) => {
      console.log(`[BILLBOARD_WORKER] Moderation job ${job.id} completed`);
    });

    moderationWorker.on('failed', (job, error) => {
      console.error(`[BILLBOARD_WORKER] Moderation job ${job?.id} failed:`, error);
    });

    // Transcoding worker
    transcodingWorker = new Worker<TranscodingJobData>(
      BILLBOARD_QUEUES.TRANSCODING,
      async (job) => {
        await processTranscoding(job);
      },
      {
        connection: redis,
        concurrency: 1, // Transcoding is CPU-intensive, one at a time
      }
    );

    transcodingWorker.on('completed', (job) => {
      console.log(`[BILLBOARD_WORKER] Transcoding job ${job.id} completed`);
    });

    transcodingWorker.on('failed', (job, error) => {
      console.error(`[BILLBOARD_WORKER] Transcoding job ${job?.id} failed:`, error);
    });

    console.log('[BILLBOARD_WORKER] All workers started with Redis');
  } else {
    // Register in-memory processors for development
    registerMemoryProcessor(BILLBOARD_QUEUES.VALIDATION, (job) => processValidation(job as ValidationJobData));
    registerMemoryProcessor(BILLBOARD_QUEUES.MODERATION, (job) => processModeration(job as ModerationJobData));
    registerMemoryProcessor(BILLBOARD_QUEUES.TRANSCODING, (job) => processTranscoding(job as TranscodingJobData));
    console.log('[BILLBOARD_WORKER] Workers started with in-memory queue');
  }
}

/**
 * Stop all billboard workers
 */
export async function stopBillboardWorkers(): Promise<void> {
  const stops: Promise<void>[] = [];

  if (validationWorker) {
    stops.push(validationWorker.close());
    validationWorker = null;
  }
  if (moderationWorker) {
    stops.push(moderationWorker.close());
    moderationWorker = null;
  }
  if (transcodingWorker) {
    stops.push(transcodingWorker.close());
    transcodingWorker = null;
  }

  await Promise.all(stops);
  console.log('[BILLBOARD_WORKER] All workers stopped');
}

/**
 * Start transcoding for a content item (called after payment)
 */
export async function startContentTranscoding(
  contentId: string,
  billboardIds: string[]
): Promise<void> {
  // Get content and first billboard for resolution
  const content = await prisma.billboardContent.findUnique({
    where: { id: contentId },
    select: {
      originalUrl: true,
      mediaType: true,
    },
  });

  if (!content) {
    throw new Error('Content not found');
  }

  // Get target resolution from first billboard (or use default HD)
  const billboard = await prisma.billboard.findFirst({
    where: { id: { in: billboardIds } },
    select: {
      resolutionWidth: true,
      resolutionHeight: true,
    },
  });

  const targetWidth = billboard?.resolutionWidth || RESOLUTIONS.LANDSCAPE_HD.width;
  const targetHeight = billboard?.resolutionHeight || RESOLUTIONS.LANDSCAPE_HD.height;

  // Enqueue transcoding job
  await enqueueTranscoding({
    contentId,
    originalUrl: content.originalUrl,
    mediaType: content.mediaType as 'image' | 'video',
    targetWidth,
    targetHeight,
    addOverlay: true, // Always add Seetu frame
    overlayPath: process.env.SEETU_FRAME_OVERLAY_PATH,
  });
}

// Export processors for testing
export {
  processValidation,
  processModeration,
  processTranscoding,
};
