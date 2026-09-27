import { describe, expect, it } from 'vitest';
import { describeDrmConnection } from '../../src/infra/drm.js';

describe('describeDrmConnection', () => {
  it('reports unconfigured when no base URL is set', () => {
    const status = describeDrmConnection({});
    expect(status.mode).toBe('optional-external');
    expect(status.configured).toBe(false);
    expect(status.baseUrlHost).toBeUndefined();
  });

  it('reports host only (no secrets) when configured', () => {
    const status = describeDrmConnection({
      DRM_BASE_URL: 'https://drm.internal.example:8443/api',
      DRM_CLIENT_SECRET: 'super-secret',
    });
    expect(status.configured).toBe(true);
    expect(status.baseUrlHost).toBe('drm.internal.example:8443');
    expect(JSON.stringify(status)).not.toContain('super-secret');
  });
});
