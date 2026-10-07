/** Localized date/period rendering for ADMIN reports.
 *
 * The period itself always comes from the backend contract (ISO start
 * inclusive, end exclusive, Africa/Cairo). This module only formats those
 * server values for reading — it never computes a period, counts or scores.
 */
import type { Bilingual } from './copy';
import { t } from './copy';
import type { ReportPeriod } from './types';

const locale = (lang: 'ar' | 'en'): string => (lang === 'ar' ? 'ar-EG' : 'en-GB');

function valid(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

/** Short readable period label, e.g. "٧‏/١٠‏/٢٠٢٦ – ٧‏/١١‏/٢٠٢٦". */
export function formatPeriod(period: ReportPeriod, lang: 'ar' | 'en'): string {
  const start = valid(period.start) ? new Date(period.start) : null;
  const end = valid(period.end) ? new Date(period.end) : null;
  if (!start && !end) return period.start && period.end ? `${period.start} – ${period.end}` : '—';
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };
  const fmt = new Intl.DateTimeFormat(locale(lang), options);
  const left = start ? fmt.format(start) : '—';
  // End is exclusive for the aggregation; show the last included day instead of
  // implying the boundary day is inside the period.
  const lastIncluded = end ? new Date(end.getTime() - 1) : null;
  const right = lastIncluded ? fmt.format(lastIncluded) : end ? fmt.format(end) : '—';
  return `${left} – ${right}`;
}

export function formatDateTime(value: string | null, lang: 'ar' | 'en'): string {
  if (value === null || value === '') return t({ ar: 'غير متاح', en: 'Unavailable' }, lang);
  const date = new Date(value);
  if (!valid(value)) return value;
  return new Intl.DateTimeFormat(locale(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatCount(value: number | null, lang: 'ar' | 'en'): string {
  if (value === null || !Number.isFinite(value)) return t({ ar: 'غير معروف', en: 'Unknown' }, lang);
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB').format(value);
}

export function lessonTitle(title: Bilingual, lang: 'ar' | 'en'): string {
  const value = t(title, lang);
  return value.trim() === '' ? t({ ar: 'درس بلا عنوان', en: 'Untitled lesson' }, lang) : value;
}

export const coverageCopy = {
  KNOWN: { ar: 'التغطية معروفة', en: 'Coverage known' },
  PARTIAL: { ar: 'تغطية جزئية', en: 'Partial coverage' },
  UNAVAILABLE: { ar: 'التعقب غير متاح', en: 'Tracking unavailable' },
} as const;