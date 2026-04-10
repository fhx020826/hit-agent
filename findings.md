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
