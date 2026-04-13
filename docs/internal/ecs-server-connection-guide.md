# ECS 服务器连接说明

## 服务器信息

- 公网 IP：`8.152.202.171`
- 操作系统：`Ubuntu 22.04 64位`
- SSH 端口：`22`

## 谁需要怎么连接

### 普通网站访问者

- 在服务部署完成后，普通用户不需要登录服务器。
- 普通用户只需要访问后续对外公布的网址：
  - 例如：`http://8.152.202.171`
  - 或正式域名：`https://<your-domain>`

### 运维或开发人员

- 运维或开发人员通过 SSH 登录服务器。
- 当前已验证 `root` 用户密码登录可用，但不建议长期共享 `root` 凭据。
- 密码或私钥不要写入仓库，应通过私下安全渠道单独发放。

## SSH 连接方式

### macOS / Linux

```bash
ssh root@8.152.202.171
```

### Windows PowerShell

```powershell
ssh root@8.152.202.171
```

### 如果后续切换为密钥登录

```bash
ssh -i ~/.ssh/<your-private-key>.pem root@8.152.202.171
```

## 推荐的账号管理方式

- 不要让多人共用 `root`。
- 为每位需要登录服务器的成员创建独立 Linux 用户。
- 每位成员使用各自的 SSH 公钥登录。
- 仅保留少数管理员拥有 `sudo` 权限。

## 安全组建议

- 对公网开放：
  - `80/tcp`
  - `443/tcp`
- 仅对白名单管理 IP 开放：
  - `22/tcp`
- 不建议对公网开放：
  - `3000`
  - `8000`

## 当前状态

- 已从本地终端验证该服务器可通过 SSH 登录。
- 已完成 `root` 密码重置，但密码不记录在仓库中，需通过线下安全渠道单独分发。
- 已把当前运维终端的 SSH 公钥加入服务器，已验证免密登录可用。
- 验证命令：

```bash
ssh -tt -o StrictHostKeyChecking=accept-new root@8.152.202.171 'whoami && hostname && uname -a'
```

- 验证回显：

```text
root
iZ2ze8uopnpciyc63go6d6Z
Linux iZ2ze8uopnpciyc63go6d6Z 5.15.0-173-generic #183-Ubuntu SMP Fri Mar 6 13:29:34 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux
```

## 已完成的基础初始化

- 已安装基础运维工具：
  - `git`
  - `curl`
  - `wget`
  - `unzip`
  - `vim`
  - `tmux`
  - `htop`
  - `rsync`
  - `jq`
  - `ripgrep`
  - `fd-find`
  - `lsof`
  - `bubblewrap`
- 已同步并配置远端代理目录：
  - `/root/clash`
- 已在远端 `~/.bashrc` 中配置好以下命令：
  - `clash`
  - `clash-stop`
  - `clash-status`
  - `proxy`
  - `unproxy`
  - `proxy-status`
- 已验证远端代理可正常访问外网：

```bash
ssh root@8.152.202.171
clash
proxy
curl -I https://github.com
```

## 远端 Codex 使用

- 已同步本机 Codex 运行时、配置与技能目录到服务器：
  - `/root/bin/codex`
  - `/root/.local/node-v22.12.0-linux-x64`
  - `/root/.codex`
- 已补齐远端 Codex 所需的挑战会话状态文件：
  - `/root/.codex/cap_sid`
- 已验证远端可以直接运行 Codex 并成功返回结果：

```bash
ssh root@8.152.202.171
codex --version
codex exec --skip-git-repo-check -C /root "Reply with OK and nothing else."
```

- 当前实测结果：
  - `codex-cli 0.120.0`
  - 远端 `codex exec` 已成功返回 `OK`
- 说明：
  - 远端 `codex` wrapper 会自动补全 Node 运行时路径并导出代理环境变量。
  - 如果后续远端再次出现 `chatgpt.com` 访问挑战或认证失效，优先重新同步：
    - `~/.codex/auth.json`
    - `~/.codex/cap_sid`
  - 如果仍失效，再考虑在远端重新执行登录流程。

## 后续建议

- 尽快改为 SSH 密钥登录。
- 尽快禁用密码直登 `root`。
- 在网站正式上线前完成：
  - 安全组检查
  - HTTPS 配置
  - 自动快照与备份
  - 独立部署用户创建
