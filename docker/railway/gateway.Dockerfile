# Dedicated Railway API/SSR gateway; Vercel serves the matching static assets.
FROM nginxinc/nginx-unprivileged:1.27-alpine
USER root
RUN chown nginx:nginx /etc/nginx/conf.d/default.conf
COPY docker/railway/default.conf.template /opt/platform/default.conf.template
COPY --chmod=755 docker/railway/15-validate-platform-env.sh /docker-entrypoint.d/15-validate-platform-env.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/15-validate-platform-env.sh
ENV PORT=8080 BACKEND_PORT=3000
USER nginx
EXPOSE 8080
