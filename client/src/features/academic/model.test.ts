import { describe, expect, it } from 'vitest';
import { cairoDeadlineInput, cairoWallTime, moneyInput } from './model';
describe('academic checkout inputs', () => {
  it('converts Cairo wall time with the seasonal offset regardless of browser timezone', () => {
    expect(cairoDeadlineInput('2027-01-15T18:00')).toBe('2027-01-15T18:00:00+02:00');
    expect(cairoDeadlineInput('2027-07-15T18:00')).toBe('2027-07-15T18:00:00+03:00');
    expect(cairoWallTime('2027-07-15T15:00:00Z')).toBe('2027-07-15T18:00:00');
  });
  it.each(['2027-02-30T12:00', '2027-04-30T00:30', '2027-01-15', '2027-01-15T99:00'])(
    'rejects invalid dates or nonexistent Cairo times: %s',
    (value) => expect(() => cairoDeadlineInput(value)).toThrow(),
  );
  it('converts prices exactly without rounding or accepting exponent syntax', () => {
    expect(moneyInput('900.01')).toBe(90001);
    expect(moneyInput('0.01')).toBe(1);
    for (const value of ['0', '-1', '1.001', '1e3', 'NaN', '20000000.01'])
      expect(() => moneyInput(value)).toThrow();
  });
});
