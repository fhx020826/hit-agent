# 面向前沿学科的智能教学平台

## 项目定位
本项目面向高校前沿学科课程场景，定位为“教师教学全流程智能伙伴”平台。系统以教师端为核心，围绕课程设计、前沿内容融入、PPT / 教案更新、学生提问反馈、作业任务管理、匿名课堂反馈和教学分析形成闭环；学生端在教师配置范围内使用课程专属 AI 助教、提交作业、查看反馈与维护个人学习记录。

当前版本采用“后台模拟教务数据”作为课程关系主线：
- 管理员端模拟教务处，统一初始化教师账号、学生账号、课程、授课关系和选课关系
- 教师登录后看到的是自己已被分配的授课课程，而不是自行创建的教学关系
- 学生登录后看到的是自己已被预置的选修课程，而不是自行搜索加入的课程
- AI 只在既有课程关系中辅助教学与学习，不负责决定谁教谁、谁选了哪门课

平台强调以下原则：
- 教师为核心，学生为辅助
- AI 用于教学提效，不替代教师判断
- 所有记录与账号绑定，匿名仅隐藏展示身份
- 功能与文档必须与当前实现一致，不夸大未上线能力

## 目标用户
- 教师：课程负责人、主讲教师、教研团队成员
- 学生：选课学生、课后自学学生、课堂互动参与者
- 维护人员：项目开发成员、比赛展示人员、运维与演示支持人员

## 当前核心功能
### 教师端
- 我的授课课程：持续可见的 `/teacher/course-management` 入口，展示教务预置的课程、任课教师、学生名单和讨论空间状态
- 智能课程设计助手：创建课程画像、生成课程包、辅助教案结构设计
- 前沿内容融入：围绕课程主题补充新技术、新案例、新热点
- PPT / 教案更新：上传旧材料或粘贴正文，选择实际模型后生成更新建议、PPT 草稿和配图建议
- 教学资料入库与索引：教师上传课程资料后自动解析文本并写入课程知识分块，作为课程专属 AI 助教的 RAG 检索来源
- 课程专属 AI 助教配置：设置学生端 AI 助教知识边界、回答风格与答疑范围
- 作业任务管理：发布作业、设置补交与提醒天数、查看已提交与未提交名单；作业对象应来自教师已负责课程的授课关系
- 作业辅助批改：学生提交后可生成结构、逻辑、规范性反馈参考
- 学生提问反馈中心：只展示教师本人负责课程下的问题，支持教师回复、关闭、重新设为待处理，支持通知“已读 / 撤回已读”双向切换
- 课程讨论空间：实名消息检索支持按成员下拉筛选，避免手输姓名误匹配
- 匿名课堂反馈分析：手动触发课后问卷并查看参与率、评分分布与文本建议

### 学生端
- 我的课程：持续可见的 `/student/courses` 入口，展示学生已选课程、任课教师、学期、讨论空间与相关学习入口
- 课程专属 AI 助教：专注即时提问与当前问答流，不再混入归档管理，且只在学生已选课程范围内加载上下文
- 提问分发机制：支持“仅 AI”“仅教师”“AI + 教师”三种提问模式
- 多模态提问：支持文本、图片、文档、压缩包附件上传
- 问答富文本渲染：支持 Markdown + 数学公式（行内与块级 LaTeX）展示
- 学习问答记录：按课程分类查看，支持多级文件夹、记事簿、图片笔记、收藏、归档、最近更新时间排序与单条删除，作为唯一的问题整理入口
- 课堂共享资料：学生只可查看自己已选课程下由教师共享的 PPT、PDF、图片、视频等资料
- 受保护资料预览/下载：统一通过带 Token 的 `fetch + blob` 打开，不再因新标签页丢失登录态而失败
- 资料请求提醒：学生可请求教师上传讲义资料，教师端收到站内提醒
- 课程讨论空间：按课程自动绑定讨论空间，成员由任课教师和已选学生构成
- 群聊式 AI 助教：学生在讨论空间中 @AI 助教后，系统结合最近聊天上下文、课程资料和附件回答
- 聊天记录检索：支持关键词搜索、实名成员下拉筛选与消息上下文定位
- 管理员账号体系：支持管理员查看、创建、编辑、删除用户
- 课堂同步展示与实时批注：教师可发起共享展示，学生端同步查看（PDF 已接入真实预览）与页码批注
- 薄弱点分析：基于历史提问生成学习诊断和复习建议，切换课程可自动刷新对应分析结果
- 作业任务中心：确认收到、上传提交、查看状态与 AI 初步反馈
- 匿名课堂反馈：课程结束后自愿填写，也可选择跳过
- 个性化主题设置：白天、夜间、护眼模式 + 主色、字体、皮肤切换
- 个人中心：维护账号资料、头像与角色信息
- 右上角设置浮层：支持头像菜单、语言切换、进入设置中心、修改密码与退出登录

### 管理员端
- 教务模拟管理：`/admin/academic` 统一查看教师、学生、课程、授课关系与选课关系
- 教务演示数据初始化：幂等生成模拟教师、学生、课程、排课和选课结果
- 教务演示数据重置：仅在管理员明确操作时清空并重建演示关系
- 账号清单导出：导出演示教师/学生账号、初始密码和课程关联

## 统一账号与角色逻辑
- 登录 / 注册入口统一放在页面右上角
- 点击后先选角色，再进入登录或注册流程
- 登录成功后按教师 / 学生角色自动进入对应视图
- 首页不再展示分散的教师注册页、学生注册页和独立设置卡片
- 学生必须使用本人账号登录，匿名发言仅隐藏展示层身份
- 右上角头像菜单采用顶部固定浮层，避免被页面内容遮挡

## 技术架构
### 前端
- Next.js 16 + React 19 + TypeScript
- App Router 结构
- 全局主题变量 + 右上角设置中心
- 中英双语切换入口
- 统一 API 客户端，使用 Bearer Token 访问后端
- 柔和浅色选中态样式系统，兼容白天 / 夜间 / 护眼模式
- 回答渲染组件已接入数学公式显示（`react-markdown` + `remark-math` + `rehype-katex`）

### 后端
- FastAPI
- SQLAlchemy + SQLite
- 基于统一 `users` / `user_profiles` 的账号体系
- Token 会话表保存登录态
- 问答、作业、问卷、材料更新等模块拆分为独立路由
- 课程知识分块表 `knowledge_chunks` 支撑 RAG 检索，支持词法召回 + 向量召回融合

### 大模型接入
平台已支持真实模型接入，不再只是前端摆设：
- 智谱 / GLM：通过 `LLM_*` 或 `ZHIPU_API_KEY` 配置，可在前端直接显示为 `GLM-5.1`、`GLM-5.1-Air` 等选项
- OpenAI / GPT：通过 `LLM_*` 或 `OPENAI_API_KEY` 配置，可在前端直接显示为 `GPT-4.1`、`GPT-4.1 mini` 等选项
- 千问：通过 `DASHSCOPE_*` 环境变量配置
- 豆包：通过 `ARK_*` 或 `DOUBAO_*` 环境变量配置

当前实现特征：
- 学生问答页会从后端读取“当前已接入模型列表”
- 前端会把用户选中的 `model_id` 传给后端
- 后端会按所选模型真正调用对应服务，而不是写死默认值
- 模型语义区分：`smart` 对应更适合综合解释，`fast` 对应更适合快速问答
- 回答结果会附带“本次回答使用模型 / 提供方 / 调用状态 / 耗时”
- 若模型未配置或调用失败，会明确返回错误提示，不再伪装成正常回答
- 教师端 `PPT / 教案更新` 页面也已接入同一套模型选择逻辑

## RAG 检索增强（新增）
### 当前已落地
- 课程专属 AI 助教已接入 RAG：优先检索课程包与教学资料，再结合上下文生成回答
- 教学资料上传后自动分块入库（含课程资料与课程包），问答时按课程范围检索
- 检索结果支持同源去重与多样性重排，降低“同一文档重复命中”现象
- 检索来源展示已做聚合，支持 `R1/R3` 这类同源引用合并显示

### 混合检索能力
- 检索链路已升级为“关键词召回 + 向量召回”融合打分
- 默认可用本地 `local-hash-embedding` 作为离线 fallback
- 支持外部 embedding（OpenAI 兼容接口）接入后自动切换
- 当课程已有旧 chunk 时，系统会按需补齐/回填 embedding 字段
- embedding 外部调用已接入分批请求、限流重试、指数退避与失败日志打印，便于排查 `401/429` 问题
- 支持腾讯混元环境变量别名（`HUNYUAN_*`），可与通用 `EMBEDDING_*` 共存

## 近期联动更新（已落地）
- 学生端“课程专属 AI 助教”与“学习问答记录”职责已拆分：前者负责问答，后者负责归档整理
- 学习问答记录支持“课程 > 多级文件夹/记事簿/收藏”分类沉淀，便于按章节、知识点、作业主题或考试复习整理
- 学习问答记录新增“删除单条问答”能力，支持清理低价值历史记录
- 学习问答记录目录页新增面包屑导航、返回上一级、根目录/子目录新建、记事簿文本与图片混排、统一按更新时间排序
- 教师端学生提问中心状态逻辑已统一：待处理状态下不会展示教师回复正文
- 教师端问题详情区状态说明、处理标签、按钮行为已联动，避免“标签和文案不一致”
- 教师端通知支持“标记已读 / 撤回已读”并即时刷新
- 共享资料页与讨论空间的受保护文件打开方式统一为带登录态访问
- PDF 共享展示已从占位画布升级为真实 PDF 预览叠加批注层
- PDF 文本解析已接入（可提取文本 PDF 将进入 RAG 索引；扫描件会保留文件但提示无可提取文本）
- 学生端资料页异常刷新与构建错误已修复（修正页面渲染逻辑与异常 JSX）
- AI 助教与问答记录页数学公式显示问题已修复（含 `\(...\)`、`\[...\]` 与 `$$...$$`）

## 主要页面
### 公共页面
- `/`：角色化首页与产品介绍
- `/profile`：个人中心
- `/settings`：设置中心

### 教师端页面
- `/teacher`
- `/teacher/course-management`
- `/teacher/course`
- `/teacher/ai-config`
- `/teacher/assignments`
- `/teacher/discussions`
- `/teacher/questions`
- `/teacher/materials`
- `/teacher/materials/live/[shareId]`
- `/teacher/material-update`
- `/teacher/feedback`

### 学生端页面
- `/student`
- `/student/courses`
- `/student/qa`
- `/student/questions`
- `/student/discussions`
- `/student/materials`
- `/student/materials/live/[shareId]`
- `/student/weakness`
- `/student/assignments`
- `/student/feedback`

### 管理员页面
- `/admin/users`
- `/admin/academic`

## 快速启动
### 0. 服务器上一键启动前后端
在服务器项目根目录执行：
```bash
bash scripts/dev-up.sh
```

脚本会自动：
- 启动后端 `8000`
- 启动前端 `3000`
- 放入 `tmux` 会话 `hit-agent-dev`
- 打印你本地需要执行的 SSH 端口转发命令

停止服务：
```bash
bash scripts/dev-down.sh
```

查看状态：
```bash
bash scripts/dev-status.sh
```

### 1. 后端
在项目根目录执行：
```powershell
cd .\backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

启动后可先打开：`http://127.0.0.1:8000/api/health`
如果能看到 `{"status":"ok","version":"0.8.0"}`，说明后端正常。

### 1.1 智谱 GLM-5.1 推荐配置
如果你优先使用智谱官方兼容接口，建议直接设置：
```powershell
$env:LLM_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4"
$env:LLM_API_KEY = "你的智谱 API Key"
 $env:LLM_MODEL_FAST = "GLM-5.1-Air"
 $env:LLM_MODEL_SMART = "GLM-5.1"
```
说明：后端已兼容“只填写到 `/v4`”的 Base URL 写法，会自动补全到 `chat/completions`。

### 2. 前端
在新终端执行：
```powershell
cd .\frontend
npm install --cache .npm-cache --registry=https://registry.npmjs.org/
npm run dev
```

本机访问地址：`http://127.0.0.1:3000`

局域网其他设备访问时，请打开：
`http://你的局域网IP:3000`

说明：
- 前端默认会把接口请求发送到“当前访问这台机器的 8000 端口”
- 后端已改为监听 `0.0.0.0:8000`
- 当前在 HPC 环境中，前端依赖使用官方 npm registry 更稳定；如已配置代理，优先使用 `https://registry.npmjs.org/`
- 如果你的 Windows 防火墙拦截了 3000 或 8000 端口，需要允许局域网访问
- 开发环境请尽量统一使用同一域名访问（`localhost` 或 `127.0.0.1` 选其一），避免 HMR 跨域警告

### 3. 演示账号
初始化数据库时会自动写入三个演示账号：
- 教师：`teacher_demo` / `Teacher123!`
- 学生：`student_demo` / `Student123!`
- 管理员：`admin_demo` / `Admin123!`

除此之外，系统还会按教务模拟规则幂等生成一批虚拟教师、学生和课程关系：
- 默认教师约 `6` 个
- 默认学生约 `60` 个
- 默认课程约 `8` 门
- 每门课程仅绑定 `1` 位负责教师
- 每位学生会被模拟分配多门课程
- 服务重启不会重复生成；只有管理员在 `/admin/academic` 明确重置时才会清空后重建

## 环境变量说明
详见 `env.example` 与 `docs/admin/admin-maintenance-guide.md`。重点变量包括：
- `NEXT_PUBLIC_API_BASE`
- `LLM_BASE_URL`
- `LLM_API_KEY`、`OPENAI_API_KEY` 或 `ZHIPU_API_KEY`
- `LLM_MODEL_FAST`
- `LLM_MODEL_SMART`
- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL`
- `DASHSCOPE_MODEL_TEXT`
- `DASHSCOPE_MODEL_VISION`
- `ARK_API_KEY`
- `ARK_BASE_URL`
- `ARK_MODEL_TEXT`
- `ARK_MODEL_VISION`
- `EMBEDDING_BASE_URL`
- `EMBEDDING_API_KEY`
- `EMBEDDING_MODEL`
- `EMBEDDING_TIMEOUT`
- `EMBEDDING_BATCH_SIZE`
- `EMBEDDING_MAX_RETRIES`
- `EMBEDDING_RETRY_BASE_SECONDS`
- `EMBEDDING_QPS_DELAY_SECONDS`
- `HUNYUAN_API_KEY`
- `HUNYUAN_EMBEDDING_BASE_URL`
- `HUNYUAN_EMBEDDING_MODEL`

## 文档索引
- 产品总览：`docs/product-overview.md`
- 教师端模块：`docs/teacher-modules.md`
- 学生端模块：`docs/student-modules.md`
- 功能说明：`docs/features/`
- 学习问答记录管理：`docs/features/learning-records-management.md`
- API 文档：`docs/api/`
- 学习问答记录 API：`docs/api/learning-records-api.md`
- 数据结构：`docs/data-model/schema-overview.md`
- 用户手册：`docs/user-guide/`
- 管理员维护：`docs/admin/admin-maintenance-guide.md`
- 完整功能清单：`docs/internal/complete-feature-list.md`
- 完整验证矩阵：`docs/internal/complete-feature-verification-matrix.md`

## 当前边界说明
以下能力在当前版本中已经接入基础流程，但仍保留扩展空间，文档中也会据实说明：
- 课后问卷自动按时间触发：当前以教师手动触发为主，定时任务为预留能力
- 部分文件解析：已支持 txt、md、docx、pptx、zip 与可提取文本 PDF；扫描件 PDF、doc、ppt、rar 仍以保存为主
- 教师通知路由：当前优先按课程归属教师推送，归属缺失时回退到活跃教师
- 图像理解效果：取决于所选模型是否支持视觉输入
- 外部 embedding：若接口限流/鉴权失败会自动回退 `local-hash-embedding`，不阻断问答主流程
- 课程关系主线当前以后台模拟教务数据为准；教师与学生不会在前台自行创建或加入课程关系
- AI 助手只在既有课程关系中辅助教学与学习，不跨课程混合上下文
