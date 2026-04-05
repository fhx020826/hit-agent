# 用户偏好 (user.md)

## 基本信息
- 赛事: 哈工大 AI 智能体大赛 - 教师赛道
- 项目: 前沿融课教师助手
- 团队: 教师赛道参赛团队
- 远程仓库: https://github.com/fhx020826/hit-agent

## 工作偏好
- 语言: 中文交流，英文代码标识符
- 风格: 直接执行，不需要过多讨论
- 输出格式: 每轮对话结束后必须给出 进展/文件变更/运行状态/Git状态/清理建议/下一步安排
- 要求代码可直接运行，不要留报错给用户处理

## 技术偏好
- 后端: Python + FastAPI
- 前端: Next.js + TypeScript + Tailwind CSS
- 数据库: SQLite（轻量 MVP）
- LLM: 智谱 AI GLM-5，通过 httpx 调用 REST API（不用 openai SDK）
- 不使用过于复杂的架构

## 技术约束（已踩过的坑，务必注意）
1. Python 3.7 兼容: 必须 `from __future__ import annotations`，`List[str]` 不是 `list[str]`
2. httpx 0.24.x: 参数名是 `proxies=` 不是 `proxy=`
3. Next.js 16: `useSearchParams()` 必须包裹 `<Suspense>`
4. GLM-5 思维链: `max_tokens` 必须 4096+，否则内容为空
5. 路由函数名不能与导入同名，用 `as` 别名
6. 代理变量必须在函数内延迟读取，不能模块顶层求值
7. 前端错误不能静默吞，不要写 `.catch(() => {})`

## 文档要求
- 提交信息: 中文描述 + 简要英文前缀 (feat:/fix:/docs:/refactor:)
- 频率: 每完成一个阶段提交一次
- 维护 CLAUDE.md / user.md / work.md 三个文件
- work.md 每轮更新，发现旧内容过时直接修正而不是只追加

## 时间约束
- 中期评审: 2026-04-15
- 最终评审: 2026-05-15
- MVP 优先级: 功能完整 > 可运行演示 > UI 美观 > 性能优化
