from __future__ import annotations

import importlib
import os
import sqlite3
import subprocess
import sys
import shutil
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _reload_runtime_modules(monkeypatch: pytest.MonkeyPatch, data_root: Path):
    monkeypatch.setenv("HIT_AGENT_DATA_ROOT", str(data_root))
    monkeypatch.delenv("HIT_AGENT_DATABASE_URL", raising=False)
    monkeypatch.setenv("SQLITE_BUSY_TIMEOUT_MS", "7000")
    monkeypatch.setenv("SQLITE_JOURNAL_MODE", "WAL")
    monkeypatch.setenv("SQLITE_SYNCHRONOUS", "NORMAL")

    import app.db.paths as paths_module
    import app.db.session as session_module

    paths_module = importlib.reload(paths_module)
    session_module = importlib.reload(session_module)
    return paths_module, session_module


def test_runtime_paths_follow_data_root_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    data_root = tmp_path / "runtime-data"
    paths_module, _ = _reload_runtime_modules(monkeypatch, data_root)

    assert Path(paths_module.DATA_DIR) == data_root
    assert Path(paths_module.DB_PATH) == data_root / "app.db"
    assert Path(paths_module.UPLOAD_DIR) == data_root / "uploads"
    assert Path(paths_module.BACKUP_DIR) == data_root / "backups"
    assert Path(paths_module.QUESTION_UPLOAD_DIR).is_dir()
    assert Path(paths_module.MATERIAL_UPLOAD_DIR).is_dir()
    assert Path(paths_module.DISCUSSION_UPLOAD_DIR).is_dir()


def test_sqlite_engine_enables_pragmas(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    data_root = tmp_path / "sqlite-runtime"
    _paths_module, session_module = _reload_runtime_modules(monkeypatch, data_root)

    with session_module.engine.connect() as conn:
        journal_mode = conn.exec_driver_sql("PRAGMA journal_mode").scalar()
        synchronous = conn.exec_driver_sql("PRAGMA synchronous").scalar()
        foreign_keys = conn.exec_driver_sql("PRAGMA foreign_keys").scalar()
        busy_timeout = conn.exec_driver_sql("PRAGMA busy_timeout").scalar()

    session_module.engine.dispose()

    assert str(journal_mode).lower() == "wal"
    assert int(synchronous) == 1
    assert int(foreign_keys) == 1
    assert int(busy_timeout) == 7000


def test_backup_and_restore_scripts_round_trip(tmp_path: Path) -> None:
    if shutil.which("bash") is None:
        pytest.skip("bash is not available in this environment")

    data_root = tmp_path / "server-data"
    backups_dir = data_root / "backups"
    uploads_dir = data_root / "uploads" / "materials"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    db_path = data_root / "app.db"
    with sqlite3.connect(db_path) as conn:
        conn.execute("CREATE TABLE sample_records (id INTEGER PRIMARY KEY, value TEXT)")
        conn.execute("INSERT INTO sample_records (value) VALUES (?)", ("persisted-value",))
        conn.commit()

    sample_file = uploads_dir / "sample.txt"
    sample_file.write_text("backup-me", encoding="utf-8")

    env = os.environ.copy()
    env["HIT_AGENT_DATA_ROOT"] = str(data_root)
    env["BACKUP_STAMP"] = "20260413-120000"

    subprocess.run(
        ["bash", str(REPO_ROOT / "scripts" / "data-backup.sh")],
        check=True,
        cwd=REPO_ROOT,
        env=env,
    )

    archive_path = backups_dir / "hit-agent-backup-20260413-120000.tar.gz"
    assert archive_path.exists()

    db_path.unlink()
    sample_file.unlink()

    subprocess.run(
        ["bash", str(REPO_ROOT / "scripts" / "data-restore.sh"), "--yes", str(archive_path)],
        check=True,
        cwd=REPO_ROOT,
        env=env,
    )

    with sqlite3.connect(db_path) as conn:
        restored_value = conn.execute("SELECT value FROM sample_records").fetchone()

    assert restored_value == ("persisted-value",)
    assert sample_file.read_text(encoding="utf-8") == "backup-me"
