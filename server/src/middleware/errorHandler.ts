import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../modules/identity/errors.js';
import { LearningError } from '../modules/learning/errors.js';
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
  // M5 learning categories are already frontend-safe: the message is a fixed
  // English fallback and the code is the contract the client localizes.
  if (err instanceof LearningError) {
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        requestId: req.requestId ?? 'unknown',
      },
    };
    res.status(err.status).json(body);
    return;
  }
  // Body-parser client errors (oversize or malformed JSON) are caller faults,
  // not internal failures: answer 413/400 with a frontend-safe category.
  // M4 proof uploads use the app-level route-aware 8 MiB parser; every other
  // JSON route retains the global 256 KiB ceiling.
  if (typeof err === 'object' && err !== null && 'type' in err) {
    const bodyType = (err as { type?: unknown }).type;
    const bodyStatus = (err as { status?: unknown }).status;
    if (bodyType === 'entity.too.large' && bodyStatus === 413) {
      const body: ApiErrorBody = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body is too large.',
          requestId: req.requestId ?? 'unknown',
        },
      };
      res.status(413).json(body);
      return;
    }
    if (bodyType === 'entity.parse.failed' && bodyStatus === 400) {
      const body: ApiErrorBody = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Malformed JSON body.',
          requestId: req.requestId ?? 'unknown',
        },
      };
      res.status(400).json(body);
      return;
    }
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
