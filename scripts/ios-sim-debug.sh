#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/ios/RoamlyMobile.xcodeproj"
SCHEME="${SCHEME:-RoamlyMobile}"
CONFIGURATION="${CONFIGURATION:-Debug}"
BUNDLE_ID="${BUNDLE_ID:-com.openspring.roamly.mobile}"
DEVICE_NAME="${DEVICE_NAME:-iPhone 17 Pro}"
SCREENSHOT_PATH="${SCREENSHOT_PATH:-$ROOT_DIR/attachment/ios-simulator-screen.png}"
DERIVED_ROOT="$ROOT_DIR/ios/build"
APP_PATH="$DERIVED_ROOT/$CONFIGURATION-iphonesimulator/RoamlyMobile.app"

usage() {
  cat <<'USAGE'
Usage:
  scripts/ios-sim-debug.sh [all|build|boot|install|launch|screenshot|logs|ui]

Environment:
  DEVICE_NAME       Simulator name, default: iPhone 17 Pro
  BUNDLE_ID         App bundle id, default: com.openspring.roamly.mobile
  SCREENSHOT_PATH   Screenshot output path, default: attachment/ios-simulator-screen.png

Examples:
  scripts/ios-sim-debug.sh all
  DEVICE_NAME="iPhone 17" scripts/ios-sim-debug.sh screenshot
  scripts/ios-sim-debug.sh logs
  scripts/ios-sim-debug.sh ui
USAGE
}

sim_udid() {
  xcrun simctl list devices available "$DEVICE_NAME" | awk -F '[()]' '/Shutdown|Booted/ { print $2; exit }'
}

require_udid() {
  local udid
  udid="$(sim_udid)"
  if [[ -z "$udid" ]]; then
    echo "No available simulator named '$DEVICE_NAME'." >&2
    xcrun simctl list devices available >&2
    exit 1
  fi
  echo "$udid"
}

boot_simulator() {
  local udid="$1"
  if ! xcrun simctl list devices | grep "$udid" | grep -q "Booted"; then
    xcrun simctl boot "$udid" || true
  fi
  open -a Simulator
  xcrun simctl bootstatus "$udid" -b
}

build_app() {
  local udid="$1"
  local build_cmd=(
    xcodebuild
    -project "$PROJECT_PATH"
    -scheme "$SCHEME"
    -configuration "$CONFIGURATION"
    -sdk iphonesimulator
    -destination "platform=iOS Simulator,id=$udid"
    SYMROOT="$DERIVED_ROOT"
    build
  )

  if command -v xcbeautify >/dev/null 2>&1; then
    "${build_cmd[@]}" | xcbeautify
  else
    "${build_cmd[@]}"
  fi
}

install_app() {
  local udid="$1"
  if [[ ! -d "$APP_PATH" ]]; then
    echo "App bundle not found at $APP_PATH. Run build first." >&2
    exit 1
  fi
  xcrun simctl install "$udid" "$APP_PATH"
}

launch_app() {
  local udid="$1"
  xcrun simctl terminate "$udid" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl launch "$udid" "$BUNDLE_ID"
}

take_screenshot() {
  local udid="$1"
  mkdir -p "$(dirname "$SCREENSHOT_PATH")"
  xcrun simctl io "$udid" screenshot "$SCREENSHOT_PATH"
  echo "$SCREENSHOT_PATH"
}

stream_logs() {
  local udid="$1"
  xcrun simctl spawn "$udid" log stream --style compact --predicate "subsystem == '$BUNDLE_ID' OR process == 'RoamlyMobile'"
}

describe_ui() {
  local udid="$1"
  if ! command -v idb >/dev/null 2>&1; then
    echo "idb is not installed. Run: python3 -m pip install --user fb-idb" >&2
    exit 1
  fi
  idb ui describe-all --udid "$udid"
}

main() {
  local action="${1:-all}"
  case "$action" in
    -h|--help|help)
      usage
      exit 0
      ;;
  esac

  local udid
  udid="$(require_udid)"

  case "$action" in
    boot)
      boot_simulator "$udid"
      ;;
    build)
      boot_simulator "$udid"
      build_app "$udid"
      ;;
    install)
      boot_simulator "$udid"
      install_app "$udid"
      ;;
    launch)
      boot_simulator "$udid"
      launch_app "$udid"
      ;;
    screenshot)
      boot_simulator "$udid"
      take_screenshot "$udid"
      ;;
    logs)
      boot_simulator "$udid"
      stream_logs "$udid"
      ;;
    ui)
      boot_simulator "$udid"
      describe_ui "$udid"
      ;;
    all)
      boot_simulator "$udid"
      build_app "$udid"
      install_app "$udid"
      launch_app "$udid"
      sleep 2
      take_screenshot "$udid"
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
