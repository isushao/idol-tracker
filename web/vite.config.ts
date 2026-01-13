import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: (() => {
    const explicit = process.env.VITE_BASE?.trim();
    if (explicit) return explicit.endsWith("/") ? explicit : `${explicit}/`;
    const repo = process.env.GITHUB_REPOSITORY;
    if (!repo) return "/";
    const name = repo.split("/")[1];
    return name ? `/${name}/` : "/";
  })(),
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
