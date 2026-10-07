import { afterEach, describe, expect, it, vi } from 'vitest';
import { FINAL_VIEW_FLUSH_WAIT_MS, finishAfterViewFlush } from './finalViewFlush';

afterEach(() => vi.useRealTimers());

describe('final view flush', () => {
  it('flushes before ending when tracking responds', async () => {
    const order: string[] = [];
    await finishAfterViewFlush(async () => { order.push('flush'); }, () => { order.push('end'); }, () => true);
    expect(order).toEqual(['flush', 'end']);
  });

  it('ends when tracking fails', async () => {
    const finish = vi.fn();
    await finishAfterViewFlush(async () => { throw new Error('offline'); }, finish, () => true);
    expect(finish).toHaveBeenCalledOnce();
  });

  it('ends after a bounded wait and ignores a later response', async () => {
    vi.useFakeTimers();
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const finish = vi.fn();
    const task = finishAfterViewFlush(() => pending, finish, () => true);
    await vi.advanceTimersByTimeAsync(FINAL_VIEW_FLUSH_WAIT_MS - 1);
    expect(finish).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await task;
    expect(finish).toHaveBeenCalledOnce();
    resolve();
    await Promise.resolve();
    expect(finish).toHaveBeenCalledOnce();
  });

  it('does not end a newer grant or an unmounted player', async () => {
    let resolve!: () => void;
    let current = true;
    const finish = vi.fn();
    const task = finishAfterViewFlush(() => new Promise<void>((done) => { resolve = done; }), finish, () => current);
    await Promise.resolve();
    current = false;
    resolve();
    await task;
    expect(finish).not.toHaveBeenCalled();
  });
});
