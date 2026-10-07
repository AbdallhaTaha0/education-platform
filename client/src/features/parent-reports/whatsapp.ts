/** WhatsApp click-to-chat handoff helpers (official contract).
 *
 * Source of the URL shape: https://faq.whatsapp.com/5913398998672934 —
 * `https://wa.me/<number>?text=<url-encoded message>` pre-fills the composer
 * for the signed-in WhatsApp account. The platform does NOT press Send, does
 * NOT use an unofficial library, a browser robot or a paid API, and cannot
 * observe the resulting draft, delivery or read state.
 *
 * Everything here is pure so it can be unit tested without a browser.
 */

export const CLICK_TO_CHAT_HOSTS = ['wa.me', 'www.wa.me', 'api.whatsapp.com'] as const;

/**
 * Practical URL budget for a click-to-chat link. WhatsApp publishes no hard
 * limit, so the platform refuses to assume one: an over-long part is reported
 * to the ADMIN with an explicit copy fallback instead of being truncated.
 */
export const CLICK_TO_CHAT_MAX_URL_LENGTH = 12000;

export type RecipientProblem = 'MISSING' | 'NOT_INTERNATIONAL' | 'TOO_SHORT' | 'TOO_LONG';

export type RecipientResult =
  | { ok: true; digits: string }
  | { ok: false; reason: RecipientProblem };

/**
 * Convert a registered contact number into the digits-only international form
 * click-to-chat expects. The stored/returned value already comes from the
 * existing contact contract (server-side E.164 normalization), so this only
 * strips the `+` and separators — it never guesses a country code, and a
 * local form such as `010…` is refused rather than assumed to be Egyptian.
 */
export function normalizeRecipient(raw: string | null | undefined): RecipientResult {
  if (raw === null || raw === undefined) return { ok: false, reason: 'MISSING' };
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, reason: 'MISSING' };
  // Arabic-Indic digits can appear in an ADMIN-edited field; make them ASCII.
  const ascii = trimmed.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const hadPlus = ascii.startsWith('+');
  const digits = ascii.replace(/[^\d]/g, '');
  if (digits === '') return { ok: false, reason: 'MISSING' };
  // Without a country code the number is local; inferring one would risk
  // opening the wrong parent's chat.
  if (!hadPlus && digits.length <= 12 && !looksInternationalWithoutPlus(digits)) {
    return { ok: false, reason: 'NOT_INTERNATIONAL' };
  }
  if (digits.length < 8) return { ok: false, reason: 'TOO_SHORT' };
  if (digits.length > 15) return { ok: false, reason: 'TOO_LONG' };
  if (digits.startsWith('0')) return { ok: false, reason: 'NOT_INTERNATIONAL' };
  return { ok: true, digits };
}

/** A bare number is only accepted when it already carries a country code. */
function looksInternationalWithoutPlus(digits: string): boolean {
  return digits.length >= 13 && !digits.startsWith('0');
}

export type HandoffUrlResult =
  | { ok: true; url: string; digits: string }
  | { ok: false; reason: RecipientProblem | 'EMPTY_TEXT' | 'URL_TOO_LONG'; urlLength?: number };

/** Open a verified chat after an explicit copy, without text in the URL. */
export function buildChatOnlyUrl(phone: string | null | undefined): HandoffUrlResult {
  const recipient = normalizeRecipient(phone);
  if (!recipient.ok) return { ok: false, reason: recipient.reason };
  return { ok: true, url: `https://wa.me/${recipient.digits}`, digits: recipient.digits };
}

/** Build the pre-filled chat URL for one bounded part. */
export function buildClickToChatUrl(
  phone: string | null | undefined,
  text: string,
): HandoffUrlResult {
  const recipient = normalizeRecipient(phone);
  if (!recipient.ok) return { ok: false, reason: recipient.reason };
  if (text.trim() === '') return { ok: false, reason: 'EMPTY_TEXT' };
  // encodeURIComponent keeps spaces, newlines and Arabic intact for WhatsApp.
  const url = `https://wa.me/${recipient.digits}?text=${encodeURIComponent(text)}`;
  if (url.length > CLICK_TO_CHAT_MAX_URL_LENGTH) {
    return { ok: false, reason: 'URL_TOO_LONG', urlLength: url.length };
  }
  return { ok: true, url, digits: recipient.digits };
}

/** Guard every outbound navigation: only the intended WhatsApp hosts. */
export function isAllowedClickToChatUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return (CLICK_TO_CHAT_HOSTS as readonly string[]).includes(parsed.hostname);
  } catch {
    return false;
  }
}

/** Decode the pre-filled text back out of a click-to-chat URL (verification aid). */
export function readClickToChatUrl(url: string): { phone: string; text: string } | null {
  try {
    const parsed = new URL(url);
    if (!isAllowedClickToChatUrl(url)) return null;
    const phone = parsed.pathname.replace(/^\/+/, '');
    const text = parsed.searchParams.get('text') ?? '';
    return { phone, text };
  } catch {
    return null;
  }
}

export type HandoffChannel = 'POPUP' | 'SAME_TAB';

/**
 * Desktop browsers honour `window.open` from a user gesture. Mobile browsers
 * commonly ignore background popups, so the same-tab navigation is used there
 * and the platform keeps an explicit "open again / copy" fallback visible.
 */
export function preferredChannel(): HandoffChannel {
  if (typeof navigator === 'undefined') return 'SAME_TAB';
  const ua = navigator.userAgent ?? '';
  const mobile = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(ua);
  return mobile ? 'SAME_TAB' : 'POPUP';
}

export type PopupOutcome = 'OPENED' | 'BLOCKED' | 'UNSUPPORTED';

export interface PopupHandle {
  opener?: unknown;
  location: { href: string };
  closed?: boolean;
  focus?: () => void;
  close?: () => void;
}

export interface OpenWindow {
  (url: string, target?: string, features?: string): PopupHandle | null;
}

/**
 * Reserve the navigation gesture synchronously (before the asynchronous report
 * generation resolves) by opening a blank tab. Some browsers block even that,
 * so `BLOCKED` is a normal outcome that must surface a visible fallback rather
 * than being reported as success.
 */
export function reserveWindow(open: OpenWindow | null | undefined): {
  outcome: PopupOutcome;
  handle: PopupHandle | null;
} {
  if (typeof open !== 'function') return { outcome: 'UNSUPPORTED', handle: null };
  let handle: PopupHandle | null = null;
  try {
    // noopener makes window.open return null in Chromium. Detach the opener
    // immediately while keeping the handle needed for asynchronous navigation.
    handle = open('about:blank', '_blank');
    if (handle) handle.opener = null;
  } catch {
    return { outcome: 'BLOCKED', handle: null };
  }
  return handle ? { outcome: 'OPENED', handle } : { outcome: 'BLOCKED', handle: null };
}

/** Point a reserved window at the verified click-to-chat URL. */
export function navigateReserved(handle: PopupHandle, url: string): boolean {
  if (handle.closed || !isAllowedClickToChatUrl(url)) return false;
  try {
    handle.location.href = url;
    return true;
  } catch {
    return false;
  }
}

export function releaseWindow(handle: PopupHandle | null): void {
  if (!handle) return;
  try {
    handle.close?.();
  } catch {
    /* nothing further to do; the tab is not ours to control */
  }
}

/**
 * Bounded-part bookkeeping for long reports. Each part is disposed after its
 * own handoff; unhanded parts stay transiently and the remaining count is
 * shown. Nothing is ever silently truncated.
 */
export interface PartLedger {
  total: number;
  handedOff: number[];
}

export function remainingParts(ledger: PartLedger): number[] {
  const done = new Set(ledger.handedOff);
  const parts: number[] = [];
  for (let index = 1; index <= ledger.total; index += 1) {
    if (!done.has(index)) parts.push(index);
  }
  return parts;
}

export function remainingCount(ledger: PartLedger): number {
  return Math.max(0, ledger.total - new Set(ledger.handedOff).size);
}

export function isComplete(ledger: PartLedger): boolean {
  return remainingCount(ledger) === 0;
}

/**
 * Contact-change guard. If the freshly rechecked contact differs from the one
 * used to build the prepared text, the handoff is refused so an ADMIN cannot
 * open the previous number's chat by accident.
 */
export function contactStillMatches(
  prepared: string | null | undefined,
  rechecked: string | null | undefined,
): boolean {
  const a = normalizeRecipient(prepared);
  const b = normalizeRecipient(rechecked);
  if (!a.ok || !b.ok) return false;
  return a.digits === b.digits;
}
