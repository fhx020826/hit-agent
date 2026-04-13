#!/usr/bin/env bash

set -euo pipefail

# 项目根目录
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_NAME="${SESSION_NAME:-hit-agent-dev}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
CONDA_ENV="${CONDA_ENV:-fhx-hit-agent}"
LOCAL_SSH_HOST="${LOCAL_SSH_HOST:-hpc}"
RUNTIME_DIR="${RUNTIME_DIR:-/tmp/hit-agent-dev}"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
FRONTEND_LOG="$RUNTIME_DIR/frontend.log"

mkdir -p "$RUNTIME_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

require_cmd tmux
require_cmd ss
require_cmd curl
require_cmd bash
require_cmd npm

CONDA_SH="${DEV_CONDA_SH:-${CONDA_SH:-}}"

resolve_conda_sh() {
  local candidate=""
  local conda_bin=""
  local -a candidates=()

  if [[ -n "${CONDA_SH}" ]]; then
    candidates+=("${CONDA_SH}")
  fi

  if [[ -n "${CONDA_EXE:-}" ]]; then
    conda_bin="${CONDA_EXE}"
  else
    conda_bin="$(command -v conda 2>/dev/null || true)"
  fi

  if [[ -n "${conda_bin}" && -x "${conda_bin}" ]]; then
    candidate="$(cd "$(dirname "${conda_bin}")/.." && pwd)/etc/profile.d/conda.sh"
    candidates+=("${candidate}")
  fi

  candidates+=(
    "${HOME}/miniconda3/etc/profile.d/conda.sh"
    "${HOME}/mambaforge/etc/profile.d/conda.sh"
    "/root/miniconda3/etc/profile.d/conda.sh"
    "/opt/conda/etc/profile.d/conda.sh"
    "/usr/local/miniconda3/etc/profile.d/conda.sh"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -n "${candidate}" && -f "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

if ! CONDA_SH="$(resolve_conda_sh)"; then
  echo "找不到 conda 初始化脚本。请设置 DEV_CONDA_SH 或先安装 conda。" >&2
  exit 1
fi

is_port_listening() {
  local port="$1"
  ss -lnt "( sport = :$port )" | awk 'NR>1 {print $4}' | grep -q ":$port$"
}

health_ok() {
  curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1
}

frontend_ok() {
  curl -fsS "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1
}

print_footer() {
  cat <<EOF

服务状态:
- tmux 会话: ${SESSION_NAME}
- 后端地址: http://127.0.0.1:${BACKEND_PORT}
- 前端地址: http://127.0.0.1:${FRONTEND_PORT}

服务器上查看日志:
- tmux attach -t ${SESSION_NAME}
- bash ${ROOT_DIR}/scripts/dev-status.sh

你本地 Windows 需要执行:
ssh -L ${FRONTEND_PORT}:localhost:${FRONTEND_PORT} -L ${BACKEND_PORT}:localhost:${BACKEND_PORT} ${LOCAL_SSH_HOST}

你本地浏览器访问:
- http://localhost:${FRONTEND_PORT}
- http://localhost:${BACKEND_PORT}/api/health
EOF
}

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "tmux 会话已存在: $SESSION_NAME"
  bash "$ROOT_DIR/scripts/dev-status.sh"
  print_footer
  exit 0
fi

if is_port_listening "$BACKEND_PORT"; then
  echo "后端端口 ${BACKEND_PORT} 已被占用，请先释放端口后再启动。" >&2
  exit 1
fi

if is_port_listening "$FRONTEND_PORT"; then
  echo "前端端口 ${FRONTEND_PORT} 已被占用，请先释放端口后再启动。" >&2
  exit 1
fi

BACKEND_CMD="$(cat <<EOF
cd '$ROOT_DIR' && \
source '$CONDA_SH' && \
conda activate '${CONDA_ENV}' && \
cd backend && \
python -m uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT} 2>&1 | tee '$BACKEND_LOG'
EOF
)"

FRONTEND_CMD="$(cat <<EOF
cd '$ROOT_DIR/frontend' && \
if [[ ! -x node_modules/.bin/next ]]; then npm install --cache .npm-cache --registry=https://registry.npmjs.org/; fi && \
NEXT_PUBLIC_API_PORT='${BACKEND_PORT}' npm run dev 2>&1 | tee '$FRONTEND_LOG'
EOF
)"

tmux new-session -d -s "$SESSION_NAME" -n app "bash -lc \"$BACKEND_CMD\""
tmux split-window -h -t "${SESSION_NAME}:0" "bash -lc \"$FRONTEND_CMD\""
tmux setw -t "${SESSION_NAME}:0" remain-on-exit on
tmux select-layout -t "${SESSION_NAME}:0" even-horizontal

echo "已创建 tmux 会话: $SESSION_NAME"
echo "等待前后端启动..."

backend_ready=0
frontend_ready=0

for _ in $(seq 1 90); do
  if [[ $backend_ready -eq 0 ]] && health_ok; then
    backend_ready=1
  fi
  if [[ $frontend_ready -eq 0 ]] && frontend_ok; then
    frontend_ready=1
  fi
  if [[ $backend_ready -eq 1 && $frontend_ready -eq 1 ]]; then
    break
  fi
  sleep 1
done

if [[ $backend_ready -ne 1 ]]; then
  echo "后端未在预期时间内启动成功，请检查日志: $BACKEND_LOG" >&2
  bash "$ROOT_DIR/scripts/dev-status.sh" || true
  exit 1
fi

if [[ $frontend_ready -ne 1 ]]; then
  echo "前端未在预期时间内启动成功，请检查日志: $FRONTEND_LOG" >&2
  bash "$ROOT_DIR/scripts/dev-status.sh" || true
  exit 1
fi

echo "前后端启动成功。"
print_footer
