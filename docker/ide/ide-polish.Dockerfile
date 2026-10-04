# IDE-only preview update from the retained verified frontend source image.
# Pending course-material changes remain in the workspace for later integration.
FROM fayq-course-video-client-test:20261004 AS build
COPY client/src/features/ide/WebIDE.tsx ./src/features/ide/WebIDE.tsx
COPY client/src/features/ide/ide.css ./src/features/ide/ide.css
COPY client/src/features/ide/PracticePage.tsx ./src/features/ide/PracticePage.tsx
RUN npm run typecheck && npm run build

FROM fayq-platform-client:before-ide-polish-20261004 AS runtime
COPY --from=build /srv/client/dist /usr/share/nginx/html
