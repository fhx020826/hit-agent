# 反馈 API

## 模板与实例
- `GET /api/feedback/templates`
- `POST /api/feedback/instances`

## 学生端
- `GET /api/feedback/pending`
- `POST /api/feedback/instances/{survey_instance_id}/submit`
- `POST /api/feedback/instances/{survey_instance_id}/skip`

## 教师端
- `GET /api/feedback/analytics/{survey_instance_id}`

说明：当前以教师手动创建问卷实例为主，自动触发为后续扩展。
