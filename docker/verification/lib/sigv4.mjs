/**
 * Minimal AWS Signature Version 4 signing for Cloudflare R2 (TEST-ONLY).
 *
 * R2 exposes the S3 API, so the direct object-storage checks in the Pre-M5
 * harness can be made with provider-standard signing. This module implements
 * only what the harness needs: signed-header requests (PUT, HEAD, GET, DELETE,
 * LIST, GetBucketCors) and presigned URLs for the browser-style upload proof.
 *
 * It reads credentials from the environment. It never returns or logs them.
 */

import crypto from 'node:crypto';

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

/** RFC 3986 encoding: S3 requires '*' escaped, which encodeURIComponent leaves. */
function uriEncode(value, encodeSlash = true) {
  let out = encodeURIComponent(String(value));
  out = out.replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  if (!encodeSlash) return out;
  return out;
}

function encodeKeyPath(key) {
  return String(key)
    .split('/')
    .map((segment) => uriEncode(segment, false))
    .join('/');
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

/** Virtual-host style host: <bucket>.<account-host>. Path style is not used. */
function resolveTarget({ endpoint, bucket, forcePathStyle }) {
  const url = new globalThis.URL(endpoint);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error('S3 endpoint must be http(s)');
  }
  const host = url.host;
  let requestHost = host;
  if (!forcePathStyle) {
    requestHost = `${bucket}.${host}`;
  }
  return {
    origin: `${url.protocol}//${requestHost}`,
    basePath: forcePathStyle ? `/${bucket}` : '',
    host: requestHost,
  };
}

function canonicalQuery(params) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => [uriEncode(k), uriEncode(v)]);
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

function buildCanonicalRequest({ method, path, query, headers, payloadHash }) {
  const names = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const canonicalHeaders = names
    .map((name) => {
      const key = Object.keys(headers).find((h) => h.toLowerCase() === name);
      return `${name}:${String(headers[key]).trim()}\n`;
    })
    .join('');
  const signedHeaders = names.join(';');
  return [method.toUpperCase(), path, query, canonicalHeaders, signedHeaders, payloadHash].join(
    '\n',
  );
}

function signingKey({ secretAccessKey, dateStamp, region }) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

function signRequest(options) {
  const {
    method = 'GET',
    endpoint,
    bucket,
    region = 'auto',
    accessKeyId,
    secretAccessKey,
    forcePathStyle = false,
    key = '',
    query = {},
    body = null,
    extraHeaders = {},
    contentType = undefined,
    now = new Date(),
  } = options;

  const target = resolveTarget({ endpoint, bucket, forcePathStyle });
  const stamp = amzDate(now);
  const dateStamp = stamp.slice(0, 8);
  const payloadHash = body === null ? sha256Hex('') : sha256Hex(body);
  const path = `${target.basePath}${key ? `/${encodeKeyPath(key)}` : ''}` || '/';

  const headers = {
    host: target.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': stamp,
    ...extraHeaders,
  };
  if (contentType) headers['content-type'] = contentType;

  const canonical = buildCanonicalRequest({
    method,
    path,
    query: canonicalQuery(query),
    headers,
    payloadHash,
  });
  const scope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [ALGORITHM, stamp, scope, sha256Hex(canonical)].join('\n');
  const signature = crypto
    .createHmac('sha256', signingKey({ secretAccessKey, dateStamp, region }))
    .update(stringToSign)
    .digest('hex');

  const signedHeaderNames = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort()
    .join(';');

  return {
    url: `${target.origin}${path}${canonicalQuery(query) ? `?${canonicalQuery(query)}` : ''}`,
    method: method.toUpperCase(),
    headers: {
      ...headers,
      authorization: `${ALGORITHM} Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
    },
    body,
    payloadHash,
  };
}

/** Presigned URL. The query string is a credential and must never be printed. */
function presignUrl(options) {
  const {
    method = 'PUT',
    endpoint,
    bucket,
    region = 'auto',
    accessKeyId,
    secretAccessKey,
    forcePathStyle = false,
    key,
    expiresIn = 900,
    now = new Date(),
    contentType = undefined,
  } = options;

  const target = resolveTarget({ endpoint, bucket, forcePathStyle });
  const stamp = amzDate(now);
  const dateStamp = stamp.slice(0, 8);
  const path = `${target.basePath}/${encodeKeyPath(key)}`;
  const signedHeaderNames = 'host';
  const query = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${accessKeyId}/${dateStamp}/${region}/${SERVICE}/aws4_request`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaderNames,
  };
  const canonical = buildCanonicalRequest({
    method,
    path,
    query: canonicalQuery(query),
    headers: { host: target.host },
    payloadHash: 'UNSIGNED-PAYLOAD',
  });
  const scope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [ALGORITHM, stamp, scope, sha256Hex(canonical)].join('\n');
  const signature = crypto
    .createHmac('sha256', signingKey({ secretAccessKey, dateStamp, region }))
    .update(stringToSign)
    .digest('hex');
  const signed = `${canonicalQuery(query)}&X-Amz-Signature=${signature}`;
  return `${target.origin}${path}?${signed}`;
}

export { signRequest, presignUrl, encodeKeyPath, sha256Hex, amzDate };
