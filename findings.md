# Findings

## 2026-04-10

### 环境与代理
- GitHub 外网访问可用，但必须通过交互式 shell 执行 `clash` 和 `proxy`。
- 已验证命令链路：
  - `bash -ic 'clash && proxy && curl -I https://github.com'`
  - `bash -ic 'clash && proxy && git ls-remote https://github.com/wishmyself/hit-agent.git HEAD'`
- Clash 当前配置文件路径为 `/home/hxfeng/clash/config.yaml`。
- Clash 当前端口：
  - HTTP: `18990`
  - SOCKS: `18991`

### Conda
- 新环境已创建：`/home/hxfeng/miniconda3/envs/fhx-hit-agent`
- 由于 `~/.bashrc` 中的 conda 初始化路径失效，当前可靠激活方式为：
  - `eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)" && conda activate fhx-hit-agent`

### 仓库结构
- 仓库已克隆到：`/home/hxfeng/fhx-hit-agent`
- 当前分支：`main`
- 当前 remote：
  - `origin` = `https://github.com/fhx020826/hit-agent.git`
  - `upstream` = `https://github.com/wishmyself/hit-agent.git`
- 最近提交：
  - `d266c78 完善页面工作流`
  - `1c4de4f 增加RAG检索功能，测试完善教师端和学生端各界面功能`
  - `9c15cfc chore: snapshot current project before RAG integration`
- 顶层核心目录：
  - `backend/`
  - `frontend/`
  - `docs/`
  - `claude_code_docs/`

### 技术栈
- 后端：
  - FastAPI
  - SQLAlchemy
  - SQLite
  - `httpx`
  - `pypdf`
- 前端：
  - Next.js 16
  - React 19
  - TypeScript
  - `react-markdown`
  - `remark-math`
  - `rehype-katex`

### 代码现状
- 后端已形成模块化路由，覆盖：
  - 认证
  - 课程
  - 问答
  - 讨论
  - 作业
  - 资料
  - 反馈
  - 管理员
  - AI 配置
  - RAG / embedding / LLM 服务
- 前端已形成教师端、学生端、管理员端页面骨架与主要功能页。
- README 与 `docs/` 对当前已实现能力描述较完整，且明显在强调“与真实实现一致”。

### 当前风险
- 当前仓库未发现自动化测试目录、`pytest` 配置或前端测试配置。
- 后端使用 SQLite，本地开发方便，但在并发、迁移、可维护性方面存在上限。
- 数据模型集中定义在 `backend/app/database.py`，规模继续扩大后可维护性会下降。
- `origin` 原仓库默认分支此前为 `master`，当前已额外推送出 `main` 分支；团队协作时需要统一使用 `main`。

### 2026-04-10 运行验证补充
- 后端验证通过：
  - `uvicorn app.main:app --host 127.0.0.1 --port 8000` 可正常启动
  - `curl http://127.0.0.1:8000/api/health` 返回 `{"status":"ok","version":"0.8.0"}`
- 前端构建验证通过：
  - `npm run build` 成功
- 前端 lint 未通过，当前存在 4 个错误和 4 个警告，主要集中在：
  - `react-hooks/set-state-in-effect`
  - `react-hooks/exhaustive-deps`
  - `@next/next/no-img-element`
- 前端依赖安装结论：
  - 使用 `npmmirror` 时曾出现 `next@16.2.2 invalid`、`.bin` 缺失、`next: not found`
  - 改用官方 npm registry 后，依赖安装与构建恢复正常
- 一键启动验证通过：
  - `bash scripts/dev-up.sh` 可成功拉起前后端
  - `bash scripts/dev-status.sh` 可看到 `3000/8000` 均在监听
  - `curl http://127.0.0.1:8000/api/health` 正常
  - `curl -I http://127.0.0.1:3000` 返回 `HTTP/1.1 200 OK`

### 2026-04-10 前端实现问题修复
- 已修复前端原有的 `lint error`，主要包括：
  - `AdminUsersPage` 中 effect 内直接触发带状态更新的加载函数
  - `AppShell` 中依赖路由变化时直接在 effect 中同步 `setState`
  - `AvatarBadge` 中依赖 `useEffect` 重置图片失败状态
  - `LanguageProvider` 中依赖 `useEffect` 从本地缓存同步语言状态
- 修复后验证结果：
  - `npm run lint`：0 error，3 warning
  - `npm run build`：成功
- 当前剩余 warning：
  - `frontend/src/app/teacher/materials/page.tsx` 中 `useEffect` 依赖项 warning
  - `frontend/src/components/avatar-badge.tsx` 中 `<img>` 优化 warning

### 2026-04-10 后端最小测试闭环
- 新增测试文件：
  - `backend/tests/conftest.py`
  - `backend/tests/test_smoke_api.py`
- 新增测试依赖文件：
  - `backend/requirements-dev.txt`
- 当前覆盖的最小链路：
  - 健康检查
  - 学生注册 + 读取个人信息
  - 教师登录 + 创建课程 + 列课程
  - 学生登录 + 创建问答会话 + 查询会话详情
- 验证命令：
  - `cd backend && pytest -q`
- 当前结果：
  - `4 passed, 2 warnings`
- 当前 warning 来源：
  - FastAPI `@app.on_event("startup")` 的弃用提示

### 2026-04-11 内部功能测试基线
- 已新增内部文档：
  - `docs/internal/internal-feature-test-matrix.md`
- 该文档已基于真实代码与现有说明文档梳理当前实现功能，覆盖：
  - 认证与账号体系
  - 个人资料与外观设置
  - 管理员用户管理
  - 课程与课程包
  - AI 助教配置
  - 学生问答、多轮会话与教师协同
  - 薄弱点分析
  - 课程讨论空间
  - 教学资料库与课堂同步展示
  - PPT / 教案更新
  - 作业闭环与 AI 辅助反馈
  - 匿名课堂反馈与教学分析
- 文档已明确区分：
  - 已实现功能
  - 已知边界
  - 人工测试点
  - 自动化优先级（P0 / P1 / P2）
- 当前建议后续测试工作直接以该文档为基线继续推进，避免遗漏页面入口或把规划能力误判为已实现能力。

### 2026-04-11 测试基线扩展
- `backend/tests/conftest.py` 中的默认问卷模板种子原先使用了错误字段 `questions`。
- 实际数据库模型字段为：
  - `DBSurveyTemplate.questions_json`
- 修正后，反馈实例与统计测试可以在测试库中稳定执行。
- 已新增文件：
  - `backend/tests/test_full_api_smoke.py`
- 当前后端测试结果：
  - `9 passed, 2 warnings in 55.15s`
- 本轮新增覆盖的 API 模块包括：
  - `profile`
  - `settings`
  - `agent-config`
  - `lesson-packs`
  - `admin`
  - `materials`
  - `discussions`
  - `assignments`
  - `feedback`
  - `student`
  - `users`
  - `assignment-review`
  - `material-update`
- 当前 pytest 唯一剩余 warning 仍是：
  - FastAPI `@app.on_event("startup")` 弃用提示

### 2026-04-11 在线服务验证
- 后端在线健康检查仍正常：
  - `GET /api/health -> {"status":"ok","version":"0.8.0"}`
- 前端以下路径当前均返回 `HTTP 200`：
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
- 本机 Playwright MCP 当前不能做真实浏览器交互。
- 直接报错原因：
  - `chrome executable not found`
- 因此本轮前端只完成了“页面可达性检查”，未完成 DOM 级 UI 自动化。

### 2026-04-11 在线真实教师/学生时序链路
- 已直接对运行中的 `http://127.0.0.1:8000` 执行真实 API 流程，不依赖测试数据库。
- 本轮临时账号：
  - 教师：`teacher_e2e_20260411190348614820`
  - 学生：`student_e2e_20260411190348614820`
- 已成功完成：
  - 教师注册
  - 学生注册
  - 课程创建
  - 课程包生成与发布
  - 学生创建问答会话并提问
  - 教师发布作业
  - 学生确认与提交作业
  - 教师创建匿名反馈实例
  - 学生提交匿名反馈
  - 学生发起资料请求
  - 教师查看通知与作业详情
  - 教师查看反馈统计
- 本轮在线真实链路产生的关键实体：
  - `course-df829eee`
  - `lp-d76851df`
  - `chat-d4fbee6e`
  - `q-01eeed07`
  - `asg-15cdce5b`
  - `sub-e70264fd`
  - `survey-99ce6195`
  - `req-57da28c5`
- 关键结果：
  - 教师通知数：`1`
  - 教师视角已提交学生数：`1`
  - 反馈参与人数：`1`
