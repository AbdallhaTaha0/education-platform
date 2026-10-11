export function selectedLessonHash(hash: string, lessonId: string): string | null {
  const queryAt = hash.indexOf('?');
  const path = queryAt < 0 ? hash : hash.slice(0, queryAt);
  if (!path.startsWith('#/learn/') || path === '#/learn/' || !lessonId) return null;
  const query = new URLSearchParams(queryAt < 0 ? '' : hash.slice(queryAt + 1));
  query.set('lesson', lessonId);
  return `${path}?${query.toString()}`;
}
