import { describe, expect, it } from 'vitest';
import { instrument } from './instrument';
import { previewDocument } from './preview';
describe('IDE responsiveness and document boundary', () => {
  it.each(['while(true) {}', 'for(;;) console.log(1);', 'do {} while(true);', 'const f=()=>f();f();', 'function f(){return f()}f();'])('interrupts instrumented loops/recursion: %s', (code) => { let calls = 0; const guard = () => { if (++calls > 10) throw new Error('limited'); }; expect(() => Function('guard', instrument(code, 'guard'))(guard)).toThrow('limited'); });
  it('preserves real ordinary function results', () => { const source = instrument('function sum(a,b){return a+b;}return sum(2,3)', 'guard'); expect(Function('guard', source)(() => {})).toBe(5); });
  it('keeps source/HTML from closing the bootstrap and disables external resources', () => { const page = previewDocument({ html: '</script><script>alert(1)</script>', css: '', javascript: 'console.log("</script>")' }, 'run', 'nonce123'); expect(page.match(/<script /g)).toHaveLength(1); expect(page).toContain("connect-src 'none'"); expect(page).toContain("frame-src 'none'"); expect(page).toContain("worker-src 'none'"); expect(page).toContain('\\u003c'); });
});
