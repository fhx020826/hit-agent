#!/usr/bin/env bash

set -euo pipefail

# 统一顺序执行后端、前端和真实浏览器回归，避免提交前人工漏跑。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONDA_BIN="${VERIFY_CONDA_BIN:-${CONDA_EXE:-}}"
CONDA_ENV="${VERIFY_CONDA_ENV:-fhx-hit-agent}"
FRONTEND_PORT_BASE="${VERIFY_FRONTEND_PORT:-3100}"
BACKEND_PORT_BASE="${VERIFY_BACKEND_PORT:-8100}"
FRONTEND_PORT=""
BACKEND_PORT=""
RUNTIME_ROOT="${VERIFY_RUNTIME_ROOT:-/tmp/hit-agent-verify}"
STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="${RUNTIME_ROOT}/${STAMP}"

BACKEND_TEST_LOG="${RUN_DIR}/backend-pytest.log"
FRONTEND_LINT_LOG="${RUN_DIR}/frontend-lint.log"
FRONTEND_BUILD_LOG="${RUN_DIR}/frontend-build.log"
BACKEND_SERVER_LOG="${RUN_DIR}/backend-server.log"
FRONTEND_SERVER_LOG="${RUN_DIR}/frontend-server.log"
E2E_LOG="${RUN_DIR}/frontend-e2e.log"

BACKEND_PID=""
FRONTEND_PID=""

mkdir -p "${RUN_DIR}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

require_cmd bash
require_cmd curl
require_cmd npm
require_cmd ss
require_cmd tee

resolve_conda_bin() {
  local candidate=""
  local -a candidates=()

  if [[ -n "${CONDA_BIN}" ]]; then
    candidates+=("${CONDA_BIN}")
  fi

  if [[ -n "${CONDA_EXE:-}" ]]; then
    candidates+=("${CONDA_EXE}")
  fi

  candidate="$(command -v conda 2>/dev/null || true)"
  if [[ -n "${candidate}" ]]; then
    candidates+=("${candidate}")
  fi

  candidates+=(
    "${HOME}/miniconda3/bin/conda"
    "${HOME}/mambaforge/bin/conda"
    "/root/miniconda3/bin/conda"
    "/opt/conda/bin/conda"
    "/usr/local/miniconda3/bin/conda"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -n "${candidate}" && -x "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

if ! CONDA_BIN="$(resolve_conda_bin)"; then
  echo "找不到 conda 可执行文件。请设置 VERIFY_CONDA_BIN 或先安装 conda。" >&2
  exit 1
fi

cleanup() {
  set +e
  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1
    wait "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1
    wait "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

port_in_use() {
  local port="$1"
  ss -lnt "( sport = :${port} )" | awk 'NR > 1 { print $4 }' | grep -q ":${port}$"
}

pick_free_port() {
  local port="$1"
  while port_in_use "${port}"; do
    port=$((port + 1))
  done
  echo "${port}"
}

wait_for_url() {
  local url="$1"
  local name="$2"
  for _ in $(seq 1 90); do
    if curl --noproxy '*' -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "${name} 未在预期时间内就绪: ${url}" >&2
  return 1
}

run_in_conda() {
  local cmd="$1"
  local conda_bin_escaped=""
  local conda_env_escaped=""
  printf -v conda_bin_escaped '%q' "${CONDA_BIN}"
  printf -v conda_env_escaped '%q' "${CONDA_ENV}"
  bash -lc "eval \"\$(${conda_bin_escaped} shell.bash hook)\" && conda activate ${conda_env_escaped} && ${cmd}"
}

ensure_frontend_dependencies() {
  if [[ ! -x "${ROOT_DIR}/frontend/node_modules/.bin/next" ]]; then
    (
      cd "${ROOT_DIR}/frontend"
      npm install --cache .npm-cache --registry=https://registry.npmjs.org/
    )
  fi
}

FRONTEND_PORT="$(pick_free_port "${FRONTEND_PORT_BASE}")"
BACKEND_PORT="$(pick_free_port "${BACKEND_PORT_BASE}")"

ensure_frontend_dependencies

if [[ "${FRONTEND_PORT}" != "${FRONTEND_PORT_BASE}" ]]; then
  echo "验证前端默认端口 ${FRONTEND_PORT_BASE} 被占用，自动切换到 ${FRONTEND_PORT}"
fi

if [[ "${BACKEND_PORT}" != "${BACKEND_PORT_BASE}" ]]; then
  echo "验证后端默认端口 ${BACKEND_PORT_BASE} 被占用，自动切换到 ${BACKEND_PORT}"
fi

echo "[1/5] 后端 pytest"
run_in_conda "cd '${ROOT_DIR}/backend' && pytest -q" | tee "${BACKEND_TEST_LOG}"

echo "[2/5] 前端 lint"
(
  cd "${ROOT_DIR}/frontend"
  npm run lint
) | tee "${FRONTEND_LINT_LOG}"

echo "[3/5] 前端 build"
(
  cd "${ROOT_DIR}/frontend"
  NEXT_PUBLIC_API_PORT="${BACKEND_PORT}" npm run build
) | tee "${FRONTEND_BUILD_LOG}"

echo "[4/5] 启动生产模式服务"
run_in_conda "cd '${ROOT_DIR}/backend' && FRONTEND_PORT='${FRONTEND_PORT}' python -m uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT}" >"${BACKEND_SERVER_LOG}" 2>&1 &
BACKEND_PID=$!

(
  cd "${ROOT_DIR}/frontend"
  NEXT_PUBLIC_API_PORT="${BACKEND_PORT}" ./node_modules/.bin/next start --hostname 127.0.0.1 --port "${FRONTEND_PORT}"
) >"${FRONTEND_SERVER_LOG}" 2>&1 &
FRONTEND_PID=$!

wait_for_url "http://127.0.0.1:${BACKEND_PORT}/api/health" "后端服务"
wait_for_url "http://127.0.0.1:${FRONTEND_PORT}" "前端服务"

echo "[5/5] Playwright 全量浏览器回归"
(
  cd "${ROOT_DIR}/frontend"
  PLAYWRIGHT_BASE_URL="http://127.0.0.1:${FRONTEND_PORT}" \
  PLAYWRIGHT_API_PORT="${BACKEND_PORT}" \
  npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts tests/user-journeys.spec.ts
) | tee "${E2E_LOG}"

echo
echo "统一验证完成。日志目录: ${RUN_DIR}"
