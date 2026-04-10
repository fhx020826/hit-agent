#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_NAME="${SESSION_NAME:-hit-agent-dev}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

kill_port_owner() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "关闭端口 ${port} 上的进程: $pids"
    kill $pids 2>/dev/null || true
  fi
}

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux kill-session -t "$SESSION_NAME"
  echo "已关闭 tmux 会话: $SESSION_NAME"
else
  echo "tmux 会话不存在: $SESSION_NAME"
fi

# 兜底清理端口，避免残留进程占用。
kill_port_owner "$BACKEND_PORT"
kill_port_owner "$FRONTEND_PORT"

echo "停止完成。"
echo "如需确认状态，请执行: bash $ROOT_DIR/scripts/dev-status.sh"
