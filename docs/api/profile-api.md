# 个人资料 API

## GET `/api/profile/me`
读取当前账号资料。

## PUT `/api/profile/me`
更新当前账号资料。

### 主要字段
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
- `email`
- `phone`
- `bio`
- `research_direction`
- `interests`
- `common_courses`
- `linked_classes`

## GET `/api/profile/students`
教师查看学生资料摘要列表。

## GET `/api/profile/teachers`
教师查看教师资料摘要列表。
