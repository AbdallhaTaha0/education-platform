/** A Common System PSSH can arrive with the init segment rather than the MPD. */
export function awaitsEncryptionInitData(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || !('code' in error) || !('message' in error)) return false;
  return error.code === 113 && typeof error.message === 'string' &&
    error.message.includes('no initData corresponding to that key system');
}
