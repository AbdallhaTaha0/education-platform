# Preserve the verified preview; pending course-material integrations stay separate.
FROM fayq-course-video-client-test:20261004 AS build
COPY docker/disabled-reasons/preview-src/ ./src/
RUN npm run typecheck && npm test && npm run build
FROM fayq-platform-client:before-ide-polish-20261004 AS runtime
COPY --from=build /srv/client/dist /usr/share/nginx/html
