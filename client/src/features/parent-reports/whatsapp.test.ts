import { describe, expect, it } from 'vitest';
import {
  buildClickToChatUrl,
  contactStillMatches,
  isAllowedClickToChatUrl,
  isComplete,
  navigateReserved,
  normalizeRecipient,
  preferredChannel,
  readClickToChatUrl,
  remainingCount,
  remainingParts,
  reserveWindow,
  releaseWindow,
  CLICK_TO_CHAT_MAX_URL_LENGTH,
  type PopupHandle,
} from './whatsapp';

describe('recipient normalization for click-to-chat', () => {
  it('uses the international digits already stored by the contact contract', () => {
    expect(normalizeRecipient('+201001234567')).toEqual({ ok: true, digits: '201001234567' });
    expect(normalizeRecipient('  +20 100 123 4567 ')).toEqual({ ok: true, digits: '201001234567' });
  });

  it('converts Arabic-Indic digits before checking the format', () => {
    expect(normalizeRecipient('+٢٠١٠٠١٢٣٤٥٦٧')).toEqual({ ok: true, digits: '201001234567' });
  });

  it('refuses a local number instead of guessing a country code', () => {
    expect(normalizeRecipient('01001234567')).toEqual({ ok: false, reason: 'NOT_INTERNATIONAL' });
    expect(normalizeRecipient('010012345678')).toEqual({ ok: false, reason: 'NOT_INTERNATIONAL' });
  });

  it('reports a missing number distinctly from an invalid one', () => {
    expect(normalizeRecipient(null)).toEqual({ ok: false, reason: 'MISSING' });
    expect(normalizeRecipient('   ')).toEqual({ ok: false, reason: 'MISSING' });
    expect(normalizeRecipient('++201')).toEqual({ ok: false, reason: 'TOO_SHORT' });
    expect(normalizeRecipient('+2010012345678901234')).toEqual({ ok: false, reason: 'TOO_LONG' });
  });

  it('refuses an impossible zero-prefixed international number', () => {
    expect(normalizeRecipient('+0201001234567')).toEqual({ ok: false, reason: 'NOT_INTERNATIONAL' });
  });
});

describe('click-to-chat URL contract', () => {
  it('builds the official pre-filled wa.me URL with the encoded message', () => {
    const built = buildClickToChatUrl('+201001234567', 'تقرير FAYQ\nأسبوع: شاهد');
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.url.startsWith('https://wa.me/201001234567?text=')).toBe(true);
    // The message must survive the round trip, including Arabic, newlines and spaces.
    expect(readClickToChatUrl(built.url)).toEqual({
      phone: '201001234567',
      text: 'تقرير FAYQ\nأسبوع: شاهد',
    });
  });

  it('encodes characters that would otherwise break the query', () => {
    const built = buildClickToChatUrl('+201001234567', 'a&b=c ?d#e 100%');
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(readClickToChatUrl(built.url)?.text).toBe('a&b=c ?d#e 100%');
    expect(built.url).toContain('%26');
    expect(built.url).toContain('%3F');
    expect(built.url).toContain('%23');
  });

  it('refuses an empty message rather than opening a blank chat', () => {
    expect(buildClickToChatUrl('+201001234567', '   ')).toEqual({ ok: false, reason: 'EMPTY_TEXT' });
  });

  it('refuses a missing recipient before any URL exists', () => {
    expect(buildClickToChatUrl(null, 'نص')).toEqual({ ok: false, reason: 'MISSING' });
  });

  it('reports an over-long part instead of truncating it', () => {
    const long = 'ا'.repeat(CLICK_TO_CHAT_MAX_URL_LENGTH + 10);
    const built = buildClickToChatUrl('+201001234567', long);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.reason).toBe('URL_TOO_LONG');
    expect(built.urlLength).toBeGreaterThan(CLICK_TO_CHAT_MAX_URL_LENGTH);
  });
});

describe('navigation host restriction', () => {
  it('accepts only the intended WhatsApp hosts over https', () => {
    expect(isAllowedClickToChatUrl('https://wa.me/201001234567?text=x')).toBe(true);
    expect(isAllowedClickToChatUrl('https://api.whatsapp.com/send?phone=201001234567')).toBe(true);
  });

  it('refuses look-alike, plain-http and non-WhatsApp hosts', () => {
    expect(isAllowedClickToChatUrl('https://wa.me.evil.example/201001234567?text=x')).toBe(false);
    expect(isAllowedClickToChatUrl('http://wa.me/201001234567?text=x')).toBe(false);
    expect(isAllowedClickToChatUrl('https://evil.example/wa.me/201001234567')).toBe(false);
    expect(isAllowedClickToChatUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedClickToChatUrl('not a url')).toBe(false);
  });

  it('never navigates a reserved window to a disallowed URL', () => {
    const handle: PopupHandle = { location: { href: 'about:blank' } };
    expect(navigateReserved(handle, 'https://evil.example/x')).toBe(false);
    expect(handle.location.href).toBe('about:blank');
    expect(navigateReserved(handle, 'https://wa.me/201001234567?text=%D9%86')).toBe(true);
    expect(handle.location.href).toContain('wa.me/201001234567');
  });
});

describe('gesture reservation', () => {
  it('keeps a navigation handle while immediately detaching the opener', () => {
    const handle: PopupHandle = { location: { href: '' }, opener: { sensitive: true } };
    const reservation = reserveWindow((_url, _target, features) => {
      expect(features).toBeUndefined();
      return handle;
    });
    expect(reservation.handle).toBe(handle);
    expect(handle.opener).toBeNull();
    handle.closed = true;
    expect(navigateReserved(handle, 'https://wa.me/201001234567?text=x')).toBe(false);
  });
  it('reports a blocked popup as blocked rather than opened', () => {
    expect(reserveWindow(() => null)).toEqual({ outcome: 'BLOCKED', handle: null });
  });

  it('reports an unsupported environment instead of pretending to open', () => {
    expect(reserveWindow(undefined)).toEqual({ outcome: 'UNSUPPORTED', handle: null });
    expect(reserveWindow(null)).toEqual({ outcome: 'UNSUPPORTED', handle: null });
  });

  it('reserves a window synchronously and can release it again', () => {
    const opened: string[] = [];
    const closed: string[] = [];
    const handle: PopupHandle = { location: { href: '' }, close: () => closed.push('closed') };
    const reservation = reserveWindow(url => {
      opened.push(url);
      return handle;
    });
    expect(reservation.outcome).toBe('OPENED');
    // about:blank is the reservation target; no recipient URL is stored early.
    expect(opened).toEqual(['about:blank']);
    releaseWindow(reservation.handle);
    expect(closed).toHaveLength(1);
  });

  it('treats a throwing window.open as blocked', () => {
    expect(reserveWindow(() => { throw new Error('blocked'); })).toEqual({ outcome: 'BLOCKED', handle: null });
  });

  it('picks same-tab navigation on mobile and a popup on desktop', () => {
    const original = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari' },
        configurable: true,
      });
      expect(preferredChannel()).toBe('SAME_TAB');
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/124' },
        configurable: true,
      });
      expect(preferredChannel()).toBe('POPUP');
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true });
    }
  });
});

describe('bounded-part ledger', () => {
  it('tracks what remains without truncating anything', () => {
    const ledger = { total: 4, handedOff: [1, 3] };
    expect(remainingParts(ledger)).toEqual([2, 4]);
    expect(remainingCount(ledger)).toBe(2);
    expect(isComplete(ledger)).toBe(false);
    expect(isComplete({ total: 4, handedOff: [1, 2, 3, 4] })).toBe(true);
  });

  it('counts a repeated handoff only once', () => {
    expect(remainingCount({ total: 2, handedOff: [1, 1] })).toBe(1);
  });
});

describe('contact-change guard', () => {
  it('matches the same number across formatting differences', () => {
    expect(contactStillMatches('+201001234567', '+20 100 123 4567')).toBe(true);
  });

  it('refuses when the rechecked number differs or is unusable', () => {
    expect(contactStillMatches('+201001234567', '+201119999999')).toBe(false);
    expect(contactStillMatches('+201001234567', null)).toBe(false);
    expect(contactStillMatches(null, '+201001234567')).toBe(false);
  });
});
