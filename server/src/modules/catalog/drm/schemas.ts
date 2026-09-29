import { ApiError } from '../../identity/errors.js';
import { UUID_PATTERN } from '../validation.js';

const UUID_RE = UUID_PATTERN;
const HTTP_URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

const KNOWN_MEDIA_STATUSES = new Set([
  'UPLOADED',
  'PROCESSING',
  'TRANSCODING',
  'PACKAGING',
  'READY',
  'FAILED',
  'DELETING',
  'DELETE_FAILED',
]);

const KNOWN_DELETION_STATUSES = new Set(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(): never {
  throw new ApiError(502, 'DRM_MALFORMED', 'External response malformed.');
}

export function assertUuidField(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) fail();
  return value as string;
}

function assertStatusField(value: unknown, known: Set<string>): string {
  if (typeof value !== 'string' || !known.has(value)) fail();
  return value;
}

function assertUploadUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || !HTTP_URL_RE.test(value)) fail();
  const parsed = new URL(value as string);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') fail();
  if (parsed.username !== '' || parsed.password !== '') fail();
  return value as string;
}

export interface ValidatedRegistration {
  assetId: string;
  status: string;
  uploadUrl?: string;
  idempotent?: boolean;
}

export function validateRegistrationResponse(body: unknown): ValidatedRegistration {
  if (!isRecord(body)) fail();
  const assetId = assertUuidField(body['assetId']);
  const status = assertStatusField(body['status'], KNOWN_MEDIA_STATUSES);
  const out: ValidatedRegistration = { assetId, status };
  if (body['uploadUrl'] !== undefined) out.uploadUrl = assertUploadUrl(body['uploadUrl']);
  if (body['idempotent'] !== undefined) {
    if (typeof body['idempotent'] !== 'boolean') fail();
    out.idempotent = body['idempotent'] as boolean;
  }
  return out;
}

export interface ValidatedCompletion {
  status: string;
}

export function validateCompletionResponse(body: unknown): ValidatedCompletion {
  if (!isRecord(body)) fail();
  return { status: assertStatusField(body['status'], KNOWN_MEDIA_STATUSES) };
}

export interface ValidatedMediaStatus {
  status: string;
}

export function validateMediaStatusResponse(body: unknown): ValidatedMediaStatus {
  if (!isRecord(body)) fail();
  return { status: assertStatusField(body['status'], KNOWN_MEDIA_STATUSES) };
}

export interface ValidatedDeletionRequest {
  deletionId: string;
  status: string;
  duplicate?: boolean;
  scheduled?: boolean;
}

export function validateDeletionRequestResponse(body: unknown): ValidatedDeletionRequest {
  if (!isRecord(body)) fail();
  const deletionId = assertUuidField(body['deletionId']);
  const status = assertStatusField(body['status'], KNOWN_DELETION_STATUSES);
  const out: ValidatedDeletionRequest = { deletionId, status };
  if (body['duplicate'] !== undefined) {
    if (typeof body['duplicate'] !== 'boolean') fail();
    out.duplicate = body['duplicate'] as boolean;
  }
  if (body['scheduled'] !== undefined) {
    if (typeof body['scheduled'] !== 'boolean') fail();
    out.scheduled = body['scheduled'] as boolean;
  }
  return out;
}

export interface ValidatedDeletionStatus {
  status: string;
}

export function validateDeletionStatusResponse(body: unknown): ValidatedDeletionStatus {
  if (!isRecord(body)) fail();
  return { status: assertStatusField(body['status'], KNOWN_DELETION_STATUSES) };
}
