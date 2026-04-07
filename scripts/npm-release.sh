#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: npm-release.sh [--publish] [--dry-run] [--allow-npm-install] [--allow-build] [--tag <tag>]

Default behavior:
  - Build/package into npm/roamly/.release
  - Does NOT publish unless --publish or --dry-run is provided

Options:
  --publish            Run npm publish from the staged directory
  --dry-run            Run npm publish --dry-run
  --allow-npm-install  Run npm install if node_modules is missing
  --allow-build        Run npm run build if web/dist is missing
  --tag <tag>          Publish with a dist-tag (e.g. next)

Environment:
  ROAMLY_ALLOW_NPM_INSTALL=1  Same as --allow-npm-install
  ROAMLY_ALLOW_BUILD=1        Same as --allow-build
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="${ROOT_DIR}/npm/roamly"
STAGE_DIR="${PKG_DIR}/.release"
PUBLISH=0
DRY_RUN=0
ALLOW_NPM_INSTALL="${ROAMLY_ALLOW_NPM_INSTALL:-0}"
ALLOW_BUILD="${ROAMLY_ALLOW_BUILD:-0}"
TAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish)
      PUBLISH=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --allow-npm-install)
      ALLOW_NPM_INSTALL=1
      shift
      ;;
    --allow-build)
      ALLOW_BUILD=1
      shift
      ;;
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "${PKG_DIR}/package.json" ]]; then
  echo "Missing ${PKG_DIR}/package.json" >&2
  exit 1
fi

need_npm=0
if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
  if [[ "${ALLOW_NPM_INSTALL}" == "1" || "${ALLOW_BUILD}" == "1" ]]; then
    need_npm=1
  else
    echo "node_modules 缺失。请先执行 npm install，或使用 --allow-npm-install。" >&2
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

rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}/bin" "${STAGE_DIR}/web"

if ! command -v rsync >/dev/null 2>&1; then
  echo "未找到 rsync，请先安装 rsync。" >&2
  exit 1
fi

rsync -a --delete "${ROOT_DIR}/server/" "${STAGE_DIR}/server/"
rsync -a --delete "${ROOT_DIR}/web/dist/" "${STAGE_DIR}/web/dist/"

cp "${ROOT_DIR}/bin/roamly" "${STAGE_DIR}/bin/roamly"
chmod +x "${STAGE_DIR}/bin/roamly"

cp "${PKG_DIR}/package.json" "${STAGE_DIR}/package.json"

if [[ -f "${ROOT_DIR}/README.md" ]]; then
  cp "${ROOT_DIR}/README.md" "${STAGE_DIR}/README.md"
fi
if [[ -f "${ROOT_DIR}/LICENSE" ]]; then
  cp "${ROOT_DIR}/LICENSE" "${STAGE_DIR}/LICENSE"
fi

echo "已打包到: ${STAGE_DIR}"

if [[ "${DRY_RUN}" == "1" ]]; then
  (cd "${STAGE_DIR}" && npm publish --dry-run ${TAG:+--tag "${TAG}"})
  exit 0
fi

if [[ "${PUBLISH}" == "1" ]]; then
  (cd "${STAGE_DIR}" && npm publish ${TAG:+--tag "${TAG}"})
fi
