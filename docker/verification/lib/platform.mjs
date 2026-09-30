/**
 * Public HTTP client for the platform API (TEST-ONLY).
 *
 * Uses exactly the browser contract: cookie session, CSRF token, and approved
 * Origin. Credentials for a throwaway admin arrive in the environment and are
 * never printed. Cookies stay in memory and are never emitted.
 */

export class PlatformClient {
  constructor(config) {
    this.config = config;
    this.cookies = new Map();
  }

  static fromEnv(env) {
    const missing = ['PLATFORM_BASE_URL', 'PLATFORM_ORIGIN'].filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(`missing platform configuration: ${missing.join(', ')}`);
    }
    return new PlatformClient({
      baseUrl: env.PLATFORM_BASE_URL.replace(/\/+$/, ''),
      origin: env.PLATFORM_ORIGIN,
    });
  }

  get cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  get csrf() {
    const raw = this.cookies.get('edu_csrf');
    if (!raw) return '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  absorb(response) {
    const list =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [];
    for (const entry of list) {
      const pair = entry.split(';')[0];
      const index = pair.indexOf('=');
      if (index > 0) {
        this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    }
  }

  async call(method, path, { body, withAuth = true, withCsrf = true } = {}) {
    const started = Date.now();
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(withAuth ? { Cookie: this.cookieHeader, Origin: this.config.origin } : {}),
        ...(withAuth && withCsrf && this.csrf ? { 'X-Csrf-Token': this.csrf } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.absorb(response);
    const text = await response.text();
    let json;
    try {
      json = text.length > 0 ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    return { status: response.status, json, elapsedMs: Date.now() - started };
  }

  async bootstrapCsrf() {
    return this.call('GET', '/api/auth/csrf', { withAuth: false, withCsrf: false });
  }

  async login(identifier, password) {
    await this.bootstrapCsrf();
    return this.call('POST', '/api/auth/login', { body: { identifier, password } });
  }

  async createCourse(payload) {
    return this.call('POST', '/api/admin/catalog/courses', { body: payload });
  }

  async createSection(courseId, payload) {
    return this.call('POST', `/api/admin/catalog/courses/${courseId}/sections`, { body: payload });
  }

  async createLesson(sectionId, payload) {
    return this.call('POST', `/api/admin/catalog/sections/${sectionId}/lessons`, { body: payload });
  }

  async registerLessonMedia(lessonId, payload) {
    return this.call('POST', `/api/admin/catalog/lessons/${lessonId}/media`, { body: payload });
  }

  async completeLessonMedia(lessonId) {
    return this.call('POST', `/api/admin/catalog/lessons/${lessonId}/media/complete`, { body: {} });
  }

  async syncLessonMedia(lessonId) {
    return this.call('POST', `/api/admin/catalog/lessons/${lessonId}/media/sync`, { body: {} });
  }

  async syncCourseMedia(courseId) {
    return this.call('POST', `/api/admin/catalog/courses/${courseId}/media/sync`, { body: {} });
  }

  async readCourse(courseId) {
    return this.call('GET', `/api/admin/catalog/courses/${courseId}`, { withCsrf: false });
  }

  async deleteCourse(courseId, confirmation) {
    return this.call('POST', `/api/admin/catalog/courses/${courseId}/delete`, {
      body: { confirmation },
    });
  }

  async readDeletion(operationId) {
    return this.call('GET', `/api/admin/catalog/deletions/${operationId}`, { withCsrf: false });
  }
}
