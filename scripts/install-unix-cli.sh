#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  install-unix-cli.sh <app-or-binary-path> [link-path]

Examples:
  install-unix-cli.sh /Applications/codex-manager.app
  install-unix-cli.sh /Applications/codex-manager.app/Contents/MacOS/codex-manager /usr/local/bin/codex-manager
  install-unix-cli.sh ~/Applications/codex-manager.AppImage /usr/local/bin/codex-manager
EOF
}

if [[ "${1:-}" == "" ]]; then
  usage >&2
  exit 1
fi

SOURCE_PATH="$1"
LINK_PATH="${2:-/usr/local/bin/codex-manager}"

resolve_target() {
  local input="$1"

  if [[ -d "$input" && "$input" == *.app ]]; then
    echo "$input/Contents/MacOS/codex-manager"
    return 0
  fi

  if [[ -x "$input" || -f "$input" ]]; then
    echo "$input"
    return 0
  fi

  return 1
}

TARGET_PATH="$(resolve_target "$SOURCE_PATH" || true)"
if [[ -z "$TARGET_PATH" ]]; then
  echo "Cannot resolve a CLI target from: $SOURCE_PATH" >&2
  exit 1
fi

if [[ ! -e "$TARGET_PATH" ]]; then
  echo "Target not found: $TARGET_PATH" >&2
  exit 1
fi

TARGET_PATH="$(cd "$(dirname "$TARGET_PATH")" && pwd)/$(basename "$TARGET_PATH")"
LINK_DIR="$(dirname "$LINK_PATH")"

mkdir -p "$LINK_DIR"
ln -sfn "$TARGET_PATH" "$LINK_PATH"

echo "Installed codex-manager -> $TARGET_PATH"
echo "Link path: $LINK_PATH"
