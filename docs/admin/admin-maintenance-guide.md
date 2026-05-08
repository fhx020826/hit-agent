# 管理员维护说明

## 教务模拟管理总览
当前版本采用“后台模拟教务数据”作为课程关系主线。管理员端 `/admin/academic` 用来模拟教务处，负责：
- 生成教师虚拟账号
- 生成学生虚拟账号
- 生成课程
- 分配课程负责教师
- 模拟学生选课关系
- 查看并导出演示账号与课程关系
- 在必要时重置并重建演示教务数据

教师和学生不会在前台自行创建或加入课程关系；AI 也不会决定课程关系，只在既有课程关系中提供辅助。

## 1. 后端启动
```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir .\backend --host 0.0.0.0 --port 8000
```

## 2. 前端启动
```powershell
cd .\frontend
npm install
npm run dev
```

局域网访问说明：
- 本机仍可使用 `http://127.0.0.1:3000`
- 其他设备请使用部署机器的局域网 IP，例如 `http://192.168.1.23:3000`
- 如无法访问，请检查 Windows 防火墙是否放行 `3000` 和 `8000` 端口

## 3. 模型配置
### 默认模型
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL_FAST`
- `LLM_MODEL_SMART`

### 千问
- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL`
- `DASHSCOPE_MODEL_TEXT`
- `DASHSCOPE_MODEL_VISION`

### 豆包
- `ARK_API_KEY` 或 `DOUBAO_API_KEY`
- `ARK_BASE_URL`
- `ARK_MODEL_TEXT`
- `ARK_MODEL_VISION`

### Xiaomi MiMo
- `LLM_PROVIDER=mimo`
- `MIMO_API_KEY`
- `MIMO_BASE_URL`
- `MIMO_CHAT_MODEL`
- `MIMO_TIMEOUT_SECONDS`

## 4. 数据初始化
后端启动时会执行 `init_db()`，自动创建表并写入基础演示账号。

与此同时，系统还会幂等执行“演示教务数据”初始化：
- 默认生成约 6 个教师账号
- 默认生成约 60 个学生账号
- 默认生成约 8 门课程
- 为每门课程分配 1 位负责教师
- 为学生随机分配多门已选课程
- 自动创建讨论空间与课程成员关系

相关环境变量：
- `DEMO_TEACHER_COUNT`
- `DEMO_STUDENT_COUNT`
- `DEMO_COURSE_COUNT`
- `DEMO_MIN_COURSES_PER_STUDENT`
- `DEMO_MAX_COURSES_PER_STUDENT`
- `DEMO_MIN_STUDENTS_PER_COURSE`
- `DEMO_TEACHER_PASSWORD`
- `DEMO_STUDENT_PASSWORD`
- `DEMO_SEMESTER`

幂等规则：
- 如果演示教务数据已存在，重复启动不会重复生成
- 服务重启后继续使用原有账号和课程关系
- 只有管理员明确执行“重置演示教务数据”时，才会清空并重建

## 5. 教务模拟管理页面
页面：`/admin/academic`

建议管理员按下面顺序使用：
1. 先点击“生成演示教务数据”，如数据已存在会收到幂等提示
2. 查看教师列表，确认教师账号、院系和负责课程数量
3. 查看学生列表，确认学生账号、班级和已选课程数量
4. 查看课程列表，确认课程编号、负责教师、选课人数和讨论空间状态
5. 查看授课关系和选课关系，确认课程闭环已建立
6. 需要发放演示账号时，使用导出接口导出账号清单
7. 只有在演示环境需要重置时，才使用“重置演示教务数据”

## 6. 导出演示账号清单
导出内容应至少包含：
- 教师账号
- 学生账号
- 初始密码
- 教师负责课程
- 学生已选课程

这份清单适合用于：
- 比赛演示前分发测试账号
- 课堂试运行时快速分配虚拟身份
- 验证排课和选课关系是否符合预期

## 7. 维护提醒
- 当前附件解析能力与外部模型能力相关
- 若更换模型供应商，需确认其是否兼容 OpenAI 风格接口
- 若新增自动提醒或定时问卷触发，建议引入调度器而不是直接阻塞 Web 进程
- 如果管理员重置了演示教务数据，教师端“我的授课课程”和学生端“我的课程”会随之变化
- AI 助教、作业、讨论、反馈、资料共享都依赖课程关系；排查异常时先检查 `/admin/academic` 中的课程与选课关系是否存在
