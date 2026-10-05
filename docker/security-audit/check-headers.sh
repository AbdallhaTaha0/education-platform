#!/bin/sh
set -eu
for mode in client railway; do
  if [ "$mode" = client ]; then
    cp /audit/client.conf /etc/nginx/conf.d/default.conf
  else
    export PORT=8080 DNS_RESOLVER=127.0.0.11 BACKEND_HOST=127.0.0.1 BACKEND_PORT=3000
    envsubst '$PORT $DNS_RESOLVER $BACKEND_HOST $BACKEND_PORT' < /audit/railway.template > /etc/nginx/conf.d/default.conf
  fi
  nginx -t
  nginx
  for route in / /index.html /account; do
    response=$(wget -S -O /dev/null "http://127.0.0.1:8080$route" 2>&1)
    printf '%s\n' "$response" | grep -q "Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
    printf '%s\n' "$response" | grep -q 'X-Frame-Options: DENY'
  done
  nginx -s quit
  while [ -f /tmp/nginx.pid ]; do sleep 0.1; done
  echo "$mode: configuration valid and page headers verified"
done
