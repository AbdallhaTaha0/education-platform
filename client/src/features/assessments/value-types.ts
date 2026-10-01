export type ValueType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
export function valueType(value: unknown): ValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
}
export function initialValue(type: ValueType): unknown {
  return { string: '', number: 0, boolean: false, null: null, object: {}, array: [] }[type];
}
export function parseNumber(raw: string): number {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid number');
  return value;
}
export function renameProperty(value: Record<string, unknown>, old: string, name: string): Record<string, unknown> {
  if (!name || (old !== name && Object.prototype.hasOwnProperty.call(value, name))) throw new Error('Invalid property name');
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key === old ? name : key, item]));
}
