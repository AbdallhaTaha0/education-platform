FROM node:22-bookworm-slim AS build
WORKDIR /execution
COPY server/execution/package*.json ./
RUN npm ci --include=dev
COPY server/execution/tsconfig.json ./
COPY server/execution/src ./src
RUN npm run build
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends chromium chromium-sandbox && rm -rf /var/lib/apt/lists/*
WORKDIR /execution
COPY server/execution/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /execution/dist ./dist
USER node
ENV HOME=/tmp
ENTRYPOINT ["node", "dist/index.js"]
