/**
 * Stage: R2 CORS verification (TEST-ONLY).
 *
 * Requires owner-authorized visibility. `AccessDenied` is recorded as BLOCKED
 * evidence, never interpreted. Only an origin the owner has already approved
 * for this environment may be used; the harness never invents one and never
 * suggests a wildcard.
 */

import { expect, recordBlocked, step } from '../lib/safe-log.mjs';

export async function corsProof(ctx) {
  step('cors');
  const s3 = ctx.s3;

  // 1. Read the actual configuration.
  const cors = await s3.getBucketCors();
  if (cors.denied) {
    recordBlocked('cors-rules', {
      status: cors.status,
      note: 'owner-authorized CORS visibility is required',
    });
    return { authorized: false, status: cors.status };
  }

  expect('cors-rules-readable', cors.status === 200, {
    status: cors.status,
    count: cors.rules.length,
  });

  if (!ctx.approvedOrigin) {
    recordBlocked('cors-preflight', { note: 'R2_APPROVED_ORIGIN is required' });
    return { authorized: true, preflightProven: false };
  }

  // 2. Validate the rule shape against the narrow requirement.
  for (const rule of cors.rules) {
    step('cors-rule');
    const hasWildcardOrigin = rule.origins.includes('*');
    expect('cors-no-wildcard-origin', !hasWildcardOrigin, {
      origin: rule.origins.join(','),
      count: rule.origins.length,
    });
  }
  const matchingRule = cors.rules.find((rule) => isNarrowCorsRule(rule, ctx.approvedOrigin));
  expect('cors-approved-rule', Boolean(matchingRule), {
    origin: ctx.approvedOrigin,
    count: cors.rules.length,
  });

  // 3. Browser-style preflight, only for an owner-approved origin.

  const preflight = await preflightPut(ctx, ctx.smokePrefix);
  expect('cors-preflight-status', preflight.status >= 200 && preflight.status < 300, {
    origin: ctx.approvedOrigin,
    status: preflight.status,
    ms: preflight.elapsedMs,
  });
  const allowOrigin = preflight.headers.get('access-control-allow-origin');
  expect('cors-preflight-allows-origin', allowOrigin === ctx.approvedOrigin, {
    origin: ctx.approvedOrigin,
    status: preflight.status,
  });
  const allowMethods = (preflight.headers.get('access-control-allow-methods') || '').toUpperCase();
  expect('cors-preflight-allows-put', allowMethods.includes('PUT'), { status: preflight.status });

  // 4. Presigned PUT carrying the same approved Origin.
  const key = `${ctx.smokePrefix}cors-probe.txt`;
  const body = Buffer.from(`cors ${ctx.runId}`);
  const url = s3.presignPut({ key, expiresIn: 300, contentType: 'text/plain' });
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain', Origin: ctx.approvedOrigin },
      body,
    });
    const elapsedMs = Date.now() - started;
    expect('cors-presigned-put', response.status === 200, {
      origin: ctx.approvedOrigin,
      status: response.status,
      bytes: body.length,
      ms: elapsedMs,
    });
  } finally {
    const cleanup = await s3.deleteObject({ key, scopePrefix: ctx.smokePrefix });
    expect('cors-probe-cleaned', cleanup.status === 204 || cleanup.status === 200, {
      status: cleanup.status,
    });
  }
  const listed = await s3.listKeys({ prefix: ctx.smokePrefix });
  expect('cors-list-status', listed.status === 200, { status: listed.status });
  expect('cors-prefix-empty', listed.status === 200 && listed.keys.length === 0, {
    count: listed.keys.length,
  });

  return { authorized: true, preflightProven: true, status: preflight.status };
}

export function isNarrowCorsRule(rule, approvedOrigin) {
  const methods = rule.methods.map((method) => method.toUpperCase());
  return (
    approvedOrigin.length > 0 &&
    !rule.origins.includes('*') &&
    rule.origins.includes(approvedOrigin) &&
    methods.includes('PUT') &&
    methods.every((method) => ['GET', 'HEAD', 'PUT'].includes(method)) &&
    rule.headers.some((header) => header.toLowerCase() === 'content-type')
  );
}

async function preflightPut(ctx, prefix) {
  const endpointHost = new globalThis.URL(ctx.env.S3_ENDPOINT).host;
  const origin = new globalThis.URL(ctx.approvedOrigin);
  const started = Date.now();
  const response = await fetch(
    `https://${ctx.env.S3_BUCKET}.${endpointHost}/${prefix}cors-preflight-probe.txt`,
    {
      method: 'OPTIONS',
      headers: {
        Origin: ctx.approvedOrigin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    },
  );
  void origin;
  return { status: response.status, headers: response.headers, elapsedMs: Date.now() - started };
}
