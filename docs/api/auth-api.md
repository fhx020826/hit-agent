# 认证 API

## POST `/api/auth/register`
统一注册接口。

### 请求字段
- `role`: `teacher` 或 `student`
- `account`
- `password`
- `confirm_password`
- `profile`: 用户资料对象

### 返回
- `token`
- `user`: 当前用户信息与资料

## POST `/api/auth/login`
统一登录接口。

### 请求字段
- `role`
- `account`
- `password`

### 返回
- `token`
- `user`

## GET `/api/auth/me`
读取当前登录用户信息。

## POST `/api/auth/logout`
退出登录并删除当前会话 Token。
