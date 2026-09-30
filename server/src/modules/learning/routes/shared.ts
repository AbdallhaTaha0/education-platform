/** Route-context plumbing shared by the learning routers. */
import type { Request, Response, NextFunction } from 'express';
import type { LearningRouteContext } from '../types.js';
import { LearningError } from '../errors.js';
import type { DrmClient } from '../../catalog/drmClient.js';
import type { PlaybackDeps } from '../playback/service.js';

export type { LearningRouteContext };

/** Wrap an async handler so learning errors reach the shared error handler. */
export function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function ctxOf(req: Request): LearningRouteContext {
  return req.app.get('learning') as LearningRouteContext;
}

/** Only a STUDENT may use protected learning routes. ADMIN is not a student
 * and does not inherit any entitlement. */
export function studentOf(req: Request): { userId: string } {
  const auth = req.auth;
  if (!auth) throw new LearningError('FORBIDDEN');
  if (auth.role !== 'STUDENT') {
    throw new LearningError('FORBIDDEN', 'Learning access is limited to students.');
  }
  return { userId: auth.userId };
}

export type { DrmClient, PlaybackDeps };
