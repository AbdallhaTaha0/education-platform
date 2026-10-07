/** Temporary report session state (pure reducer).
 *
 * The generated text exists only in this in-memory session. There is no
 * archive, no sent log and no persistence: on WhatsApp handoff each part is
 * disposed, and cancel / navigation / logout / unmount dispose everything
 * still held. Keeping this logic pure makes the disposal rules unit testable.
 */
import type { GeneratedReport, ReportLanguage, ReportType } from './types';
import { reportTypeWeeks } from './types';
import { contactStillMatches } from './whatsapp';

export type SessionPhase = 'IDLE' | 'GENERATING' | 'READY' | 'HANDOFF_BLOCKED';

export interface ReportSessionState {
  phase: SessionPhase;
  studentId: string | null;
  courseIds: string[];
  reportType: ReportType | null;
  language: ReportLanguage | null;
  generatedAt: string | null;
  period: { start: string; end: string; timeZone: string } | null;
  /** Platform-held text. Cleared per part on handoff and in full on dispose. */
  parts: { index: number; total: number; text: string }[];
  /** Cleared on dispose; never persisted, never logged. Kept only while the
   * current contact has been rechecked, so a stale number can never open a chat. */
  preparedPhone: string | null;
  contactPhone: string | null;
  contactVerified: boolean;
  handedOff: number[];
  /** Non-sensitive, non-recipient UI message key. */
  note: string | null;
  error: string | null;
}

export const emptySession: ReportSessionState = {
  phase: 'IDLE',
  studentId: null,
  courseIds: [],
  reportType: null,
  language: null,
  generatedAt: null,
  period: null,
  parts: [],
  preparedPhone: null,
  contactPhone: null,
  contactVerified: false,
  handedOff: [],
  note: null,
  error: null,
};

export type ReportAction =
  | {
      type: 'GENERATE_START';
      studentId: string;
      courseIds: string[];
      reportType: ReportType;
      language: ReportLanguage;
    }
  | { type: 'GENERATED'; report: GeneratedReport; recheckedPhone: string | null }
  | { type: 'GENERATE_FAILED'; code: string }
  | { type: 'HANDOFF_BLOCKED'; note: string }
  | { type: 'PART_HANDED_OFF'; index: number }
  | { type: 'CONTACT_CHANGED'; phone: string | null }
  | { type: 'DISMISS_NOTE' }
  | { type: 'DISPOSE' };

/**
 * Selection change / logout / unmount: the previous text must not survive a
 * different student, course or contact.
 */
export function isSameSelection(
  state: ReportSessionState,
  next: { studentId: string; courseIds: string[] },
): boolean {
  if (state.studentId !== next.studentId) return false;
  if (state.courseIds.length !== next.courseIds.length) return false;
  const sortedA = [...state.courseIds].sort();
  const sortedB = [...next.courseIds].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

/** True when any platform-held report text is still present. */
export function holdsText(state: ReportSessionState): boolean {
  return state.parts.some((part) => part.text !== '');
}

export function heldParts(state: ReportSessionState): number[] {
  return state.parts.filter((part) => part.text !== '').map((part) => part.index);
}

export function remainingPartIndexes(state: ReportSessionState): number[] {
  return state.parts
    .filter((part) => !state.handedOff.includes(part.index))
    .map((part) => part.index);
}

export function expectedPartCount(report: Pick<GeneratedReport, 'reportType' | 'parts'>): number {
  const declared = report.parts[0]?.total;
  if (typeof declared === 'number' && declared > 0) return declared;
  return reportTypeWeeks(report.reportType);
}

export function reportReducer(state: ReportSessionState, action: ReportAction): ReportSessionState {
  switch (action.type) {
    case 'GENERATE_START':
      // A new generation discards any earlier text first.
      return {
        ...emptySession,
        phase: 'GENERATING',
        studentId: action.studentId,
        courseIds: [...action.courseIds],
        reportType: action.reportType,
        language: action.language,
      };
    case 'GENERATED': {
      // The recipient is only usable for a handoff when the fresh recheck
      // still matches the number the backend prepared the text for.
      const verified = contactStillMatches(
        action.report.guardian.phone,
        action.recheckedPhone,
      );
      return {
        ...emptySession,
        phase: 'READY',
        studentId: action.report.studentId,
        courseIds: [...action.report.courseIds],
        reportType: action.report.reportType,
        language: state.language,
        generatedAt: action.report.generatedAt,
        period: action.report.period,
        parts: action.report.parts.map((part) => ({
          index: part.index,
          total: part.total,
          text: part.text,
        })),
        preparedPhone: verified ? action.report.guardian.phone : null,
        contactPhone: action.recheckedPhone,
        contactVerified: verified,
      };
    }
    case 'GENERATE_FAILED':
      return {
        ...state,
        phase: 'IDLE',
        parts: [],
        preparedPhone: null,
        contactPhone: null,
        error: action.code,
        note: null,
      };
    case 'HANDOFF_BLOCKED':
      return { ...state, phase: 'HANDOFF_BLOCKED', note: action.note };
    case 'PART_HANDED_OFF': {
      const parts = state.parts.map((part) => part.index === action.index ? { ...part, text: '' } : part);
      const complete = !parts.some(part => part.text !== '');
      return {
        ...state,
        parts,
        preparedPhone: complete ? null : state.preparedPhone,
        contactPhone: complete ? null : state.contactPhone,
        handedOff: state.handedOff.includes(action.index)
          ? state.handedOff
          : [...state.handedOff, action.index],
      };
    }
    case 'CONTACT_CHANGED':
      // Fail safely: hold no text and no number that could open the wrong chat.
      return { ...emptySession, error: 'CONTACT_CHANGED' };
    case 'DISMISS_NOTE':
      return {
        ...state,
        note: null,
        phase: state.phase === 'HANDOFF_BLOCKED' ? 'READY' : state.phase,
      };
    case 'DISPOSE':
      return { ...emptySession };
    default:
      return state;
  }
}
