export type AccessMode = 'DURATION' | 'TERM_END' | 'YEAR_END' | 'UNTIL_REMOVAL';
export interface Academic {
  grade: string | null; academicYear: string | null; term: number | null;
  courseKind: string | null; teachingMonth: string | null;
}
export const emptyAcademic: Academic = { grade: null, academicYear: null, term: null, courseKind: null, teachingMonth: null };
export function cairoWallTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid deadline');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
export function cairoDeadlineInput(wall: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(wall)) throw new Error('Invalid deadline');
  const input = wall.length === 16 ? `${wall}:00` : wall;
  const matches = ['+02:00', '+03:00'].map(offset => input + offset).filter(value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && cairoWallTime(value) === input;
  });
  if (matches.length !== 1) throw new Error('Invalid or ambiguous Cairo time');
  return matches[0];
}
export function moneyInput(value: string): number {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) throw new Error('Invalid price');
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount < 1 || amount > 2000000000) throw new Error('Invalid price');
  return amount;
}
export function displayDeadline(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
export function gradeLabel(grade: string | null | undefined, lang: string): string {
  if (grade === 'FIRST_SECONDARY') return lang === 'ar' ? 'أولى ثانوي' : 'First secondary';
  if (grade === 'SECOND_SECONDARY') return lang === 'ar' ? 'ثانية ثانوي' : 'Second secondary';
  return lang === 'ar' ? 'دورات أخرى' : 'Other courses';
}
