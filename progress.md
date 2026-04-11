# Progress Log

## 2026-04-10

### 已完成
- 创建项目工作目录 `/home/hxfeng/fhx-hit-agent`
- 通过代理验证 GitHub 外网访问
- 将 `wishmyself/hit-agent` 克隆到本地工作目录
- 创建独立 conda 环境 `fhx-hit-agent`
- 在 `fhx-hit-agent` 环境中安装后端依赖
- 阅读关键入口文档与核心代码，确认项目为前后端分离的智能教学平台
- 确认当前仓库缺少自动化测试目录
- 建立长期维护文档骨架
- 完成后端最小导入自检：
  - `app.main` 可正常导入
  - `llm_service` 可正常导入
  - `rag_service.split_chunks` 可正常运行
  - 当前模型列表数量为 `0`，说明运行环境尚未配置模型密钥
- 完成 git remote 切换：
  - `origin` -> `https://github.com/fhx020826/hit-agent.git`
  - `upstream` -> `https://github.com/wishmyself/hit-agent.git`
- 已成功推送当前 `main` 到 `origin/main`
- 新增文档 `docs/admin/hpc-collaboration-and-access.md`
- 完成运行验证：
  - 后端健康检查通过
  - 前端生产构建通过
  - 前端 lint 发现若干 Hook 规范问题，但不阻塞构建和运行
- 确认前端依赖安装在当前 HPC 下应优先使用官方 npm registry
- 新增脚本：
  - `scripts/dev-up.sh`
  - `scripts/dev-down.sh`
  - `scripts/dev-status.sh`
- 一键启动脚本实测通过
- 已完成第一优先级中的第 1 项：
  - 修复前端当前明确的 Hook 实现错误
  - `lint` 从 error 降为仅剩 warning
  - `build` 保持通过
- 已完成第一优先级中的第 2 项的最小版本：
  - 新增后端最小冒烟测试
  - `pytest -q` 通过（4 passed）
- 已补充内部功能测试基线文档：
  - `docs/internal/internal-feature-test-matrix.md`
  - 已覆盖认证、资料、问答、讨论、作业、反馈、管理员等真实功能
  - 已按 P0 / P1 / P2 标注后续自动化优先级
- 已补充新对话交接 Prompt 文档：
  - `docs/internal/new-session-handoff-prompt.md`
  - 可直接复制到下一轮对话继续推进测试与开发

### 关键命令
- 代理验证：
  - `bash -ic 'clash && proxy && curl -I https://github.com'`
- 仓库拉取：
  - `bash -ic 'clash && proxy && cd /home/hxfeng/fhx-hit-agent && git clone https://github.com/wishmyself/hit-agent.git .'`
- conda 激活：
  - `eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)" && conda activate fhx-hit-agent`

### 当前进行中
- 基于内部功能清单准备下一步自动化测试拆分
- 准备整理并提交本轮文档更新

## 2026-04-11

### 已完成
- 保留并继续扩展 `backend/tests/conftest.py` 的测试种子数据
- 修正默认问卷模板字段为真实数据库字段 `questions_json`
- 新增 `backend/tests/test_full_api_smoke.py`
- 完成后端主模块 API 冒烟回归：
  - `pytest -q`
  - 结果：`9 passed, 2 warnings`
- 复核在线服务：
  - `http://127.0.0.1:8000/api/health` 正常
  - 前端首页与教师/学生/管理员关键页面均返回 `HTTP 200`
- 完成在线真实教师/学生时序链路：
  - 注册教师与学生临时账号
  - 创建课程
  - 生成并发布课程包
  - 创建问答会话并提问
  - 发布作业并完成学生提交
  - 创建匿名反馈实例并完成学生提交
  - 创建资料请求并查看教师通知
- 新增内部测试结果记录：
  - `docs/internal/internal-test-results-2026-04-11.md`

### 当前进行中
- 同步项目维护文档
- 准备评估是否需要提交本轮测试与文档更新
