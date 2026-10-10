/** Only purchase routes can be restored; never accept an external redirect. */
export function purchaseLoginHash(planId: string): string {
  return `#/login?next=${encodeURIComponent(`#/purchase/${encodeURIComponent(planId)}`)}`;
}

export function purchaseAfterLogin(hash: string): string {
  const next = new URLSearchParams(hash.split('?')[1] ?? '').get('next');
  return next && /^#\/purchase\/[^/?#]+$/.test(next) ? next : '#/account';
}
