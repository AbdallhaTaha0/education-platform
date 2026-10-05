/** Storage PUT: no platform cookies or credentials leave the platform origin. */
export function uploadVideo(url: string, file: File, mime: string, onProgress: (percent: number | undefined) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    xhr.open('PUT', url);
    xhr.withCredentials = false;
    xhr.setRequestHeader('Content-Type', mime);
    xhr.upload.onprogress = (event) => onProgress(event.lengthComputable && event.total > 0
      ? Math.min(100, Math.max(0, Math.round(event.loaded / event.total * 100))) : undefined);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); finish(); }
      else finish(new Error('UPLOAD_FAILED'));
    };
    xhr.onerror = () => finish(new Error('UPLOAD_FAILED'));
    xhr.onabort = () => finish(new Error('UPLOAD_ABORTED'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { finish(new Error('UPLOAD_ABORTED')); return; }
    xhr.send(file);
  });
}
