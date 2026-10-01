/** Shared disposable-DRM-tenant bootstrap with verify-after-write.
 *
 * Rules (identical for the main and second verification applications):
 * - Existing local credentials are preserved on retries and never overwritten
 *   with newly generated, unverified values.
 * - HTTP 409 from POST /v1/applications means "exists", never proof that the
 *   stored secret is valid.
 * - After creation OR conflict, the candidate credentials are authenticated
 *   through the non-mutating probe (POST /v1/media with an empty body, which
 *   a correctly authenticated application answers 400 for validation).
 *   401/403, unexpected statuses and network failures all fail safely with a
 *   sanitized message that names variables, never values.
 * - Values are written to the ignored env file only after successful
 *   authentication. A half-present pair (id without secret or vice versa)
 *   fails immediately with a recovery message instead of inventing material.
 *
 * No application-deletion API exists; created applications are retained.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export function parseEnv(path) {
  const values = new Map();
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index > 0) values.set(line.slice(0, index).trim(), line.slice(index + 1));
  }
  return values;
}

export function setEnvValues(path, values) {
  let text = readFileSync(path, 'utf8');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  for (const [name, value] of Object.entries(values)) {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    if (pattern.test(text)) text = text.replace(pattern, line);
    else text = `${text.replace(/\s*$/, '')}${newline}${line}${newline}`;
  }
  writeFileSync(path, text, { encoding: 'utf8', mode: 0o600 });
}

/** Non-mutating authentication probe. Returns { ok, status } or { networkError }. */
export async function probeApplication(baseUrl, clientId, clientSecret) {
  let response;
  try {
    response = await fetch(`${baseUrl}/v1/media`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
      },
      body: '{}',
    });
  } catch {
    return { networkError: true };
  }
  try {
    await response.text().then(() => {});
  } catch {
    /* body irrelevant */
  }
  return { ok: response.status === 400, status: response.status };
}

/**
 * Bootstrap one verification application.
 * opts: { platformEnvPath, adminToken, appName, idVar, secretVar, idPrefix,
 *         baseUrl, extraValues }
 * Returns { created: boolean, reused: boolean }. Throws sanitized errors.
 */
export async function bootstrapTenant(opts) {
  const {
    platformEnvPath,
    adminToken,
    appName,
    idVar,
    secretVar,
    idPrefix,
    baseUrl,
    extraValues = {},
  } = opts;
  const stored = parseEnv(platformEnvPath);
  const storedId = stored.get(idVar);
  const storedSecret = stored.get(secretVar);

  if ((storedId && !storedSecret) || (!storedId && storedSecret)) {
    throw new Error(
      `half-present credentials for ${idVar}/${secretVar}: restore the matching pair or remove both variables for a fresh identity (local file unchanged)`,
    );
  }

  let candidateId = storedId;
  let candidateSecret = storedSecret;
  let preExisting = true;
  if (!candidateId || !candidateSecret) {
    // First run: generate, but persist only after successful authentication.
    candidateId = `${idPrefix}${randomBytes(10).toString('hex')}`;
    candidateSecret = randomBytes(40).toString('base64url');
    preExisting = false;
  }

  let createStatus;
  try {
    const response = await fetch(`${baseUrl}/v1/applications`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: appName,
        client_id: candidateId,
        client_secret: candidateSecret,
        drm_provider: 'CLEAR_KEY',
      }),
    });
    try {
      await response.text().then(() => {});
    } catch {
      /* body irrelevant */
    }
    createStatus = response.status;
  } catch {
    throw new Error(`tenant service unreachable at bootstrap (local file unchanged)`);
  }
  if (createStatus !== 201 && createStatus !== 409) {
    throw new Error(`tenant bootstrap refused with status ${createStatus} (local file unchanged)`);
  }

  const probe = await probeApplication(baseUrl, candidateId, candidateSecret);
  if (probe.networkError) {
    throw new Error(`authentication probe unreachable after bootstrap (local file unchanged)`);
  }
  if (!probe.ok) {
    throw new Error(
      `stored credentials for ${idVar} do not authenticate (status ${probe.status}); ` +
        `kept local file unchanged — restore the matching secret or remove both ${idVar}/${secretVar} for a fresh identity`,
    );
  }

  setEnvValues(platformEnvPath, {
    [idVar]: candidateId,
    [secretVar]: candidateSecret,
    ...extraValues,
  });
  return { created: createStatus === 201 && !preExisting, reused: preExisting };
}
