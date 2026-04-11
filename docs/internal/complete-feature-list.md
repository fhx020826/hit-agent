# HIT-Agent Complete Feature List

Auto-generated 2026-04-11. Every implemented feature, organized by role and page.

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

### D2. Course Creation (`/teacher/course`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D2.1 | Create course with full form | form submit | `POST /api/courses` | CRITICAL |
| D2.2 | Redirect to lesson pack generation | auto redirect | n/a | HIGH |

### D3. Lesson Pack (`/teacher/lesson-pack`)

| # | Feature | Interaction | API | Test Priority |
|---|---------|-------------|-----|---------------|
| D3.1 | Generate lesson pack | auto on page load | `POST /api/lesson-packs/{course_id}/generate` | CRITICAL |
| D3.2 | View generated content (objectives, outline, etc.) | display | n/a | HIGH |
| D3.3 | Publish lesson pack | button | `POST /api/lesson-packs/{lp_id}/publish` | CRITICAL |
| D3.4 | View lesson pack detail | link | `GET /api/lesson-packs/{lp_id}` | HIGH |

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
| D6.6 | Generate update preview (text-only) | button | `POST /api/material-update/preview` | CRITICAL |
| D6.7 | Generate update with file upload | button | `POST /api/material-update/upload` | HIGH |
| D6.8 | View update result (summary, suggestions, draft pages) | display | n/a | HIGH |
| D6.9 | View update history | display list | `GET /api/material-update` | HIGH |
| D6.10 | Default/fallback mode when no model available | auto-fallback | `POST /api/material-update/preview` with "default" | HIGH |

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

---

## Summary Statistics

- **Total features: 97**
- **CRITICAL priority: 27**
- **HIGH priority: 56**
- **MEDIUM priority: 14**
