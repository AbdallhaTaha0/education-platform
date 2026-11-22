import type { PrismaClient } from '@prisma/client';
import type { PlatformCache } from '../../infra/cache.js';
import type { DurableObjectNamespaceLike } from '../../infra/locks-do.js';
import { parseCookies, ACCESS_COOKIE, CSRF_COOKIE } from '../identity/cookies.js';
import { verifySessionCsrf } from '../identity/csrf.js';
import { getActiveSession } from '../identity/store.js';
import { verifyAccessToken, type Clock } from '../identity/tokens.js';
import type { SignalPublisher } from './delivery.js';

interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface DurableObjectStateLike {
  acceptWebSocket(ws: WebSocketLike, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocketLike[];
  getTags(ws: WebSocketLike): string[];
  storage: {
    setAlarm(scheduledTime: number | Date): Promise<void>;
  };
}

/**
 * Per-user Cloudflare Durable Object using the WebSocket Hibernation API.
 * Replaces socket.io + @socket.io/redis-adapter with zero persistent Node sockets.
 */
export class UserRealtimeDurableObject {
  constructor(
    private readonly ctx: DurableObjectStateLike,
    private readonly _env: unknown,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/publish' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        revision?: string;
        revokedSessionId?: string;
      };
      if (body.revokedSessionId) {
        for (const ws of this.ctx.getWebSockets(body.revokedSessionId)) {
          try {
            ws.send(JSON.stringify({ event: 'notifications:reauthenticate' }));
            ws.close(1008, 'session revoked');
          } catch {
            // Socket already closed.
          }
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      const revision = String(body.revision ?? '0');
      const payload = JSON.stringify({
        event: 'notifications:changed',
        data: { schemaVersion: 1, revision },
      });
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload);
        } catch {
          // Ignore broken sockets; hibernation runtime cleans them up.
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const sessionId = request.headers.get('X-Session-Id') ?? '';
      const expMs = Number(request.headers.get('X-Session-Exp-Ms') ?? '0');
      const revision = request.headers.get('X-Inbox-Revision') ?? '0';

      const WebSocketPairCtor = (globalThis as unknown as {
        WebSocketPair?: new () => { 0: WebSocketLike; 1: WebSocketLike };
      }).WebSocketPair;
      if (!WebSocketPairCtor) {
        return new Response('WebSocketPair unavailable', { status: 501 });
      }
      const pair = new WebSocketPairCtor();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server, [sessionId, `exp:${expMs}`]);
      server.send(
        JSON.stringify({
          event: 'notifications:changed',
          data: { schemaVersion: 1, revision },
        }),
      );
      if (Number.isFinite(expMs) && expMs > Date.now()) {
        await this.scheduleEarliestAlarm();
      }
      return new Response(null, { status: 101, webSocket: client } as unknown as ResponseInit);
    }

    return new Response('Not found', { status: 404 });
  }

  /** Client-sent messages are forbidden; close immediately with 1008. */
  async webSocketMessage(ws: WebSocketLike): Promise<void> {
    try {
      ws.close(1008, 'client messages not permitted');
    } catch {
      // Already closed.
    }
  }

  /** Close expired sockets and prompt reauthentication. */
  async alarm(): Promise<void> {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const tags = this.ctx.getTags(ws);
      const expTag = tags.find((t) => t.startsWith('exp:'));
      const expMs = expTag ? Number(expTag.slice(4)) : 0;
      if (expMs > 0 && expMs <= now) {
        try {
          ws.send(JSON.stringify({ event: 'notifications:reauthenticate' }));
          ws.close(1008, 'token expired');
        } catch {
          // Ignore already closed socket.
        }
      }
    }
    await this.scheduleEarliestAlarm();
  }

  private async scheduleEarliestAlarm(): Promise<void> {
    let earliest = Number.POSITIVE_INFINITY;
    for (const ws of this.ctx.getWebSockets()) {
      const tags = this.ctx.getTags(ws);
      const expTag = tags.find((t) => t.startsWith('exp:'));
      const expMs = expTag ? Number(expTag.slice(4)) : 0;
      if (expMs > Date.now() && expMs < earliest) {
        earliest = expMs;
      }
    }
    if (Number.isFinite(earliest)) {
      await this.ctx.storage.setAlarm(earliest);
    }
  }
}

export interface WsAuthDeps {
  prisma: PrismaClient;
  cache: PlatformCache;
  jwtSecret: string;
  authIssuer: string;
  authAudience: string;
  allowedOrigins: string[];
  userRealtimeDo: DurableObjectNamespaceLike;
  clock?: Clock;
}

/**
 * Authenticate GET /api/notifications/ws?csrf=<token> before forwarding the
 * WebSocket upgrade to the recipient's UserRealtimeDurableObject.
 */
export async function handleNotificationsWebSocket(
  request: Request,
  deps: WsAuthDeps,
): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  if (!origin || !deps.allowedOrigins.includes(origin)) {
    return new Response(JSON.stringify({ error: { code: 'ORIGIN_FORBIDDEN' } }), {
      status: 403,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  const cookies = parseCookies(request.headers.get('Cookie') ?? undefined);
  const accessToken = cookies[ACCESS_COOKIE];
  if (!accessToken) {
    return new Response(JSON.stringify({ error: { code: 'TOKEN_MISSING' } }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  const nowMs = deps.clock ? deps.clock() : Date.now();
  let identity;
  try {
    identity = verifyAccessToken(
      accessToken,
      { secret: deps.jwtSecret, issuer: deps.authIssuer, audience: deps.authAudience },
      nowMs,
    );
  } catch {
    return new Response(JSON.stringify({ error: { code: 'TOKEN_INVALID' } }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  if (await deps.cache.hasTombstone(identity.sid)) {
    return new Response(JSON.stringify({ error: { code: 'SESSION_REVOKED' } }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  const active = await getActiveSession(deps.prisma, identity.sid, nowMs);
  if (!active.ok) {
    return new Response(JSON.stringify({ error: { code: 'SESSION_REVOKED' } }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  const url = new URL(request.url);
  const csrfParam = url.searchParams.get('csrf') ?? undefined;
  const csrfCookie = cookies[CSRF_COOKIE];
  const sessionRow = await deps.prisma.authSession.findUnique({
    where: { id: identity.sid },
    select: { csrfHash: true },
  });
  try {
    verifySessionCsrf(csrfParam, csrfCookie, sessionRow?.csrfHash ?? null);
  } catch {
    return new Response(JSON.stringify({ error: { code: 'CSRF_INVALID' } }), {
      status: 403,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  const inbox = await deps.prisma.notificationInboxState.findUnique({
    where: { userId: identity.sub },
    select: { revision: true },
  });

  const headers = new Headers(request.headers);
  headers.set('X-Session-Id', identity.sid);
  headers.set('X-Session-Exp-Ms', String(active.absoluteExpiresAt.getTime()));
  headers.set('X-Inbox-Revision', inbox ? inbox.revision.toString() : '0');

  const stub = deps.userRealtimeDo.get(deps.userRealtimeDo.idFromName(identity.sub));
  return stub.fetch(new Request(request.url, { method: request.method, headers }));
}

export function createDurableObjectPublisher(
  namespace: DurableObjectNamespaceLike,
): SignalPublisher {
  return async (userId: string, revision: string): Promise<void> => {
    const stub = namespace.get(namespace.idFromName(userId));
    await stub.fetch('https://realtime.internal/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision }),
    });
  };
}
