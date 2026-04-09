# 问答 API

## 1. 模型与附件
### GET `/api/qa/models`
获取当前已接入的大模型清单。

返回字段包括：
- `key`
- `label`
- `provider`
- `model_name`
- `supports_vision`
- `is_default`
- `description`
- `availability_note`

说明：
- 接口只返回当前后端真正可调用的模型
- 若某类模型尚未配置 API Key，不会伪装成可用

### POST `/api/qa/attachments`
上传问题附件。

当前支持：
- 图片：jpg / jpeg / png / webp
- 文档：txt / md / pdf / doc / docx / ppt / pptx
- 压缩包：zip / rar

## 2. 会话
### POST `/api/qa/sessions`
创建新问答会话。

请求重点字段：
- `course_id`
- `lesson_pack_id`
- `title`
- `selected_model`

### GET `/api/qa/sessions`
获取当前学生的会话列表。

### GET `/api/qa/sessions/{session_id}`
获取会话详情与问题列表。

## 3. 学生提问
### POST `/api/qa/ask`
学生提问接口。

### 请求字段
- `session_id`
- `course_id`
- `lesson_pack_id`
- `question`
- `answer_target_type`: `ai` / `teacher` / `both`
- `anonymous`: 是否匿名发言
- `selected_model`: 当前页面选择的模型键值
- `attachment_ids`

### 实际处理逻辑
1. 读取 `selected_model`
2. 整理课程资料、会话历史和可解析附件内容
3. 当 `answer_target_type` 为 `ai` 或 `both` 时，调用真实模型服务
4. 记录实际使用模型与来源信息
5. 若 `answer_target_type` 为 `teacher` 或 `both`，同步推送教师待处理消息

### 返回重点字段
- `ai_answer_content`
- `ai_answer_sources`
- `teacher_answer_content`
- `teacher_reply_status`
- `attachment_items`
- `has_attachments`
- `attachment_count`
- `selected_model`

说明：
- `ai_answer_sources` 中会附带本次实际使用模型、提供方、调用状态与耗时
- 若模型调用失败，会返回明确错误说明，不再静默回退为模板回答

## 4. 学生历史记录
- `GET /api/qa/history`
- `POST /api/qa/questions/{question_id}/collect`
- `GET /api/qa/weakness-analysis`

## 5. 教师端问题处理
### GET `/api/qa/teacher/questions`
支持按状态、课程等条件筛选教师待处理问题。

### POST `/api/qa/teacher/questions/{question_id}/reply`
教师提交回复内容并更新状态。

### GET `/api/qa/teacher/notifications`
获取教师未读问题提醒。

### POST `/api/qa/teacher/notifications/{notification_id}/read`
将指定提醒标记为已读。

## 6. 附件访问鉴权
### GET `/api/qa/attachments/{attachment_id}/download`
- 学生只能访问自己上传的问题附件
- 教师只能访问可见问题对应的附件
- 无权限时直接拒绝访问

## 7. 典型错误
### 模型未配置
- `当前环境尚未配置可用的大模型服务，请先配置 API Key 与模型参数。`

### 模型调用失败
- `当前模型服务暂时不可用。`
- 响应来源区会附带耗时与失败说明

### 选中模型不可用
- 后端会明确记录 fallback 或失败信息
- 前端应提示用户切换到其他已接入模型
