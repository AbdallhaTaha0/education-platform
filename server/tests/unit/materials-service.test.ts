// Database/storage lifecycle behavior is covered by the real integration suite.
import { describe, it, expect, vi } from 'vitest';
import type { MaterialsDeps, ResourceUploadInput } from '../../src/modules/learning/materials/service.js';
import { uploadResource } from '../../src/modules/learning/materials/service.js';
import { validateMediaStatusResponse } from '../../src/modules/catalog/drm/schemas.js';
const transaction = vi.fn();
const deps = { prisma: { $transaction: transaction }, storage: {}, now: Date.now } as unknown as MaterialsDeps;
const resource = (): ResourceUploadInput => ({ labelAr: 'Arabic label', labelEn: 'English label', fileName: 'lesson.txt', mimeType: 'text/plain', content: Buffer.from('hello') });
describe('material inputs fail before persistence or storage', () => {
  it('rejects labels of the wrong runtime type', async () => { await expect(uploadResource(deps, 'lesson', { ...resource(), labelAr: 1 as unknown as string }, 'actor')).rejects.toMatchObject({ code: 'MATERIAL_INVALID' }); });
  it('rejects long bilingual labels', async () => { await expect(uploadResource(deps, 'lesson', { ...resource(), labelEn: 'x'.repeat(201) }, 'actor')).rejects.toMatchObject({ code: 'MATERIAL_INVALID' }); });
  it('rejects traversal filenames', async () => { await expect(uploadResource(deps, 'lesson', { ...resource(), fileName: '../lesson.txt' }, 'actor')).rejects.toMatchObject({ code: 'MATERIAL_INVALID' }); });
  it('rejects binary bytes claiming to be text', async () => { await expect(uploadResource(deps, 'lesson', { ...resource(), content: Buffer.from([255, 0, 1]) }, 'actor')).rejects.toMatchObject({ code: 'MATERIAL_INVALID' }); });
  it('rejects a fake PDF', async () => { await expect(uploadResource(deps, 'lesson', { ...resource(), fileName: 'x.pdf', mimeType: 'application/pdf' }, 'actor')).rejects.toMatchObject({ code: 'MATERIAL_INVALID' }); });
  it('rejects oversize resources before byte parsing', async () => { await expect(uploadResource(deps, 'lesson', { ...resource(), content: Buffer.alloc(10485761) }, 'actor')).rejects.toMatchObject({ code: 'MATERIAL_TOO_LARGE' }); });
  it('performed no database work for invalid requests', () => { expect(transaction).not.toHaveBeenCalled(); });
});
describe('actual processed duration contract', () => {
  it('normalizes the existing provider duration', () => { expect(validateMediaStatusResponse({ status: 'READY', duration: 20.01 })).toEqual({ status: 'READY', durationSeconds: 20 }); });
  it('supports the additive alias', () => { expect(validateMediaStatusResponse({ status: 'READY', durationSeconds: 600.5 }).durationSeconds).toBe(601); });
  it.each([null, '20', -1, Infinity, NaN, 2147483648])('keeps invalid duration %s unknown', duration => { expect(validateMediaStatusResponse({ status: 'READY', duration }).durationSeconds).toBeUndefined(); });
  it('does not publish unfinished processing duration', () => { expect(validateMediaStatusResponse({ status: 'PROCESSING', duration: 20 }).durationSeconds).toBeUndefined(); });
});
