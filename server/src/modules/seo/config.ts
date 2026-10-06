export interface SeoSettings {
  origin?: string;
  indexing: boolean;
}
/** A configured origin, never a request Host or guessed deployment URL. */
export function readSeoSettings(env: NodeJS.ProcessEnv = process.env): SeoSettings {
  const enabled = env['SEO_INDEXING_ENABLED'] ?? 'false';
  if (!['true', 'false'].includes(enabled))
    throw new Error('SEO_INDEXING_ENABLED must be true or false.');
  let origin: string | undefined;
  if (env['SEO_PUBLIC_ORIGIN']) {
    let url: URL;
    try {
      url = new URL(env['SEO_PUBLIC_ORIGIN']);
    } catch {
      throw new Error('SEO_PUBLIC_ORIGIN must be an HTTPS origin.');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('SEO_PUBLIC_ORIGIN must be an HTTPS origin without credentials or a path.');
    origin = url.origin;
  }
  if (enabled === 'true' && !origin) throw new Error('SEO indexing requires SEO_PUBLIC_ORIGIN.');
  return { origin, indexing: enabled === 'true' };
}
