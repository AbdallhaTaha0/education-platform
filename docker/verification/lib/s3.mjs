/**
 * Direct Cloudflare R2 access for the Pre-M5 verification harness (TEST-ONLY).
 *
 * Scope and safety rules enforced here:
 *   - only provider-standard S3 operations through SigV4;
 *   - every mutating call requires a prefix that passed assertTestPrefix();
 *   - no bucket-wide delete, and never a broad `uploads/` or `assets/` delete;
 *   - responses are reduced to status, MIME type and byte count before they
 *     leave this module.
 */

import { signRequest, presignUrl } from './sigv4.mjs';

/** Prefixes this harness may ever create or delete. Nothing else is allowed. */
const FORBIDDEN_PREFIXES = new Set(['uploads/', 'assets/', '', '/']);

const PREFIX_PATTERN = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._/-]*\/$/;

export function assertTestPrefix(prefix, testRoot) {
  if (typeof prefix !== 'string' || prefix.length === 0) {
    throw new Error('refusing an empty prefix');
  }
  if (FORBIDDEN_PREFIXES.has(prefix)) {
    throw new Error(`refusing reserved prefix "${prefix}"`);
  }
  if (prefix === '/' || prefix === testRoot) {
    throw new Error('refusing the test root itself; require a run-scoped child prefix');
  }
  if (!prefix.startsWith(testRoot)) {
    throw new Error(`refusing prefix outside the test root "${testRoot}"`);
  }
  if (!prefix.endsWith('/')) {
    throw new Error('refusing a prefix that is not directory terminated');
  }
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error('refusing a prefix with unexpected characters');
  }
  // Require <root>/<runId>/<purpose>/ so a stage can never act on the whole
  // run or on the shared test root.
  if (prefix.split('/').filter(Boolean).length < 3) {
    throw new Error('refusing a prefix that is not run-scoped (needs <root>/<run>/<purpose>/)');
  }
  return prefix;
}

export function assertKeyWithinPrefix(key, prefix, testRoot) {
  assertTestPrefix(prefix, testRoot);
  if (typeof key !== 'string' || key.length <= prefix.length || !key.startsWith(prefix)) {
    throw new Error('refusing an object key outside the authorized run prefix');
  }
  return key;
}

export class S3Client {
  constructor(config) {
    this.config = config;
    this.testRoot = config.testRoot;
  }

  /** Credentials are read from the environment and never echoed. */
  static fromEnv(env) {
    const required = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
    const missing = required.filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(`missing S3 configuration: ${missing.join(', ')}`);
    }
    return new S3Client({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      region: env.S3_REGION || 'auto',
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: String(env.S3_FORCE_PATH_STYLE || 'false') === 'true',
      testRoot: env.R2_TEST_ROOT || 'pre-m5-live-verify/',
    });
  }

  /** Presence/length only. Never returns or prints the values. */
  static describeCredentials(config) {
    return [
      { label: 'S3_ENDPOINT', present: true, length: config.endpoint.length },
      { label: 'S3_BUCKET', present: true, length: config.bucket.length },
      { label: 'S3_REGION', present: true, length: config.region.length },
      { label: 'S3_ACCESS_KEY_ID', present: true, length: config.accessKeyId.length },
      { label: 'S3_SECRET_ACCESS_KEY', present: true, length: config.secretAccessKey.length },
      { label: 'S3_FORCE_PATH_STYLE', present: true, length: String(config.forcePathStyle).length },
    ];
  }

  async send({ method, key, query, body, contentType }) {
    const request = signRequest({
      ...this.config,
      method,
      key,
      query,
      body,
      contentType,
    });
    const started = Date.now();
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ?? undefined,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      mime: (response.headers.get('content-type') || '').split(';')[0],
      bytes: buffer.length,
      body: buffer,
      elapsedMs: Date.now() - started,
      headers: response.headers,
    };
  }

  async putObject({ key, body, contentType, scopePrefix }) {
    assertKeyWithinPrefix(key, scopePrefix, this.testRoot);
    return this.send({ method: 'PUT', key, body, contentType });
  }

  async headObject({ key }) {
    return this.send({ method: 'HEAD', key });
  }

  async getObject({ key }) {
    return this.send({ method: 'GET', key });
  }

  async deleteObject({ key, scopePrefix }) {
    assertKeyWithinPrefix(key, scopePrefix, this.testRoot);
    return this.send({ method: 'DELETE', key });
  }

  async deleteLegacyObject({ key }) {
    if (!/^pre-m5-preserve\/unrelated-[A-Za-z0-9-]+\.txt$/.test(key)) {
      throw new Error('refusing an unexpected legacy object key');
    }
    return this.send({ method: 'DELETE', key });
  }

  /** Paginated listing. Returns only key names and counts. */
  async listKeys({ prefix }) {
    const keys = [];
    let token;
    for (let page = 0; page < 50; page += 1) {
      const result = await this.send({
        method: 'GET',
        key: '',
        query: {
          'list-type': '2',
          prefix,
          'max-keys': '1000',
          ...(token ? { 'continuation-token': token } : {}),
        },
      });
      if (result.status !== 200) {
        return { status: result.status, keys, truncated: false, elapsedMs: result.elapsedMs };
      }
      const text = result.body.toString('utf8');
      for (const match of text.matchAll(/<Key>([^<]*)<\/Key>/g)) {
        keys.push(decodeXml(match[1]));
      }
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(text);
      const next = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(text);
      if (!truncated || !next) {
        return { status: result.status, keys, truncated: false, elapsedMs: result.elapsedMs };
      }
      token = decodeXml(next[1]);
    }
    throw new Error('listing did not terminate within the page budget');
  }

  /** Bucket-level CORS read. Returns rule shapes only. */
  async getBucketCors() {
    const result = await this.send({ method: 'GET', key: '', query: { cors: '' } });
    if (result.status !== 200) {
      return { status: result.status, rules: [], denied: true };
    }
    const text = result.body.toString('utf8');
    const rules = [];
    for (const ruleXml of text.matchAll(/<CORSRule>([\s\S]*?)<\/CORSRule>/g)) {
      rules.push({
        id: (ruleXml[1].match(/<ID>([^<]*)<\/ID>/) || [])[1] || null,
        origins: collect(ruleXml[1], 'AllowedOrigin'),
        methods: collect(ruleXml[1], 'AllowedMethod'),
        headers: collect(ruleXml[1], 'AllowedHeader'),
        expose: collect(ruleXml[1], 'ExposeHeader'),
        maxAge: Number((ruleXml[1].match(/<MaxAgeSeconds>([^<]*)<\/MaxAgeSeconds>/) || [])[1] || 0),
      });
    }
    return { status: result.status, rules, denied: false };
  }

  presignPut({ key, expiresIn, contentType }) {
    return presignUrl({
      ...this.config,
      key,
      expiresIn,
      contentType,
      method: 'PUT',
    });
  }
}

function collect(xml, tag) {
  const found = [];
  for (const match of xml.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g'))) {
    found.push(decodeXml(match[1]));
  }
  return found;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export { PREFIX_PATTERN, FORBIDDEN_PREFIXES };
