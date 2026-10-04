/** Browser installation identifier, never an authentication/playback token. */
const KEY = 'edu-learning-device';
let memoryId: string | null = null;
function read(storage: Storage): string | null {
  const id = storage.getItem(KEY);
  return id && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}
export function deviceId(): string {
  try {
    const saved = read(window.localStorage);
    if (saved) return saved;
  } catch { /* Browser privacy settings may disable persistent storage. */ }
  let legacy: string | null = null;
  try { legacy = read(window.sessionStorage); } catch { /* Fall back to memory. */ }
  const id = legacy ?? memoryId ?? `web-${crypto.randomUUID()}`;
  memoryId = id;
  try { window.localStorage.setItem(KEY, id); } catch { /* Keep this tab stable. */ }
  try { window.sessionStorage.setItem(KEY, id); } catch { /* Keep the memory id. */ }
  return id;
}
