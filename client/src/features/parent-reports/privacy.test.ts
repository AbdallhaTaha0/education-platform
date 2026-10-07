import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Static privacy guard for the M10 ADMIN parent-report feature.
 *
 * Report text and recipient numbers are temporary and must never reach
 * localStorage/sessionStorage, caches, analytics, logs or downloads. A
 * behavioural DOM suite is not available in this package, so the invariant is
 * enforced at source level here and again at runtime in the Chromium suite.
 */
const ROOT = __dirname;

function sources(dir: string): { file: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith('.test.ts')) return [];
    // Comments document the invariants and mention the forbidden APIs by name,
    // so only executable code is scanned.
    return [{ file: full.replace(/\\/g, '/'), code: stripComments(readFileSync(full, 'utf8')) }];
  });
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('parent-report privacy invariants', () => {
  const files = sources(ROOT);

  it('reads real implementation files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(['localStorage', 'sessionStorage', 'indexedDB', 'caches.', 'sendBeacon', 'navigator.sendBeacon'])(
    'never touches %s',
    forbidden => {
      for (const { file, code } of files) {
        expect(`${file}: ${code.includes(forbidden)}`, file).not.toContain('true');
      }
    },
  );

  it('never writes to the platform log or console', () => {
    for (const { file, code } of files) {
      expect(/console\.(log|info|warn|error|debug)/.test(code), file).toBe(false);
    }
  });

  it('offers no download of report content', () => {
    for (const { file, code } of files) {
      expect(/createObjectURL|download\s*=/.test(code), file).toBe(false);
    }
  });

  it('requests every report response without caching', () => {
    const api = stripComments(readFileSync(join(ROOT, 'api.ts'), 'utf8'));
    expect(api.split('apiResponse(').length - 1).toBe(2);
    expect(api.split("cache: 'no-store'").length - 1).toBe(2);
  });

  it('never builds a WhatsApp URL outside the guarded helper module', () => {
    for (const { file, code } of files) {
      if (file.endsWith('/whatsapp.ts')) continue;
      expect(code.includes('wa.me'), file).toBe(false);
    }
  });
});