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
