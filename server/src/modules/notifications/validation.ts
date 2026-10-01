import { ApiError } from '../identity/errors.js';

const MAX_SEQUENCE = 9223372036854775807n;

export function parseSequence(value: unknown, allowZero = true): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid notification sequence.');
  }
  const result = BigInt(value);
  if (result > MAX_SEQUENCE || (!allowZero && result === 0n)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid notification sequence.');
  }
  return result;
}

export interface InboxQuery { limit: number; unreadOnly: boolean; before?: bigint }

export function parseInboxQuery(query: Record<string, unknown>): InboxQuery {
  if (Object.keys(query).some((key) => !['limit', 'unreadOnly', 'cursor'].includes(key))) {
    throw new ApiError(400, 'INVALID_FIELD', 'Unknown notification query field.');
  }
  const limit = query['limit'];
  if (limit !== undefined && (typeof limit !== 'string' || !/^(?:[1-9]|[1-4][0-9]|50)$/.test(limit))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Notification limit must be between 1 and 50.');
  }
  const unread = query['unreadOnly'];
  if (unread !== undefined && unread !== 'true' && unread !== 'false') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid unread filter.');
  }
  return {
    limit: limit === undefined ? 20 : Number(limit),
    unreadOnly: unread === 'true',
    ...(query['cursor'] === undefined ? {} : { before: parseSequence(query['cursor'], false) }),
  };
}

function singleField(body: unknown, field: string): unknown {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid notification request.');
  }
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== field) {
    throw new ApiError(400, 'INVALID_FIELD', 'Only the documented notification field is allowed.');
  }
  return (body as Record<string, unknown>)[field];
}

export function parseReadState(body: unknown): boolean {
  const value = singleField(body, 'read');
  if (typeof value !== 'boolean') throw new ApiError(400, 'VALIDATION_ERROR', 'read must be a boolean.');
  return value;
}

export function parseReadAll(body: unknown): bigint {
  return parseSequence(singleField(body, 'throughSequence'));
}
