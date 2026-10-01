# Supply the reviewed frontend runtime image; do not rebuild/install dependencies here.
ARG CLIENT_IMAGE=edu-platform-client:0.8.0-m8-final
FROM ${CLIENT_IMAGE}
USER root
RUN chown nginx:nginx /etc/nginx/conf.d/default.conf
COPY docker/railway/default.conf.template /opt/platform/default.conf.template
COPY --chmod=755 docker/railway/15-validate-platform-env.sh /docker-entrypoint.d/15-validate-platform-env.sh
# Also tolerate existing checkouts/archives produced before the LF Git rule.
RUN sed -i 's/\r$//' /docker-entrypoint.d/15-validate-platform-env.sh
ENV PORT=8080 BACKEND_PORT=3000
USER nginx
EXPOSE 8080
