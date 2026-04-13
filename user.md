# User Memory

## 用户长期偏好
- 项目工作目录固定在 `/home/hxfeng/fhx-hit-agent`
- 后续所有 Python 环境统一使用独立 conda 环境 `fhx-hit-agent`
- 代码规范统一参考 `coding.md`
- 重要代码与文档更新要及时纳入 git 版本管理
- 大型测试结果、日志、中间结果、数据集、模型权重不要随意上传远程仓库
- 每轮对话后需要：
  - 更新 `work.md`
  - 说明本轮进展
  - 说明下一步安排
  - 提示哪些文件可以考虑清理

## 旧有使用摘要
- 教师先注册，再创建课程画像并生成课程包
- 学生先注册，再进入课程问答页面
- 提问时可以匿名
- 课后匿名问卷由教师手动触发
- 主题设置会按账号单独保存

## 当前可靠命令

### 代理与外网
- `clash` 与 `proxy` 是写在 `~/.bashrc` 里的交互式 shell 函数。
- 在非交互命令中，可靠调用方式：
  - `bash -ic 'clash && proxy && <your command>'`
- 代理验证示例：
  - `bash -ic 'clash && proxy && curl -I https://github.com'`

### 阿里云 ECS
- 当前新购阿里云 ECS 公网 IP：
  - `8.152.202.171`
- 当前已验证：
  - `ssh root@8.152.202.171`
  - `ssh -o BatchMode=yes root@8.152.202.171 'whoami && hostname'`
- 远端也已配置同名命令：
  - `clash`
  - `proxy`
  - `unproxy`
  - `codex`
- 远端 Codex 当前可靠验证命令：
  - `ssh root@8.152.202.171 "bash -ic 'codex exec --skip-git-repo-check -C /root \"Reply with OK and nothing else.\"'"`
- 若远端 Codex 再次出现 `chatgpt.com` challenge / 认证异常，优先同步：
  - `~/.codex/auth.json`
  - `~/.codex/cap_sid`

### Conda
- 当前可用 conda 根路径：
  - `/home/hxfeng/miniconda3`
- 可靠激活方式：
  - `eval "$(/home/hxfeng/miniconda3/bin/conda shell.bash hook)" && conda activate fhx-hit-agent`

### 前端依赖
- 当前 HPC 环境下，前端依赖优先使用官方 npm registry：
  - `npm install --cache .npm-cache --registry=https://registry.npmjs.org/`
- 使用 `npmmirror` 曾出现 `next` 包安装不完整，导致：
  - `next: not found`
  - `npm ls next` 显示 `invalid`

### 前端验证
- lint：
  - `cd frontend && npm run lint`
- build：
  - `cd frontend && npm run build`
- 浏览器回归：
  - `cd frontend && npm run test:e2e -- <args>`
- 一键全量验证：
  - `cd /home/hxfeng/fhx-hit-agent && bash scripts/verify-all.sh`
- 当前 HPC 上更稳定的浏览器验证面是“生产模式前端服务 + Playwright runner”。
- 如需严格复现当前稳定验证结果，优先让前端以 `next start` 运行在 `3000` 端口后再执行 `npm run test:e2e`。
- `scripts/verify-all.sh` 会自动选择空闲验证端口，并在拉起后端时同步传递 `FRONTEND_PORT`，避免独立端口下的 CORS 问题。

### 一键启动
- 服务器上一条命令启动前后端：
  - `bash scripts/dev-up.sh`
- 停止：
  - `bash scripts/dev-down.sh`
- 查看状态：
  - `bash scripts/dev-status.sh`
- `dev-up.sh` 会打印你本地 Windows 需要执行的 SSH 端口转发命令

### 后端测试
- 安装测试依赖：
  - `pip install -r backend/requirements-dev.txt`
- 运行当前后端全量测试：
  - `cd backend && pytest -q`

## 已确认的环境坑位
- `~/.bashrc` 中现有 conda 初始化指向旧路径 `/home/dzmat/miniconda3/bin/conda`，直接 `conda activate` 会失败。
- 因 `~/.bashrc` 开头有“非交互 shell 直接 return”的逻辑，普通 `bash -lc` 默认拿不到 `clash` / `proxy` 函数。

## Git 协作约定
- 当前 remote：
  - `origin`：`fhx020826/hit-agent`
  - `upstream`：`wishmyself/hit-agent`
- 每次开发前默认先：
  - `bash -ic 'clash && proxy && cd /home/hxfeng/fhx-hit-agent && git fetch --all --prune'`
  - `git pull --rebase origin main`
- 如需跟进原团队仓库更新：
  - `git fetch upstream`
  - `git rebase upstream/main`
- 当前本地修改优先推送到 `origin/main`

## HPC 快速记录

### 支持联系人
- qyfan@ir.hit.edu.cn
- cfyang@ir.hit.edu.cn
- cxduan@ir.hit.edu.cn
- yifchen@ir.hit.edu.cn

### 重要规则
- 不要在跳板机运行大负载程序
- 不要使用内网穿透工具
- 不要递归开放 `777`
- 不要把家目录和 SSH 密钥上级目录权限开得过高

### 常用 SLURM 命令
- `sinfo`：查看集群状态
- `squeue --me`：查看自己的作业
- `sbatch run.sh`：提交脚本作业
- `srun --gres=gpu:<type>:<num> --pty bash -i`：申请交互式 GPU 节点
- `scancel <job id>`：取消作业

### 常用 HPC 说明
- 跳板机只负责登录与提交作业，不适合跑高负载任务
- 需要多终端时，优先在计算节点里开 `tmux`
- 外网问题优先检查本地代理反向映射或直接使用 Clash 代理
- 本地访问服务器前后端时，优先使用 SSH 端口转发，不依赖服务器图形界面
