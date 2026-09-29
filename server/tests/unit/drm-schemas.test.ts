import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/modules/identity/errors.js';
import {
  validateDeletionRequestResponse,
  validateDeletionStatusResponse,
  validateMediaStatusResponse,
  validateRegistrationResponse,
} from '../../src/modules/catalog/drm/schemas.js';

function expectMalformed(fn: () => unknown): void {
  try {
    fn();
  } catch (err) {
    expect(err instanceof ApiError && err.code === 'DRM_MALFORMED').toBe(true);
    return;
  }
  expect.unreachable('expected DRM_MALFORMED');
}

const UUID = '11111111-1111-4111-8111-111111111111';
const DEL_UUID = '22222222-2222-4222-8222-222222222222';

describe('DRM response schemas', () => {
  it('accepts valid registration with UUIDs, known status, and https upload URL', () => {
    expect(
      validateRegistrationResponse({ assetId: UUID, status: 'UPLOADED', uploadUrl: 'https://cdn.example/u?x=1', idempotent: false }),
    ).toMatchObject({ assetId: UUID, status: 'UPLOADED' });
  });

  it('rejects non-UUID asset/deletion ids', () => {
    expectMalformed(() => validateRegistrationResponse({ assetId: 'not-a-uuid', status: 'UPLOADED' }));
    expectMalformed(() => validateDeletionRequestResponse({ deletionId: 'bad', status: 'PENDING' }));
  });

  it('rejects unknown statuses', () => {
    expectMalformed(() => validateRegistrationResponse({ assetId: UUID, status: 'QUANTUM' }));
    expectMalformed(() => validateMediaStatusResponse({ status: 'NOPE' }));
    expectMalformed(() => validateDeletionStatusResponse({ status: 'VANISHED' }));
  });

  it('rejects missing required fields and wrong types', () => {
    expectMalformed(() => validateRegistrationResponse({ status: 'UPLOADED' }));
    expectMalformed(() => validateRegistrationResponse({ assetId: UUID, status: 'UPLOADED', idempotent: 'yes' }));
  });

  it('rejects empty, unsafe, and non-http upload URLs', () => {
    expectMalformed(() => validateRegistrationResponse({ assetId: UUID, status: 'UPLOADED', uploadUrl: '' }));
    expectMalformed(() => validateRegistrationResponse({ assetId: UUID, status: 'UPLOADED', uploadUrl: 'ftp://x.example/u' }));
    expectMalformed(() => validateRegistrationResponse({ assetId: UUID, status: 'UPLOADED', uploadUrl: 'https://user:pass@x.example/u' }));
    expect(validateDeletionRequestResponse({ deletionId: DEL_UUID, status: 'PENDING' }).deletionId).toBe(DEL_UUID);
  });
});
