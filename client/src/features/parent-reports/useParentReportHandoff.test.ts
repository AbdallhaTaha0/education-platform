import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0, effects: [] as (() => void)[], effectRun: false }));
vi.mock('react', () => ({
  useState: (initial: unknown) => { const i = harness.cursor++; if (!(i in harness.cells)) harness.cells[i] = initial; return [harness.cells[i], (value: unknown) => { harness.cells[i] = value; }]; },
  useRef: (initial: unknown) => { const i = harness.cursor++; if (!(i in harness.cells)) harness.cells[i] = { current: initial }; return harness.cells[i]; },
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => (() => void)) => { if (!harness.effectRun) { harness.effectRun = true; harness.effects.push(fn()); } },
}));
const api = vi.hoisted(() => ({ generateReport: vi.fn(), fetchReportContact: vi.fn() }));
vi.mock('./api', () => ({ parentReportsApi: api, ParentReportsApiError: class extends Error {} }));
import { useParentReportHandoff, type GenerateInput } from './useParentReportHandoff';
const input: GenerateInput = { studentId: 'student-1', courseIds: ['course-1'], reportType: 'WEEK', language: 'en' };
function report() { return { data: { ...input, generatedAt: '2026-10-07T00:00:00Z', period: { start: '2026-09-30T00:00:00Z', end: '2026-10-07T00:00:00Z', timeZone: 'Africa/Cairo' }, guardian: { phone: '+201001234567' }, parts: [{ index: 1, total: 1, text: 'FAYQ\nQuiz: passed' }] } }; }
function render(onOpened?: Parameters<typeof useParentReportHandoff>[0]) { harness.cursor = 0; return useParentReportHandoff(onOpened); }
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let open: ReturnType<typeof vi.fn>;
let assign: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;
let handle: { location: { href: string }; opener: unknown; close: ReturnType<typeof vi.fn> };
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
beforeEach(() => {
  harness.cells = []; harness.cursor = 0; harness.effects = []; harness.effectRun = false;
  api.generateReport.mockReset().mockImplementation(async () => report());
  api.fetchReportContact.mockReset().mockResolvedValue({ data: { phone: '+201001234567' } });
  close = vi.fn(); handle = { location: { href: '' }, opener: {}, close };
  open = vi.fn(() => handle); assign = vi.fn();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { open, location: { assign } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Chrome Desktop' } });
});
afterEach(() => { for (const cleanup of harness.effects) cleanup(); if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window'); if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else Reflect.deleteProperty(globalThis, 'navigator'); });
describe('actual handoff hook async boundaries', () => {
  it('opens the verified chat after copying an oversized report, then erases it', async () => {
    const text = 'ا'.repeat(6000);
    const response = report(); response.data.parts[0].text = text;
    api.generateReport.mockResolvedValue(response);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Chrome Desktop', clipboard: { writeText } } });
    const opened = vi.fn();
    render(opened).generateAndSend(input); await settle();
    expect(render(opened).note).toBe('PART_TOO_LONG');
    render(opened).openPartManually(1); await settle();
    expect(assign).not.toHaveBeenCalled();
    await render(opened).copyPart(1);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(text);
    expect(opened).not.toHaveBeenCalled();
    render(opened).openPartManually(1); await settle();
    expect(assign).toHaveBeenCalledExactlyOnceWith('https://wa.me/201001234567');
    expect(api.fetchReportContact).toHaveBeenCalledTimes(3);
    expect(opened).toHaveBeenCalledExactlyOnceWith({ studentId: input.studentId, courseIds: input.courseIds });
    expect(render().holdsText).toBe(false);
    expect(render().state.preparedPhone).toBeNull();
  });

  it('refuses copied oversized text when the guardian changes', async () => {
    const response = report(); response.data.parts[0].text = 'ا'.repeat(6000);
    api.generateReport.mockResolvedValue(response);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Chrome Desktop', clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } } });
    render().generateAndSend(input); await settle(); await render().copyPart(1);
    api.fetchReportContact.mockResolvedValue({ data: { phone: '+201001234569' } });
    render().openPartManually(1); await settle();
    expect(assign).not.toHaveBeenCalled();
    expect(render().note).toBe('CONTACT_CHANGED');
    expect(render().holdsText).toBe(false);
  });

  it('does not reuse a copied-part acknowledgement for a newly generated report', async () => {
    api.generateReport.mockImplementation(async () => {
      const response = report(); response.data.parts[0].text = 'ا'.repeat(6000); return response;
    });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Chrome Desktop', clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } } });
    render().generateAndSend(input); await settle(); await render().copyPart(1);
    render().generateAndSend(input); await settle();
    render().openPartManually(1); await settle();
    expect(assign).not.toHaveBeenCalled();
    expect(render().note).toBe('PART_TOO_LONG');
  });
  it('reports only the exact selected student/course identifiers after successful navigation', async () => {
    const opened = vi.fn();
    api.generateReport.mockResolvedValue({ data: { ...report().data, courseIds: ['course-1', 'course-2'] } });
    render(opened).generateAndSend({ ...input, courseIds: ['course-1', 'course-2'] });
    await settle();
    expect(opened).toHaveBeenCalledExactlyOnceWith({ studentId: 'student-1', courseIds: ['course-1', 'course-2'] });
    expect(render().holdsText).toBe(false);
  });
  it('does not mark blocked or changed-contact handoffs as opened', async () => {
    const opened = vi.fn();
    open.mockReturnValue(null);
    render(opened).generateAndSend(input); await settle();
    expect(opened).not.toHaveBeenCalled();
    open.mockReturnValue(handle);
    api.fetchReportContact.mockResolvedValue({ data: { phone: '+201001234569' } });
    render(opened).generateAndSend(input); await settle();
    expect(opened).not.toHaveBeenCalled();
    expect(handle.location.href).toBe('');
  });
  it('reserves the desktop gesture before requesting generation, disposes payload and recipient', async () => {
    const response = report(); api.generateReport.mockResolvedValue(response);
    render().generateAndSend(input); expect(open).toHaveBeenCalledTimes(1); expect(api.generateReport).toHaveBeenCalledTimes(1);
    await settle(); expect(handle.opener).toBeNull(); expect(handle.location.href).toContain('https://wa.me/201001234567');
    expect(response.data.parts).toEqual([]); expect(response.data.guardian.phone).toBeNull();
    expect(render().state.parts[0].text).toBe(''); expect(render().state.preparedPhone).toBeNull(); expect(render().note).toBe('OPENED');
  });
  it('keeps blocked popup text for fallback and does not claim handoff', async () => {
    open.mockReturnValue(null); render().generateAndSend(input); await settle();
    expect(render().note).toBe('POPUP_BLOCKED'); expect(render().state.parts[0].text).toContain('FAYQ'); expect(assign).not.toHaveBeenCalled();
  });
  it('missing contact permits a readable preview but no recipient', async () => {
    const response = report(); response.data.guardian.phone = null as unknown as string;
    api.generateReport.mockResolvedValue(response); api.fetchReportContact.mockResolvedValue({ data: { phone: null } });
    render().generatePreview(input); await settle(); expect(render().holdsText).toBe(true); expect(render().canHandOff).toBe(false); expect(render().note).toBeNull();
  });
  it('mobile generation hands off via same-tab navigation', async () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'iPhone Mobile' } });
    render().generateAndSend(input); await settle(); expect(open).not.toHaveBeenCalled(); expect(assign).toHaveBeenCalledTimes(1); expect(render().holdsText).toBe(false);
  });
  it('rejects an overlong URL without truncating and disposes only the handed-over later part', async () => {
    const response = report(); response.data.parts = [{ index: 1, total: 2, text: 'ا'.repeat(6000) }, { index: 2, total: 2, text: 'FAYQ part two' }];
    api.generateReport.mockResolvedValue(response); render().generateAndSend(input); await settle();
    expect(render().note).toBe('PART_TOO_LONG'); expect(render().state.parts[0].text).toHaveLength(6000); expect(handle.location.href).toBe('');
    render().handOffPart(2); await settle(); expect(handle.location.href).toContain('FAYQ%20part%20two');
    expect(render().state.parts[1].text).toBe(''); expect(render().state.parts[0].text).toHaveLength(6000); expect(render().remaining).toBe(1);
  });
  it('cancellation closes a reserved window and ignores a late contact answer', async () => {
    render().generatePreview(input); await settle(); const pending = deferred<{ data: { phone: string } }>(); api.fetchReportContact.mockReturnValue(pending.promise);
    render().handOffPart(1); expect(open).toHaveBeenCalledTimes(1); render().dispose(); pending.resolve({ data: { phone: '+201001234567' } }); await settle();
    expect(close).toHaveBeenCalledTimes(1); expect(handle.location.href).toBe(''); expect(render().state.parts).toEqual([]); expect(render().note).toBeNull();
  });
  it('manual fallback rechecks changed contact and disposes without navigating', async () => {
    render().generatePreview(input); await settle(); api.fetchReportContact.mockResolvedValue({ data: { phone: '+201001234569' } });
    render().openPartManually(1); await settle(); expect(assign).not.toHaveBeenCalled(); expect(render().state.parts).toEqual([]); expect(render().note).toBe('CONTACT_CHANGED');
  });
  it('an obsolete generation cannot overwrite a newer student or navigate', async () => {
    const pending = deferred<ReturnType<typeof report>>(); api.generateReport.mockReturnValueOnce(pending.promise);
    api.generateReport.mockResolvedValueOnce({ data: { ...report().data, studentId: 'student-2' } });
    render().generateAndSend(input); render().generatePreview({ ...input, studentId: 'student-2' }); await settle();
    pending.resolve(report()); await settle(); expect(handle.location.href).toBe(''); expect(close).toHaveBeenCalledTimes(1); expect(render().state.studentId).toBe('student-2');
    expect(api.fetchReportContact).toHaveBeenCalledTimes(1);
  });
  it('unmount prevents a delayed generation from retaining a report or opening a chat', async () => {
    const pending = deferred<ReturnType<typeof report>>(); api.generateReport.mockReturnValue(pending.promise); render().generateAndSend(input);
    harness.effects[0](); pending.resolve(report()); await settle(); expect(close).toHaveBeenCalledTimes(1); expect(handle.location.href).toBe(''); expect(api.fetchReportContact).not.toHaveBeenCalled();
  });
});
