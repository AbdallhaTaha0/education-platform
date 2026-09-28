import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../modules/identity/errors.js';
import { getLogger } from '../logger.js';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
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
  if (res.headersSent) return;
  if (err instanceof ApiError) {
    // ApiError carries only safe, localizable codes — never secrets or traces.
    const retryAfter = (err as { retryAfterSec?: number }).retryAfterSec;
    if (typeof retryAfter === 'number') {
      res.setHeader('Retry-After', String(retryAfter));
    }
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        requestId: req.requestId ?? 'unknown',
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
    res.status(err.status).json(body);
    return;
  }
  // Full details stay in server logs; callers receive a safe generic message.
  getLogger().error({ err, requestId: req.requestId, path: req.path }, 'unhandled request error');
  const body: ApiErrorBody = {
    error: {
      code: 'internal_error',
      message: 'Internal server error',
      requestId: req.requestId ?? 'unknown',
    },
  };
  res.status(500).json(body);
}
