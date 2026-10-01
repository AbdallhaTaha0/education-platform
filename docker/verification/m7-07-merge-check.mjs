/** M7-07 merge-behavior regression for the deepmerge-ts override.
 *
 * Runs inside a server-image container (installed tree at /srv/server):
 *   docker run --rm <test-image> node /tmp/m7-07-merge-check.mjs
 * with this file bind-mounted at /tmp/m7-07-merge-check.mjs (read-only).
 *
 * Gates on BEHAVIOR, not version strings: six strict record/array/undefined/
 * null/Date merges must match the v7-established expectations exactly (own-key
 * undefined presence is asserted explicitly — JSON comparison would silently
 * drop it), and the both-sides-cyclic advisory input must return without stack
 * exhaustion. Expected values were derived from packed deepmerge-ts 7.1.5 in a
 * disposable container; v8 must preserve them for these JSON-shaped inputs.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const ROOT = '/srv/server';
const esm = await import('file://' + ROOT + '/node_modules/deepmerge-ts/dist/index.mjs');
const cjs = createRequire(ROOT + '/package.json')(
  ROOT + '/node_modules/deepmerge-ts/dist/index.cjs',
);
console.log(
  'INFO installed deepmerge-ts=' +
    JSON.parse(fs.readFileSync(ROOT + '/node_modules/deepmerge-ts/package.json', 'utf8')).version,
);

let pass = 0;
let fail = 0;
function strictEqual(a, b, path = '$') {
  if (typeof a !== typeof b) throw new Error(path + ': type ' + typeof a + ' vs ' + typeof b);
  if (a instanceof Date || b instanceof Date) {
    if (!(a instanceof Date) || !(b instanceof Date) || a.getTime() !== b.getTime())
      throw new Error(path + ': Date mismatch');
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      throw new Error(path + ': array shape');
    a.forEach((v, i) => strictEqual(v, b[i], path + '[' + i + ']'));
    return;
  }
  if (a !== null && typeof a === 'object') {
    if (b === null || typeof b !== 'object') throw new Error(path + ': object vs leaf');
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (JSON.stringify(ka) !== JSON.stringify(kb))
      throw new Error(path + ': own-keys [' + ka + '] vs [' + kb + ']');
    for (const k of ka) strictEqual(a[k], b[k], path + '.' + k);
    return;
  }
  if (!Object.is(a, b)) throw new Error(path + ': ' + String(a) + ' vs ' + String(b));
}
const check = (label, fn) => {
  try {
    fn();
    pass++;
    console.log('PASS ' + label);
  } catch (e) {
    fail++;
    console.log('FAIL ' + label + ' :: ' + (e && e.message ? e.message : e));
  }
};
const D1 = new Date('2026-01-01T00:00:00.000Z');
const D2 = new Date('2026-06-01T00:00:00.000Z');
const CASES = [
  [
    'nested-records',
    [
      { datasource: { url: 'a', nested: { x: 1 } } },
      { datasource: { nested: { y: 2 }, extra: 'e' } },
    ],
    { datasource: { url: 'a', nested: { x: 1, y: 2 }, extra: 'e' } },
  ],
  [
    'array-concat',
    [
      { list: [1, 2], g: { p: ['a'] } },
      { list: [3], g: { p: ['b'] } },
    ],
    { list: [1, 2, 3], g: { p: ['a', 'b'] } },
  ],
  [
    'undefined-own-key',
    [{ a: 1 }, { b: undefined }],
    (() => {
      const o = { a: 1 };
      o.b = undefined;
      return o;
    })(),
  ],
  [
    'null-wins',
    [
      { a: { x: 1 }, n: 1 },
      { a: null, n: null },
    ],
    { a: null, n: null },
  ],
  ['date-source-wins', [{ at: D1, keep: 1 }, { at: D2 }], { at: D2, keep: 1 }],
  [
    'generator-block',
    [
      { generator: { provider: 'x', previewFeatures: ['a'] } },
      { generator: { previewFeatures: ['b'], binaryTargets: ['native'] } },
    ],
    { generator: { provider: 'x', previewFeatures: ['a', 'b'], binaryTargets: ['native'] } },
  ],
];
for (const impl of [
  ['esm', esm.deepmerge],
  ['cjs', cjs.deepmerge],
]) {
  for (const [label, [x, y], expected] of CASES)
    check(impl[0] + ':' + label, () => strictEqual(impl[1](x, y), expected));
}
for (const [name, fn] of [
  ['esm', esm.deepmerge],
  ['cjs', cjs.deepmerge],
]) {
  check(name + ':both-sides-cyclic-no-stack-exhaustion', () => {
    const x = { n: 'x' };
    x.self = x;
    const y = { n: 'y' };
    y.self = y;
    const r = fn(x, y);
    if (
      r === null ||
      typeof r !== 'object' ||
      r.n !== 'y' ||
      r.self === null ||
      typeof r.self !== 'object'
    ) {
      throw new Error('unexpected cyclic merge shape');
    }
  });
}
console.log('MERGE-CHECK pass=' + pass + ' fail=' + fail);
if (fail > 0) process.exitCode = 1;
