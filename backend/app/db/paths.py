"""Filesystem paths used by the backend data layer."""

from __future__ import annotations

import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = (APP_DIR / ".." / "data").resolve()
DATA_ROOT_ENV_VAR = "HIT_AGENT_DATA_ROOT"


def _resolve_data_dir() -> Path:
    raw = os.getenv(DATA_ROOT_ENV_VAR, "").strip()
    if not raw:
        return DEFAULT_DATA_DIR
    return Path(raw).expanduser().resolve()


_DATA_DIR_PATH = _resolve_data_dir()
_UPLOAD_DIR_PATH = _DATA_DIR_PATH / "uploads"
_BACKUP_DIR_PATH = _DATA_DIR_PATH / "backups"

_RUNTIME_DIRECTORIES = {
    "data": _DATA_DIR_PATH,
    "uploads": _UPLOAD_DIR_PATH,
    "backups": _BACKUP_DIR_PATH,
    "questions": _UPLOAD_DIR_PATH / "questions",
    "notebooks": _UPLOAD_DIR_PATH / "notebooks",
    "assignments": _UPLOAD_DIR_PATH / "assignments",
    "profiles": _UPLOAD_DIR_PATH / "profiles",
    "material_updates": _UPLOAD_DIR_PATH / "material_updates",
    "materials": _UPLOAD_DIR_PATH / "materials",
    "discussions": _UPLOAD_DIR_PATH / "discussions",
}

for path in _RUNTIME_DIRECTORIES.values():
    path.mkdir(parents=True, exist_ok=True)

DATA_DIR = str(_RUNTIME_DIRECTORIES["data"])
UPLOAD_DIR = str(_RUNTIME_DIRECTORIES["uploads"])
BACKUP_DIR = str(_RUNTIME_DIRECTORIES["backups"])
QUESTION_UPLOAD_DIR = str(_RUNTIME_DIRECTORIES["questions"])
NOTEBOOK_UPLOAD_DIR = str(_RUNTIME_DIRECTORIES["notebooks"])
ASSIGNMENT_UPLOAD_DIR = str(_RUNTIME_DIRECTORIES["assignments"])
PROFILE_UPLOAD_DIR = str(_RUNTIME_DIRECTORIES["profiles"])
MATERIAL_UPDATE_UPLOAD_DIR = str(_RUNTIME_DIRECTORIES["material_updates"])
MATERIAL_UPLOAD_DIR = str(_RUNTIME_DIRECTORIES["materials"])
DISCUSSION_UPLOAD_DIR = str(_RUNTIME_DIRECTORIES["discussions"])
DB_PATH = str(_DATA_DIR_PATH / "app.db")
