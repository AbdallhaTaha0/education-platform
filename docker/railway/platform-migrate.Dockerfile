# Railway GitHub builds use the repository root as context.
# Dedicated default target: never starts the web server or test runner.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE}
WORKDIR /srv/server
ENV NODE_ENV=production PRISMA_HIDE_UPDATE_MESSAGE=true
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system app \
  && useradd --system --gid app --home-dir /srv/server app
COPY server/package.json server/package-lock.json ./
# Prisma CLI is a locked development dependency, required by this one-shot job.
RUN npm ci --include=dev && npm cache clean --force
COPY --chown=app:app server/prisma ./prisma
USER app
CMD ["npx", "prisma", "migrate", "deploy"]
