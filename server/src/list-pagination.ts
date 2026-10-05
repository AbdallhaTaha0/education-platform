import { ApiError } from './modules/identity/errors.js';
export interface ListPage { page: number; pageSize: number; search?: string; date?: string }
export function parseListPage(query: Record<string, unknown>): ListPage | undefined {
  if (query.page === undefined && query.pageSize === undefined) return undefined;
  const integer = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid pagination.');
    return Number(value);
  };
  const page = integer(query.page, 1, 10000), pageSize = integer(query.pageSize, 10, 50);
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 100)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid search.');
  if (query.date !== undefined && (typeof query.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(query.date) || !Number.isFinite(Date.parse(query.date)) || new Date(query.date).toISOString().slice(0,10) !== query.date)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid transfer date.');
  return { page, pageSize, ...(query.search ? { search: String(query.search).trim() } : {}), ...(query.date ? { date: String(query.date) } : {}) };
}
export function pageInfo(input: ListPage, total: number) {
  return { page: Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize))), pageSize: input.pageSize, total };
}
