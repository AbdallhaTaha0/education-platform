# Integrated materials verification

Run from repository root. Development and verification use Docker. These runners use disposable PostgreSQL/Redis/private MinIO; cleanup verifies exact labels, images, resolved mounts and network membership before removing only owned test resources, including on failure. Preserve owner preview/data, images and ignored evidence; never prune globally.

Build matching images before running:

```powershell
docker build -f server/Dockerfile --target test -t fayq-materials-final-server-test:20261004 .
docker build -f server/Dockerfile --target runtime -t fayq-materials-final-server:20261004 .
docker build -f server/Dockerfile --target migrate -t fayq-materials-final-migrate:20261004 .
docker build -f client/Dockerfile --target test -t fayq-materials-final-client-test:20261004 .
docker build -f client/Dockerfile --target runtime -t fayq-materials-final-client:20261004 .
docker build -f docker/nginx/Dockerfile -t fayq-materials-final-nginx:20261004 .
docker build -f docker/course-learning-backend/Minio.Dockerfile -t fayq-materials-minio-fixture:20261004 .
node docker/course-learning-backend/run-tests.mjs
node docker/course-learning-backend/ui-run.mjs
```

The populated migration gate requires the previously retained baseline image `fayq-playback-delivery-server-test:20261004` (accepted pre-materials tree `f206601`). Rebuild that baseline from an isolated checkout of that revision if transferring to another machine. Never build it from current source under the old tag.

The real browser runner additionally requires the existing browser image declared in `ui-run.mjs`, owner-local platform/DRM settings and an existing processed demo asset. It keeps those settings private and creates independent platform accounts/data; transport routes only its browser's localhost origin to the isolated stack. It closes only its fixture's external grants/device registration before dropping fixture data. It does not overwrite the owner preview or weaken CORS/security. `--cleanup` removes only inspected backend fixtures; real-browser obligations must be resolved before manual cleanup.

`preview.mjs upgrade` is a one-time guarded owner-local upgrade with a protected database backup and data fingerprints. It refuses existing storage credentials. For restarting an already upgraded preview, use the storage-first commands in [the delivery report](../../reports-and-markdown-files/delivery-and-reviews/course-materials-and-dual-repository-delivery-20261004.md), rather than rerunning provisioning.

The older sibling `course-learning-ui` harness uses explicit mocks and remains historical worker evidence; the real combined gate is this directory's `ui-run.mjs`.
