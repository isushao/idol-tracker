# Weibo Agent (GitHub Actions + GitHub Pages)

**English** · [简体中文](README.zh-CN.md)

## Overview

This pipeline collects Weibo posts, generates a JSON data file and a markdown report, and builds a static frontend served on GitHub Pages.

- Data outputs: `weibo_snapshot.json`, `idol_weibo_posts.json`, `report.md`.
- Frontend output: `web/dist/` (static site build)

## Quick local run (without Claude agent)

```bash
python pipeline/run_weibo_agent.py --uid 7449968177
```

Generated files will appear in the repository root and the `web/public/` directory.

## Run with the Claude Agent SDK

Set the `ANTHROPIC_API_KEY` environment variable (or pass `--force-agent`) and run:

```bash
pip install -r pipeline/requirements-agent.txt
python pipeline/run_weibo_agent.py --uid 7449968177 --force-agent
```

Notes:
- If `agent-browser` is available, the agent will prefer it for scraping. On GitHub Actions it can be installed with `npm install -g agent-browser && agent-browser install --with-deps`.
- If `agent-browser` is not available, the pipeline falls back to `pipeline/scrape_weibo_snapshot.py` which uses Playwright.

---

## Deployment: GitHub Actions (scheduled runs)

Use GitHub Actions to run the pipeline on a schedule and to publish the static site to GitHub Pages. Steps:

1. Add any required repository secrets: `ANTHROPIC_API_KEY` (if using the Claude agent).
2. Create a workflow under `.github/workflows/schedule-and-build.yml` that:
   - Runs on a cron schedule (for example `0 */6 * * *` to run every 6 hours).
   - Installs Python and Node, runs the data pipeline, then builds the frontend and uploads the `web/dist` directory as a Pages artifact.

Example workflow snippet:

```yaml
name: Scheduled build & deploy
on:
  schedule:
    - cron: '0 */6 * * *'  # every 6 hours
  workflow_dispatch: {}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install pipeline deps
        run: |
          python -m pip install --upgrade pip
          pip install -r pipeline/requirements.txt
          pip install -r pipeline/requirements-agent.txt || true

      - name: Run data pipeline
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: python pipeline/run_weibo_agent.py --uid 7449968177

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Build web
        working-directory: web
        run: |
          npm ci
          npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v1
        with:
          path: ./web/dist

  deploy:
    needs: build-and-deploy
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v1
```

Notes:
- The build job uploads `web/dist` using `actions/upload-pages-artifact`; the `deploy` job then uses `actions/deploy-pages@v1` to publish the site via GitHub Pages.
- You can also use third-party actions (e.g., `peaceiris/actions-gh-pages`) if you prefer branch-based deployments.

## GitHub Pages configuration

- In the repository Settings → Pages, ensure the site is configured to deploy from GitHub Actions (this is the default when using `actions/deploy-pages`).
- If you choose `gh-pages` branch deployments instead, set the Pages source accordingly.

## Repository secrets and permissions

- Add `ANTHROPIC_API_KEY` if the agent workflow requires it: Settings → Secrets → Actions.
- The Pages deployment via `actions/deploy-pages` uses a GitHub token with the correct permissions automatically when run on the default repository.

## Verification

- After a scheduled run, verify the Actions run (Actions tab) and check the `web` site under Settings → Pages for the published URL.
- You can also use `workflow_dispatch` to trigger the workflow on-demand for testing.

---

## Troubleshooting

- If builds fail due to missing system dependencies (e.g., Playwright), add an explicit install step in the workflow (e.g., install Playwright browsers).
- Check Actions logs for the failing step and re-run manually with `workflow_dispatch` after fixes.

---

**Chinese translation:** [简体中文](README.zh-CN.md)

## 用Claude Agent SDK编排

设置环境变量 `ANTHROPIC_API_KEY`（或传 `--force-agent`），然后：

```bash
pip install -r pipeline/requirements-agent.txt
python pipeline/run_weibo_agent.py --uid 7449968177 --force-agent
```

说明：
- 本机如果装了 `agent-browser`，agent 会优先用它抓取（更贴近你在 Codex 里跑的流程）。
- GitHub Actions 默认可通过 `npm install -g agent-browser && agent-browser install --with-deps` 安装；否则会自动降级为 `pipeline/scrape_weibo_snapshot.py`（Playwright）。
