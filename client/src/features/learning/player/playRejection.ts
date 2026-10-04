/**
 * Classification of a rejected `video.play()` promise (playback-recovery).
 *
 * - `NotAllowedError`: the browser requires an explicit user gesture
 *   (autoplay policy). The grant is preserved; the viewer is asked to press
 *   Play. This is not a media failure.
 * - `NotSupportedError`: the media or protection path is unsupported here.
 *   The viewer needs supported-browser guidance, not another gesture.
 * - Anything else (including AbortError from teardown races and unknown
 *   names): generic playback failure with a bounded retry next action.
 *
 * The toggle executes this exact classifier on the real rejection; the unit
 * suite covers every branch below, and the browser flow drives the real
 * toggle with synthetic rejections.
 */
export type PlayRejectionOutcome =
  | { action: 'gesture' }
  | { action: 'failed'; code: 'UNSUPPORTED_PROVIDER' | 'PLAYBACK_ERROR' };

export function classifyPlayRejection(name: string): PlayRejectionOutcome {
  if (name === 'NotAllowedError') return { action: 'gesture' };
  if (name === 'NotSupportedError') return { action: 'failed', code: 'UNSUPPORTED_PROVIDER' };
  return { action: 'failed', code: 'PLAYBACK_ERROR' };
}

/**
 * Stale-result guard for play promises that settle after teardown or after
 * the viewer switched lessons (a new grant arrived). Stale results must be
 * ignored so an old rejection cannot fail the new lesson's player.
 */
export function isStalePlayResult(
  capturedGrantId: string | null,
  currentGrantId: string | null,
  mounted: boolean,
): boolean {
  return !mounted || capturedGrantId !== currentGrantId;
}
