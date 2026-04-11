# Work Log

## 当前阶段
测试基线扩展与在线链路验证阶段。

## 本轮完成
- 确认只能通过交互式 shell 调用 `clash` / `proxy`
- 成功验证 GitHub 外网访问
- 将仓库克隆到 `/home/hxfeng/fhx-hit-agent`
- 创建独立 conda 环境 `fhx-hit-agent`
- 在隔离环境中完成后端依赖安装
- 阅读核心 README、后端入口、RAG/LLM 服务、前端 API 与学生问答页
- 确认当前仓库暂无自动化测试目录
- 完成后端最小导入自检，确认当前代码可在隔离环境中正常 import
- 调整 git remote：
  - `origin` 改为 `fhx020826/hit-agent`
  - `upstream` 保留 `wishmyself/hit-agent`
- 成功将当前 `main` 推送到 `origin/main`
- 新增 HPC 协作与访问文档
- 复核项目运行状态：
  - 后端可启动并通过健康检查
  - 前端可完成生产构建
  - 前端 lint 暴露 4 个错误与 4 个警告
- 定位并绕过前端依赖安装异常：
  - 放弃 `npmmirror`
  - 改为官方 npm registry 成功安装并构建
- 实现并验证一键启动脚本：
  - `scripts/dev-up.sh`
  - `scripts/dev-down.sh`
  - `scripts/dev-status.sh`
- `dev-up.sh` 已验证可自动启动前后端并输出本地 SSH 转发命令
- 已开始处理“交付前必须做”的第一优先级事项
- 本轮已修复前端当前明确的 Hook 相关实现错误
- 已建立后端最小测试闭环，当前 4 个冒烟测试通过
- 新增内部功能测试基线文档：
  - `docs/internal/internal-feature-test-matrix.md`
  - 已按真实前端页面、后端接口与现有文档整理已实现功能
  - 已补充人工测试点与后续自动化优先级
- 新增新对话交接文档：
  - `docs/internal/new-session-handoff-prompt.md`
  - 可直接复制到新对话中，快速恢复当前项目上下文
- 创建长期维护文档：
  - `coding.md`
  - `project.md`
  - `user.md`
  - `work.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

## 本轮新增完成
- 修正 `backend/tests/conftest.py` 中问卷模板测试种子字段：
  - 从 `questions` 改为真实模型字段 `questions_json`
- 新增全模块后端 API 冒烟测试：
  - `backend/tests/test_full_api_smoke.py`
- 在 `fhx-hit-agent` conda 环境下完成后端测试回归：
  - `pytest -q`
  - 结果：`9 passed, 2 warnings`
- 验证在线服务仍可访问：
  - `GET http://127.0.0.1:8000/api/health` 正常
  - 前端首页与关键路径均返回 `HTTP 200`
- 完成一条真实在线教师/学生时序链路：
  - 教师注册
  - 学生注册
  - 课程创建
  - 课程包生成与发布
  - 学生问答
  - 作业发布、确认、提交
  - 匿名反馈创建与提交
  - 学生资料请求
  - 教师通知与作业详情查看
- 新增内部测试结果文档：
  - `docs/internal/internal-test-results-2026-04-11.md`

## 当前判断
- 项目已经具备较完整的功能闭环和真实代码基础，适合继续往工程化方向推进。
- 当前最明显短板是测试、迁移、环境配置与代码结构可维护性。
- 当前可以稳定完成“服务器开发 + 本地通过 SSH 转发访问”的工作流。
- 当前 HPC 更适合作为开发/测试环境，不适合作为正式长期多人公网服务环境。
- 当前不存在阻塞运行的严重语法问题，但前端仍有需要后续清理的 Hook 规范问题。
- 当前已经具备“服务器一条命令启动，本地按提示访问”的最简工作流。
- 当前前端不再有阻塞性的 `lint error`，仅剩 3 个 warning，可继续进入下一优先级项。
- 当前后端已具备最小自动化验证基础，后续继续扩测试成本会低很多。
- 当前已经具备可直接驱动人工回归和自动化拆解的内部功能清单。
- 当前后端主模块已经具备可重复执行的 API 冒烟基线。
- 当前在线服务上的真实教师/学生链路已验证可跑通，说明不仅测试库有效。
- 当前前端页面可达性正常，但由于本机缺少 `chrome` 可执行文件，尚未完成浏览器级自动化回归。

## 进行中
- 整理本轮测试结果并同步维护文档
- 评估下一步前端自动化回归所需浏览器依赖

## 下一步
- 审阅并决定是否提交本轮测试文件与文档更新
- 以 `docs/internal/internal-feature-test-matrix.md` 为基线继续补 P1/P2 自动化测试
- 如需继续做前端 UI 自动化，先补齐浏览器运行依赖
