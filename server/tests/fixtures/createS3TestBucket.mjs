import { createHash, createHmac } from 'node:crypto';

const endpoint = new URL(process.env.STORAGE_ENDPOINT ?? '');
const bucket = process.env.STORAGE_BUCKET ?? '';
const region = process.env.STORAGE_REGION ?? '';
const accessKey = process.env.STORAGE_ACCESS_KEY_ID ?? '';
const secretKey = process.env.STORAGE_SECRET_ACCESS_KEY ?? '';
if (!endpoint.hostname || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || !region || !accessKey || !secretKey) {
  throw new Error('Disposable S3 test fixture configuration is incomplete.');
}

const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
const date = now.slice(0, 8);
const payloadHash = createHash('sha256').update('').digest('hex');
const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
const canonicalHeaders = `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${now}\n`;
const canonicalRequest = ['PUT', `/${bucket}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
const scope = `${date}/${region}/s3/aws4_request`;
const stringToSign = ['AWS4-HMAC-SHA256', now, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, date), region), 's3'), 'aws4_request');
const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
const response = await fetch(`${endpoint.origin}/${bucket}`, {
  method: 'PUT',
  headers: { 'x-amz-date': now, 'x-amz-content-sha256': payloadHash, authorization },
});
if (!response.ok && response.status !== 409) {
  await response.body?.cancel();
  throw new Error(`Disposable S3 bucket setup failed with HTTP ${response.status}.`);
}
await response.body?.cancel();
console.log('Private disposable S3 test bucket is ready.');
