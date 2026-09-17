#!/bin/sh
set -eu

# Los volúmenes se montan después de construir la imagen y pueden pertenecer a root.
if [ "$(id -u)" -eq 0 ]; then
  mkdir -p /app/public/uploads /app/backups
  chown nodejs:nodejs /app/public/uploads /app/backups
  exec su-exec nodejs "$@"
fi

exec "$@"
