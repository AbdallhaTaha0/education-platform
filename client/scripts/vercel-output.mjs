import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function configuration(env) {
  // Public routing destination only; never inject provider/application secrets.
  let origin;
  try { origin = new URL(env.RAILWAY_GATEWAY_ORIGIN); } catch { throw new Error('RAILWAY_GATEWAY_ORIGIN must be an HTTPS origin'); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || origin.port || origin.hostname === 'localhost' || !origin.hostname.includes('.')) {
    throw new Error('RAILWAY_GATEWAY_ORIGIN must be an HTTPS origin without credentials, port, path or query');
  }
  if (env.VITE_API_BASE && env.VITE_API_BASE !== '/api') throw new Error('VITE_API_BASE must remain /api for cookie and CSRF protection');
  if (env.VITE_DEFAULT_LANG && env.VITE_DEFAULT_LANG !== 'ar') throw new Error('Use the same Arabic-default client build as backend SSR');
  const gateway = origin.origin;
  return {
    version: 3,
    routes: [
      { src: '/api(?:/(.*))?', dest: `${gateway}/api/$1`, headers: { 'Cache-Control': 'private, no-store' } },
      { src: '/\\.well-known/jwks\\.json', dest: `${gateway}/.well-known/jwks.json` },
      { src: '/assets/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }, continue: true },
      { src: '/index\\.html', status: 308, headers: { Location: '/ar' } },
      { handle: 'filesystem' },
      // Preserve Express SSR status, canonical URLs, sitemap and robots. No SPA fallback.
      { src: '/(.*)', dest: `${gateway}/$1`, headers: { 'Cache-Control': 'private, no-store' } },
    ],
  };
}

export function emit(root, env) {
  const config = configuration(env); // Validate before touching prior output.
  const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
  if (!html.includes('/assets/')) throw new Error('Build the Vite client before creating Vercel output');
  const output = resolve(root, '.vercel/output');
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(resolve(root, 'dist'), resolve(output, 'static'), { recursive: true });
  // / is rendered by Express; a static index would bypass SSR filesystem routing.
  rmSync(resolve(output, 'static/index.html'));
  writeFileSync(resolve(output, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  emit(resolve(fileURLToPath(new URL('..', import.meta.url))), process.env);
  console.log('Vercel output prepared; API remains same-origin and public pages use backend SSR.');
}
