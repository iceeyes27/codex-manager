#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="${1:-$ROOT_DIR/src-tauri/target/release/bundle/macos/codex-manager.app}"
OUTPUT_DIR="${2:-$ROOT_DIR/src-tauri/target/release/bundle/pkg}"
VERSION="${3:-}"

if [[ -z "$VERSION" ]]; then
  cd "$ROOT_DIR"
  VERSION="$(node -p "require('./package.json').version")"
fi

if [[ ! -d "$APP_PATH" ]]; then
  echo "macOS app bundle not found: $APP_PATH" >&2
  echo "Build the Tauri app bundle first." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
chmod +x "$ROOT_DIR/src-tauri/macos/pkg/postinstall"

PKG_PATH="$OUTPUT_DIR/codex-manager_${VERSION}_macos.pkg"

pkgbuild \
  --component "$APP_PATH" \
  --install-location /Applications \
  --scripts "$ROOT_DIR/src-tauri/macos/pkg" \
  --identifier "com.codex-manager.pkg" \
  --version "$VERSION" \
  "$PKG_PATH"

echo "Created $PKG_PATH"
