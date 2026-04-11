# 内部功能清单与测试矩阵

> 文档属性：内部测试文档，不面向最终用户  
> 更新原则：只记录仓库中已经真实存在、前后端已有代码入口的功能  
> 当前依据：`docs/product-overview.md`、`docs/features/*`、`docs/api/*`、`docs/teacher-modules.md`、`docs/student-modules.md`、`backend/app/routes/*`、`frontend/src/app/*`

## 1. 使用目的

这份文档用于：

- 盘点当前版本已经落地的真实功能
- 作为人工回归测试的执行清单
- 为后续自动化测试拆分优先级和覆盖范围
- 避免把“规划中的功能”误当成“已交付功能”

## 2. 当前系统边界

### 2.1 当前真实角色

- `admin`：管理员，负责全站用户管理
- `teacher`：教师，负责课程、资料、作业、问答、反馈、讨论等教学侧能力
- `student`：学生，负责问答、作业、资料查看、讨论、匿名反馈等学习侧能力

### 2.2 当前真实前后端主入口

- 前端首页：`/`
- 教师首页：`/teacher`
- 学生首页：`/student`
- 管理员用户页：`/admin/users`
- 后端健康检查：`GET /api/health`

### 2.3 当前已接入的核心后端路由组

- `/api/auth`
- `/api/profile`
- `/api/settings`
- `/api/courses`
- `/api/discussions`
- `/api/materials`
- `/api/agent-config`
- `/api/qa`
- `/api/assignments`
- `/api/material-update`
- `/api/feedback`
- `/api/analytics`
- `/api/admin`
- `/api/assignment-review`

### 2.4 当前测试建议分层

- P0：登录注册、课程、问答、作业、资料共享、讨论、反馈、管理员
- P1：主题设置、个人资料、课堂同步批注、材料更新、AI 配置
- P2：兼容接口、旧路由、展示一致性、边界错误处理

## 3. 功能矩阵

---

## 3.1 统一认证、角色识别与账号安全

### 功能状态

- 已实现

### 前端入口

- 首页登录/注册弹窗：`/`
- 教师注册：`/teacher/register`
- 学生注册：`/student/register`

### 后端接口

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`

### 关键能力

- 教师/学生分角色注册
- 禁止前台自助注册管理员
- 登录返回 Bearer Token 与用户资料
- 前端根据角色自动进入不同工作台
- 支持修改密码与退出登录

### 主要人工测试点

- 教师注册成功并自动登录
- 学生注册成功并自动登录
- 管理员角色注册被拒绝
- 密码与确认密码不一致时报错
- 错误角色/账号/密码登录时报错
- 登录后刷新页面仍能恢复用户身份
- 修改密码后旧密码失效、新密码可登录
- 退出登录后受保护页面失去访问权限

### 自动化优先级

- P0

---

## 3.2 个人中心、头像与外观设置

### 功能状态

- 已实现

### 前端入口

- 个人中心：`/profile`
- 设置中心：`/settings`
- 学生设置页：`/student/settings`
- 教师设置页：`/teacher/settings`

### 后端接口

- `GET /api/profile/me`
- `PUT /api/profile/me`
- `POST /api/profile/avatar`
- `GET /api/profile/avatar/{user_id}/{filename}`
- `GET /api/settings/me`
- `PUT /api/settings/me`
- 兼容接口：`GET/PUT /api/settings/{user_role}/{user_id}`

### 关键能力

- 维护教师/学生资料字段
- 上传头像并回显
- 保存外观模式、主色、字体、皮肤、语言
- 登录后恢复外观设置

### 主要人工测试点

- 教师资料保存后再次进入仍保留
- 学生资料保存后再次进入仍保留
- 头像格式限制生效
- 头像大于 5MB 时被拒绝
- 切换主题后页面即时变化
- 重新登录后外观设置仍恢复

### 自动化优先级

- P1

---

## 3.3 管理员用户管理

### 功能状态

- 已实现

### 前端入口

- `/admin/users`

### 后端接口

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/{user_id}`
- `DELETE /api/admin/users/{user_id}`

### 关键能力

- 管理员按角色和关键词查询全站用户
- 管理员创建教师/学生/管理员账号
- 管理员更新资料与状态
- 删除用户时清理关联会话与部分业务数据
- 禁止删除当前管理员自己

### 主要人工测试点

- 管理员能正常查看用户列表
- 普通教师/学生访问管理员接口被拒绝
- 管理员创建新账号后可直接登录
- 管理员更新用户状态后前端列表同步变化
- 删除普通用户成功
- 删除当前管理员自己时被拒绝

### 自动化优先级

- P0

---

## 3.4 课程创建、课程画像与课程包

### 功能状态

- 已实现

### 前端入口

- 教师课程设计页：`/teacher/course`
- 教师课程包列表：`/teacher/lesson-pack`
- 教师课程包详情：`/teacher/lesson-pack/[id]`

### 后端接口

- 路由组：`/api/courses`
- 路由组：`/api/lesson-packs`

### 关键能力

- 教师创建课程基础信息
- 绑定授课班级
- 生成/查看课程包
- 为问答、资料、作业、讨论空间等模块提供课程基础上下文

### 主要人工测试点

- 教师创建课程后列表可见
- 课程包生成后详情页可见
- 不同课程之间数据隔离
- 非教师不能创建课程

### 自动化优先级

- P0

### 备注

- 本模块是多个后续模块的数据前置条件，适合作为集成测试准备步骤

---

## 3.5 课程专属 AI 助教配置

### 功能状态

- 已实现

### 前端入口

- `/teacher/ai-config`

### 后端接口

- `GET /api/agent-config/{course_id}`
- `PUT /api/agent-config/{course_id}`

### 关键能力

- 维护课程级 AI 助教范围规则
- 设置回答风格
- 控制作业答疑、资料问答、前沿扩展开关

### 主要人工测试点

- 教师能读取默认配置
- 教师保存新配置后再次进入可恢复
- 非教师修改配置被拒绝

### 自动化优先级

- P1

---

## 3.6 学生问答、多轮会话与教师协同回复

### 功能状态

- 已实现

### 前端入口

- 学生问答页：`/student/qa`
- 学生历史问题页：`/student/questions`
- 教师问题处理页：`/teacher/questions`

### 后端接口

- `GET /api/qa/models`
- `POST /api/qa/attachments`
- `POST /api/qa/sessions`
- `GET /api/qa/sessions`
- `GET /api/qa/sessions/{session_id}`
- `POST /api/qa/ask`
- `GET /api/qa/history`
- `POST /api/qa/questions/{question_id}/collect`
- `GET /api/qa/teacher/questions`
- `POST /api/qa/teacher/questions/{question_id}/reply`
- `GET /api/qa/teacher/notifications`
- `POST /api/qa/teacher/notifications/{notification_id}/read`
- `GET /api/qa/attachments/{attachment_id}/download`

### 关键能力

- 学生创建会话并连续追问
- 支持 `ai` / `teacher` / `both` 三种回答目标
- 支持匿名提问
- 支持附件上传与关联
- 记录所选模型与实际调用来源
- 教师端查看待处理问题并回复
- 教师端查看问答提醒

### 主要人工测试点

- 学生创建会话成功
- 学生连续两次提问后会话详情能看到多轮记录
- 仅 AI 回答时教师回复状态保持待处理或空
- 仅教师回答时不会生成正式 AI 回答
- AI + 教师模式下两侧都能看到问题进入流程
- 匿名提问在教师端不暴露实名
- 附件上传后在问题记录中可见
- 教师回复后学生历史问题状态变为已回复
- 学生不能下载别人的附件

### 自动化优先级

- P0

### 风险备注

- 真实 AI 返回依赖模型配置；自动化中建议先做“无模型配置时的错误链路测试”和“mock 调用链路测试”

---

## 3.7 学生薄弱点分析

### 功能状态

- 已实现

### 前端入口

- `/student/weakness`

### 后端接口

- `GET /api/qa/weakness-analysis`

### 关键能力

- 基于学生历史提问推断可能薄弱知识点
- 返回复习建议

### 主要人工测试点

- 无历史问题时页面提示合理
- 有历史问题后能生成诊断摘要
- 只允许学生查看自己的分析结果

### 自动化优先级

- P1

---

## 3.8 课程讨论空间

### 功能状态

- 已实现

### 前端入口

- 学生讨论页：`/student/discussions`
- 教师讨论页：`/teacher/discussions`

### 后端接口

- `GET /api/discussions/spaces`
- `GET /api/discussions/spaces/{space_id}`
- `GET /api/discussions/spaces/{space_id}/messages`
- `POST /api/discussions/attachments?space_id=...`
- `POST /api/discussions/messages`
- `GET /api/discussions/search`
- `GET /api/discussions/spaces/{space_id}/members/{user_id}/messages`
- `GET /api/discussions/messages/{message_id}/context`

### 关键能力

- 课程与班级维度的讨论空间
- 学生/教师/AI 助教同空间互动
- 支持匿名消息
- 支持 `@AI 助教`
- 支持附件消息
- 支持关键词、身份、成员维度检索

### 主要人工测试点

- 教师创建课程后讨论空间可进入
- 学生可正常发送实名消息
- 学生可正常发送匿名消息
- 匿名消息不能通过实名筛选被反查
- `@AI 助教` 时返回 AI 消息
- 附件消息发送后下载正常
- 搜索结果能定位上下文

### 自动化优先级

- P0

---

## 3.9 教学资料库、资料请求与课堂同步展示

### 功能状态

- 已实现

### 前端入口

- 教师资料页：`/teacher/materials`
- 教师课堂同步页：`/teacher/materials/live/[shareId]`
- 学生资料页：`/student/materials`
- 学生课堂同步页：`/student/materials/live/[shareId]`

### 后端接口

- 路由组：`/api/materials`
- `POST /api/materials/live/start`
- `POST /api/materials/live/{share_id}/page`
- `POST /api/materials/live/{share_id}/annotations`
- `GET /api/materials/live/current`
- `GET /api/materials/live/{share_id}/annotations`
- `POST /api/materials/live/{share_id}/end`
- `GET /api/materials/live/{share_id}/versions`
- `WS /api/materials/live/{share_id}/ws`

### 关键能力

- 教师上传和管理资料
- 学生请求讲义/资料
- 教师发起课堂同步展示
- 页码同步
- 多种笔迹类型批注
- 结束共享时保存或丢弃批注
- 实时事件广播

### 主要人工测试点

- 教师上传资料后列表出现
- 教师将资料共享到学生端后学生可见
- 学生发起资料请求后教师端可看到提醒/记录
- 教师开始共享后学生端能进入同步页
- 教师翻页时学生端同步变化
- 教师批注后学生端能看到轨迹
- `save` 模式结束后版本列表可见
- `discard` 模式结束后本次临时批注不保留

### 自动化优先级

- P0

### 自动化说明

- API 层可优先覆盖共享开始/翻页/结束
- WebSocket 与批注同步更适合后续 Playwright + 实时联调测试

---

## 3.10 PPT / 教案更新

### 功能状态

- 已实现

### 前端入口

- `/teacher/material-update`

### 后端接口

- `POST /api/material-update/preview`
- `POST /api/material-update/upload`
- `GET /api/material-update`

### 关键能力

- 直接输入材料文本生成更新建议
- 上传文件生成更新建议
- 保存更新历史
- 记录选择模型、实际使用模型、调用状态

### 主要人工测试点

- 文本输入模式下可生成结果
- 文件上传模式下可生成结果或正确提示解析边界
- 历史记录可见
- 模型不可用时返回明确失败信息

### 自动化优先级

- P1

---

## 3.11 作业发布、确认、提交与 AI 辅助反馈

### 功能状态

- 已实现

### 前端入口

- 教师作业页：`/teacher/assignments`
- 教师作业辅助批改页：`/teacher/assignment-review`
- 教师作业复核页：`/teacher/review`
- 学生作业页：`/student/assignments`

### 后端接口

- `POST /api/assignments`
- `GET /api/assignments/teacher`
- `GET /api/assignments/teacher/class-options`
- `GET /api/assignments/teacher/{assignment_id}`
- `GET /api/assignments/student`
- `POST /api/assignments/{assignment_id}/confirm`
- `POST /api/assignments/{assignment_id}/submit`
- `GET /api/assignments/submissions/{submission_id}/files/{token}`
- `POST /api/assignment-review/preview`

### 关键能力

- 教师发布作业并配置面向班级、截止时间等信息
- 学生确认收到作业
- 学生上传一个或多个文件提交
- 教师查看提交情况和班级名单状态
- 生成 AI 辅助反馈预览

### 主要人工测试点

- 教师发布作业后学生端出现该作业
- 学生确认收到状态回写成功
- 学生上传文件后提交状态更新
- 不允许补交的作业再次提交时报错
- 教师能看到已提交/未提交名单
- 学生只能下载自己的提交文件
- 教师能下载自己作业下的学生提交文件
- AI 辅助反馈预览接口返回结构化内容

### 自动化优先级

- P0

---

## 3.12 匿名课堂反馈

### 功能状态

- 已实现

### 前端入口

- 学生反馈页：`/student/feedback`
- 教师反馈分析页：`/teacher/feedback`

### 后端接口

- `GET /api/feedback/templates`
- `POST /api/feedback/instances`
- `GET /api/feedback/pending`
- `POST /api/feedback/instances/{survey_instance_id}/submit`
- `POST /api/feedback/instances/{survey_instance_id}/skip`
- `GET /api/feedback/analytics/{survey_instance_id}`

### 关键能力

- 教师手动创建反馈实例
- 学生查看待填写问卷
- 学生提交或跳过
- 教师查看统计分析

### 主要人工测试点

- 教师创建问卷实例成功
- 学生端能看到待填写问卷
- 学生提交后不再重复出现
- 学生跳过后状态正确
- 教师分析页能看到参与率、分布和文本建议
- 教师分析页不暴露学生实名

### 自动化优先级

- P0

---

## 3.13 教学分析

### 功能状态

- 已实现

### 前端入口

- 教师反馈/分析相关页：`/teacher/feedback`

### 后端接口

- `GET /api/analytics/{lp_id}`

### 关键能力

- 基于问答日志生成高频主题、困惑点、教学建议
- 返回近期问题摘要

### 主要人工测试点

- 无问答日志时返回 mock/兜底分析
- 有日志时返回统计摘要
- 匿名问题在摘要中不暴露学生身份

### 自动化优先级

- P1

---

## 3.14 旧版兼容与辅助路由

### 功能状态

- 已实现，但不是当前主前端主链路

### 后端接口

- `/api/student/*`
- `/api/users/*`

### 当前定位

- 更接近旧版或兼容型接口
- 当前主流程已由 `/api/auth`、`/api/profile`、`/api/qa`、`/api/courses` 等新链路承接

### 测试策略

- 只做最小兼容冒烟
- 不建议继续扩展为主业务能力

### 自动化优先级

- P2

---

## 4. 当前最值得优先自动化的回归链路

### P0 回归链路

1. 教师注册/登录 -> 创建课程 -> 创建作业 -> 学生登录后看到作业  
2. 学生登录 -> 创建问答会话 -> 发起 AI/教师/双通道提问 -> 教师端查看待处理问题  
3. 教师上传资料 -> 发起共享 -> 学生端查看当前共享  
4. 课程讨论空间发送实名/匿名消息 -> 搜索消息 -> 查看上下文  
5. 教师创建反馈实例 -> 学生提交反馈 -> 教师查看统计  
6. 管理员查看、创建、更新、删除用户

### P1 回归链路

1. 更新个人资料与头像  
2. 更新外观设置并重新登录恢复  
3. 配置课程 AI 助教边界  
4. 材料更新预览与历史记录  
5. 薄弱点分析与教学分析兜底结果

### P2 回归链路

1. 旧版 `/api/student` 与 `/api/users` 冒烟  
2. 兼容设置接口 `/api/settings/{user_role}/{user_id}`  
3. 复杂错误提示与边界输入校验

## 5. 当前已知但不应误判为“已完整交付”的点

- 问卷自动定时触发尚未做成独立调度器
- 作业提醒天数已存储，但尚未接入独立定时提醒服务
- 部分附件格式只能上传留存或做有限解析
- AI 辅助反馈与分析属于辅助建议，不是最终评分系统
- 课堂同步更适合在真实双端联调中继续验证实时一致性

## 6. 后续文档维护规则

- 新增功能时，先更新本文件再补自动化测试计划
- 如果功能下线或入口变更，必须同步删除或改写旧描述
- 任何“计划中”“准备做”的能力，不得写进“已实现功能矩阵”
