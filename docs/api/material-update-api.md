# 材料更新 API

## 1. POST `/api/material-update/preview`
不上传文件，直接传入材料正文和更新说明，生成更新建议。

### 请求字段
- `course_id`
- `title`
- `instructions`
- `material_text`
- `selected_model`

### 返回字段
- `summary`
- `update_suggestions`
- `draft_pages`
- `image_suggestions`
- `selected_model`
- `used_model_name`
- `model_status`

说明：
- `selected_model` 会真实传入后端模型路由
- 若模型不可用，`model_status` 会返回 `failed`
- 当前版本不会把失败伪装成已成功生成

## 2. POST `/api/material-update/upload`
上传文件并生成更新建议。

### 表单字段
- `course_id`
- `title`
- `instructions`
- `selected_model`
- `file`

### 当前文件处理边界
- 优先解析：txt、md、docx、pptx
- 保存并留待教师查看：pdf、doc、ppt 等部分格式

## 3. GET `/api/material-update`
获取教师当前账号下的材料更新历史。

返回中会保留：
- 当次选择 / 实际使用模型
- 模型调用状态
- 结果摘要与结构化建议
