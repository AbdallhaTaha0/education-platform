import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../auth';
import { fetchAdminCourse } from '../api/client';
import type { AdminCourseDetail } from '../types/models';

export function useAdminCourse(courseId: string): {
  loading: boolean;
  course: AdminCourseDetail | null;
  error: string | null;
  reload: () => Promise<void>;
} {
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<AdminCourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async (initial = false) => {
      // Background refreshes must not unmount the detail view (which would
      // wipe uploader progress/phase state); only the first load blocks.
      if (initial) setLoading(true);
      try {
        setCourse(await fetchAdminCourse(courseId));
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
      } finally {
        if (initial) setLoading(false);
      }
    },
    [courseId],
  );
  useEffect(() => {
    void load(true);
  }, [load]);
  return { loading, course, error, reload: () => load(false) };
}
