#!/usr/bin/env bash

set -euo pipefail

BROWSERS_ROOT="${PLAYWRIGHT_BROWSERS_PATH:-${HOME}/.cache/ms-playwright}"

has_browser() {
  compgen -G "${BROWSERS_ROOT}/chromium-*/chrome-linux64/chrome" >/dev/null
}

if has_browser; then
  exit 0
fi

echo "未发现可用的 Playwright Chromium，开始自动安装..."
npx playwright install chromium
