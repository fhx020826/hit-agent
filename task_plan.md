# Task Plan

## Goal
在 `/home/hxfeng/fhx-hit-agent` 内完成仓库落地、隔离环境初始化、基础文档建立，并基于真实代码输出当前项目完成情况、后续可优化方向，以及一份可直接用于内部测试的功能清单。

## Phases
- [x] Phase 1: 确认代理使用方式并验证外网访问
- [x] Phase 2: 克隆仓库到独立目录并建立独立 conda 环境
- [x] Phase 3: 阅读关键代码与文档，整理当前项目完成度
- [x] Phase 4: 建立项目长期文档与规范文件
- [x] Phase 5: 运行最小化环境自检并输出分析结论
- [x] Phase 6: 基于真实代码整理内部功能测试矩阵

## Constraints
- 仅在 `/home/hxfeng/fhx-hit-agent` 中进行项目相关操作
- 后续 Python 运行统一使用 `fhx-hit-agent` conda 环境
- 文档内容需与真实代码一致，不夸大未落地能力
- 每轮对话后更新 `work.md`
- 内部功能文档需能直接服务于后续人工回归与自动化测试拆分

## Known Issues
- `~/.bashrc` 中的 conda 初始化仍指向旧路径 `/home/dzmat/miniconda3/bin/conda`
- `clash` / `proxy` 为交互式 shell 函数，非交互 shell 下默认不可直接调用
- 仓库当前未发现自动化测试目录
