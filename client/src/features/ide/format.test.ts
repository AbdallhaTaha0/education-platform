import { describe, expect, it } from 'vitest';
import { formatJavaScript } from './format';

describe('browser JavaScript formatter', () => {
  it('organizes real JavaScript without executing it', async () => {
    const result = await formatJavaScript('function sum(a,b){return a+b}console.log(sum(2,3))');
    expect(result).toBe('function sum(a, b) {\n  return a + b;\n}\nconsole.log(sum(2, 3));\n');
    expect(await formatJavaScript(result)).toBe(result);
  });
  it('rejects unfinished code so the caller can preserve the draft', async () => {
    await expect(formatJavaScript('function broken(')).rejects.toThrow();
  });
});
