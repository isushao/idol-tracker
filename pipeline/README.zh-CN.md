# Weibo Agent（GitHub Actions + GitHub Pages）

**简体中文** · [English](README.md)

## 概要

该 pipeline 用于收集Idol动态，生成 JSON 数据文件和 Markdown 报告，并构建静态前端，最终托管在 GitHub Pages 上。

- 数据输出：`weibo_snapshot.json`、`idol_weibo_posts.json`、`report.md`。
- 前端产物：`web/dist/`（静态站点构建结果）。

## 本地跑（不需要 Claude）

```bash
python pipeline/run_weibo_agent.py --uid 7449968177
```

会在仓库根目录和 `web/public/` 生成输出文件。

## 使用 Claude Agent SDK

设置环境变量 `ANTHROPIC_API_KEY`（或传 `--force-agent`），然后：

```bash
pip install -r pipeline/requirements-agent.txt
python pipeline/run_weibo_agent.py --uid 7449968177 --force-agent
```

说明：
- 如果本机安装了 `agent-browser`，agent 将优先使用它进行抓取。在 GitHub Actions 中可以使用 `npm install -g agent-browser && agent-browser install --with-deps` 安装。
- 若无 `agent-browser`，pipeline 会降级使用 `pipeline/scrape_weibo_snapshot.py`（基于 Playwright）。

---

## 部署：GitHub Actions 定时运行

通过 GitHub Actions 定时运行采集并把静态站点发布到 GitHub Pages。步骤：

1. 在仓库设置中添加需要的 secrets：例如 `ANTHROPIC_API_KEY`（如使用 agent）。
2. 在 `.github/workflows/schedule-and-build.yml` 添加工作流：
   - 使用 `schedule`（例如 `0 */6 * * *` 表示每 6 小时运行一次）。
   - 安装 Python 与 Node，运行数据采集，构建前端并将 `web/dist` 上传为 Pages artifact。

参考工作流片段：

```yaml
name: Scheduled build & deploy
on:
  schedule:
    - cron: '0 */6 * * *'  # 每 6 小时
  workflow_dispatch: {}

# ... (同 English 文档中的示例)
```

部署说明：
- 推荐使用 `actions/upload-pages-artifact` + `actions/deploy-pages` 完成从 artifact 到 GitHub Pages 的发布。
- 也可以选择 `peaceiris/actions-gh-pages` 进行基于分支的发布。

## GitHub Pages 配置

- 仓库 Settings → Pages，确保站点设置为使用 GitHub Actions 部署（使用 `actions/deploy-pages` 时的默认选项）。

## 验证与故障排查

- 在 Actions 页面查看定时执行情况与构建日志。
- 如果因系统依赖（例如 Playwright）导致失败，请在 workflow 中增加对应的安装步骤。

---

**English:** [README.md](README.md)
