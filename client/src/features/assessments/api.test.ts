import { describe, expect, it } from 'vitest';
import { ApiError } from '../../auth';
import { errorLabel } from './api';

describe('assessment access guidance', () => {
  it.each([true, false])('explains renewal after denied expiry (Arabic=%s)', ar => {
    const message = errorLabel(new ApiError(403, 'SUBSCRIPTION_EXPIRED', 'internal'), ar);
    expect(message).toContain(ar ? 'تجديد' : 'renew');
    expect(message).toContain(ar ? 'تعلّمي' : 'My learning');
    expect(message).not.toContain('internal');
  });
  it('keeps unexpected failures distinct from renewal', () => {
    expect(errorLabel(new Error('private'), false)).toBe('Request failed. Keep your work and retry.');
  });
});
