# Weibo Dashboard (shadcn/ui + Vite)

**English** · [简体中文](README.zh-CN.md)

## Run locally

```bash
cd web
npm install
npm run sync-data
npm run dev
```

Open `http://localhost:5173` in your browser.

## GitHub Pages & CI

`vite.config.ts` will set `base` automatically in CI based on `GITHUB_REPOSITORY` (e.g., `/<repo>/`). Locally it defaults to `/`.

When deploying via GitHub Actions, ensure the pipeline builds `web` and publishes the `web/dist` directory to GitHub Pages (see `pipeline/README.md` for a recommended workflow snippet).

## Update data

After regenerating `idol_weibo_posts.json` in the repo root, run:

```bash
cd web
npm run sync-data
```

Then refresh the site to see updated content.

---

**Chinese translation:** [简体中文](README.zh-CN.md)
