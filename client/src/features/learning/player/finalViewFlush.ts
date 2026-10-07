/** Keep tracking best-effort without letting a stalled request block playback. */
export const FINAL_VIEW_FLUSH_WAIT_MS = 2_000;

export async function finishAfterViewFlush(
  flush: () => Promise<void>,
  finish: () => void,
  isCurrent: () => boolean,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(flush).catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, FINAL_VIEW_FLUSH_WAIT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  // Navigation/reconnect may have superseded the ending grant during the wait.
  if (isCurrent()) finish();
}
