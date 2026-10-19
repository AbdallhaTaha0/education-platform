/**
 * Classification of a native `<video>` failure on the no-DRM playback path.
 *
 * The no-DRM branch streams the uploaded file directly from private object
 * storage, so the browser, not the platform, decides which container and codec
 * are playable. Two cases would otherwise leave a silent black frame that looks
 * like a working player:
 *
 * - Metadata parsed but no video dimensions are exposed, so the resource is
 *   audio-only or its video track cannot be decoded.
 * - The element reported a decode error (3) or an unsupported source (4).
 *
 * Both become `UNSUPPORTED_MEDIA` so the viewer is told to re-upload the file
 * as MP4 with H.264 video and AAC audio. Network and aborted failures stay
 * retryable.
 */
export type MediaFailureCode = 'UNSUPPORTED_MEDIA' | 'PLAYBACK_ERROR';

export function classifyMediaFailure(input: {
  errorCode: number | null;
  videoWidth: number;
  videoHeight: number;
}): MediaFailureCode {
  if (input.errorCode === 3 || input.errorCode === 4) return 'UNSUPPORTED_MEDIA';
  if (input.errorCode === null && input.videoWidth === 0 && input.videoHeight === 0)
    return 'UNSUPPORTED_MEDIA';
  return 'PLAYBACK_ERROR';
}
