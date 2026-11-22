import type { IncomingMessage, ServerResponse } from 'node:http';

export default function pinoHttp(opts?: {
  logger?: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
  genReqId?: (req: IncomingMessage) => string;
}) {
  return function pinoHttpMiddleware(req: IncomingMessage, _res: ServerResponse, next: () => void) {
    if (opts?.genReqId) {
      (req as IncomingMessage & { id?: string }).id = opts.genReqId(req);
    }
    next();
  };
}
