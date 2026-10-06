import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { listPublishedCourses, getPublishedCourseBySlug } from '../catalog/courses/service';
import { listPackages, memberInclude, publicPackage } from '../catalog/packages';
import type { SeoSettings } from './config';

export interface SiteData {
  lang: 'ar' | 'en';
  path: string;
  page: 'home' | 'courses' | 'course-detail' | 'package' | 'support' | 'not-found';
  pageNumber: number;
  pageSize: number;
  origin?: string;
  indexing: boolean;
  courses?: Awaited<ReturnType<typeof listPublishedCourses>>;
  packages?: Awaited<ReturnType<typeof publicPackage>>[];
  course?: Awaited<ReturnType<typeof getPublishedCourseBySlug>>;
  pkg?: ReturnType<typeof publicPackage>;
  contact?: { email: string; phone: string; version: number } | null;
}
export type SiteRenderer = (data: SiteData) => Promise<string>;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
let template: Promise<string> | undefined;
export async function renderSite(data: SiteData): Promise<string> {
  const directory = resolve(process.cwd(), 'public-render');
  template ??= readFile(resolve(directory, 'index.html'), 'utf8');
  // Node 22 runtime loads the bundled, private React SSR module; it has no top-level await.
  const { renderPublicPage } = require(resolve(directory, 'entry-server.mjs')) as {
    renderPublicPage: (data: SiteData) => { head: string; body: string };
  };
  const rendered = renderPublicPage(data);
  let html = await template;
  html = html.replace(
    /<title>[\s\S]*?<\/title>|<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi,
    '',
  );
  html = html.replace(
    /<html[^>]*>/,
    '<html lang="' + data.lang + '" dir="' + (data.lang === 'ar' ? 'rtl' : 'ltr') + '">',
  );
  return html
    .replace('</head>', rendered.head + '</head>')
    .replace('<div id="root"></div>', '<div id="root">' + rendered.body + '</div>')
    .replace(
      '</body>',
      '<script id="public-page-data" type="application/json">' +
        safeJson(data) +
        '</script></body>',
    );
}

export function createSeoRouter(
  prisma: PrismaClient,
  settings: SeoSettings,
  render: SiteRenderer = renderSite,
): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Frame-Options', 'DENY');
    res.set(
      'Content-Security-Policy',
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    );
    next();
  });
  router.get('/robots.txt', (_req, res) => {
    res
      .type('text/plain')
      .send(
        settings.indexing
          ? 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /seo/\nSitemap: ' +
              settings.origin +
              '/sitemap.xml\n'
          : 'User-agent: *\nDisallow: /\n',
      );
  });
  router.get('/sitemap.xml', async (_req, res) => {
    try {
      if (!settings.indexing || !settings.origin) {
        res
          .status(503)
          .type('text/plain')
          .send('Sitemap is disabled until a public HTTPS origin and indexing are configured.');
        return;
      }
      const [courses, packages] = await Promise.all([
        prisma.course.findMany({
          where: { status: 'PUBLISHED', deletionRequestedAt: null },
          select: { slug: true },
        }),
        prisma.coursePackage.findMany({ where: { status: 'PUBLISHED' }, include: memberInclude }),
      ]);
      const routes = [
        '',
        '/courses',
        '/support',
        ...courses.map((c) => '/courses/' + encodeURIComponent(c.slug)),
        ...packages.filter((p) => publicPackage(p).available).map((p) => '/package/' + p.id),
      ];
      const pageCount = Math.max(
        1,
        Math.ceil(Math.max(courses.length, Math.min(packages.length, 100)) / 10),
      );
      for (let page = 2; page <= pageCount; page++) routes.push('/courses?page=' + page);
      const urls = ['ar', 'en'].flatMap((lang) =>
        routes.map((path) => settings.origin + '/' + lang + path),
      );
      if (urls.length > 50000) {
        res.status(503).type('text/plain').send('Sitemap index required for this catalog size.');
        return;
      }
      res
        .type('application/xml')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            [...new Set(urls)].map((url) => '<url><loc>' + escape(url) + '</loc></url>').join('') +
            '</urlset>',
        );
    } catch {
      res.status(503).type('text/plain').send('Public sitemap temporarily unavailable.');
    }
  });
  router.get('/', (_req, res) => {
    res.redirect(308, '/ar');
  });
  router.get('*', async (req, res) => {
    const pathname = req.path;
    const normalized = pathname
      .replace(/\/+$/, '')
      .replace(/^\/(AR|EN)(?=\/|$)/i, (match) => match.toLowerCase())
      .replace(/^\/(ar|en)\/package\/([0-9a-f-]{36})$/i, (match) => match.toLowerCase());
    if (normalized !== pathname && normalized) {
      res.redirect(
        308,
        normalized + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
      );
      return;
    }
    const match = /^\/(ar|en)(?:\/(courses|support|package)(?:\/([^/]+))?)?$/.exec(pathname);
    const lang = pathname.startsWith('/en') ? 'en' : 'ar';
    let status = 200;
    const pageRaw = String(req.query['page'] ?? '1');
    const sizeRaw = String(req.query['size'] ?? '10');
    const pageNumber = /^[1-9]\d{0,4}$/.test(pageRaw) ? Number(pageRaw) : 0;
    const pageSize = ['10', '20', '50'].includes(sizeRaw) ? Number(sizeRaw) : 0;
    const isCatalog = !!match && match[2] === 'courses' && !match[3];
    const query = isCatalog && pageNumber > 1 ? '?page=' + pageNumber : '';
    const data: SiteData = {
      lang,
      path: pathname + query,
      page: 'not-found',
      pageNumber,
      pageSize,
      origin: settings.origin,
      indexing:
        settings.indexing &&
        pageSize === 10 &&
        !Object.keys(req.query).some(
          (key) =>
            ![
              'page',
              'size',
              'utm_source',
              'utm_medium',
              'utm_campaign',
              'utm_content',
              'utm_term',
              'gclid',
              'fbclid',
            ].includes(key),
        ),
    };
    try {
      if (
        !match ||
        !pageNumber ||
        !pageSize ||
        (!isCatalog && (req.query['page'] || req.query['size']))
      ) {
        status = 404;
      } else if (!match[2] || isCatalog) {
        data.page = match[2] ? 'courses' : 'home';
        [data.courses, data.packages] = await Promise.all([
          listPublishedCourses(prisma),
          listPackages(prisma) as Promise<SiteData['packages']>,
        ]);
        if (!isCatalog) {
          data.courses = data.courses.slice(0, 3);
          data.packages = [];
        }
        if (
          isCatalog &&
          pageNumber >
            Math.max(
              1,
              Math.ceil(Math.max(data.courses.length, data.packages?.length ?? 0) / pageSize),
            )
        ) {
          data.page = 'not-found';
          status = 404;
        }
      } else if (match[2] === 'courses' && match[3]) {
        data.course = await getPublishedCourseBySlug(prisma, match[3]);
        const expected = '/' + lang + '/courses/' + encodeURIComponent(data.course.slug);
        if (pathname !== expected) {
          res.redirect(308, expected);
          return;
        }
        data.page = 'course-detail';
      } else if (
        match[2] === 'package' &&
        match[3] &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match[3])
      ) {
        const row = await prisma.coursePackage.findUnique({
          where: { id: match[3] },
          include: memberInclude,
        });
        if (!row || row.status !== 'PUBLISHED') status = 404;
        else {
          data.pkg = publicPackage(row);
          data.page = 'package';
        }
      } else if (match[2] === 'support' && !match[3]) {
        data.page = 'support';
        data.contact = await prisma.supportContact.findUnique({
          where: { id: 1 },
          select: { email: true, phone: true, version: true },
        });
      } else status = 404;
    } catch (error) {
      if ((error as { status?: number }).status === 404) status = 404;
      else {
        res.set('X-Robots-Tag', 'noindex');
        res
          .status(503)
          .type('text/plain')
          .send('Public page temporarily unavailable. Please retry.');
        return;
      }
    }
    if (status === 404) {
      data.page = 'not-found';
      data.indexing = false;
    }
    res.set(
      'X-Robots-Tag',
      data.indexing && data.page !== 'not-found' && (data.page !== 'package' || data.pkg?.available)
        ? 'index, follow'
        : 'noindex, follow',
    );
    res.set('Content-Language', lang);
    try {
      res
        .status(status)
        .type('html')
        .send(await render(data));
    } catch {
      res.set('X-Robots-Tag', 'noindex');
      res.status(503).type('text/plain').send('Public page renderer temporarily unavailable.');
    }
  });
  return router;
}
