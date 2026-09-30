/** dash.js 5.2.1 remote ClearKey compatibility: binary PSSH uses cenc, not keyids.
 * No keys are embedded; the authenticated remote license exchange is unchanged.
 * Refuse an unknown dependency instead of silently applying an obsolete patch.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const original = '(keySystemMetadata.initData || keySystemMetadata.protData && keySystemMetadata.protData.clearkeys)';
const replacement = '(/* FAYQ remote ClearKey cenc */ keySystemMetadata.protData && keySystemMetadata.protData.clearkeys)';
export function patchSource(source, version) {
  if (version !== '5.2.1') throw new Error('Unsupported dash.js compatibility patch version');
  const count = source.split(original).length - 1;
  const patchedCount = source.split(replacement).length - 1;
  if (count === 0 && patchedCount === 1) return source;
  if (count !== 1 || patchedCount !== 0) throw new Error('Unexpected dash.js ClearKey patch signature');
  return source.replace(original, replacement);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packageRoot = new URL('../node_modules/dashjs/', import.meta.url);
  const { version } = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'));
  const file = new URL('dist/modern/esm/dash.all.debug.js', packageRoot);
  const source = readFileSync(file, 'utf8');
  const patched = patchSource(source, version);
  if (patched !== source) writeFileSync(file, patched);
  console.log('dash.js remote ClearKey compatibility verified');
}
