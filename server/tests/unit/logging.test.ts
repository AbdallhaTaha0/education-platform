/**
 * Regression: sensitive request/response headers must never appear in
 * serialized log output. Sends unique dummy values through the real logging
 * middleware and asserts every emitted JSON line is free of them.
 */
import { Writable } from 'node:stream';
import express from 'express';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import { createApp } from '../../src/app.js';
import { createLogger } from '../../src/logger.js';
import type { ServerConfig } from '../../src/config.js';

const SECRETS = {
  authorization: 'Bearer dummy-auth-9f3k7q2m',
  cookie: 'session=dummy-cookie-4x8z1v6n',
  'proxy-authorization': 'Basic ZHmmbXktcHJveHktc2VjcmV0',
  'x-api-key': 'dummy-apikey-7h2j5t9w',
  'x-client-secret': 'dummy-clientsecret-3q6w8e1r',
  'x-csrf-token': 'a'.repeat(64),
  responseCookie: 'session=dummy-setcookie-5t9y2u4i',
} as const;

class CaptureStream extends Writable {
  lines: string[] = [];

  _write(chunk: unknown, _encoding: BufferEncoding, callback: (err?: Error) => void): void {
    this.lines.push(chunk as string);
    callback();
  }
}

function dumpedLogs(stream: CaptureStream): string {
  return stream.lines.join('\n');
}

function expectNoSecrets(logs: string): void {
  for (const secret of Object.values(SECRETS)) {
    expect(logs, `leaked secret: ${secret}`).not.toContain(secret);
  }
  // Proves the redaction paths were actually exercised (not merely absent).
  expect(logs).toContain('[Redacted]');
}

const config: ServerConfig = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: 'postgresql://postgres:postgres@postgres:5432/education_platform',
  redisUrl: 'redis://redis:6379',
  logLevel: 'info',
  serviceName: 'education-platform-server',
  serviceVersion: '0.3.0-m3-test',
  readyTimeoutMs: 1000,
  drmRequestTimeoutMs: 1000,
  drmMaxRetries: 2,
  storageRequestTimeoutMs: 1000,
  storageMaxRetries: 2,
  drmAssertionMaxLifetimeSec: 120,
  isProduction: false,
  jwtSecret: 'test-secret-that-is-long-enough-32',
  authIssuer: 'edu-platform-test',
  authAudience: 'edu-platform-test-web',
  allowedOrigins: ['http://localhost:8080'],
  cookieSecure: false,
  argon2: { memoryKb: 8192, timeCost: 2, parallelism: 1 },
  paymentChannels: [],
};

describe('sensitive header redaction', () => {
  it('redacts secret request headers logged by the application', async () => {
    const stream = new CaptureStream();
    const app = createApp(
      { config, postgresPool: {} as Pool, redisClient: {} as Redis, prisma: {} as PrismaClient },
      {
        logger: createLogger('info', stream),
        checkPostgresFn: vi.fn().mockResolvedValue({ status: 'up', latencyMs: 1 }),
        checkRedisFn: vi.fn().mockResolvedValue({ status: 'up', latencyMs: 1 }),
      },
    );

    const res = await request(app)
      .get('/health/live')
      .set('Authorization', SECRETS.authorization)
      .set('Cookie', SECRETS.cookie)
      .set('Proxy-Authorization', SECRETS['proxy-authorization'])
      .set('X-Api-Key', SECRETS['x-api-key'])
      .set('X-Client-Secret', SECRETS['x-client-secret'])
      .set('X-Csrf-Token', SECRETS['x-csrf-token']);
    expect(res.status).toBe(200);

    const logs = dumpedLogs(stream);
    expect(logs.length).toBeGreaterThan(0);
    expectNoSecrets(logs);
  });

  it('redacts set-cookie response headers', async () => {
    const stream = new CaptureStream();
    const app = express();
    app.use(pinoHttp({ logger: createLogger('info', stream) }));
    app.get('/cookie', (_req, res) => {
      res.setHeader('Set-Cookie', SECRETS.responseCookie);
      res.status(200).json({ ok: true });
    });

    const res = await request(app)
      .get('/cookie')
      .set('Authorization', SECRETS.authorization)
      .set('Cookie', SECRETS.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();

    const logs = dumpedLogs(stream);
    expect(logs.length).toBeGreaterThan(0);
    expectNoSecrets(logs);
  });
});
