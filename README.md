# 前沿融课教师助手 — 本地部署运行指南

## 环境要求
- Python 3.7+ (已验证 3.7)
- Node.js 18+
- 网络代理 (127.0.0.1:7897) 用于访问智谱 AI API

---

## 一、部署运行命令

### 终端 1: 启动后端

```bash
cd D:\AI智能体大赛\backend
.venv\Scripts\activate
set http_proxy=http://127.0.0.1:7897
set https_proxy=http://127.0.0.1:7897
uvicorn app.main:app --reload --port 8000
```

看到 `Application startup complete.` 即成功。
后端地址: http://localhost:8000
API 文档: http://localhost:8000/docs

### 终端 2: 启动前端

```bash
cd D:\AI智能体大赛\frontend
npm run dev
```

看到 `Ready in ...` 即成功。
前端地址: http://localhost:3000

---

## 二、功能验证流程

### 1. 健康检查
浏览器打开 http://localhost:8000/api/health
应返回 `{"status":"ok","version":"0.2.0"}`

### 2. 教师端完整流程
1. 打开 http://localhost:3000 → 点击「教师端」
2. 查看已有的 demo 课程「计算机网络」
3. 点击「生成课时包」→ 等待 LLM 生成 (约 10-30 秒)
4. 查看生成的课时包详情（教学目标、PPT大纲、讨论题等）
5. 点击「发布」将课时包发布给学生端
6. 点击「复盘」查看教学分析

### 3. 学生端完整流程
1. 打开 http://localhost:3000 → 点击「学生端」
2. 选择已发布的课时包
3. 在问答界面输入问题，如「QUIC和TCP有什么区别？」
4. 获得 AI 基于课程内容的回答

### 4. 创建新课程
1. 在教师工作台点击「+ 创建课程画像」
2. 填写课程信息（名称、章节、前沿方向等）
3. 提交后点击「生成课时包」

---

## 三、已实现功能清单

### AI 功能 (由智谱 GLM-5 驱动)
| 功能 | 说明 |
|------|------|
| 课时包生成 | 根据课程画像（课程名、章节、前沿方向等）自动生成结构化课时包，包含教学目标、时间分配、PPT大纲、讨论题、案例素材等 |
| 学生智能问答 | 基于课时包上下文回答学生问题，自动判断是否在课程范围内 |
| 教师复盘分析 | 分析学生提问数据，提取高频主题、易混淆概念、知识盲区，给出教学建议 |

### 平台功能
| 功能 | 说明 |
|------|------|
| 课程画像管理 | 创建/查看课程，包含授课对象、学生水平、前沿方向等 |
| 课时包管理 | 生成/查看/编辑/发布课时包 |
| 文件上传 | 上传课程资料 (.txt, .md, .csv, .json) |
| 学生端 | 选择课时包、AI 问答 |
| 教师复盘 | 查看问答分析报告 |

### 技术特性
| 特性 | 说明 |
|------|------|
| SQLite 持久化 | 所有数据自动保存到 backend/data/app.db |
| Demo 数据 | 首次启动自动 seed 计算机网络 demo 课程 |
| LLM 降级 | AI 调用失败时自动回退到 mock 数据 |
| CORS | 前后端分离，支持 localhost:3000 跨域 |

---

## 四、项目结构

```
D:\AI智能体大赛\
├── backend\
│   ├── app\
│   │   ├── main.py              # FastAPI 入口
│   │   ├── database.py          # SQLite ORM
│   │   ├── models\schemas.py    # Pydantic 模型
│   │   ├── services\
│   │   │   ├── llm_service.py   # GLM-5 调用服务
│   │   │   └── mock_data.py     # Mock 降级数据
│   │   └── routes\              # 6 个路由模块
│   ├── data\                    # 数据库 & 上传目录
│   └── requirements.txt
├── frontend\
│   ├── src\
│   │   ├── lib\api.ts           # API 客户端
│   │   └── app\                 # 9 个页面路由
│   └── package.json
├── CLAUDE.md                    # 项目规范
├── README.md                    # 本文件
└── work.md                      # 工作进度
```
