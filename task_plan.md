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
- [ ] Phase 8: 提交并推送第一轮重构与验证基线
- [ ] Phase 9: 第二轮后端深度拆分
- [ ] Phase 10: 第二轮全量回归与服务重启

## Constraints
- 仅在 `/home/hxfeng/fhx-hit-agent` 中操作
- Python 环境统一使用 `fhx-hit-agent`
- 文档必须和真实代码、真实验证结果一致
- 不提交运行产物、缓存、测试中间文件

## Current Focus
- 提交当前第一轮重构成果
- 继续拆分 `schemas.py`、`qa.py`、`materials.py`、`discussion.py`
