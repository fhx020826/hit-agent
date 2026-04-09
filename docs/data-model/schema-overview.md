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
- `class_name`

### `course_classes`
- `id`
- `course_id`
- `class_name`
- `discussion_space_id`

### `discussion_spaces`
- `id`
- `course_id`
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
- `created_at`
- `updated_at`

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
### `assignment_receipts`
### `assignment_submissions`
### `assignment_feedback`

## 匿名反馈
### `survey_templates`
### `survey_instances`
### `survey_responses`

## 材料更新
### `material_update_jobs`
保存教师发起的材料更新生成结果。

## 教学资料共享与实时批注
### `materials`
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
