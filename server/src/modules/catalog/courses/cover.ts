import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { validateProof } from '../../wallet/proof.js';
import { assertUuid, rejectUnknownFields } from '../validation.js';

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
  if (!width || !height || width > 2048 || height > 2048)
    throw new ApiError(400, 'VALIDATION_ERROR', 'Course photo dimensions must be between 1 and 2048 pixels.');
}

export function validateCourseCover(raw: unknown) {
  rejectUnknownFields(raw, new Set(['filename', 'mime', 'base64']));
  const input = raw as Record<string, unknown>;
  if (!['image/jpeg', 'image/png'].includes(String(input.mime)) ||
      typeof input.base64 !== 'string' || input.base64.length > Math.ceil(131072 / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64))
    throw new ApiError(400, 'VALIDATION_ERROR', 'Use a JPEG or PNG course photo up to 128 KiB.', { field: 'coverImage' });
  const image = validateProof(input.filename, input.mime, input.base64);
  if (image.bytes.length > 131072) throw new ApiError(400, 'VALIDATION_ERROR', 'Course photo is too large.');
  checkDimensions(image.bytes, image.mime);
  return { bytes: new Uint8Array(image.bytes), mime: image.mime };
}

/** Draft covers are visible only to administrators; public reads check course visibility every time. */
export async function readCourseCover(prisma: PrismaClient, courseId: string, admin = false) {
  assertUuid(courseId, 'courseId');
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { cover: true } });
  if (!course?.cover || course.historical || (!admin && (course.status !== 'PUBLISHED' || course.deletionRequestedAt)))
    throw new ApiError(404, 'NOT_FOUND', 'Course photo not found.');
  return course.cover;
}
