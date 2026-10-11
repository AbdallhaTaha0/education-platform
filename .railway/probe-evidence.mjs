import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function redact(text, secrets = []) {
  let value = String(text);
  for (const secret of secrets.filter(Boolean)) value = value.split(secret).join('[redacted]');
  return value
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/https?:\/\/[^\s"']+/g, (url) => {
      try { const parsed = new URL(url); return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search ? '?[redacted]' : ''}`; }
      catch { return '[redacted-url]'; }
    });
}

export function saveEvidence(path, record, secrets = []) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const line = JSON.stringify({ time: new Date().toISOString(), ...record }, (_key, value) =>
    typeof value === 'string' ? redact(value, secrets).slice(0, 16_000) : value);
  appendFileSync(path, `${line}\n`, { mode: 0o600 });
}
