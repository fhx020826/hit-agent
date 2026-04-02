# 工作进度 (work.md)

## 当前状态: MVP 功能完整，前后端联调通过

### 已完成
- [x] 后端 FastAPI 骨架 (5 个路由模块 + SQLite)
- [x] SQLite 持久化 (自动 seed demo 数据)
- [x] 文件上传端点 (POST /api/materials/upload/{course_id})
- [x] Pydantic 数据模型定义
- [x] Mock 数据服务 (demo 计算机网络课程)
- [x] 前端 Next.js 16 项目 (9 路由)
- [x] 教师端 4 页面 + 学生端 2 页面
- [x] 首页 UI 重设计 (流程展示 + 特性卡片)
- [x] 教师工作台集成上传按钮
- [x] 前后端联调验证通过
- [x] Python 3.7 兼容性修复
- [x] Git 初始化 (6 次提交)

### 待完成 (需要用户提供)
- [ ] **真实 LLM 接入** — 需要 API Key (OpenAI/Claude/智谱/DeepSeek)
- [ ] **Git push** — 需要远程仓库地址

### 运行方式
```bash
# 终端 1: 后端
cd backend && .venv/Scripts/activate
uvicorn app.main:app --reload --port 8000

# 终端 2: 前端
cd frontend && npm run dev
```
访问 http://localhost:3000

### 关键修复记录
1. main.py 中文引号语法错误
2. Python 3.7 不支持 list[str]/dict[str,X]/str|None
3. Next.js 16 useSearchParams 需要 Suspense
4. StudentQuestion schema 多余的 lesson_pack_id 字段
