# 前沿融课教师助手 - Claude Code 项目规范

## 项目概述
面向高校教师的 AI 智能体 MVP，帮助教师将前沿知识快速融入课程。
哈工大 AI 智能体大赛参赛作品。

## 技术栈
- **后端**: FastAPI (Python 3.11+) + SQLite
- **前端**: Next.js 16 + TypeScript + Tailwind CSS
- **AI**: Mock LLM + Mock RAG（后续替换为真实模型）

## 项目结构
```
D:/AI智能体大赛/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── models/schemas.py    # Pydantic 数据模型
│   │   ├── services/mock_data.py # Mock 数据与生成逻辑
│   │   └── routes/
│   │       ├── courses.py       # 课程 CRUD
│   │       ├── lesson_packs.py  # 课时包管理
│   │       ├── student.py       # 学生端问答
│   │       └── analytics.py     # 教师复盘分析
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
├── .gitignore
├── claude.md                    # 本文件
├── user.md                      # 用户偏好
└── work.md                      # 工作进度
```

## API 端点
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/courses` | GET/POST | 课程列表/创建 |
| `/api/courses/{id}` | GET | 课程详情 |
| `/api/lesson-packs` | GET | 课时包列表 |
| `/api/lesson-packs/generate/{course_id}` | POST | 生成课时包 |
| `/api/lesson-packs/{id}` | GET/PUT | 课时包详情/更新 |
| `/api/lesson-packs/{id}/publish` | POST | 发布课时包 |
| `/api/student/lesson-packs` | GET | 学生可见课时包 |
| `/api/student/lesson-packs/{id}/qa` | POST | 学生问答 |
| `/api/analytics/{lp_id}` | GET | 复盘分析 |

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

## 编码规范
- 后端: 类型注解、async/await、Pydantic 校验
- 前端: TypeScript strict、函数组件、Tailwind CSS
- Next.js 16: `useSearchParams()` 必须包裹 `<Suspense>`
- 中文 UI 文案，英文代码标识符

## 开发命令
```bash
# 后端
cd backend && python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend && npm install && npm run dev
```

## MVP 阶段
- P1 骨架 ✅ (已完成)
- P2 课程+课时包 ✅ (已完成)
- P3 上传+解析 (待实现)
- P4 学生问答 ✅ (已完成)
- P5 复盘+Demo ✅ (已完成)
