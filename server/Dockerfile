# Platform backend image: one modular Express application.
# Replicas behind Nginx all run this same image (target: runtime).
# Build context is the repository root; the root .dockerignore guarantees
# education-drm-service/ is never copied into platform images.
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /srv/server
ENV NODE_ENV=production
# Prisma engines require OpenSSL; bookworm-slim does not ship it.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system app && useradd --system --gid app --home-dir /srv/server app

# Production-only dependencies. `--omit=optional` additionally excludes the unused
# Prisma CLI chain (prisma, @prisma/config, deepmerge-ts: devOptional via the
# @prisma/client optional peer) and workers-only pg-cloudflare, which the Node.js
# serving runtime never loads. Lifecycle scripts stay enabled so kept native
# packages (argon2) still build. Build/test/migration stages keep full installs.
FROM base AS prod-deps
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# Full build (devDependencies + Prisma client generation + tsc + tests available).
# NOTE: explicit --include=dev because the base stage sets NODE_ENV=production
# (which would otherwise make `npm ci` skip devDependencies).
FROM base AS build
COPY server/package.json server/package-lock.json ./
RUN npm ci --include=dev
COPY server/prisma ./prisma
COPY server/tsconfig.json server/tsconfig.tests.json server/vitest.config.ts ./
COPY server/src ./src
COPY server/tests ./tests
RUN npx prisma generate && npm run build

# Reuse public React components for HTML inside this same Express application.
FROM ${NODE_IMAGE} AS seo-client
WORKDIR /srv/client
COPY client/package.json client/package-lock.json ./
COPY client/scripts ./scripts
RUN npm ci
COPY client/index.html client/vite.config.ts client/tsconfig.json client/postcss.config.js client/tailwind.config.js ./
COPY client/public ./public
COPY client/src ./src
RUN npm run build

# Minimal runtime: production-only dependencies + built output + generated
# Prisma Client, non-root. Assembled by copy (not prune) so devDependencies
# and sources can never leak into the runtime layer history.
FROM base AS runtime
COPY --chown=app:app server/package.json server/package-lock.json ./
COPY --chown=app:app --from=prod-deps /srv/server/node_modules ./node_modules
COPY --chown=app:app --from=build /srv/server/dist ./dist
COPY --chown=app:app --from=seo-client /srv/client/dist/index.html ./public-render/index.html
COPY --chown=app:app --from=seo-client /srv/client/dist-ssr ./public-render
# Generated Prisma Client (identical lockfile/platform in both stages).
# Both locations are required: @prisma/client re-exports the generated client
# that `prisma generate` writes under node_modules/.prisma/client.
COPY --chown=app:app --from=build /srv/server/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --chown=app:app --from=build /srv/server/node_modules/.prisma ./node_modules/.prisma
# Smoke: the unused CLI chain must be absent from FINAL runtime while the generated
# Prisma Client stays usable and argon2's native binding loads. PrismaClient must be
# CONSTRUCTIBLE (require-only is insufficient). Never connects: dummy URL + disconnect.
RUN DATABASE_URL=postgresql://127.0.0.1:5432/prisma_smoke \
  node -e 'const assert=require("assert");const fs=require("fs");for (const p of ["prisma","@prisma/config","deepmerge-ts"]) assert(!fs.existsSync("node_modules/"+p),p+" must be absent from serving runtime");const {PrismaClient}=require("@prisma/client");const c=new PrismaClient();c.$disconnect().then(()=>{require("argon2");console.log("runtime smoke ok: cli chain absent, prisma client usable, argon2 loads");});'
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]

# One-shot migration job: `prisma migrate deploy` for platform PostgreSQL only.
# Compose gates application startup on this container exiting 0
# (depends_on: service_completed_successfully).
FROM base AS migrate
ENV PRISMA_HIDE_UPDATE_MESSAGE=true
COPY --chown=app:app --from=build /srv/server/package.json /srv/server/package-lock.json /srv/server/
COPY --chown=app:app --from=build /srv/server/node_modules /srv/server/node_modules
COPY --chown=app:app --from=build /srv/server/prisma /srv/server/prisma
USER app
CMD ["npx", "prisma", "migrate", "deploy"]

# Isolated test runner: unit tests (stubbed I/O) + integration tests against
# real PostgreSQL/Redis provided by docker/compose.test.yml.
FROM base AS test
COPY --chown=app:app --from=seo-client /srv/client/dist/index.html ./public-render/index.html
COPY --chown=app:app --from=seo-client /srv/client/dist-ssr ./public-render
ENV NODE_ENV=test
COPY --chown=app:app --from=build /srv/server /srv/server
USER app
CMD ["npm", "run", "test:ci", "--silent"]

# Providers that build without --target must serve traffic, never run tests.
FROM runtime AS deploy
