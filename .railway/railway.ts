import { database, defineRailway, image, preserve, project, service, volume } from 'railway/iac';

// Central operations file owns this entire project graph. Never apply to an
// existing project until config pull/plan proves every retained resource included.
function pinned(name: string): string {
  const value = process.env[name] ?? '';
  if (!/^[-a-zA-Z0-9./_:]+@sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`${name} requires a registry image pinned by digest`);
  return value;
}
function secrets(names: string[]) { return Object.fromEntries(names.map(name => [name, preserve()])); }

export default defineRailway(ctx => {
  if (!ctx.environment || !['testing', 'production'].includes(ctx.environment) || !ctx.projectName) throw new Error('Select a named project and testing or production explicitly');
  // SDK convenience defaults currently choose PG18/Redis8.2. Never implicitly
  // upgrade the qualified PG16/Redis7 stack; select compatible managed images.
  const db = database('platform-postgres', 'postgres', { image: pinned('PLATFORM_POSTGRES_IMAGE'), output: 'DATABASE_URL', defaultMountPath: '/var/lib/postgresql/data' });
  const cache = database('platform-redis', 'redis', { image: pinned('PLATFORM_REDIS_IMAGE'), output: 'REDIS_URL', defaultMountPath: '/bitnami' });
  const drmDb = database('drm-postgres', 'postgres', { image: pinned('DRM_POSTGRES_IMAGE'), output: 'DATABASE_URL', defaultMountPath: '/var/lib/postgresql/data' });
  const drmCacheData = volume('drm-valkey-data');
  const drmCache = service('drm-valkey', {
    source: image(pinned('DRM_VALKEY_IMAGE')),
    start: 'sh -c \'exec valkey-server --appendonly yes --requirepass "$VALKEY_PASSWORD"\'',
    env: { VALKEY_PASSWORD: preserve() }, volumeMounts: { '/data': drmCacheData },
  });
  const platformEnv = {
    NODE_ENV: 'production', PORT: '3000', COOKIE_SECURE: 'true',
    ARGON2_MEMORY_KB: '65536', ARGON2_TIME_COST: '3', ARGON2_PARALLELISM: '4',
    DATABASE_URL: db.env.DATABASE_URL, REDIS_URL: cache.env.REDIS_URL,
    SEO_INDEXING_ENABLED: ctx.environment === 'production' ? 'true' : 'false',
    ...secrets(['AUTH_JWT_SECRET', 'AUTH_ISSUER', 'AUTH_AUDIENCE', 'ALLOWED_ORIGINS',
      'STUDENT_DATA_ENCRYPTION_KEY_B64', 'STUDENT_DATA_INDEX_KEY_B64',
      'DRM_BASE_URL', 'DRM_PUBLIC_BASE_URL', 'DRM_CLIENT_ID', 'DRM_CLIENT_SECRET',
      'DRM_ASSERTION_ISSUER', 'DRM_ASSERTION_AUDIENCE', 'DRM_ASSERTION_PRIVATE_KEY_B64', 'DRM_ASSERTION_KEY_ID',
      'STORAGE_ENDPOINT', 'STORAGE_REGION', 'STORAGE_BUCKET', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY',
      'PAYMENT_CHANNELS', 'SEO_PUBLIC_ORIGIN']),
  };
  const backend = service('platform-backend', {
    source: image(pinned('PLATFORM_RUNTIME_IMAGE')), start: 'node dist/index.js',
    healthcheck: '/health/ready', healthcheckTimeout: 120, replicas: 1, env: platformEnv,
  });
  const migrate = service('platform-migrate', {
    source: image(pinned('PLATFORM_MIGRATE_IMAGE')), start: 'npx prisma migrate deploy',
    deploy: { restartPolicyType: 'NEVER' }, env: { DATABASE_URL: db.env.DATABASE_URL },
  });
  const gateway = service('platform-gateway', {
    source: image(pinned('PLATFORM_GATEWAY_IMAGE')), healthcheck: '/api/health/ready',
    healthcheckTimeout: 120, env: { PORT: '8080', BACKEND_PORT: '3000', BACKEND_HOST: backend.env.RAILWAY_PRIVATE_DOMAIN },
  });
  const drmEnv = {
    NODE_ENV: 'production', PORT: '3000', DATABASE_URL: drmDb.env.DATABASE_URL, REDIS_URL: ctx.shared.DRM_REDIS_URL,
    HTTPS_REQUIRED: 'true', PLAYBACK_ASSERTION_REQUIRED: 'true', CLEAR_KEY_ENABLED: 'false', PREMIUM_DRM_REQUIRED: 'true',
    PLAYBACK_TOKEN_TTL: '300', PLAYBACK_SESSION_TTL: '3600', TRUST_PROXY: '1',
    S3_REGION: 'auto', S3_FORCE_PATH_STYLE: 'false',
    ...secrets(['CORS_ORIGIN', 'DRM_MASTER_KEY', 'PLAYBACK_TOKEN_SECRET', 'WATERMARK_SECRET', 'ADMIN_API_TOKEN',
      'JWT_ISSUER', 'JWT_AUDIENCE', 'JWT_JWKS_URL', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
      'WIDEVINE_LICENSE_SERVER_URL', 'WIDEVINE_PROVIDER', 'WIDEVINE_SIGNING_KEY', 'WIDEVINE_SIGNING_IV', 'WIDEVINE_CONTENT_KEY_SEED']),
  };
  const drmApi = service('drm-api', {
    source: image(pinned('DRM_API_IMAGE')), start: 'node apps/api/dist/index.js', healthcheck: '/health',
    healthcheckTimeout: 120, env: drmEnv,
  });
  const drmWorker = service('drm-worker', {
    source: image(pinned('DRM_WORKER_IMAGE')), start: 'node apps/worker/dist/index.js',
    env: { ...drmEnv, FFMPEG_PATH: 'ffmpeg', FFPROBE_PATH: 'ffprobe', SHAKA_PACKAGER_PATH: 'packager' },
  });
  const drmMigrate = service('drm-migrate', {
    source: image(pinned('DRM_API_IMAGE')), start: 'node packages/database/dist/generate.js',
    deploy: { restartPolicyType: 'NEVER' }, env: { DATABASE_URL: drmDb.env.DATABASE_URL },
  });
  // Domain names, budgets, scaling and IDE execution host are owner release gates.
  return project(ctx.projectName, { resources: [db, cache, drmDb, drmCacheData, drmCache, backend, migrate, gateway, drmApi, drmWorker, drmMigrate] });
});
