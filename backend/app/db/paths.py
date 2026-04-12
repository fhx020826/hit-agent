"""Filesystem paths used by the backend data layer."""

from __future__ import annotations

import os

APP_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(APP_DIR, "..", "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
QUESTION_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "questions")
ASSIGNMENT_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "assignments")
PROFILE_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "profiles")
MATERIAL_UPDATE_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "material_updates")
MATERIAL_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "materials")
DISCUSSION_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "discussions")

for path in [
    DATA_DIR,
    UPLOAD_DIR,
    QUESTION_UPLOAD_DIR,
    ASSIGNMENT_UPLOAD_DIR,
    PROFILE_UPLOAD_DIR,
    MATERIAL_UPDATE_UPLOAD_DIR,
    MATERIAL_UPLOAD_DIR,
    DISCUSSION_UPLOAD_DIR,
]:
    os.makedirs(path, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "app.db")
