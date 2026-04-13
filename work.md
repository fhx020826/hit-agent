# Work Log

## 当前阶段
第三轮后端深度拆分已经完成，且“统一全量验证入口 + 复杂用户旅程回归 + 自动化测试目录文档 + materials/discussion 路由继续下沉”都已补齐，当前进入“保持验证门禁稳定并按需继续细化 service 子域”阶段。

## 本轮完成

### ECS 部署手册与服务器 Codex Prompt
- 已确认当前仓库最新版本关系：
  - 本地 `HEAD` = `origin/main` = `23dc5d3`
  - `upstream/main` 更旧，为 `d266c78`
- 结论：
  - 当前真实最新部署基线应以 `origin/main` 为准
- 已清理仓库内一张无关截图文件，避免后续误提交
- 已系统梳理 ECS 部署前的真实阻塞点：
  - `scripts/verify-all.sh` 写死本机 conda 路径
  - `scripts/dev-up.sh` 写死本机 conda 初始化路径
  - `frontend/playwright.config.ts` 写死本机 Chromium 路径
  - ECS 当前缺少 `conda`、`node`、`npm`
- 已新增两份部署文档：
  - `docs/internal/ecs-deployment-runbook-2026-04-13.md`
  - `docs/internal/ecs-server-codex-deploy-prompt-2026-04-13.md`
- 文档中已明确：
  - 当前服务器已完成到什么程度
  - 还缺哪些运行环境
  - 服务器 Codex 部署时必须先修哪些代码/脚本
  - 必须如何拉取最新 `origin/main`
  - 必须如何跑全量测试
  - 必须如何创建长期运行服务
  - 最终用户本地如何验收公网访问

### ECS 基础初始化、代理与 Codex 打通
- 已验证阿里云 ECS 可通过公网 SSH 连接：
  - 目标 IP：`8.152.202.171`
  - 验证用户：`root`
  - 验证命令：
    - `ssh -tt -o StrictHostKeyChecking=accept-new root@8.152.202.171 'whoami && hostname && uname -a'`
- 验证结果：
  - `whoami -> root`
  - `hostname -> iZ2ze8uopnpciyc63go6d6Z`
- 新增连接说明文档：
  - `docs/internal/ecs-server-connection-guide.md`
- 文档中只记录连接方式与账号分发原则，不落库密码等敏感凭据。
- 已完成远端 `root` 密码重置与 SSH 公钥免密接入。
- 已在远端安装基础工具：
  - `git curl wget unzip vim tmux htop rsync jq ripgrep fd-find lsof bubblewrap`
- 已把本机 Clash 目录同步到远端并配置好以下命令：
  - `clash`
  - `proxy`
  - `unproxy`
  - `clash-status`
  - `proxy-status`
- 已验证远端代理可访问 GitHub。
- 已把本机 Codex 二进制、Node 运行时与 `.codex` 配置同步到远端。
- 发现远端最初无法正常对话的真实阻塞点不是安装，而是缺少挑战会话状态文件：
  - `.codex/cap_sid`
- 补齐 `cap_sid` 后，远端以下命令已实测成功：
  - `ssh root@8.152.202.171`
  - `codex --version`
  - `codex exec --skip-git-repo-check -C /root "Reply with OK and nothing else."`
- `bubblewrap` 已安装，Codex 的沙箱 warning 已消除。

### 第三轮后端深度拆分
- 继续收缩两块剩余大路由：
  - `backend/app/routes/materials.py`
  - `backend/app/routes/discussion.py`
- `materials.py` 下沉到 `backend/app/services/materials_service.py` 的逻辑包括：
  - 资料序列化
  - 共享记录序列化
  - 资料请求创建 / 列表 / 处理
  - 课堂直播创建 / 翻页 / 批注 / 结束 / 版本列表
- `discussion.py` 下沉到 `backend/app/services/discussion_service.py` 的逻辑包括：
  - 空间成员校验
  - 空间概要 / 详情组装
  - 消息序列化
  - 附件上传
  - 发消息与 AI 跟帖
  - 搜索 / 上下文 / 成员消息列表
- 收缩结果：
  - `backend/app/routes/materials.py`: `470 -> 193`
  - `backend/app/routes/discussion.py`: `388 -> 104`

### 第二轮后端拆分
- 完成 Pydantic schema 第二轮拆分：
  - `backend/app/models/common.py`
  - `backend/app/models/auth.py`
  - `backend/app/models/people.py`
  - `backend/app/models/courses.py`
  - `backend/app/models/materials.py`
  - `backend/app/models/discussion.py`
  - `backend/app/models/qa.py`
  - `backend/app/models/assignments.py`
  - `backend/app/models/feedback.py`
- `backend/app/models/schemas.py` 已改为兼容 facade
- 完成 SQLAlchemy ORM 模型第二轮拆分：
  - `backend/app/db/models_people.py`
  - `backend/app/db/models_courses.py`
  - `backend/app/db/models_discussion.py`
  - `backend/app/db/models_qa.py`
  - `backend/app/db/models_assignments.py`
  - `backend/app/db/models_feedback.py`
  - `backend/app/db/models_materials.py`
- `backend/app/db/models.py` 已改为兼容 facade
- 将 `backend/app/routes/qa.py` 中的问答展示/序列化 helper 下沉到 `backend/app/services/qa_service.py`

### 后端结构
- 完成第一轮后端模块化拆分：
  - `backend/app/db/*`
  - `backend/app/services/llm_runtime.py`
  - `backend/app/services/file_extractors.py`
  - `backend/app/services/llm_generation.py`
  - `backend/app/services/materials_service.py`
  - `backend/app/services/qa_service.py`
- `backend/app/database.py` 与 `backend/app/services/llm_service.py` 已改为兼容 facade

### 警告与稳定性
- 把 FastAPI 弃用的 `@app.on_event("startup")` 改为 lifespan
- 清掉后端 pytest warning
- 修掉前端 lint/build 问题：
  - `next/image` 替换头像 `<img>`
  - 修正 material update 页面变量顺序
  - 修正 materials 页面 hook 依赖问题
  - 修正 `AuthModal` 成功路径下卸载后继续 `setState` 的浏览器 warning
- 增加 `test:e2e` 脚本，统一 Playwright 运行入口
- 修正原子/扩展测试中的认证等待、logout 稳定性和选择器歧义问题
- 为前端 API 请求增加超时保护，避免首页身份识别因悬挂请求长期停在加载态

### 功能文档与验证文档
- 形成代码对齐的完整功能清单：
  - `docs/internal/complete-feature-list.md`
- 形成逐功能验证矩阵：
  - `docs/internal/complete-feature-verification-matrix.md`
- 功能文档覆盖教师端、学生端、管理员端、课堂同步、兼容接口与支持型 API

### 自动化验证
本轮最新通过结果：
- 一键全量：
  - `bash scripts/verify-all.sh`
  - 通过
- 后端：
  - `cd backend && pytest -q`
  - `13 passed`
- 前端：
  - `cd frontend && npm run lint`
  - 通过
- 前端：
  - `cd frontend && npm run build`
  - 通过
- 浏览器：
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts tests/user-journeys.spec.ts`
  - `10 passed`
- 服务运行面：
  - 前端生产模式 `next start` 运行在 `3000`
  - 后端 `uvicorn app.main:app --host 0.0.0.0 --port 8000` 运行在 `8000`
  - `GET /api/health` 返回 `{"status":"ok","version":"0.8.0"}`

### 日志清理
- 已按你的要求清理旧验证日志：
  - `/tmp/hit-agent-verify/*`
- 当前只保留本轮最新一键验证新生成的一批日志，便于问题追踪。

### 新增自动化能力
- 新增统一验证脚本：
  - `scripts/verify-all.sh`
- 新增复杂浏览器旅程回归：
  - `frontend/tests/user-journeys.spec.ts`
- 新增自动化测试目录文档：
  - `docs/internal/automation-test-catalog.md`
- 为 Playwright API 直连增加动态端口支持：
  - `frontend/tests/extended-coverage.spec.ts`
  - `frontend/tests/user-journeys.spec.ts`
- `verify-all.sh` 已处理两个真实工程问题：
  - 自动寻找空闲验证端口，避免与常驻服务冲突
  - 启动后端时同步注入 `FRONTEND_PORT`，避免独立端口下的 CORS 拦截

## 当前判断
- 代码级功能清单和真实验证矩阵已经形成，后续不再需要凭印象补测。
- 当前项目的主要短板已从“没有自动化”转变为“需要继续把大文件拆薄、把迁移和可观测性补上”。
- 浏览器自动化在这台 HPC 上可以跑通，但稳定验证面应优先使用生产模式前端。
- 第三轮已经把 `materials.py` 与 `discussion.py` 继续拆薄，路由层高耦合问题已明显缓解。
- 阿里云 ECS 的“SSH + 代理 + Codex”基础运维面已经打通，可以进入真正的项目部署阶段。

## 进行中
- 更新过时文档到当前真实状态
- 准备提交并推送“ECS 部署手册与服务器 Codex Prompt”这一轮成果

## 下一步
- 提交并推送本轮 ECS 部署手册与 Prompt 文档
- 将 `docs/internal/ecs-server-codex-deploy-prompt-2026-04-13.md` 直接投喂给 ECS 上的 Codex
- 在 ECS 上修复部署可移植性问题并正式部署 `fhx-hit-agent`
- 为 ECS 部署补 systemd / 反向代理 / 域名与 HTTPS
- 如需继续优化代码结构，优先细分 `materials_service.py` 与 `discussion_service.py`

## 文档清理
- 已识别并清理过时或重复的交接/阶段性文档：
  - 旧交接 prompt
  - 旧完整交接快照
  - 旧浏览器测试中断 handoff
  - 旧阶段性内部测试结果
  - 早期功能测试矩阵
  - 旧的当前更新摘要
- 当前应以以下文档为准：
  - `project.md`
  - `work.md`
  - `progress.md`
  - `findings.md`
  - `docs/internal/complete-feature-list.md`
  - `docs/internal/complete-feature-verification-matrix.md`
