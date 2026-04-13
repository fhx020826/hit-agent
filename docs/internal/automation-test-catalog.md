# HIT-Agent Automation Test Catalog

Updated 2026-04-14 after the async task center rollout and a fresh `bash scripts/verify-all.sh` pass.

## Unified Entry

- One-key full verification:
  - `bash scripts/verify-all.sh`
- Current one-key sequence:
  - `backend`: `pytest -q`
  - `frontend`: `npm run lint`
  - `frontend`: `NEXT_PUBLIC_API_PORT=<dynamic> npm run build`
  - production-mode backend + frontend startup on auto-selected free ports
  - Playwright batch:
    - `tests/atomic-features.spec.ts`
    - `tests/extended-coverage.spec.ts`
    - `tests/user-journeys.spec.ts`
- Latest one-key result:
  - backend `22 passed`
  - browser `10 passed`
  - log dir `/tmp/hit-agent-verify/20260414-040104`
- Validation policy after the frontend redesign:
  - tests should verify real functionality, not preserve old DOM nesting
  - selectors should prefer labels, roles, headings, and stable button names
  - when the UI meaning changes but the feature contract stays correct, update the test instead of forcing the new UI back into the old structure

## Backend Suites

### `backend/tests/test_smoke_api.py`

- `test_health_check_returns_ok`
  - Purpose: verify the service boots and health endpoint is alive.
- `test_student_can_register_login_and_read_profile`
  - Purpose: verify the student auth and profile base path from register to `/api/auth/me`.
- `test_teacher_can_create_and_list_courses`
  - Purpose: verify the teacher can create a course and read it back.
- `test_student_can_create_and_fetch_chat_session`
  - Purpose: verify the student Q&A session base contract.

### `backend/tests/test_full_api_smoke.py`

- `test_teacher_profile_settings_lesson_pack_and_agent_config_flow`
  - Purpose: verify teacher profile, settings, lesson-pack, publish, analytics, and AI config flow.
- `test_admin_user_management_smoke`
  - Purpose: verify admin-only list, create, update, delete, and self-delete guard.
- `test_materials_and_discussion_flow_smoke`
  - Purpose: verify material upload/share/request and core discussion space messaging/search.
- `test_assignments_feedback_and_survey_flow_smoke`
  - Purpose: verify assignment create, student confirm/submit, AI feedback, survey create/submit/analytics.
- `test_legacy_routes_and_preview_endpoints_smoke`
  - Purpose: verify legacy compatibility and preview/download style support endpoints stay usable.

### `backend/tests/test_extended_feature_api.py`

- `test_profile_avatar_and_compatibility_endpoints`
  - Purpose: verify avatar upload, compatibility settings endpoints, teacher/student directories, template list, and legacy create/list APIs.
- `test_qa_attachment_folder_notification_and_legacy_student_flow`
  - Purpose: verify Q&A attachments, folder CRUD, collect, assign, teacher notifications, teacher reply state changes, and legacy student lesson-pack APIs.
- `test_discussion_attachment_and_live_share_end_to_end`
  - Purpose: verify discussion attachments, AI mention flow, live-share creation, sync data, annotation persistence, and protected downloads.
- `test_feedback_skip_and_pending_visibility`
  - Purpose: verify survey pending visibility, skip semantics, and analytics edge behavior.

### `backend/tests/test_runtime_storage.py`

- `test_runtime_paths_follow_data_root_env`
  - Purpose: verify the backend runtime data directory can be relocated through `HIT_AGENT_DATA_ROOT`.
- `test_sqlite_engine_enables_pragmas`
  - Purpose: verify SQLite runtime hardening is active, including `WAL`, `busy_timeout`, and `foreign_keys`.
- `test_backup_and_restore_scripts_round_trip`
  - Purpose: verify `scripts/data-backup.sh` and `scripts/data-restore.sh` can round-trip database and upload files.

### `backend/tests/test_task_jobs.py`

- `test_async_lesson_pack_job_submission_and_polling`
  - Purpose: verify lesson-pack generation can be submitted as a background task and polled to a persisted final result.
- `test_async_material_update_preview_job_submission_and_polling`
  - Purpose: verify material-update preview can be submitted as a background task and polled to a persisted final result.
- `test_async_material_update_upload_job_submission_and_polling`
  - Purpose: verify material-update upload can be submitted as a background task and polled to a persisted final result.
- `test_async_job_marks_failed_when_background_handler_raises`
  - Purpose: verify task failures do not hang in `running`, and instead land in a visible `failed` state with an error message.

## Frontend Suites

### `frontend/tests/atomic-features.spec.ts`

- `auth routing and admin user management`
  - Purpose: verify registration, login routing, admin create/search/delete user.
- `teacher profile settings course lesson-pack ai-config and material-update`
  - Purpose: verify teacher profile save, appearance save, password update, course creation, lesson-pack generate/publish, AI config, and material-update preview.
- `teacher materials assignments and feedback setup`
  - Purpose: verify teacher material upload/share, assignment publish, and feedback trigger.
- `student materials qa history assignments feedback weakness and discussions`
  - Purpose: verify student-side materials, teacher-targeted Q&A, archive folder creation, assignment submit, anonymous feedback, weakness refresh, and discussion post.
- `teacher question handling material request and feedback analytics`
  - Purpose: verify teacher material-request handling, teacher reply, and analytics page load.

### `frontend/tests/extended-coverage.spec.ts`

- `legacy redirects admin filter teacher settings profile assignment review and analytics pages`
  - Purpose: verify legacy route redirects plus admin filters, teacher settings/profile/avatar, assignment-review, and review analytics entry.
- `teacher question center advanced filters and discussion advanced interactions`
  - Purpose: verify teacher question filters, read/unread toggles, reopen/close/reply operations, and advanced discussion interactions with attachments.
- `teacher and student live share pages sync in real browser`
  - Purpose: verify live-share creation, student join, page sync, and live session ending behavior in two browser contexts.

### `frontend/tests/user-journeys.spec.ts`

- `registered teacher and student complete a full teaching journey`
  - Purpose: verify a realistic multi-role journey from teacher/student self-registration through course creation, material share, assignment publish/submit, survey submit, discussion post, teacher request handling, teacher reply, and analytics confirmation.
- `student question archive lifecycle works end to end`
  - Purpose: verify the student Q&A archive lifecycle from asking a question to collect, folder assign, search, delete record, and delete folder.

## Execution Notes

- Stable browser verification uses production-mode frontend, not `next dev`.
- `scripts/verify-all.sh` auto-selects free verification ports, then passes the chosen frontend port back into backend CORS configuration via `FRONTEND_PORT`.
- `frontend/tests/extended-coverage.spec.ts` and `frontend/tests/user-journeys.spec.ts` support `PLAYWRIGHT_API_PORT`, so the browser suite can run on non-default backend ports.
- The current suites have already been aligned with the redesigned admin shell and updated page semantics, so they now reflect the new UI instead of the pre-redesign layout assumptions.
- After the second-wave page-shell alignment for the remaining student/teacher detail pages and the backup-script runtime fix, the same suites were rerun and still passed without requiring UI regressions to satisfy old selectors.

## Relationship To Feature Docs

- Complete implemented feature inventory:
  - `docs/internal/complete-feature-list.md`
- Latest feature-by-feature evidence matrix:
  - `docs/internal/complete-feature-verification-matrix.md`
- This catalog answers a different question:
  - what each automated test is validating
  - why the test exists
  - which user risk it is intended to catch
