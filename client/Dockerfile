# Platform frontend image: Vite build -> static files served by unprivileged
# Nginx (non-root, port 8080). Contains no secrets: only VITE_* public values
# are bundled, and privileged credentials must never use the VITE_ prefix.
# Build context is the repository root.
ARG NODE_IMAGE=node:22-bookworm-slim
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.27-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /srv/client
COPY client/package.json client/package-lock.json ./
COPY client/scripts ./scripts
RUN npm ci
COPY client/index.html client/vite.config.ts client/tsconfig.json client/postcss.config.js client/tailwind.config.js ./
COPY client/nginx.conf ./nginx.conf
COPY client/public ./public
COPY client/src ./src
RUN npm run build

# Test stage: client-side unit tests for the pure learning logic. No secrets and
# no network dependency, so it needs neither postgres nor redis.
FROM ${NODE_IMAGE} AS test
WORKDIR /srv/client
COPY client/package.json client/package-lock.json ./
COPY client/scripts ./scripts
RUN npm ci
COPY client/index.html client/vite.config.ts client/vitest.config.ts client/tsconfig.json client/postcss.config.js client/tailwind.config.js ./
COPY client/src ./src
CMD ["npm", "test"]

FROM ${NGINX_IMAGE} AS runtime
COPY --from=build /srv/client/dist /usr/share/nginx/html
COPY --from=build /srv/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
