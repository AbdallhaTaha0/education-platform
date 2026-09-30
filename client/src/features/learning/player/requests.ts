/** Resolve DASH's relative filenames against the external DRM gateway API. */
export function protectedRequestUrl(requestUrl: string, manifestUrl: string, licenseUrl: string): string {
  if (/%2f|%5c|%2e/i.test(requestUrl)) throw new Error('Unapproved media path');
  const manifest = new URL(manifestUrl);
  const license = new URL(licenseUrl);
  const request = new URL(requestUrl, manifest);
  if (request.origin !== manifest.origin || license.origin !== manifest.origin || request.username || request.password) {
    throw new Error('Unapproved media origin');
  }
  if (request.pathname === manifest.pathname || request.pathname === license.pathname) return request.href;
  const base = manifest.pathname.slice(0, manifest.pathname.lastIndexOf('/') + 1);
  if (!request.pathname.startsWith(base) || /%2f|%5c|%2e/i.test(request.pathname)) {
    throw new Error('Unapproved media path');
  }
  const relative = request.pathname.slice(base.length);
  if (!relative || relative.includes('\\')) throw new Error('Unapproved media path');
  // Shaka emits filenames relative to the MPD; the API exposes the same
  // packaged files through /v1/playback/:sessionId/media/*.
  if (!relative.startsWith('media/')) request.pathname = `${base}media/${relative}`;
  return request.href;
}
