#!/bin/sh
set -eu

# Los volúmenes se montan después de construir la imagen y pueden pertenecer a root.
if [ "$(id -u)" -eq 0 ]; then
  uploads_root="${UPLOADS_ROOT:-/app/public/uploads}"
  uploads_project="${UPLOADS_PROJECT_NAME:-catamanager}"
  case "$uploads_project" in
    ''|*[!A-Za-z0-9._-]*)
      echo "UPLOADS_PROJECT_NAME inválido: usa letras, números, punto, guion o guion bajo." >&2
      exit 1
      ;;
  esac
  uploads_dir="$uploads_root/$uploads_project"
  mkdir -p "$uploads_dir" /app/backups
  # Solo cambia el propietario de la carpeta de este proyecto; no toca las
  # carpetas de otros proyectos que comparten el mismo volumen del host.
  chown nodejs:nodejs "$uploads_root" /app/backups
  chown -R nodejs:nodejs "$uploads_dir"
  exec gosu nodejs "$@"
fi

exec "$@"
