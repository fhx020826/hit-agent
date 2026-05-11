# HIT-Agent Complete Feature List

Updated 2026-05-08. This is the code-grounded full feature inventory for the current repository state.

Companion verification document:
- `docs/internal/complete-feature-verification-matrix.md` maps every feature ID below to an independent test case ID, latest automated evidence, and verification status.

---

## A. Authentication & Authorization (Shared)

| # | Feature | Page/Route | API Endpoint | Test Priority |
|---|---------|------------|--------------|---------------|
| A1 | Teacher registration | `/` (modal) | `POST /api/auth/register` role=teacher | CRITICAL |
| A2 | Student registration | `/` (modal) | `POST /api/auth/register` role=student | CRITICAL |
| A3 | Admin login | `/` (modal) | `POST /api/auth/login` role=admin | CRITICAL |
| A4 | Teacher login | `/` (modal) | `POST /api/auth/login` role=teacher | CRITICAL |
| A5 | Student login | `/` (modal) | `POST /api/auth/login` role=student | CRITICAL |
| A6 | Logout | `/settings` button | `POST /api/auth/logout` | CRITICAL |
| A7 | Get current user | auto on load | `GET /api/auth/me` | CRITICAL |
| A8 | Change password | `/settings` | `POST /api/auth/change-password` | CRITICAL |
| A9 | Auth routing (role-based redirect) | app-wide | client-side redirect | CRITICAL |

## B. Admin Features

### B1. User Management (`/admin/users`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| B1.1 | List all users | page load | `GET /api/admin/users` | CRITICAL |
| B1.2 | Search users by keyword | text input + search | `GET /api/admin/users?keyword=` | CRITICAL |
| B1.3 | Filter users by role | dropdown | `GET /api/admin/users?role=` | HIGH |
| B1.4 | Create user (any role) | form + button | `POST /api/admin/users` | CRITICAL |
| B1.5 | Delete user | button per row | `DELETE /api/admin/users/{id}` | CRITICAL |

### B2. Registrar Simulation (`/admin/academic`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| B2.1 | View registrar simulation overview | page load | `GET /api/admin/academic/teachers` + `GET /api/admin/academic/students` + `GET /api/admin/academic/courses` + `GET /api/admin/academic/offerings` | CRITICAL |
| B2.2 | Seed demo academic data idempotently | button | `POST /api/admin/academic/seed-demo-school` | CRITICAL |
| B2.3 | Reset demo academic data | danger action + confirm | `POST /api/admin/academic/reset-demo-school` | HIGH |
| B2.4 | Export demo accounts and relationships | button | `GET /api/admin/academic/export-demo-accounts` | HIGH |
| B2.5 | View teacher roster with course counts | table | `GET /api/admin/academic/teachers` | HIGH |
| B2.6 | View student roster with course counts | table | `GET /api/admin/academic/students` | HIGH |
| B2.7 | View academic courses | table | `GET /api/admin/academic/courses` | HIGH |
| B2.8 | View offerings / teacher-course assignments | table | `GET /api/admin/academic/offerings` | HIGH |
| B2.9 | View enrollment relationships indirectly through offering counts and export | page sections + export | `GET /api/admin/academic/offerings` + `GET /api/admin/academic/export-demo-accounts` | HIGH |

## C. Shared Account Settings

### C1. Profile (`/profile`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| C1.1 | View profile | page load | `GET /api/profile/me` | HIGH |
| C1.2 | Edit profile fields | form inputs | `PUT /api/profile/me` | HIGH |
| C1.3 | Select preset avatar | button group | included in profile update | HIGH |
| C1.4 | Upload custom avatar | file input | `POST /api/profile/avatar` | MEDIUM |
| C1.5 | Save profile | button | `PUT /api/profile/me` | HIGH |

### C2. Settings (`/settings`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| C2.1 | Theme mode (day/night/eye-care) | button group | `PUT /api/settings/me` | HIGH |
| C2.2 | Accent color (blue/green/purple/orange/gray) | button group | `PUT /api/settings/me` | HIGH |
| C2.3 | Font scheme (default/rounded/serif/mono) | button group | `PUT /api/settings/me` | HIGH |
| C2.4 | Skin style (clean/tech/gentle) | button group | `PUT /api/settings/me` | HIGH |
| C2.5 | Language toggle (zh-CN/en-US) | button group | `PUT /api/settings/me` | HIGH |
| C2.6 | Save settings persistence | save button + reload verify | `PUT /api/settings/me` + `GET /api/settings/me` | HIGH |
| C2.7 | Change password | 3 fields + button | `POST /api/auth/change-password` | CRITICAL |
| C2.8 | Logout | button | `POST /api/auth/logout` | CRITICAL |

## D. Teacher Features

### D1. Teacher Dashboard (`/teacher`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D1.1 | View teacher dashboard with module cards | page load | none (static) | HIGH |
| D1.2 | Navigate to all sub-pages | link clicks | n/a | HIGH |

### D1.1b. My Teaching Courses (`/teacher/course-management`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D1.1b.1 | View current teacher offerings | page load | `GET /api/teacher/course-management/offerings` | CRITICAL |
| D1.1b.2 | View enrolled student list for an offering | click course card/detail | `GET /api/teacher/course-management/offerings/{offering_id}/students` | HIGH |
| D1.1b.3 | Show empty-state guidance when teacher has no assigned offerings | page load | same as above | HIGH |
| D1.1b.4 | Keep relation management read-only for teachers in registrar mode | page actions disabled / rejected | `POST /api/teacher/course-management/courses` + `POST /api/teacher/course-management/offerings` | HIGH |

### D2. Course Creation (`/teacher/course`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D2.1 | Create course with full form | form submit | `POST /api/courses` | CRITICAL |
| D2.2 | Redirect to lesson pack generation | auto redirect | n/a | HIGH |

### D3. Lesson Pack (`/teacher/lesson-pack`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D3.1 | Generate lesson pack (legacy sync endpoint) | direct request | `POST /api/lesson-packs/generate/{course_id}` | HIGH |
| D3.2 | Submit lesson pack background task | auto on page load | `POST /api/task-jobs/lesson-pack-generate/{course_id}` | CRITICAL |
| D3.3 | Poll lesson pack task state | auto polling | `GET /api/task-jobs/{job_id}` | CRITICAL |
| D3.4 | View generated content (objectives, outline, etc.) | display | n/a | HIGH |
| D3.5 | Publish lesson pack | button | `POST /api/lesson-packs/{lp_id}/publish` | CRITICAL |
| D3.6 | View lesson pack detail | link | `GET /api/lesson-packs/{lp_id}` | HIGH |

### D4. AI Assistant Config (`/teacher/ai-config`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D4.1 | Select course | dropdown | `GET /api/courses` | HIGH |
| D4.2 | Load existing config | auto on course select | `GET /api/agent-config/{course_id}` | HIGH |
| D4.3 | Configure scope rules | textarea | `PUT /api/agent-config/{course_id}` | HIGH |
| D4.4 | Configure answer style | dropdown (3 options) | `PUT /api/agent-config/{course_id}` | HIGH |
| D4.5 | Toggle homework support | checkbox | `PUT /api/agent-config/{course_id}` | HIGH |
| D4.6 | Toggle material Q&A | checkbox | `PUT /api/agent-config/{course_id}` | HIGH |
| D4.7 | Toggle frontier extension | checkbox | `PUT /api/agent-config/{course_id}` | HIGH |
| D4.8 | Save and verify persistence | save + reload | `PUT` + `GET` | HIGH |

### D5. Materials Management (`/teacher/materials`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D5.1 | Select course | dropdown | `GET /api/courses` | HIGH |
| D5.2 | Upload material file | file input | `POST /api/materials/upload/{course_id}` | CRITICAL |
| D5.3 | List uploaded materials | auto display | `GET /api/materials/{course_id}` | HIGH |
| D5.4 | Preview material | button per item | `GET /api/materials/file/{id}` | MEDIUM |
| D5.5 | Download material | button per item | `GET /api/materials/file/{id}` | MEDIUM |
| D5.6 | Share selected materials to students | checkbox + button | `POST /api/materials/share` | CRITICAL |
| D5.7 | View share history | display section | `GET /api/materials/shares/teacher` | HIGH |
| D5.8 | View student material requests | display section | `GET /api/materials/requests/teacher` | HIGH |
| D5.9 | Approve material request | button | `POST /api/materials/requests/{id}/handle` approved | HIGH |
| D5.10 | Mark material request as shared | button | `POST /api/materials/requests/{id}/handle` shared | MEDIUM |
| D5.11 | Reject material request | button | `POST /api/materials/requests/{id}/handle` rejected | MEDIUM |
| D5.12 | Start live share session | button | `POST /api/materials/live/start` | MEDIUM |
| D5.13 | View active live share status | display | `GET /api/materials/live/current` | MEDIUM |

### D6. Material Update / PPT Update (`/teacher/material-update`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D6.1 | Select course | dropdown | `GET /api/courses` | HIGH |
| D6.2 | Fill update title & instructions | text inputs | n/a | HIGH |
| D6.3 | Provide material text (optional) | textarea | n/a | HIGH |
| D6.4 | Upload old material file (optional) | file input | `POST /api/material-update/upload` | MEDIUM |
| D6.5 | Select AI model | dropdown/button | `GET /api/qa/models` | HIGH |
| D6.6 | Generate update preview (legacy sync endpoint) | direct request | `POST /api/material-update/preview` | HIGH |
| D6.7 | Generate update with file upload (legacy sync endpoint) | direct request | `POST /api/material-update/upload` | HIGH |
| D6.8 | Submit update preview background task | button | `POST /api/task-jobs/material-update/preview` | CRITICAL |
| D6.9 | Submit update upload background task | button | `POST /api/task-jobs/material-update/upload` | HIGH |
| D6.10 | Poll update task state | auto polling | `GET /api/task-jobs/{job_id}` | CRITICAL |
| D6.11 | View update result (summary, suggestions, draft pages) | display | n/a | HIGH |
| D6.12 | View update history | display list | `GET /api/material-update` | HIGH |
| D6.13 | Default/fallback mode when no model available | auto-fallback | sync or async request with `selected_model="default"` | HIGH |

### D7. Assignments (`/teacher/assignments`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D7.1 | Select course | dropdown | `GET /api/courses` | HIGH |
| D7.2 | Load class options for course | auto | `GET /api/assignments/teacher/class-options` | HIGH |
| D7.3 | Create and publish assignment | form submit | `POST /api/assignments` | CRITICAL |
| D7.4 | View assignment list | display | `GET /api/assignments/teacher` | HIGH |
| D7.5 | View assignment detail with student roster | button click | `GET /api/assignments/teacher/{id}` | HIGH |
| D7.6 | View submitted students list | display | included in detail | HIGH |
| D7.7 | View unsubmitted students list | display | included in detail | HIGH |
| D7.8 | View confirmed but unsubmitted | display | included in detail | MEDIUM |
| D7.9 | View unconfirmed students | display | included in detail | MEDIUM |

### D8. Feedback / Survey (`/teacher/feedback`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D8.1 | Select course | dropdown | `GET /api/courses` | HIGH |
| D8.2 | Select lesson pack | dropdown | `GET /api/lesson-packs` | HIGH |
| D8.3 | Manually trigger feedback survey | button | `POST /api/feedback/instances` | CRITICAL |
| D8.4 | View survey analytics | button | `GET /api/feedback/analytics/{id}` | CRITICAL |
| D8.5 | View participation count & rate | display | included in analytics | HIGH |
| D8.6 | View rating breakdown | display | included in analytics | HIGH |
| D8.7 | View anonymous text suggestions | display | included in analytics | HIGH |

### D9. Questions (`/teacher/questions`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D9.1 | View student questions list | page load | `GET /api/qa/teacher/questions` | CRITICAL |
| D9.2 | Expand question detail | button click | n/a | HIGH |
| D9.3 | Reply to student question | textbox + button | `POST /api/qa/teacher/questions/{id}/reply` | CRITICAL |
| D9.4 | View teacher notifications | page load | `GET /api/qa/teacher/notifications` | HIGH |
| D9.5 | Mark notification as read | button | `POST /api/qa/teacher/notifications/{id}/read` | MEDIUM |

### D10. Discussions (`/teacher/discussions`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D10.1 | View discussion spaces | page load | `GET /api/discussions/spaces` | HIGH |
| D10.2 | Send message in discussion | textbox + button | `POST /api/discussions/messages` | HIGH |
| D10.3 | Search messages | search input | `GET /api/discussions/search` | MEDIUM |

### D11. Assignment Review (`/teacher/assignment-review`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D11.1 | Preview AI assignment review | form + button | `POST /api/assignment-review/preview` | HIGH |

### D12. Analytics (`/teacher/review` or lesson-pack detail)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D12.1 | View lesson pack analytics | page load | `GET /api/analytics/{lp_id}` | MEDIUM |

## E. Student Features

### E1. Student Dashboard (`/student`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| E1.1 | View student dashboard with navigation | page load | none (static) | HIGH |
| E1.2 | Navigate to all sub-pages | link clicks | n/a | HIGH |

### E1.1b. My Courses (`/student/courses`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| E1.1b.1 | View current student enrollments | page load | `GET /api/student/courses` | CRITICAL |
| E1.1b.2 | Show teacher / semester / class context for each course | card display | `GET /api/student/courses` | HIGH |
| E1.1b.3 | Show empty-state guidance when no enrollments exist | page load | same as above | HIGH |
| E1.1b.4 | Keep manual join flow disabled in registrar mode | hidden UI / rejected API | `POST /api/student/courses/join` | HIGH |

### E2. Q&A Assistant (`/student/qa`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| E2.1 | Select course | dropdown | `GET /api/courses` | HIGH |
| E2.2 | Select lesson pack | dropdown | `GET /api/lesson-packs` | HIGH |
| E2.3 | Choose answer mode (AI / teacher / both) | button group | client-side flag | CRITICAL |
| E2.4 | Toggle anonymous posting | checkbox | client-side flag | HIGH |
| E2.5 | View current model status | display | `GET /api/qa/models` | HIGH |
| E2.6 | Switch model | button | `GET /api/qa/models` | MEDIUM |
| E2.7 | Type and submit question | textbox + button | `POST /api/qa/ask` | CRITICAL |
| E2.8 | Upload question attachments | file input | `POST /api/qa/attachments` | MEDIUM |
| E2.9 | Start new Q&A round | button | `POST /api/qa/sessions` | HIGH |
| E2.10 | View current Q&A stream | display | `GET /api/qa/sessions/{id}` | HIGH |
| E2.11 | View model unavailability message | display when no model | n/a | HIGH |

### E3. Question History (`/student/questions`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| E3.1 | Select course to filter | dropdown | `GET /api/qa/history` | HIGH |
| E3.2 | Create folder | text input + button | `POST /api/qa/folders` | HIGH |
| E3.3 | Toggle question collection (favorite) | button | `POST /api/qa/questions/{id}/collect` | HIGH |
| E3.4 | Move question to folder | dropdown | `PUT /api/qa/questions/{id}/folder` | HIGH |
| E3.5 | View question history list | display | `GET /api/qa/history` | HIGH |
| E3.6 | Delete question | button | `DELETE /api/qa/questions/{id}` | MEDIUM |

### E4. Materials (`/student/materials`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| E4.1 | Select course | dropdown | `GET /api/courses` | HIGH |
| E4.2 | View shared materials | display | `GET /api/materials/shares/current` | HIGH |
| E4.3 | Preview material | button | `GET /api/materials/file/{id}` | MEDIUM |
| E4.4 | Download material | button | `GET /api/materials/file/{id}` | MEDIUM |
| E4.5 | View live share status | display | `GET /api/materials/live/current` | MEDIUM |
| E4.6 | Enter live share view | button | navigate to `/student/materials/live/{shareId}` | MEDIUM |
| E4.7 | Send material request to teacher | textarea + button | `POST /api/materials/requests` | CRITICAL |

### E5. Assignments (`/student/assignments`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| E5.1 | View assignment list | page load | `GET /api/assignments/student` | CRITICAL |
| E5.2 | Confirm receipt of assignment | button | `POST /api/assignments/{id}/confirm` | CRITICAL |
| E5.3 | Upload submission file | file input | included in submit | CRITICAL |
| E5.4 | Submit assignment | button | `POST /api/assignments/{id}/submit` | CRITICAL |
| E5.5 | Resubmit assignment (if allowed) | button | `POST /api/assignments/{id}/submit` | HIGH |
| E5.6 | View AI feedback on submission | display | included in student assignment view | HIGH |
| E5.7 | Download submitted file | link | `GET /api/assignments/submissions/{id}/files/{token}` | MEDIUM |

### E6. Feedback / Survey (`/student/feedback`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| E6.1 | View pending surveys | page load | `GET /api/feedback/pending` | CRITICAL |
| E6.2 | Fill rating question | button group (1-5) | included in submit | CRITICAL |
| E6.3 | Fill choice question | button group | included in submit | HIGH |
| E6.4 | Fill text question | textarea | included in submit | HIGH |
| E6.5 | Submit anonymous feedback | button | `POST /api/feedback/instances/{id}/submit` | CRITICAL |
| E6.6 | Skip survey | button | `POST /api/feedback/instances/{id}/skip` | HIGH |

### E7. Weakness Analysis (`/student/weakness`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| E7.1 | View weakness analysis | page load | `GET /api/qa/weakness-analysis` | HIGH |
| E7.2 | Trigger re-analysis | button | `GET /api/qa/weakness-analysis` | HIGH |

### E8. Discussions (`/student/discussions`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| E8.1 | View discussion space | page load | `GET /api/discussions/spaces` | HIGH |
| E8.2 | Send message | textbox + button | `POST /api/discussions/messages` | HIGH |
| E8.3 | View messages | display | `GET /api/discussions/spaces/{id}/messages` | HIGH |

## F. Cross-Cutting Features

| # | Feature | Scope | Test Priority |
|---|---------|--------|---------------|
| F1 | Appearance persistence across sessions | all roles | HIGH |
| F2 | Role-based route protection | all routes | CRITICAL |
| F3 | i18n (Chinese/English) | all pages | HIGH |
| F4 | File upload handling (multiple formats) | materials, assignments | HIGH |
| F5 | Anonymous posting toggle | Q&A, discussions | HIGH |
| F6 | Course relationship authorization based on registrar-seeded offerings/enrollments | questions, assignments, feedback, discussions, materials, student course access | CRITICAL |
| F7 | AI assistant constrained to established course relations only | teacher and student AI workflows | CRITICAL |

## G. Legacy Routes, Live Share Views, And Compatibility APIs

### G1. Legacy Route Compatibility (Frontend)

| # | Feature | Page/Route | Behavior | Test Priority |
|---|---------|------------|----------|---------------|
| G1.1 | Legacy student register route redirect | `/student/register` | Redirect to `/` | MEDIUM |
| G1.2 | Legacy teacher register route redirect | `/teacher/register` | Redirect to `/` | MEDIUM |
| G1.3 | Legacy student settings route redirect | `/student/settings` | Redirect to `/settings` | MEDIUM |
| G1.4 | Legacy teacher settings route redirect | `/teacher/settings` | Redirect to `/settings` | MEDIUM |

### G2. Teacher Live Share View (`/teacher/materials/live/[shareId]`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| G2.1 | Resolve active live share by `shareId` | page load | `GET /api/materials/live/current` + `GET /api/materials/{course_id}` | HIGH |
| G2.2 | Enter teacher live annotation board | route navigation | n/a | HIGH |
| G2.3 | Open original shared material | button | `GET /api/materials/file/{material_id}` | MEDIUM |
| G2.4 | Download original shared material | button | `GET /api/materials/file/{material_id}` | MEDIUM |
| G2.5 | End live share and save annotations | button | `POST /api/materials/live/{share_id}/end` | HIGH |
| G2.6 | End live share without saving annotations | button | `POST /api/materials/live/{share_id}/end` | HIGH |

### G3. Student Live Share View (`/student/materials/live/[shareId]`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| G3.1 | Resolve active live share by `shareId` | page load | `GET /api/materials/live/current` + `GET /api/materials/{course_id}` | HIGH |
| G3.2 | Enter student live annotation board | route navigation | n/a | HIGH |
| G3.3 | Receive teacher page sync updates | WebSocket / display | `/api/materials/live/{share_id}/ws` + `POST /api/materials/live/{share_id}/page` | HIGH |
| G3.4 | Render teacher annotations in read-only mode | canvas overlay | `GET /api/materials/live/{share_id}/annotations` | HIGH |

### G4. Live Annotation Board Shared Capabilities

| # | Feature | Scope | API | Test Priority |
|---|---------|-------|-----|---------------|
| G4.1 | Load existing annotations by page | teacher/student live board | `GET /api/materials/live/{share_id}/annotations` | HIGH |
| G4.2 | WebSocket sync for annotation/page/end events | teacher/student live board | `/api/materials/live/{share_id}/ws` | HIGH |
| G4.3 | Teacher manual page sync | teacher live board | `POST /api/materials/live/{share_id}/page` | HIGH |
| G4.4 | Teacher draw persistent annotations | teacher live board | `POST /api/materials/live/{share_id}/annotations` | HIGH |
| G4.5 | Teacher draw temporary flash annotations | teacher live board | `POST /api/materials/live/{share_id}/annotations` | MEDIUM |
| G4.6 | Multi-tool annotation support (pen/pencil/ballpen/highlighter/flash) | teacher live board | included in create annotation | MEDIUM |
| G4.7 | Multi-color and line-width adjustment | teacher live board | included in create annotation | MEDIUM |
| G4.8 | Protected preview/download of shared material inside board | teacher/student live board | `GET /api/materials/file/{material_id}` | MEDIUM |
| G4.9 | Saved annotation version listing (backend support) | live share lifecycle | `GET /api/materials/live/{share_id}/versions` | MEDIUM |

### G5. Advanced Discussion Workspace Capabilities (Teacher + Student)

| # | Feature | Scope | API | Test Priority |
|---|---------|-------|-----|---------------|
| G5.1 | Load discussion space detail | teacher/student discussions | `GET /api/discussions/spaces/{space_id}` | HIGH |
| G5.2 | Load paginated discussion messages | teacher/student discussions | `GET /api/discussions/spaces/{space_id}/messages` | HIGH |
| G5.3 | Upload discussion attachments | teacher/student discussions | `POST /api/discussions/attachments` | HIGH |
| G5.4 | Send anonymous discussion message | teacher/student discussions | `POST /api/discussions/messages` | HIGH |
| G5.5 | Mention AI assistant in discussion message | teacher/student discussions | `POST /api/discussions/messages` | HIGH |
| G5.6 | Search discussion messages by keyword | teacher/student discussions | `GET /api/discussions/search` | HIGH |
| G5.7 | Search discussion messages by sender user | teacher/student discussions | `GET /api/discussions/search` | MEDIUM |
| G5.8 | Search discussion messages by sender type | teacher/student discussions | `GET /api/discussions/search` | MEDIUM |
| G5.9 | Open discussion attachments from message cards | teacher/student discussions | `GET /api/discussions/attachments/{attachment_id}/download` | MEDIUM |
| G5.10 | View recent shared materials in space detail | teacher/student discussions | included in space detail | MEDIUM |
| G5.11 | View member-specific discussion history (backend support) | discussion support API | `GET /api/discussions/spaces/{space_id}/members/{user_id}/messages` | MEDIUM |
| G5.12 | View discussion message context thread (backend support) | discussion support API | `GET /api/discussions/messages/{message_id}/context` | MEDIUM |

### G6. Question Center Advanced Capabilities

| # | Feature | Scope | API | Test Priority |
|---|---------|-------|-----|---------------|
| G6.1 | Filter teacher questions by course | teacher question center | `GET /api/qa/teacher/questions` | HIGH |
| G6.2 | Filter teacher questions by reply status | teacher question center | `GET /api/qa/teacher/questions` | HIGH |
| G6.3 | Reopen question to pending state | teacher question center | `POST /api/qa/teacher/questions/{question_id}/reply` | HIGH |
| G6.4 | Close question after handling | teacher question center | `POST /api/qa/teacher/questions/{question_id}/reply` | HIGH |
| G6.5 | Mark teacher notification as unread again | teacher question center | `POST /api/qa/teacher/notifications/{notification_id}/read` | MEDIUM |
| G6.6 | Open question attachments from teacher side | teacher question center | `GET /api/qa/attachments/{attachment_id}/download` | MEDIUM |
| G6.7 | Open question attachments from student history | student history | `GET /api/qa/attachments/{attachment_id}/download` | MEDIUM |
| G6.8 | Delete question folder | student history | `DELETE /api/qa/folders/{folder_id}` | MEDIUM |
| G6.9 | Update question folder metadata (backend support) | question folder API | `PUT /api/qa/folders/{folder_id}` | MEDIUM |

### G7. Compatibility And Backend-Support APIs

| # | Feature | Scope | API | Test Priority |
|---|---------|-------|-----|---------------|
| G7.1 | Course detail query | backend support API | `GET /api/courses/{course_id}` | MEDIUM |
| G7.2 | Legacy student published lesson pack list | compatibility API | `GET /api/student/lesson-packs` | MEDIUM |
| G7.3 | Legacy student lesson pack detail | compatibility API | `GET /api/student/lesson-packs/{lp_id}` | MEDIUM |
| G7.4 | Legacy student lesson pack QA | compatibility API | `POST /api/student/lesson-packs/{lp_id}/qa` | MEDIUM |
| G7.5 | Shared appearance lookup by role/user | compatibility API | `GET /api/settings/{user_role}/{user_id}` | MEDIUM |
| G7.6 | Shared appearance update by role/user | compatibility API | `PUT /api/settings/{user_role}/{user_id}` | MEDIUM |
| G7.7 | Profile avatar asset retrieval | backend support API | `GET /api/profile/avatar/{user_id}/{filename}` | MEDIUM |
| G7.8 | Teacher-side student directory | backend support API | `GET /api/profile/students` | MEDIUM |
| G7.9 | Teacher-side teacher directory | backend support API | `GET /api/profile/teachers` | MEDIUM |
| G7.10 | Legacy teacher list/create API | compatibility API | `GET /api/users/teachers` + `POST /api/users/teachers` | LOW |
| G7.11 | Legacy student list/create API | compatibility API | `GET /api/users/students` + `POST /api/users/students` | LOW |
| G7.12 | Admin user update API | backend support API | `PUT /api/admin/users/{user_id}` | MEDIUM |
| G7.13 | Assignment submission file download | backend support API | `GET /api/assignments/submissions/{submission_id}/files/{token}` | MEDIUM |
| G7.14 | Feedback template list | backend support API | `GET /api/feedback/templates` | MEDIUM |
| G7.15 | Lesson pack generation endpoint | backend support API | `POST /api/lesson-packs/generate/{course_id}` | MEDIUM |
| G7.16 | Chat session detail endpoint | backend support API | `GET /api/qa/sessions/{session_id}` | MEDIUM |
| G7.17 | Toggle collected question endpoint | backend support API | `POST /api/qa/questions/{question_id}/collect` | MEDIUM |
| G7.18 | Assign question to folder endpoint | backend support API | `PUT /api/qa/questions/{question_id}/folder` | MEDIUM |
| G7.19 | Delete question endpoint | backend support API | `DELETE /api/qa/questions/{question_id}` | MEDIUM |
| G7.20 | Material request state transition endpoint | backend support API | `POST /api/materials/requests/{request_id}/handle` | MEDIUM |
| G7.21 | Assignment confirm endpoint | backend support API | `POST /api/assignments/{assignment_id}/confirm` | MEDIUM |
| G7.22 | Assignment submit endpoint | backend support API | `POST /api/assignments/{assignment_id}/submit` | MEDIUM |
| G7.23 | Teacher assignment detail endpoint | backend support API | `GET /api/assignments/teacher/{assignment_id}` | MEDIUM |
| G7.24 | Feedback submission endpoint | backend support API | `POST /api/feedback/instances/{survey_instance_id}/submit` | MEDIUM |
| G7.25 | Feedback skip endpoint | backend support API | `POST /api/feedback/instances/{survey_instance_id}/skip` | MEDIUM |
| G7.26 | Feedback analytics endpoint | backend support API | `GET /api/feedback/analytics/{survey_instance_id}` | MEDIUM |

## H. Async Task Center

### H1. Generic Background Task Flow (`/api/task-jobs`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| H1.1 | Create lesson-pack generation task | page auto-submit | `POST /api/task-jobs/lesson-pack-generate/{course_id}` | CRITICAL |
| H1.2 | Create material-update preview task | button | `POST /api/task-jobs/material-update/preview` | CRITICAL |
| H1.3 | Create material-update upload task | button | `POST /api/task-jobs/material-update/upload` | HIGH |
| H1.4 | Query single task state | polling | `GET /api/task-jobs/{job_id}` | CRITICAL |
| H1.5 | List current user task history | page support / debug | `GET /api/task-jobs` | MEDIUM |
| H1.6 | Mark stale queued/running jobs as failed after restart | app startup recovery | `TaskJobService.recover_incomplete_jobs()` | HIGH |

---

## Audit Note

This document is maintained as a code-grounded inventory. If a route, page, or meaningful interaction exists in the repository, it must be represented here either as a user-facing feature, a live-share/discussion capability, or a compatibility/support API.
