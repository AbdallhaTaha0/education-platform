import { requireAdmin, requireAuth, requireOrigin, requireSessionCsrf, rateLimit } from '../../identity/middleware.js';
import { ADMIN_CREATE_LIMIT } from '../../identity/rateLimit.js';

export const writeGuard = [requireOrigin, requireAuth, requireAdmin, requireSessionCsrf];
export const readGuard = [requireAuth, requireAdmin];

export function limit() {
  return rateLimit('catalog-create', ADMIN_CREATE_LIMIT);
}
