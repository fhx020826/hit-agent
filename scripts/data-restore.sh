#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_ROOT="${HIT_AGENT_DATA_ROOT:-${ROOT_DIR}/backend/data}"
DB_PATH="${HIT_AGENT_DB_PATH:-${DATA_ROOT}/app.db}"
UPLOAD_DIR="${HIT_AGENT_UPLOAD_DIR:-${DATA_ROOT}/uploads}"
BACKUP_DIR="${HIT_AGENT_BACKUP_DIR:-${DATA_ROOT}/backups}"

usage() {
  cat <<EOF
用法:
  bash scripts/data-restore.sh --yes <backup-archive-or-dir>

说明:
- 恢复前请先停止后端服务，避免覆盖运行中的 SQLite 文件。
- 支持从 .tar.gz 备份包或已解压备份目录恢复。
EOF
}

if [[ "${1:-}" != "--yes" ]]; then
  usage >&2
  exit 1
fi

if [[ $# -lt 2 ]]; then
  usage >&2
  exit 1
fi

SOURCE_INPUT="$2"
if [[ ! -e "${SOURCE_INPUT}" ]]; then
  echo "备份源不存在: ${SOURCE_INPUT}" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

SOURCE_DIR="${SOURCE_INPUT}"
if [[ -f "${SOURCE_INPUT}" ]]; then
  tar -xzf "${SOURCE_INPUT}" -C "${TMP_DIR}"
  SOURCE_DIR="${TMP_DIR}"
fi

SOURCE_DB_PATH="${SOURCE_DIR}/$(basename "${DB_PATH}")"
SOURCE_UPLOAD_DIR="${SOURCE_DIR}/uploads"

if [[ ! -f "${SOURCE_DB_PATH}" ]]; then
  echo "备份中缺少数据库文件: ${SOURCE_DB_PATH}" >&2
  exit 1
fi

mkdir -p "${DATA_ROOT}" "${BACKUP_DIR}"

PRE_RESTORE_TAG="pre-restore-$(date +%Y%m%d-%H%M%S)"
if [[ -f "${DB_PATH}" ]]; then
  cp "${DB_PATH}" "${BACKUP_DIR}/app-${PRE_RESTORE_TAG}.db"
fi
if [[ -d "${UPLOAD_DIR}" ]]; then
  tar -czf "${BACKUP_DIR}/uploads-${PRE_RESTORE_TAG}.tar.gz" -C "${UPLOAD_DIR}" .
fi

cp "${SOURCE_DB_PATH}" "${DB_PATH}"
rm -rf "${UPLOAD_DIR}"
mkdir -p "${UPLOAD_DIR}"
if [[ -d "${SOURCE_UPLOAD_DIR}" ]]; then
  cp -a "${SOURCE_UPLOAD_DIR}/." "${UPLOAD_DIR}/"
fi

echo "数据恢复完成:"
echo "- 数据库: ${DB_PATH}"
echo "- 上传目录: ${UPLOAD_DIR}"
