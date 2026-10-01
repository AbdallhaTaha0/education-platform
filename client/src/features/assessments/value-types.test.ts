import { describe, expect, it } from 'vitest';
import { initialValue, parseNumber, renameProperty, valueType } from './value-types';

describe('typed assessment authoring', () => {
  it('keeps text, number, boolean, null, objects and arrays distinct', () => {
    expect(['2', 2, true, null, { score: 2 }, [2]].map(valueType)).toEqual(['string', 'number', 'boolean', 'null', 'object', 'array']);
    for (const type of ['string', 'number', 'boolean', 'null', 'object', 'array'] as const) expect(valueType(initialValue(type))).toBe(type);
  });
  it('accepts finite decimal/scientific values without interpreting strings or JS', () => {
    expect(parseNumber('3.5')).toBe(3.5); expect(parseNumber('-2e3')).toBe(-2000);
    for (const invalid of ['', '"2"', 'null', 'true', 'NaN', 'Infinity', '1e999', '2+3']) expect(() => parseNumber(invalid)).toThrow();
  });
  it('preserves property values, order and potentially special names without prototype mutation', () => {
    const object = { first: [1, { ok: true }], second: null };
    expect(renameProperty(object, 'first', 'nested')).toEqual({ nested: object.first, second: null });
    expect(() => renameProperty(object, 'first', 'second')).toThrow();
    expect(() => renameProperty(object, 'first', '')).toThrow();
    const renamed = renameProperty(object, 'first', '__proto__');
    expect(Object.getPrototypeOf(renamed)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(renamed, '__proto__')).toBe(true);
    expect(object).toEqual({ first: [1, { ok: true }], second: null });
  });
});
