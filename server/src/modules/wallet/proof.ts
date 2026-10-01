import { createHash } from 'node:crypto';
import { ApiError } from '../identity/errors.js';
import { MAX_PROOF_BYTES } from './errors.js';

const ALLOWED: Record<string, { mime: string; exts: string[] }> = {
  jpg: { mime: 'image/jpeg', exts: ['jpg', 'jpeg'] },
  png: { mime: 'image/png', exts: ['png'] },
  pdf: { mime: 'application/pdf', exts: ['pdf'] },
};

export interface ValidatedProof {
  filename: string;
  mime: string;
  bytes: Buffer;
  hash: string;
}

function fail(reason: string): never {
  throw new ApiError(400, 'VALIDATION_ERROR', `Invalid proof file: ${reason}.`, { field: 'proof' });
}

/** Declared extension must match the declared MIME family (anti-spoofing). */
function checkExtensionPair(filename: string, mime: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || filename.includes('/') || filename.includes('\\') || filename.includes('..'))
    fail('unsafe filename');
  const ext = filename.slice(dot + 1).toLowerCase();
  for (const [kind, rule] of Object.entries(ALLOWED)) {
    if (rule.exts.includes(ext)) {
      if (mime !== rule.mime) fail('extension and content type do not match');
      return kind;
    }
  }
  fail('unsupported file type (JPG, PNG or PDF only)');
}

/** Magic-byte + minimal-structure validation of decoded bytes. */
function checkSignature(kind: string, bytes: Buffer): void {
  if (kind === 'jpg') {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) fail('not a JPEG file');
    if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9)
      fail('truncated JPEG file');
  } else if (kind === 'png') {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < 33 || !sig.every((b, i) => bytes[i] === b)) fail('not a PNG file');
    if (bytes.toString('ascii', 12, 16) !== 'IHDR') fail('malformed PNG file');
    if (!bytes.includes(Buffer.from('IEND'))) fail('truncated PNG file');
  } else {
    if (bytes.length < 8 || bytes.toString('ascii', 0, 5) !== '%PDF-') fail('not a PDF file');
    if (!bytes.includes(Buffer.from('%%EOF'))) fail('truncated PDF file');
  }
}

/**
 * Validate a base64 proof upload without persisting anything. Enforces the
 * 5 MiB bound before decoding (base64 length) and after (byte length),
 * then extension/MIME pairing, magic bytes, and SHA-256 content hash.
 */
export function validateProof(filename: unknown, mime: unknown, base64: unknown): ValidatedProof {
  if (typeof filename !== 'string' || filename.length === 0 || filename.length > 180)
    fail('unsafe filename');
  if (typeof mime !== 'string') fail('unsupported file type');
  if (typeof base64 !== 'string' || base64.length === 0) fail('empty file');
  // 5 MiB cap enforced on the wire form first: ceil(5MiB/3)*4 + margin.
  if (base64.length > 7_100_000) fail('file exceeds the 5 MiB limit');
  const kind = checkExtensionPair(filename, mime);
  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, 'base64');
  } catch {
    fail('undecodable file');
  }
  if (bytes.length === 0 || bytes.length > MAX_PROOF_BYTES) fail('file exceeds the 5 MiB limit');
  checkSignature(kind, bytes);
  return {
    filename,
    mime,
    bytes,
    hash: createHash('sha256').update(bytes).digest('hex'),
  };
}
