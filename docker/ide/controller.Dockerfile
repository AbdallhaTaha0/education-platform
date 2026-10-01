# Trusted execution-host controller; NEVER used as the web-serving image.
FROM docker:29.8.1-cli AS docker-cli
FROM fayq-platform-server:0.9.0-m9 AS controller
USER root
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY docker/ide/seccomp.chromium.json /srv/server/seccomp.chromium.json
HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=3 CMD node -e "try{process.exit(Date.now()-require('fs').statSync('/tmp/fayq-grading-ready').mtimeMs<15000?0:1)}catch{process.exit(1)}"
CMD ["node", "dist/grading-worker.js"]
