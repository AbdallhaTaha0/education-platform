import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { validateProof } from './proof.js';

export const MAX_QR_BYTES = 128 * 1024;
function checkDimensions(bytes: Buffer, mime: string) {
  let width = 0, height = 0;
  if (mime === 'image/png') { width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20); }
  else {
    let position = 2;
    while (position + 4 <= bytes.length) {
      if (bytes[position] !== 0xff) break;
      while (bytes[position] === 0xff) position++;
      const marker = bytes[position++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker! >= 0xd0 && marker! <= 0xd7)) continue;
      if (position + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(position);
      if (length < 2 || position + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker!) && length >= 8) {
        height = bytes.readUInt16BE(position + 3); width = bytes.readUInt16BE(position + 5); break;
      }
      position += length;
    }
  }
  if (!width || !height || width > 2048 || height > 2048) throw new ApiError(400, 'VALIDATION_ERROR', 'QR image dimensions must be between 1 and 2048 pixels.');
}
export function validateQr(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid QR image.');
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(k => !['filename', 'mime', 'base64', 'version'].includes(k)) ||
      !Number.isSafeInteger(input.version) || Number(input.version) < 1 || Number(input.version) >= 2147483647 ||
      !['image/png', 'image/jpeg'].includes(String(input.mime)) || typeof input.base64 !== 'string' ||
      input.base64.length > Math.ceil(MAX_QR_BYTES / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Use a PNG or JPEG QR image up to 128 KiB.');
  }
  const image = validateProof(input.filename, input.mime, input.base64);
  if (image.bytes.length > MAX_QR_BYTES) throw new ApiError(400, 'VALIDATION_ERROR', 'QR image is too large.');
  checkDimensions(image.bytes, image.mime);
  return { image, version: Number(input.version) };
}

export async function saveQr(prisma: PrismaClient, body: unknown) {
  const { image, version } = validateQr(body);
  return changeQr(prisma, version, image.bytes, image.mime);
}
export async function removeQr(prisma: PrismaClient, body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid QR version.');
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(k => k !== 'version') || !Number.isSafeInteger(input.version) || Number(input.version) < 1 || Number(input.version) >= 2147483647) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid QR version.');
  return changeQr(prisma, Number(input.version), null, null);
}
async function changeQr(prisma: PrismaClient, version: number, qrBytes: Buffer | null, qrMime: string | null) {
  const result = await prisma.instaPaySettings.updateMany({ where: { id: 1, version }, data: { qrBytes: qrBytes ? new Uint8Array(qrBytes) : null, qrMime, version: { increment: 1 } } });
  if (result.count !== 1) throw new ApiError(409, 'OFFER_CHANGED', 'Receiving details changed. Reload before changing the QR image.');
}

export async function readQr(prisma: PrismaClient, admin: boolean) {
  const row = await prisma.instaPaySettings.findUnique({ where: { id: 1 }, select: { enabled: true, qrBytes: true, qrMime: true } });
  if (!row?.qrBytes || !row.qrMime || (!admin && !row.enabled)) throw new ApiError(404, 'NOT_FOUND', 'QR image is not available.');
  return { bytes: Buffer.from(row.qrBytes), mime: row.qrMime };
}
