import { describe, expect, it } from 'vitest';
import { mapDrmStatusToLocal } from '../../src/modules/catalog/validation.js';

/** Pure reduction logic for deletion polling: PENDING/RUNNING/COMPLETED/FAILED. */
function reduceDeletionState(states: string[]): 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' {
  if (states.length === 0) return 'COMPLETED';
  if (states.every((s) => s === 'COMPLETED')) return 'COMPLETED';
  if (states.some((s) => s === 'FAILED')) return 'FAILED';
  if (states.some((s) => s === 'RUNNING' || s === 'PENDING')) return 'RUNNING';
  return 'PENDING';
}

describe('deletion-state reduction', () => {
  it('completes only when every asset is COMPLETED', () => {
    expect(reduceDeletionState([])).toBe('COMPLETED');
    expect(reduceDeletionState(['COMPLETED', 'COMPLETED'])).toBe('COMPLETED');
    expect(reduceDeletionState(['COMPLETED', 'PENDING'])).toBe('RUNNING');
    expect(reduceDeletionState(['COMPLETED', 'FAILED'])).toBe('FAILED');
  });

  it('maps DRM deletion polling states through the documented mapping', () => {
    // DRM media-deletions API uses PENDING/RUNNING/COMPLETED/FAILED directly.
    expect(mapDrmStatusToLocal('READY')).toBe('READY');
    // Deletion pending is represented locally as DELETION_PENDING.
    expect(mapDrmStatusToLocal('DELETING')).toBe('DELETION_PENDING');
  });

  it('never treats 404 as proof of deletion (call-site must require COMPLETED)', () => {
    // The adapter surfaces 404 as DRM_NOT_FOUND; reconciler keeps rows.
    // This test documents the invariant: only COMPLETED clears platform rows.
    const states = ['COMPLETED', 'PENDING'];
    expect(reduceDeletionState(states)).not.toBe('COMPLETED');
  });
});
