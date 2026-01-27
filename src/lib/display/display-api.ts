import type {
  CurrentContentResponse,
  NextContentResponse,
  PlayedResponse,
  HeartbeatResponse,
} from './types';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries) {
        const delay = BASE_DELAY_MS * Math.pow(3, attempt); // 1s, 3s, 9s
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    'X-Billboard-Key': apiKey,
    'Content-Type': 'application/json',
  };
}

function apiBase(): string {
  // In the browser, use relative URLs
  return '/api/v1/display';
}

export function fetchCurrentContent(
  apiKey: string
): Promise<CurrentContentResponse> {
  return fetchWithRetry<CurrentContentResponse>(`${apiBase()}/current`, {
    method: 'GET',
    headers: buildHeaders(apiKey),
  });
}

export function fetchNextContent(
  apiKey: string
): Promise<NextContentResponse> {
  return fetchWithRetry<NextContentResponse>(`${apiBase()}/next`, {
    method: 'GET',
    headers: buildHeaders(apiKey),
  });
}

export function reportPlayed(
  apiKey: string,
  queueId: string,
  action: 'start' | 'complete'
): Promise<PlayedResponse> {
  return fetchWithRetry<PlayedResponse>(`${apiBase()}/played`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ queueId, action }),
  });
}

export function sendHeartbeat(
  apiKey: string,
  status: 'online' | 'offline' = 'online'
): Promise<HeartbeatResponse> {
  return fetchWithRetry<HeartbeatResponse>(
    `${apiBase()}/heartbeat`,
    {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({ status }),
    },
    1 // Only 1 retry for heartbeat - non-critical
  );
}
