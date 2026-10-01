import type { Server as HttpServer } from 'node:http';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { GuardDeps } from '../identity/middleware.js';
import { ACCESS_COOKIE, parseCookies } from '../identity/cookies.js';
import { verifyAccessToken, type AccessTokenClaims } from '../identity/tokens.js';
import { getActiveSession, tombstoneKey } from '../identity/store.js';
import { verifySessionCsrf } from '../identity/csrf.js';
import { ensureRedis } from '../../infra/redis.js';
import { ApiError } from '../identity/errors.js';

export async function attachNotificationRealtime(
  server: HttpServer,
  deps: GuardDeps,
  heartbeatMs = 5000,
) {
  const pub = deps.redis.duplicate({
    lazyConnect: false,
    enableOfflineQueue: false,
    retryStrategy: () => 1000,
  });
  const sub = deps.redis.duplicate({
    lazyConnect: false,
    enableOfflineQueue: false,
    retryStrategy: () => 1000,
  });
  pub.on('error', () => {});
  sub.on('error', () => {});
  // Adapter subscriptions must be installed only after both connections are usable.
  try {
    await Promise.all([ensureRedis(pub), ensureRedis(sub)]);
  } catch (error) {
    pub.disconnect();
    sub.disconnect();
    throw error;
  }
  // The adapter does not await Redis publish promises. Capture failures here;
  // publish() below checks this generation and leaves durable signal work due.
  let publishFailures = 0;
  const pendingPublishes = new Set<Promise<number>>();
  const rawPublish = pub.publish.bind(pub);
  pub.publish = ((...args: Parameters<typeof pub.publish>) => {
    const pending = rawPublish(...args)
      .catch(() => {
        publishFailures++;
        return 0;
      })
      .finally(() => pendingPublishes.delete(pending));
    pendingPublishes.add(pending);
    return pending;
  }) as typeof pub.publish;
  // Adapter setup/close also discards subscription promises. Await setup and
  // capture teardown rejection rather than letting an outage terminate the app.
  let subscriptionFailures = 0;
  const pendingSubscriptions = new Set<Promise<unknown>>();
  for (const name of ['subscribe', 'psubscribe', 'unsubscribe', 'punsubscribe'] as const) {
    const command = sub[name].bind(sub) as (...args: unknown[]) => Promise<unknown>;
    Reflect.set(sub, name, (...args: unknown[]) => {
      const pending = command(...args)
        .catch(() => {
          subscriptionFailures++;
          return 0;
        })
        .finally(() => pendingSubscriptions.delete(pending));
      pendingSubscriptions.add(pending);
      return pending;
    });
  }
  const io = new Server(server, {
    path: '/notifications/socket.io/',
    transports: ['websocket'],
    serveClient: false,
    maxHttpBufferSize: 2048,
    pingInterval: 25000,
    pingTimeout: 20000,
    allowRequest: (req, callback) =>
      callback(
        null,
        Boolean(req.headers.origin && deps.auth.allowedOrigins.includes(req.headers.origin)),
      ),
  });
  io.adapter(createAdapter(pub, sub, { key: 'education-platform:m6', requestsTimeout: 5000 }));
  const namespace = io.of('/notifications');
  await Promise.all([...pendingSubscriptions]);
  if (subscriptionFailures) {
    await new Promise<void>((resolve) => io.close(() => resolve()));
    pub.disconnect();
    sub.disconnect();
    throw new Error('Realtime subscriptions unavailable.');
  }
  type Identity = AccessTokenClaims & { exp: number };
  const claims = new WeakMap<Socket, Identity>();
  const gradingSockets = new Map<string, Set<Socket>>();
  const grading = deps.redis.duplicate({ lazyConnect: false, enableOfflineQueue: false, retryStrategy: () => 1000 });
  grading.on('error', () => {});
  const now = () => (deps.clock ?? Date.now)();
  let closed = false;
  async function authorize(identity: Identity) {
    if (identity.exp * 1000 <= now())
      throw new ApiError(401, 'TOKEN_INVALID', 'Authentication is required.');
    if (pub.status !== 'ready' || sub.status !== 'ready')
      throw new Error('Realtime dependency unavailable.');
    await ensureRedis(deps.redis);
    if (await deps.redis.exists(tombstoneKey(identity.sid)))
      throw new ApiError(401, 'SESSION_REVOKED', 'Session is invalid.');
    const session = await getActiveSession(deps.prisma, identity.sid, now());
    if (!session.ok || session.user.id !== identity.sub || session.user.role !== identity.role) {
      throw new ApiError(401, 'SESSION_REVOKED', 'Session is invalid.');
    }
    return session;
  }
  namespace.use((socket, next) => {
    void (async () => {
      if (
        Object.keys(socket.handshake.auth).some((key) => key !== 'csrf') ||
        Object.keys(socket.handshake.query).some((key) => !['EIO', 'transport', 't'].includes(key))
      ) {
        throw new ApiError(403, 'INVALID_FIELD', 'Invalid connection.');
      }
      const cookies = parseCookies(socket.handshake.headers.cookie);
      if (!cookies[ACCESS_COOKIE])
        throw new ApiError(401, 'TOKEN_MISSING', 'Authentication is required.');
      const verified = verifyAccessToken(cookies[ACCESS_COOKIE], deps.auth, now());
      const exp = (jwt.decode(cookies[ACCESS_COOKIE]) as JwtPayload).exp;
      if (!Number.isInteger(exp))
        throw new ApiError(401, 'TOKEN_INVALID', 'Authentication is required.');
      const identity: Identity = { ...verified, exp: exp! };
      await authorize(identity);
      const session = await deps.prisma.authSession.findUniqueOrThrow({
        where: { id: identity.sid },
        select: { csrfHash: true },
      });
      verifySessionCsrf(
        typeof socket.handshake.auth.csrf === 'string' ? socket.handshake.auth.csrf : undefined,
        cookies.edu_csrf,
        session.csrfHash,
      );
      claims.set(socket, identity);
    })().then(
      () => next(),
      (error: unknown) => {
        const safe = new Error('Notification connection unavailable.') as Error & {
          data: { code: string };
        };
        safe.data = { code: error instanceof ApiError ? error.code : 'NOTIFICATIONS_UNAVAILABLE' };
        next(safe);
      },
    );
  });
  async function send(socket: Socket, revision?: string) {
    const identity = claims.get(socket);
    if (!identity || !socket.connected || closed) return;
    try {
      await authorize(identity);
      const current =
        revision ??
        (
          await deps.prisma.notificationInboxState.findUnique({
            where: { userId: identity.sub },
            select: { revision: true },
          })
        )?.revision.toString() ??
        '0';
      // Logout/disconnect during the awaited authority check must not enqueue more bytes.
      if (socket.connected && !closed && identity.exp * 1000 > now())
        socket.emit('notifications:changed', { schemaVersion: 1, revision: current });
    } catch {
      socket.emit('notifications:reauthenticate');
      socket.disconnect(true);
    }
  }
  async function invalidate(userId: string, revision: string) {
    if (!/^\d{1,20}$/.test(revision)) return;
    await Promise.all(
      [...namespace.sockets.values()]
        .filter((socket) => claims.get(socket)?.sub === userId)
        .map((socket) => send(socket, revision)),
    );
  }
  namespace.on('inbox:changed', (userId: string, revision: string, ack?: () => void) => {
    void invalidate(userId, revision).finally(() => ack?.());
  });
  namespace.on('connection', (socket) => {
    const studentId = claims.get(socket)!.sub;
    const owned = gradingSockets.get(studentId) ?? new Set<Socket>(); owned.add(socket); gradingSockets.set(studentId, owned);
    void send(socket);
    const expiryTimer = setTimeout(
      () => {
        socket.emit('notifications:reauthenticate');
        socket.disconnect(true);
      },
      Math.max(0, claims.get(socket)!.exp * 1000 - now()),
    );
    expiryTimer.unref();
    socket.once('disconnect', () => { clearTimeout(expiryTimer); owned.delete(socket); if (!owned.size) gradingSockets.delete(studentId); });
    // Clients have no room/subscription/write protocol.
    socket.onAny(() => socket.disconnect(true));
  });
  grading.on('message', (_channel, raw) => {
    if (closed || raw.length > 256) return;
    let message: { studentId?: unknown; submissionId?: unknown };
    try { message = JSON.parse(raw) as typeof message; } catch { return; }
    const uuid = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
    if (typeof message.studentId !== 'string' || typeof message.submissionId !== 'string' || !uuid.test(message.studentId) || !uuid.test(message.submissionId)) return;
    for (const socket of gradingSockets.get(message.studentId) ?? []) {
      const identity = claims.get(socket); if (!identity) continue;
      void authorize(identity).then(() => {
        if (!closed && socket.connected && identity.exp * 1000 > now()) socket.emit('assessment:completed', { submissionId: message.submissionId });
      }).catch(() => { socket.disconnect(true); });
    }
  });
  await ensureRedis(grading).then(() => grading.subscribe('education-platform:m9:completed')).catch(() => grading.disconnect());
  let checking = false;
  const timer = setInterval(() => {
    if (checking || closed) return;
    checking = true;
    void Promise.all(
      [...namespace.sockets.values()].map(async (socket) => {
        try {
          await authorize(claims.get(socket)!);
        } catch {
          socket.emit('notifications:reauthenticate');
          socket.disconnect(true);
        }
      }),
    ).finally(() => {
      checking = false;
    });
  }, heartbeatMs);
  timer.unref();
  const disconnect = () => {
    for (const socket of namespace.sockets.values()) socket.disconnect(true);
  };
  pub.on('close', disconnect);
  sub.on('close', disconnect);
  return {
    async publish(userId: string, revision: string) {
      if (pub.status !== 'ready' || sub.status !== 'ready')
        throw new Error('Realtime dependency unavailable.');
      const generation = publishFailures;
      await pub.ping();
      if (publishFailures !== generation) throw new Error('Realtime publication unavailable.');
      // Redis acceptance is not recipient receipt. Avoid the adapter's detached
      // async acknowledgement path; await the actual publication promises.
      namespace.serverSideEmit('inbox:changed', userId, revision);
      await Promise.all([invalidate(userId, revision), ...pendingPublishes]);
      await pub.ping();
      if (publishFailures !== generation) throw new Error('Realtime publication unavailable.');
    },
    async stop() {
      closed = true;
      clearInterval(timer);
      disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      pub.disconnect();
      sub.disconnect();
      grading.disconnect();
    },
  };
}
