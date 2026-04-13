# HIT-Agent Frontend Redesign Spec

## Goal
在不改动现有后端接口、角色权限、自动化测试主链路的前提下，重写前端表现层，形成统一、精致、可扩展的桌面端与移动端双端体验。

## Scope
- 保留所有现有页面路由与 API 调用方式
- 重做全局视觉语言、导航结构与页面布局节奏
- 优化教师端、学生端、管理员端的工作台与核心工作页
- 明确桌面端与移动端的差异化布局策略
- 保持 Playwright 与 API 自动化测试可继续通过

## Non-Goals
- 不新增后端接口
- 不删除现有功能
- 不重构认证、权限或数据模型
- 不引入新的前端状态管理框架

## Visual Direction

### Core Thesis
整体风格采用“理性编辑感 + 科研控制台 + 高级教学产品”路线，而不是继续沿用当前偏平均化的玻璃卡片堆叠。页面要体现“教学工作台”的秩序感，而不是普通 SaaS 面板。

### Role-Specific Tonal Split
- 首页与公共区域：海报式首屏、编辑感留白、强主标识
- 教师端：深墨蓝为主，少量铜金或暖白作强调，呈现“教学指挥台”
- 学生端：冷白与青绿作为主基调，更轻、更聚焦，呈现“学习工作区”
- 管理员端：石墨灰与高对比状态色，呈现“系统运营台”

### Design Principles
- 第一屏必须有强视觉锚点和清晰唯一主动作
- 用布局层次解决信息问题，而不是继续叠更多卡片
- 桌面端强调工作流和上下文，移动端强调任务优先和短路径操作
- 保留现有中文文案与表单语义，避免测试选择器大面积失效

## UX Architecture

### Global Shell
- 桌面端改为“左侧主导航 + 顶部上下文条 + 主内容区 + 可选侧栏”的结构
- 移动端改为“顶部品牌条 + 底部一级导航 + 抽屉二级功能”的结构
- 右上角继续保留账号与外观设置入口，但表现改为更轻的个人控制面板

### Home Page
- 从说明型首页改为产品入口型首页
- 第一屏只保留：
  - 产品主张
  - 登录 / 进入工作台主动作
  - 教师 / 学生价值并列视觉区
- 第二屏再做“真实能力证明”和“功能分层”

### Teacher Workspace
- 工作台从模块列表改成任务总览
- 首页结构改为：
  - 顶部欢迎区 + 今日状态
  - 待处理问题 / 作业 / 反馈 / 课程状态
  - 最近课程与快捷入口
  - 右侧情报栏或下方趋势区

### Student Workspace
- 更强调“当前课程”“当前要做什么”
- 首页结构改为：
  - 当前学习状态
  - 最近共享资料
  - 当前问答入口
  - 待处理作业
  - 薄弱点与反馈状态

### Admin Workspace
- 当前仅有 `/admin/users`，但表现要更像管理控制台
- 强化搜索、筛选、批量操作和信息密度

## Responsive Strategy

### Desktop
- 以 1280px 以上为主设计面
- 页面允许更明显的分栏、粘性信息区、信息概览条
- 复杂工作页优先 Workspace 化

### Tablet
- 保留顶部和侧栏的核心结构，但减少并列栏数
- 次级信息折叠为抽屉或分段区块

### Mobile
- 不简单缩放桌面布局
- 工作台页面改为单列任务流
- 表单页采用分段卡组 + sticky 底部操作区
- 导航采用底部高频入口，减少顶部拥挤导航

## Component Strategy

### Shared Layer
新增一批共享展示组件，但不引入新的数据层：
- dashboard hero
- workspace section
- stat rail / signal strip
- responsive content header
- mobile bottom nav
- compact action group
- empty state / status panel

### Existing Components To Preserve
- `auth-provider`
- `appearance-provider`
- `language-provider`
- `discussion-workspace`
- `live-annotation-board`
- `rich-answer`

这些组件保留其业务职责，只调整容器与视觉表现。

## Page Priorities

### Phase A
- `/`
- `AppShell`
- `/teacher`
- `/student`
- `/admin/users`

### Phase B
- `/teacher/materials`
- `/teacher/discussions`
- `/teacher/assignments`
- `/teacher/questions`
- `/student/qa`
- `/student/materials`
- `/student/assignments`

### Phase C
- `/profile`
- `/settings`
- `/teacher/course`
- `/teacher/lesson-pack`
- `/teacher/ai-config`
- `/teacher/feedback`
- `/student/questions`
- `/student/feedback`
- `/student/weakness`

## Testing Constraints
- 保持现有表单 label、按钮名称和关键 heading 文案不被随意更改
- 若视觉重构导致 Playwright 文本断言有歧义，需要收紧测试选择器，而不是改动接口行为
- 每阶段完成后都要跑：
  - `npm run lint`
  - `npm run build`
  - 相关 Playwright 回归
- 全部完成后跑：
  - `bash scripts/verify-all.sh`

## Success Criteria
- 首页、教师端、学生端、管理员端形成统一但有角色区分的设计语言
- 手机端不再是桌面端简单压缩版
- 页面信息层次更强，首屏更有记忆点
- 现有接口与功能全部保留
- 自动化验证继续通过
