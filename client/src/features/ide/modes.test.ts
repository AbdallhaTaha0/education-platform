import { describe, it, expect } from 'vitest';
import { emptySource, modeName } from './types';
import { formatSource } from './format';
import { previewDocument } from './preview';
describe('IDE modes', () => {
  it('keeps starter source independent between modes', () => {
    const js = emptySource('javascript'), web = emptySource('web'), py = emptySource('python');
    js.javascript = 'changed'; expect(emptySource('javascript').javascript).not.toBe('changed');
    expect(web.html).toContain('<h1'); expect(py.python).toContain('print('); expect(py.javascript).toBe('');
    expect(modeName('web')).toBe('HTML + CSS + JavaScript');
  });
  it('formats HTML/CSS without executing it; JavaScript remains supported', async () => {
    expect(await formatSource('<div><p>Hi</p></div>', 'html')).toContain('\n');
    expect(await formatSource('h1{color:red}', 'css')).toContain('color: red;');
    expect(await formatSource('const x=2', 'javascript')).toBe('const x = 2;\n');
    await expect(formatSource('print(2)', 'ruby')).rejects.toThrow('FORMAT_UNSUPPORTED');
  });
  it('web preview carries HTML/CSS while preserving the opaque origin and network restrictions', () => {
    const doc = previewDocument(emptySource('web'), 'run', 'nonce');
    expect(doc).toContain('doc.html'); expect(doc).toContain('doc.css'); expect(doc).toContain("connect-src 'none'"); expect(doc).toContain("form-action 'none'");
  });
});
