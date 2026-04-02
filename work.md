# 工作进度 (work.md)

## 当前状态: MVP 骨架完成，前后端可运行

### 已完成
- [x] 后端 FastAPI 骨架 (4 个路由模块)
- [x] Pydantic 数据模型定义
- [x] Mock 数据服务 (demo 计算机网络课程)
- [x] 前端 Next.js 16 项目搭建
- [x] API 客户端 (api.ts)
- [x] 教师端 4 个页面 (工作台/课程/课时包/复盘)
- [x] 学生端 2 个页面 (课程列表/问答)
- [x] 前端构建通过 (9 路由)
- [x] .gitignore 配置
- [x] Python 3.7 兼容性修复
- [x] 后端虚拟环境 & 依赖安装
- [x] 后端 API 端点全部验证通过 (health/courses/lesson-packs/student/analytics)
- [x] Git 初始化 + 2 次提交
- [x] 项目文档 (claude.md/user.md/work.md)

### 待完成
- [ ] 前后端联调 (启动两个服务确认前端调用后端成功)
- [ ] SQLite 持久化 (替换内存字典)
- [ ] 文件上传 & 解析 (P3)
- [ ] 真实 LLM/RAG 接入
- [ ] UI 优化 & 响应式
- [ ] 部署方案

### 关键修复记录
1. main.py 中文引号语法错误 → 替换为 ASCII 引号
2. TypeScript Record<string, unknown> 类型兼容 → 添加类型断言
3. Next.js 16 useSearchParams 预渲染错误 → Suspense 包裹
4. Python 3.7 不支持 list[str]/dict[str,X]/str|None 语法 → 使用 typing 模块
