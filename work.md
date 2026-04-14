# Work Log

## 当前阶段
第三轮后端深度拆分已经完成，前端也已完成“统一设计语言 + 桌面/移动差异化工作台”重构；本轮已继续完成“轻量异步任务中心”第一阶段落地，并再次跑通全量验证。当前进入“继续把重计算链路异步化，并把 service 子域继续细分”阶段。

## 2026-04-14 规划刷新

### 已重新确认的真实状态
- 工作树当前不是完全干净：
  - `work.md`
  - `progress.md`
  - `docs/internal/new-session-handoff-2026-04-14.md`
- 当前最新已落地异步化链路仍只有：
  - 课程包生成
  - 资料更新预览
  - 资料更新上传
- `assignment-review` 目前仍是单一同步入口：
  - `POST /api/assignment-review/preview`
  - `backend/app/routes/assignment_review.py` 仍直接调用 `assignment_review_preview`

### 已确认的下一阶段执行策略
- 不另起新任务体系，直接复用：
  - `backend/app/routes/task_jobs.py`
  - `backend/app/services/task_jobs.py`
  - `backend/app/services/task_job_handlers.py`
- 迁移顺序固定为：
  1. 后端任务类型与 handler
  2. 新增 assignment-review 异步提交接口
  3. 前端提交任务 + 自动轮询
  4. 后端任务测试扩展
  5. 浏览器断言升级
  6. 全量统一验证
  7. 文档与验证矩阵同步

### 本轮未开始的内容
- 还没有进入 `assignment-review` 实际代码修改
- 还没有产生新的测试或验证批次
- 当前本轮产出仍是“读档 + 规划 + 文档同步”

## 2026-04-14 ECS 连通性诊断

### 本轮执行
- 重新读取 ECS 相关文档与历史记录：
  - `docs/internal/ecs-server-connection-guide.md`
  - `docs/internal/ecs-deployment-runbook-2026-04-13.md`
  - `work.md`
  - `progress.md`
  - `findings.md`
- 重新对 `8.152.202.171` 做最小化探测：
  - `ping -c 2 -W 2 8.152.202.171`
  - `timeout 8 bash -lc 'cat < /dev/null > /dev/tcp/8.152.202.171/22'`
  - `timeout 12 ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 root@8.152.202.171 'echo ping'`
  - `timeout 15 ssh -vvv -o BatchMode=yes -o ConnectTimeout=5 -o ConnectionAttempts=1 root@8.152.202.171 'echo ping'`
  - `curl -m 6 -sS -D - http://8.152.202.171:8000/api/health`
  - `curl -m 6 -I http://8.152.202.171:3000`
  - `timeout 10 ssh-keyscan -T 5 8.152.202.171`

### 本轮结论
- 服务器公网 IP 仍然存活，ICMP 正常返回。
- 22 端口 TCP 三次握手可以建立。
- 但 SSH 在 banner 阶段超时：
  - `Connection timed out during banner exchange`
- `ssh-keyscan` 无法取回 host key。
- 3000 / 8000 端口上的 HTTP 探针也全部在 6 秒内无响应超时。
- 该表现与之前文档中记录的“ECS 资源饱和后 SSH 轻量探针也超时”高度一致。

### 当前判断
- 当前问题不是：
  - 本机 SSH key 丢失
  - known_hosts 错误
  - DNS 问题
  - 单纯的 22 端口未开放
- 更像是：
  - ECS 仍在线，但 sshd 和应用服务没有及时响应
  - 或整机进入严重卡顿 / 资源饱和 / 服务僵死状态

### 本轮修复边界
- 当前本机没有可直接调用的阿里云 CLI。
- 本地 Playwright MCP 也无法直接用于阿里云控制台恢复，因为其浏览器运行面当前不可用。
- 因此本轮已完成“问题定位”，但“真正恢复服务器”仍需要通过阿里云控制台执行重启或实例级恢复动作。

### ECS 升配建议（2026-04-14）
- 当前 `2C2G` 已经被实测证明不适合本项目作为稳定部署面：
  - 跑到 `verify-all.sh` 的后半段会把 SSH 也拖死
  - 当前再次出现“ICMP 正常、TCP 可建连、但 SSH / HTTP 不回包”的状态
- 如果只是“最低成本让服务勉强跑起来”，`2C4G` 可以作为最低可接受配置。
- 如果目标是“稳定部署 + 还保留一定调试/构建/回归空间”，建议直接升到：
  - `4C8G（内存）`
- 不建议为当前项目购买 GPU：
  - 当前系统并不依赖本机 GPU 做推理
  - 当前瓶颈是 CPU / 内存 / 浏览器回归 / Node 构建与系统可用性，而不是图形或 CUDA 算力

## 2026-04-14 ECS 重启后恢复上线

### 本轮执行
- 在用户确认服务器已重启后，重新验证 SSH：
  - `ssh root@8.152.202.171 'echo ping && hostname && uptime'`
- 确认远端目录与运行环境仍在：
  - `/srv/fhx-hit-agent`
  - `/root/miniconda3`
  - `node`
  - `npm`
- 确认 `systemd` 服务已恢复：
  - `fhx-hit-agent-backend.service`
  - `fhx-hit-agent-frontend.service`
- 发现远端代码版本仍落后于当前基线：
  - 服务器原为 `9cd4893`
  - 当前本地/远端基线为 `3f85001`
- 已通过远端代理拉取最新代码：
  - `git fetch origin`
  - `git pull --ff-only origin main`
- 已在服务器重新构建前端生产包：
  - `cd /srv/fhx-hit-agent/frontend && npm run build`
- 已重启前端服务使最新 `.next` 生效：
  - `systemctl restart fhx-hit-agent-frontend`

### 本轮结果
- 服务器当前运行版本：
  - `3f85001 feat: add async task center for teacher workflows`
- 服务状态：
  - `fhx-hit-agent-backend.service` -> `active`
  - `fhx-hit-agent-frontend.service` -> `active`
- 本地公网验证通过：
  - `curl http://8.152.202.171:8000/api/health` -> `{"status":"ok","version":"0.8.0"}`
  - `curl -I http://8.152.202.171:3000` -> `HTTP/1.1 200 OK`
  - `curl http://8.152.202.171:3000` 返回当前应用首页 HTML，包含：
    - `面向前沿学科的智能教学平台`
    - `把教学设计`
    - `查看设置中心`

### 当前状态
- 在“不升级实例”的前提下，当前前后端已经重新在 ECS 上跑起来。
- 当前可以从本地访问：
  - 前端：`http://8.152.202.171:3000`
  - 后端健康检查：`http://8.152.202.171:8000/api/health`
- 本轮目标“先把前后端跑起来，并保证本地能访问前端服务”已经完成。

## 2026-04-14 Bugfix：首页对内标注清理

### 本轮处理范围
- 首页删除对用户无价值的内部说明式标注：
  - `当前设计目标`
  - `真实能力仍然全部保留`
  - `统一账号入口`
  - `设置入口收纳`
  - `真实模型接入`
  - `同一入口`
  - `同一控制面板`
  - `兼容 OpenAI 模型清单`
- 同时把相关入口文案改成更自然的产品表达，避免隐藏弹窗或未登录壳层继续残留同类措辞。
- 同时清理其他主入口页面里的同类内部设计语言：
  - 教师工作台
  - 学生工作台
  - 管理员用户管理页
  - 已登录工作台壳层底部说明

### 修改文件
- `frontend/src/app/page.tsx`
- `frontend/src/app/teacher/page.tsx`
- `frontend/src/app/student/page.tsx`
- `frontend/src/app/admin/users/page.tsx`
- `frontend/src/components/auth-modal.tsx`
- `frontend/src/components/app-shell.tsx`
- `frontend/tests/atomic-features.spec.ts`

### 实现方式
- 首页移除顶部 `SignalStrip` 注释卡片
- 首页底部两块“研发说明式”区块改写成普通用户视角的入口说明
- 登录弹窗标题辅助文案从“统一账号入口”改为“账号登录与注册”
- 未登录壳层顶部说明改成中性文案：
  - `登录后会自动进入对应角色的工作台。`
- 教师 / 学生 / 管理员主入口页中涉及“我们如何设计页面”的描述改成“用户现在能做什么”的描述
- 已登录壳层底部说明改成面向当前角色的功能入口说明，而不是“只重写呈现层与操作路径”

### 验证结果
- 先新增 Playwright 真实浏览器断言，再跑出 RED：
  - `cd frontend && npm run test:e2e -- --grep "public homepage hides internal annotations"`
  - 初次失败，原因是页面仍包含 `当前设计目标：`
- 修改后再次运行同一条测试：
  - `1 passed`
- 再运行 `atomic-features.spec.ts` 的前两条真实浏览器流：
  - 首页对内标注清理：通过
  - 教师 / 学生 / 管理员入口页不再出现对应内部设计文案：通过
- 额外扫描源码：
  - 上述首页与主入口页对内标注关键字已无残留
- 前端静态校验：
  - `cd frontend && npm run lint` -> 通过

## 2026-04-14 Bugfix：夜间主题字体颜色适配

### 本轮处理范围
- 修复首页夜间主题下多处入口区域文字对比不足的问题。
- 目标是不改变首页信息结构，但把夜间模式下首页相关块统一调整为深色字优先的可读方案。

### 修改文件
- `frontend/src/app/globals.css`
- `frontend/src/app/page.tsx`
- `frontend/tests/atomic-features.spec.ts`

### 实现方式
- 把首页夜间模式从“单卡片补丁”升级为“整页入口统一深色字方案”：
  - 顶部总览条改为浅亮背景 + 深色标题 / 说明 / 控件文字
  - 主海报改为浅亮背景 + 深色主标题 / 描述 / 次级按钮文字
  - 教师端卡片不再使用夜间浅色文字，改成浅蓝面板上的深色标题 / 说明 / 条目
  - 学生端卡片继续保留浅色面板，但统一深色文字
  - 下方两块说明区与四个入口卡片统一改成浅亮面板 + 深色标题 / 描述 / CTA
- 同时给首页相关块补了稳定标记，方便浏览器回归直接检查关键区域颜色，而不是靠脆弱的层级选择器。
- 新增真实浏览器断言：
  - `public homepage keeps all key copy readable in night mode`
- 断言方式不是抓文案存在性，而是直接检查顶部总览、教师/学生卡片、说明区标题、入口卡片 CTA 等关键块的 `computedStyle.color`，确保首页夜间模式没有灰白浅字残留。

### 验证结果
- 真实浏览器夜间主题定向回归：
  - `cd frontend && npm run test:e2e -- --grep "public homepage keeps all key copy readable in night mode"`
  - 结果：`1 passed`
- 本地真实渲染截图：
  - `/tmp/night-home-fixed-round2.png`
  - 可见顶部总览、主海报、教师/学生卡片、说明区与入口卡片都已切到深色字为主的夜间样式
- 本地采样到的真实颜色：
  - topbar title：`rgb(18, 38, 63)`
  - topbar note：`rgba(35, 58, 85, 0.78)`
  - teacher title：`rgb(24, 49, 75)`
  - support section title：`rgb(31, 53, 77)`
  - support tile CTA：`rgba(35, 58, 85, 0.78)`
- 前端静态校验：
  - `cd frontend && npm run lint` -> 通过
- 前端生产构建：
  - `cd frontend && npm run build` -> 通过
- 重新跑统一全量验证：
  - `bash scripts/verify-all.sh` -> 通过
  - `pytest -q` -> `22 passed`
  - 浏览器回归 -> `12 passed`
  - 最新日志目录：`/tmp/hit-agent-verify/20260414-185602`

## 本轮完成

### 新对话交接文档
- 已新增可直接复制到下一轮对话中的交接文档：
  - `docs/internal/new-session-handoff-2026-04-14.md`
- 该文档已经凝练以下关键信息：
  - 当前最新代码与验证基线
  - 已完成的前端重构、后端拆分、持久化加固、异步任务中心阶段成果
  - 当前第一优先级任务：`assignment-review` 异步化
  - 常用命令、约束、文档入口与提交要求
  - 明确本地优先，不主动切换回 ECS 部署工作

### 轻量异步任务中心第一阶段
- 已新增通用任务中心后端能力：
  - `backend/app/db/models_tasks.py`
  - `backend/app/models/tasks.py`
  - `backend/app/services/task_jobs.py`
  - `backend/app/services/task_job_handlers.py`
  - `backend/app/routes/task_jobs.py`
- 已新增通用异步任务接口：
  - `POST /api/task-jobs/lesson-pack-generate/{course_id}`
  - `POST /api/task-jobs/material-update/preview`
  - `POST /api/task-jobs/material-update/upload`
  - `GET /api/task-jobs/{job_id}`
  - `GET /api/task-jobs`
- 当前任务中心设计取舍：
  - 使用进程内后台线程池，不引入 Redis / Celery
  - 任务状态持久化到 `task_jobs` 表
  - 服务重启时会把遗留 `queued / running` 任务标记为失败，避免脏任务长期挂起
- 已把两条最重链路切到异步任务流：
  - 教师课程包生成页 `/teacher/lesson-pack`
  - 教师 PPT / 教案更新页 `/teacher/material-update`
- 已保留旧同步接口，避免影响现有兼容调用：
  - `POST /api/lesson-packs/generate/{course_id}`
  - `POST /api/material-update/preview`
  - `POST /api/material-update/upload`
- 已同步更新前端 API 层：
  - `frontend/src/lib/api.ts`
- 已同步更新教师端页面：
  - `frontend/src/app/teacher/lesson-pack/page.tsx`
  - `frontend/src/app/teacher/material-update/page.tsx`
- 已新增后端异步专项测试：
  - `backend/tests/test_task_jobs.py`
  - 覆盖：
    - 课程包异步任务提交与轮询完成
    - 材料更新异步任务提交与轮询完成
    - 材料更新上传异步任务提交与轮询完成
    - 后台 handler 异常时任务落为 `failed`

### 本轮最新验证
- `cd backend && pytest -q` -> `22 passed`
- `cd frontend && npm run lint` -> 通过
- `cd frontend && npm run build` -> 通过
- `bash scripts/verify-all.sh` -> 通过
- 最新统一验证日志：
  - `/tmp/hit-agent-verify/20260414-040104`
- 最新浏览器结果：
  - `atomic-features`：`5 passed`
  - `extended-coverage`：`3 passed`
  - `user-journeys`：`2 passed`
  - 合计：`10 passed`

### 本轮真实问题与处理
- 原子浏览器回归初次失败并不是功能缺陷，而是 3000/8000 上仍运行旧进程。
- 失败证据显示新前端已请求 `/api/task-jobs/...`，但旧后端返回 `{"detail":"Not Found"}`。
- 已执行：
  - `scripts/dev-down.sh`
  - `scripts/dev-up.sh`
- 在最新本地服务与 `verify-all.sh` 的独立生产模式服务面上，异步任务中心相关页面与完整流程均已复测通过。

### 统一前端设计语言重构
- 已完成共享前端设计层搭建：
  - `frontend/src/app/globals.css`
  - `frontend/src/components/app-shell.tsx`
  - `frontend/src/components/workspace-shell.tsx`
  - `frontend/src/components/workspace-panels.tsx`
- 已把首页改成海报式入口页，不再是平均化功能说明页。
- 已把教师端、学生端、管理员端工作台统一为：
  - 桌面端：左侧主导航 + 顶部上下文条 + 主工作区
  - 移动端：底部主导航 + 更聚焦的单列任务流
- 已完成重点页面重构：
  - `/`
  - `/teacher`
  - `/student`
  - `/admin/users`
  - `/teacher/course`
  - `/teacher/lesson-pack`
  - `/teacher/ai-config`
  - `/teacher/feedback`
- 第二轮已把剩余真实功能页全部接入统一 workspace 壳层，包括：
  - `/profile`
  - `/settings`
  - `/student/assignments`
  - `/student/discussions`
  - `/student/feedback`
  - `/student/materials`
  - `/student/materials/live/[shareId]`
  - `/student/qa`
  - `/student/questions`
  - `/student/weakness`
  - `/teacher/assignment-review`
  - `/teacher/assignments`
  - `/teacher/discussions`
  - `/teacher/lesson-pack/[id]`
  - `/teacher/material-update`
  - `/teacher/materials`
  - `/teacher/materials/live/[shareId]`
  - `/teacher/questions`
- 当前未纳入该壳层的只剩 4 个 legacy redirect 路由：
  - `/student/register`
  - `/student/settings`
  - `/teacher/register`
  - `/teacher/settings`
- 已同步更新自动化测试，不再让测试依赖旧 DOM 层级：
  - `frontend/tests/atomic-features.spec.ts`
  - `frontend/tests/extended-coverage.spec.ts`
- 当前测试原则已明确改为：
  - 优先验证功能是否正确
  - 选择器尽量依赖显式标签、按钮名、页面语义
  - 不再为迁就旧测试而反向牺牲前端结构优化

### 前端重构后的最新验证
- 此前已通过：
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts`
  - `cd frontend && npm run test:e2e -- tests/extended-coverage.spec.ts`
  - `cd frontend && npm run test:e2e -- tests/user-journeys.spec.ts`
  - `bash scripts/verify-all.sh`
- 最新浏览器结果：
  - `atomic-features`：`5 passed`
  - `extended-coverage`：`3 passed`
  - `user-journeys`：`2 passed`
  - 合计：`10 passed`

### 准生产简化版持久化加固
- 已完成服务端数据目录外置能力：
  - 新增环境变量 `HIT_AGENT_DATA_ROOT`
  - 默认仍兼容本地开发目录 `backend/data`
  - 可直接切换到独立目录，例如 `/srv/hit-agent-data`
- 已完成 SQLite 连接加固：
  - `journal_mode=WAL`
  - `busy_timeout`
  - `foreign_keys=ON`
  - `synchronous=NORMAL`
- 已预留数据库 URL 环境变量：
  - `HIT_AGENT_DATABASE_URL`
  - 后续切换 PostgreSQL 时无需再重写业务层导入路径
- 已新增数据备份脚本：
  - `scripts/data-backup.sh`
- 已新增数据恢复脚本：
  - `scripts/data-restore.sh`
- 备份脚本特性：
  - 使用 SQLite backup API 做热备份
  - 同时打包上传目录
  - 自动写入 `manifest.json`
- 恢复脚本特性：
  - 支持从 `.tar.gz` 备份包或已解压目录恢复
  - 恢复前自动保存当前数据库和上传目录的 pre-restore 备份
- 已新增持久化专项测试：
  - `backend/tests/test_runtime_storage.py`
  - 当前覆盖：
    - 数据目录环境变量重定向
    - SQLite PRAGMA 加固项生效
    - 备份/恢复脚本回环验证
- 已更新一键启动/状态脚本输出：
  - `scripts/dev-up.sh`
  - `scripts/dev-status.sh`
  - 现在会显示当前有效数据目录
- 已更新 `.gitignore`，避免默认开发态下 `backend/data/backups/` 污染工作区
- 本轮最新统一验证结果：
  - `bash scripts/verify-all.sh` -> 通过
  - `pytest -q` -> `16 passed`
  - `Playwright` -> `10 passed`
- 最新一键验证日志：
  - `/tmp/hit-agent-verify/20260414-024000`
- 本轮还修复了一条真实工程问题，而非 UI 选择器问题：
  - `scripts/data-backup.sh` 在部分环境下会被 user-site 污染，导入异常 `sqlite3` 包
  - 现已改为优先使用 `${CONDA_PREFIX}/bin/python`，并强制 `PYTHONNOUSERSITE=1`
  - `backend/tests/test_runtime_storage.py::test_backup_and_restore_scripts_round_trip` 已复跑通过
- 本轮顺手修正一条真实浏览器回归问题：
  - `frontend/tests/atomic-features.spec.ts`
  - 原因是 `生成课程包` 断言命中标题和状态提示两处文本
  - 现已改为按 heading 角色精确断言，避免 strict mode 歧义
- 已加固 Playwright 浏览器供应链：
  - `frontend/scripts/ensure-playwright-browser.sh`
  - `frontend/package.json` 的 `test:e2e` 会自动补装 Chromium
  - `frontend/playwright.config.ts` 不再依赖单一硬编码用户目录，改为自动搜索已安装 Chromium

### ECS 正式部署实测与资源瓶颈确认
- 已直接通过 SSH 接管远端 ECS `8.152.202.171` 进行正式部署尝试。
- 已确认远端当前真实资源：
  - `2 vCPU`
  - `1.6 GiB RAM`
  - 初始 `swap = 0`
  - 磁盘可用约 `31G`
- 已为远端新增 `4G swap`，以缓解构建与浏览器测试的内存压力。
- 已确认远端已具备并可使用：
  - `node v22.12.0`
  - `npm 10.9.0`
  - `/root/miniconda3`
  - conda 环境 `fhx-hit-agent`
  - `/srv/fhx-hit-agent` 最新仓库
- 已补齐远端兼容路径，避免当前仓库脚本中的本机绝对路径立即失效：
  - `/home/hxfeng/miniconda3 -> /root/miniconda3`
  - `/home/hxfeng/.cache -> /root/.cache`
- 已在远端安装并验证：
  - Python 依赖
  - 前端 npm 依赖
  - Playwright Chromium，且实际浏览器文件已存在于：
    - `/home/hxfeng/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`
- 已把 ECS 可移植性修复正式提交并推送到仓库：
  - `44de8c2 test: stabilize ecs deployment verification`
- 该提交包含：
  - `scripts/verify-all.sh` 自动探测 conda
  - `scripts/dev-up.sh` 自动探测 conda，且前端 dev 启动注入 `NEXT_PUBLIC_API_PORT`
  - `frontend/playwright.config.ts` 在固定 Chromium 路径不存在时自动回退
  - `frontend/tests/extended-coverage.spec.ts` 中长测试标记为慢测试，并修正一处讨论搜索断言范围
- 远端在最新代码上执行 `bash scripts/verify-all.sh` 的真实结果：
  - `pytest -q` 通过
  - `npm run lint` 通过
  - `npm run build` 通过
  - 原子浏览器测试前 5 条通过
- 但在继续执行扩展覆盖 / 后续旅程测试时，ECS 出现明显资源饱和：
  - 新 SSH 轻量探针 `ssh root@8.152.202.171 'echo ping'` 在 10~20 秒窗口内持续超时
  - 这说明整机在全量验证阶段已进入严重卡顿状态，不再具备稳定继续部署的条件
- 当前结论：
  - 这台 ECS 在“构建 + 部分 E2E + 服务验证”层面可以勉强推进
  - 但在“必须跑完整全量浏览器自动化验证”的要求下，`2C/2G` 明显不够稳
  - 因此当前无法在不牺牲验证要求的前提下，继续把服务正式守护起来并交付公网访问

### ECS 部署手册与服务器 Codex Prompt
- 已确认当前仓库最新版本关系：
  - 本地 `HEAD` = `origin/main` = `23dc5d3`
  - `upstream/main` 更旧，为 `d266c78`
- 结论：
  - 当前真实最新部署基线应以 `origin/main` 为准
- 已清理仓库内一张无关截图文件，避免后续误提交
- 已系统梳理 ECS 部署前的真实阻塞点：
  - `scripts/verify-all.sh` 写死本机 conda 路径
  - `scripts/dev-up.sh` 写死本机 conda 初始化路径
  - `frontend/playwright.config.ts` 写死本机 Chromium 路径
  - ECS 当前缺少 `conda`、`node`、`npm`
- 已新增两份部署文档：
  - `docs/internal/ecs-deployment-runbook-2026-04-13.md`
  - `docs/internal/ecs-server-codex-deploy-prompt-2026-04-13.md`
- 文档中已明确：
  - 当前服务器已完成到什么程度
  - 还缺哪些运行环境
  - 服务器 Codex 部署时必须先修哪些代码/脚本
  - 必须如何拉取最新 `origin/main`
  - 必须如何跑全量测试
  - 必须如何创建长期运行服务
  - 最终用户本地如何验收公网访问

### ECS 基础初始化、代理与 Codex 打通
- 已验证阿里云 ECS 可通过公网 SSH 连接：
  - 目标 IP：`8.152.202.171`
  - 验证用户：`root`
  - 验证命令：
    - `ssh -tt -o StrictHostKeyChecking=accept-new root@8.152.202.171 'whoami && hostname && uname -a'`
- 验证结果：
  - `whoami -> root`
  - `hostname -> iZ2ze8uopnpciyc63go6d6Z`
- 新增连接说明文档：
  - `docs/internal/ecs-server-connection-guide.md`
- 文档中只记录连接方式与账号分发原则，不落库密码等敏感凭据。
- 已完成远端 `root` 密码重置与 SSH 公钥免密接入。
- 已在远端安装基础工具：
  - `git curl wget unzip vim tmux htop rsync jq ripgrep fd-find lsof bubblewrap`
- 已把本机 Clash 目录同步到远端并配置好以下命令：
  - `clash`
  - `proxy`
  - `unproxy`
  - `clash-status`
  - `proxy-status`
- 已验证远端代理可访问 GitHub。
- 已把本机 Codex 二进制、Node 运行时与 `.codex` 配置同步到远端。
- 发现远端最初无法正常对话的真实阻塞点不是安装，而是缺少挑战会话状态文件：
  - `.codex/cap_sid`
- 补齐 `cap_sid` 后，远端以下命令已实测成功：
  - `ssh root@8.152.202.171`
  - `codex --version`
  - `codex exec --skip-git-repo-check -C /root "Reply with OK and nothing else."`
- `bubblewrap` 已安装，Codex 的沙箱 warning 已消除。

### 第三轮后端深度拆分
- 继续收缩两块剩余大路由：
  - `backend/app/routes/materials.py`
  - `backend/app/routes/discussion.py`
- `materials.py` 下沉到 `backend/app/services/materials_service.py` 的逻辑包括：
  - 资料序列化
  - 共享记录序列化
  - 资料请求创建 / 列表 / 处理
  - 课堂直播创建 / 翻页 / 批注 / 结束 / 版本列表
- `discussion.py` 下沉到 `backend/app/services/discussion_service.py` 的逻辑包括：
  - 空间成员校验
  - 空间概要 / 详情组装
  - 消息序列化
  - 附件上传
  - 发消息与 AI 跟帖
  - 搜索 / 上下文 / 成员消息列表
- 收缩结果：
  - `backend/app/routes/materials.py`: `470 -> 193`
  - `backend/app/routes/discussion.py`: `388 -> 104`

### 第二轮后端拆分
- 完成 Pydantic schema 第二轮拆分：
  - `backend/app/models/common.py`
  - `backend/app/models/auth.py`
  - `backend/app/models/people.py`
  - `backend/app/models/courses.py`
  - `backend/app/models/materials.py`
  - `backend/app/models/discussion.py`
  - `backend/app/models/qa.py`
  - `backend/app/models/assignments.py`
  - `backend/app/models/feedback.py`
- `backend/app/models/schemas.py` 已改为兼容 facade
- 完成 SQLAlchemy ORM 模型第二轮拆分：
  - `backend/app/db/models_people.py`
  - `backend/app/db/models_courses.py`
  - `backend/app/db/models_discussion.py`
  - `backend/app/db/models_qa.py`
  - `backend/app/db/models_assignments.py`
  - `backend/app/db/models_feedback.py`
  - `backend/app/db/models_materials.py`
- `backend/app/db/models.py` 已改为兼容 facade
- 将 `backend/app/routes/qa.py` 中的问答展示/序列化 helper 下沉到 `backend/app/services/qa_service.py`

### 后端结构
- 完成第一轮后端模块化拆分：
  - `backend/app/db/*`
  - `backend/app/services/llm_runtime.py`
  - `backend/app/services/file_extractors.py`
  - `backend/app/services/llm_generation.py`
  - `backend/app/services/materials_service.py`
  - `backend/app/services/qa_service.py`
- `backend/app/database.py` 与 `backend/app/services/llm_service.py` 已改为兼容 facade

### 警告与稳定性
- 把 FastAPI 弃用的 `@app.on_event("startup")` 改为 lifespan
- 清掉后端 pytest warning
- 修掉前端 lint/build 问题：
  - `next/image` 替换头像 `<img>`
  - 修正 material update 页面变量顺序
  - 修正 materials 页面 hook 依赖问题
  - 修正 `AuthModal` 成功路径下卸载后继续 `setState` 的浏览器 warning
- 增加 `test:e2e` 脚本，统一 Playwright 运行入口
- 修正原子/扩展测试中的认证等待、logout 稳定性和选择器歧义问题
- 为前端 API 请求增加超时保护，避免首页身份识别因悬挂请求长期停在加载态

### 功能文档与验证文档
- 形成代码对齐的完整功能清单：
  - `docs/internal/complete-feature-list.md`
- 形成逐功能验证矩阵：
  - `docs/internal/complete-feature-verification-matrix.md`
- 功能文档覆盖教师端、学生端、管理员端、课堂同步、兼容接口与支持型 API

### 自动化验证
本轮最新通过结果：
- 一键全量：
  - `bash scripts/verify-all.sh`
  - 通过
- 后端：
  - `cd backend && pytest -q`
  - `13 passed`
- 前端：
  - `cd frontend && npm run lint`
  - 通过
- 前端：
  - `cd frontend && npm run build`
  - 通过
- 浏览器：
  - `cd frontend && npm run test:e2e -- tests/atomic-features.spec.ts tests/extended-coverage.spec.ts tests/user-journeys.spec.ts`
  - `10 passed`
- 服务运行面：
  - 前端生产模式 `next start` 运行在 `3000`
  - 后端 `uvicorn app.main:app --host 0.0.0.0 --port 8000` 运行在 `8000`
  - `GET /api/health` 返回 `{"status":"ok","version":"0.8.0"}`

### 当前结论
- 这轮前端重构没有破坏真实功能链路。
- 前端页面已经从“玻璃卡片堆叠 + 模块清单”升级为“统一工作台 + 角色差异化语气 + 移动端短路径任务流”。
- 自动化测试也已同步更新到新的页面语义，不再被旧布局结构绑定。

### 日志清理
- 已按你的要求清理旧验证日志：
  - `/tmp/hit-agent-verify/*`
- 当前只保留本轮最新一键验证新生成的一批日志，便于问题追踪。

### 新增自动化能力
- 新增统一验证脚本：
  - `scripts/verify-all.sh`
- 新增复杂浏览器旅程回归：
  - `frontend/tests/user-journeys.spec.ts`
- 新增自动化测试目录文档：
  - `docs/internal/automation-test-catalog.md`
- 为 Playwright API 直连增加动态端口支持：
  - `frontend/tests/extended-coverage.spec.ts`
  - `frontend/tests/user-journeys.spec.ts`
- `verify-all.sh` 已处理两个真实工程问题：
  - 自动寻找空闲验证端口，避免与常驻服务冲突
  - 启动后端时同步注入 `FRONTEND_PORT`，避免独立端口下的 CORS 拦截

## 当前判断
- 代码级功能清单和真实验证矩阵已经形成，后续不再需要凭印象补测。
- 当前项目的主要短板已从“没有自动化”转变为“需要继续把大文件拆薄、把迁移和可观测性补上”。
- 浏览器自动化在这台 HPC 上可以跑通，但稳定验证面应优先使用生产模式前端。
- 第三轮已经把 `materials.py` 与 `discussion.py` 继续拆薄，路由层高耦合问题已明显缓解。
- 阿里云 ECS 的“SSH + 代理 + Codex”基础运维面已经打通，可以进入真正的项目部署阶段。
- 但当前这台 `2C/2G` ECS 在完整部署验证阶段会发生严重资源饱和，已实测成为正式交付阻塞。

## 进行中
- 更新过时文档到当前真实状态
- 已完成 ECS 正式部署尝试，但当前卡在“服务器全量验证阶段资源不足”这一阻塞点

## 下一步
- 优先升级 ECS 规格，建议至少提升到 `2C4G`，更稳妥为 `4C4G`
- 升级后直接在远端 `git pull origin main`，继续执行：
  - `bash scripts/verify-all.sh`
- 只有在完整验证通过后，才继续创建 systemd 长期服务并做公网访问验收
- 为 ECS 部署补 systemd / 反向代理 / 域名与 HTTPS
- 如需继续优化代码结构，优先细分 `materials_service.py` 与 `discussion_service.py`

## 文档清理
- 已识别并清理过时或重复的交接/阶段性文档：
  - 旧交接 prompt
  - 旧完整交接快照
  - 旧浏览器测试中断 handoff
  - 旧阶段性内部测试结果
  - 早期功能测试矩阵
  - 旧的当前更新摘要
- 当前应以以下文档为准：
  - `project.md`
  - `work.md`
  - `progress.md`
  - `findings.md`
  - `docs/internal/complete-feature-list.md`
  - `docs/internal/complete-feature-verification-matrix.md`
