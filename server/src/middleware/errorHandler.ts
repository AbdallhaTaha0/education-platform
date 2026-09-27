import type { NextFunction, Request, Response } from 'express';
import { getLogger } from '../logger.js';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: {
      code: 'not_found',
      message: `No route matches ${req.method} ${req.path}`,
      requestId: req.requestId ?? 'unknown',
    },
  };
  res.status(404).json(body);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // Full details stay in server logs; callers receive a safe generic message.
  getLogger().error({ err, requestId: req.requestId, path: req.path }, 'unhandled request error');
  if (res.headersSent) return;
  const body: ApiErrorBody = {
    error: {
      code: 'internal_error',
      message: 'Internal server error',
      requestId: req.requestId ?? 'unknown',
    },
  };
  res.status(500).json(body);
}
