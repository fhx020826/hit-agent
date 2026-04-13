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
  - 当前完整保留版本为：
    - `docs/internal/complete-feature-list.md`
    - `docs/internal/complete-feature-verification-matrix.md`
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

### 2026-04-12 统一验证入口与复杂旅程回归
- 新增统一验证脚本：
  - `scripts/verify-all.sh`
- 新增复杂浏览器旅程回归：
  - `frontend/tests/user-journeys.spec.ts`
- 新增自动化测试目录文档：
  - `docs/internal/automation-test-catalog.md`
- 一键全量验证已通过：
  - `bash scripts/verify-all.sh`
  - 结果：
    - `pytest -q` -> `13 passed`
    - `npm run lint` -> 通过
    - `npm run build` -> 通过
    - `npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts tests/user-journeys.spec.ts` -> `10 passed`

### 2026-04-12 验证脚本中暴露并修复的真实问题
- 初版 `verify-all.sh` 默认使用 `3100/8100` 作为独立验证端口，但 HPC 上历史进程占用了 `3100`。
- 修复方式：
  - 脚本改为自动向上寻找空闲端口，而不是直接失败。
- 初版 `verify-all.sh` 拉起后端时没有同步注入 `FRONTEND_PORT`。
- 影响：
  - 后端 CORS 仍只按默认 `3000` 放行，导致独立端口前端在真实浏览器里注册/登录请求被浏览器拦截，表现为 `Failed to fetch`。
- 修复方式：
  - 启动 `uvicorn` 时显式传入 `FRONTEND_PORT=<selected frontend port>`。
- 结论：
  - 当前一键验证链路已能在独立端口环境下稳定完成真实浏览器全量回归。

### 2026-04-12 第三轮路由深拆
- `backend/app/routes/materials.py` 原先同时承担：
  - 资料展示序列化
  - 资料请求处理
  - 课堂直播共享
  - 批注版本保存
- 本轮已下沉到：
  - `backend/app/services/materials_service.py`
- `backend/app/routes/discussion.py` 原先同时承担：
  - 成员校验
  - 空间详情拼装
  - 消息序列化
  - AI 跟帖生成
  - 搜索 / 上下文回溯
- 本轮已下沉到：
  - `backend/app/services/discussion_service.py`
- 大文件收缩结果：
  - `materials.py`: `470 -> 193`
  - `discussion.py`: `388 -> 104`
- 验证结果：
  - `pytest -q` -> `13 passed`
  - `bash scripts/verify-all.sh` -> 通过

### 2026-04-12 日志清理
- 已清理旧验证日志目录内容：
  - `/tmp/hit-agent-verify/*`
- 当前只保留这轮最新回归重新生成的日志批次。
  - `/tmp/hit-agent-verify/20260412-212334`
- 最新一轮统一验证结果：
  - `pytest -q` -> `13 passed`
  - `bash scripts/verify-all.sh` -> 通过
  - Playwright 三组浏览器回归 -> `10 passed`
- 关键结果：
  - 教师通知数：`1`
  - 教师视角已提交学生数：`1`
  - 反馈参与人数：`1`

## 2026-04-12 重构与验证补充

### 后端 warning
- FastAPI 的 `@app.on_event("startup")` 已替换为 lifespan。
- 最新结果：
  - `cd backend && pytest -q`
  - `13 passed`
  - 当前不再有 pytest warning

### 前端 warning 与稳定验证面
- `npm run lint` 已无 warning / error。
- `npm run build` 通过。
- `next dev` 下的工作区 warning 已通过：
  - `next dev --webpack`
  - `outputFileTracingRoot`
 处理掉。
- 结论：
  - 当前 HPC 上浏览器自动化可用；
  - 但稳定的 Playwright 证据面优先使用生产模式前端，而不是 Next 开发服务器。

### 真实浏览器回归
- 最新浏览器回归命令：
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts`
- 最新结果：
  - `8 passed`
- 本轮对测试本身做了稳定性修正：
  - 认证入口等待
  - logout 确认 token 已清空
  - 登录 helper 显式等待 token 与角色跳转
  - 宽泛文本选择器改为稳定 role selector

### 真实前端问题
- `frontend/src/components/auth-modal.tsx` 成功登录/注册后存在组件关闭边界下继续 `setState` 的浏览器 warning。
- 已修复为：
  - 成功路径只关闭 modal 并跳转
  - 不再在成功后的卸载边界继续更新本地状态

### 后端解耦状态
- 已完成：
  - `backend/app/db/*`
  - `backend/app/services/llm_runtime.py`
  - `backend/app/services/file_extractors.py`
  - `backend/app/services/llm_generation.py`
  - `backend/app/services/materials_service.py`
  - `backend/app/services/qa_service.py`
- 仍偏大的文件：
  - `backend/app/models/schemas.py`
  - `backend/app/routes/qa.py`
  - `backend/app/routes/materials.py`
  - `backend/app/routes/discussion.py`

### 仓库清理结论
- `frontend/test-results/` 属于纯运行产物，不应提交。
- `backend/.pytest_cache` 也应视为本地产物。
- 当前已把这些路径加入 `.gitignore`。

## 2026-04-12 第二轮深度拆分补充

### 后端模块化
- `backend/app/models/schemas.py` 已完成按领域拆分，并以 facade 保持原导入兼容。
- `backend/app/db/models.py` 已完成按领域拆分，并以 facade 保持原导入兼容。
- `backend/app/routes/qa.py` 中的序列化与 presenter helper 已下沉到 `backend/app/services/qa_service.py`。
- 当前后端最大剩余结构热点主要集中在：
  - `backend/app/routes/materials.py`
  - `backend/app/routes/discussion.py`

### 前端稳定性
- 在 `frontend/src/lib/api.ts` 为请求层增加了超时保护。
- 该修正的目标不是改变业务行为，而是避免鉴权初始化或文件请求在异常情况下长时间悬挂，拖住页面状态切换。

### 最新全量验证
- 在最新代码版本上重新启动服务后执行：
  - `cd backend && pytest -q`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts`
- 最新结果：
  - 后端：`13 passed`
  - 前端 lint：通过
  - 前端 build：通过
  - 浏览器：`8 passed`

### 2026-04-12 ECS SSH 连通性
- 已验证新购 ECS 可通过公网 SSH 登录：
  - 公网 IP：`8.152.202.171`
  - 用户：`root`
  - 命令：
    - `ssh -tt -o StrictHostKeyChecking=accept-new root@8.152.202.171 'whoami && hostname && uname -a'`
- 返回结果：
  - `root`
  - `iZ2ze8uopnpciyc63go6d6Z`
  - `Linux ... Ubuntu ...`
- 已新增连接说明文档：
  - `docs/internal/ecs-server-connection-guide.md`
- 安全要求：
  - 不在仓库中记录密码
  - 后续优先切换为 SSH 密钥和独立部署用户

### 2026-04-13 ECS 代理与 Codex 打通
- 远端 ECS 已完成基础运维面初始化：
  - `root` 密码已重置
  - SSH 公钥免密登录已生效
  - 常用工具已安装完成
- 远端 Clash 与本机同目录结构已同步至：
  - `/root/clash`
- 远端当前可靠代理命令：
  - `clash`
  - `proxy`
  - `unproxy`
- 已验证远端在代理开启后可访问 GitHub。
- 直接链路验证结果：
  - 不走代理时，远端 `codex exec` 访问 `https://chatgpt.com/backend-api/wham/apps` 会超时
- 代理链路验证结果：
  - 仅同步 `auth.json` 时，远端 Codex 仍无法稳定完成对话
- 最终定位到的关键差异：
  - 本机 `.codex` 中存在远端最初缺失的 `cap_sid`
- 补齐后恢复结果：
  - 把本机 `~/.codex/cap_sid` 同步到远端后，远端 `codex exec` 已可正常返回 `OK`
- 额外环境结论：
  - 本机 `/home/hxfeng/clash/clash` 的 external-controller 因 `9090` 端口已被其他进程占用而未成功绑定
  - 但这不影响本机 `18990/18991/18993` 代理本身工作
  - 远端 ECS 的 Clash external-controller `9090` 可正常使用，便于后续远端代理调试
- 当前远端 Codex 基线：
  - `codex-cli 0.120.0`
  - `bubblewrap` 已安装
  - 远端直接执行 `codex exec --skip-git-repo-check -C /root "Reply with OK and nothing else."` 成功

### 服务面
- 最新验证所依赖的在线服务是本轮代码重启后的新进程：
  - 前端生产模式：`http://127.0.0.1:3000`
  - 后端：`http://127.0.0.1:8000`
- 健康检查：
  - `GET /api/health -> {"status":"ok","version":"0.8.0"}`
