# ECS 服务器 Codex 部署 Prompt（2026-04-13）

下面整段可以直接复制到阿里云 ECS 上的 Codex 对话里。

```md
你当前就在阿里云 ECS 上，请直接完成 `fhx-hit-agent` 的正式部署，直到前后端都能长期运行，并且当前仓库的全量自动化测试都通过。

## 目标

把 `fhx-hit-agent` 部署到这台 ECS 上，并满足：

- 前端公网访问地址：`http://8.152.202.171:3000`
- 后端健康检查地址：`http://8.152.202.171:8000/api/health`
- 必须跑通现有全量验证：
  - `bash scripts/verify-all.sh`
- 必须尽量保持代码仓库最新，部署时以 `origin/main` 最新提交为准
- 如果为了 ECS 部署需要修复脚本或配置，请直接修复、验证、提交、推送，然后再部署最新提交
- 最后给出清晰结论：是否部署成功、用户本地如何访问、是否还有外部阻塞

## 已知事实

### 仓库最新状态

截至 2026-04-13，已确认：

- `origin/main` 最新提交为：`23dc5d3`
- 本地开发机 `HEAD == origin/main`
- `upstream/main` 更旧，不要回退到 upstream 的旧版本

如果你执行时发现 `origin/main` 又前进了，请部署你执行时最新的 `origin/main`，但不能部署早于 `23dc5d3` 的版本。

### 服务器当前状态

这台 ECS 已经完成以下初始化：

- 可 SSH 登录
- 已配置好代理命令：
  - `clash`
  - `proxy`
  - `unproxy`
- 已配置好 `codex`
- `codex exec --skip-git-repo-check -C /root "Reply with OK and nothing else."` 已验证成功
- 已安装 `bubblewrap`
- 已安装基础工具：
  - `git curl wget unzip vim tmux htop rsync jq ripgrep fd-find lsof`

### 服务器当前缺失

当前 ECS 还没有：

- `conda`
- `node`
- `npm`

### 当前仓库里已知会阻塞 ECS 部署的问题

你必须优先修复这些问题，否则服务器上无法跑通验证：

1. `scripts/verify-all.sh` 写死了本机 conda 路径：
   - `/home/hxfeng/miniconda3/bin/conda`
2. `scripts/dev-up.sh` 写死了本机 conda 初始化脚本路径：
   - `/home/hxfeng/miniconda3/etc/profile.d/conda.sh`
3. `frontend/playwright.config.ts` 写死了本机 Chromium 路径：
   - `/home/hxfeng/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`

你必须先把这些脚本/配置修到“ECS 可移植”，再继续安装依赖和部署。

## 执行原则

1. 不要只分析，要直接动手完成部署。
2. 任何声称“完成”“通过”“成功”的结论前，必须有真实命令输出证明。
3. 不能跳过全量验证。
4. 如果需要修改代码或脚本，必须：
   - 修复
   - 重新验证
   - `git commit`
   - `git push origin main`
5. 不要把密码、密钥、token 写进仓库。
6. 如果公网访问失败，但服务器本机访问成功，要明确指出这是阿里云安全组端口放行问题，而不是应用本身失败。

## 推荐执行顺序

### 第 1 步：获取最新代码

- 检查当前目录是否已有仓库
- 如果没有，就 fresh clone 到稳定目录，例如：
  - `/srv/fhx-hit-agent`
- 如果已有仓库：
  - `git fetch --all --prune`
  - 切到 `main`
  - 同步到最新 `origin/main`
- 注意：
  - 不要粗暴覆盖有价值的未提交修改
  - 如果现有目录脏且难以安全处理，先做时间戳备份，再 fresh clone

### 第 2 步：修复 ECS 可移植性问题

你必须优先修以下问题：

1. `scripts/verify-all.sh`
   - 支持通过环境变量指定 conda 路径
   - 支持自动探测 `conda`
   - 不再写死 `/home/hxfeng/...`
2. `scripts/dev-up.sh`
   - 支持自动探测 `conda.sh`
   - 不再写死 `/home/hxfeng/...`
3. `frontend/playwright.config.ts`
   - 如果设置了 `PLAYWRIGHT_CHROMIUM_PATH`，优先用它
   - 如果默认硬编码路径不存在，则不要强制传入 `executablePath`
   - 让 Playwright 能使用服务器上实际安装的 Chromium
4. 如果你发现其他阻塞 ECS 部署的本机绝对路径，也一并修掉

修完后，先做最小验证，再继续。

### 第 3 步：安装运行环境

你需要在服务器上安装：

#### Python / conda

- 安装 Miniconda 或 Mambaforge
- 创建 conda 环境：
  - `fhx-hit-agent`
- 在该环境中安装：
  - `backend/requirements.txt`
  - `backend/requirements-dev.txt`

#### Node.js

- 安装 Node.js 22 LTS
- 确保：
  - `node -v`
  - `npm -v`
  都可在非交互 shell 和 systemd 中使用

#### Frontend deps

- 在 `frontend/` 中使用官方 npm registry 安装依赖：
  - `npm install --cache .npm-cache --registry=https://registry.npmjs.org/`

#### Playwright

- 安装 Playwright Chromium 与系统依赖
- 目标是服务器上可以真正跑：
  - `npm run test:e2e`

### 第 4 步：跑全量验证

你必须在服务器上真实执行：

```bash
bash scripts/verify-all.sh
```

如果失败：

- 不要跳过
- 不要只跑一部分就说成功
- 必须继续修，直到通过

### 第 5 步：把必要修复提交回仓库

如果你为了 ECS 部署修改了仓库内容：

- `git status`
- `git add ...`
- `git commit -m "<清晰的提交信息>"`
- 通过代理推送：
  - `bash -ic 'clash && proxy && git push origin main'`

部署必须基于你刚刚推送成功的最新提交。

### 第 6 步：正式部署长期运行服务

你需要把前后端做成长期运行的系统服务，推荐 `systemd`。

建议：

- 后端服务名：
  - `fhx-hit-agent-backend.service`
- 前端服务名：
  - `fhx-hit-agent-frontend.service`

建议监听：

- backend：`0.0.0.0:8000`
- frontend：`0.0.0.0:3000`

建议环境变量：

- backend：
  - `FRONTEND_PORT=3000`
- frontend build / runtime：
  - `NEXT_PUBLIC_API_PORT=8000`

你可以创建一个专用运行用户（例如 `hitagent`）并让服务用该用户运行；如果你认为会明显阻碍当前阶段目标，也可以临时使用 root，但必须说明原因。

### 第 7 步：部署后验证

你必须真实验证以下命令：

```bash
curl -fsS http://127.0.0.1:8000/api/health
curl -I http://127.0.0.1:3000
systemctl status fhx-hit-agent-backend --no-pager
systemctl status fhx-hit-agent-frontend --no-pager
ss -ltnp | rg ':3000|:8000'
```

如果服务没起来，就继续修。

### 第 8 步：给出最终结论

最后你的回复必须明确列出：

1. 最终部署目录
2. 最终部署提交 hash
3. 如果修改了仓库，改了哪些文件
4. 是否已推送到 `origin/main`
5. conda 安装位置
6. conda 环境名
7. node / npm 版本
8. Playwright 是否在服务器上真实可跑
9. backend systemd 服务名
10. frontend systemd 服务名
11. 前端公网访问地址
12. 后端健康检查地址
13. 本机 demo 账号是否仍可登录
14. 如果公网访问仍失败，是否判断为阿里云安全组未放行 `3000/tcp` 和 `8000/tcp`

## 部署成功的最低判定标准

只有同时满足以下条件，才允许你说“部署成功”：

1. `bash scripts/verify-all.sh` 通过
2. `curl http://127.0.0.1:8000/api/health` 返回 `{"status":"ok","version":"0.8.0"}`
3. `curl -I http://127.0.0.1:3000` 返回成功响应
4. 前后端 systemd 服务都处于 active/running
5. 明确给出用户本地访问地址：
   - `http://8.152.202.171:3000`
   - `http://8.152.202.171:8000/api/health`

## 额外提醒

- 这次先不要管域名
- 这次先不要管 HTTPS
- 这次就按“公网 IP + 端口”方式交付
- 如果你判断必须让用户在阿里云控制台里额外放行安全组端口，请明确写出来，但不要把应用自身失败误判成安全组问题

现在开始执行，不要停在分析。
```
