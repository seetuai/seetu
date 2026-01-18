/**
 * Billboard Queue for Background Processing
 * Uses BullMQ with Redis for job management
 *
 * Handles:
 * - Content validation (FFprobe)
 * - Content moderation (Gemini)
 * - Content transcoding (FFmpeg)
 */

import { Queue, QueueEvents } from 'bullmq';
import { redis, isRedisConfigured } from '../redis';

// Queue names
export const BILLBOARD_QUEUES = {
  VALIDATION: 'seetu:billboard-validation',
  MODERATION: 'seetu:billboard-moderation',
  TRANSCODING: 'seetu:billboard-transcoding',
} as const;

// Job types
export type BillboardJobType = 'validation' | 'moderation' | 'transcoding';

export interface ValidationJobData {
  contentId: string;
  originalUrl: string;
  userId?: string;
  whatsappPhone?: string;
}

export interface ModerationJobData {
  contentId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  thumbnailUrl?: string;
}

export interface TranscodingJobData {
  contentId: string;
  originalUrl: string;
  mediaType: 'image' | 'video';
  targetWidth: number;
  targetHeight: number;
  addOverlay?: boolean;
  overlayPath?: string;
}

// In-memory fallback queues for development
const memoryQueues: Record<string, unknown[]> = {
  [BILLBOARD_QUEUES.VALIDATION]: [],
  [BILLBOARD_QUEUES.MODERATION]: [],
  [BILLBOARD_QUEUES.TRANSCODING]: [],
};

const memoryProcessors: Record<string, ((job: unknown) => Promise<void>)[]> = {
  [BILLBOARD_QUEUES.VALIDATION]: [],
  [BILLBOARD_QUEUES.MODERATION]: [],
  [BILLBOARD_QUEUES.TRANSCODING]: [],
};

// BullMQ queue instances (only if Redis is configured)
let validationQueue: Queue<ValidationJobData> | null = null;
let moderationQueue: Queue<ModerationJobData> | null = null;
let transcodingQueue: Queue<TranscodingJobData> | null = null;
let queueEvents: Record<string, QueueEvents> = {};

// Initialize queues if Redis is configured
if (isRedisConfigured() && redis) {
  const defaultJobOptions = {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
  };

  validationQueue = new Queue<ValidationJobData>(BILLBOARD_QUEUES.VALIDATION, {
    connection: redis,
    defaultJobOptions,
  });

  moderationQueue = new Queue<ModerationJobData>(BILLBOARD_QUEUES.MODERATION, {
    connection: redis,
    defaultJobOptions,
  });

  transcodingQueue = new Queue<TranscodingJobData>(BILLBOARD_QUEUES.TRANSCODING, {
    connection: redis,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 2, // Transcoding is expensive, fewer retries
    },
  });

  // Create queue events for monitoring
  queueEvents = {
    [BILLBOARD_QUEUES.VALIDATION]: new QueueEvents(BILLBOARD_QUEUES.VALIDATION, { connection: redis }),
    [BILLBOARD_QUEUES.MODERATION]: new QueueEvents(BILLBOARD_QUEUES.MODERATION, { connection: redis }),
    [BILLBOARD_QUEUES.TRANSCODING]: new QueueEvents(BILLBOARD_QUEUES.TRANSCODING, { connection: redis }),
  };
}

/**
 * Enqueue a validation job
 */
export async function enqueueValidation(data: ValidationJobData): Promise<string> {
  if (validationQueue) {
    const job = await validationQueue.add('validate', data, {
      jobId: `validate-${data.contentId}`,
    });
    console.log(`[BILLBOARD_QUEUE] Enqueued validation for ${data.contentId}`);
    return job.id || data.contentId;
  }

  // In-memory fallback
  memoryQueues[BILLBOARD_QUEUES.VALIDATION].push(data);
  processMemoryQueue(BILLBOARD_QUEUES.VALIDATION);
  return data.contentId;
}

/**
 * Enqueue a moderation job
 */
export async function enqueueModeration(data: ModerationJobData): Promise<string> {
  if (moderationQueue) {
    const job = await moderationQueue.add('moderate', data, {
      jobId: `moderate-${data.contentId}`,
    });
    console.log(`[BILLBOARD_QUEUE] Enqueued moderation for ${data.contentId}`);
    return job.id || data.contentId;
  }

  // In-memory fallback
  memoryQueues[BILLBOARD_QUEUES.MODERATION].push(data);
  processMemoryQueue(BILLBOARD_QUEUES.MODERATION);
  return data.contentId;
}

/**
 * Enqueue a transcoding job
 */
export async function enqueueTranscoding(data: TranscodingJobData): Promise<string> {
  if (transcodingQueue) {
    const job = await transcodingQueue.add('transcode', data, {
      jobId: `transcode-${data.contentId}`,
    });
    console.log(`[BILLBOARD_QUEUE] Enqueued transcoding for ${data.contentId}`);
    return job.id || data.contentId;
  }

  // In-memory fallback
  memoryQueues[BILLBOARD_QUEUES.TRANSCODING].push(data);
  processMemoryQueue(BILLBOARD_QUEUES.TRANSCODING);
  return data.contentId;
}

/**
 * Process memory queue items (for development)
 */
function processMemoryQueue(queueName: string): void {
  const processors = memoryProcessors[queueName];
  const queue = memoryQueues[queueName];

  if (processors.length > 0 && queue.length > 0) {
    setTimeout(async () => {
      const job = queue.shift();
      if (job) {
        try {
          await processors[0](job);
        } catch (error) {
          console.error(`[BILLBOARD_QUEUE] Memory processor error:`, error);
        }
      }
    }, 100);
  }
}

/**
 * Register memory processors for development
 */
export function registerMemoryProcessor(
  queueName: string,
  callback: (job: unknown) => Promise<void>
): void {
  if (!memoryProcessors[queueName]) {
    memoryProcessors[queueName] = [];
  }
  memoryProcessors[queueName].push(callback);
}

/**
 * Get queue instances
 */
export function getValidationQueue(): Queue<ValidationJobData> | null {
  return validationQueue;
}

export function getModerationQueue(): Queue<ModerationJobData> | null {
  return moderationQueue;
}

export function getTranscodingQueue(): Queue<TranscodingJobData> | null {
  return transcodingQueue;
}

/**
 * Get queue statistics for all billboard queues
 */
export async function getBillboardQueueStats(): Promise<{
  validation: { waiting: number; active: number; completed: number; failed: number };
  moderation: { waiting: number; active: number; completed: number; failed: number };
  transcoding: { waiting: number; active: number; completed: number; failed: number };
}> {
  const getStats = async (queue: Queue | null, memoryQueue: unknown[]) => {
    if (queue) {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);
      return { waiting, active, completed, failed };
    }
    return {
      waiting: memoryQueue.length,
      active: 0,
      completed: 0,
      failed: 0,
    };
  };

  const [validation, moderation, transcoding] = await Promise.all([
    getStats(validationQueue, memoryQueues[BILLBOARD_QUEUES.VALIDATION]),
    getStats(moderationQueue, memoryQueues[BILLBOARD_QUEUES.MODERATION]),
    getStats(transcodingQueue, memoryQueues[BILLBOARD_QUEUES.TRANSCODING]),
  ]);

  return { validation, moderation, transcoding };
}

/**
 * Clear all billboard queues (for testing/maintenance)
 */
export async function clearAllQueues(): Promise<void> {
  if (validationQueue) await validationQueue.obliterate({ force: true });
  if (moderationQueue) await moderationQueue.obliterate({ force: true });
  if (transcodingQueue) await transcodingQueue.obliterate({ force: true });

  // Clear memory queues
  memoryQueues[BILLBOARD_QUEUES.VALIDATION] = [];
  memoryQueues[BILLBOARD_QUEUES.MODERATION] = [];
  memoryQueues[BILLBOARD_QUEUES.TRANSCODING] = [];
}

/**
 * Pause all queues
 */
export async function pauseAllQueues(): Promise<void> {
  if (validationQueue) await validationQueue.pause();
  if (moderationQueue) await moderationQueue.pause();
  if (transcodingQueue) await transcodingQueue.pause();
}

/**
 * Resume all queues
 */
export async function resumeAllQueues(): Promise<void> {
  if (validationQueue) await validationQueue.resume();
  if (moderationQueue) await moderationQueue.resume();
  if (transcodingQueue) await transcodingQueue.resume();
}
