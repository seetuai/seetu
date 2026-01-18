#!/usr/bin/env npx tsx
/**
 * Batch Worker Script
 * Run with: npx tsx src/scripts/start-batch-worker.ts
 */

import { startBatchWorker, stopBatchWorker } from '../lib/workers/batch-worker';

console.log('Starting Seetu Batch Worker...');
console.log('Press Ctrl+C to stop\n');

// Start the worker
startBatchWorker();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down worker...');
  await stopBatchWorker();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down worker...');
  await stopBatchWorker();
  process.exit(0);
});

// Keep the process running
process.stdin.resume();
