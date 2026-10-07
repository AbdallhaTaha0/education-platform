/**
 * M10 agent 3 — TEST-ONLY synthetic ADMIN API + static server.
 *
 * THIS FILE IS NOT PLATFORM CODE. It exists only inside the disposable
 * `edu-platform-m10a3` Docker project so the real ADMIN course workspace can be
 * exercised in a real browser while the peer backend routes are still being
 * implemented. It must never be deployed, bundled, or used as a production
 * substitute: the React feature calls the real routes and has no fixture
 * fallback.
 *
 * Every record is synthetic. Guardian numbers are syntactically valid
 * Egyptian test values; no real student data, and click-to-chat navigation is
 * intercepted before leaving the browser during verification.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 8080);
const DIST = process.env.DIST ?? '/srv/web/dist';
const CSRF = 'm10-agent-3-csrf-token';
const ADMIN = {
  id: 'admin-m10a3',
  email: 'admin.synthetic@m10a3.invalid',
  phone: '+201000000000',
  displayName: 'Synthetic administrator',
  role: 'ADMIN',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const COURSE = {
  id: 'course-m10a3',
  slug: 'synthetic-m10a3-course',
  titleAr: 'كورس تجريبي لتقرير ولي الأمر',
  titleEn: 'Synthetic M10 parent-report course',
  descriptionAr: 'كورس تجريبي.',
  descriptionEn: 'Synthetic course.',
  status: 'PUBLISHED',
  deletionRequestedAt: null,
  priorStatus: null,
  revisionOwnerId: null,
  workingCopyId: null,
  plans: [{ id: 'plan-1', currentPricePiastres: 150000, previousPricePiastres: null, durationDays: 30 }],
  sections: [
    {
      id: 'section-1',
      titleAr: 'القسم الأول',
      titleEn: 'Section one',
      position: 0,
      lessons: [
        { id: 'lesson-1', titleAr: 'الدرس الأول', titleEn: 'Lesson one', position: 0, media: { id: 'media-1', status: 'READY', externalAssetId: 'ext-1', assetId: 'asset-1' } },
        { id: 'lesson-2', titleAr: 'الدرس الثاني', titleEn: 'Lesson two', position: 1, media: { id: 'media-2', status: 'READY', externalAssetId: 'ext-2', assetId: 'asset-2' } },
        { id: 'lesson-3', titleAr: 'الدرس الثالث', titleEn: 'Lesson three', position: 2, media: null },
      ],
    },
  ],
};

const OTHER_COURSE = { courseId: 'course-m10a3-b', title: { ar: 'كورس تجريبي ثانٍ', en: 'Second synthetic course' } };

/** Synthetic roster. Deliberately includes zero activity and a missing contact. */
const STUDENTS = [
  { studentId: 'student-active', name: 'سلمى تجريبية', guardianContactAvailable: true, lastViewedAt: '2026-10-06T20:15:00.000Z', totalViews: 3 },
  { studentId: 'student-quiet', name: 'Quiet synthetic student', guardianContactAvailable: false, lastViewedAt: null, totalViews: 0 },
  { studentId: 'student-contact-change', name: 'Contact change synthetic', guardianContactAvailable: true, lastViewedAt: '2026-10-05T18:00:00.000Z', totalViews: 1 },
  { studentId: 'student-long', name: 'Long report synthetic', guardianContactAvailable: true, lastViewedAt: '2026-10-04T12:00:00.000Z', totalViews: 9 },
];
for (let index = STUDENTS.length; index < 25; index += 1) {
  STUDENTS.push({
    studentId: `student-${String(index).padStart(2, '0')}`,
    name: `طالب تجريبي ${index}`,
    guardianContactAvailable: index % 5 !== 0,
    lastViewedAt: index % 3 === 0 ? '2026-10-02T10:00:00.000Z' : null,
    totalViews: index % 3 === 0 ? index : 0,
  });
}

/** Guardian numbers used only by this disposable fixture. */
const PHONES = {
  'student-active': '+201001234567',
  'student-contact-change': '+201001234567',
  'student-long': '+201001234568',
};

const LESSON_VIEWS = {
  'student-active': [
    { lessonId: 'lesson-1', title: { ar: 'الدرس الأول', en: 'Lesson one' }, mediaAssetId: 'asset-1', totalViews: 2, lastViewedAt: '2026-10-06T20:15:00.000Z', coverage: 'KNOWN' },
    { lessonId: 'lesson-2', title: { ar: 'الدرس الثاني', en: 'Lesson two' }, mediaAssetId: 'asset-2', totalViews: 1, lastViewedAt: '2026-10-05T19:00:00.000Z', coverage: 'PARTIAL' },
    { lessonId: 'lesson-3', title: { ar: 'الدرس الثالث', en: 'Lesson three' }, mediaAssetId: null, totalViews: null, lastViewedAt: null, coverage: 'UNAVAILABLE' },
  ],
};
const DEFAULT_LESSON_VIEWS = [
  { lessonId: 'lesson-1', title: { ar: 'الدرس الأول', en: 'Lesson one' }, mediaAssetId: 'asset-1', totalViews: 0, lastViewedAt: null, coverage: 'KNOWN' },
  { lessonId: 'lesson-2', title: { ar: 'الدرس الثاني', en: 'Lesson two' }, mediaAssetId: 'asset-2', totalViews: 0, lastViewedAt: null, coverage: 'KNOWN' },
  { lessonId: 'lesson-3', title: { ar: 'الدرس الثالث', en: 'Lesson three' }, mediaAssetId: null, totalViews: null, lastViewedAt: null, coverage: 'UNAVAILABLE' },
];

const TRACKING_STARTED_AT = '2026-10-01T00:00:00.000Z';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' };

function send(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

function ok(res, data, headers) {
  send(res, 200, { data }, headers);
}

function fail(res, status, code, message) {
  send(res, status, { error: { code, message } });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function cairoPeriod(days, now) {
  const end = now;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString(), timeZone: 'Africa/Cairo' };
}

const WEEKS = { WEEK: 1, TWO_WEEKS: 2, FOUR_WEEKS: 4 };

function arabicBody(student, reportType, period, courses, long, weekIndex = 1) {
  const days = reportType === 'WEEK' ? 7 : reportType === 'TWO_WEEKS' ? 14 : 28;
  const lines = [
    '‏FAYQ — تقرير ولي الأمر',
    `الطالب: ${student.name}`,
    `الفترة: من ${period.start.slice(0, 10)} إلى ${period.end.slice(0, 10)} (توقيت القاهرة)`,
    'عدد المشاهدات لا يظهر في هذا التقرير؛ الحالة فقط.',
  ];
  for (const course of courses) {
    lines.push('', `الكورس: ${course.title.ar}`, `المدة: ${days} يومًا`);
    for (let week = 1; week <= WEEKS[reportType]; week += 1) {
      lines.push(`الأسبوع ${week}:`, ' - الدرس الأول: شاهد', ' - الدرس الثاني: لم يشاهد', ' - الاختبار: ناجح', ' - الواجب: لم يُسلَّم');
    }
  }
  if (long) {
    lines.push('', `تفصيل الدروس — الجزء ${weekIndex}:`);
    for (let index = 0; index < 400; index += 1) {
      lines.push(`سطر طويل تجريبي رقم ${index}: بيانات تقرير اصطناعية طويلة لاختبار الحد الأقصى للرابط دون اقتطاع.`);
    }
  }
  lines.push('', 'مع تحيات فريق FAYQ');
  return lines.join('\n');
}

function englishBody(student, reportType, period, courses, long, weekIndex = 1) {
  const days = reportType === 'WEEK' ? 7 : reportType === 'TWO_WEEKS' ? 14 : 28;
  const lines = [
    'FAYQ — Parent report',
    `Student: ${student.name}`,
    `Period: ${period.start.slice(0, 10)} to ${period.end.slice(0, 10)} (Africa/Cairo)`,
  ];
  for (const course of courses) {
    lines.push('', `Course: ${course.title.en}`, `Window: ${days} days`);
    for (let week = 1; week <= WEEKS[reportType]; week += 1) {
      lines.push(`Week ${week}:`, ' - Lesson one: viewed', ' - Lesson two: not viewed', ' - Quiz: passed', ' - Assignment: not submitted');
    }
  }
  if (long) {
    lines.push('', `Lesson detail — part ${weekIndex}:`);
    for (let index = 0; index < 400; index += 1) {
      lines.push(`Synthetic long line ${index}: fabricated report text used to exercise the click-to-chat URL budget without truncation.`);
    }
  }
  lines.push('', 'FAYQ team');
  return lines.join('\n');
}

/** Bounded parts: one per weekly section, matching the composition contract. */
function buildParts(student, reportType, period, courses, language) {
  const total = WEEKS[reportType];
  // One synthetic student deliberately exceeds the click-to-chat URL budget so
  // the copy fallback is exercised; nothing is truncated.
  const long = student.studentId === 'student-long';
  return Array.from({ length: total }, (_, offset) => {
    const index = offset + 1;
    const text = long && index > 1
      ? (language === 'ar' ? `FAYQ — تقرير ولي الأمر\nالطالب: ${student.name}\nالكورس: كورس تجريبي\nالأسبوع ${index}: الدرس: شاهد\nالواجب: لم يُسلَّم` : `FAYQ — Parent report\nStudent: ${student.name}\nCourse: synthetic\nWeek ${index}: Lesson viewed\nAssignment: not submitted`)
      : language === 'ar'
      ? arabicBody(student, reportType, period, courses, long && index === 1, index)
      : englishBody(student, reportType, period, courses, long && index === 1, index);
    return { index, total, text };
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function requireAdmin(req, res) {
  const cookie = req.headers.cookie ?? '';
  if (!cookie.includes('edu_access=')) {
    fail(res, 401, 'TOKEN_MISSING', 'Session missing.');
    return false;
  }
  return true;
}

async function handleApi(req, res, url) {
  const path = url.pathname.replace(/^\/api/, '');
  const method = req.method ?? 'GET';

  if (path === '/auth/csrf') {
    res.setHeader('Set-Cookie', `edu_csrf=${CSRF}; Path=/; SameSite=Lax`);
    return ok(res, {});
  }
  if (path === '/auth/login' && method === 'POST') {
    await readBody(req);
    res.setHeader('Set-Cookie', [
      'edu_access=synthetic-access; Path=/; HttpOnly; SameSite=Lax',
      'edu_refresh=synthetic-refresh; Path=/; HttpOnly; SameSite=Lax',
      `edu_csrf=${CSRF}; Path=/; SameSite=Lax`,
    ]);
    return ok(res, { user: ADMIN });
  }
  if (path === '/auth/me') {
    if (!requireAdmin(req, res)) return undefined;
    return ok(res, { user: ADMIN });
  }
  if (path === '/auth/logout' && method === 'POST') {
    return ok(res, {});
  }

  // Minimal synthetic stand-ins for unrelated shell calls so the ADMIN page
  // renders without unrelated console noise. Not part of the M10 contract.
  if (path === '/notifications/unread-count' && method === 'GET') {
    return ok(res, { unread: 0 });
  }
  if (path === '/admin/catalog/summary' && method === 'GET') {
    return ok(res, {
      asOf: '2026-10-07T08:00:00.000Z',
      students: STUDENTS.length,
      publishedCourses: 1,
      draftCourses: 0,
      publishedPackages: 0,
      pendingRecharges: 0,
      coursePurchases: STUDENTS.length,
      packagePurchases: 0,
      walletBalancePiastres: 0,
      activeCourseAccess: STUDENTS.length,
    });
  }

  if (path === '/admin/catalog/courses' && method === 'GET') {
    if (!requireAdmin(req, res)) return undefined;
    return ok(res, { courses: [{ ...COURSE, sections: undefined, plans: undefined, priorStatus: undefined }] });
  }
  const courseMatch = /^\/admin\/catalog\/courses\/([^/]+)$/.exec(path);
  if (courseMatch && method === 'GET') {
    if (!requireAdmin(req, res)) return undefined;
    return ok(res, { course: COURSE });
  }

  // ---- M10 agent-2 contract (read-only synthetic implementation) ----------
  const rosterMatch = /^\/admin\/courses\/([^/]+)\/students$/.exec(path);
  if (rosterMatch && method === 'GET') {
    if (!requireAdmin(req, res)) return undefined;
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20)));
    const cursor = url.searchParams.get('cursor');
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const filtered = q ? STUDENTS.filter(row => row.name.toLowerCase().includes(q) || row.studentId.includes(q)) : STUDENTS;
    const start = cursor ? Number(cursor) : 0;
    const page = filtered.slice(start, start + limit);
    const next = start + limit;
    return ok(
      res,
      { students: page, nextCursor: next < filtered.length ? String(next) : null },
      NO_STORE,
    );
  }

  const viewsMatch = /^\/admin\/courses\/([^/]+)\/students\/([^/]+)\/views$/.exec(path);
  if (viewsMatch && method === 'GET') {
    if (!requireAdmin(req, res)) return undefined;
    const studentId = decodeURIComponent(viewsMatch[2]);
    return ok(
      res,
      {
        studentId,
        courseId: decodeURIComponent(viewsMatch[1]),
        trackingStartedAt: TRACKING_STARTED_AT,
        lessons: LESSON_VIEWS[studentId] ?? DEFAULT_LESSON_VIEWS,
        nextCursor: null,
      },
      NO_STORE,
    );
  }

  const coursesMatch = /^\/admin\/students\/([^/]+)\/report-courses$/.exec(path);
  if (coursesMatch && method === 'GET') {
    if (!requireAdmin(req, res)) return undefined;
    return ok(
      res,
      { courses: [{ courseId: COURSE.id, title: { ar: COURSE.titleAr, en: COURSE.titleEn } }, OTHER_COURSE], nextCursor: null },
      NO_STORE,
    );
  }

  const contactMatch = /^\/admin\/students\/([^/]+)\/report-contact$/.exec(path);
  if (contactMatch && method === 'GET') {
    if (!requireAdmin(req, res)) return undefined;
    const studentId = decodeURIComponent(contactMatch[1]);
    // This student's number changes between preparation and handoff.
    if (studentId === 'student-contact-change') return ok(res, { phone: '+201119999999' }, NO_STORE);
    return ok(res, { phone: PHONES[studentId] ?? null }, NO_STORE);
  }

  if (path === '/admin/parent-reports/generate' && method === 'POST') {
    if (!requireAdmin(req, res)) return undefined;
    const body = await readBody(req);
    const student = STUDENTS.find(row => row.studentId === body.studentId);
    if (!student) return fail(res, 404, 'STUDENT_NOT_FOUND', 'Student not found.');
    if (!Array.isArray(body.courseIds) || body.courseIds.length === 0) {
      return fail(res, 400, 'REPORT_COURSE_REQUIRED', 'Select at least one course.');
    }
    if (body.courseIds.length > 50) {
      return fail(res, 400, 'REPORT_COURSE_LIMIT', 'Too many courses.');
    }
    if (!WEEKS[body.reportType]) return fail(res, 400, 'REPORT_TYPE_INVALID', 'Unknown report type.');
    if (body.language !== 'ar' && body.language !== 'en') {
      return fail(res, 400, 'REPORT_LANGUAGE_INVALID', 'Unknown report language.');
    }
    // A deliberate delay drives the stale-response verification.
    if (student.studentId === 'student-quiet') await sleep(1500);
    const now = new Date();
    const period = cairoPeriod(body.reportType === 'WEEK' ? 7 : body.reportType === 'TWO_WEEKS' ? 14 : 28, now);
    const courses = body.courseIds.map(id =>
      id === OTHER_COURSE.courseId ? OTHER_COURSE : { courseId: COURSE.id, title: { ar: COURSE.titleAr, en: COURSE.titleEn } },
    );
    // Labeled UI fixture only: match the new single-part contract. Actual
    // production aggregation/Unicode formatting is verified independently.
    const parts = body.format === 'SHORT'
      ? [{ index: 1, total: 1, text: ['FAYQ', student.name, body.reportType, ...courses.map(course => course.title[body.language])].join('\n') }]
      : buildParts(student, body.reportType, period, courses, body.language);
    return ok(
      res,
      {
        studentId: student.studentId,
        courseIds: body.courseIds,
        reportType: body.reportType,
        generatedAt: now.toISOString(),
        period,
        guardian: { phone: PHONES[student.studentId] ?? null },
        parts,
      },
      NO_STORE,
    );
  }

  return fail(res, 404, 'NOT_FOUND', `No synthetic route for ${method} ${path}.`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.mjs.map': 'application/json; charset=utf-8',
};

async function serveStatic(res, pathname) {
  const relative = normalize(pathname).replace(/^([/\\])+/, '');
  let file = join(DIST, relative);
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(DIST, 'index.html');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Content-Length': body.byteLength,
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch(() => {
      if (!res.headersSent) fail(res, 500, 'SERVICE_ERROR', 'Synthetic fixture failure.');
    });
    return;
  }
  void serveStatic(res, url.pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`synthetic m10 agent 3 fixture listening on ${PORT}\n`);
});
