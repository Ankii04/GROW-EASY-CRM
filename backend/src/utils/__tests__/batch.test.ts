import { describe, expect, it, vi } from 'vitest';
import { chunk, runPool, withRetry } from '../batch.js';

describe('chunk', () => {
  it('splits arrays into fixed-size batches with a smaller tail', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe('runPool', () => {
  it('never runs more tasks than the concurrency limit at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 8 }, (_, i) => async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return i;
    });
    const results = await runPool(tasks, 3);
    expect(peak).toBeLessThanOrEqual(3);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('reports failures without aborting the other tasks', async () => {
    const settled: string[] = [];
    const tasks = [
      async () => 'ok',
      async () => {
        throw new Error('boom');
      },
      async () => 'ok2',
    ];
    await runPool(tasks, 2, (r) => settled.push(r.status));
    expect(settled.filter((s) => s === 'rejected')).toHaveLength(1);
    expect(settled.filter((s) => s === 'fulfilled')).toHaveLength(2);
  });
});

describe('withRetry', () => {
  it('retries until success and reports the attempt count', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('transient');
      return 'done';
    });
    const { value, attempts } = await withRetry(fn, { retries: 3, baseDelayMs: 1 });
    expect(value).toBe('done');
    expect(attempts).toBe(3);
  });

  it('throws the last error once retries are exhausted', async () => {
    const fn = vi.fn(async () => {
      throw new Error('permanent');
    });
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
