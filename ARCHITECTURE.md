# Weibo Agent 架构（对应示例图）

**GitHub Actions（调度层）**
- `.github/workflows/weibo-pages.yml`
- 职责：定时触发、环境安装、构建并部署 GitHub Pages

**Python 脚本执行层**
- `pipeline/run_weibo_agent.py`：用 Claude Agent SDK（可选）编排整条流水线
- `pipeline/scrape_weibo_snapshot.py`：Playwright 抓取页面可访问性快照 -> `weibo_snapshot.json/txt`
- `weibo_collect.mjs`：把快照解析成 `idol_weibo_posts.json`
- `pipeline/combine_results.py`：去重合并
- `pipeline/generate_apple_style_report.py`：生成 `report.md`
- `web/scripts/sync-data.mjs`：同步 `idol_weibo_posts.json`/`report.md` 到 `web/public/`

**静态页面（展示层 / GitHub Pages）**
- `web/`：Vite + shadcn/ui
- 读取 `web/public/idol_weibo_posts.json`，并提供 `report.md` 链接
