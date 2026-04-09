# 设置 API

## GET `/api/settings/me`
读取当前登录用户的外观设置。

## PUT `/api/settings/me`
保存当前登录用户的外观设置。

### 请求字段
- `mode`
- `accent`
- `font`
- `skin`

## 兼容接口
- `GET /api/settings/{user_role}/{user_id}`
- `PUT /api/settings/{user_role}/{user_id}`

说明：新前端应优先使用 `/me` 接口，兼容接口仅保留给旧流程或迁移阶段使用。
