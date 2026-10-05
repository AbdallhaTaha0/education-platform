import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { isIP } from 'node:net';
import { execFile } from 'node:child_process';
const text = readFileSync('/audit/education-drm-service/apps/api/src/services/webhook.service.ts','utf8');
const match = text.match(/function isPrivateAddress\(address: string\): boolean \{([\s\S]*?)\n\}/);
assert.ok(match, 'Expected inspected private-address predicate');
// Execute only the copied pure address predicate; never make a network request.
const isPrivateAddress = Function('isIP', 'return function(address) {' + match[1] + '}')(isIP);
const hostname = new URL('https://[::ffff:127.0.0.1]/').hostname.replace(/^\[|\]$/g, '');
assert.equal(isIP(hostname), 6);
assert.equal(isPrivateAddress(hostname), false);
console.log('Confirmed: canonical IPv4-mapped loopback is missed by current DRM webhook predicate (no network request).');
await new Promise((resolve, reject) => execFile(process.execPath, ['-e', 'process.exit(1)', '--', 'key=fixture-placeholder'], error => {
  try { assert.ok(error.message.includes('key=fixture-placeholder')); console.log('Confirmed: failed execFile command includes its argument in error.message (synthetic placeholder only).'); resolve(); } catch (failure) { reject(failure); }
}));
