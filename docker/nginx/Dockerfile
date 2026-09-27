# Platform Nginx entry-point image (unprivileged: non-root, listens on 8080).
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.27-alpine

FROM ${NGINX_IMAGE} AS runtime
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
