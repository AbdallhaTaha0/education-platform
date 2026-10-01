import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/modules/identity/errors.js';
import { validateProof } from '../../src/modules/wallet/proof.js';

function expectValidationError(fn: () => unknown): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('VALIDATION_ERROR');
    return;
  }
  expect.unreachable('expected VALIDATION_ERROR');
}

function minimalJpeg(): string {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]).toString('base64');
}

function minimalPng(): string {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdrLen = [0x00, 0x00, 0x00, 0x0d];
  const ihdr = [0x49, 0x48, 0x44, 0x52];
  const data = new Array(13).fill(0);
  const crc = [0x00, 0x00, 0x00, 0x00];
  const iendLen = [0x00, 0x00, 0x00, 0x00];
  const iend = [0x49, 0x45, 0x4e, 0x44];
  return Buffer.from([
    ...sig,
    ...ihdrLen,
    ...ihdr,
    ...data,
    ...crc,
    ...iendLen,
    ...iend,
    ...crc,
  ]).toString('base64');
}

function minimalPdf(): string {
  return Buffer.from('%PDF-1.4\n1 0 obj<</>>endobj\ntrailer<</>>\n%%EOF', 'ascii').toString(
    'base64',
  );
}

describe('proof validation', () => {
  it('accepts a minimal JPEG', () => {
    const proof = validateProof('receipt.jpg', 'image/jpeg', minimalJpeg());
    expect(proof.mime).toBe('image/jpeg');
    expect(proof.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts a minimal PNG and PDF', () => {
    expect(validateProof('shot.PNG', 'image/png', minimalPng()).mime).toBe('image/png');
    expect(validateProof('transfer.pdf', 'application/pdf', minimalPdf()).mime).toBe(
      'application/pdf',
    );
  });

  it('rejects extension/MIME mismatch (spoofing)', () => {
    expectValidationError(() => validateProof('evil.pdf', 'image/jpeg', minimalJpeg()));
    expectValidationError(() => validateProof('evil.jpg', 'application/pdf', minimalPdf()));
  });

  it('rejects wrong magic bytes and truncated files', () => {
    const notJpeg = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString('base64');
    expectValidationError(() => validateProof('a.jpg', 'image/jpeg', notJpeg));
    const truncated = Buffer.from([0xff, 0xd8, 0x00, 0x00]).toString('base64');
    expectValidationError(() => validateProof('a.jpg', 'image/jpeg', truncated));
    const noEof = Buffer.from('%PDF-1.4\nno end here', 'ascii').toString('base64');
    expectValidationError(() => validateProof('a.pdf', 'application/pdf', noEof));
  });

  it('rejects path traversal, bad extensions, and oversize payloads', () => {
    expectValidationError(() => validateProof('../evil.jpg', 'image/jpeg', minimalJpeg()));
    expectValidationError(() =>
      validateProof('run.exe', 'application/x-msdownload', minimalJpeg()),
    );
    expectValidationError(() => validateProof('big.jpg', 'image/jpeg', 'A'.repeat(7_100_001)));
    expectValidationError(() => validateProof('empty.jpg', 'image/jpeg', ''));
  });
});
