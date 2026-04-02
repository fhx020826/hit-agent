# 前沿融课教师助手 - Claude Code 项目规范

## 项目概述
面向高校教师的 AI 智能体，帮助教师将前沿知识快速融入课程。
哈工大 AI 智能体大赛参赛作品。

## 技术栈
- **后端**: FastAPI (Python 3.7+) + SQLite + SQLAlchemy
- **前端**: Next.js 16 + TypeScript + Tailwind CSS
- **AI**: 智谱 AI GLM-5 (通过 OpenAI 兼容 API 调用)
- **HTTP**: httpx (直接调用 REST API，不依赖 openai SDK)

## 项目结构
```
D:/AI智能体大赛/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口 (含代理配置)
│   │   ├── database.py          # SQLite ORM 模型 + 自动 seed
│   │   ├── models/schemas.py    # Pydantic 数据模型
│   │   ├── services/
│   │   │   ├── llm_service.py   # 智谱 GLM-5 LLM 调用服务
│   │   │   └── mock_data.py     # Mock 数据 (LLM 失败时的降级方案)
│   │   └── routes/
│   │       ├── courses.py       # 课程 CRUD
│   │       ├── lesson_packs.py  # 课时包管理
│   │       ├── student.py       # 学生端问答
│   │       ├── analytics.py     # 教师复盘分析
│   │       └── materials.py     # 文件上传
│   ├── data/                    # SQLite & uploads
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── lib/api.ts           # API 客户端
│   │   └── app/
│   │       ├── page.tsx         # 首页
│   │       ├── teacher/         # 教师端页面
│   │       └── student/         # 学生端页面
│   └── package.json
├── CLAUDE.md                    # 本文件
├── work.md                      # 工作进度
└── README.md                    # 部署运行指南
```

## API 端点
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/courses` | GET/POST | 课程列表/创建 |
| `/api/courses/{id}` | GET | 课程详情 |
| `/api/lesson-packs` | GET | 课时包列表 |
| `/api/lesson-packs/generate/{course_id}` | POST | 生成课时包 (LLM) |
| `/api/lesson-packs/{id}` | GET/PUT | 课时包详情/更新 |
| `/api/lesson-packs/{id}/publish` | POST | 发布课时包 |
| `/api/student/lesson-packs` | GET | 学生可见课时包 |
| `/api/student/lesson-packs/{id}` | GET | 课时包摘要 |
| `/api/student/lesson-packs/{id}/qa` | POST | 学生问答 (LLM) |
| `/api/analytics/{lp_id}` | GET | 复盘分析 (LLM) |
| `/api/materials/upload/{course_id}` | POST | 上传资料 |
| `/api/materials/{course_id}` | GET | 资料列表 |

## 前端路由
| 路径 | 说明 |
|------|------|
| `/` | 首页（角色选择） |
| `/teacher` | 教师工作台 |
| `/teacher/course` | 创建课程 |
| `/teacher/lesson-pack` | 生成课时包 |
| `/teacher/lesson-pack/[id]` | 课时包详情 |
| `/teacher/review` | 教师复盘 |
| `/student` | 学生端 |
| `/student/qa` | 学生问答 |

## LLM 集成
- **提供商**: 智谱 AI (ZhipuAI)
- **API**: `https://open.bigmodel.cn/api/paas/v4/chat/completions`
- **模型**: `glm-5`
- **认证**: API Key 在 `llm_service.py` 中配置
- **降级**: LLM 调用失败时自动回退到 `mock_data.py` 中的模拟数据

## 编码规范
- 后端: `from __future__ import annotations` (Python 3.7 兼容)、Pydantic 校验
- 前端: TypeScript strict、函数组件、Tailwind CSS
- Next.js 16: `useSearchParams()` 必须包裹 `<Suspense>`
- 中文 UI 文案，英文代码标识符
- httpx `proxies` 参数 (0.24.x)，不是 `proxy`

## MVP 完成状态
- P1 骨架 ✅
- P2 课程+课时包 ✅
- P3 上传+解析 ✅
- P4 学生问答 (LLM) ✅
- P5 复盘+Demo (LLM) ✅
