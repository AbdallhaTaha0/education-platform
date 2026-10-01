#!/bin/sh
set -eu
case "${BACKEND_HOST:-}" in ''|*[!a-zA-Z0-9.-]*) echo 'Valid private BACKEND_HOST is required' >&2; exit 1;; esac
for value in "${PORT:-}" "${BACKEND_PORT:-}"; do
  case "$value" in ''|*[!0-9]*) echo 'Numeric listen/backend ports are required' >&2; exit 1;; esac
  [ "$value" -ge 1 ] && [ "$value" -le 65535 ] || exit 1
done
DNS_RESOLVER=$(awk '/^nameserver / {print $2; exit}' /etc/resolv.conf)
[ -n "$DNS_RESOLVER" ] || exit 1
case "$DNS_RESOLVER" in *:*) DNS_RESOLVER="[$DNS_RESOLVER]";; esac
export DNS_RESOLVER
# Render explicitly: shell child
# exports do not persist. Limit substitution to these four variables.
envsubst '${PORT} ${BACKEND_HOST} ${BACKEND_PORT} ${DNS_RESOLVER}' < /opt/platform/default.conf.template > /etc/nginx/conf.d/default.conf
# The template is outside the standard renderer directory.
