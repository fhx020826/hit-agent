#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_ROOT="${HIT_AGENT_DATA_ROOT:-${ROOT_DIR}/backend/data}"
DB_PATH="${HIT_AGENT_DB_PATH:-${DATA_ROOT}/app.db}"
UPLOAD_DIR="${HIT_AGENT_UPLOAD_DIR:-${DATA_ROOT}/uploads}"
BACKUP_DIR="${HIT_AGENT_BACKUP_DIR:-${DATA_ROOT}/backups}"
BACKUP_STAMP="${BACKUP_STAMP:-$(date +%Y%m%d-%H%M%S)}"
ARCHIVE_PATH="${BACKUP_DIR}/hit-agent-backup-${BACKUP_STAMP}.tar.gz"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

if [[ ! -f "${DB_PATH}" ]]; then
  echo "数据库文件不存在: ${DB_PATH}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "${PYTHON_BIN}" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  else
    echo "缺少 python 或 python3，无法执行 SQLite 热备份。" >&2
    exit 1
  fi
fi

export DB_PATH
export TMP_DIR
export DATA_ROOT
export UPLOAD_DIR
export BACKUP_STAMP

"${PYTHON_BIN}" - <<'PY'
import json
import os
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

db_path = Path(os.environ["DB_PATH"])
tmp_dir = Path(os.environ["TMP_DIR"])
upload_dir = Path(os.environ["UPLOAD_DIR"])
payload = {
    "created_at": datetime.now(timezone.utc).isoformat(),
    "backup_stamp": os.environ["BACKUP_STAMP"],
    "data_root": os.environ["DATA_ROOT"],
    "db_filename": db_path.name,
    "has_uploads": upload_dir.exists(),
}

db_backup_path = tmp_dir / db_path.name
src = sqlite3.connect(db_path)
dst = sqlite3.connect(db_backup_path)
with dst:
    src.backup(dst)
dst.close()
src.close()

uploads_backup_dir = tmp_dir / "uploads"
uploads_backup_dir.mkdir(parents=True, exist_ok=True)
if upload_dir.exists():
    for child in upload_dir.iterdir():
        target = uploads_backup_dir / child.name
        if child.is_dir():
            shutil.copytree(child, target)
        else:
            shutil.copy2(child, target)

(tmp_dir / "manifest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
PY

tar -czf "${ARCHIVE_PATH}" -C "${TMP_DIR}" .

echo "数据备份完成: ${ARCHIVE_PATH}"
