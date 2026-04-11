# HIT-Agent 项目总进度与下一步计划

> 最后更新: 2026-04-11 | 本文档用于新对话上下文恢复

---

## 1. 项目概览

**项目**: 面向前沿学科的智能教学平台 (HIT-Agent)
**仓库**: `/home/hxfeng/fhx-hit-agent`
**分支**: `main`
**双 remote**:
- `origin = https://github.com/fhx020826/hit-agent.git` (个人协作仓库)
- `upstream = https://github.com/wishmyself/hit-agent.git` (原始仓库)

**技术栈**:
- 前端: Next.js 16 + React 19 + TypeScript + App Router
- 后端: FastAPI + SQLAlchemy + SQLite + httpx (调外部模型)
- RAG: pypdf 解析 + 分块 + 关键词/向量召回 + 融合检索

**conda 环境**: `fhx-hit-agent` (Python 3.11)
- 激活: `eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)" && conda activate fhx-hit-agent`

**外网命令模式**:
- `bash -ic 'clash && proxy && <command>'`
- Git push: `bash -ic 'clash && proxy && git -c http.proxy=http://127.0.0.1:18990 -c https.proxy=http://127.0.0.1:18990 push origin main'`

---

## 2. 已完成工作总览 (Phase 1-9)

### Phase 1-6: 基础设施搭建 (2026-04-10)
- [x] 代理验证与 GitHub 外网访问
- [x] 克隆仓库到 `/home/hxfeng/fhx-hit-agent`
- [x] 创建独立 conda 环境 `fhx-hit-agent`，安装后端依赖
- [x] 阅读核心代码，输出项目完成度分析
- [x] git remote 切换 (origin → 个人, upstream → 原始)
- [x] 建立项目长期维护文档骨架 (project.md, work.md, progress.md, task_plan.md, findings.md)
- [x] 建立一键启动脚本 (dev-up.sh / dev-down.sh / dev-status.sh)
- [x] 修复前端 Hook 相关 lint error → 仅剩 warning
- [x] 创建后端最小冒烟测试 (4 passed)
- [x] 创建内部功能测试基线文档 (`docs/internal/internal-feature-test-matrix.md`)

### Phase 7-8: 后端测试扩展与在线验证 (2026-04-11 上午)
- [x] 修正 conftest.py 测试种子数据 (问卷模板字段)
- [x] 新增 `backend/tests/test_full_api_smoke.py`
- [x] 后端 `pytest -q` → **9 passed, 2 warnings**
- [x] 在线服务验证 (前后端均在线可达)
- [x] 完成真实教师/学生时序链路验证

### Phase 9: 前端浏览器原子测试 (2026-04-11 下午/晚间)
- [x] 安装 Playwright 依赖 (playwright + @playwright/test)
- [x] 配置用户空间 Chromium (`~/.cache/ms-playwright/chromium-1217/`)
- [x] 创建 Playwright 配置 (`frontend/playwright.config.ts`)
- [x] 创建原子测试文件 (`frontend/tests/atomic-features.spec.ts`)
- [x] 全面审计代码库，创建完整功能文档 (`docs/internal/complete-feature-list.md`)，**97 个功能点**
- [x] 修复前端 bug: material-update 页面无模型时的回退支持
- [x] 调试并修复多个测试选择器问题 (strict mode、按钮文本、QA 模式等)
- [x] **5 个浏览器原子测试全部通过，连续 4 次验证稳定**
- [x] 提交并推送到 origin/main

---

## 3. 当前测试基线

### 后端自动化测试
- 文件: `backend/tests/conftest.py`, `test_smoke_api.py`, `test_full_api_smoke.py`
- 命令: `cd backend && pytest -q`
- 结果: **9 passed, 2 warnings** (warnings 为 FastAPI on_event 弃用)
- 覆盖: health, auth, profile, admin CRUD, courses, lesson packs, materials, QA sessions, assignments, feedback

### 前端浏览器原子测试
- 文件: `frontend/tests/atomic-features.spec.ts`
- 配置: `frontend/playwright.config.ts`
- 命令: `cd frontend && rm -rf test-results && npx playwright test tests/atomic-features.spec.ts`
- 结果: **5 passed** (连续 4 次)
- 运行时间: ~57-60 秒

**5 个测试覆盖的功能链**:

| 测试 | 覆盖功能 |
|------|----------|
| Test 1: 认证与管理员 | 教师注册、学生注册、管理员登录、创建/搜索/删除用户 |
| Test 2: 教师设置与课程 | 个人资料、外观设置(主题/配色/字体)、密码修改+重登录、课程创建、课程包生成与发布、AI助教配置保存与持久化、课件更新建议生成 |
| Test 3: 教师内容发布 | 资料上传、共享到学生端、作业发布、反馈问卷触发 |
| Test 4: 学生交互 | 学生登录、查看共享资料、资料请求、Q&A提问(教师模式)、问答文件夹创建、作业确认+提交、匿名反馈、薄弱点分析、讨论空间发消息 |
| Test 5: 教师闭环 | 处理资料请求、查看并回复学生问题、反馈问卷触发与统计查看 |

---

## 4. 完整功能清单

详见 `docs/internal/complete-feature-list.md`，共 **97 个功能点**，按优先级分布:
- **CRITICAL (27)**: 注册/登录/路由、课程创建、作业发布/提交、反馈提交等
- **HIGH (56)**: 个人资料、AI配置、资料管理、问答记录等
- **MEDIUM (14)**: 文件预览/下载、实时共享、通知标记等

---

## 5. 本轮修复的 Bug

### Bug 1: material-update 无模型时硬性阻断
- **文件**: `frontend/src/app/teacher/material-update/page.tsx`
- **问题**: 当 `GET /api/qa/models` 返回空列表时，页面完全禁用"生成更新建议"按钮，但后端 `POST /api/material-update/preview` 支持 `selected_model="default"` 并返回有意义的回退诊断结果
- **修复**: 保留 `selectedModel` 为 `"default"` 当无模型清单时，启用预览按钮，展示回退卡片

---

## 6. 已知限制

1. **无真实 AI 模型**: 当前 `GET /api/qa/models` 返回空数组，所有 AI 相关功能走回退路径
   - Q&A 即时回答 → 前端提示"暂无可用模型"
   - 课件更新建议 → 后端回退诊断模式，有输出但非真实推理
   - 作业 AI 批改 → 可能无反馈
2. **数据库为 SQLite**: 适合开发/演示，不适合生产
3. **无数据库迁移体系**: schema 变更需要手动处理
4. **前端仍有 3 个 lint warning**: 非阻塞性 Hook 规范问题

---

## 7. 下一步计划

### Phase 10: 发布前完善 (优先级从高到低)

#### 10.1 接入真实 AI 模型 (高)
- 配置至少一个模型 API Key (OpenAI/DeepSeek/GLM/Qwen 之一)
- 验证 Q&A 即时回答、课件更新建议、作业 AI 批改的真实链路
- 补充对应的浏览器测试断言

#### 10.2 补齐未覆盖的功能测试 (高)
当前浏览器测试覆盖了约 60 个功能点，以下 37 个尚未覆盖:
- 管理员角色筛选 (B1.3)
- 自定义头像上传 (C1.4)
- 皮肤风格切换 (C2.4) — 目前只测了 mode/accent/font
- 语言切换 (C2.5)
- 资料预览/下载 (D5.4, D5.5, E4.3, E4.4)
- 拒绝资料请求 (D5.11)
- 实时共享 (D5.12, D5.13, E4.5, E4.6) — WebSocket 相关
- 课程包详情页 (D3.4)
- 课件更新文件上传 (D6.4, D6.7)
- 课程包更新历史 (D6.9)
- 作业详情与学生花名册 (D7.5-D7.9)
- Q&A 附件上传 (E2.8)
- 新建问答轮次 (E2.9)
- 跳过问卷 (E6.6)
- 选择题类型问题 (E6.3)
- 删除问题 (E3.6)
- 讨论搜索 (D10.3)
- 作业 AI 批改预览 (D11.1)
- 课程分析 (D12.1)

#### 10.3 工程化补强 (中)
- 建立数据库迁移体系 (Alembic)
- 补充 `.env.example` 模板
- 统一前端组件边界与状态管理
- 增强后端日志与错误追踪

#### 10.4 部署准备 (低)
- CI/CD pipeline
- Docker 化
- 生产级数据库 (PostgreSQL)
- 结构化日志与监控

---

## 8. 关键命令速查

```bash
# 激活环境
eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)" && conda activate fhx-hit-agent

# 启动前后端 (一键)
cd /home/hxfeng/fhx-hit-agent && bash scripts/dev-up.sh

# 关闭前后端
cd /home/hxfeng/fhx-hit-agent && bash scripts/dev-down.sh

# 后端测试
cd /home/hxfeng/fhx-hit-agent/backend && pytest -q

# 前端浏览器测试
cd /home/hxfeng/fhx-hit-agent/frontend && rm -rf test-results && npx playwright test tests/atomic-features.spec.ts

# 健康检查
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:3000

# Git 提交与推送
cd /home/hxfeng/fhx-hit-agent
git add <files>
git commit -m "type: description"
bash -ic 'clash && proxy && git -c http.proxy=http://127.0.0.1:18990 -c https.proxy=http://127.0.0.1:18990 push origin main'
```

---

## 9. 项目文件结构

```
fhx-hit-agent/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── database.py          # 数据模型 + DB 会话
│   │   ├── routes/              # API 路由
│   │   │   ├── auth.py          # 认证注册登录
│   │   │   ├── profile.py       # 个人资料
│   │   │   ├── settings.py      # 外观设置
│   │   │   ├── admin.py         # 管理员用户管理
│   │   │   ├── courses.py       # 课程管理
│   │   │   ├── lesson_packs.py  # 课程包生成
│   │   │   ├── materials.py     # 教学资料 + 实时共享
│   │   │   ├── material_update.py # PPT/教案更新
│   │   │   ├── qa.py            # 问答系统
│   │   │   ├── discussions.py   # 讨论空间
│   │   │   ├── assignments.py   # 作业系统
│   │   │   ├── assignment_review.py # 作业批改
│   │   │   ├── feedback.py      # 匿名反馈
│   │   │   ├── analytics.py     # 教学分析
│   │   │   └── agent_config.py  # AI 助教配置
│   │   └── services/
│   │       ├── llm_service.py   # LLM 调用
│   │       └── rag_service.py   # RAG 检索
│   └── tests/
│       ├── conftest.py          # 测试种子数据
│       ├── test_smoke_api.py    # 基础冒烟测试
│       └── test_full_api_smoke.py # 全模块冒烟测试
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx             # 首页
│   │   ├── admin/users/         # 管理员用户管理
│   │   ├── profile/             # 个人资料
│   │   ├── settings/            # 设置中心
│   │   ├── teacher/             # 教师端所有页面
│   │   │   ├── course/          # 课程创建
│   │   │   ├── lesson-pack/     # 课程包生成/详情
│   │   │   ├── ai-config/       # AI 助教配置
│   │   │   ├── materials/       # 教学资料库
│   │   │   ├── material-update/ # PPT/教案更新
│   │   │   ├── assignments/     # 作业管理
│   │   │   ├── feedback/        # 匿名问卷分析
│   │   │   ├── questions/       # 学生提问中心
│   │   │   ├── discussions/     # 课程讨论
│   │   │   └── review/          # 教学分析
│   │   └── student/             # 学生端所有页面
│   │       ├── qa/              # AI 助教问答
│   │       ├── questions/       # 学习问答记录
│   │       ├── materials/       # 课堂共享资料
│   │       ├── assignments/     # 作业任务中心
│   │       ├── feedback/        # 匿名课堂反馈
│   │       ├── weakness/        # 薄弱点分析
│   │       └── discussions/     # 课程讨论
│   ├── playwright.config.ts     # Playwright 配置
│   └── tests/
│       └── atomic-features.spec.ts # 浏览器原子测试
├── docs/
│   ├── internal/
│   │   ├── complete-feature-list.md         # 97 个功能点清单
│   │   ├── internal-feature-test-matrix.md  # 功能测试矩阵
│   │   └── internal-test-results-2026-04-11.md
│   └── admin/
│       └── hpc-collaboration-and-access.md
├── scripts/
│   ├── dev-up.sh               # 一键启动
│   ├── dev-down.sh             # 一键关闭
│   └── dev-status.sh           # 状态检查
├── project.md                   # 项目概述
├── work.md                      # 工作日志
├── progress.md                  # 进度记录
├── task_plan.md                 # 任务计划
└── findings.md                  # 发现与判断
```

---

## 10. 新对话启动 Prompt

直接复制以下内容到新对话开头即可:

```markdown
项目目录在 `/home/hxfeng/fhx-hit-agent`，请继续 HIT-Agent 智能教学平台的开发和测试。

请优先阅读:
- `/home/hxfeng/fhx-hit-agent/docs/internal/session-handoff-full.md` (本文档)
- `/home/hxfeng/fhx-hit-agent/docs/internal/complete-feature-list.md`
- `/home/hxfeng/fhx-hit-agent/project.md`

当前状态:
- 后端 pytest: 9 passed, 2 warnings
- 前端 Playwright: 5 passed (连续 4 次验证稳定)
- 前后端都在线 (127.0.0.1:8000 / 127.0.0.1:3000)
- 97 个功能点已全面审计，当前测试覆盖约 60 个
- 所有代码已提交推送到 origin/main

当前最需要做的 (按优先级):
1. 接入真实 AI 模型 API Key，验证 AI 链路
2. 补齐剩余 37 个未覆盖功能的测试
3. 工程化补强 (数据库迁移、环境模板、日志)
4. 部署准备 (CI/CD、Docker、PostgreSQL)
```
