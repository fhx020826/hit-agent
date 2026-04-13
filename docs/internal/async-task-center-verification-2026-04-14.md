# Async Task Center Verification 2026-04-14

## Scope
- Introduce a lightweight in-process async task center for heavy teacher-side operations.
- First migrated flows:
  - lesson pack generation
  - material update preview
  - material update upload

## Backend Changes
- New ORM:
  - `backend/app/db/models_tasks.py`
- New schema:
  - `backend/app/models/tasks.py`
- New services:
  - `backend/app/services/task_jobs.py`
  - `backend/app/services/task_job_handlers.py`
- New routes:
  - `backend/app/routes/task_jobs.py`

## API Surface
- `POST /api/task-jobs/lesson-pack-generate/{course_id}`
- `POST /api/task-jobs/material-update/preview`
- `POST /api/task-jobs/material-update/upload`
- `GET /api/task-jobs/{job_id}`
- `GET /api/task-jobs`

## Frontend Changes
- `frontend/src/app/teacher/lesson-pack/page.tsx`
  - submit background task on page load
  - poll task state
  - render queued / running / failed / succeeded states
- `frontend/src/app/teacher/material-update/page.tsx`
  - submit background task on preview/upload
  - poll task state
  - render task progress card and final structured result
- `frontend/src/lib/api.ts`
  - add task job types and new async endpoints

## Compatibility
- Existing sync endpoints remain available:
  - `POST /api/lesson-packs/generate/{course_id}`
  - `POST /api/material-update/preview`
  - `POST /api/material-update/upload`
- Current frontend defaults to async endpoints.

## Failure Handling
- Task failures now land in persistent `failed` state with `error_message`.
- On app startup, stale `queued` / `running` rows are marked failed by recovery logic.

## Automated Evidence
- `backend/tests/test_task_jobs.py`
  - lesson-pack async submit + poll
  - material-update preview async submit + poll
  - material-update upload async submit + poll
  - failed background handler state fallback
  - task list endpoint
  - stale job recovery
- `bash scripts/verify-all.sh`
  - latest passed batch: `/tmp/hit-agent-verify/20260414-040104`
  - backend: `22 passed`
  - browser: `10 passed`

## Result
- The async task center is live for the two heaviest current teacher workflows.
- Existing mainline teacher/student/admin flows remain green under full automated regression.
