import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadVideo } from './upload';
class StorageRequest {
  static last: StorageRequest;
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  status = 200; withCredentials = true;
  onload?: () => void; onerror?: () => void; onabort?: () => void;
  open = vi.fn(); setRequestHeader = vi.fn(); send = vi.fn();
  abort = () => this.onabort?.();
  constructor() { StorageRequest.last = this; }
}
afterEach(() => vi.unstubAllGlobals());
describe('measured storage upload', () => {
  it('reports bytes, handles unknown length and waits for HTTP success before completion', async () => {
    vi.stubGlobal('XMLHttpRequest', StorageRequest); const values: (number | undefined)[] = [];
    const file = new File(['test'], 'test.mp4');
    const result = uploadVideo('https://storage.example.test/signed', file, 'video/mp4', value => values.push(value), new AbortController().signal);
    const xhr = StorageRequest.last;
    expect(xhr.withCredentials).toBe(false); expect(xhr.send).toHaveBeenCalledWith(file);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 25, total: 0 });
    expect(values).toEqual([25, undefined]); xhr.onload?.(); await result; expect(values[values.length - 1]).toBe(100);
  });
  it('rejects failed storage responses without claiming success', async () => {
    vi.stubGlobal('XMLHttpRequest', StorageRequest); const progress = vi.fn();
    const result = uploadVideo('https://storage.example.test/signed', new File(['x'], 'test.mp4'), 'video/mp4', progress, new AbortController().signal);
    const expected = expect(result).rejects.toThrow('UPLOAD_FAILED'); StorageRequest.last.status = 500; StorageRequest.last.onload?.(); await expected;
    expect(progress).not.toHaveBeenCalled();
  });
  it('aborts an upload when its editor is removed', async () => {
    vi.stubGlobal('XMLHttpRequest', StorageRequest); const controller = new AbortController();
    const result = uploadVideo('https://storage.example.test/signed', new File(['x'], 'test.mp4'), 'video/mp4', vi.fn(), controller.signal);
    const expected = expect(result).rejects.toThrow('UPLOAD_ABORTED'); controller.abort(); await expected;
  });
});
