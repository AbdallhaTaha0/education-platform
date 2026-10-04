import type { Request } from 'express';
import { LearningError } from '../errors.js';

/** Bounded body before the native multipart parser; guards run first. */
export async function parseMaterialForm(req: Request, fields: string[], maxBytes: number): Promise<FormData> {
  const contentType = req.headers['content-type'] ?? '';
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) throw new LearningError('MATERIAL_INVALID');
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > maxBytes) throw new LearningError('MATERIAL_TOO_LARGE');
  const body = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0, failed = false;
    const timeout = setTimeout(() => { failed = true; chunks.length = 0; reject(new LearningError('MATERIAL_INVALID')); req.resume(); }, 30_000);
    req.on('data', (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxBytes) { failed = true; chunks.length = 0; clearTimeout(timeout); reject(new LearningError('MATERIAL_TOO_LARGE')); }
      else chunks.push(chunk);
    });
    req.once('end', () => { clearTimeout(timeout); if (!failed) resolve(Buffer.concat(chunks)); });
    req.once('error', () => { clearTimeout(timeout); reject(new LearningError('MATERIAL_INVALID')); });
    req.once('aborted', () => { clearTimeout(timeout); reject(new LearningError('MATERIAL_INVALID')); });
  });
  try {
    const form = await new Response(body, { headers: { 'content-type': contentType } }).formData();
    for (const key of form.keys()) if (!fields.includes(key) || form.getAll(key).length !== 1) throw new LearningError('MATERIAL_INVALID');
    for (const key of fields) if (!form.has(key)) throw new LearningError('MATERIAL_INVALID');
    return form;
  } catch { throw new LearningError('MATERIAL_INVALID'); }
}
