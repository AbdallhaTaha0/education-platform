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

# Production-only dependencies.
FROM base AS prod-deps
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

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

# Minimal runtime: production-only dependencies + built output + generated
# Prisma Client, non-root. Assembled by copy (not prune) so devDependencies
# and sources can never leak into the runtime layer history.
FROM base AS runtime
COPY --chown=app:app server/package.json server/package-lock.json ./
COPY --chown=app:app --from=prod-deps /srv/server/node_modules ./node_modules
COPY --chown=app:app --from=build /srv/server/dist ./dist
# Generated Prisma Client (identical lockfile/platform in both stages).
# Both locations are required: @prisma/client re-exports the generated client
# that `prisma generate` writes under node_modules/.prisma/client.
COPY --chown=app:app --from=build /srv/server/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --chown=app:app --from=build /srv/server/node_modules/.prisma ./node_modules/.prisma
# Smoke: PrismaClient must be CONSTRUCTIBLE in the final runtime image
# (require-only is insufficient). Never connects: dummy URL + disconnect.
RUN DATABASE_URL=postgresql://127.0.0.1:5432/prisma_smoke \
  node -e 'const {PrismaClient}=require("@prisma/client"); const c=new PrismaClient(); c.$disconnect().then(()=>console.log("prisma client smoke ok"));'
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
ENV NODE_ENV=test
COPY --chown=app:app --from=build /srv/server /srv/server
USER app
CMD ["npm", "run", "test:ci", "--silent"]
