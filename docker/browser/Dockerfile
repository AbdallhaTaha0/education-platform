# Containerized M3 browser harness (test-only, never production traffic).
# Drives system Chromium against the platform Nginx entry point and asserts
# identity (M2 preserved) + catalog behavior: bilingual discovery, EGP prices,
# admin management, lifecycle/archive/delete states, storage/bundle hygiene.
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update -y && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /srv/browser
COPY docker/browser/package.json docker/browser/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY docker/browser/run.mjs ./
RUN mkdir -p /srv/browser/evidence
ENV BASE_URL=http://nginx:8080
ENV EVIDENCE_DIR=/srv/browser/evidence
CMD ["node", "run.mjs"]
