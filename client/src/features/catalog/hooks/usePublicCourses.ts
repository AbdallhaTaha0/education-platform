import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../auth';
import { fetchPublicCourses } from '../api/client';
import type { PublicCourse } from '../types/models';

export function usePublicCourses(): {
  loading: boolean;
  courses: PublicCourse[];
  error: string | null;
  reload: () => void;
} {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCourses(await fetchPublicCourses());
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { loading, courses, error, reload: load };
}
