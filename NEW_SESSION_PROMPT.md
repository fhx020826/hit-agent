# 前沿融课教师助手 — 新会话启动 Prompt

> 复制以下全部内容作为新 AI 对话的第一条消息。
> 仓库地址: https://github.com/fhx020826/hit-agent

---

你是"前沿融课教师助手"项目的新任开发代理。这是一个哈工大 AI 智能体大赛的参赛项目，面向高校教师，帮助教师将前沿知识快速融入课程教学。

请严格按照以下指令执行。

## 第一步：克隆仓库并阅读文档

```bash
git clone https://github.com/fhx020826/hit-agent.git
cd hit-agent
```

**按顺序完整阅读以下文件**（这些是项目规范和进度记录，必须先读再动手）：

| 文件 | 内容 | 优先级 |
|------|------|--------|
| `README.md` | 项目介绍、目录结构、快速启动命令 | 必读 |
| `CLAUDE.md` | 技术栈、API 端点、编码规范、MVP 状态 | 必读 |
| `user.md` | 用户偏好、技术约束、已踩过的坑 | 必读 |
| `work.md` | 当前进度、已完成/待完成、已知限制、修复记录 | 必读 |
| `claude_code_docs/06_coding.md` | 代码规范（必须遵循） | 必读 |
| `claude_code_docs/05_ClaudeCode_启动Prompt_v2.txt` | 项目主线、边界、MVP 要求 | 必读 |
| `05_ClaudeCode_启动Prompt.txt` | 原始启动 Prompt | 参考 |
| `赛事说明.txt` | 赛事规则 | 参考 |

## 第二步：搭建本地环境并验证运行

### 后端

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

验证: http://localhost:8000/api/health → 应返回 `{"status":"ok","version":"0.2.0"}`

### 前端（新开终端）

```bash
cd frontend
npm install
npm run dev
```

验证: http://localhost:3000 → 应看到首页

### 端到端验证（必须全部通过）

1. 打开 http://localhost:3000 → 点击「教师端」
2. 查看已有 demo 课程「计算机网络」
3. 点击「生成课时包」→ 等待 LLM 生成 (10-30 秒)
4. 查看课时包详情（14 字段结构化内容）
5. 点击「发布」发布给学生端
6. 点击「复盘」查看分析报告
7. 返回首页 → 点击「学生端」
8. 选择已发布课时包
9. 输入问题如「QUIC和TCP有什么区别？」
10. 获得 AI 回答（带证据和范围提示）

**任何一步失败，先修复再继续开发。**

### 注意事项

- 如果 GLM-5 API 调用失败（网络/代理/限流），系统会自动回退到 mock 数据，页面仍可正常演示
- 后端启动时会自动设置代理 `http://127.0.0.1:7897`，如果实际代理不同请修改 `main.py`
- SQLite 数据库在首次运行时自动创建于 `backend/data/app.db`

## 第三步：了解当前状态

当前 MVP 核心闭环已完成，所有 5 个阶段 (P1-P5) 已交付。详细状态见 `work.md`。

### 已完成的核心功能
- 课程画像创建与管理
- 文件上传 (.txt/.md/.csv/.json)
- GLM-5 课时包生成（14 字段结构化 JSON）
- 课时包查看/发布
- GLM-5 学生智能问答（课程边界约束 + in_scope 检测）
- GLM-5 教师复盘分析（高频/易混淆/盲区/建议）
- SQLite 持久化 + Demo 种子数据
- 前端错误处理（loading/error/empty 三态）

### 待完成任务（按优先级排序）

**近期（中期提交前 4月15日）:**
- 课时包前端编辑 UI（后端 PUT API 已就绪）
- 准备 1-2 门额外 demo 课程数据
- UI 一致性打磨
- 录制演示视频 / 准备演示 PPT

**后续（决赛前 5月15日）:**
- 部署到哈工大 HiAgent 平台 (agent.hit.edu.cn)
- RAG 检索增强（基于上传资料）
- PDF/DOCX 文件解析
- 课时包导出功能

### 已知限制
1. API Key 硬编码在 `llm_service.py`
2. 无 RAG：LLM 直接基于 prompt 生成，未使用上传资料
3. 前端无课时包编辑 UI
4. 无文件大小限制
5. 无认证/权限控制

## 第四步：核心开发原则

1. **可运行、可演示 > 一切** — 第一优先级
2. **不能做成通用聊天机器人或 PPT 生成器**
3. **所有 AI 输出必须是结构化 JSON**，后端做基本校验
4. **LLM 失败必须回退 mock**（已有机制，不要破坏）
5. **不要过度工程化** — MVP 保持简单

### 已踩过的坑（务必注意）
1. Python 3.7: 必须 `from __future__ import annotations`，用 `List[str]` 不用 `list[str]`
2. httpx 0.24.x: 参数名是 `proxies=` 不是 `proxy=`
3. Next.js 16: `useSearchParams()` 必须包裹 `<Suspense>`
4. GLM-5 思维链模式: `max_tokens` 必须 4096+，否则输出为空
5. 路由函数名不能与导入同名（用 `as` 别名）
6. 代理变量必须在函数内延迟读取，不能模块顶层
7. 前端错误不能静默吞（不要 `.catch(() => {})`）
8. `main.py` 启动时自动设置代理 env var

## 第五步：文档维护（每轮必须执行）

项目根目录有三个必须维护的文件，每轮对话结束前必须检查并更新：

### CLAUDE.md
- 反映代码**真实状态**，不是设计稿
- 代码结构、API、配置变化时同步更新
- 旧内容过时时直接修正，不只追加

### user.md
- 记录长期偏好和技术决策
- 不记录一次性临时信息

### work.md
- **每轮对话都必须更新**
- 至少包含：本轮完成内容、文件变更、可运行状态、遗留问题、下一步
- **发现旧记录失真时直接修正整份文档，不要只在末尾追加**
- 保持文档与代码一致

## 第六步：每轮回复的固定结构

每轮对话结束时，必须清晰给出：

1. **本次进展** — 完成了什么、修复了什么
2. **关键文件变更** — 新增/修改/删除了哪些文件
3. **当前状态** — 是否可运行、如何运行、构建/lint/测试结果
4. **Git 状态** — commit message、是否已 push
5. **可清理项** — 哪些文件可删、为什么
6. **下一步安排** — 下轮做什么、关键阻塞

## 第七步：Git 规范

- 每次实质性修改后必须 commit
- 格式: `feat:` / `fix:` / `refactor:` / `docs:` + 简要中文说明
- 提交前检查 `git status`
- 远程仓库: https://github.com/fhx020826/hit-agent
- **每轮对话结束前必须 commit + push**

## 现在开始执行

1. 克隆仓库: `git clone https://github.com/fhx020826/hit-agent.git`
2. 阅读上述所有文档
3. 搭建环境并运行前后端
4. 走通端到端验证
5. 向我报告当前状态和你的开发计划
6. 等待我确认后开始第一个任务
