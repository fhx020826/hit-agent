"""Database engine and session primitives."""

from __future__ import annotations

from collections.abc import Generator
import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .paths import DB_PATH

SQLITE_BUSY_TIMEOUT_MS = int(os.getenv("SQLITE_BUSY_TIMEOUT_MS", "5000"))
SQLITE_JOURNAL_MODE = os.getenv("SQLITE_JOURNAL_MODE", "WAL").upper()
SQLITE_SYNCHRONOUS = os.getenv("SQLITE_SYNCHRONOUS", "NORMAL").upper()
SQLALCHEMY_DATABASE_URL = os.getenv("HIT_AGENT_DATABASE_URL", f"sqlite:///{DB_PATH}")
IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith("sqlite:")

connect_args = {}
if IS_SQLITE:
    connect_args = {
        "check_same_thread": False,
        "timeout": SQLITE_BUSY_TIMEOUT_MS / 1000,
    }

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args, pool_pre_ping=not IS_SQLITE)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


if IS_SQLITE:
    @event.listens_for(engine, "connect")
    def _configure_sqlite(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute(f"PRAGMA journal_mode={SQLITE_JOURNAL_MODE}")
            cursor.execute(f"PRAGMA synchronous={SQLITE_SYNCHRONOUS}")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}")
        finally:
            cursor.close()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
