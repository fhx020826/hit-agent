# Work Log

## 当前阶段
第二轮后端深度拆分完成，当前进入“保持大文件继续瘦身 + 稳定回归面固化”阶段。

## 本轮完成

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
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts`
  - `8 passed`
- 服务运行面：
  - 前端生产模式 `next start` 运行在 `3000`
  - 后端 `uvicorn app.main:app --host 0.0.0.0 --port 8000` 运行在 `8000`
  - `GET /api/health` 返回 `{"status":"ok","version":"0.8.0"}`

## 当前判断
- 代码级功能清单和真实验证矩阵已经形成，后续不再需要凭印象补测。
- 当前项目的主要短板已从“没有自动化”转变为“需要继续把大文件拆薄、把迁移和可观测性补上”。
- 浏览器自动化在这台 HPC 上可以跑通，但稳定验证面应优先使用生产模式前端。
- 第二轮已经把 schema、ORM 模型与 QA 路由进一步拆薄，后续重点收敛到 `materials.py`、`discussion.py` 等剩余大路由。

## 进行中
- 更新过时文档到当前真实状态
- 准备提交并推送“第二轮后端拆分 + 全量稳定验证”这一轮成果

## 下一步
- 提交并推送本轮第二轮重构成果
- 继续评估 `materials.py`、`discussion.py` 的第三轮拆分
- 视需要补数据库迁移、日志与可观测性基线
