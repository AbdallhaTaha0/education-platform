/**
 * TEST-ONLY labeled DRM HTTP contract fixture.
 * Used ONLY by the browser verification profile. NEVER part of production
 * runtime images. NOT real DRM, R2, playback, watermarking, or commercial DRM.
 *
 * Behavior: registration is idempotent on externalAssetId; completion moves
 * UPLOADED assets to PROCESSING; each status poll advances PROCESSING assets
 * one step (PROCESSING -> READY on the 2nd poll); deletions advance
 * PENDING -> RUNNING -> COMPLETED across polls; PUT /upload/* accepts bytes.
 */
const http = require('node:http');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.PORT ?? '8090');
const CLIENT_ID = process.env.FIXTURE_CLIENT_ID ?? 'fixture-client';
const CLIENT_SECRET = process.env.FIXTURE_CLIENT_SECRET ?? 'fixture-secret-that-is-long-enough-0123456789';

const assets = new Map();
const deletions = new Map();
const statusPolls = new Map();

function send(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'X-Fixture': 'drm-contract-fixture',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id, X-Client-Secret',
  });
  res.end(JSON.stringify({ fixture: true, ...body }));
}

let failNextDeletes = 0;

const server = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c) => {
    data += c;
  });
  req.on('end', () => {
    let body = null;
    try {
      body = data ? JSON.parse(data) : null;
    } catch {
      body = data;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id, X-Client-Secret',
        'X-Fixture': 'drm-contract-fixture',
      });
      res.end();
      return;
    }
    const fixturePath = req.url ?? '';
    if (fixturePath.startsWith('/__fixture/')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'X-Fixture': 'drm-contract-fixture' });
      if (fixturePath === '/__fixture/fail-deletes' && req.method === 'POST') {
        const parsed = body && typeof body.count === 'number' ? body.count : 0;
        failNextDeletes = parsed;
        res.end(JSON.stringify({ fixture: true, failNextDeletes }));
        return;
      }
      if (fixturePath === '/__fixture/reset' && req.method === 'POST') {
        failNextDeletes = 0;
        assets.clear();
        deletions.clear();
        statusPolls.clear();
        res.end(JSON.stringify({ fixture: true, ok: true }));
        return;
      }
      res.end(JSON.stringify({ fixture: true, ok: true }));
      return;
    }
    // Presigned browser uploads carry no application credentials by design.
    if ((req.url ?? '').startsWith('/upload/') && req.method === 'PUT') {
      send(res, 200, { ok: true });
      return;
    }
    if (req.headers['x-client-id'] !== CLIENT_ID || req.headers['x-client-secret'] !== CLIENT_SECRET) {
      send(res, 401, { error: 'Invalid client credentials' });
      return;
    }
    const url = req.url ?? '';
    if (url === '/v1/media' && req.method === 'POST') {
      if (!body || typeof body.externalAssetId !== 'string' || typeof body.idempotencyKey !== 'string') {
        send(res, 400, { error: 'bad request' });
        return;
      }
      for (const a of assets.values()) {
        if (a.externalAssetId === body.externalAssetId) {
          send(res, 202, { assetId: a.internalId, status: a.status, idempotent: true });
          return;
        }
      }
      const internalId = randomUUID();
      assets.set(internalId, { internalId, externalAssetId: body.externalAssetId, status: 'UPLOADED' });
      const host = req.headers.host ?? `127.0.0.1:${PORT}`;
      send(res, 202, { assetId: internalId, status: 'UPLOADED', uploadUrl: `http://${host}/upload/${internalId}?sig=fixture-signed`, idempotent: false });
      return;
    }
    const complete = url.match(/^\/v1\/media\/([^/]+)\/complete$/);
    if (complete && req.method === 'POST') {
      const asset = assets.get(decodeURIComponent(complete[1]));
      if (!asset) {
        send(res, 404, { error: 'Asset not found' });
        return;
      }
      if (asset.status !== 'UPLOADED') {
        send(res, 409, { error: 'Upload has already been completed' });
        return;
      }
      asset.status = 'PROCESSING';
      statusPolls.set(asset.internalId, 0);
      send(res, 202, { status: 'PROCESSING' });
      return;
    }
    const status = url.match(/^\/v1\/admin\/media\/([^/]+)\/status$/);
    if (status && req.method === 'GET') {
      const asset = assets.get(decodeURIComponent(status[1]));
      if (!asset) {
        send(res, 404, { error: 'Asset not found' });
        return;
      }
      if (asset.status === 'PROCESSING') {
        const polls = (statusPolls.get(asset.internalId) ?? 0) + 1;
        statusPolls.set(asset.internalId, polls);
        if (polls >= 2) asset.status = 'READY';
      }
      send(res, 200, { id: asset.internalId, status: asset.status });
      return;
    }
    const del = url.match(/^\/v1\/media\/([^/]+)$/);
    if (del && req.method === 'DELETE') {
      if (failNextDeletes > 0) {
        failNextDeletes -= 1;
        send(res, 500, { error: 'transient delete failure' });
        return;
      }
      const asset = assets.get(decodeURIComponent(del[1]));
      if (!asset) {
        send(res, 404, { error: 'Asset not found' });
        return;
      }
      if (!body || body.confirmation !== asset.externalAssetId) {
        send(res, 400, { error: 'CONFIRMATION_MISMATCH' });
        return;
      }
      for (const [delId, d] of deletions.entries()) {
        if (d.assetId === asset.internalId && (d.status === 'PENDING' || d.status === 'RUNNING')) {
          send(res, 202, { deletionId: delId, status: d.status, duplicate: true, scheduled: true });
          return;
        }
      }
      const deletionId = randomUUID();
      deletions.set(deletionId, { assetId: asset.internalId, status: 'PENDING', polls: 0 });
      asset.status = 'DELETING';
      send(res, 202, { deletionId, status: 'PENDING', duplicate: false, scheduled: true });
      return;
    }
    const delStatus = url.match(/^\/v1\/admin\/media-deletions\/([^/]+)$/);
    if (delStatus && req.method === 'GET') {
      const d = deletions.get(decodeURIComponent(delStatus[1]));
      if (!d) {
        send(res, 404, { error: 'Deletion not found' });
        return;
      }
      d.polls += 1;
      if (d.polls >= 3) d.status = 'COMPLETED';
      else if (d.polls >= 2) d.status = 'RUNNING';
      if (d.status === 'COMPLETED') assets.delete(d.assetId);
      send(res, 200, { deletionId: decodeURIComponent(delStatus[1]), status: d.status, attempts: d.polls });
      return;
    }
    send(res, 404, { error: 'unknown' });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`drm-fixture listening on :${PORT} (TEST-ONLY, labeled fixture)`);
});
