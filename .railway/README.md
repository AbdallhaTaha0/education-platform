# Railway preparation for the no-DRM branch

This graph contains only the platform PostgreSQL, Redis, Express backend,
one-shot platform migration job, and Nginx gateway. It does not create or
configure any DRM API, DRM worker, DRM database/cache, DRM migration, DRM image,
or DRM secret. Video objects are stored in the platform's private Cloudflare R2
bucket using the platform S3-compatible storage settings.

## Temporary staging domains

A custom domain is not required to test staging. Generate a Railway HTTPS domain
for the gateway and use the Vercel project's stable `*.vercel.app` URL for the
frontend. Keep Vercel's `/api` rewrite pointed at the Railway gateway so the
browser continues to use same-origin cookie and CSRF requests. Set
`ALLOWED_ORIGINS` to the exact Vercel HTTPS origin, `COOKIE_SECURE=true`,
`SEO_PUBLIC_ORIGIN` to that staging origin, and keep `SEO_INDEXING_ENABLED=false`.
Add the same exact Vercel origin to the R2 CORS policy for browser uploads and
video playback. When a custom domain is chosen, update these origin settings and
verify cookies and CORS again.

## Required immutable images

Set only these image references for the platform graph:

- `PLATFORM_RUNTIME_IMAGE`
- `PLATFORM_MIGRATE_IMAGE`
- `PLATFORM_GATEWAY_IMAGE`
- `PLATFORM_POSTGRES_IMAGE`
- `PLATFORM_REDIS_IMAGE`

Every image must be pinned by registry digest. Configure application secrets and
R2 credentials directly in the selected Railway environment; `preserve()` does
not create missing values. Use the separate `testing` and `production`
environments. Run the platform migration job and confirm exit code zero before
starting or updating serving services. Keep databases and the backend private;
only the gateway needs a public domain.

The graph keeps indexing disabled in both environments. Change that only after
choosing an approved canonical domain and completing the live SEO checks.

This is deployment preparation, not permission to apply it or a production
readiness certificate. Before applying to an existing Railway project, compare
the complete plan and check that it will not remove resources or volumes you
intend to keep.
