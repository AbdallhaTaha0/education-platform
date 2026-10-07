import { useCallback, useEffect, useRef, useState } from 'react';
import { parentReportsApi, ParentReportsApiError } from './api';
import { buildClickToChatUrl, buildChatOnlyUrl, contactStillMatches, navigateReserved, preferredChannel, releaseWindow, reserveWindow, normalizeRecipient, type PopupHandle } from './whatsapp';
import { emptySession, holdsText, reportReducer, type ReportAction, type ReportSessionState } from './session';
import type { ReportLanguage, ReportType } from './types';

export type HandoffNote = 'OPENED' | 'POPUP_BLOCKED' | 'PART_TOO_LONG' | 'CONTACT_CHANGED' | 'CONTACT_MISSING' | 'CONTACT_UNVERIFIED' | 'COPIED' | 'COPY_FAILED' | null;
export type HandoffBlockReason = 'CONTACT_MISSING' | 'CONTACT_UNVERIFIED';
export interface GenerateInput { studentId: string; courseIds: string[]; reportType: ReportType; language: ReportLanguage; format?: 'SHORT' | 'DETAILED' }
export interface OpenedReportSelection { studentId: string; courseIds: string[] }

/** All async operations share an epoch. Cancellation closes the reserved blank
 * window and late responses never read, navigate or modify a newer report. */
export function useParentReportHandoff(onOpened?: (selection: OpenedReportSelection) => void) {
  const openedCallback = useRef(onOpened);
  openedCallback.current = onOpened;
  const [state, setState] = useState<ReportSessionState>(emptySession);
  const [note, setNote] = useState<HandoffNote>(null);
  const stateRef = useRef(state);
  const mounted = useRef(true);
  const epoch = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const popup = useRef<PopupHandle | null>(null);
  const copiedParts = useRef(new Set<number>());
  const apply = useCallback((action: ReportAction) => {
    stateRef.current = reportReducer(stateRef.current, action);
    if (mounted.current) setState(stateRef.current);
  }, []);
  const cancel = useCallback(() => {
    epoch.current += 1;
    abort.current?.abort(); abort.current = null;
    releaseWindow(popup.current); popup.current = null;
  }, []);
  const dispose = useCallback(() => { cancel(); copiedParts.current.clear(); apply({ type: 'DISPOSE' }); setNote(null); }, [cancel, apply]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancel(); stateRef.current = emptySession; };
  }, [cancel]);

  const begin = useCallback((reserve: boolean) => {
    cancel();
    const controller = new AbortController(); abort.current = controller;
    let blocked = false;
    if (reserve && preferredChannel() === 'POPUP') {
      const reservation = reserveWindow(window.open.bind(window));
      popup.current = reservation.handle; blocked = !reservation.handle;
    }
    return { controller, token: epoch.current, blocked };
  }, [cancel]);
  const alive = (token: number, controller: AbortController) => mounted.current && token === epoch.current && !controller.signal.aborted;
  const closePopup = () => { releaseWindow(popup.current); popup.current = null; };

  // This function captures only identifiers, never a report, text or recipient
  // URL across the contact request. Read the current part after the last guard.
  const navigatePart = (index: number, sameTab: boolean): void => {
    const current = stateRef.current;
    const part = current.parts.find(p => p.index === index);
    if (!part?.text) { closePopup(); return; }
    let built = buildClickToChatUrl(current.preparedPhone, part.text);
    if (!built.ok && built.reason === 'URL_TOO_LONG' && sameTab && copiedParts.current.has(index)) {
      built = buildChatOnlyUrl(current.preparedPhone);
    }
    if (!built.ok) { closePopup(); setNote(built.reason === 'URL_TOO_LONG' ? 'PART_TOO_LONG' : 'CONTACT_MISSING'); return; }
    let opened = false;
    if (!sameTab && popup.current) {
      opened = navigateReserved(popup.current, built.url);
      if (opened) popup.current = null; // handed-over tab is no longer owned
    } else if (sameTab) {
      try { window.location.assign(built.url); opened = true; } catch { opened = false; }
    }
    if (!opened) { closePopup(); setNote('POPUP_BLOCKED'); return; }
    apply({ type: 'PART_HANDED_OFF', index });
    copiedParts.current.delete(index);
    setNote('OPENED');
    if (current.studentId) openedCallback.current?.({ studentId: current.studentId, courseIds: [...current.courseIds] });
  };

  const handoff = useCallback((index: number, manual = false) => {
    if (!stateRef.current.parts.some(p => p.index === index && p.text)) return;
    const { controller, token } = begin(!manual);
    const studentId = stateRef.current.studentId;
    if (!studentId) { closePopup(); return; }
    void parentReportsApi.fetchReportContact(studentId, controller.signal).then(({ data }) => {
      if (!alive(token, controller)) return;
      if (!contactStillMatches(stateRef.current.preparedPhone, data.phone)) {
        closePopup(); apply({ type: 'CONTACT_CHANGED', phone: null }); setNote('CONTACT_CHANGED'); return;
      }
      navigatePart(index, manual || preferredChannel() === 'SAME_TAB');
    }).catch(() => {
      if (!alive(token, controller)) return;
      closePopup(); setNote('CONTACT_UNVERIFIED');
    });
  }, [begin, apply]);

  const generate = useCallback((input: GenerateInput, send: boolean) => {
    copiedParts.current.clear();
    const { controller, token, blocked } = begin(send);
    apply({ type: 'GENERATE_START', ...input }); setNote(null);
    void parentReportsApi.generateReport(input, controller.signal).then(async ({ data }) => {
      if (!alive(token, controller)) { data.parts.length = 0; data.guardian.phone = null; return; }
      // Copy only the contract data into the transient session, then erase the
      // response's payload before awaiting another request.
      apply({ type: 'GENERATED', report: data, recheckedPhone: data.guardian.phone });
      data.parts.forEach(part => { part.text = ''; }); data.parts.length = 0; data.guardian.phone = null;
      try {
        const contact = await parentReportsApi.fetchReportContact(input.studentId, controller.signal);
        if (!alive(token, controller)) return;
        const phone = stateRef.current.preparedPhone;
        if (phone === null && contact.data.phone === null) {
          closePopup(); setNote(send ? 'CONTACT_MISSING' : null); return;
        }
        if (!contactStillMatches(phone, contact.data.phone)) {
          closePopup(); apply({ type: 'CONTACT_CHANGED', phone: null }); setNote('CONTACT_CHANGED'); return;
        }
        if (!send) return;
        if (blocked) { closePopup(); setNote('POPUP_BLOCKED'); return; }
        const first = stateRef.current.parts.find(part => part.text);
        if (first) navigatePart(first.index, preferredChannel() === 'SAME_TAB');
      } catch {
        if (!alive(token, controller)) return;
        closePopup(); setNote('CONTACT_UNVERIFIED');
      }
    }).catch((err: unknown) => {
      if (!alive(token, controller)) return;
      closePopup(); apply({ type: 'GENERATE_FAILED', code: err instanceof ParentReportsApiError ? err.code : 'SERVICE_ERROR' });
    });
  }, [begin, apply]);

  const copyPart = useCallback(async (index: number) => {
    if (!stateRef.current.parts.some(part => part.index === index && part.text)) return;
    const token = epoch.current;
    try {
      if (!navigator.clipboard?.writeText) { setNote('COPY_FAILED'); return; }
      // No text is held in this continuation after writeText has been invoked.
      const pending = navigator.clipboard.writeText(stateRef.current.parts.find(part => part.index === index)?.text ?? '');
      await pending;
      if (mounted.current && token === epoch.current) {
        copiedParts.current.add(index);
        setNote('COPIED');
      }
    } catch { if (mounted.current && token === epoch.current) setNote('COPY_FAILED'); }
  }, []);
  const recipientUsable = normalizeRecipient(state.preparedPhone).ok;
  return {
    state, note, generating: state.phase === 'GENERATING',
    remaining: state.parts.filter(part => part.text !== '').length,
    holdsText: holdsText(state),
    generateAndSend: (input: GenerateInput) => generate(input, true),
    generatePreview: (input: GenerateInput) => generate(input, false),
    handOffPart: (index: number) => handoff(index),
    openPartManually: (index: number) => handoff(index, true),
    copyPart, canHandOff: recipientUsable,
    handOffBlockedReason: recipientUsable ? null : 'CONTACT_MISSING' as HandoffBlockReason,
    dispose, dismissNote: () => setNote(null),
  };
}
