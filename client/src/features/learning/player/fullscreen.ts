import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type FullscreenFrame = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> | void };

/** Fullscreen the whole frame so the watermark remains inside it on all browsers. */
export function usePlayerFullscreen(frameRef: RefObject<HTMLDivElement>) {
  const [native, setNative] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const doc = document as FullscreenDocument;
    const changed = () => setNative((doc.fullscreenElement ?? doc.webkitFullscreenElement) === frameRef.current);
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('webkitfullscreenchange', changed);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('webkitfullscreenchange', changed);
    };
  }, [frameRef]);
  useEffect(() => {
    if (!expanded) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('learning-theatre-active');
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
      if (event.key !== 'Tab') return;
      const controls = frameRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !frameRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !frameRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    frameRef.current?.querySelector<HTMLElement>('[data-testid="player-fullscreen"]')?.focus();
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.documentElement.classList.remove('learning-theatre-active');
      document.removeEventListener('keydown', keyboard);
      if (trigger.current?.isConnected) trigger.current.focus();
    };
  }, [expanded, frameRef]);
  const toggle = useCallback(async () => {
    const frame = frameRef.current as FullscreenFrame | null;
    const doc = document as FullscreenDocument;
    if (!frame) return;
    if (expanded) { setExpanded(false); return; }
    if ((doc.fullscreenElement ?? doc.webkitFullscreenElement) === frame) {
      try {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      } catch { /* Keep the exit control available after a browser refusal. */ }
      return;
    }
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      if (frame.requestFullscreen) await frame.requestFullscreen();
      else if (frame.webkitRequestFullscreen) await frame.webkitRequestFullscreen();
      else setExpanded(true);
    } catch { setExpanded(true); }
  }, [expanded, frameRef]);
  return { fullscreen: native || expanded, expanded, toggle };
}
