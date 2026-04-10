# HPC 协作开发与访问说明

## 1. 当前仓库 remote 约定
- `origin`：`https://github.com/fhx020826/hit-agent.git`
- `upstream`：`https://github.com/wishmyself/hit-agent.git`

含义：
- 日常开发、提交、推送默认面向 `origin`
- 需要关注原始团队仓库更新时，从 `upstream` 拉取

## 2. 代理与外网
在这台 HPC 环境中，`clash` 和 `proxy` 是定义在 `~/.bashrc` 里的交互式 shell 函数。

可靠用法：

```bash
bash -ic 'clash && proxy && <你的命令>'
```

示例：

```bash
bash -ic 'clash && proxy && git fetch --all --prune'
```

## 3. Conda 环境
统一使用独立环境：

```bash
eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)"
conda activate fhx-hit-agent
```

说明：
- 当前不要依赖 `conda activate` 的默认行为
- 因为 `~/.bashrc` 里的旧 conda 初始化路径已失效

## 4. 每次开发前的同步流程

### 4.1 先抓取远程更新
```bash
bash -ic 'clash && proxy && cd /home/hxfeng/fhx-hit-agent && git fetch --all --prune'
```

### 4.2 检查本地与远程差异
```bash
cd /home/hxfeng/fhx-hit-agent
git status -sb
git log --oneline --decorate --graph --all -10
```

### 4.3 若 `origin/main` 有新提交，先同步再开发
```bash
cd /home/hxfeng/fhx-hit-agent
git pull --rebase origin main
```

### 4.4 若还需要合并原始团队仓库更新
```bash
cd /home/hxfeng/fhx-hit-agent
git fetch upstream
git rebase upstream/main
```

说明：
- 推荐优先保持本地 `main` 跟随 `origin/main`
- 如需吸收 `upstream/main` 更新，再显式执行一次 rebase
- 如果 rebase 冲突，先解决冲突再继续开发

## 5. 每次开发后的提交流程

```bash
cd /home/hxfeng/fhx-hit-agent
git status
git add <文件>
git commit -m "说明本次修改"
bash -ic 'clash && proxy && cd /home/hxfeng/fhx-hit-agent && git push origin main'
```

## 6. 服务器运行前后端

### 6.1 后端启动
```bash
eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)"
conda activate fhx-hit-agent
cd /home/hxfeng/fhx-hit-agent/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 6.2 前端启动
```bash
cd /home/hxfeng/fhx-hit-agent/frontend
npm install --cache .npm-cache --registry=https://registry.npmjs.org/
npm run dev
```

默认前端会监听：

```text
0.0.0.0:3000
```

说明：
- 在当前 HPC 环境下，前端依赖通过官方 npm registry 安装更稳定。
- 如果已经启用 `clash && proxy`，优先直接使用 `https://registry.npmjs.org/`。

## 7. 你本地如何访问服务器上的前端

最稳妥的方式是 SSH 端口转发，不依赖服务器图形界面。

### 7.1 将服务器前端 3000 映射到你本地 3000
在你的 Windows 本机执行：

```bash
ssh -L 3000:localhost:3000 hpc
```

如果前端实际跑在 HPC 内部另一台节点上，需要按实际主机再做一层映射。

随后本地浏览器访问：

```text
http://localhost:3000
```

### 7.2 同时映射后端
```bash
ssh -L 3000:localhost:3000 -L 8000:localhost:8000 hpc
```

随后本地可访问：
- 前端：`http://localhost:3000`
- 后端：`http://localhost:8000`

## 8. 其他人能否直接通过一个网址访问

### 可以，但要分场景

#### 场景 A：本地测试
最适合使用 SSH 端口转发。

优点：
- 稳定
- 不需要服务器图形界面
- 不需要公网开放端口

缺点：
- 每个访问者都需要自己做一次 SSH 映射

#### 场景 B：多人通过统一 URL 直接访问
理论上可以，但前提很多：
- 服务所在服务器端口对访问者网络可达
- 防火墙允许访问
- HPC 管理规则允许长期运行 Web 服务
- 最好有反向代理、固定域名、TLS 和守护进程

### 在当前 HPC 上的实际判断
- 这台 HPC 更适合开发、调试、提交作业，不是标准公网 Web 托管环境
- 登录节点不适合长期跑前后端服务
- 计算节点是否能被外部直接访问，要看集群网络策略
- HPC 文档明确不鼓励把跳板机当长期高负载服务节点

因此：
- 用它做“开发时本地访问测试”是可以的
- 用它做“长期稳定多人共享网址”不建议直接作为正式方案

## 9. 如果必须做多人共享访问
更合理的方案是：
- 前后端继续在该仓库开发
- 演示或共享访问部署到一台可控的 Web 服务器
- 或由管理员提供反向代理 / 域名 / 网关转发

如果仍希望在 HPC 上临时共享：
- 需要先确认网络可达性
- 再确认管理员是否允许
- 再决定是否配置 `nginx` / `caddy` / `systemd` / 端口映射

## 10. 推荐工作流
1. 每次开始开发前先 `fetch --all --prune`
2. 先同步 `origin/main`
3. 再检查是否需要吸收 `upstream/main`
4. 完成修改后本地验证前后端
5. 提交并推送到 `origin/main`
6. 若需团队统一演示地址，再单独处理部署层问题
