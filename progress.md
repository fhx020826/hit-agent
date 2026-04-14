# Progress Log

## 2026-04-10

### 已完成
- 创建项目工作目录 `/home/hxfeng/fhx-hit-agent`
- 通过代理验证 GitHub 外网访问
- 将 `wishmyself/hit-agent` 克隆到本地工作目录
- 创建独立 conda 环境 `fhx-hit-agent`
- 在 `fhx-hit-agent` 环境中安装后端依赖
- 阅读关键入口文档与核心代码，确认项目为前后端分离的智能教学平台
- 确认当前仓库缺少自动化测试目录
- 建立长期维护文档骨架
- 完成后端最小导入自检：
  - `app.main` 可正常导入
  - `llm_service` 可正常导入
  - `rag_service.split_chunks` 可正常运行
  - 当前模型列表数量为 `0`，说明运行环境尚未配置模型密钥
- 完成 git remote 切换：
  - `origin` -> `https://github.com/fhx020826/hit-agent.git`
  - `upstream` -> `https://github.com/wishmyself/hit-agent.git`
- 已成功推送当前 `main` 到 `origin/main`
- 新增文档 `docs/admin/hpc-collaboration-and-access.md`
- 完成运行验证：
  - 后端健康检查通过
  - 前端生产构建通过
  - 前端 lint 发现若干 Hook 规范问题，但不阻塞构建和运行
- 确认前端依赖安装在当前 HPC 下应优先使用官方 npm registry
- 新增脚本：
  - `scripts/dev-up.sh`
  - `scripts/dev-down.sh`
  - `scripts/dev-status.sh`
- 一键启动脚本实测通过
- 已完成第一优先级中的第 1 项：
  - 修复前端当前明确的 Hook 实现错误
  - `lint` 从 error 降为仅剩 warning
  - `build` 保持通过
- 已完成第一优先级中的第 2 项的最小版本：
  - 新增后端最小冒烟测试
  - `pytest -q` 通过（4 passed）
- 已补充内部功能测试基线文档，后续已被完整文档覆盖：
  - 当前保留的完整功能清单：`docs/internal/complete-feature-list.md`
  - 当前保留的完整验证矩阵：`docs/internal/complete-feature-verification-matrix.md`

### 关键命令
- 代理验证：
  - `bash -ic 'clash && proxy && curl -I https://github.com'`
- 仓库拉取：
  - `bash -ic 'clash && proxy && cd /home/hxfeng/fhx-hit-agent && git clone https://github.com/wishmyself/hit-agent.git .'`
- conda 激活：
  - `eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)" && conda activate fhx-hit-agent`

### 当前进行中
- 基于内部功能清单准备下一步自动化测试拆分
- 准备整理并提交本轮文档更新

## 2026-04-11

### 已完成
- 保留并继续扩展 `backend/tests/conftest.py` 的测试种子数据
- 修正默认问卷模板字段为真实数据库字段 `questions_json`
- 新增 `backend/tests/test_full_api_smoke.py`
- 完成后端主模块 API 冒烟回归：
  - `pytest -q`
  - 结果：`9 passed, 2 warnings`
- 复核在线服务：
  - `http://127.0.0.1:8000/api/health` 正常
  - 前端首页与教师/学生/管理员关键页面均返回 `HTTP 200`
- 完成在线真实教师/学生时序链路：
  - 注册教师与学生临时账号
  - 创建课程
  - 生成并发布课程包
  - 创建问答会话并提问
  - 发布作业并完成学生提交
  - 创建匿名反馈实例并完成学生提交
  - 创建资料请求并查看教师通知
- 形成阶段性内部测试记录，后续结果已并入 `findings.md`、`work.md` 与完整验证矩阵

### 当前进行中
- 同步项目维护文档
- 准备评估是否需要提交本轮测试与文档更新

## 2026-04-12

### 已完成
- 完成首轮后端结构拆分：
  - 数据库层拆为 `backend/app/db/*`
  - LLM 能力拆为 `llm_runtime.py`、`file_extractors.py`、`llm_generation.py`
  - 新增 `materials_service.py` 与 `qa_service.py`
- 修复 FastAPI 启动弃用 warning：
  - `backend/app/main.py` 改为 lifespan
- 修复前端当前 warning / build 问题：
  - `next.config.ts`
  - `package.json`
  - `playwright.config.ts`
  - `material-update` / `materials` / `avatar-badge` / `language-provider`
  - `auth-modal`
- 完成完整功能清单与完整验证矩阵的基线整理：
  - `docs/internal/complete-feature-list.md`
  - `docs/internal/complete-feature-verification-matrix.md`
- 新增扩展回归：
  - `backend/tests/test_extended_feature_api.py`
  - `frontend/tests/extended-coverage.spec.ts`
- 最新验证结果：
  - `pytest -q` -> `13 passed`
  - `npm run lint` -> 通过
  - `npm run build` -> 通过
  - `npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts` -> `8 passed`
- 已推送首轮重构与验证基线：
  - `b2469fe refactor: modularize backend services and stabilize verification`
- 完成第二轮后端深度拆分：
  - `backend/app/models/schemas.py` 拆为多个 schema 模块并保留 facade
  - `backend/app/db/models.py` 拆为多个 ORM 模块并保留 facade
  - `backend/app/routes/qa.py` 中的展示/序列化 helper 下沉到 `backend/app/services/qa_service.py`
- 为前端请求层补充超时保护：
  - `frontend/src/lib/api.ts`
  - 用于避免首页身份识别因悬挂请求长期停在加载态
- 使用最新代码重新启动前后端服务：
  - 前端生产模式 `next start` -> `3000`
  - 后端 `uvicorn` -> `8000`
- 在最新代码与最新服务面上再次完成全量验证：
  - `cd backend && pytest -q` -> `13 passed`
  - `cd frontend && npm run lint` -> 通过
  - `cd frontend && npm run build` -> 通过
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts` -> `8 passed`
- 新增复杂用户旅程浏览器回归：
  - `frontend/tests/user-journeys.spec.ts`
  - 覆盖“注册起步的完整教学闭环”和“问答归档生命周期”
- 新增统一验证脚本：
  - `scripts/verify-all.sh`
  - 自动处理独立端口选择、后端 CORS 端口注入、生产模式前端启动与三组 Playwright 顺跑
- 新增自动化测试目录文档：
  - `docs/internal/automation-test-catalog.md`
- 最新一键全量验证结果：
  - `bash scripts/verify-all.sh` -> 通过
  - `pytest -q` -> `13 passed`
  - `npm run lint` -> 通过
  - `npm run build` -> 通过
  - `npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts tests/user-journeys.spec.ts` -> `10 passed`
- 完成第三轮后端深拆：
  - `backend/app/routes/materials.py` -> `backend/app/services/materials_service.py`
  - `backend/app/routes/discussion.py` -> `backend/app/services/discussion_service.py`
- 本轮拆分后再次完成一键全量验证：
  - `bash scripts/verify-all.sh` -> 通过
- 已清理旧验证日志：
  - `/tmp/hit-agent-verify/*`
- 当前仅保留最新验证日志批次：
  - `/tmp/hit-agent-verify/20260412-212334`
- 已验证新购阿里云 ECS 的 SSH 可达性：
  - 公网 IP：`8.152.202.171`
  - 验证命令：
    - `ssh -tt -o StrictHostKeyChecking=accept-new root@8.152.202.171 'whoami && hostname && uname -a'`
  - 验证结果：
    - `root`
    - `iZ2ze8uopnpciyc63go6d6Z`
- 新增 ECS 连接说明文档：
  - `docs/internal/ecs-server-connection-guide.md`

### 当前进行中
- 本轮第三轮后端深拆、旧日志清理与全量回归已经完成
- 如继续优化，重点将转向 `materials_service.py` / `discussion_service.py` 内部再按子域继续细分

## 2026-04-13

### 已完成
- 完成阿里云 ECS 基础初始化：
  - `root` 密码已重置
  - 本机 SSH 公钥已加入远端 `authorized_keys`
  - 已验证免密登录可用
- 已在 ECS 安装基础运维工具：
  - `git curl wget unzip vim tmux htop rsync jq ripgrep fd-find lsof bubblewrap`
- 已把本机 Clash 目录同步到 ECS：
  - `/root/clash`
- 已在远端 `~/.bashrc` 中配置并验证命令：
  - `clash`
  - `proxy`
  - `unproxy`
  - `clash-status`
  - `proxy-status`
- 已验证远端代理可正常访问 GitHub。
- 已同步本机 Codex 环境到 ECS：
  - `/root/bin/codex`
  - `/root/.local/node-v22.12.0-linux-x64`
  - `/root/.codex`
- 定位并解决远端 Codex 无法对话问题：
  - 最初远端 `codex exec` 访问 `chatgpt.com` 失败
  - 补齐 `/root/.codex/cap_sid` 后恢复正常
- 当前已验证远端直接运行以下命令成功：
  - `codex --version`
  - `codex exec --skip-git-repo-check -C /root "Reply with OK and nothing else."`
- 已更新内部文档：
  - `docs/internal/ecs-server-connection-guide.md`
 - 已确认当前仓库版本关系：
   - `HEAD == origin/main == 23dc5d3`
   - `upstream/main == d266c78`
 - 已新增 ECS 正式部署手册与可直接投喂服务器 Codex 的 Prompt：
   - `docs/internal/ecs-deployment-runbook-2026-04-13.md`
   - `docs/internal/ecs-server-codex-deploy-prompt-2026-04-13.md`
 - 已明确当前正式部署前的真实阻塞点：
   - `verify-all.sh` / `dev-up.sh` 的 conda 本机绝对路径
   - `frontend/playwright.config.ts` 的 Chromium 本机绝对路径
   - ECS 缺少 `conda`、`node`、`npm`

### 当前进行中
- 同步本轮 ECS 初始化结果到长期维护文档
- 准备提交并推送本轮部署手册与 Prompt 文档更新

### 2026-04-13 ECS 正式部署尝试
- 已直接在 ECS 上完成正式部署前的环境准备：
  - 补 `4G swap`
  - 确认远端已有 `node v22.12.0`、`npm 10.9.0`
  - 确认远端已有 `/root/miniconda3` 与 `fhx-hit-agent` conda 环境
  - 补齐兼容路径 `/home/hxfeng/miniconda3` 与 `/home/hxfeng/.cache`
  - 安装后端依赖、前端依赖、Playwright Chromium
- 已把 ECS 可移植性修复提交并推送：
  - `44de8c2 test: stabilize ecs deployment verification`
- 已在 ECS 上基于 `44de8c2` 真实执行：
  - `bash scripts/verify-all.sh`
  - 当前真实进度：
  - 后端 `pytest` 通过

## 2026-04-14

### 已完成
- 新增轻量异步任务中心基础设施：
  - `backend/app/db/models_tasks.py`
  - `backend/app/models/tasks.py`
  - `backend/app/services/task_jobs.py`
  - `backend/app/services/task_job_handlers.py`
  - `backend/app/routes/task_jobs.py`
- 把两条重计算链路接入异步任务中心：
  - 课程包生成
  - PPT / 教案更新预览 / 上传
- 保留旧同步接口用于兼容已有调用，同时让教师端页面默认走异步任务接口。
- 新增异步任务专项后端回归：
  - `backend/tests/test_task_jobs.py`
- 更新前端 API 与页面：
  - `frontend/src/lib/api.ts`
  - `frontend/src/app/teacher/lesson-pack/page.tsx`
  - `frontend/src/app/teacher/material-update/page.tsx`
- 重启本地开发服务：
  - `scripts/dev-down.sh`
  - `scripts/dev-up.sh`
- 完成最新统一全量验证：
  - `bash scripts/verify-all.sh` -> 通过
  - `pytest -q` -> `22 passed`
  - `Playwright` -> `10 passed`
- 最新统一验证日志目录：
  - `/tmp/hit-agent-verify/20260414-040104`
- 重新通读并交叉核对以下文档，确认当前基线与下一优先级没有分叉：
  - `project.md`
  - `work.md`
  - `progress.md`
  - `findings.md`
  - `task_plan.md`
  - `docs/internal/complete-feature-list.md`
  - `docs/internal/automation-test-catalog.md`
  - `docs/internal/complete-feature-verification-matrix.md`
  - `docs/internal/async-task-center-verification-2026-04-14.md`
- 重新核对当前实现文件，确认 `assignment-review` 仍未接入异步任务中心：
  - `backend/app/routes/assignment_review.py`
  - `backend/app/routes/task_jobs.py`
  - `backend/app/services/task_jobs.py`
  - `backend/app/services/task_job_handlers.py`
  - `frontend/src/app/teacher/assignment-review/page.tsx`
  - `frontend/src/lib/api.ts`
- 重新读取 ECS 运维与部署文档，并对 `8.152.202.171` 做新鲜连通性诊断：
  - `ping` 正常
  - `22/tcp` 可建连
  - SSH `banner exchange` 超时
  - `3000/8000` HTTP 探针超时
  - `ssh-keyscan` 无返回
- 已确认本轮服务器问题不在本机 SSH 配置，而在远端主机 / 服务响应面
- 已形成明确升配建议：
  - `2C4G` 为最低可接受配置
  - `4C8G` 为推荐配置
  - 不建议购买 GPU 规格
- 在用户重启 ECS 后已重新接管服务器：
  - SSH 恢复
  - `systemd` 服务自动拉起
  - 服务器代码从 `9cd4893` 更新到 `3f85001`
  - 前端已重新 `npm run build`
  - 前端服务已重新启动并加载最新 build
- 本地公网验证通过：
  - `http://8.152.202.171:3000` 返回 `HTTP 200`
  - `http://8.152.202.171:8000/api/health` 返回 `{"status":"ok","version":"0.8.0"}`
- 已完成首页“对内标注”清理：
  - 新增 Playwright 用例 `public homepage hides internal annotations`
  - 初次 RED 后修复页面文案与结构
  - 复跑结果 `1 passed`
  - `frontend` lint 通过

### 当前进行中
- 当前新的直接执行目标已明确：
  - 先完成 `assignment-review` 异步化
  - 再进入 `materials_service.py` / `discussion_service.py` 进一步细分
- 已形成文件级执行方案，下一轮将按以下顺序推进：
  1. 增加 assignment-review 任务类型与 handler
  2. 增加异步提交接口并保留同步接口兼容
  3. 前端改为任务提交 + 轮询
  4. 扩展后端 `test_task_jobs.py`
  5. 更新 Playwright 覆盖
  6. 运行 `bash scripts/verify-all.sh`
- 当前 ECS 运行面故障已因用户重启服务器而解除
- 已新增新对话交接文档：
  - `docs/internal/new-session-handoff-2026-04-14.md`
