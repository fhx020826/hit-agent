#!/usr/bin/env bash

set -euo pipefail

SESSION_NAME="${SESSION_NAME:-hit-agent-dev}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
RUNTIME_DIR="${RUNTIME_DIR:-/tmp/hit-agent-dev}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_ROOT="${HIT_AGENT_DATA_ROOT:-${ROOT_DIR}/backend/data}"

show_port() {
  local port="$1"
  echo "端口 ${port}:"
  ss -lntp "( sport = :$port )" 2>/dev/null || true
}

echo "tmux 会话:"
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "- $SESSION_NAME 已存在"
  tmux list-panes -t "${SESSION_NAME}:0" -F '  pane #{pane_index}: #{pane_current_command} | dead=#{pane_dead} | pid=#{pane_pid}'
else
  echo "- $SESSION_NAME 不存在"
fi

echo
show_port "$BACKEND_PORT"
echo
show_port "$FRONTEND_PORT"
echo

echo "健康检查:"
if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
  echo "- 后端: 正常"
else
  echo "- 后端: 未响应"
fi

if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1; then
  echo "- 前端: 正常"
else
  echo "- 前端: 未响应"
fi

echo
echo "数据目录: ${DATA_ROOT}"
echo
echo "日志目录: ${RUNTIME_DIR}"
