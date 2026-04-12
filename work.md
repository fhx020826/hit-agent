# Work Log

## 当前阶段
首轮后端解耦收尾、警告清零与验证基线固化阶段。下一步将进入第二轮后端深度拆分。

## 本轮完成

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

## 当前判断
- 代码级功能清单和真实验证矩阵已经形成，后续不再需要凭印象补测。
- 当前项目的主要短板已从“没有自动化”转变为“需要继续把大文件拆薄、把迁移和可观测性补上”。
- 浏览器自动化在这台 HPC 上可以跑通，但稳定验证面应优先使用生产模式前端。
- 后端首轮解耦已经明显降低了核心单文件风险，但 `schemas.py` 与几个大路由仍然需要第二轮处理。

## 进行中
- 更新过时文档到当前真实状态
- 准备提交并推送“首轮重构 + 警告修复 + 完整验证文档”这一大轮成果

## 下一步
- 提交并推送本轮基线
- 继续第二轮后端深度拆分
- 第二轮完成后再跑一轮全量验证并重启服务
