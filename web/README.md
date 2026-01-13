# Weibo 动态看板（shadcn/ui + Vite）

## 运行

```bash
cd web
npm install
npm run sync-data
npm run dev
```

然后打开 `http://localhost:5173`。

## GitHub Pages

`vite.config.ts` 会在 CI 中根据 `GITHUB_REPOSITORY` 自动设置 `base`（例如 `/<repo>/`），本地默认是 `/`。

## 更新数据

根目录重新生成 `idol_weibo_posts.json` 后，执行：

```bash
cd web
npm run sync-data
```

刷新页面即可。
