/** Validated WebVTT handling (course-learning UI).
 *
 * Captions are fetched as bytes with cookies, validated as WebVTT, exposed to
 * the video element only through short-lived Blob URLs, and revoked on lesson
 * change/unmount/access loss. Text is rendered by the native track engine;
 * this module never inserts HTML.
 */

/** Minimal strict-enough WebVTT check: header plus at least one cue timing line. */
const CUE_TIMING = /^\d{2,}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2,}:\d{2}:\d{2}\.\d{3}/m;
const SHORT_TIMING = /^\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}\.\d{3}/m;

export function isValidWebVtt(text: string): boolean {
  if (typeof text !== 'string' || text.length === 0 || text.length > 1024 * 1024) return false;
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!normalized.startsWith('WEBVTT')) return false;
  const rest = normalized.slice('WEBVTT'.length);
  // The header line may carry only spaces/tabs after WEBVTT.
  const firstNewline = rest.indexOf('\n');
  const headerSuffix = firstNewline === -1 ? rest : rest.slice(0, firstNewline);
  if (headerSuffix.length > 0 && !/^[ \t]*$/.test(headerSuffix)) return false;
  return CUE_TIMING.test(normalized) || SHORT_TIMING.test(normalized);
}

/** Track created Blob URLs so callers can release exactly what they created. */
export function createCaptionBlobUrl(vttText: string): string | null {
  if (!isValidWebVtt(vttText)) return null;
  if (typeof URL === 'undefined' || typeof Blob === 'undefined') return null;
  try {
    const blob = new Blob([vttText], { type: 'text/vtt;charset=utf-8' });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function revokeCaptionBlobUrl(url: string | null): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Revocation is best-effort; a failed revoke must not break playback.
  }
}

/** Safe filename for the download attribute: display name only, never a path. */
export function safeDownloadName(fileName: string, fallback: string): string {
  const base = fileName.split(/[\\/]/).pop()?.trim() ?? '';
  if (base.length === 0 || base === '.' || base === '..') return fallback;
  return base.slice(0, 180);
}
