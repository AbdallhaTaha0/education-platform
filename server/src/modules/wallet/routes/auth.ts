import type { Request } from 'express';

/** Authenticated actor id, set by the identity requireAuth middleware. */
export function authOf(req: Request): { userId: string } {
  const auth = (req as unknown as { auth?: { userId: string } }).auth;
  if (auth === undefined || typeof auth.userId !== 'string')
    throw new Error('missing auth context');
  return { userId: auth.userId };
}
