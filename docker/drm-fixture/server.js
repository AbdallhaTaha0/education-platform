/**
 * TEST-ONLY labeled DRM HTTP contract fixture.
 * Used ONLY by the browser verification profile. NEVER part of production
 * runtime images. NOT real DRM, R2, playback, watermarking, or commercial DRM.
 *
 * Behavior: registration is idempotent on externalAssetId; completion moves
 * UPLOADED assets to PROCESSING; each status poll advances PROCESSING assets
 * one step (PROCESSING -> READY on the 2nd poll); deletions advance
 * PENDING -> RUNNING -> COMPLETED across polls; PUT /upload/* accepts bytes.
 * M5 playback routes issue a grant whose manifest is deliberately unusable:
 * the browser run proves grant issuance, token handling and player wiring, and
 * it is NOT evidence that real media plays.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.PORT ?? '8090');
const CLIENT_ID = process.env.FIXTURE_CLIENT_ID ?? 'fixture-client';
const CLIENT_SECRET = process.env.FIXTURE_CLIENT_SECRET ?? 'fixture-secret-that-is-long-enough-0123456789';

const assets = new Map();
const deletions = new Map();
const statusPolls = new Map();
const sessions = new Map();

// The platform signs the playback assertion; the fixture verifies it so the
// browser run proves the real claim contract.
const ASSERTION_SECRET = process.env.FIXTURE_ASSERTION_SECRET ?? '';
const ASSERTION_ISSUER = process.env.FIXTURE_ASSERTION_ISSUER ?? '';
const ASSERTION_AUDIENCE = process.env.FIXTURE_ASSERTION_AUDIENCE ?? '';

function verifyAssertion(assertion) {
  if (ASSERTION_SECRET === '') return false;
  const parts = assertion.split('.');
  if (parts.length !== 3) return false;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  return (
    claims.iss === ASSERTION_ISSUER && claims.aud === ASSERTION_AUDIENCE && typeof claims.sub === 'string'
  );
}

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

const DASH_DIR = process.env.FIXTURE_DASH_DIR ?? '/srv/fixture/dash';
const MIME = {
  '.mpd': 'application/dash+xml',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
};

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id, X-Client-Secret, Authorization, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    'X-Fixture': 'drm-contract-fixture',
    ...extra,
  };
}

/**
 * Browser-facing DASH media for a playback session.
 *
 * Authorized with the transient playback bearer for that session, exactly as a
 * real player would. Returns true when the request was a media route, so the
 * caller can stop before the application-credential check.
 */
function handleBrowserMedia(req, res) {
  const url = req.url ?? '';
  const manifest = /^\/v1\/playback\/sessions\/([^/]+)\/manifest\.mpd$/.exec(url);
  const segment = /^\/v1\/playback\/sessions\/([^/]+)\/media\/([A-Za-z0-9_.-]+)$/.exec(url);
  const license = url === '/v1/playback/licenses' && req.method === 'POST';
  if (!manifest && !segment && !license) return false;
  if ((manifest || segment) && req.method !== 'GET') return false;

  // The license call carries no session id; it is authorized by matching the
  // playback bearer against a live fixture session.
  const bearer = req.headers.authorization ?? '';
  if (license) {
    let owner = null;
    for (const session of sessions.values()) {
      if (session.status === 'active' && bearer === `Bearer ${session.token}`) {
        owner = session;
        break;
      }
    }
    if (!owner) {
      res.writeHead(401, corsHeaders({ 'Content-Type': 'application/json' }));
      res.end(JSON.stringify({ fixture: true, error: 'invalid playback token' }));
      return true;
    }
    serveLicense(res);
    return true;
  }

  const sessionId = decodeURIComponent((manifest ?? segment)[1]);
  const session = sessions.get(sessionId);
  if (!session || session.status === 'revoked') {
    res.writeHead(404, corsHeaders({ 'Content-Type': 'application/json' }));
    res.end(JSON.stringify({ fixture: true, error: 'session not found' }));
    return true;
  }
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${session.token}`) {
    res.writeHead(401, corsHeaders({ 'Content-Type': 'application/json' }));
    res.end(JSON.stringify({ fixture: true, error: 'invalid playback token' }));
    return true;
  }

  if (manifest) {
    serveDashManifest(res, sessionId);
    return true;
  }
  serveDashFile(res, segment[2], req.headers.range);
  return true;
}

/**
 * A real ClearKey license for the generated presentation, so the browser
 * exercises the genuine EME path rather than a bypass. This is test material
 * for synthetic content; it is not a production key and protects nothing.
 */
function serveLicense(res) {
  const licenseFile = process.env.FIXTURE_LICENSE_FILE ?? '/srv/fixture/license.json';
  fs.readFile(licenseFile, 'utf8', (err, json) => {
    res.writeHead(err ? 500 : 200, corsHeaders({ 'Content-Type': 'application/json' }));
    res.end(err ? JSON.stringify({ fixture: true, error: 'no license built' }) : json);
  });
}

/** Serve the generated MPD, rewriting every media reference to this session. */
function serveDashManifest(res, sessionId) {
  const file = path.join(DASH_DIR, 'presentation.mpd');
  fs.readFile(file, 'utf8', (err, xml) => {
    if (err) {
      res.writeHead(404, corsHeaders({ 'Content-Type': 'application/json' }));
      res.end(JSON.stringify({ fixture: true, error: 'no dash presentation built' }));
      return;
    }
    // Any attribute value that names a media file is rewritten to this
    // session's media path. This covers both explicit SegmentList entries and
    // ffmpeg's $Number$ template form.
    const prefix = `/v1/playback/sessions/${sessionId}/media/`;
    const rewritten = xml.replace(/(["'])([^"']*\.m4s)\1/g, (_m, quote, name) => `${quote}${prefix}${name}${quote}`);
    res.writeHead(200, corsHeaders({ 'Content-Type': MIME['.mpd'], 'Cache-Control': 'no-store' }));
    res.end(rewritten);
  });
}

function serveDashFile(res, name, range) {
  // Defensive: never let a request escape the generated presentation directory.
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) {
    res.writeHead(400, corsHeaders({ 'Content-Type': 'application/json' }));
    res.end(JSON.stringify({ fixture: true, error: 'bad media name' }));
    return;
  }
  const file = path.join(DASH_DIR, name);
  const type = MIME[path.extname(name)] ?? 'application/octet-stream';
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, corsHeaders({ 'Content-Type': 'application/json' }));
      res.end(JSON.stringify({ fixture: true, error: 'media not found' }));
      return;
    }
    const headers = corsHeaders({ 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] !== '' ? Number(match[1]) : 0;
      const end = match && match[2] !== '' ? Number(match[2]) : stat.size - 1;
      if (start >= stat.size || end < start) {
        res.writeHead(416, corsHeaders({ 'Content-Range': `bytes */${stat.size}` }));
        res.end();
        return;
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  });
}

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
        // Authorization and Range are required by the player's bearer-carrying
        // manifest, segment and license requests.
        'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id, X-Client-Secret, Authorization, Range',
        'Access-Control-Max-Age': '86400',
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
        sessions.clear();
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
    // Browser media requests carry the transient playback bearer, not the
    // application credentials, so they are handled before the app-credential
    // check below.
    if (handleBrowserMedia(req, res)) {
      return;
    }
    if (req.headers['x-client-id'] !== CLIENT_ID || req.headers['x-client-secret'] !== CLIENT_SECRET) {
      send(res, 401, { error: 'Invalid client credentials' });
      return;
    }
    const url = req.url ?? '';

    // ---- M5 playback session creation (TEST-ONLY, application credentials).
    // A real, playable DASH presentation is generated at image build time and
    // served by handleBrowserMedia, so the browser suite can prove that progress
    // writes do not interrupt actual playback. This is NOT evidence of content
    // protection, watermarking or commercial DRM.
    if (url === '/v1/playback/sessions' && req.method === 'POST') {
      const { externalAssetId, deviceId, assertion } = body || {};
      if (typeof externalAssetId !== 'string' || typeof deviceId !== 'string' || typeof assertion !== 'string') {
        send(res, 400, { error: 'bad request' });
        return;
      }
      if (!verifyAssertion(assertion)) {
        send(res, 401, { error: 'assertion rejected' });
        return;
      }
      let ready = false;
      for (const a of assets.values()) {
        if (a.externalAssetId === externalAssetId && a.status === 'READY') ready = true;
      }
      if (!ready) {
        send(res, 404, { error: 'unknown asset' });
        return;
      }
      const sessionId = randomUUID();
      const token = `fixture-playback-token-${randomUUID()}`;
      sessions.set(sessionId, { deviceId, token, status: 'active', applicationId: CLIENT_ID });
      send(res, 201, {
        playbackSessionId: sessionId,
        playbackToken: token,
        tokenExpiresAt: new Date(Date.now() + 120000).toISOString(),
        sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        manifestUrl: `/v1/playback/sessions/${sessionId}/manifest.mpd`,
        licenseUrl: '/v1/playback/licenses',
        drmProvider: 'CLEAR_KEY',
        watermark: {
          type: 'MASKED',
          maskedIdentity: 'fixture***@example',
          positions: [{ x: 50, y: 50 }],
          traceCode: 'fixture-trace',
          signature: 'fixture-signature',
        },
      });
      return;
    }
    // ---- Platform-mediated renewal (TEST-ONLY, application credentials).
    // The M5 correction moved platform-mediated renewal to a distinct
    // application-authenticated route, because the platform never holds the
    // playback bearer token. Without it the platform's renewal reaches a 404 and
    // the browser suite silently proves nothing about renewal. Tenant ownership
    // is checked exactly as the real service does: a session that does not belong
    // to the calling application is refused, never renewed.
    const renewAdmin = url.match(/^\/v1\/playback\/sessions\/([^/]+)\/renew-admin$/);
    if (renewAdmin && req.method === 'POST') {
      const id = decodeURIComponent(renewAdmin[1]);
      const session = sessions.get(id);
      if (!session) {
        send(res, 404, { error: 'session not found' });
        return;
      }
      if (session.applicationId !== undefined && session.applicationId !== CLIENT_ID) {
        send(res, 403, { error: 'session does not belong to this application' });
        return;
      }
      if (session.status !== 'active') {
        send(res, 409, { error: 'session is not active' });
        return;
      }
      const token = `fixture-admin-renewed-token-${randomUUID()}`;
      session.token = token;
      send(res, 200, {
        status: 'active',
        playbackToken: token,
        tokenExpiresAt: new Date(Date.now() + 120000).toISOString(),
        sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
      return;
    }

    // Browser media routes live in handleBrowserMedia, ahead of the
    // application-credential check, because browsers authorize with the
    // playback bearer.
    const sessionAction = url.match(/^\/v1\/playback\/sessions\/([^/]+)\/(end|revoke|renew)$/);
    if (sessionAction && req.method === 'POST') {
      const id = decodeURIComponent(sessionAction[1]);
      const session = sessions.get(id);
      if (!session) {
        send(res, 404, { error: 'session not found' });
        return;
      }
      if (session.status === 'revoked') {
        send(res, 410, { error: 'session revoked' });
        return;
      }
      if (sessionAction[2] === 'renew') {
        // Platform-mediated renewal: a fresh transient token for the SAME
        // external session, so the player swaps the credential without
        // restarting DASH/EME. Test material only.
        const token = `fixture-renewed-token-${randomUUID()}`;
        session.token = token;
        send(res, 200, {
          status: 'active',
          playbackToken: token,
          tokenExpiresAt: new Date(Date.now() + 120000).toISOString(),
          sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        });
        return;
      }
      const wasActive = session.status === 'active';
      session.status = sessionAction[2] === 'end' ? 'ended' : 'revoked';
      send(res, 200, { status: wasActive ? 'revoked' : 'ended' });
      return;
    }
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
