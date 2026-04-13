# ECS 部署运行手册（2026-04-13）

## 目标

把当前 `fhx-hit-agent` 最新代码部署到阿里云 ECS `8.152.202.171`，并满足以下条件：

- 前端可通过公网访问：`http://8.152.202.171:3000`
- 后端健康检查可通过公网访问：`http://8.152.202.171:8000/api/health`
- 服务器上能跑通当前仓库已有的全量自动化验证：
  - `bash scripts/verify-all.sh`
- 部署后前后端为长期进程，可自动拉起，推荐使用 `systemd`
- 部署过程中如果需要修复“仅适合本机/HPC、不适合 ECS”的脚本或配置，应先修复并回归，再部署

## 当前仓库版本结论

截至 `2026-04-13`，本地仓库与远端 `origin/main` 一致：

- 本地 `HEAD`：`23dc5d3e7b937103f3cacadb3365d75095836a8a`
- `origin/main`：`23dc5d3e7b937103f3cacadb3365d75095836a8a`
- `upstream/main`：`d266c78e247505454aaf9884636742c509661039`

结论：

- 当前“最新实际工作版本”应以 `origin/main` 为准。
- `upstream/main` 反而更旧，不应作为部署基线。
- 如果服务器 Codex 开始执行时发现 `origin/main` 又前进了，应部署“当时最新的 `origin/main`”，但不能回退到早于 `23dc5d3` 的提交。

## 服务器当前真实状态

这台 ECS 当前已经完成了基础运维面准备：

- 可 SSH 登录：`root@8.152.202.171`
- 已配置好远端代理命令：
  - `clash`
  - `proxy`
  - `unproxy`
  - `clash-status`
  - `proxy-status`
- 已同步并验证远端 Codex：
  - `codex --version` 可用
  - `codex exec --skip-git-repo-check -C /root "Reply with OK and nothing else."` 已实测成功
- 已安装 `bubblewrap`
- 已安装常用基础工具：
  - `git curl wget unzip vim tmux htop rsync jq ripgrep fd-find lsof`

## 服务器当前缺失项

ECS 当前仍缺少真正部署应用所需的运行环境：

- 没有 `conda`
- 没有 `node`
- 没有 `npm`

因此，服务器 Codex 部署时需要自行完成：

- Miniconda / Mambaforge 安装
- `fhx-hit-agent` conda 环境创建
- Node.js 22 / npm 安装
- Playwright Chromium 与系统依赖安装

## 当前代码中已知的 ECS 部署阻塞点

这些问题不是“服务器环境问题”，而是“当前仓库写死了本机路径”，部署前必须优先处理：

### 1. `scripts/verify-all.sh` 写死了本机 conda 路径

当前写法：

- `CONDA_BIN="/home/hxfeng/miniconda3/bin/conda"`

问题：

- ECS 上不可能天然存在这个路径
- 导致服务器上无法直接运行 `bash scripts/verify-all.sh`

### 2. `scripts/dev-up.sh` 写死了本机 conda 初始化脚本路径

当前写法：

- `CONDA_SH="/home/hxfeng/miniconda3/etc/profile.d/conda.sh"`

问题：

- ECS 上同样会失效
- 导致服务器上一键启动脚本不可移植

### 3. `frontend/playwright.config.ts` 写死了本机 Chromium 路径

当前默认路径：

- `/home/hxfeng/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`

问题：

- ECS 上不存在该路径
- 服务器 Playwright 回归会直接失败

### 4. ECS 上当前没有 Node/npm/conda

问题：

- 即使代码不改，服务器也无法构建前端、安装依赖、运行统一验证

## 当前代码里对部署有利的点

### 1. 前后端端口关系已经明确

- 前端默认端口：`3000`
- 后端默认端口：`8000`
- 前端 API 访问逻辑：
  - `NEXT_PUBLIC_API_PORT` 默认 `8000`
  - 浏览器会请求“当前访问主机名的 `8000` 端口”

这意味着：

- 用户访问 `http://8.152.202.171:3000`
- 浏览器会自动请求 `http://8.152.202.171:8000`

只要公网放行 `3000` 和 `8000`，就能在没有域名、没有 Nginx 的情况下先跑通整套系统。

### 2. 后端 CORS 已支持动态前端端口

- 后端读取 `FRONTEND_PORT`
- 默认 `3000`
- 当前 CORS 正则允许公网 IP + 指定前端端口

### 3. 后端数据库与上传目录会自动初始化

后端当前使用 repo 相对路径：

- 数据库：`backend/data/app.db`
- 上传目录：`backend/data/uploads/*`

只要部署目录固定且不要乱删 `backend/data`，就能保持数据持久化。

### 4. 无 LLM Key 也可以先部署

当前系统支持：

- 无模型密钥时继续运行
- 部分能力退化为 fallback 模式
- 之前的自动化测试基线已经可在“无真实外部模型配置”的情况下通过

结论：

- 第一阶段部署可以不先填真实模型密钥
- 把“能运行、能访问、能通过测试”先做完

## 推荐部署策略

第一阶段先采用最小可运行策略，不引入域名和 HTTPS：

- 公网直接开放：
  - `3000/tcp`
  - `8000/tcp`
- 前端对外地址：
  - `http://8.152.202.171:3000`
- 后端健康检查：
  - `http://8.152.202.171:8000/api/health`
- 后端与前端使用 `systemd` 守护
- 部署目录固定，例如：
  - `/srv/fhx-hit-agent`

这样做的原因：

- 与当前代码结构最一致
- 与现有测试默认端口最一致
- 不需要先引入 Nginx / Caddy / 域名 / HTTPS
- 更容易让服务器 Codex 一步一步排错并跑通验证

## 推荐部署顺序

### 阶段 A：修复仓库可移植性

服务器 Codex 应先在最新 `origin/main` 上修复：

- `scripts/verify-all.sh`
- `scripts/dev-up.sh`
- `frontend/playwright.config.ts`

修复原则：

- 不再写死 `/home/hxfeng/...`
- 优先支持：
  - 环境变量覆盖
  - 自动探测 `conda`
  - 自动探测 Chromium 路径
- 如果未提供显式浏览器路径，Playwright 应回退到默认安装位置，而不是强制使用本机路径

### 阶段 B：安装服务器运行环境

服务器 Codex 应安装：

- Miniconda 或 Mambaforge
- conda env：`fhx-hit-agent`
- Node.js 22 LTS
- npm
- Playwright Chromium 及依赖

### 阶段 C：运行全量验证

必须实测通过：

```bash
bash scripts/verify-all.sh
```

如果失败：

- 不允许跳过
- 不允许“只跑一部分”就宣称成功
- 必须修复到真正通过

### 阶段 D：提交并推送必要修复

如果服务器 Codex 为了 ECS 部署改了仓库代码或脚本：

- 必须提交
- 必须推送到 `origin/main`
- 最终部署也必须基于刚刚推送成功的最新提交

### 阶段 E：创建长期运行服务

建议创建两个 `systemd` 服务：

- `fhx-hit-agent-backend.service`
- `fhx-hit-agent-frontend.service`

推荐：

- backend 监听 `0.0.0.0:8000`
- frontend 使用 `next start --hostname 0.0.0.0 --port 3000`
- backend 注入：
  - `FRONTEND_PORT=3000`
- frontend 构建与运行时注入：
  - `NEXT_PUBLIC_API_PORT=8000`

### 阶段 F：部署后验证

服务器本机必须验证：

```bash
curl -fsS http://127.0.0.1:8000/api/health
curl -I http://127.0.0.1:3000
systemctl status fhx-hit-agent-backend --no-pager
systemctl status fhx-hit-agent-frontend --no-pager
ss -ltnp | rg ':3000|:8000'
```

### 阶段 G：外部访问验证

用户本地机器随后验证：

```bash
curl http://8.152.202.171:8000/api/health
```

浏览器访问：

- `http://8.152.202.171:3000`

如果服务器本机都正常，但公网仍访问不了，优先排查阿里云安全组：

- `3000/tcp` 是否放行
- `8000/tcp` 是否放行

## 服务器 Codex 必须输出的最终结果

服务器 Codex 在完成部署后，必须明确给出：

- 最终部署提交 hash
- 如果修改了仓库，改了哪些文件
- 是否已推送到 `origin/main`
- conda 安装位置
- conda 环境名
- node / npm 版本
- systemd 服务名
- 前端公网地址
- 后端健康检查地址
- demo 账号是否可登录
- 是否还有任何未解决阻塞

## 建议给服务器 Codex 的执行边界

- 允许修改代码、脚本、部署文件
- 允许安装依赖
- 允许创建 systemd 服务
- 允许提交并推送“为 ECS 部署所必须的可移植性修复”
- 不要把任何密码、密钥写入仓库
- 不要因为一条命令失败就停住，必须继续排查直到成功或给出明确外部阻塞

## 你本地最终应该如何验收

部署完成后，你本地至少要做这几步：

### 1. 健康检查

```bash
curl http://8.152.202.171:8000/api/health
```

期望：

```json
{"status":"ok","version":"0.8.0"}
```

### 2. 前端首页

浏览器打开：

- `http://8.152.202.171:3000`

### 3. 演示账号登录

尝试登录：

- 教师：`teacher_demo / Teacher123!`
- 学生：`student_demo / Student123!`
- 管理员：`admin_demo / Admin123!`

### 4. 最低限度功能抽查

- 教师端能进入课程页
- 学生端能进入问答页
- 管理员端能进入用户管理页
- 后端健康检查持续正常

## 可直接复制给服务器 Codex 的 prompt

请直接使用下面这个文件中的内容：

- `docs/internal/ecs-server-codex-deploy-prompt-2026-04-13.md`
