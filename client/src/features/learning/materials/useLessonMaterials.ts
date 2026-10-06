/** Entitlement-checked lesson-file metadata; no permanent download links. */
import { useCallback, useEffect, useState } from "react";
import { LearningApiError } from "../api/client";
import { lessonMaterialsApi } from "./api";
import type { LessonMaterials, MaterialResource } from "./types";
export interface LessonMaterialsState {
  materials: LessonMaterials | null;
  loading: boolean;
  errorCode: string | null;
  retry: () => void;
  resources: MaterialResource[];
  clearAccess: () => void;
}
export function useLessonMaterials(
  lessonId: string | null,
  accessLost: boolean,
): LessonMaterialsState {
  const [materials, setMaterials] = useState<LessonMaterials | null>(null),
    [loading, setLoading] = useState(false),
    [errorCode, setErrorCode] = useState<string | null>(null),
    [nonce, setNonce] = useState(0);
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
        if (!cancelled) {
          setMaterials(value);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMaterials(null);
          setErrorCode(err instanceof LearningApiError ? err.code : "UNKNOWN");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, nonce, accessLost]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const clearAccess = useCallback(() => setMaterials(null), []);
  const visible =
    !accessLost && materials?.lessonId === lessonId ? materials : null;
  return {
    materials: visible,
    loading,
    errorCode,
    retry,
    clearAccess,
    resources: visible?.resources ?? [],
  };
}
