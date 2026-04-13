# Task Plan

## Goal
在 `/home/hxfeng/fhx-hit-agent` 内完成三件事：
1. 保证功能文档与真实代码完全对齐；
2. 形成逐功能的自动化验证基线并持续回归；
3. 推进后端从“大文件集中实现”向“高内聚低耦合模块化”演进。

## Phases
- [x] Phase 1: 环境、代理、仓库与长期维护文档建立
- [x] Phase 2: 后端基础冒烟测试建立
- [x] Phase 3: 在线真实教师/学生链路验证
- [x] Phase 4: 完整功能清单整理
- [x] Phase 5: 前端真实浏览器原子与扩展回归建立
- [x] Phase 6: 第一轮后端结构拆分
- [x] Phase 7: 当前 warning 清零并完成最新基线验证
- [x] Phase 8: 提交并推送第一轮重构与验证基线
- [x] Phase 9: 第二轮后端深度拆分
- [x] Phase 10: 第二轮全量回归与服务重启
- [x] Phase 11: 统一验证入口、复杂用户旅程回归与自动化目录文档
- [x] Phase 12: 第三轮 `materials` / `discussion` 路由深拆与全量回归
- [x] Phase 13: 阿里云 ECS 基础运维面打通（SSH / 代理 / Codex）
- [x] Phase 14: 输出 ECS 正式部署运行手册与服务器 Codex Prompt

## Constraints
- 仅在 `/home/hxfeng/fhx-hit-agent` 中操作
- Python 环境统一使用 `fhx-hit-agent`
- 文档必须和真实代码、真实验证结果一致
- 不提交运行产物、缓存、测试中间文件

## Current Focus
- 代码侧第三轮深拆与全量回归已完成
- 阿里云 ECS 的 SSH / 代理 / Codex 基础运维面已打通
- 已完成正式部署前的运行手册与 Prompt 整理
- 下一阶段转为：服务器侧修复可移植性、安装依赖、跑全量测试、创建长期运行服务
