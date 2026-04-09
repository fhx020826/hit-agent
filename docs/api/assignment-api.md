# 作业 API

## 教师端
- `POST /api/assignments`：发布作业
- `GET /api/assignments/teacher`：获取教师自己发布的作业
- `GET /api/assignments/teacher/{assignment_id}`：查看作业跟踪明细

## 学生端
- `GET /api/assignments/student`：查看学生可见作业
- `POST /api/assignments/{assignment_id}/confirm`：确认收到作业
- `POST /api/assignments/{assignment_id}/submit`：上传作业文件

## 文件下载
- `GET /api/assignments/submissions/{submission_id}/files/{token}`

### 权限规则
- 学生仅能访问自己的提交文件
- 教师仅能访问自己发布作业对应的学生提交文件
