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
- [x] Phase 15: 在 ECS 上直接尝试正式部署并确认真实硬件瓶颈
- [x] Phase 16: 准生产简化版持久化加固（外置数据目录 / SQLite 加固 / 备份恢复）
- [x] Phase 17: 前端统一设计语言重构（桌面/移动差异化 + 测试同步更新 + 全量回归）
- [x] Phase 18: 轻量异步任务中心第一阶段（lesson pack / material-update 异步化 + 全量回归）
- [ ] Phase 19: `assignment-review` 接入异步任务中心并完成新一轮全量回归

## Constraints
- 仅在 `/home/hxfeng/fhx-hit-agent` 中操作
- Python 环境统一使用 `fhx-hit-agent`
- 文档必须和真实代码、真实验证结果一致
- 不提交运行产物、缓存、测试中间文件

## Current Focus
- 轻量异步任务中心第一阶段已完成并通过统一全量验证
- lesson pack / material-update 已切到后台任务流，旧同步接口仍保留兼容
- 当前优先策略已切换为“先逐个修 bug，再继续后续优化”
- 当前下一优先级：
  - 把 `assignment-review` 纳入异步任务中心
  - 继续细分 `materials_service.py` / `discussion_service.py`
  - 维持 `verify-all.sh` 作为提交前统一门禁
  - 等本地继续优化收敛后，再统一部署到 ECS
- Phase 19 预定执行顺序：
  1. 复用现有 `task_jobs` handler 模式接入 assignment-review
  2. 保留 `POST /api/assignment-review/preview` 同步接口兼容
  3. 新增 assignment-review 异步提交接口和前端轮询状态
  4. 扩展 `backend/tests/test_task_jobs.py`
  5. 如页面语义变化则更新 Playwright 用例
  6. 跑 `bash scripts/verify-all.sh`
  7. 更新项目维护文档与功能/验证文档
- 当前额外运维阻塞：
  - 阿里云 ECS `8.152.202.171` 已在重启后恢复，并已更新到 `3f85001`
  - 当前前后端服务已重新上线，公网访问已恢复
  - 若继续使用该服务器作为长期稳定部署目标，建议最终升配到 `4C8G`；`2C4G` 只作为最低可接受备选
- 当前已完成 bugfix：
  - 首页及主入口页对内标注清理，并已通过真实浏览器断言验证
  - 首页夜间主题整页入口可读性修复，并已通过真实浏览器截图与夜间模式颜色断言验证
