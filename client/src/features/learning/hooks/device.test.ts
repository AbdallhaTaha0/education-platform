import { afterEach, describe, expect, it, vi } from 'vitest';
function storage(values = new Map<string, string>()): Storage {
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: k => { values.delete(k); }, clear: () => values.clear(), key: i => [...values.keys()][i] ?? null, get length() { return values.size; } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('non-credential browser device identity', () => {
  it('shares one identity between tabs and reloads', async () => {
    const localStorage = storage();
    vi.stubGlobal('window', { localStorage, sessionStorage: storage() });
    const first = (await import('./device')).deviceId();
    vi.resetModules(); vi.stubGlobal('window', { localStorage, sessionStorage: storage() });
    expect((await import('./device')).deviceId()).toBe(first);
    expect(localStorage.length).toBe(1);
  });
  it('migrates an existing tab identity rather than consuming another slot', async () => {
    const localStorage = storage(); const sessionStorage = storage(new Map([['edu-learning-device', 'web-existing-tab']]));
    vi.stubGlobal('window', { localStorage, sessionStorage });
    expect((await import('./device')).deviceId()).toBe('web-existing-tab');
    expect(localStorage.getItem('edu-learning-device')).toBe('web-existing-tab');
  });
  it('uses a shared browser identity when another tab still has a legacy identity', async () => {
    vi.stubGlobal('window', { localStorage: storage(new Map([['edu-learning-device', 'web-browser']])), sessionStorage: storage(new Map([['edu-learning-device', 'web-old-tab']])) });
    expect((await import('./device')).deviceId()).toBe('web-browser');
  });
  it('keeps a stable identity when both browser stores are blocked', async () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    vi.stubGlobal('window', { localStorage: blocked, sessionStorage: blocked });
    const { deviceId } = await import('./device');
    expect(deviceId()).toBe(deviceId());
  });
  it('rejects malformed saved identifiers and uses a valid legacy identity', async () => {
    vi.stubGlobal('window', { localStorage: storage(new Map([['edu-learning-device', 'untrusted\nvalue']])), sessionStorage: storage(new Map([['edu-learning-device', 'web-valid']])) });
    expect((await import('./device')).deviceId()).toBe('web-valid');
  });
});
