/** Student lesson materials state (course-learning UI).
 *
 * Fetches the entitlement-checked materials payload for the selected lesson,
 * then fetches caption bytes with cookies, validates WebVTT, and exposes
 * short-lived Blob URLs. Blobs are revoked on lesson change, unmount and
 * access loss. Downloads use authenticated fetches and temporary Blob URLs;
 * no permanent public links are created and no auth/playback tokens are stored.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { LearningApiError } from '../api/client';
import { lessonMaterialsApi } from './api';
import { createCaptionBlobUrl, isValidWebVtt, revokeCaptionBlobUrl } from './captions';
import type { LessonMaterials, MaterialResource } from './types';

export type CaptionChoice = 'off' | 'ar' | 'en';

export interface LessonMaterialsState {
  materials: LessonMaterials | null;
  loading: boolean;
  errorCode: string | null;
  retry: () => void;
  captionChoice: CaptionChoice;
  setCaptionChoice: (choice: CaptionChoice) => void;
  captionUrls: { ar: string | null; en: string | null };
  captionLoading: boolean;
  captionErrorCode: string | null;
  retryCaptions: () => void;
  resources: MaterialResource[];
  clearAccess: () => void;
}

const ACCESS_LOST = new Set([
  'SUBSCRIPTION_EXPIRED',
  'SUBSCRIPTION_REQUIRED',
  'PLAYBACK_SESSION_EXPIRED',
  'FORBIDDEN', 'LESSON_NOT_FOUND', 'MATERIAL_NOT_FOUND', 'ASSESSMENTS_REQUIRED', 'LESSON_LOCKED', 'UNAUTHENTICATED',
]);

export function useLessonMaterials(
  lessonId: string | null,
  accessLost: boolean,
): LessonMaterialsState {
  const [materials, setMaterials] = useState<LessonMaterials | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [captionChoice, setCaptionChoice] = useState<CaptionChoice>('off');
  const [captionUrls, setCaptionUrls] = useState<{ ar: string | null; en: string | null }>({ ar: null, en: null });
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionErrorCode, setCaptionErrorCode] = useState<string | null>(null);
  const [captionNonce, setCaptionNonce] = useState(0);
  const urlsRef = useRef<{ ar: string | null; en: string | null }>({ ar: null, en: null });

  function releaseAll(): void {
    revokeCaptionBlobUrl(urlsRef.current.ar);
    revokeCaptionBlobUrl(urlsRef.current.en);
    urlsRef.current = { ar: null, en: null };
    setCaptionUrls({ ar: null, en: null });
  }

  // Lesson change or access loss drops captions immediately.
  useEffect(() => {
    releaseAll();
    setCaptionChoice('off');
    setCaptionErrorCode(null);
    setCaptionLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    if (accessLost) {
      releaseAll();
      setMaterials(null);
      setCaptionChoice('off');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLost]);

  useEffect(
    () => () => {
      revokeCaptionBlobUrl(urlsRef.current.ar);
      revokeCaptionBlobUrl(urlsRef.current.en);
      urlsRef.current = { ar: null, en: null };
    },
    [],
  );

  useEffect(() => {
    if (lessonId === null || accessLost) {
      setMaterials(null);
      setLoading(false);
      setErrorCode(null);
      return;
    }
    let cancelled = false;
    setMaterials(null);
    setLoading(true);
    setErrorCode(null);
    lessonMaterialsApi
      .getLessonMaterials(lessonId)
      .then((value) => {
        if (cancelled) return;
        setMaterials(value);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const code = err instanceof LearningApiError ? err.code : 'UNKNOWN';
        setMaterials(null);
        setErrorCode(code);
        setLoading(false);
        if (ACCESS_LOST.has(code)) { releaseAll(); setMaterials(null); setCaptionChoice('off'); }
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, nonce, accessLost]);

  // Fetch the selected caption track on demand.
  useEffect(() => {
    setCaptionLoading(false);
    if (lessonId === null || accessLost || captionChoice === 'off' || materials === null || materials.lessonId !== lessonId) return;
    const entry = materials.captions.find((c) => c.language === captionChoice);
    if (!entry) return;
    const key = captionChoice;
    if (urlsRef.current[key] !== null) return;
    let cancelled = false;
    setCaptionLoading(true);
    setCaptionErrorCode(null);
    lessonMaterialsApi
      .fetchCaptionText(entry.id)
      .then((text) => {
        if (cancelled) return;
        if (!isValidWebVtt(text)) {
          setCaptionErrorCode('MATERIAL_INVALID');
          setCaptionLoading(false);
          return;
        }
        const url = createCaptionBlobUrl(text);
        if (url === null) {
          setCaptionErrorCode('MATERIAL_INVALID');
          setCaptionLoading(false);
          return;
        }
        urlsRef.current = { ...urlsRef.current, [key]: url };
        setCaptionUrls({ ...urlsRef.current });
        setCaptionLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const code = err instanceof LearningApiError ? err.code : 'UNKNOWN';
        setCaptionErrorCode(code);
        setCaptionLoading(false);
        if (ACCESS_LOST.has(code)) { releaseAll(); setMaterials(null); setCaptionChoice('off'); }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, captionChoice, materials, captionNonce, accessLost]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const retryCaptions = useCallback(() => {
    // Drop a failed URL (there is none on failure) and refetch.
    setCaptionErrorCode(null);
    setCaptionNonce((n) => n + 1);
  }, []);

  return {
    materials: !accessLost && materials?.lessonId === lessonId ? materials : null,
    loading,
    errorCode,
    retry,
    captionChoice,
    setCaptionChoice,
    captionUrls: !accessLost && materials?.lessonId === lessonId ? captionUrls : { ar: null, en: null },
    captionLoading,
    captionErrorCode,
    retryCaptions,
    clearAccess: () => { releaseAll(); setMaterials(null); setCaptionChoice('off'); },
    resources: !accessLost && materials?.lessonId === lessonId ? materials.resources : [],
  };
}
