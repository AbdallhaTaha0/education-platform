import type { NextFunction, Request, Response } from 'express';
import type { CatalogRouteContext } from '../types.js';

export function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

export function ctxOf(req: Request): CatalogRouteContext {
  return req.app.get('catalog') as CatalogRouteContext;
}

export function authOf(req: Request): { userId: string } {
  const auth = (req as unknown as { auth?: { userId: string } }).auth;
  if (auth === undefined) throw new Error('missing auth context');
  return { userId: auth.userId };
}
