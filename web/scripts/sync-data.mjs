import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "..");

const src = path.join(repoRoot, "idol_weibo_posts.json");
const dstDir = path.join(webRoot, "public");
const dst = path.join(dstDir, "idol_weibo_posts.json");
const reportSrc = path.join(repoRoot, "report.md");
const reportDst = path.join(dstDir, "report.md");

if (!fs.existsSync(src)) {
  throw new Error(`找不到源文件：${src}`);
}

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
if (fs.existsSync(reportSrc)) fs.copyFileSync(reportSrc, reportDst);
process.stdout.write(`ok copied -> ${dst}\n`);
