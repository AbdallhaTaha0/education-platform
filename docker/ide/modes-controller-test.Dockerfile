# Trusted disposable verification controller; the socket is never exposed to source jobs.
FROM docker:29.8.1-cli AS cli
FROM fayq-ide-modes-server:test
USER root
COPY --from=cli /usr/local/bin/docker /usr/local/bin/docker
COPY docker/ide/seccomp.chromium.json /srv/server/seccomp.chromium.json
ENV PYTHON_GRADING_IMAGE=fayq-python-execution:0.10.0
