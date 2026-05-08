# 数据结构总览

## 统一账号相关
### `users`
- `id`
- `role`
- `account`
- `password_hash`
- `display_name`
- `status`
- `created_at`

### `user_profiles`
- `user_id`
- `real_name`
- `gender`
- `college`
- `major`
- `grade`
- `class_name`
- `student_no`
- `teacher_no`
- `department`
- `teaching_group`
- `role_title`
- `birth_date`
- `avatar_path`
- `bio`
- `research_direction`
- `interests`
- `common_courses_json`
- `linked_classes_json`
- `updated_at`

### `session_tokens`
保存 Bearer Token 会话。

## 外观设置
### `appearance_settings`
- `user_role`
- `user_id`
- `mode`
- `accent`
- `font`
- `skin`
- `language`
- `updated_at`

## 课程与讨论空间
### `courses`
- `id`
- `name`
- `code`（兼容部分旧页面时可为空）
- `class_name`
- `owner_user_id`

说明：
- `courses` 仍保留为课程内容、课程包、资料、问答、作业等旧功能的兼容载体
- 当前主关系判断不再只依赖 `class_name`，而是优先依赖教务模拟出来的结构化关系表

### `course_classes`
- `id`
- `course_id`
- `class_name`
- `discussion_space_id`

说明：
- `course_classes` 暂时保留用于兼容旧页面与旧演示数据
- 新主线不再要求教师手工绑定班级

### `school_classes`
- `id`
- `name`
- `college`
- `major`
- `grade`
- `year`
- `status`
- `created_at`
- `updated_at`

### `academic_courses`
- `id`
- `name`
- `code`
- `description`
- `credit`
- `department`
- `status`
- `created_at`
- `updated_at`

### `course_offerings`
- `id`
- `academic_course_id`
- `course_id`
- `teacher_user_id`
- `class_id`
- `semester`
- `invite_code`
- `join_enabled`
- `discussion_space_id`
- `status`
- `created_at`
- `updated_at`

说明：
- `course_offerings` 表示一次具体开课关系，即“某教师在某学期负责某门课，并面向某个教学班授课”
- 当前权限判断、学生课程列表、教师授课列表、讨论空间成员同步等都以该表为主

### `course_enrollments`
- `id`
- `offering_id`
- `student_user_id`
- `class_id`
- `source`
- `status`
- `joined_at`
- `created_at`

说明：
- `source` 当前常见值为 `simulated_selection`、`admin_seed`
- 学生是否能看到作业、讨论、资料、反馈与课程 AI 助教，优先以该表为准

### `discussion_spaces`
- `id`
- `course_id`
- `offering_id`
- `class_name`
- `space_name`
- `ai_assistant_enabled`
- `created_at`

### `discussion_space_members`
- `space_id`
- `user_id`
- `role_in_space`
- `joined_at`

### `discussion_messages`
- `space_id`
- `sender_user_id`
- `sender_type`
- `is_anonymous`
- `message_type`
- `content`
- `reply_to_message_id`
- `ai_sources_json`
- `created_at`

索引：
- `space_id`
- `sender_user_id`
- `created_at`

### `discussion_message_attachments`
- `message_id`
- `file_name`
- `file_type`
- `file_size`
- `file_path`
- `parse_status`
- `parse_summary`

### `ai_discussion_context_logs`
- `space_id`
- `trigger_message_id`
- `used_context_range`
- `model_name`
- `response_summary`
- `created_at`

## 课程问答
### `chat_sessions`
- `id`
- `user_id`
- `course_id`
- `offering_id`
- `lesson_pack_id`
- `title`
- `selected_model`
- `created_at`
- `updated_at`

### `questions`
- `id`
- `session_id`
- `user_id`
- `course_id`
- `offering_id`
- `lesson_pack_id`
- `question_text`
- `answer_target_type`
- `selected_model`
- `is_anonymous`
- `status`
- `teacher_reply_status`
- `ai_answer_content`
- `ai_answer_time`
- `ai_answer_sources`
- `teacher_answer_content`
- `teacher_answer_time`
- `has_attachments`
- `attachment_count`
- `input_mode`
- `collected`
- `title`
- `note`
- `parent_folder_id`
- `created_at`
- `updated_at`

说明：
- `parent_folder_id` 用于把问答记录放入任意层级文件夹
- `folder_id` 继续保留为兼容字段，当前与 `parent_folder_id` 同步维护

### `question_folders`
- `id`
- `user_id`
- `course_id`
- `parent_folder_id`
- `name`
- `description`
- `created_at`
- `updated_at`

说明：
- 通过 `parent_folder_id` 表示多级嵌套
- 文件夹自身重命名，以及子文件夹/记事簿/问答记录变更时，都会同步刷新祖先目录 `updated_at`

### `learning_notebooks`
- `id`
- `user_id`
- `course_id`
- `parent_folder_id`
- `title`
- `content_text`
- `is_starred`
- `created_at`
- `updated_at`

### `learning_notebook_images`
- `id`
- `notebook_id`
- `uploader_user_id`
- `file_name`
- `file_path`
- `file_type`
- `file_size`
- `created_at`

### `question_attachments`
- `id`
- `question_id`
- `uploader_user_id`
- `file_name`
- `file_type`
- `file_size`
- `file_path`
- `parse_status`
- `parse_summary`
- `created_at`

### `teacher_notifications`
- `id`
- `teacher_id`
- `message_type`
- `related_question_id`
- `title`
- `content`
- `is_read`
- `created_at`

### `weakness_analyses`
- `id`
- `user_id`
- `course_id`
- `summary`
- `weak_points_json`
- `suggestions_json`
- `updated_at`

## 作业流程
### `assignments`
- `offering_id`
### `assignment_receipts`
### `assignment_submissions`
### `assignment_feedback`

## 匿名反馈
### `survey_templates`
### `survey_instances`
- `offering_id`
### `survey_responses`

## 材料更新
### `material_update_jobs`
保存教师发起的材料更新生成结果。

## 教学资料共享与实时批注
### `materials`
- `offering_id`
- `share_scope`
- `allow_student_view`
- `allow_classroom_share`
- `allow_request`
- `class_name`
- `has_saved_annotation`

### `material_share_records`
- `material_id`
- `course_id`
- `shared_by_teacher_id`
- `share_target_type`
- `share_target_id`
- `is_active`
- `current_page`
- `started_at`
- `ended_at`

### `material_requests`
- `material_id`
- `course_id`
- `offering_id`
- `class_name`
- `student_id`
- `request_text`
- `status`
- `handled_at`
- `handled_by`

### `material_annotations`
- `material_id`
- `share_record_id`
- `page_no`
- `tool_type`
- `color`
- `line_width`
- `points_data`
- `is_temporary`
- `expires_at`
- `created_by`

### `saved_annotation_versions`
- `material_id`
- `share_record_id`
- `saved_by`
- `version_name`
- `save_mode`
- `annotation_ids_json`

## 教务模拟关系说明
- 管理员端 `/admin/academic` 负责查看和维护演示教务数据
- 教师端 `/teacher/course-management` 读取 `course_offerings` 展示“我的授课课程”
- 学生端 `/student/courses` 读取 `course_enrollments + course_offerings` 展示“我的课程”
- AI 助教、提问、作业、反馈、讨论空间、资料共享等闭环功能都应优先以 `offering_id` 约束范围
- 旧 `courses / course_classes / class_name` 逻辑仍保留兼容，但不应再作为唯一权限依据
