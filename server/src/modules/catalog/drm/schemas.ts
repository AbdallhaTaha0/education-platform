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

export interface ValidatedDeviceEntry {
  reference: string;
  status: string;
  createdAt: string;
  lastSeenAt: string;
  activePlayback: boolean;
  releasable: boolean;
}

export interface ValidatedDeviceInspection {
  devices: ValidatedDeviceEntry[];
  truncated: boolean;
  maxDevices: number;
}

function assertIsoDate(value: unknown): string {
  if (typeof value !== 'string') fail();
  const parsed = Date.parse(value as string);
  if (!Number.isFinite(parsed)) fail();
  return new Date(parsed).toISOString();
}

function assertBool(value: unknown): boolean {
  if (typeof value !== 'boolean') fail();
  return value as boolean;
}

export function validateDeviceInspectionResponse(body: unknown): ValidatedDeviceInspection {
  if (!isRecord(body)) fail();
  const rawDevices = body['devices'];
  if (!Array.isArray(rawDevices) || rawDevices.length > 100) fail();
  const devices: ValidatedDeviceEntry[] = (rawDevices as unknown[]).map((entry) => {
    if (!isRecord(entry)) fail();
    const r = entry as Record<string, unknown>;
    return {
      reference: assertUuidField(r['id']),
      status: typeof r['status'] === 'string' ? (r['status'] as string).slice(0, 32) : (() => { fail(); return ''; })(),
      createdAt: assertIsoDate(r['createdAt'] ?? r['created_at']),
      lastSeenAt: assertIsoDate(r['lastSeenAt'] ?? r['last_seen_at']),
      activePlayback: assertBool(r['activePlayback'] ?? r['active_playback']),
      releasable: assertBool(r['releasable'] ?? false),
    };
  });
  const truncated = body['truncated'];
  if (typeof truncated !== 'boolean') fail();
  const maxDevices = body['maxDevices'];
  if (typeof maxDevices !== 'number' || !Number.isSafeInteger(maxDevices) || maxDevices <= 0 || maxDevices > 1000) fail();
  return { devices, truncated: truncated as boolean, maxDevices: maxDevices as number };
}

export function validateDeviceReleaseResponse(body: unknown): { released: boolean } {
  if (!isRecord(body)) fail();
  if (typeof body['released'] !== 'boolean') fail();
  return { released: body['released'] as boolean };
}
