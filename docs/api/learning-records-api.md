# 学习问答记录 API

## 文件夹接口
### `GET /api/qa/folders`
- 作用：获取当前学生在指定课程下的全部文件夹
- 参数：
  - `course_id`
- 返回字段补充：
  - `parent_folder_id`
  - `depth`
  - `child_folder_count`
  - `notebook_count`
  - `question_count`
  - `total_item_count`

### `POST /api/qa/folders`
- 作用：创建根级或子级文件夹
- 请求体：
```json
{
  "course_id": "course-demo-001",
  "name": "第2章",
  "description": "HTTP/3 重点",
  "parent_folder_id": "qfolder-xxxx"
}
```

### `PUT /api/qa/folders/{folder_id}`
- 作用：重命名文件夹 / 更新说明

### `DELETE /api/qa/folders/{folder_id}`
- 作用：删除文件夹
- 查询参数：
  - `cascade=false|true`
- 说明：
  - 默认不允许删除非空文件夹
  - `cascade=true` 时级联删除子文件夹、记事簿、图片和问答记录

## 目录内容接口
### `GET /api/qa/folders/root/contents`
- 作用：获取根目录内容
- 参数：
  - `course_id`
  - `sort_by=updated_at|created_at`
  - `sort_order=desc|asc`

### `GET /api/qa/folders/{folder_id}/contents`
- 作用：获取指定文件夹下的统一内容列表
- 返回：
  - `folder`
  - `breadcrumbs`
  - `items`
  - `sort_by`
  - `sort_order`
  - `current_depth`
  - `max_depth`

### `items` 中的 `item_type`
- `folder`
- `notebook`
- `question`

## 记事簿接口
### `POST /api/qa/notebooks`
- 作用：在根目录或任意文件夹创建记事簿

### `GET /api/qa/notebooks/{notebook_id}`
- 作用：获取记事簿详情与图片列表

### `PUT /api/qa/notebooks/{notebook_id}`
- 作用：更新标题、正文、星标状态

### `DELETE /api/qa/notebooks/{notebook_id}`
- 作用：删除记事簿及其图片

### `POST /api/qa/notebooks/{notebook_id}/images`
- 作用：上传记事簿图片
- 方式：`multipart/form-data`

### `DELETE /api/qa/notebook-images/{image_id}`
- 作用：删除记事簿图片

### `GET /api/qa/notebook-images/{image_id}/download`
- 作用：下载记事簿图片

## 问答记录归档接口
### `GET /api/qa/history`
- 兼容现有历史列表查询
- 参数：
  - `course_id`
  - `folder_id`
  - `collected_only`

### `PUT /api/qa/questions/{question_id}/folder`
- 作用：将问答记录移动到任意层级文件夹
- 请求体：
```json
{
  "folder_id": "qfolder-xxxx"
}
```

## 权限
- 所有 `/api/qa/folders*`、`/api/qa/notebooks*`、`/api/qa/questions/*/folder` 接口仅学生本人可操作自己的数据
- 不支持跨用户访问目录、记事簿或图片
