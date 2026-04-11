# 内部测试结果记录（2026-04-11）

> 测试范围：后端 P0/P1 主模块 API 冒烟、前端关键页面可达性、在线服务真实教师/学生时序链路  
> 测试环境：`/home/hxfeng/fhx-hit-agent`、本地前端 `http://127.0.0.1:3000`、本地后端 `http://127.0.0.1:8000`

## 1. 自动化测试结果

### 1.1 后端 pytest

- 命令：
  - `cd backend && eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)" && conda activate fhx-hit-agent && pytest -q`
- 结果：
  - `9 passed, 2 warnings in 55.15s`

### 1.2 本轮新增覆盖

- 修正测试种子数据：
  - `backend/tests/conftest.py`
  - 将默认问卷模板字段从 `questions` 修正为真实模型字段 `questions_json`
- 新增全模块 API 冒烟测试：
  - `backend/tests/test_full_api_smoke.py`

### 1.3 已覆盖的真实模块

- 教师资料与设置
- AI 助教配置
- 课程包读取、更新、发布
- 管理员用户管理
- 资料上传、共享、资料请求
- 讨论空间与消息检索
- 作业发布、确认、提交、教师查看
- 匿名反馈模板、实例、提交、统计
- 旧接口 `/api/student/*`
- 旧接口 `/api/users/*`
- 预览型接口：
  - `/api/assignment-review/preview`
  - `/api/material-update/preview`

## 2. 前端在线可达性检查

### 2.1 首页与关键页面

以下页面均返回 `HTTP 200`：

- `/`
- `/teacher`
- `/student`
- `/admin/users`
- `/profile`
- `/settings`
- `/teacher/course`
- `/teacher/lesson-pack`
- `/teacher/materials`
- `/teacher/discussions`
- `/teacher/assignments`
- `/student/qa`
- `/student/assignments`

### 2.2 当前限制

- 当前 Playwright MCP 无法进行真实浏览器交互。
- 原因：
  - 本机缺少 `chrome` 可执行文件
- 影响：
  - 本轮只能完成页面可达性检查，不能完成 DOM 级 UI 自动化与真实点击流录制。

## 3. 在线服务真实时序链路

### 3.1 测试方式

- 直接调用运行中的后端服务 `http://127.0.0.1:8000`
- 使用临时教师/学生账号完成从注册到教学闭环的真实链路

### 3.2 本轮跑通的顺序

1. 教师注册
2. 学生注册
3. 教师创建课程
4. 教师生成并发布课程包
5. 学生创建问答会话
6. 学生发起课程问答
7. 教师发布作业
8. 学生确认作业
9. 学生提交作业
10. 教师创建匿名反馈实例
11. 学生提交匿名反馈
12. 学生发起资料请求
13. 教师查看通知
14. 教师查看作业提交明细
15. 教师查看反馈统计

### 3.3 本轮实际产物

- 教师账号：
  - `teacher_e2e_20260411190348614820`
- 学生账号：
  - `student_e2e_20260411190348614820`
- 课程：
  - `course-df829eee`
- 课程包：
  - `lp-d76851df`
- 问答会话：
  - `chat-d4fbee6e`
- 提问记录：
  - `q-01eeed07`
- 作业：
  - `asg-15cdce5b`
- 提交：
  - `sub-e70264fd`
- 反馈实例：
  - `survey-99ce6195`
- 资料请求：
  - `req-57da28c5`

### 3.4 关键断言结果

- 教师通知数：
  - `1`
- 教师视角已提交学生数：
  - `1`
- 反馈参与人数：
  - `1`

## 4. 当前结论

- 后端测试基线已从最小 4 条冒烟扩展到 9 条稳定通过。
- 测试种子数据已经能够支撑问卷、课程包、管理员等主模块验证。
- 在线服务上的真实教师/学生时序链路已完整跑通，不是仅测试库通过。
- 前端当前至少在页面可达性层面稳定在线。
- 下一步若要继续推进前端自动化，应先补齐浏览器运行依赖，再做真实角色 UI 回归。
