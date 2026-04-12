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

### 当前进行中
- 更新项目维护文档
- 准备提交并推送第二轮重构成果
