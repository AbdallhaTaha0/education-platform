/**
 * Validation utilities for learning materials.
 *
 * WebVTT parsing, filename sanitization, and MIME validation.
 * No ZIP extraction or execution - ZIP is downloadable only.
 */

import type { Readable } from 'node:stream';

export interface WebVTTValidationResult {
  valid: boolean;
  cueCount: number;
  errors: string[];
}

/**
 * Validate WebVTT content and count cues.
 * Ensures timestamps are valid and text is safe for rendering.
 */
export function validateWebVTT(content: Uint8Array): WebVTTValidationResult {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(content); }
  catch { return { valid: false, cueCount: 0, errors: ['Invalid UTF-8'] }; }
  const errors: string[] = [];
  let cueCount = 0;

  if (!/^WEBVTT[ \t]*\r?\n\r?\n/.test(text)) {
    errors.push('Missing WEBVTT header');
    return { valid: false, cueCount: 0, errors };
  }

  const lines = text.split(/\r?\n/);
  let inCue = false;
  let cueTextLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') {
      if (inCue) {
        // End of cue
        inCue = false;
        cueCount += 1;
        cueTextLines = [];
      }
      continue;
    }

    if (!inCue) {
      // Could be a cue identifier or timestamp line
      if (line.includes('-->')) {
        // Timestamp line
        if (!validateTimestampLine(line)) {
          errors.push(`Invalid timestamp format: ${line}`);
        }
        inCue = true;
        cueTextLines = [];
      } else {
        // Cue identifier - optional, just skip
      }
    } else {
      // Cue text line
      if (!validateCueText(line)) {
        errors.push(`Unsafe cue text: ${line.slice(0, 100)}`);
      }
      cueTextLines.push(line);
    }
  }

  // Handle last cue if file doesn't end with blank line
  if (inCue) {
    cueCount += 1;
  }

  return { valid: errors.length === 0 && cueCount > 0, cueCount, errors };
}

function validateTimestampLine(line: string): boolean {
  // Format: HH:MM:SS.mmm --> HH:MM:SS.mmm
  const parts = line.split('-->');
  if (parts.length !== 2) return false;

  const start = parts[0].trim();
  const end = parts[1].trim();

  if (!isValidTimestamp(start) || !isValidTimestamp(end)) return false;

  const startMs = parseTimestamp(start);
  const endMs = parseTimestamp(end);

  if (startMs >= endMs) return false;

  return true;
}

function isValidTimestamp(ts: string): boolean {
  // HH:MM:SS.mmm or MM:SS.mmm or H:MM:SS.mmm
  const regex = /^(\d{1,2}:)?([0-5]?\d):([0-5]\d)\.(\d{3})$/;
  return regex.test(ts);
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const sMs = parts[2].split('.');
    const s = parseInt(sMs[0], 10);
    const ms = parseInt(sMs[1], 10);
    return ((h * 60 + m) * 60 + s) * 1000 + ms;
  } else if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const sMs = parts[1].split('.');
    const s = parseInt(sMs[0], 10);
    const ms = parseInt(sMs[1], 10);
    return (m * 60 + s) * 1000 + ms;
  }
  return 0;
}

function validateCueText(text: string): boolean {
  // Basic XSS prevention: reject script tags, event handlers, javascript: URLs
  const lower = text.toLowerCase();
  if (lower.includes('<script') || lower.includes('javascript:') || lower.includes('onerror') || lower.includes('onload')) {
    return false;
  }
  // Reject null bytes and control characters except tab, newline, carriage return
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0) return false;
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) return false;
  }
  return true;
}

/**
 * Parse WebVTT cues for detailed inspection (used in tests/admin).
 */
export function parseWebVTTCues(content: Uint8Array): Array<{ start: number; end: number; text: string }> {
  const text = new TextDecoder('utf-8').decode(content);
  const cues: Array<{ start: number; end: number; text: string }> = [];

  if (!text.startsWith('WEBVTT')) return cues;

  const lines = text.split(/\r?\n/);
  let inCue = false;
  let cueStart = 0;
  let cueEnd = 0;
  let cueTextLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') {
      if (inCue) {
        cues.push({ start: cueStart, end: cueEnd, text: cueTextLines.join('\n') });
        inCue = false;
        cueTextLines = [];
      }
      continue;
    }

    if (!inCue && line.includes('-->')) {
      const parts = line.split('-->');
      cueStart = parseTimestamp(parts[0].trim());
      cueEnd = parseTimestamp(parts[1].trim());
      inCue = true;
      cueTextLines = [];
    } else if (inCue) {
      cueTextLines.push(line);
    }
  }

  if (inCue) {
    cues.push({ start: cueStart, end: cueEnd, text: cueTextLines.join('\n') });
  }

  return cues;
}

/**
 * Sanitize filename for safe Content-Disposition header.
 * Removes path traversal attempts and dangerous characters.
 */
export function sanitizeFilename(name: string): string {
  // Remove any path components
  let sanitized = name.replace(/^.*[/\\]/, '');

  // Replace dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '_');

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.slice(sanitized.lastIndexOf('.'));
    const base = sanitized.slice(0, sanitized.lastIndexOf('.'));
    sanitized = base.slice(0, 255 - ext.length) + ext;
  }

  // Ensure not empty
  if (sanitized.length === 0) sanitized = 'file';

  return sanitized;
}

/**
 * Validate MIME type against allowed list.
 */
export function validateMimeType(mimeType: string, allowed: Set<string>): boolean {
  return allowed.has(mimeType.toLowerCase());
}

/**
 * Safe Content-Disposition header value.
 */
export function makeContentDisposition(fileName: string): string {
  const sanitized = sanitizeFilename(fileName);
  // RFC 5987 encoding for UTF-8 filenames
  const encoded = encodeURIComponent(sanitized).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const fallback = sanitized.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** Check signatures and strict UTF-8; ZIP remains opaque and is never extracted. */
export function validateResourceBytes(name: string, mime: string, bytes: Uint8Array): boolean {
  if (typeof mime !== 'string' || !bytes.length) return false;
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return mime === 'application/pdf' && Buffer.from(bytes.subarray(0, 5)).toString('ascii') === '%PDF-' && Buffer.from(bytes.subarray(Math.max(0, bytes.length - 1024))).includes(Buffer.from('%%EOF'));
  if (ext === 'zip') return mime === 'application/zip' && bytes.length >= 22 && bytes[0] === 0x50 && bytes[1] === 0x4b && ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6));
  if (!(['txt', 'js', 'json'].includes(ext ?? ''))) return false;
  if (ext === 'txt' && mime !== 'text/plain') return false;
  if (ext === 'js' && !['application/javascript', 'text/javascript'].includes(mime)) return false;
  if (ext === 'json' && mime !== 'application/json') return false;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) return false;
    if (ext === 'json') JSON.parse(text);
    return true;
  } catch { return false; }
}
