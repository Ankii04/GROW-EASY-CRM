/** Split an array into chunks of at most `size` items. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be >= 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Run async tasks with a maximum number of them in flight at once.
 * Results are reported through the per-task callback as soon as each task
 * settles, which is what lets the API stream progress incrementally.
 */
export async function runPool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  onSettled?: (result: PromiseSettledResult<T>, index: number) => void,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const index = next++;
      try {
        const value = await tasks[index]();
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
      onSettled?.(results[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Rate-limit (429) responses need to outwait the provider's per-minute window,
 * not the normal backoff curve — retrying after a few seconds just burns more
 * quota while the limit is still active.
 */
const RATE_LIMIT_DELAY_MS = 30_000;

function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 429
  );
}

/** Retry an async function with exponential backoff + jitter. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries, baseDelayMs = 800, maxDelayMs = 8000, onRetry }: RetryOptions,
): Promise<{ value: T; attempts: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return { value: await fn(), attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt > retries) break;
      onRetry?.(attempt, error);
      const backoff = isRateLimitError(error)
        ? RATE_LIMIT_DELAY_MS * attempt
        : Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const delay = backoff * (0.75 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
