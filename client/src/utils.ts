/**
 * Client-generated retry identity (the server owns the outcome).
 * Uniqueness is what matters, not secrecy: fall back to Math.random where
 * SubtleCrypto is unavailable (plain-HTTP hosts are not secure contexts).
 */
export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fall through to the non-crypto fallback below.
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}
