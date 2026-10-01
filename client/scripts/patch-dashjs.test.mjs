import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchSource } from './patch-dashjs.mjs';
const source =
  'if (keySystemMetadata.initData || keySystemMetadata.protData && keySystemMetadata.protData.clearkeys) { dataType = KEYIDS; } else { dataType = CENC; }';
test('remote binary metadata remains cenc; explicit local keys remain keyids', () => {
  const patched = patchSource(source, '5.2.1');
  const choose = new Function(
    'keySystemMetadata',
    'KEYIDS',
    'CENC',
    `let dataType; ${patched}; return dataType;`,
  );
  assert.equal(choose({ initData: new Uint8Array([1, 2]) }, 'keyids', 'cenc'), 'cenc');
  assert.equal(choose({ protData: { clearkeys: {} } }, 'keyids', 'cenc'), 'keyids');
  assert.equal(patchSource(patched, '5.2.1'), patched);
});
test('unknown releases and changed or duplicate signatures fail closed', () => {
  assert.throws(() => patchSource(source, '5.2.2'));
  assert.throws(() => patchSource('changed', '5.2.1'));
  assert.throws(() => patchSource(source + source, '5.2.1'));
});
