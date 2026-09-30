/**
 * Credential-presence audit (TEST-ONLY, read-only).
 *
 * Reports ONLY whether a configuration key is present, its length, and a coarse
 * category (placeholder-looking vs not). It never prints a value, never prints a
 * prefix or suffix, and never writes any file. It exists so the operator can
 * record precisely which verification gates are blocked by missing configuration
 * without exposing anything.
 */
import { readFileSync, existsSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node credential-presence-audit.mjs <env-file>...');
  process.exit(2);
}

function classify(value) {
  if (value === '') return 'empty';
  const lower = value.toLowerCase();
  if (/(change[_-]?me|placeholder|example|your[_-]|replace[_-]me|xxxx+|todo)/.test(lower)) return 'placeholder-like';
  return 'set';
}

for (const file of files) {
  if (!existsSync(file)) {
    console.log(`file ${file} : absent`);
    continue;
  }
  const entries = [];
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries.push({ key, length: value.length, category: classify(value) });
  }
  entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  console.log(`file ${file} : ${entries.length} keys`);
  for (const entry of entries) {
    console.log(`  ${entry.key} present=${entry.length > 0} length=${entry.length} category=${entry.category}`);
  }
}
