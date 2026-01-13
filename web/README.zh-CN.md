# Weibo 动态看板（shadcn/ui + Vite）

**简体中文** · [English](README.md)

## 本地运行

```bash
cd web
npm install
npm run sync-data
npm run dev
```

然后打开 `http://localhost:5173`。

## GitHub Pages 与 CI

`vite.config.ts` 会在 CI 中根据 `GITHUB_REPOSITORY` 自动设置 `base`（例如 `/<repo>/`），本地默认是 `/`。

当使用 GitHub Actions 部署时，确保 pipeline 会构建 `web` 并发布 `web/dist` 到 GitHub Pages（参见 `pipeline/README.md` 中的建议工作流片段）。

## 更新数据

在仓库根目录重新生成 `idol_weibo_posts.json` 后，执行：

```bash
cd web
npm run sync-data
```

刷新页面即可看到更新。

---

**English:** [README.md](README.md)
