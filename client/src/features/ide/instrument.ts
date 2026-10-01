import { parse } from 'acorn';
type Ast = { type: string; start: number; end: number; body?: Ast; [key: string]: unknown };
export function instrument(source: string, guard: string): string {
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }) as unknown as Ast;
  const inserts = new Map<number, string[]>();
  const add = (at: number, code: string): void => { inserts.set(at, [...(inserts.get(at) ?? []), code]); };
  const visit = (node: Ast): void => {
    const loop = ['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type);
    const fn = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type);
    if ((loop || fn) && node.body) {
      if (node.body.type === 'BlockStatement') add(node.body.start + 1, `\n${guard}();\n`);
      else if (loop) { add(node.body.start, `{${guard}();`); add(node.body.end, '}'); }
      else { add(node.body.start, `(${guard}(),`); add(node.body.end, ')'); }
    }
    for (const [name, value] of Object.entries(node)) {
      if (name === 'start' || name === 'end') continue;
      if (Array.isArray(value)) value.forEach((x: unknown) => { if (x && typeof x === 'object' && 'type' in x) visit(x as Ast); });
      else if (value && typeof value === 'object' && 'type' in value) visit(value as Ast);
    }
  };
  visit(tree);
  let out = source;
  for (const at of [...inserts.keys()].sort((a, b) => b - a)) out = out.slice(0, at) + inserts.get(at)!.join('') + out.slice(at);
  return out;
}
