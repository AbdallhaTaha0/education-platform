import { describe, expect, it } from 'vitest';
import { mergeProgress } from './merge';
describe('out-of-order saved progress', () => {
  it('preserves completion and furthest position when an older response arrives late', () => {
    const completed = { lessonId: 'one', positionSeconds: 20, durationSeconds: 20, completed: true };
    expect(mergeProgress(completed, { ...completed, positionSeconds: 5, durationSeconds: null, completed: false })).toEqual(completed);
  });
  it('keeps lesson bindings independent', () => {
    const next = { lessonId: 'two', positionSeconds: 2, durationSeconds: null, completed: false };
    expect(mergeProgress({ ...next, lessonId: 'one', positionSeconds: 20, completed: true }, next)).toEqual(next);
  });
});
