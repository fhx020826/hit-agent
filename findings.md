# Findings

## 2026-04-10

### 环境与代理
- GitHub 外网访问可用，但必须通过交互式 shell 执行 `clash` 和 `proxy`。
- 已验证命令链路：
  - `bash -ic 'clash && proxy && curl -I https://github.com'`
  - `bash -ic 'clash && proxy && git ls-remote https://github.com/wishmyself/hit-agent.git HEAD'`
- Clash 当前配置文件路径为 `/home/hxfeng/clash/config.yaml`。
- Clash 当前端口：
  - HTTP: `18990`
  - SOCKS: `18991`

### Conda
- 新环境已创建：`/home/hxfeng/miniconda3/envs/fhx-hit-agent`
- 由于 `~/.bashrc` 中的 conda 初始化路径失效，当前可靠激活方式为：
  - `eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)" && conda activate fhx-hit-agent`

### 仓库结构
- 仓库已克隆到：`/home/hxfeng/fhx-hit-agent`
- 当前分支：`main`
- 当前 remote：
  - `origin` = `https://github.com/fhx020826/hit-agent.git`
  - `upstream` = `https://github.com/wishmyself/hit-agent.git`
- 最近提交：
  - `d266c78 完善页面工作流`
  - `1c4de4f 增加RAG检索功能，测试完善教师端和学生端各界面功能`
  - `9c15cfc chore: snapshot current project before RAG integration`
- 顶层核心目录：
  - `backend/`
  - `frontend/`
  - `docs/`
  - `claude_code_docs/`

### 技术栈
- 后端：
  - FastAPI
  - SQLAlchemy
  - SQLite
  - `httpx`
  - `pypdf`
- 前端：
  - Next.js 16
  - React 19
  - TypeScript
  - `react-markdown`
  - `remark-math`
  - `rehype-katex`

### 代码现状
- 后端已形成模块化路由，覆盖：
  - 认证
  - 课程
  - 问答
  - 讨论
  - 作业
  - 资料
  - 反馈
  - 管理员
  - AI 配置
  - RAG / embedding / LLM 服务
- 前端已形成教师端、学生端、管理员端页面骨架与主要功能页。
- README 与 `docs/` 对当前已实现能力描述较完整，且明显在强调“与真实实现一致”。

### 当前风险
- 当前仓库未发现自动化测试目录、`pytest` 配置或前端测试配置。
- 后端使用 SQLite，本地开发方便，但在并发、迁移、可维护性方面存在上限。
- 数据模型集中定义在 `backend/app/database.py`，规模继续扩大后可维护性会下降。
- `origin` 原仓库默认分支此前为 `master`，当前已额外推送出 `main` 分支；团队协作时需要统一使用 `main`。

### 2026-04-10 运行验证补充
- 后端验证通过：
  - `uvicorn app.main:app --host 127.0.0.1 --port 8000` 可正常启动
  - `curl http://127.0.0.1:8000/api/health` 返回 `{"status":"ok","version":"0.8.0"}`
- 前端构建验证通过：
  - `npm run build` 成功
- 前端 lint 未通过，当前存在 4 个错误和 4 个警告，主要集中在：
  - `react-hooks/set-state-in-effect`
  - `react-hooks/exhaustive-deps`
  - `@next/next/no-img-element`
- 前端依赖安装结论：
  - 使用 `npmmirror` 时曾出现 `next@16.2.2 invalid`、`.bin` 缺失、`next: not found`
  - 改用官方 npm registry 后，依赖安装与构建恢复正常
- 一键启动验证通过：
  - `bash scripts/dev-up.sh` 可成功拉起前后端
  - `bash scripts/dev-status.sh` 可看到 `3000/8000` 均在监听
  - `curl http://127.0.0.1:8000/api/health` 正常
  - `curl -I http://127.0.0.1:3000` 返回 `HTTP/1.1 200 OK`

### 2026-04-10 前端实现问题修复
- 已修复前端原有的 `lint error`，主要包括：
  - `AdminUsersPage` 中 effect 内直接触发带状态更新的加载函数
  - `AppShell` 中依赖路由变化时直接在 effect 中同步 `setState`
  - `AvatarBadge` 中依赖 `useEffect` 重置图片失败状态
  - `LanguageProvider` 中依赖 `useEffect` 从本地缓存同步语言状态
- 修复后验证结果：
  - `npm run lint`：0 error，3 warning
  - `npm run build`：成功
- 当前剩余 warning：
  - `frontend/src/app/teacher/materials/page.tsx` 中 `useEffect` 依赖项 warning
  - `frontend/src/components/avatar-badge.tsx` 中 `<img>` 优化 warning

### 2026-04-10 后端最小测试闭环
- 新增测试文件：
  - `backend/tests/conftest.py`
  - `backend/tests/test_smoke_api.py`
- 新增测试依赖文件：
  - `backend/requirements-dev.txt`
- 当前覆盖的最小链路：
  - 健康检查
  - 学生注册 + 读取个人信息
  - 教师登录 + 创建课程 + 列课程
  - 学生登录 + 创建问答会话 + 查询会话详情
- 验证命令：
  - `cd backend && pytest -q`
- 当前结果：
  - `4 passed, 2 warnings`
- 当前 warning 来源：
  - FastAPI `@app.on_event("startup")` 的弃用提示

### 2026-04-11 内部功能测试基线
- 已新增内部文档：
  - 当前完整保留版本为：
    - `docs/internal/complete-feature-list.md`
    - `docs/internal/complete-feature-verification-matrix.md`
- 该文档已基于真实代码与现有说明文档梳理当前实现功能，覆盖：
  - 认证与账号体系
  - 个人资料与外观设置
  - 管理员用户管理
  - 课程与课程包
  - AI 助教配置
  - 学生问答、多轮会话与教师协同
  - 薄弱点分析
  - 课程讨论空间
  - 教学资料库与课堂同步展示
  - PPT / 教案更新
  - 作业闭环与 AI 辅助反馈
  - 匿名课堂反馈与教学分析
- 文档已明确区分：
  - 已实现功能
  - 已知边界
  - 人工测试点
  - 自动化优先级（P0 / P1 / P2）
- 当前建议后续测试工作直接以该文档为基线继续推进，避免遗漏页面入口或把规划能力误判为已实现能力。

### 2026-04-11 测试基线扩展
- `backend/tests/conftest.py` 中的默认问卷模板种子原先使用了错误字段 `questions`。
- 实际数据库模型字段为：
  - `DBSurveyTemplate.questions_json`
- 修正后，反馈实例与统计测试可以在测试库中稳定执行。
- 已新增文件：
  - `backend/tests/test_full_api_smoke.py`
- 当前后端测试结果：
  - `9 passed, 2 warnings in 55.15s`
- 本轮新增覆盖的 API 模块包括：
  - `profile`
  - `settings`
  - `agent-config`
  - `lesson-packs`
  - `admin`
  - `materials`
  - `discussions`
  - `assignments`
  - `feedback`
  - `student`
  - `users`
  - `assignment-review`
  - `material-update`
- 当前 pytest 唯一剩余 warning 仍是：
  - FastAPI `@app.on_event("startup")` 弃用提示

### 2026-04-11 在线服务验证
- 后端在线健康检查仍正常：
  - `GET /api/health -> {"status":"ok","version":"0.8.0"}`
- 前端以下路径当前均返回 `HTTP 200`：
  - `/`
  - `/teacher`
  - `/student`
  - `/admin/users`
  - `/profile`
  - `/settings`
  - `/teacher/course`
  - `/teacher/lesson-pack`
  - `/teacher/materials`
  - `/teacher/discussions`
  - `/teacher/assignments`
  - `/student/qa`
  - `/student/assignments`
- 本机 Playwright MCP 当前不能做真实浏览器交互。
- 直接报错原因：
  - `chrome executable not found`
- 因此本轮前端只完成了“页面可达性检查”，未完成 DOM 级 UI 自动化。

### 2026-04-11 在线真实教师/学生时序链路
- 已直接对运行中的 `http://127.0.0.1:8000` 执行真实 API 流程，不依赖测试数据库。
- 本轮临时账号：
  - 教师：`teacher_e2e_20260411190348614820`
  - 学生：`student_e2e_20260411190348614820`
- 已成功完成：
  - 教师注册
  - 学生注册
  - 课程创建
  - 课程包生成与发布
  - 学生创建问答会话并提问
  - 教师发布作业
  - 学生确认与提交作业
  - 教师创建匿名反馈实例
  - 学生提交匿名反馈
  - 学生发起资料请求
  - 教师查看通知与作业详情
  - 教师查看反馈统计
- 本轮在线真实链路产生的关键实体：
  - `course-df829eee`
  - `lp-d76851df`
  - `chat-d4fbee6e`
  - `q-01eeed07`
  - `asg-15cdce5b`
  - `sub-e70264fd`
  - `survey-99ce6195`

## 2026-04-14

### 轻量异步任务中心落地结论
- 当前资源条件下，不适合直接引入 Redis / Celery / 独立 worker 体系。
- 对当前项目更合适的方案是：
  - 进程内后台线程池
  - 数据库持久化任务状态
  - 前端主动轮询
- 该方案已足以解决当前最明显的阻塞体验：
  - 课程包生成
  - PPT / 教案更新

### 本轮实现边界
- 已完成：
  - 异步任务提交
  - 任务状态轮询
  - 成功结果持久化
  - 失败态回落
  - 服务重启中断标记
- 仍未做：
  - 多进程 / 多机器分布式任务调度
  - 真正的任务重试机制
  - 统一的任务中心前端总览页

### 本轮验证发现
- 浏览器原子回归第一次失败并不是页面逻辑问题，而是本地 `3000/8000` 仍运行旧进程。
- 新前端已经请求 `/api/task-jobs/...`，但旧后端尚未加载新路由，因此返回 `404 Not Found`。
- 解决方式不是改测试，而是重启服务加载最新代码：
  - `scripts/dev-down.sh`
  - `scripts/dev-up.sh`
- 重启后，同一条老师链路与统一全量验证全部通过。

### 当前验证结论
- 最新统一回归：
  - `pytest -q` -> `22 passed`
  - `npm run lint` -> 通过
  - `npm run build` -> 通过
  - `bash scripts/verify-all.sh` -> 通过
- 说明：
  - lesson pack 与 material-update 的异步实现已经形成稳定模板，可直接套到下一条重链路

### 2026-04-14 读档后新增发现
- `assignment-review` 当前仍是同步链路：
  - 路由文件仅有 `POST /api/assignment-review/preview`
  - 没有独立 service 封装
  - 也没有接入 `task_jobs`
- 当前前端 `teacher/assignment-review` 页仍是同步等待模式：
  - 点击“生成辅助批改参考”后直接等待接口返回
  - 还没有 queued / running / failed / succeeded 的任务态 UI
- 当前任务中心的可复用抽象已经足够：
  - `TaskJobService.create_job`
  - `TaskJobService.schedule`
  - `TASK_JOB_HANDLERS`
  - `TaskJobItem`
- 当前后端异步专项测试尚未覆盖 assignment-review：
  - `backend/tests/test_task_jobs.py` 只覆盖 lesson-pack 与 material-update
- 当前前端浏览器覆盖对 assignment-review 的断言也仍是同步完成态：
  - `frontend/tests/extended-coverage.spec.ts` 只校验点击后出现“整体评价”
- 功能清单与验证矩阵中，`assignment-review` 仍只有同步能力条目：
  - `docs/internal/complete-feature-list.md` 记录为 `D11.1`
  - 还没有对应的异步任务能力编号
- 当前工作树的非代码改动主要来自交接与持续维护文档：
  - `work.md`
  - `progress.md`
  - `docs/internal/new-session-handoff-2026-04-14.md`

### 2026-04-14 ECS 连通性新鲜诊断
- 对 `8.152.202.171` 的新鲜探测结果如下：
  - `ping -c 2 -W 2 8.152.202.171`：`2/2` 成功，RTT 约 `21ms`
  - `timeout 8 bash -lc 'cat < /dev/null > /dev/tcp/8.152.202.171/22'`：成功，说明 `22/tcp` 可建立 TCP 连接
  - `timeout 12 ssh -o BatchMode=yes -o ConnectTimeout=5 root@8.152.202.171 'echo ping'`：
    - `Connection timed out during banner exchange`
  - `timeout 15 ssh -vvv ...`：
    - `Connection established.`
    - 本地已发出 `Local version string SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.14`
    - 之后同样超时在 `banner exchange`
  - `curl -m 6 http://8.152.202.171:8000/api/health`：`0 bytes received` 后超时
  - `curl -m 6 -I http://8.152.202.171:3000`：`0 bytes received` 后超时
  - `ssh-keyscan -T 5 8.152.202.171`：无输出
- 该模式说明：
  - 主机在线
  - 网络到主机在线
  - 22 端口不是完全关闭
  - 但 sshd 没有及时回送 banner，HTTP 服务也没有及时回包
- 因而当前最可能的根因是：
  - ECS 整机资源饱和
  - 或系统/sshd/应用服务僵死
  - 而不是本地 SSH 配置问题
- 该现象与此前 `2C/2G` ECS 在全量验证后进入严重卡顿、连 `ssh root@8.152.202.171 'echo ping'` 都可能超时的记录一致，属于已知风险再次出现
- 对当前项目的资源判断已经可以明确：
  - `2C2G` 不再适合作为稳定部署面
  - `2C4G` 仅适合作为“尽量省钱但接受余量很小”的最低配置
  - `4C8G` 更符合当前项目的真实形态，因为它需要同时容纳：
    - FastAPI
    - Next.js 构建与运行
    - conda Python 环境
    - Playwright / Chromium 回归
    - SSH 运维面保持可响应
  - GPU 对当前项目没有性价比，当前瓶颈不是本地推理算力
  - 新增异步任务中心没有破坏现有主流程
  - 原子功能测试和复杂用户旅程测试仍然稳定

### 2026-04-13 准生产持久化判断
- 当前项目最适合的近期路线不是立刻接入付费托管数据库，而是先做“单机准生产版”：
  - SQLite 保留
  - 数据目录外置
  - 上传目录外置
  - 备份恢复脚本固化
  - 再配合 ECS 磁盘快照
- 已新增 `HIT_AGENT_DATA_ROOT`，可以把运行数据统一外置到独立目录，而不是继续绑定仓库目录。
- 已新增 `HIT_AGENT_DATABASE_URL`，为后续 PostgreSQL 迁移预留入口，但当前默认仍走 SQLite。
- SQLite 当前已加固为：
  - `WAL`
  - `busy_timeout`
  - `foreign_keys=ON`
  - `synchronous=NORMAL`
- 这套方案能显著提升“单机长期运行 + 重启不丢数据 + 重拉代码不影响数据”的稳定性，同时不引入新的长期数据库账单。

### 2026-04-14 最新验证结论
- 准生产简化版持久化改动已通过统一全量验证：
  - `bash scripts/verify-all.sh`
  - 结果：
    - 后端 `16 passed`
    - 浏览器 `10 passed`
- 本轮唯一额外发现的问题不是业务回归，而是 Playwright 原子测试里一处文本选择器过宽：
  - `frontend/tests/atomic-features.spec.ts`
  - `生成课程包` 同时命中页面标题与加载提示
- 该问题已通过精确 heading 断言修复，并完成全量回归复测。

### 2026-04-14 前端统一设计语言重构
- 统一前端设计语言可以通过“共享 shell + 全局 token + 重点页面重构”完成，而不需要把每个页面都改成完全不同的产品。
- 真正影响验证稳定性的不是“新界面更复杂”，而是旧测试对 DOM 祖先层级和重复文案的假设过强。
- 本轮真实发现的两类测试脆弱点：
  - 管理员页测试默认标题和筛选表单在同一祖先块中，这属于布局假设，不属于功能契约。
  - 课程创建页测试默认按钮文本唯一，而新界面一度出现两个同名 CTA，这属于可操作入口歧义。
- 处理原则已经明确：
  - 如果是前端真实产生了重复主操作、影响用户判断，应修前端。
  - 如果只是旧测试把 DOM 结构写死，应改测试选择器，转向 label / heading / button name 等更稳定语义。
- 本轮结果说明：
  - 新设计语言下的首页、角色工作台和教师主流程页已可稳定通过浏览器回归。
  - 复杂旅程测试同样通过，说明新的交互层没有破坏真实业务链路。

### 2026-04-14 前端全页收尾与备份脚本修复
- 第二轮前端收尾已把剩余真实功能页全部接入统一 workspace 壳层；当前不承载真实功能界面的 4 个 legacy redirect 路由继续保留为跳转入口。
- 这一轮 `verify-all` 首次失败并不是前端问题，而是 `scripts/data-backup.sh` 的运行环境兼容问题：
  - 脚本默认解释器会被用户目录 `user-site` 污染
  - 导致导入到异常的 `sqlite3` 包并触发 `_sqlite3` 缺失
- 已修复方式：
  - 优先使用 `${CONDA_PREFIX}/bin/python`
  - 运行时强制 `PYTHONNOUSERSITE=1`
- 修复后结果：
  - `backend/tests/test_runtime_storage.py::test_backup_and_restore_scripts_round_trip` 单测通过
  - `bash scripts/verify-all.sh` 再次全通过
  - 最新统一验证日志目录：`/tmp/hit-agent-verify/20260414-024000`

### 2026-04-12 统一验证入口与复杂旅程回归
- 新增统一验证脚本：
  - `scripts/verify-all.sh`
- 新增复杂浏览器旅程回归：
  - `frontend/tests/user-journeys.spec.ts`
- 新增自动化测试目录文档：
  - `docs/internal/automation-test-catalog.md`
- 一键全量验证已通过：
  - `bash scripts/verify-all.sh`
  - 结果：
    - `pytest -q` -> `13 passed`
    - `npm run lint` -> 通过
    - `npm run build` -> 通过
    - `npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts tests/user-journeys.spec.ts` -> `10 passed`

### 2026-04-12 验证脚本中暴露并修复的真实问题
- 初版 `verify-all.sh` 默认使用 `3100/8100` 作为独立验证端口，但 HPC 上历史进程占用了 `3100`。
- 修复方式：
  - 脚本改为自动向上寻找空闲端口，而不是直接失败。
- 初版 `verify-all.sh` 拉起后端时没有同步注入 `FRONTEND_PORT`。
- 影响：
  - 后端 CORS 仍只按默认 `3000` 放行，导致独立端口前端在真实浏览器里注册/登录请求被浏览器拦截，表现为 `Failed to fetch`。
- 修复方式：
  - 启动 `uvicorn` 时显式传入 `FRONTEND_PORT=<selected frontend port>`。
- 结论：
  - 当前一键验证链路已能在独立端口环境下稳定完成真实浏览器全量回归。

### 2026-04-12 第三轮路由深拆
- `backend/app/routes/materials.py` 原先同时承担：
  - 资料展示序列化
  - 资料请求处理
  - 课堂直播共享
  - 批注版本保存
- 本轮已下沉到：
  - `backend/app/services/materials_service.py`
- `backend/app/routes/discussion.py` 原先同时承担：
  - 成员校验
  - 空间详情拼装
  - 消息序列化
  - AI 跟帖生成
  - 搜索 / 上下文回溯
- 本轮已下沉到：
  - `backend/app/services/discussion_service.py`
- 大文件收缩结果：
  - `materials.py`: `470 -> 193`
  - `discussion.py`: `388 -> 104`
- 验证结果：
  - `pytest -q` -> `13 passed`
  - `bash scripts/verify-all.sh` -> 通过

### 2026-04-12 日志清理
- 已清理旧验证日志目录内容：
  - `/tmp/hit-agent-verify/*`
- 当前只保留这轮最新回归重新生成的日志批次。
  - `/tmp/hit-agent-verify/20260412-212334`
- 最新一轮统一验证结果：
  - `pytest -q` -> `13 passed`
  - `bash scripts/verify-all.sh` -> 通过
  - Playwright 三组浏览器回归 -> `10 passed`
- 关键结果：
  - 教师通知数：`1`
  - 教师视角已提交学生数：`1`
  - 反馈参与人数：`1`

## 2026-04-12 重构与验证补充

### 后端 warning
- FastAPI 的 `@app.on_event("startup")` 已替换为 lifespan。
- 最新结果：
  - `cd backend && pytest -q`
  - `13 passed`
  - 当前不再有 pytest warning

### 前端 warning 与稳定验证面
- `npm run lint` 已无 warning / error。
- `npm run build` 通过。
- `next dev` 下的工作区 warning 已通过：
  - `next dev --webpack`
  - `outputFileTracingRoot`
 处理掉。
- 结论：
  - 当前 HPC 上浏览器自动化可用；
  - 但稳定的 Playwright 证据面优先使用生产模式前端，而不是 Next 开发服务器。

### 真实浏览器回归
- 最新浏览器回归命令：
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts`
- 最新结果：
  - `8 passed`
- 本轮对测试本身做了稳定性修正：
  - 认证入口等待
  - logout 确认 token 已清空
  - 登录 helper 显式等待 token 与角色跳转
  - 宽泛文本选择器改为稳定 role selector

### 真实前端问题
- `frontend/src/components/auth-modal.tsx` 成功登录/注册后存在组件关闭边界下继续 `setState` 的浏览器 warning。
- 已修复为：
  - 成功路径只关闭 modal 并跳转
  - 不再在成功后的卸载边界继续更新本地状态

### 后端解耦状态
- 已完成：
  - `backend/app/db/*`
  - `backend/app/services/llm_runtime.py`
  - `backend/app/services/file_extractors.py`
  - `backend/app/services/llm_generation.py`
  - `backend/app/services/materials_service.py`
  - `backend/app/services/qa_service.py`
- 仍偏大的文件：
  - `backend/app/models/schemas.py`
  - `backend/app/routes/qa.py`
  - `backend/app/routes/materials.py`
  - `backend/app/routes/discussion.py`

### 仓库清理结论
- `frontend/test-results/` 属于纯运行产物，不应提交。
- `backend/.pytest_cache` 也应视为本地产物。
- 当前已把这些路径加入 `.gitignore`。

## 2026-04-12 第二轮深度拆分补充

### 后端模块化
- `backend/app/models/schemas.py` 已完成按领域拆分，并以 facade 保持原导入兼容。
- `backend/app/db/models.py` 已完成按领域拆分，并以 facade 保持原导入兼容。
- `backend/app/routes/qa.py` 中的序列化与 presenter helper 已下沉到 `backend/app/services/qa_service.py`。
- 当前后端最大剩余结构热点主要集中在：
  - `backend/app/routes/materials.py`
  - `backend/app/routes/discussion.py`

### 前端稳定性
- 在 `frontend/src/lib/api.ts` 为请求层增加了超时保护。
- 该修正的目标不是改变业务行为，而是避免鉴权初始化或文件请求在异常情况下长时间悬挂，拖住页面状态切换。

### 最新全量验证
- 在最新代码版本上重新启动服务后执行：
  - `cd backend && pytest -q`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts`
- 最新结果：
  - 后端：`13 passed`
  - 前端 lint：通过
  - 前端 build：通过
  - 浏览器：`8 passed`

### 2026-04-12 ECS SSH 连通性
- 已验证新购 ECS 可通过公网 SSH 登录：
  - 公网 IP：`8.152.202.171`
  - 用户：`root`
  - 命令：
    - `ssh -tt -o StrictHostKeyChecking=accept-new root@8.152.202.171 'whoami && hostname && uname -a'`
- 返回结果：
  - `root`
  - `iZ2ze8uopnpciyc63go6d6Z`
  - `Linux ... Ubuntu ...`
- 已新增连接说明文档：
  - `docs/internal/ecs-server-connection-guide.md`
- 安全要求：
  - 不在仓库中记录密码
  - 后续优先切换为 SSH 密钥和独立部署用户

### 2026-04-13 ECS 代理与 Codex 打通
- 远端 ECS 已完成基础运维面初始化：
  - `root` 密码已重置
  - SSH 公钥免密登录已生效
  - 常用工具已安装完成
- 远端 Clash 与本机同目录结构已同步至：
  - `/root/clash`
- 远端当前可靠代理命令：
  - `clash`
  - `proxy`
  - `unproxy`
- 已验证远端在代理开启后可访问 GitHub。
- 直接链路验证结果：
  - 不走代理时，远端 `codex exec` 访问 `https://chatgpt.com/backend-api/wham/apps` 会超时
- 代理链路验证结果：
  - 仅同步 `auth.json` 时，远端 Codex 仍无法稳定完成对话
- 最终定位到的关键差异：
  - 本机 `.codex` 中存在远端最初缺失的 `cap_sid`
- 补齐后恢复结果：
  - 把本机 `~/.codex/cap_sid` 同步到远端后，远端 `codex exec` 已可正常返回 `OK`
- 额外环境结论：
  - 本机 `/home/hxfeng/clash/clash` 的 external-controller 因 `9090` 端口已被其他进程占用而未成功绑定
  - 但这不影响本机 `18990/18991/18993` 代理本身工作
  - 远端 ECS 的 Clash external-controller `9090` 可正常使用，便于后续远端代理调试
- 当前远端 Codex 基线：
  - `codex-cli 0.120.0`
  - `bubblewrap` 已安装
  - 远端直接执行 `codex exec --skip-git-repo-check -C /root "Reply with OK and nothing else."` 成功

### 2026-04-13 ECS 正式部署前结论
- 当前仓库最新版本关系已确认：
  - 本地 `HEAD` 与 `origin/main` 完全一致
  - 最新提交：`23dc5d3`
  - `upstream/main` 更旧：`d266c78`
- 因此正式部署必须以 `origin/main` 为准，而不是以 `upstream/main` 为准。
- 当前 ECS 上虽然已经有 `clash/proxy/codex`，但还没有：
  - `conda`
  - `node`
  - `npm`
- 当前仓库存在三处真实的服务器可移植性阻塞：
  1. `scripts/verify-all.sh` 写死 `/home/hxfeng/miniconda3/bin/conda`
  2. `scripts/dev-up.sh` 写死 `/home/hxfeng/miniconda3/etc/profile.d/conda.sh`
  3. `frontend/playwright.config.ts` 写死 `/home/hxfeng/.cache/ms-playwright/...`
- 结论：
  - 如果不先修上述路径问题，服务器上无法真实跑通 `bash scripts/verify-all.sh`
  - 因此部署第一步不应是直接起服务，而应先做“仓库 ECS 可移植性修复 + 回归”
- 已新增两份专门面向这次部署的文档：
  - `docs/internal/ecs-deployment-runbook-2026-04-13.md`
  - `docs/internal/ecs-server-codex-deploy-prompt-2026-04-13.md`
- 其中 Prompt 已明确要求服务器 Codex：
  - 先同步最新 `origin/main`
  - 修复上述路径问题
  - 安装 `conda`、`node`、`npm`
  - 跑通 `bash scripts/verify-all.sh`
  - 再创建长期运行服务并给出公网访问地址

### 2026-04-13 ECS 正式部署实测结论
- 已直接对这台 ECS 做正式部署尝试，而不是停留在文档层面。
- 远端真实资源：
  - `2 vCPU`
  - `1.6 GiB RAM`
  - 初始无 swap
- 已新增：
  - `4G swap`
- 远端当前已具备：
  - `node v22.12.0`
  - `npm 10.9.0`
  - `/root/miniconda3`
  - conda 环境 `fhx-hit-agent`
  - Playwright Chromium
- 为了让 ECS 真能跑当前仓库脚本，已提交并推送：
  - `44de8c2 test: stabilize ecs deployment verification`
- 该提交让以下内容对 ECS 友好：
  - `scripts/verify-all.sh`
  - `scripts/dev-up.sh`
  - `frontend/playwright.config.ts`
  - `frontend/tests/extended-coverage.spec.ts`
- 在 ECS 上基于最新代码执行 `bash scripts/verify-all.sh` 的真实结果：
  - `pytest -q` 通过
  - `npm run lint` 通过
  - `npm run build` 通过
  - `tests/atomic-features.spec.ts` 的 5 条测试通过
- 但在继续执行扩展覆盖 / 更长链路浏览器测试时，ECS 出现严重资源饱和：
  - 新 SSH 连接上的 `echo ping` 在 10~20 秒窗口内持续超时
  - 表现为整机几乎不可交互，不适合继续 systemd 配置与上线验收
- 当前最可信结论：
  - 这台机器不是“完全不能部署”
  - 但在你要求的“部署前必须跑全量自动化测试”标准下，当前 `2C/2G` 规格明显不够稳
  - 如果继续硬上，只会得到一个“可能能跑起来，但验证不完整且不稳定”的结果，不符合当前发布要求
- 升级建议：
  - 最低建议：`2C4G`
  - 更稳妥：`4C4G`

### 2026-04-14 ECS 重启后部署恢复
- 用户重启实例后，SSH 连通性恢复，说明此前判断的“远端卡死/服务僵死”是正确方向。
- 服务器重启后，`systemd` 已自动恢复前后端服务，但远端代码版本仍落后：
  - 运行前版本：`9cd4893`
  - 当前更新后版本：`3f85001`
- 在不升配的前提下，本轮已完成最小恢复动作：
  1. `git pull --ff-only origin main`
  2. 前端重新 `npm run build`
  3. 前端服务重启加载最新 `.next`
- 本地公网侧的最小可用验证已经成立：
  - `curl http://8.152.202.171:8000/api/health` 成功
  - `curl -I http://8.152.202.171:3000` 成功
  - `curl http://8.152.202.171:3000` 返回真实应用首页 HTML，而不是错误页
- 因此当前可以把服务器状态定义为：
  - “已恢复上线并可访问”
  - 但“仍不代表这台 `2C2G` 机器长期稳定”

### 2026-04-14 首页对内标注清理
- 首页对内标注问题的真实来源集中在：
  - `frontend/src/app/page.tsx`
  - `frontend/src/components/auth-modal.tsx`
  - `frontend/src/components/app-shell.tsx`
- 同类问题还出现在：
  - `frontend/src/app/teacher/page.tsx`
  - `frontend/src/app/student/page.tsx`
  - `frontend/src/app/admin/users/page.tsx`
- 这不是后端接口问题，而是前端表现层残留的“研发说明式”文案。
- 关键特点：
  - 文案在真实浏览器首页可见
  - 一部分文案会出现在隐藏 UI 或未登录壳层中，所以不能只删首页正文
- 另一部分文案会出现在角色工作台入口页里，表现为向用户解释“页面是怎么设计的”，而不是解释“用户现在可以做什么”
- 本轮采用的防回归方式：
  - 在 `frontend/tests/atomic-features.spec.ts` 中新增真实浏览器断言
  - 先验证 RED，再修改实现，再验证 GREEN
- 现在以下首页对内标注关键字已从源码中消失：
  - `当前设计目标`
  - `真实能力仍然全部保留`
  - `统一账号入口`
  - `设置入口收纳`
  - `真实模型接入`
  - `同一入口`
  - `同一控制面板`
  - `兼容 OpenAI 模型清单`
- 同时以下主入口页内部设计文案也已清理：
  - `当前工作台不再只罗列功能模块`
  - `全部真实功能入口`
  - `这里不再只是“功能列表”`
  - `当前页面不再像普通表单页`
  - `工作台默认保留当前真实功能`

### 2026-04-14 夜间主题字体颜色适配
- 夜间主题问题真实来源不是主题切换失效，而是首页学生端体验卡片本身使用浅色底板。
- 该卡片在夜间模式下继承了全局 `--foreground = #edf3ff`，导致浅底卡片上出现浅色文字，形成低对比显示。
- 这类问题不能只靠文本抓取发现，必须看真实渲染结果或检查 `computedStyle.color`。
- 本轮修复方式：
  - 给 `html[data-theme-mode="night"] .home-role-card[data-role="student"]` 增加专门的深色文字覆盖
  - 同时覆盖 `home-role-note`、`workspace-eyebrow`、`home-highlight-item`
- 新增防回归手段：
  - `frontend/tests/atomic-features.spec.ts` 新增 `public homepage keeps the student card readable in night mode`
  - 该用例会先把主题写入 `localStorage`，再检查学生卡片标题、说明、亮点项的真实计算颜色不再是夜间浅色字
- 本地真实截图与颜色采样表明修复已生效：
  - title：`rgb(23, 50, 77)`
  - note：`rgba(23, 50, 77, 0.68)`
  - item：`rgb(40, 71, 100)`
- 重新跑统一全量验证后，当前最新结果为：
  - `pytest -q` -> `22 passed`
  - 浏览器回归 -> `12 passed`
  - 日志目录：`/tmp/hit-agent-verify/20260414-182836`

### 服务面
- 最新验证所依赖的在线服务是本轮代码重启后的新进程：
  - 前端生产模式：`http://127.0.0.1:3000`
  - 后端：`http://127.0.0.1:8000`
- 健康检查：
  - `GET /api/health -> {"status":"ok","version":"0.8.0"}`
