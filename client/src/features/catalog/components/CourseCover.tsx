import { useState } from 'react';

/** Image paths come from the platform API, never an arbitrary external URL. */
export function CourseCover({ path, title }: { path?: string | null; title: string }) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const base = (import.meta.env['VITE_API_BASE'] as string | undefined) || '/api';
  return (
    <div data-testid="course-cover" className="aspect-video overflow-hidden rounded-xl bg-elevated">
      {path && path !== failedPath ? (
        <img
          className="block size-full object-cover"
          src={`${base}${path}`}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={() => setFailedPath(path)}
        />
      ) : (
        <div className="flex h-full items-center justify-between bg-[linear-gradient(135deg,var(--color-elevated),var(--color-surface))] p-6 text-muted" aria-hidden="true">
          <span className="text-5xl font-bold">{'{ }'}</span>
          <b className="text-[15px] tracking-[.16em]">FAYQ</b>
        </div>
      )}
    </div>
  );
}
