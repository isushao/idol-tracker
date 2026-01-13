# Weibo Agent（GitHub Actions + GitHub Pages）

## 本地跑（不需要Claude）

```bash
python pipeline/run_weibo_agent.py --uid 7449968177
```

会产出：
- `weibo_snapshot.json` / `weibo_snapshot.txt`
- `idol_weibo_posts.json`
- `report.md`
- `web/public/idol_weibo_posts.json`（同步）
- `web/dist/`（静态站点构建产物）

## 用Claude Agent SDK编排

设置环境变量 `ANTHROPIC_API_KEY`（或传 `--force-agent`），然后：

```bash
pip install -r pipeline/requirements-agent.txt
python pipeline/run_weibo_agent.py --uid 7449968177 --force-agent
```

说明：
- 本机如果装了 `agent-browser`，agent 会优先用它抓取（更贴近你在 Codex 里跑的流程）。
- GitHub Actions 默认可通过 `npm install -g agent-browser && agent-browser install --with-deps` 安装；否则会自动降级为 `pipeline/scrape_weibo_snapshot.py`（Playwright）。
