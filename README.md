# 前沿融课教师助手

> 哈工大 AI 智能体大赛参赛作品 | 教师赛道
> 面向高校教师的 AI 智能体，帮助教师将前沿知识快速融入课程教学

## 项目简介

本产品围绕"前沿知识快速入课"核心场景，提供完整的 **教师备课 → 学生问答 → 教学复盘** 闭环：

- **教师端**：创建课程画像 → 上传资料 → AI 生成结构化课时包（14 字段 JSON）→ 编辑发布
- **学生端**：选择已发布课时包 → 围绕课程内容提问 → 获得边界内 AI 回答
- **分析端**：AI 汇总学生提问日志 → 提取高频问题/易混淆概念/知识盲区 → 给出教学建议

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | FastAPI (Python 3.7+) + SQLite + SQLAlchemy |
| 前端 | Next.js 16 + TypeScript + Tailwind CSS |
| AI | 智谱 AI GLM-5（通过 httpx 调用 REST API） |
| 存储 | SQLite 持久化（courses, lesson_packs, qa_logs, materials 四张表） |

## 项目结构

```
├── backend/                      # FastAPI 后端
│   ├── app/
│   │   ├── main.py               # 入口：CORS、代理配置、路由注册
│   │   ├── database.py           # SQLite ORM + 自动 seed demo 数据
│   │   ├── models/
│   │   │   └── schemas.py        # Pydantic 数据模型
│   │   ├── services/
│   │   │   ├── llm_service.py    # GLM-5 调用服务（课时包生成/学生问答/复盘分析）
│   │   │   └── mock_data.py      # Mock 降级数据
│   │   └── routes/
│   │       ├── courses.py        # 课程 CRUD
│   │       ├── lesson_packs.py   # 课时包生成/查看/编辑/发布
│   │       ├── student.py        # 学生端问答
│   │       ├── analytics.py      # 教师复盘分析
│   │       └── materials.py      # 文件上传
│   ├── data/                     # SQLite 数据库 & 上传文件（运行时生成）
│   └── requirements.txt
│
├── frontend/                     # Next.js 前端
│   ├── src/
│   │   ├── lib/api.ts            # API 客户端
│   │   └── app/
│   │       ├── page.tsx          # 首页（角色选择）
│   │       ├── teacher/          # 教师端页面（工作台/创建课程/课时包/复盘）
│   │       └── student/          # 学生端页面（选择课时包/问答）
│   └── package.json
│
├── CLAUDE.md                     # 项目结构说明（给 AI 的上下文）
├── user.md                       # 用户偏好记录
├── work.md                       # 工作进度（每轮更新）
├── README.md                     # 本文件
├── NEW_SESSION_PROMPT.md         # 新 AI 会话启动 prompt
│
├── claude_code_docs/             # 比赛提供的参考文档
│   ├── 05_ClaudeCode_启动Prompt_v2.txt
│   └── 06_coding.md
│
├── 00_交付清单与使用说明.docx      # 比赛交付文档
├── 01_项目背景与赛事约束说明.docx
├── 02_产品功能说明书_面向用户.docx
├── 03_技术方案说明书_面向开发.docx
├── 04_ClaudeCode_开发任务书.docx
├── 05_ClaudeCode_启动Prompt.txt
├── 赛事说明.txt
├── 教师赛道-前沿融课教师助手.xlsx
└── 哈工大智能体平台校内建设者标准操作过程参考v2.docx
```

## 快速启动

### 环境要求

- Python 3.7+
- Node.js 18+
- 网络代理 127.0.0.1:7897（用于访问智谱 AI API，可按实际修改）

### 1. 启动后端

```bash
cd backend

# 创建并激活虚拟环境
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 设置代理（访问智谱 AI API 需要）
# Windows CMD:
set http_proxy=http://127.0.0.1:7897
set https_proxy=http://127.0.0.1:7897
# macOS/Linux:
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897

# 启动
uvicorn app.main:app --reload --port 8000
```

看到 `Application startup complete.` 即成功。

后端地址: http://localhost:8000
API 文档: http://localhost:8000/docs

### 2. 启动前端（新开一个终端）

```bash
cd frontend

npm install
npm run dev
```

看到 `Ready in ...` 即成功。

前端地址: http://localhost:3000

### 3. 验证

1. 健康检查：浏览器打开 http://localhost:8000/api/health → 应返回 `{"status":"ok"}`
2. 打开 http://localhost:3000 → 点击「教师端」→ 应看到 demo 课程「计算机网络」
3. 点击「生成课时包」→ 等待 GLM-5 生成（约 10-30 秒）→ 查看结构化课时包
4. 点击「发布」→ 切到学生端 → 选择课时包 → 输入问题测试

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/courses` | GET/POST | 课程列表/创建 |
| `/api/courses/{id}` | GET | 课程详情 |
| `/api/lesson-packs` | GET | 课时包列表 |
| `/api/lesson-packs/generate/{course_id}` | POST | 生成课时包 (GLM-5) |
| `/api/lesson-packs/{id}` | GET/PUT | 课时包详情/更新 |
| `/api/lesson-packs/{id}/publish` | POST | 发布课时包 |
| `/api/student/lesson-packs` | GET | 学生可见课时包 |
| `/api/student/lesson-packs/{id}` | GET | 课时包摘要 |
| `/api/student/lesson-packs/{id}/qa` | POST | 学生问答 (GLM-5) |
| `/api/analytics/{lp_id}` | GET | 复盘分析 (GLM-5) |
| `/api/materials/upload/{course_id}` | POST | 上传资料 |
| `/api/materials/{course_id}` | GET | 资料列表 |

## 当前功能状态

### 已完成 (MVP 核心闭环)
- 课程画像创建与管理
- 文件上传 (.txt/.md/.csv/.json)
- GLM-5 驱动的课时包生成（14 字段结构化 JSON）
- 课时包查看/发布
- GLM-5 驱动的学生智能问答（课程边界约束）
- GLM-5 驱动的教师复盘分析（高频问题/易混淆/盲区/建议）
- SQLite 持久化 + Demo 种子数据
- LLM 失败时自动 Mock 降级

### 待完成
- 课时包前端编辑 UI
- RAG 检索增强
- PDF/DOCX 解析
- 课时包导出
- HiAgent 平台部署

## 关键技术说明

- **GLM-5 思维链模式**：`max_tokens` 必须 >= 4096，否则推理内容消耗 token 导致实际输出为空
- **httpx 代理**：0.24.x 版本用 `proxies=` 参数而非 `proxy=`
- **Python 3.7 兼容**：必须 `from __future__ import annotations`
- **Next.js 16**：`useSearchParams()` 必须用 `<Suspense>` 包裹
