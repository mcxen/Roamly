#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: brew-install.sh [--prefix <path>] [--allow-npm-install] [--allow-build] [--no-prune]

Default behavior:
  - Requires existing node_modules and web/dist in the source tree.
  - Copies the app into <prefix>/libexec/roamly
  - Installs the Roamly launcher into <prefix>/bin/roamly

Options:
  --prefix <path>         Install prefix (defaults to HOMEBREW_PREFIX or brew --prefix)
  --allow-npm-install     Run npm install if node_modules is missing
  --allow-build           Run npm run build if web/dist is missing
  --no-prune              Skip npm prune --omit=dev

Environment:
  ROAMLY_ALLOW_NPM_INSTALL=1  Same as --allow-npm-install
  ROAMLY_ALLOW_BUILD=1        Same as --allow-build
  ROAMLY_NO_PRUNE=1           Same as --no-prune
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIX=""
ALLOW_NPM_INSTALL="${ROAMLY_ALLOW_NPM_INSTALL:-0}"
ALLOW_BUILD="${ROAMLY_ALLOW_BUILD:-0}"
NO_PRUNE="${ROAMLY_NO_PRUNE:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix)
      PREFIX="${2:-}"
      shift 2
      ;;
    --allow-npm-install)
      ALLOW_NPM_INSTALL=1
      shift
      ;;
    --allow-build)
      ALLOW_BUILD=1
      shift
      ;;
    --no-prune)
      NO_PRUNE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "${PREFIX}" ]]; then
        PREFIX="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "${PREFIX}" ]]; then
  PREFIX="${HOMEBREW_PREFIX:-}"
fi
if [[ -z "${PREFIX}" ]] && command -v brew >/dev/null 2>&1; then
  PREFIX="$(brew --prefix)"
fi
if [[ -z "${PREFIX}" ]]; then
  echo "Install prefix is required. Use --prefix <path>." >&2
  exit 1
fi

need_npm=0
if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
  if [[ "${ALLOW_NPM_INSTALL}" == "1" || "${ALLOW_BUILD}" == "1" ]]; then
    need_npm=1
  else
    echo "node_modules 缺失。请先在源码目录执行 npm install，或使用 --allow-npm-install。" >&2
    exit 1
  fi
fi

if [[ "${need_npm}" == "1" || "${ALLOW_BUILD}" == "1" ]]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "未找到 npm，请先安装 Node.js。" >&2
    exit 1
  fi
fi

if [[ "${need_npm}" == "1" ]]; then
  (cd "${ROOT_DIR}" && npm install)
fi

if [[ ! -d "${ROOT_DIR}/web/dist" ]]; then
  if [[ "${ALLOW_BUILD}" == "1" ]]; then
    (cd "${ROOT_DIR}" && npm run build)
  else
    echo "web/dist 缺失。请先执行 npm run build，或使用 --allow-build。" >&2
    exit 1
  fi
fi

if [[ "${NO_PRUNE}" != "1" && "${need_npm}" == "1" ]]; then
  (cd "${ROOT_DIR}" && npm prune --omit=dev)
fi

DEST_LIBEXEC="${PREFIX}/libexec/roamly"
DEST_BIN="${PREFIX}/bin"

mkdir -p "${DEST_LIBEXEC}" "${DEST_BIN}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "未找到 rsync，请先安装 rsync。" >&2
  exit 1
fi

rsync -a --delete \
  --exclude ".git" \
  --exclude ".env" \
  --exclude "maps" \
  --exclude "server/data" \
  "${ROOT_DIR}/" "${DEST_LIBEXEC}/"

mkdir -p "${DEST_LIBEXEC}/server/data"

install -m 755 "${ROOT_DIR}/bin/roamly" "${DEST_BIN}/roamly"

echo "Roamly 安装完成: ${DEST_BIN}/roamly"
