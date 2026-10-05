FROM ghcr.io/gitleaks/gitleaks:v8.30.1 AS scanner
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
COPY --from=scanner /usr/bin/gitleaks /usr/local/bin/gitleaks
COPY docker/security-audit/private-candidate-triage.mjs /triage.mjs
CMD ["node","/triage.mjs"]
