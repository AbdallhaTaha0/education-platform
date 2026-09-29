# TEST-ONLY DRM contract fixture image (browser profile only).
# NEVER used by production runtime images. Labeled fixture, not real DRM/R2.
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS runtime
RUN groupadd --system app && useradd --system --gid app --home-dir /srv/fixture app
WORKDIR /srv/fixture
COPY docker/drm-fixture/package.json docker/drm-fixture/server.js ./
USER app
EXPOSE 8090
ENV PORT=8090
CMD ["node", "server.js"]
