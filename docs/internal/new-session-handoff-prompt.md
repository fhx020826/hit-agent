# 新对话交接 Prompt

下面这段可以直接复制到新对话中，帮助新一轮对话快速接续当前项目状态。

```md
项目目录在 `/home/hxfeng/fhx-hit-agent`。请继续当前测试与开发工作。

已知状态：
- 工作目录固定为 `/home/hxfeng/fhx-hit-agent`
- `origin=https://github.com/fhx020826/hit-agent.git`
- `upstream=https://github.com/wishmyself/hit-agent.git`
- 当前分支 `main`
- 最近已推送提交 `db11763 docs: add internal feature test matrix`
- 前后端当前都在线：
  - 前端 `http://127.0.0.1:3000`
  - 后端 `http://127.0.0.1:8000`
- 健康检查：
  - `http://127.0.0.1:8000/api/health`
- 代理必须通过交互式 shell 使用：
  - `bash -ic 'clash && proxy && <command>'`
- conda 环境固定为：
  - `fhx-hit-agent`
- 可靠激活方式：
  - `eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)" && conda activate fhx-hit-agent`

请优先阅读这些文件：
- `/home/hxfeng/fhx-hit-agent/docs/internal/internal-feature-test-matrix.md`
- `/home/hxfeng/fhx-hit-agent/docs/internal/new-session-handoff-prompt.md`
- `/home/hxfeng/fhx-hit-agent/project.md`
- `/home/hxfeng/fhx-hit-agent/work.md`
- `/home/hxfeng/fhx-hit-agent/findings.md`
- `/home/hxfeng/fhx-hit-agent/progress.md`
- `/home/hxfeng/fhx-hit-agent/task_plan.md`

当前项目已经完成的关键工作：
- 已建立独立 conda 环境 `fhx-hit-agent`
- 已确认 GitHub 外网访问方式
- 已实现一键开发脚本：
  - `/home/hxfeng/fhx-hit-agent/scripts/dev-up.sh`
  - `/home/hxfeng/fhx-hit-agent/scripts/dev-down.sh`
  - `/home/hxfeng/fhx-hit-agent/scripts/dev-status.sh`
- 已修复前端明确的 Hook lint error
- 当前验证结果：
  - `npm run build` 通过
  - `npm run lint` 无 error，仅剩 warning
- 已建立后端最小冒烟测试：
  - `/home/hxfeng/fhx-hit-agent/backend/tests/conftest.py`
  - `/home/hxfeng/fhx-hit-agent/backend/tests/test_smoke_api.py`
  - `/home/hxfeng/fhx-hit-agent/backend/requirements-dev.txt`
- 已新增内部功能测试基线文档：
  - `/home/hxfeng/fhx-hit-agent/docs/internal/internal-feature-test-matrix.md`

当前最重要的测试基线说明：
- `internal-feature-test-matrix.md` 已按真实代码整理当前已实现功能
- 每个模块包含：
  - 前端入口
  - 后端接口
  - 关键能力
  - 人工测试点
  - 自动化优先级 P0 / P1 / P2
- 后续测试必须以这份文档为准，不要凭印象判断功能范围

当前真实已实现功能大类包括：
- 统一认证、登录注册、修改密码
- 个人资料与头像
- 外观设置
- 管理员用户管理
- 教师课程创建
- 课程包生成与发布
- AI 助教配置
- 学生问答、多轮会话、问题历史、收藏、文件夹
- 教师问题处理与通知
- 学生薄弱点分析
- 教学资料上传、共享、资料请求
- 课堂同步展示与批注
- 课程讨论空间
- 作业发布、确认、提交、教师查看
- AI 辅助作业反馈预览
- PPT / 教案更新
- 匿名课堂反馈
- 教学分析
- 兼容旧接口 `/api/student/*`、`/api/users/*`

当前已知边界：
- HPC 更适合作为开发/测试环境，不适合作为最终公网长期服务
- 问卷自动定时触发尚未接独立调度器
- 作业提醒天数已存储，但未接定时提醒服务
- 部分附件格式仅支持有限解析或文件留存
- AI 反馈与分析仅作辅助，不是最终评分

当前未提交修改：
- `/home/hxfeng/fhx-hit-agent/backend/tests/conftest.py`

这份未提交修改的背景：
- 我刚开始为“更大范围后端功能测试”补测试种子数据
- 新增内容包括：
  - `admin_demo` 测试账号
  - 默认问卷模板
  - 一个已发布的 demo `lesson pack`
- 但配套的大范围测试文件还没写完，也还没跑，因此这是半成品状态

如果继续工作，请按这个顺序：
1. 检查 `backend/tests/conftest.py` 当前改动是否保留
2. 补齐后端“全模块 API 冒烟测试”
3. 运行 `pytest` 并修复失败项
4. 在前后端运行中的状态下做前端页面与角色检查
5. 做一条按时间顺序的真实教师/学生全流程测试
6. 输出内部测试结果文档，并更新 `work.md`、`progress.md`、`findings.md`

注意事项：
- 所有操作仅限 `/home/hxfeng/fhx-hit-agent`
- 修改代码后如需提交，先检查是否需要先拉取远端最新代码
- 若要访问外网，优先使用：
  - `bash -ic 'clash && proxy && <command>'`
- 每轮结束后同步更新：
  - `/home/hxfeng/fhx-hit-agent/project.md`
  - `/home/hxfeng/fhx-hit-agent/work.md`
  - `/home/hxfeng/fhx-hit-agent/progress.md`
  - `/home/hxfeng/fhx-hit-agent/findings.md`
  - `/home/hxfeng/fhx-hit-agent/task_plan.md`
```

## 使用建议

- 如果新对话目标是“继续测试”，直接复制上面的整段即可。
- 如果新对话目标是“继续开发功能”，也建议保留“当前未提交修改”和“优先阅读文件”两部分。
- 如果开始新对话前我已经提交了 `backend/tests/conftest.py`，记得把 prompt 里的“未提交修改”部分同步更新。
