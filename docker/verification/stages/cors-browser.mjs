/**
 * Stage: repeatable Docker-based R2 CORS browser verification (TEST-ONLY).
 *
 * Extends stages/cors.mjs (configuration read + rule shape) with genuine
 * browser proof: a real Chromium PUT from the owner-approved origin, an
 * unapproved-origin denial with an otherwise valid presigned URL, and exact
 * cleanup. All evidence flows through lib/safe-log.mjs; presigned URLs and
 * credentials are never printed.
 *
 * Direct execution (repository root, PowerShell), after the owner saved the
 * approved rule:
 *   node docker/verification/stages/cors-browser.mjs [--selftest]
 * S3 configuration is read in-process from the ignored DRM .env; the approved
 * origin is fixed to http://localhost:8082 (owner-approved, never invented).
 * Probe pages are deployed ephemerally into the disposable rs256 client and
 * removed afterward; only uniquely named run-scoped objects are created.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext } from '../lib/context.mjs';
import { expect, recordBlocked, safeErrorCategory, step, summary } from '../lib/safe-log.mjs';
import { corsProof } from './cors.mjs';

const APPROVED_ORIGIN = 'http://localhost:8082';
const BROWSER_IMAGE = 'edu-platform-browser:0.5.0-m5-verify';
const BROWSER_NETWORK = 'education-platform-rs256_default';
const CLIENT_CONTAINER = 'education-platform-rs256-client-1';
const HTML_ROOT = '/usr/share/nginx/html';
const STAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const DRIVER_PATH = resolve(STAGE_DIR, '..', '..', 'browser', 'cors-probe.mjs');
const REPO_ROOT = resolve(STAGE_DIR, '..', '..', '..');
const NEGATIVE_PAGE_ORIGIN = 'http://education-platform-rs256-nginx-1:8080';

/** Self-reporting probe page: PUTs 64 bytes, publishes status/error in title. */
export function buildProbePage(putUrl) {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>PENDING</title></head><body><script>
fetch(${JSON.stringify(putUrl)}, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(64).fill(65) })
  .then(function (r) { document.title = 'RESULT status=' + r.status; })
  .catch(function (e) { document.title = 'RESULT error=' + e.name; });
</scr` + `ipt></body></html>`
  );
}

function sh(args, opts = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', ...opts });
  return result;
}

export async function corsBrowserProof(ctx) {
  step('cors-browser');
  const s3 = ctx.s3;
  const prefix = `${ctx.smokePrefix}cors-browser/`;
  const posKey = `${prefix}positive.bin`;
  const negKey = `${prefix}negative.bin`;

  // 1. Fresh presigned PUTs; OPTIONS against the exact presigned host+path.
  const posUrl = s3.presignPut({
    key: posKey,
    expiresIn: 300,
    contentType: 'application/octet-stream',
  });
  const negUrl = s3.presignPut({
    key: negKey,
    expiresIn: 300,
    contentType: 'application/octet-stream',
  });
  const preStarted = Date.now();
  let preflight;
  try {
    const response = await fetch(posUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: ctx.approvedOrigin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    await response
      .text()
      .then(() => {})
      .catch(() => {});
    preflight = {
      status: response.status,
      allowOrigin: response.headers.get('access-control-allow-origin'),
      allowMethods: response.headers.get('access-control-allow-methods'),
      ms: Date.now() - preStarted,
    };
  } catch (e) {
    return { proven: false, reason: `preflight unreachable (${safeErrorCategory(e)})` };
  }
  expect('cors-browser-preflight-status', preflight.status >= 200 && preflight.status < 300, {
    origin: ctx.approvedOrigin,
    status: preflight.status,
    ms: preflight.ms,
  });
  expect('cors-browser-preflight-allows-origin', preflight.allowOrigin === ctx.approvedOrigin, {
    origin: ctx.approvedOrigin,
    status: preflight.status,
  });
  expect(
    'cors-browser-preflight-allows-put',
    (preflight.allowMethods || '').toUpperCase().includes('PUT'),
    {
      status: preflight.status,
    },
  );
  if (
    preflight.status < 200 ||
    preflight.status >= 300 ||
    preflight.allowOrigin !== ctx.approvedOrigin
  ) {
    return { proven: false, reason: 'preflight refused: approved rule not in effect' };
  }

  // 2. Deploy run-scoped probe pages into the disposable client.
  const posFile = `cors-${ctx.runId}-pos.html`;
  const negFile = `cors-${ctx.runId}-neg.html`;
  const tmpPos = join(tmpdir(), posFile);
  const tmpNeg = join(tmpdir(), negFile);
  writeFileSync(tmpPos, buildProbePage(posUrl));
  writeFileSync(tmpNeg, buildProbePage(negUrl));
  const deployed = [];
  try {
    for (const [tmp, name] of [
      [tmpPos, posFile],
      [tmpNeg, negFile],
    ]) {
      const cp = sh(['cp', tmp, `${CLIENT_CONTAINER}:${HTML_ROOT}/${name}`]);
      if (cp.status !== 0) return { proven: false, reason: 'probe page deploy failed' };
      deployed.push(name);
    }

    // 3. Real Chromium PUT from the approved origin.
    const positive = runProbe(`${APPROVED_ORIGIN}/${posFile}`, 'status', '200');
    expect('cors-browser-approved-put', positive.pass, {
      origin: APPROVED_ORIGIN,
      status: positive.status,
      note: positive.note,
    });

    // 4. Unapproved-origin denial with an otherwise valid presigned URL.
    const negative = runProbe(`${NEGATIVE_PAGE_ORIGIN}/${negFile}`, 'block', '');
    expect('cors-browser-unapproved-denied', negative.pass, {
      status: negative.status,
      note: negative.note,
    });

    return { proven: positive.pass && negative.pass, reason: '' };
  } finally {
    // 5. Exact cleanup: objects, prefix check, pages, temp files.
    try {
      for (const key of [posKey, negKey]) {
        await s3.deleteObject({ key, scopePrefix: prefix });
      }
      const listed = await s3.listKeys({ prefix });
      expect('cors-browser-prefix-empty', listed.status === 200 && listed.keys.length === 0, {
        count: listed.keys.length,
      });
    } catch (e) {
      recordBlocked('cors-browser-cleanup', { note: safeErrorCategory(e) });
    }
    for (const name of deployed) {
      // Pages land root-owned via docker cp; the disposable client serves
      // unprivileged, so removal runs as uid 0 inside that container only.
      sh(['exec', '-u', '0', CLIENT_CONTAINER, 'rm', '-f', `${HTML_ROOT}/${name}`]);
    }
    rmSync(tmpPos, { force: true });
    rmSync(tmpNeg, { force: true });
  }
}

function runProbe(pageUrl, mode, wantStatus) {
  const started = Date.now();
  // Container loopback always wins over --add-host, so map the approved
  // origin host at the Chromium layer to the Docker Desktop host gateway.
  const gw = sh([
    'run',
    '--rm',
    '--network',
    BROWSER_NETWORK,
    BROWSER_IMAGE,
    'getent',
    'hosts',
    'host.docker.internal',
  ]);
  const gwText = `${gw.stdout || ''} ${gw.stderr || ''}`;
  const gwIp = (gwText.match(/(\d+\.\d+\.\d+\.\d+)/) || [])[1] || '';
  if (!gwIp) {
    const snippet = gwText.replace(/\s+/g, ' ').slice(0, 100);
    return {
      pass: false,
      status: 'none',
      note: `gateway-undiscovered exit=${gw.status ?? 'unknown'} err=${snippet}`,
    };
  }
  const result = sh([
    'run',
    '--rm',
    '--network',
    BROWSER_NETWORK,
    '-v',
    `${DRIVER_PATH}:/srv/browser/cors-probe.mjs:ro`,
    '-e',
    `PAGE_URL=${pageUrl}`,
    '-e',
    `EXPECT_MODE=${mode}`,
    '-e',
    `EXPECT_STATUS=${wantStatus}`,
    '-e',
    `RESOLVER_RULES=MAP localhost ${gwIp}`,
    BROWSER_IMAGE,
    'node',
    'cors-probe.mjs',
  ]);
  const ms = Date.now() - started;
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  const verdict = /probe verdict=PASS/.test(out);
  const status = (/status=(\d+)/.exec(out) || [])[1] || 'none';
  const note = (/error=([A-Za-z]+)/.exec(out) || [])[1] || 'none';
  return {
    pass: result.status === 0 && verdict,
    status: status === 'none' ? 'none' : Number(status),
    note,
    ms,
  };
}

function parseEnvFile(path) {
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) values[line.slice(0, index).trim()] = line.slice(index + 1);
  }
  return values;
}

async function selftest() {
  const page = buildProbePage('https://example.invalid/key?sig=abc');
  const checks = [
    ['page issues PUT', page.includes("method: 'PUT'")],
    ['page sends content type', page.includes('application/octet-stream')],
    ['page reports status', page.includes('RESULT status=')],
    ['page reports error name', page.includes('RESULT error=')],
    [
      'page embeds the exact URL once',
      page.split('https://example.invalid/key?sig=abc').length === 2,
    ],
  ];
  let failed = 0;
  for (const [label, cond] of checks) {
    if (!cond) failed += 1;
    process.stdout.write(`${cond ? 'PASS' : 'FAIL'} browser-page ${label}\n`);
  }
  if (failed > 0) process.exit(1);
  process.stdout.write('browser-page selftest: all pass\n');
}

const invokedAsMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  if (process.argv.includes('--selftest')) {
    await selftest();
  } else {
    const drmEnv = parseEnvFile(join(REPO_ROOT, 'education-drm-service', '.env'));
    const platformEnv = parseEnvFile(join(REPO_ROOT, '.env'));
    const ctx = buildContext({ ...drmEnv, ...platformEnv, R2_APPROVED_ORIGIN: APPROVED_ORIGIN });
    if (process.argv.includes('--behavior-only')) {
      // Configuration-read denial is recorded by the separate corsProof run;
      // this mode reports browser CORS behavior on its own evidence.
      step('cors-behavior-only');
      const result = await corsBrowserProof(ctx);
      if (!result.proven) recordBlocked('cors-behavior-only', { note: result.reason });
    } else {
      const config = await corsProof(ctx);
      if (config.authorized && config.preflightProven) {
        await corsBrowserProof(ctx);
      } else {
        recordBlocked('cors-browser', {
          note: 'skipped: configuration proof did not authorize browser stages',
        });
      }
    }
    summary();
  }
}
