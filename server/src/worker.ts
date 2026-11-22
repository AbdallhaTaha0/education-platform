// @ts-expect-error Cloudflare Workers runtime built-in module
import { DurableObject } from 'cloudflare:workers';
import { Readable } from 'node:stream';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { createApp } from './app.js';
import { loadConfig, type ServerConfig } from './config.js';
import { CloudflareCache, type KVNamespaceLike } from './infra/cache.js';
import {
  DurableObjectLockProvider,
  MutexDurableObject as BaseMutexDurableObject,
  setLockProvider,
  withEntityLocks,
  type DurableObjectNamespaceLike,
} from './infra/locks-do.js';
import { createStorageClient } from './infra/storage.js';
import { createDrmClient } from './modules/catalog/drmClient.js';
import { reconcilePendingOperations } from './modules/catalog/deletion/reconciler.js';
import { reconcileExpiredSessions } from './modules/learning/expiry/reconciler.js';
import { reconcileMaterialObjects } from './modules/learning/materials/service.js';
import { cleanupNotifications, runNotificationDeliveryPass } from './modules/notifications/delivery.js';
import {
  createDurableObjectPublisher,
  handleNotificationsWebSocket,
  UserRealtimeDurableObject as BaseUserRealtimeDurableObject,
} from './modules/notifications/realtime-do.js';
import { setEdgeSsrBundle, type SiteData } from './modules/seo/router.js';
import { cleanupExpiredProofs } from './modules/wallet/cleanup/service.js';
// @ts-expect-error Prebuilt Vite SSR bundle emitted by `npm --prefix client run build:cloudflare`
import { renderPublicPage } from '../../client/dist-ssr/entry-server.mjs';

export class MutexDurableObject extends (DurableObject as new (ctx: unknown, env: unknown) => object) {
  private readonly impl: BaseMutexDurableObject;
  constructor(ctx: ConstructorParameters<typeof BaseMutexDurableObject>[0], env: unknown) {
    super(ctx, env);
    this.impl = new BaseMutexDurableObject(ctx, env);
  }
  fetch(request: Request): Promise<Response> {
    return this.impl.fetch(request);
  }
}

export class UserRealtimeDurableObject extends (DurableObject as new (ctx: unknown, env: unknown) => object) {
  private readonly impl: BaseUserRealtimeDurableObject;
  constructor(ctx: ConstructorParameters<typeof BaseUserRealtimeDurableObject>[0], env: unknown) {
    super(ctx, env);
    this.impl = new BaseUserRealtimeDurableObject(ctx, env);
  }
  fetch(request: Request): Promise<Response> {
    return this.impl.fetch(request);
  }
  webSocketMessage(ws: WebSocket): Promise<void> {
    return this.impl.webSocketMessage(ws);
  }
  alarm(): Promise<void> {
    return this.impl.alarm();
  }
}

const EDGE_INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="#101318" />
    <meta name="robots" content="noindex, follow" />
    <meta name="application-name" content="FAYQ" />
    <meta name="apple-mobile-web-app-title" content="FAYQ" />
    <title>FAYQ — تعلمها. برمجها. حققها.</title>
    <meta name="description" content="FAYQ — دورات برمجة مسجلة لطلاب المرحلة الثانوية. راجع السعر وشروط الوصول لكل دورة." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="FAYQ" />
    <meta property="og:title" content="FAYQ — تعلمها. برمجها. حققها." />
    <meta property="og:description" content="FAYQ — دورات برمجة مسجلة لطلاب المرحلة الثانوية. راجع السعر وشروط الوصول لكل دورة." />
    <meta property="og:locale" content="ar_EG" />
    <meta property="og:locale:alternate" content="en_US" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="FAYQ" />
    <meta name="twitter:description" content="FAYQ — Learn It. Code It. Get It." />
    <script type="module" crossorigin src="/assets/index-0-kn2wIP.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-C7zoueBO.css">
  </head>
  <body>
    <div id="root"></div>
    <script>
      try {
        var stored = window.localStorage.getItem('edu-platform-theme');
        document.documentElement.dataset.theme =
          stored === 'light' || stored === 'dark' ? stored : 'dark';
      } catch (e) {
        document.documentElement.dataset.theme = 'dark';
      }
    </script>
  </body>
</html>`;

setEdgeSsrBundle({
  html: EDGE_INDEX_HTML,
  renderPublicPage: renderPublicPage as (data: SiteData) => { head: string; body: string },
});

export interface WorkerEnv {
  DB: unknown;
  SESSION_KV: KVNamespaceLike;
  MUTEX_DO: DurableObjectNamespaceLike;
  USER_REALTIME_DO: DurableObjectNamespaceLike;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  MEDIA_BUCKET?: unknown;
  [key: string]: unknown;
}

export interface ScheduledControllerLike {
  cron: string;
  scheduledTime: number;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function buildConfig(env: WorkerEnv, requestOrigin?: string): ServerConfig {
  const stringEnv: NodeJS.ProcessEnv = {
    DATABASE_URL: 'file:d1.sqlite',
    REDIS_URL: 'cloudflare://kv',
    AUTH_ISSUER: 'fayq-education-platform',
    AUTH_AUDIENCE: 'fayq-education-platform',
  };
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string') stringEnv[k] = v;
  }
  if (requestOrigin && /^https?:\/\//.test(requestOrigin)) {
    const existing = stringEnv.ALLOWED_ORIGINS
      ? stringEnv.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (!existing.includes(requestOrigin)) {
      existing.push(requestOrigin);
    }
    stringEnv.ALLOWED_ORIGINS = existing.join(',');
  } else if (!stringEnv.ALLOWED_ORIGINS) {
    stringEnv.ALLOWED_ORIGINS = 'https://fayq-education-platform.workers.dev';
  }
  return loadConfig(stringEnv);
}

function buildRuntime(env: WorkerEnv, requestOrigin?: string) {
  const config = buildConfig(env, requestOrigin);
  const lockProvider = new DurableObjectLockProvider(env.MUTEX_DO);
  setLockProvider(lockProvider);
  const cache = new CloudflareCache(env.SESSION_KV, lockProvider);
  const adapter = new PrismaD1(env.DB as ConstructorParameters<typeof PrismaD1>[0]);
  const prisma = new PrismaClient({ adapter });
  const origTransaction = prisma.$transaction.bind(prisma);
  prisma.$transaction = (async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: PrismaClient) => Promise<unknown>)(prisma);
    }
    if (Array.isArray(arg)) {
      const results: unknown[] = [];
      for (const op of arg) {
        results.push(await op);
      }
      return results;
    }
    return origTransaction(arg as never);
  }) as typeof prisma.$transaction;
  const app = createApp({ config, redisClient: cache, prisma });
  return { config, lockProvider, cache, prisma, app };
}

/**
 * Bridge a Fetch API Request into the single modular Express application
 * and collect its HTTP status, headers, and body into a Fetch API Response.
 */
async function dispatchExpress(
  app: ReturnType<typeof createApp>,
  request: Request,
  pathAndQuery: string,
  clientIp: string,
): Promise<Response> {
  const bodyBuf =
    request.method === 'GET' || request.method === 'HEAD'
      ? Buffer.alloc(0)
      : Buffer.from(await request.arrayBuffer());

  return new Promise<Response>((resolve, reject) => {
    const socket = new Socket();
    Object.defineProperty(socket, 'remoteAddress', { value: clientIp, configurable: true });
    const req = new IncomingMessage(socket);
    if (req.socket && !req.socket.remoteAddress) {
      try {
        Object.defineProperty(req.socket, 'remoteAddress', { value: clientIp, configurable: true });
      } catch {
        // Ignore if read-only in runtime shim
      }
    }
    Object.defineProperty(req, 'ip', { value: clientIp, configurable: true, writable: true });
    req.method = request.method;
    req.url = pathAndQuery;
    req.headers = {};
    request.headers.forEach((value, key) => {
      req.headers[key.toLowerCase()] = value;
    });
    if (bodyBuf.length > 0 && !req.headers['content-length']) {
      req.headers['content-length'] = String(bodyBuf.length);
    }

    // Feed body stream into IncomingMessage
    const stream = Readable.from(bodyBuf.length > 0 ? [bodyBuf] : []);
    req.push = stream.push.bind(req);
    if (bodyBuf.length > 0) {
      req.push(bodyBuf);
    }
    req.push(null);

    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: unknown, ...rest: unknown[]) => {
      if (chunk !== undefined && chunk !== null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return origWrite(chunk as string, ...(rest as []));
    }) as typeof res.write;

    res.end = ((chunk?: unknown, ...rest: unknown[]) => {
      if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      const headers = new Headers();
      for (const [key, val] of Object.entries(res.getHeaders())) {
        if (val === undefined) continue;
        if (Array.isArray(val)) {
          for (const v of val) headers.append(key, String(v));
        } else {
          headers.set(key, String(val));
        }
      }
      const status = res.statusCode || 200;
      const body = status === 204 || status === 304 ? null : Buffer.concat(chunks);
      resolve(new Response(body, { status, headers }));
      return origEnd(chunk as string, ...(rest as []));
    }) as typeof res.end;

    try {
      (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

const SSR_PATHS = new Set([
  '/',
  '/ar',
  '/en',
  '/support',
  '/terms',
  '/privacy',
  '/refunds',
  '/sitemap.xml',
  '/robots.txt',
]);

function isSsrPath(pathname: string): boolean {
  if (SSR_PATHS.has(pathname)) return true;
  return (
    pathname.startsWith('/ar/') ||
    pathname.startsWith('/en/') ||
    pathname.startsWith('/courses/') ||
    pathname.startsWith('/packages/')
  );
}

export default {
  async fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContextLike): Promise<Response> {
    const url = new URL(request.url);
    const clientIp = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1';

    // 1. Native WebSocket upgrade for per-user realtime notifications
    if (url.pathname === '/api/notifications/ws') {
      const { config, cache, prisma } = buildRuntime(env, url.origin);
      return handleNotificationsWebSocket(request, {
        prisma,
        cache,
        jwtSecret: config.jwtSecret,
        authIssuer: config.authIssuer,
        authAudience: config.authAudience,
        allowedOrigins: config.allowedOrigins,
        userRealtimeDo: env.USER_REALTIME_DO,
      });
    }

    // 2. Platform API routes (/api/* -> /*)
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const { app } = buildRuntime(env, url.origin);
      const stripped = url.pathname.slice(4) || '/';
      const response = await dispatchExpress(app, request, `${stripped}${url.search}`, clientIp);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('X-Robots-Tag', 'noindex');
      return new Response(response.body, { status: response.status, headers });
    }

    // 3. Public bilingual SSR & SEO routes
    if (isSsrPath(url.pathname)) {
      const { app } = buildRuntime(env, url.origin);
      const seoPath = url.pathname === '/' ? '/seo/' : `/seo${url.pathname}`;
      return dispatchExpress(app, request, `${seoPath}${url.search}`, clientIp);
    }

    // 4. Static hashed assets served from edge ASSETS binding
    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      if (url.pathname.startsWith('/assets/') && assetRes.ok) {
        const headers = new Headers(assetRes.headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(assetRes.body, { status: assetRes.status, headers });
      }
      return assetRes;
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(
    controller: ScheduledControllerLike,
    env: WorkerEnv,
    ctx: ExecutionContextLike,
  ): Promise<void> {
    const { config, cache, prisma } = buildRuntime(env);
    const storage = createStorageClient(config);
    const publisher = createDurableObjectPublisher(env.USER_REALTIME_DO);

    const run = async () => {
      if (controller.cron === '0 2 * * *') {
        await withEntityLocks(['cron:daily-cleanup'], async () => {
          await cleanupExpiredProofs(prisma, 100, 'system', storage);
          await cleanupNotifications(prisma);
        });
        return;
      }

      // Cost-guard optimization ($5 Workers Paid Plan): check D1 first (25B included row reads)
      // and only acquire a MutexDurableObject lock when pending work actually exists (0 DO calls when idle).
      const pendingDeletion = await prisma.catalogDeletionOperation.findFirst({
        where: { status: { in: ['PENDING', 'RUNNING'] } },
        select: { id: true },
      });
      if (pendingDeletion) {
        await withEntityLocks(['cron:deletion'], async () => {
          await reconcilePendingOperations(prisma, config, createDrmClient, cache);
        });
      }

      const nowDate = new Date();
      const [duePlayback, dueMaterial] = await Promise.all([
        prisma.playbackReference.findFirst({
          where: { status: 'ACTIVE' },
          select: { id: true },
        }),
        storage
          ? prisma.materialObject.findFirst({
              where: { state: 'PENDING', updatedAt: { lte: new Date(nowDate.getTime() - 60_000) } },
              select: { storageKey: true },
            })
          : Promise.resolve(null),
      ]);
      if (duePlayback || dueMaterial) {
        await withEntityLocks(['cron:learning-expiry'], async () => {
          await reconcileExpiredSessions(prisma, cache, createDrmClient(config), Date.now());
          if (storage) {
            await reconcileMaterialObjects({ prisma, storage, now: Date.now });
          }
        });
      }

      const [dueEvent, dueSignal] = await Promise.all([
        prisma.notificationEvent.findFirst({
          where: {
            deliveryStatus: { in: ['PENDING', 'PROCESSING'] },
            nextAttemptAt: { lte: nowDate },
          },
          select: { id: true },
        }),
        prisma.notification.findFirst({
          where: { signalPending: true, nextSignalAt: { lte: nowDate } },
          select: { id: true },
        }),
      ]);
      if (dueEvent || dueSignal) {
        await runNotificationDeliveryPass(prisma, publisher);
      }
    };

    ctx.waitUntil(run());
  },
};
