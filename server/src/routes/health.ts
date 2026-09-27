import { Router, type Request, type Response } from 'express';
import { withTimeout, type CheckFn, type ReadinessChecks } from '../infra/checks.js';
import { describeDrmConnection } from '../infra/drm.js';

export interface HealthRouteOptions {
  serviceName: string;
  serviceVersion: string;
  readyTimeoutMs: number;
  checkPostgres: CheckFn;
  checkRedis: CheckFn;
  startedAt: number;
}

export function createHealthRouter(options: HealthRouteOptions): Router {
  const router = Router();

  /** Liveness: the process can respond. No dependency checks here. */
  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: options.serviceName,
      version: options.serviceVersion,
      uptimeSeconds: Math.floor((Date.now() - options.startedAt) / 1000),
      time: new Date().toISOString(),
    });
  });

  /**
   * Readiness: platform PostgreSQL + Redis, each with a bounded timeout.
   * 200 when both are up, otherwise 503. The optional external DRM connection
   * is reported informationally and never gates readiness.
   */
  router.get('/ready', async (_req: Request, res: Response) => {
    const [postgres, redis] = await Promise.all([
      withTimeout(options.checkPostgres, options.readyTimeoutMs, 'postgres'),
      withTimeout(options.checkRedis, options.readyTimeoutMs, 'redis'),
    ]);
    const checks: ReadinessChecks = { postgres, redis };
    const ready = postgres.status === 'up' && redis.status === 'up';
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: options.serviceName,
      version: options.serviceVersion,
      time: new Date().toISOString(),
      checks,
      drm: describeDrmConnection(process.env),
    });
  });

  return router;
}
