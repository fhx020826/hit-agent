# Project Overview

## 项目定位
`fhx-hit-agent` 已经不是单纯原型，而是一个可运行的“面向前沿学科的智能教学平台”。核心目标是把教师的课程设计、资料更新、课堂互动、作业闭环和反馈分析放到同一套前后端系统里，学生端则围绕课程专属 AI 助教、资料、作业、反馈和讨论空间展开。

## 当前技术架构

### 前端
- Next.js 16
- React 19
- TypeScript
- App Router
- Playwright 浏览器自动化

### 后端
- FastAPI
- SQLAlchemy
- SQLite
- `httpx`
- `pypdf`

### 本地运行与协作
- 独立 conda 环境：`fhx-hit-agent`
- 一键脚本：
  - `scripts/dev-up.sh`
  - `scripts/dev-down.sh`
  - `scripts/dev-status.sh`
- 双 remote：
  - `origin=https://github.com/fhx020826/hit-agent.git`
  - `upstream=https://github.com/wishmyself/hit-agent.git`

## 当前真实已实现能力

### 教师端
- 课程创建与课程画像填写
- 课程包生成、查看、发布
- AI 助教配置
- 教学资料上传、共享、资料请求处理
- 课堂同步展示与实时批注
- PPT / 教案更新建议与回退预览
- 作业发布、学生提交查看、AI 辅助批改预览
- 学生提问中心、通知、回复、状态流转
- 匿名问卷触发与反馈分析
- 课程讨论空间

### 学生端
- 课程专属 AI 助教问答
- 多轮会话、问题历史、收藏、文件夹归档
- 问答附件上传
- 课堂共享资料查看与资料请求
- 作业确认、提交、重提、下载
- 匿名课堂反馈提交与跳过
- 薄弱点分析
- 课程讨论空间与附件消息
- 实时课堂同步查看

### 管理员端
- 用户列表、搜索、角色过滤
- 新建用户
- 删除用户
- 更新用户资料

### 兼容与支持接口
- `/api/student/*`
- `/api/users/*`
- 资料下载、头像访问、课程详情、反馈模板等支持型接口

完整代码基线文档：
- `docs/internal/complete-feature-list.md`
- `docs/internal/complete-feature-verification-matrix.md`

## 当前工程化基线

### 自动化验证
2026-04-12 最新验证结果：
- 一键验证：
  - `bash scripts/verify-all.sh` -> 通过
- 后端：`cd backend && pytest -q` -> `13 passed`
- 前端：`cd frontend && npm run lint` -> 通过
- 前端：`cd frontend && npm run build` -> 通过
- 浏览器原子/扩展回归：
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts tests/user-journeys.spec.ts`
  - 结果：`10 passed`

说明：
- 浏览器验证在当前 HPC 机器上可稳定运行。
- 当前稳定验证使用的是生产模式前端服务面；Next 开发服务器与 Playwright runner 在这台机器上存在不稳定组合，需要单独记录。
- `scripts/verify-all.sh` 会自动寻找空闲验证端口，并把所选前端端口传回后端 CORS 配置，避免与常驻 `3000/8000` 服务冲突。
- 最新一轮验证是在重启后的最新前后端服务上完成，不是基于旧进程。

### 文档与测试覆盖
- 已有完整功能清单
- 已有逐功能验证矩阵
- 已有自动化测试目录文档：
  - `docs/internal/automation-test-catalog.md`
- 后端已覆盖主模块 API 冒烟与扩展兼容接口
- 前端已覆盖真实浏览器原子交互、扩展交互和复杂多步骤用户旅程

## 后端解耦进展

### 第一轮已完成
- 数据库层已从单文件拆为：
  - `backend/app/db/paths.py`
  - `backend/app/db/session.py`
  - `backend/app/db/models.py`
  - `backend/app/db/bootstrap.py`
- `backend/app/database.py` 保留为兼容导出 facade
- LLM 服务已拆为：
  - `backend/app/services/llm_runtime.py`
  - `backend/app/services/file_extractors.py`
  - `backend/app/services/llm_generation.py`
- `backend/app/services/llm_service.py` 保留为兼容 facade
- 已抽出：
  - `backend/app/services/materials_service.py`
  - `backend/app/services/qa_service.py`

### 第二轮已完成
- `backend/app/models/schemas.py` 已拆为按领域组织的 schema 模块，并保留兼容 facade
- `backend/app/db/models.py` 已拆为按领域组织的 ORM 模块，并保留兼容 facade
- `backend/app/routes/qa.py` 的展示/序列化 helper 已下沉到 `backend/app/services/qa_service.py`

### 第三轮已完成
- `backend/app/routes/materials.py` 的资料共享、资料请求、课堂直播、批注序列化等逻辑已下沉到 `backend/app/services/materials_service.py`
- `backend/app/routes/discussion.py` 的空间访问控制、消息序列化、消息搜索、上下文回溯、AI 回复链路等逻辑已下沉到 `backend/app/services/discussion_service.py`
- 大文件收缩效果：
  - `backend/app/routes/materials.py`: `470 -> 193`
  - `backend/app/routes/discussion.py`: `388 -> 104`

### 仍需后续继续拆分
- `materials_service.py` 与 `discussion_service.py` 现在承接了较多领域逻辑，后续可以继续再按“共享 / 请求 / 直播”和“空间 / 消息 / 搜索 / AI 回答”进一步细分
- 当前剩余优化重点已经从“路由过厚”转向“service 内部再细分”和“数据库迁移 / 可观测性基线”

## 当前工程判断

### 优点
- 功能闭环完整，教师与学生两端都不是空壳页面
- 真实后端数据链路齐全
- 浏览器自动化与 API 自动化都已建立
- 文档开始从“功能概述”进化为“代码对齐 + 验证对齐”

### 主要风险
- SQLite 仍然只是开发/演示型数据库
- 还没有数据库迁移体系
- 路由层主要厚路由已完成三轮拆分，后续重点转向大 service 的再细分
- 日志、监控、可观测性仍然偏弱
- 当前稳定浏览器验证依赖生产模式前端；开发模式测试面还要单独收敛

## 下一步优先级

### 第一优先级
- 继续把 `materials_service.py` / `discussion_service.py` 进一步按子域细分
- 保持 `complete-feature-list` 与验证矩阵同步
- 固化浏览器验证的稳定运行面
- 维持 `verify-all.sh` 作为提交前统一准入入口

### 第二优先级
- 引入数据库迁移
- 增强日志与错误追踪
- 继续薄化路由层，提升服务层聚合度

### 第三优先级
- 梳理部署面与运行模式
- 清理冗余 handoff / 中间文档
- 继续扩大前端回归覆盖面

## 当前结论
从功能完整性、自动化验证深度和后端解耦程度看，当前代码已经完成你本轮提出的核心要求；下一阶段的重点不再是“把核心功能补齐”，而是“继续优化 service 粒度、迁移体系和可观测性”。
