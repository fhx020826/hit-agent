# 工作进度 (work.md)

## 当前状态: P1 骨架完成，前后端可编译

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

### 待完成
- [ ] 后端 Python 虚拟环境 & 依赖安装
- [ ] 前后端联调验证
- [ ] SQLite 持久化 (替换内存字典)
- [ ] 文件上传 & 解析 (P3)
- [ ] 真实 LLM/RAG 接入
- [ ] UI 优化 & 响应式
- [ ] 部署方案

### 关键修复记录
1. main.py 中文引号语法错误 → 替换为 ASCII 引号
2. TypeScript Record<string, unknown> 类型兼容 → 添加类型断言
3. Next.js 16 useSearchParams 预渲染错误 → Suspense 包裹
