# Frontend Redesign Implementation Plan

> Completion note 2026-04-14: this plan is now closed. The shared shell/token layer plus targeted page rewrites delivered the intended unified design language, and the full verification stack passed after syncing outdated selectors to the new UI semantics.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改后端接口的前提下，完成 HIT-Agent 前端统一设计语言重构，并支持桌面端与移动端的差异化体验。

**Architecture:** 保留现有页面路由和数据调用层，新增共享视觉组件与响应式布局骨架，再逐页替换现有页面容器与信息结构。优先改全局样式和工作台，再覆盖复杂工作页与设置页，最后跑全量验证。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Playwright

---

### Task 1: 建立共享视觉骨架

**Files:**
- Create: `frontend/src/components/workspace-shell.tsx`
- Create: `frontend/src/components/workspace-panels.tsx`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/components/app-shell.tsx`
- Test: `frontend/tests/atomic-features.spec.ts`

- [x] 梳理当前全局布局与移动端断点需求，定义新的 shell 层级和视觉 token。
- [x] 在 `globals.css` 中重建主题变量、背景层、响应式间距和全局通用类。
- [x] 新增共享工作台组件，承载 hero、分区、信号条、移动端导航等。
- [x] 用新骨架替换 `AppShell` 的主布局，但保留现有认证、语言、外观、导航逻辑。
- [x] 运行 `cd frontend && npm run lint`

### Task 2: 重写首页与公共入口页

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/auth-modal.tsx`
- Modify: `frontend/src/app/profile/page.tsx`
- Modify: `frontend/src/app/settings/page.tsx`
- Test: `frontend/tests/atomic-features.spec.ts`

- [x] 把首页改成海报式入口页，强化首屏、角色价值和主动作。
- [x] 调整登录/注册弹窗的视觉结构，但保留现有字段、占位文本和角色流程。
- [x] 重写个人资料页和设置页的布局层次，使其更适合桌面与移动端。
- [x] 保持关键功能链路稳定；若旧测试只依赖旧 DOM 结构，则同步更新测试而非反向牺牲新界面。
- [x] 运行 `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts`

### Task 3: 重写教师端工作台与教师主流程页

**Files:**
- Modify: `frontend/src/app/teacher/page.tsx`
- Modify: `frontend/src/app/teacher/course/page.tsx`
- Modify: `frontend/src/app/teacher/lesson-pack/page.tsx`
- Modify: `frontend/src/app/teacher/ai-config/page.tsx`
- Modify: `frontend/src/app/teacher/material-update/page.tsx`
- Test: `frontend/tests/atomic-features.spec.ts`

- [x] 把教师工作台改成任务驱动式布局，而不是模块卡片列表。
- [x] 重构课程创建、课程包生成、AI 配置和材料更新页面的页面头部、表单结构和结果呈现。
- [x] 在桌面端引入更强的上下文区，在移动端改成单列分段流程。
- [x] 保留现有字段和 API 调用逻辑；重复 CTA 等真实交互歧义则直接修正界面。
- [x] 运行 `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts`

### Task 4: 重写教师复杂工作页

**Files:**
- Modify: `frontend/src/app/teacher/materials/page.tsx`
- Modify: `frontend/src/app/teacher/discussions/page.tsx`
- Modify: `frontend/src/app/teacher/assignments/page.tsx`
- Modify: `frontend/src/app/teacher/questions/page.tsx`
- Modify: `frontend/src/app/teacher/feedback/page.tsx`
- Modify: `frontend/src/app/teacher/review/page.tsx`
- Modify: `frontend/src/app/teacher/assignment-review/page.tsx`
- Test: `frontend/tests/atomic-features.spec.ts`
- Test: `frontend/tests/extended-coverage.spec.ts`

- [x] 把资料、讨论、作业、提问、反馈等页面统一纳入新的 workspace 视觉语言。
- [x] 增强表格/列表/筛选区的层级和移动端折叠策略。
- [x] 保留现有业务组件，如 `discussion-workspace` 和 `live-annotation-board`，主要调整其外围容器和上下文区域。
- [x] 兼顾桌面信息密度与手机端可操作性。
- [x] 运行 `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts`

### Task 5: 重写学生端工作台与学生主流程页

**Files:**
- Modify: `frontend/src/app/student/page.tsx`
- Modify: `frontend/src/app/student/qa/page.tsx`
- Modify: `frontend/src/app/student/materials/page.tsx`
- Modify: `frontend/src/app/student/assignments/page.tsx`
- Modify: `frontend/src/app/student/questions/page.tsx`
- Modify: `frontend/src/app/student/feedback/page.tsx`
- Modify: `frontend/src/app/student/weakness/page.tsx`
- Modify: `frontend/src/app/student/discussions/page.tsx`
- Test: `frontend/tests/atomic-features.spec.ts`
- Test: `frontend/tests/user-journeys.spec.ts`

- [x] 把学生工作台改成“当前学习状态 + 当前任务”的结构。
- [x] 重构课程问答、资料、作业、归档、反馈、薄弱点等页面的层次与移动端体验。
- [x] 保留当前问答模式和历史链路，若界面语义变化则同步更新测试。
- [x] 优先提升学生端在手机上的浏览与提交体验。
- [x] 运行 `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/user-journeys.spec.ts`

### Task 6: 重写管理员页与边缘页面

**Files:**
- Modify: `frontend/src/app/admin/users/page.tsx`
- Modify: `frontend/src/app/student/settings/page.tsx`
- Modify: `frontend/src/app/teacher/settings/page.tsx`
- Modify: `frontend/src/app/student/register/page.tsx`
- Modify: `frontend/src/app/teacher/register/page.tsx`
- Modify: `frontend/src/app/teacher/lesson-pack/[id]/page.tsx`
- Test: `frontend/tests/extended-coverage.spec.ts`

- [x] 提升管理员页的信息密度、筛选效率和状态显示。
- [x] 让教师/学生设置页在统一设计语言下保持角色一致性。
- [x] 对边缘页面和详情页做同风格收尾，避免主页面改完、细页掉队。
- [x] 运行 `cd frontend && npm run test:e2e -- tests/extended-coverage.spec.ts`

### Task 7: 全量回归与文档同步

**Files:**
- Modify: `project.md`
- Modify: `work.md`
- Modify: `findings.md`
- Modify: `task_plan.md`
- Test: `scripts/verify-all.sh`

- [x] 更新项目文档，记录新的前端设计方向、主要结构变化和移动端策略。
- [x] 清理本轮浏览器运行产物，确保工作区干净。
- [x] 运行 `bash scripts/verify-all.sh`
- [x] 检查 `git status --short`
- [ ] 提交并推送最终结果
