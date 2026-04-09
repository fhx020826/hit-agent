# 讨论空间与管理员接口

## 1. 讨论空间

### `GET /api/discussions/spaces`
返回当前用户可见的讨论空间列表。

### `GET /api/discussions/spaces/{space_id}`
返回空间详情、成员列表、最近共享资料。

### `GET /api/discussions/spaces/{space_id}/messages`
分页拉取当前空间消息。

参数：
- `page`
- `page_size`

### `POST /api/discussions/attachments?space_id=...`
上传讨论空间附件。

### `POST /api/discussions/messages`
发送群聊消息。

请求体：
- `space_id`
- `content`
- `is_anonymous`
- `mention_ai`
- `attachment_ids`

返回：
- 发送成功的用户消息
- 若触发 AI，则同时返回 AI 助教消息

## 2. 聊天记录检索

### `GET /api/discussions/search`
支持参数：
- `space_id`
- `keyword`
- `sender_name`
- `sender_type`
- `message_type`
- `page`
- `page_size`

注意：
- `sender_name` 仅匹配实名公开消息
- 匿名学生消息不会通过成员姓名被反向检索

### `GET /api/discussions/spaces/{space_id}/members/{user_id}/messages`
查看指定实名成员在当前空间中的公开发言。

### `GET /api/discussions/messages/{message_id}/context`
返回某条消息附近的上下文，用于前端定位原消息。

## 3. 资料共享与课堂同步

### `POST /api/materials/live/start`
开始课堂共享展示。

### `POST /api/materials/live/{share_id}/page`
同步当前页。

### `POST /api/materials/live/{share_id}/annotations`
上传一条批注轨迹。

### `GET /api/materials/live/current?course_id=...`
获取当前课程正在进行的课堂共享。

### `GET /api/materials/live/{share_id}/annotations`
获取指定共享记录的批注轨迹。

### `POST /api/materials/live/{share_id}/end`
结束共享并指定 `save_mode`：
- `save`
- `discard`

### `GET /api/materials/live/{share_id}/versions`
获取已保存的批注版本列表。

### `WS /api/materials/live/{share_id}/ws`
实时事件流：
- `share_started`
- `page_changed`
- `annotation_created`
- `share_ended`

## 4. 管理员用户管理

### `GET /api/admin/users`
查询全站用户，支持：
- `role`
- `keyword`

### `POST /api/admin/users`
创建用户。

### `PUT /api/admin/users/{user_id}`
更新用户显示名、状态与资料。

### `DELETE /api/admin/users/{user_id}`
删除用户。

## 5. 权限
- 讨论空间接口：仅空间成员或管理员可访问
- 管理员接口：仅 `admin`
- 资料同步接口：教师发起，学生只读
