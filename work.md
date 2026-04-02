# 工作进度 (work.md)

## 当前状态: v0.4 — 完整 MVP，所有核心功能可用

---

## 需求核对结果 (对照 claude_code_docs)

### MVP 核心闭环 (05_ClaudeCode_启动Prompt_v2.txt 第八条)

| # | 需求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 教师创建课程画像 | ✅ | `/teacher/course` 前端页面 + `POST /api/courses` |
| 2 | 上传课程资料与前沿资料 | ✅ | 教师工作台"上传资料"按钮 + `POST /api/materials/upload/{course_id}` |
| 3 | 触发前沿融课分析 | ⚠️ | 嵌入在课时包生成中 (frontier_topic + insert_position + risk_warning)，无独立步骤 |
| 4 | 生成结构化课时包 | ✅ | GLM-5 真实 AI 生成 14 字段结构化 JSON |
| 5 | 查看/编辑/保存/发布课时包 | ⚠️ | 查看+发布完整，编辑功能后端 API 已有 (`PUT`)，前端无编辑 UI |
| 6 | 查看教师复盘页 | ✅ | `/teacher/review` 展示高频/易混淆/盲区/建议 |
| 7 | 学生选择已发布课时包 | ✅ | `/student` 列出已发布课时包 |
| 8 | 围绕当前课时包提问 | ✅ | `/student/qa` 聊天式问答 |
| 9 | 获得课程边界内回答 | ✅ | `in_scope` 字段 + 超范围提示 |
| 10 | 查看延伸阅读/参考依据 | ✅ | QA 回答显示 `evidence`，课时包详情显示 `extended_reading` + `references` |
| 11 | 汇总学生问答日志 | ✅ | `qa_logs` 表 + `GET /api/analytics/{lp_id}` |
| 12 | 输出高频问题 | ✅ | `high_freq_topics` |
| 13 | 输出易混淆概念 | ✅ | `confused_concepts` |
| 14 | 输出知识盲区 | ✅ | `knowledge_gaps` |
| 15 | 输出教学建议 | ✅ | `teaching_suggestions` |

### 产品功能 (02_产品功能说明书)

| 功能 | 状态 | 说明 |
|------|------|------|
| 课程画像配置 | ✅ | |
| 资料上传 | ✅ | 支持 .txt/.md/.csv/.json |
| 前沿融课分析 | ⚠️ | 嵌入课时包，非独立步骤 |
| 课时包生成 | ✅ | 14 字段结构化输出 |
| 结果编辑与发布 | ⚠️ | 发布完成，编辑缺前端 UI |
| 课后问答 | ✅ | |
| 教师复盘 | ✅ | |

### 技术方案 (03_技术方案说明书)

| 模块 | 状态 | 说明 |
|------|------|------|
| Course 模块 | ✅ | CRUD 完整 |
| Material 模块 | ✅ | 上传+文本提取，无分片索引 |
| Generation 模块 | ✅ | GLM-5 真实调用 |
| Student QA 模块 | ✅ | GLM-5 + 边界约束 |
| Analytics 模块 | ✅ | GLM-5 分析 |
| Export 模块 | ❌ | 未实现 (非 MVP 必须) |
| RAG 检索 | ❌ | 未实现 (当前 LLM 直接生成) |

### 编码规范 (coding.md) 合规

| 要求 | 状态 | 说明 |
|------|------|------|
| AI 输出结构化 JSON | ✅ | 所有 LLM 调用返回结构化 JSON |
| 错误不能吞 | ✅ | 已修复所有 `.catch(() => {})` |
| UI 状态完整 | ✅ | loading/error/empty 三态 |
| 配置外置 | ⚠️ | API Key 仍在源码中硬编码 |
| 模块级注释 | ✅ | 关键模块有职责说明 |
| 不信任外部输入 | ⚠️ | 基本 Pydantic 校验，未做深度校验 |

### 文档 (05 启动 Prompt 第五条)

| 文档 | 状态 |
|------|------|
| CLAUDE.md | ✅ |
| user.md | ✅ |
| work.md | ✅ |

---

## 已完成功能

### 后端 (FastAPI + SQLite + 智谱 GLM-5)
- [x] FastAPI 骨架 (6 个路由模块)
- [x] SQLite 持久化 (4 表: courses, lesson_packs, qa_logs, materials)
- [x] 自动 seed demo 数据 (计算机网络-QUIC 课程 + 已发布课时包)
- [x] 课程 CRUD (创建/列表/详情)
- [x] 课时包生成 (GLM-5 真实 AI，失败回退 mock)
- [x] 课时包管理 (列表/详情/更新/发布)
- [x] 学生问答 (GLM-5，基于课时包上下文，课程边界约束)
- [x] 教师复盘 (GLM-5，基于真实 QA 日志分析)
- [x] 文件上传 (POST /api/materials/upload/{course_id})
- [x] LLM 服务模块 (llm_service.py，httpx 直接调用 REST API)
- [x] Mock 降级 (LLM 失败时自动回退 mock_data.py)

### 前端 (Next.js 16 + Tailwind CSS)
- [x] 首页 (角色选择)
- [x] 教师工作台 (课程列表 + 课时包管理 + 上传)
- [x] 创建课程页面 (表单验证)
- [x] 生成课时包页面 (含发布)
- [x] 课时包详情页面 (14 字段完整展示)
- [x] 教师复盘页面 (4 维分析报告)
- [x] 学生端 (选择已发布课时包)
- [x] 学生问答 (聊天式界面 + 范围提示 + 证据展示)
- [x] 错误状态处理 (所有页面 loading/error/empty 三态)

### AI 能力
| 功能 | 实现方式 | 状态 |
|------|---------|------|
| 课时包生成 | GLM-5 结构化 JSON 输出 | ✅ |
| 学生问答 | GLM-5 + 课时包上下文约束 | ✅ |
| 教师复盘 | GLM-5 + 真实 QA 日志分析 | ✅ |
| 课程边界检测 | Prompt 约束 in_scope 字段 | ✅ |

---

## 待完成

### 近期 (中期提交前 4月15日)
- [ ] 课时包前端编辑 UI (后端 PUT API 已就绪)
- [ ] 准备 1-2 门额外的演示课程数据
- [ ] 录制 AI 演示视频
- [ ] 准备比赛演示 PPT

### 后续 (决赛前 5月15日)
- [ ] 部署到哈工大 HiAgent 平台
- [ ] 补充 RAG 检索 (基于上传资料的真实检索增强)
- [ ] PDF/DOCX 文件解析
- [ ] 课时包导出功能

---

## 已知限制

1. **API Key 硬编码**: `llm_service.py` 中 API Key 写在源码里，应迁移到环境变量
2. **无 RAG**: 当前 LLM 调用未使用上传资料，直接基于 prompt 生成
3. **无编辑 UI**: 课时包 PUT API 已有，但前端无编辑界面
4. **无文件大小限制**: 上传接口未限制文件大小
5. **无认证**: 前后端无登录/权限控制 (MVP 阶段可接受)
6. **前沿融课分析非独立步骤**: 嵌入在课时包生成中，产品规格书要求独立步骤

---

## 关键技术决策

1. **LLM 选择**: 智谱 AI GLM-5，通过 OpenAI 兼容 API 调用
2. **HTTP 客户端**: httpx 直接调用 REST API (Python 3.7 无法用 openai SDK>=1.0)
3. **降级策略**: LLM 调用失败自动回退 mock 数据
4. **代理**: 需要代理 (127.0.0.1:7897) 访问智谱 API

---

## 关键修复记录
1. main.py 中文引号语法错误
2. Python 3.7: `list[str]` → `List[str]`, 需 `from __future__ import annotations`
3. Next.js 16: `useSearchParams()` 需 `<Suspense>` 包裹
4. StudentQuestion schema 多余的 lesson_pack_id 字段
5. httpx 0.24.x 用 `proxies` 而非 `proxy` 参数
6. 路由函数名与导入同名导致递归调用 (已用 `as` 别名修复)
7. GLM-5 思维链模式: `max_tokens` 需要设大 (4096+)，否则内容被推理消耗
8. 模块级代理变量时机问题 → 改为延迟读取函数
9. 前端错误处理: 修复所有 `.catch(() => {})` 静默吞错

---

## 本轮改动

### 完成内容
- 全面需求审计 (对照 05 启动 Prompt + coding.md + 产品/技术规格书)
- 修复所有前端页面错误处理 (5 个页面的 `.catch(() => {})`)
- 添加 loading/error/empty 三态到所有数据加载页面
- 验证后端所有 API 端点可用
- 验证前端构建成功
- 更新 work.md

### 关键文件变更
- 修改: `frontend/src/app/teacher/page.tsx` — 添加错误状态和重试
- 修改: `frontend/src/app/teacher/review/page.tsx` — 添加错误状态和重试
- 修改: `frontend/src/app/teacher/lesson-pack/[id]/page.tsx` — 添加错误状态和重试
- 修改: `frontend/src/app/student/page.tsx` — 添加错误状态和重试
- 修改: `frontend/src/app/student/qa/page.tsx` — 添加 packError 状态
- 修改: `work.md` — 完整重写
