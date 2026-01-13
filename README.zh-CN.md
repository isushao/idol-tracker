# Idol Tracker

**简体中文** · [English](README.md)

本仓库用于采集并展示Idol的动态，生成报告，并使用 GitHub Pages 发布静态看板。

- 数据 pipeline：`pipeline/`（负责抓取与报告生成）
- 前端：`web/`（Vite + shadcn/ui）

## 部署概览

- 使用 GitHub Actions 定时运行采集并构建，同时将 `web/dist` 发布到 GitHub Pages。
- 详细步骤与示例工作流请参见 `pipeline/README.zh-CN.md`。
- 前端相关运行与构建说明见 `web/README.zh-CN.md`。

## 快速链接

- Pipeline 文档（中文）：`pipeline/README.zh-CN.md`
- Pipeline docs（English）：`pipeline/README.md`
- Web 文档（中文）：`web/README.zh-CN.md`
- Web docs（English）：`web/README.md`

---

如果你需要，我可以接着为你创建可直接使用的示例 workflow 文件到 `.github/workflows/`，告诉我是否需要。