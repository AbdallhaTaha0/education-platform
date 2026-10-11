import { database, defineRailway, image, preserve, project, service } from 'railway/iac';

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
  const platformEnv = {
    NODE_ENV: 'production', PORT: '3000', COOKIE_SECURE: 'true', CODING_IDE_ENABLED: 'false',
    ARGON2_MEMORY_KB: '65536', ARGON2_TIME_COST: '3', ARGON2_PARALLELISM: '4',
    DATABASE_URL: db.env.DATABASE_URL, REDIS_URL: cache.env.REDIS_URL,
    // Provider-generated staging URLs are not the approved canonical origin.
    // Enable indexing only after the owner selects a public domain and verifies it.
    SEO_INDEXING_ENABLED: 'false',
    ...secrets(['AUTH_JWT_SECRET', 'AUTH_ISSUER', 'AUTH_AUDIENCE', 'ALLOWED_ORIGINS',
      'STUDENT_DATA_ENCRYPTION_KEY_B64', 'STUDENT_DATA_INDEX_KEY_B64',
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
  // The no-DRM branch owns no DRM service, database, cache, migration or secret.
  // Domain names, budgets and scaling remain owner release gates. Coding IDE
  // is disabled for this release; a qualified execution host is required before reactivation.
  return project(ctx.projectName, { resources: [db, cache, backend, migrate, gateway] });
});
