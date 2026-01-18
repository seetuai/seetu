/**
 * Batch Queue for Background Processing
 * Uses BullMQ with Redis for job management
 */

import { Queue, QueueEvents } from 'bullmq';
import { redis, isRedisConfigured } from '../redis';

// Queue configuration
const QUEUE_NAME = 'seetu:batch-generation';

export interface BatchJobData {
  batchJobId: string;
  userId: string;
  presetId?: string;
}

// In-memory fallback queue for development
const memoryQueue: BatchJobData[] = [];
const memoryCallbacks: ((job: BatchJobData) => Promise<void>)[] = [];

// BullMQ queue instance (only if Redis is configured)
let batchQueue: Queue<BatchJobData> | null = null;
let queueEvents: QueueEvents | null = null;

if (isRedisConfigured() && redis) {
  batchQueue = new Queue<BatchJobData>(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  queueEvents = new QueueEvents(QUEUE_NAME, { connection: redis });
}

/**
 * Add a batch job to the queue
 */
export async function enqueueBatchJob(data: BatchJobData): Promise<string> {
  if (batchQueue) {
    const job = await batchQueue.add('process-batch', data, {
      jobId: `batch-${data.batchJobId}`,
    });
    console.log(`[BATCH_QUEUE] Enqueued job ${job.id} for batch ${data.batchJobId}`);
    return job.id || data.batchJobId;
  }

  // In-memory fallback for development
  memoryQueue.push(data);
  console.log(`[BATCH_QUEUE] Added to memory queue: ${data.batchJobId}`);

  // Process immediately in dev mode if callback registered
  if (memoryCallbacks.length > 0) {
    setTimeout(() => {
      const job = memoryQueue.shift();
      if (job) {
        memoryCallbacks[0](job).catch(console.error);
      }
    }, 100);
  }

  return data.batchJobId;
}

/**
 * Register a processor for the memory queue (dev mode)
 */
export function registerMemoryProcessor(callback: (job: BatchJobData) => Promise<void>): void {
  memoryCallbacks.push(callback);
}

/**
 * Get the BullMQ queue instance (null if Redis not configured)
 */
export function getBatchQueue(): Queue<BatchJobData> | null {
  return batchQueue;
}

/**
 * Get queue statistics
 */
export async function getBatchQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  if (batchQueue) {
    const [waiting, active, completed, failed] = await Promise.all([
      batchQueue.getWaitingCount(),
      batchQueue.getActiveCount(),
      batchQueue.getCompletedCount(),
      batchQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  // In-memory stats
  return {
    waiting: memoryQueue.length,
    active: 0,
    completed: 0,
    failed: 0,
  };
}

export { QUEUE_NAME };
