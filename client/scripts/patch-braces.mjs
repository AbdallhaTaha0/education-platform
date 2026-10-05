import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sources = {
  parse: 'e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310',
  compile: 'dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f',
  expand: '41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7',
  stringify: '379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a',
};
const guard = "    if (level > 100) throw new SyntaxError('Pattern nesting exceeds maximum depth (100)');";
const sha = source => createHash('sha256').update(source).digest('hex');
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Unexpected braces patch signature');
  return source.replace(before, after);
}
export function patchedSource(name, source) {
  if (name === 'parse') {
    return replaceOnce(source, '  while (index < length) {\n    block = stack[stack.length - 1];',
      "  while (index < length) {\n    if (stack.length > 100) throw new SyntaxError('Pattern nesting exceeds maximum depth (100)');\n    block = stack[stack.length - 1];");
  }
  const walker = name === 'stringify' ? 'stringify' : 'walk';
  let result = replaceOnce(source, '  const '+walker+' = (node, parent = {}) => {',
    '  const '+walker+' = (node, parent = {}, level = 0) => {\n'+guard);
  return replaceOnce(result, name === 'stringify' ? 'stringify(child)' : 'walk(child, node)',
    name === 'stringify' ? 'stringify(child, {}, level + 1)' : 'walk(child, node, level + 1)');
}
/** Pin both version and full source; remove when an upstream depth fix is qualified. */
export function patchBraces({ verifyOnly = false } = {}) {
  const packageFile = require.resolve('braces/package.json');
  if (JSON.parse(readFileSync(packageFile, 'utf8')).version !== '3.0.3') throw new Error('Review braces security patch for the new version');
  const plans = Object.entries(sources).map(([name, expected]) => {
    const file = join(dirname(packageFile), 'lib', name+'.js');
    const current = readFileSync(file, 'utf8');
    const signature = name === 'parse'
      ? "    if (stack.length > 100) throw new SyntaxError('Pattern nesting exceeds maximum depth (100)');\n"
      : guard+'\n';
    if (current.includes(signature)) {
      const original = name === 'parse' ? current.replace(signature, '') : current
        .replace(signature, '')
        .replace('parent = {}, level = 0', 'parent = {}')
        .replace(name === 'stringify' ? 'stringify(child, {}, level + 1)' : 'walk(child, node, level + 1)',
          name === 'stringify' ? 'stringify(child)' : 'walk(child, node)');
      if (sha(original) !== expected || patchedSource(name, original) !== current) throw new Error('Unexpected patched braces source');
      return { file, current, patched: current };
    }
    if (sha(current) !== expected) throw new Error('Unexpected upstream braces source');
    if (verifyOnly) throw new Error('Required braces security patch is missing');
    return { file, current, patched: patchedSource(name, current) };
  });
  for (const plan of plans) if (plan.current !== plan.patched) writeFileSync(plan.file, plan.patched);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  patchBraces({ verifyOnly: process.argv.includes('--verify') });
  console.log('braces3.0.3 depth guards verified (local build-tool mitigation).');
}
