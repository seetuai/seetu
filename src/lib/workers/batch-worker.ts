/**
 * Batch Worker
 * Processes batch generation jobs from the queue
 */

import { Worker, Job } from 'bullmq';
import { redis, isRedisConfigured } from '../redis';
import { QUEUE_NAME, type BatchJobData, registerMemoryProcessor } from '../queues/batch-queue';
import {
  startBatchProcessing,
  markGenerationProcessing,
  completeGeneration,
  failGeneration,
  debitBatchGenerationCredits,
  getBatchJobWithGenerations,
  type BatchStyleSettings,
} from '../batch-processor';
import { generateSingleImage, buildBriefFromProduct } from '../generation-core';
import { getPresetById, getCampaignMoodboardNote } from '../batch-presets';
import prisma from '../prisma';

// ═══════════════════════════════════════════════════════════════
// WORKER PROCESSOR
// ═══════════════════════════════════════════════════════════════

/**
 * Process a batch job
 */
async function processBatchJob(job: Job<BatchJobData> | BatchJobData): Promise<void> {
  const data = 'data' in job ? job.data : job;
  const { batchJobId, userId, presetId } = data;

  console.log(`[BATCH_WORKER] Starting batch job: ${batchJobId}`);

  try {
    // Get the batch job with all generations
    const batchJob = await getBatchJobWithGenerations(batchJobId);
    if (!batchJob) {
      console.error(`[BATCH_WORKER] Batch job not found: ${batchJobId}`);
      return;
    }

    // Get preset if specified
    const preset = presetId ? getPresetById(presetId) : undefined;
    const moodboardNote = presetId ? getCampaignMoodboardNote(presetId) : undefined;

    // Start processing
    const generations = await startBatchProcessing(batchJobId);
    console.log(`[BATCH_WORKER] Processing ${generations.length} generations`);

    // Get user's default brand for style
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        brands: {
          where: { isDefault: true },
          take: 1,
        },
      },
    });
    const defaultBrandId = user?.brands[0]?.id;

    // Process each generation sequentially
    for (const generation of generations) {
      const product = generation.product;
      if (!product) {
        await failGeneration(generation.id, 'Product not found');
        continue;
      }

      console.log(`[BATCH_WORKER] Processing product: ${product.name || product.id}`);

      try {
        // Mark as processing
        await markGenerationProcessing(generation.id);

        // Build brief from product and style settings
        const styleSettings = batchJob.styleSettings as BatchStyleSettings | null;

        // Use preset settings if available, otherwise use job settings
        const finalSettings: BatchStyleSettings = preset?.settings || styleSettings || {
          presentation: 'product_only',
          sceneType: 'studio',
        };

        const brief = buildBriefFromProduct(
          product,
          finalSettings,
          defaultBrandId
        );

        // Add moodboard note for campaign presets
        if (moodboardNote) {
          brief.moodboard.note = moodboardNote;
        }

        // Debit credits before generation
        const creditSuccess = await debitBatchGenerationCredits(
          userId,
          generation.id,
          batchJobId
        );

        if (!creditSuccess) {
          await failGeneration(generation.id, 'Insufficient credits');
          console.log(`[BATCH_WORKER] Insufficient credits, stopping batch`);
          break; // Stop processing if credits run out
        }

        // Generate image
        const result = await generateSingleImage({
          brief,
          userId,
          brandId: defaultBrandId,
        });

        if (result.success && result.outputUrl) {
          await completeGeneration(generation.id, result.outputUrl, result.caption);
          console.log(`[BATCH_WORKER] Generation completed: ${generation.id}`);
        } else {
          await failGeneration(generation.id, result.error || 'Generation failed');
          console.log(`[BATCH_WORKER] Generation failed: ${result.error}`);
        }

        // Rate limit: wait between generations
        await sleep(2000);
      } catch (error) {
        console.error(`[BATCH_WORKER] Error processing generation:`, error);
        await failGeneration(
          generation.id,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    console.log(`[BATCH_WORKER] Batch job completed: ${batchJobId}`);
  } catch (error) {
    console.error(`[BATCH_WORKER] Batch job failed:`, error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// WORKER SETUP
// ═══════════════════════════════════════════════════════════════

let worker: Worker<BatchJobData> | null = null;

/**
 * Start the batch worker
 */
export function startBatchWorker(): void {
  if (isRedisConfigured() && redis) {
    worker = new Worker<BatchJobData>(
      QUEUE_NAME,
      async (job) => {
        await processBatchJob(job);
      },
      {
        connection: redis,
        concurrency: 1, // Process one job at a time
      }
    );

    worker.on('completed', (job) => {
      console.log(`[BATCH_WORKER] Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
      console.error(`[BATCH_WORKER] Job ${job?.id} failed:`, error);
    });

    console.log('[BATCH_WORKER] Worker started with Redis');
  } else {
    // Register in-memory processor for development
    registerMemoryProcessor(processBatchJob);
    console.log('[BATCH_WORKER] Worker started with in-memory queue');
  }
}

/**
 * Stop the batch worker
 */
export async function stopBatchWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[BATCH_WORKER] Worker stopped');
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { processBatchJob };
