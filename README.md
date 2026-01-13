# Idol Tracker

**English** · [简体中文](README.zh-CN.md)

This repository collects and displays Weibo posts for selected users, generates reports, and publishes a static dashboard using GitHub Pages.

- Data pipeline: `pipeline/` (runs scraping and report generation)
- Frontend: `web/` (Vite + shadcn/ui)

## Deployment overview

- Use GitHub Actions to run the pipeline on a schedule (cron) and to build & publish the `web/dist` site to GitHub Pages.
- `pipeline/README.md` contains detailed instructions and an example workflow for scheduled runs and Pages deployment.
- `web/README.md` contains frontend-specific run & build instructions.

## Quick links

- Pipeline docs (English): `pipeline/README.md`
- Pipeline docs (中文): `pipeline/README.zh-CN.md`
- Web docs (English): `web/README.md`
- Web docs (中文): `web/README.zh-CN.md`

---

If you'd like, I can also create example workflow files under `.github/workflows/` for you to copy or use directly. Let me know if you want that next.