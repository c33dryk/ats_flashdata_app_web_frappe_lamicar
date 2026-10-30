#!/usr/bin/env sh
# Deploy de producción (VersatileHub): baja el código y reconstruye el contenedor.
#
#   ./deploy.sh              # actualiza la rama actual
#   ./deploy.sh main         # cambia a esa rama y la actualiza
#   ./deploy.sh v0.2.0       # despliega un tag (release) puntual
#
# Requiere el .env de producción en esta misma carpeta (lo lee docker-compose.prod.yml).
set -eu

cd "$(dirname "$0")"
COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  echo "ERROR: falta .env en $(pwd)" >&2
  exit 1
fi

# Cambios locales en el server se pisarían con el pull: mejor frenar y que alguien mire.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "ERROR: hay cambios locales sin commitear en el server:" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

git fetch --prune --tags origin

TARGET="${1:-}"
if [ -n "$TARGET" ]; then
  git checkout "$TARGET"
fi
# En una rama: avanzar a lo último de origin. En un tag: no hay nada que bajar.
if git symbolic-ref -q HEAD >/dev/null; then
  git pull --ff-only
fi

GIT_COMMIT="$(git rev-parse --short HEAD)"
export GIT_COMMIT
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' app/package.json | head -1)"
echo "==> Desplegando v${VERSION} · ${GIT_COMMIT} ($(git describe --tags --always))"

# --remove-orphans: si alguien corrió `docker compose up` sin -f en el server, levanta el compose de
# desarrollo (servicio "app", puerto publicado en el host, sin Traefik) en este mismo proyecto.
$COMPOSE up -d --build --remove-orphans
docker image prune -f >/dev/null

# Dar tiempo a que Next arranque, si no el log sale vacío.
sleep 5
echo "==> Listo. Últimas líneas del log:"
$COMPOSE logs --tail=20
