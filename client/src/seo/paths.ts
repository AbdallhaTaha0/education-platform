import type { Lang } from '../i18n';
/** Real public URLs; private routes retain the existing fragment contract. */
export function publicHref(hash: string, lang: Lang): string {
  if (hash === '#/' || hash === '#') return '/' + lang;
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  if (/^\/(courses(?:\/[^/?#]+)?|package\/[^/?#]+|support)$/.test(path)) return '/' + lang + path;
  return hash;
}
export function publicLocation(path: string): { lang: Lang; hash: string } | null {
  const match = /^\/(ar|en)(\/.*)?$/.exec(path);
  if (!match) return null;
  return { lang: match[1] as Lang, hash: '#' + (match[2] || '/') };
}
