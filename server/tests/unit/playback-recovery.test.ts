/**
 * Unit: device inspection/release validation and safe error mapping.
 */
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { describe, expect, it, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DrmClient } from '../../src/modules/catalog/drmClient.js';
import {
  validateDeviceInspectionResponse,
  validateDeviceReleaseResponse,
} from '../../src/modules/catalog/drm/schemas.js';

let server: Server | null = null;
let mode: 'inspect-ok' | 'release-ok' | 'release-active' | 'release-revoked' | 'outage' | 'malformed' = 'inspect-ok';

async function start(): Promise<string> {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      if (req.url?.endsWith('/devices') && req.method === 'GET') {
        if (mode === 'outage') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'boom' }));
          return;
        }
        if (mode === 'malformed') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ devices: [{ id: 'not-a-uuid' }] }));
          return;
        }
        const ref = randomUUID();
        const now = new Date().toISOString();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          devices: [{ id: ref, status: 'ACTIVE', createdAt: now, lastSeenAt: now, activePlayback: false, releasable: true }],
          truncated: false,
          maxDevices: 2,
        }));
        return;
      }
      if (req.url?.endsWith('/release') && req.method === 'POST') {
        if (mode === 'release-ok') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ released: true }));
          return;
        }
        if (mode === 'release-active') {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Device has active playback', code: 'DEVICE_ACTIVE' }));
          return;
        }
        if (mode === 'release-revoked') {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Revoked devices cannot be released', code: 'DEVICE_REVOKED' }));
          return;
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'boom' }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown' }));
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
  return `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

function clientFor(baseUrl: string): DrmClient {
  return new DrmClient({
    baseUrl,
    clientId: 'test-client-01',
    clientSecret: 'test-secret-that-is-long-enough-0123456789',
    timeoutMs: 2000,
    maxRetries: 0,
  });
}

describe('device inspection/release contract', () => {
  it('validates inspection and release shapes without secrets', async () => {
    const baseUrl = await start();
    mode = 'inspect-ok';
    const inspected = await clientFor(baseUrl).inspectUserDevices('student-id');
    expect(inspected.maxDevices).toBe(2);
    expect(inspected.truncated).toBe(false);
    expect(inspected.devices).toHaveLength(1);
    expect(JSON.stringify(inspected)).not.toContain('secret');
    mode = 'release-ok';
    await expect(clientFor(baseUrl).releaseUserDevice('student-id', randomUUID())).resolves.toMatchObject({ released: true });
    expect(() => validateDeviceReleaseResponse({ released: 'yes' })).toThrow();
    expect(() => validateDeviceInspectionResponse({ devices: [], truncated: false, maxDevices: 0 })).toThrow();
  });

  it('maps active/revoked refusals distinctly and never forwards raw diagnostics', async () => {
    const baseUrl = await start();
    mode = 'release-active';
    await expect(clientFor(baseUrl).releaseUserDevice('s', randomUUID())).rejects.toMatchObject({ code: 'DRM_DEVICE_ACTIVE', message: 'External media request failed.' });
    mode = 'release-revoked';
    await expect(clientFor(baseUrl).releaseUserDevice('s', randomUUID())).rejects.toMatchObject({ code: 'DRM_DEVICE_REVOKED' });
  });

  it('treats outage and malformed inspection as dependency failures', async () => {
    const baseUrl = await start();
    mode = 'outage';
    await expect(clientFor(baseUrl).inspectUserDevices('s')).rejects.toMatchObject({ code: 'DRM_SERVER' });
    mode = 'malformed';
    await expect(clientFor(baseUrl).inspectUserDevices('s')).rejects.toMatchObject({ code: 'DRM_MALFORMED' });
  });
});

describe('durable release audit (synthetic doubles, coordinator probe shape)', () => {
  const STUDENT = '00000000-0000-4000-8000-000000000001';
  const REFERENCE = '00000000-0000-4000-8000-000000000002';

  /** In-memory audit trail double with the query surface the service uses. */
  function auditDouble(failFromCreate = Number.POSITIVE_INFINITY) {
    const rows: Array<{ id: string; action: string; entityId: string; metadata: Record<string, unknown>; createdAt: Date }> = [];
    let creates = 0;
    const match = (row: (typeof rows)[number], where: Record<string, unknown>): boolean => {
      const action = (where['action'] as string | { in: string[] }) ?? null;
      const actionOk =
        action === null || typeof action === 'string' ? row.action === action : action.in.includes(row.action);
      const entityOk = where['entityId'] === undefined || row.entityId === where['entityId'];
      const metadata = where['metadata'] as { path: string[]; equals: string } | undefined;
      const metadataOk =
        metadata === undefined || (row.metadata[metadata.path[0]!] as unknown) === metadata.equals;
      const createdOk =
        where['createdAt'] === undefined ||
        row.createdAt >= (where['createdAt'] as { gte: Date }).gte;
      return actionOk && entityOk && metadataOk && createdOk;
    };
    return {
      rows,
      prisma: {
        user: { findUnique: async () => ({ id: STUDENT, role: 'STUDENT' }) },
        auditEvent: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            creates += 1;
            if (creates >= failFromCreate) throw new Error('synthetic audit outage');
            // Unique row ids like real PostgreSQL: intent/outcome correlation
            // by intentId must distinguish sequential intents.
            const id = `audit-${rows.length + 1}`;
            rows.push({
              id,
              action: data['action'] as string,
              entityId: data['entityId'] as string,
              metadata: (data['metadata'] as Record<string, unknown>) ?? {},
              createdAt: new Date(Date.now() + rows.length),
            });
            return { id };
          },
          findFirst: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) => {
            const matched = rows.filter((r) => match(r, where));
            if (orderBy !== undefined) matched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            const first = matched[0];
            return first ? { id: first.id, actorUserId: 'admin', createdAt: first.createdAt } : null;
          },
          findMany: async ({ where }: { where: Record<string, unknown> }) => {
            return rows.filter((r) => match(r, where)).map((r) => ({ id: r.id, actorUserId: 'admin', createdAt: r.createdAt, metadata: r.metadata }));
          },
        },
      },
    };
  }

  it('re-attempts a failed outcome audit on idempotent retry instead of forgetting it', async () => {
    const { releaseStudentDevice } = await import('../../src/modules/learning/devices/service.js');
    // Persist the outage from the outcome write (2nd create: after REQUESTED)
    // onward. The old code attempted one audit write total; the corrected
    // service must attempt the outcome again on retry instead of clearing it.
    const setup = auditDouble(2);
    let releaseExists = true;
    const drm = {
      inspectUserDevices: async () => ({ devices: [], truncated: false, maxDevices: 2 }),
      releaseUserDevice: async () => {
        const released = releaseExists;
        releaseExists = false;
        return { released };
      },
    };
    const args = [setup.prisma as never, drm as never, 'admin', STUDENT, REFERENCE, Date.now()] as const;
    // First: external success, outcome audit fails. The old code answered
    // auditPending:true and forgot the work; the retry must re-attempt it.
    const first = await releaseStudentDevice(...args);
    expect(first).toEqual({ released: true, auditPending: true });
    // Retry: reference already gone. The pending intent is reconciled — the
    // outcome audit is attempted again (and still fails here), never cleared.
    const retry = await releaseStudentDevice(...args);
    expect(retry).toEqual({ released: false, auditPending: true });
    const outcomes = setup.rows.filter((r) => r.action === 'DEVICE_RELEASE');
    expect(outcomes).toHaveLength(0);
    const intents = setup.rows.filter((r) => r.action === 'DEVICE_RELEASE_REQUESTED');
    expect(intents).toHaveLength(1);
  });

  it('completes the pending audit when the retry write succeeds', async () => {
    const { releaseStudentDevice } = await import('../../src/modules/learning/devices/service.js');
    const setup = auditDouble(Number.POSITIVE_INFINITY);
    let releaseExists = true;
    const drm = {
      inspectUserDevices: async () => ({ devices: [], truncated: false, maxDevices: 2 }),
      releaseUserDevice: async () => {
        const released = releaseExists;
        releaseExists = false;
        return { released };
      },
    };
    const args = [setup.prisma as never, drm as never, 'admin', STUDENT, REFERENCE, Date.now()] as const;
    expect(await releaseStudentDevice(...args)).toEqual({ released: true, auditPending: false });
    expect(await releaseStudentDevice(...args)).toEqual({ released: false, auditPending: false });
    expect(setup.rows.filter((r) => r.action === 'DEVICE_RELEASE')).toHaveLength(1);
  });
});
