import fs from "node:fs";

function indentOf(line) {
  const m = line.match(/^\s*/);
  return m ? m[0].length : 0;
}

function parseCount(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*([万亿])?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2];
  if (!unit) return Math.round(n);
  if (unit === "万") return Math.round(n * 1e4);
  if (unit === "亿") return Math.round(n * 1e8);
  return null;
}

function pad2(x) {
  return String(x).padStart(2, "0");
}

function guessCreatedAtLocal(raw, fetchedAtIso) {
  const s = String(raw || "").trim();
  const base = new Date(fetchedAtIso);
  if (Number.isNaN(base.getTime())) return null;

  // 昨天 HH:MM ...
  {
    const m = s.match(/^昨天\s*(\d{1,2}):(\d{2})/);
    if (m) {
      const d = new Date(base);
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(Number(m[1]))}:${pad2(Number(m[2]))}`;
    }
  }

  // M-D HH:MM ...
  {
    const m = s.match(/^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (m) {
      const y = base.getFullYear();
      return `${y}-${pad2(Number(m[1]))}-${pad2(Number(m[2]))} ${pad2(Number(m[3]))}:${pad2(Number(m[4]))}`;
    }
  }

  // YYYY-M-D
  {
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
  }

  return null;
}

function reconstructSnapshotText(snapshotJsonPath, outTxtPath) {
  const d = JSON.parse(fs.readFileSync(snapshotJsonPath, "utf8"));
  const s = d?.data?.snapshot;
  if (typeof s === "string") {
    fs.writeFileSync(outTxtPath, s);
    return s;
  }
  if (!s || typeof s !== "object") throw new Error("snapshot格式不符合预期（缺少data.snapshot）");
  // 兼容某些实现把字符串展开成对象：{0:'a',1:'b',...}
  const keys = Object.keys(s)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  let out = "";
  for (const k of keys) out += s[String(k)];
  fs.writeFileSync(outTxtPath, out);
  return out;
}

function parseWeiboSnapshotText(snapshotText, fetchedAtIso) {
  const lines = snapshotText.split(/\r?\n/);

  const idol = {
    uid: null,
    name: null,
    followers_raw: null,
    following_raw: null,
    verified_raw: null,
  };

  for (const l of lines) {
    if (!idol.following_raw && l.includes("text: 关注") && l.includes("粉丝")) {
      const m = l.match(/text:\s*关注([^\s]+)\s*粉丝([^\s]+)/);
      if (m) {
        idol.following_raw = m[1];
        idol.followers_raw = m[2];
      }
    }
    if (!idol.verified_raw && l.includes("paragraph: 微博认证：")) {
      idol.verified_raw = l.split("paragraph:")[1]?.trim() ?? null;
    }
    if (!idol.name && l.includes("text: TOP登陆少年-苏新皓")) idol.name = "TOP登陆少年-苏新皓";
    if (idol.name && idol.followers_raw && idol.verified_raw) break;
  }

  const posts = [];
  let pendingPinned = false;
  let current = null;
  let state = null; // banner | article | contentinfo
  let lastLink = null;

  function startPost() {
    current = {
      is_pinned: pendingPinned,
      author: idol.name,
      created_at_raw: null,
      created_at_local_guess: null,
      source_raw: null,
      text: "",
      emojis: [],
      links: [],
      media: [],
      stats: { reposts_raw: null, comments_raw: null, likes_raw: null, reposts: null, comments: null, likes: null },
      status_id: null,
      status_url: null,
    };
    pendingPinned = false;
    state = "banner";
    lastLink = null;
  }

  function finalizePost() {
    if (!current) return;
    current.emojis = Array.from(new Set(current.emojis));
    current.links = current.links
      .filter((l) => l && l.url && l.url !== "javascript:;")
      .map((l) => ({ text: l.text ?? null, url: l.url.startsWith("/") ? `https://m.weibo.cn${l.url}` : l.url }));

    if (current.status_url) {
      current.links = current.links.filter((l) => !(l.text === "全文" && l.url === current.status_url));
    }

    // 如果正文为空，用明显的主链接名兜底（直播/视频）
    if (!current.text) {
      const candidate = current.links.find((l) => l.text && /微博(直播|视频)/.test(l.text));
      if (candidate) current.text = candidate.text;
    }

    posts.push(current);
    current = null;
    state = null;
    lastLink = null;
  }

  let contentinfoHeadings = [];
  let textParts = [];

  function flushText() {
    if (!current) return;
    current.text = textParts.join("").trim();
    textParts = [];
  }

  function flushContentInfo() {
    if (!current) return;
    const [repostsRaw, commentsRaw, likesRaw] = contentinfoHeadings;
    current.stats.reposts_raw = repostsRaw ?? null;
    current.stats.comments_raw = commentsRaw ?? null;
    current.stats.likes_raw = likesRaw ?? null;
    current.stats.reposts = parseCount(repostsRaw);
    current.stats.comments = parseCount(commentsRaw);
    current.stats.likes = parseCount(likesRaw);
    contentinfoHeadings = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const t = rawLine.trim();
    const ind = indentOf(rawLine);

    if (ind === 2 && t.startsWith('- heading "置顶"')) {
      pendingPinned = true;
      continue;
    }

    // contentinfo结束：缩进回到2（出现下一个兄弟节点）
    if (state === "contentinfo" && ind === 2 && t !== "- contentinfo:") {
      flushContentInfo();
      state = null;
      i -= 1;
      continue;
    }

    if (ind === 2 && t === "- banner:") {
      // 新banner前先收尾上一条（无论是否遇到contentinfo）
      if (current) {
        if (state === "contentinfo") flushContentInfo();
        flushText();
        finalizePost();
      }
      startPost();
      continue;
    }

    if (!current) continue;

    if (ind === 2 && t === "- article:") {
      state = "article";
      lastLink = null;
      continue;
    }

    if (ind === 2 && t === "- contentinfo:") {
      state = "contentinfo";
      contentinfoHeadings = [];
      lastLink = null;
      continue;
    }

    if (state === "banner") {
      // banner中：level=4那条heading是时间/来源
      if (ind === 4) {
        const m = t.match(/^- heading "([^"]+)" .* \[level=4\]$/);
        if (m && !current.created_at_raw) {
          current.created_at_raw = m[1];
          current.created_at_local_guess = guessCreatedAtLocal(m[1], fetchedAtIso);
          const from = m[1].match(/来自\s*(.+)$/);
          if (from) current.source_raw = from[1].trim();
        }
      }
      continue;
    }

    if (state === "article") {
      // 只吃article直接子节点（缩进4）；忽略更深层的可访问性描述，避免把ARIA/截断文本拼进正文
      if (ind === 4 && t.startsWith("- text:")) {
        const v = rawLine.split("- text:")[1]?.trim() ?? "";
        textParts.push(v);

        const play = v.match(/^([0-9.]+[万亿]?)次播放\s+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)$/);
        if (play) current.media.push({ type: "video_meta", play_count_raw: play[1], play_count: parseCount(play[1]), duration: play[2] });
        continue;
      }

      if (ind === 4 && t.startsWith("- img")) {
        const m = t.match(/\[([^\]]+)\]/);
        if (m) current.emojis.push(m[1]);
        continue;
      }

      if (ind === 4 && t.startsWith("- link ")) {
        const m = rawLine.match(/- link\s+"([^"]+)"/);
        lastLink = { text: m ? m[1] : null, url: null };
        current.links.push(lastLink);
        continue;
      }

      if (lastLink && ind === 6 && t.startsWith("- /url:")) {
        const url = rawLine.split("- /url:")[1]?.trim();
        if (url) {
          lastLink.url = url;
          if (url.startsWith("/status/")) {
            current.status_id = url.replace("/status/", "").trim();
            current.status_url = `https://m.weibo.cn${url}`;
          }
          const full = url.startsWith("/") ? `https://m.weibo.cn${url}` : url;
          if (full.startsWith("https://video.weibo.com/")) current.media.push({ type: "video", url: full });
          if (full.includes("/wblive/") || full.includes("weibo.com/l/wblive/")) current.media.push({ type: "live", url: full });
        }
        continue;
      }

      continue;
    }

    if (state === "contentinfo") {
      if (ind === 4) {
        const m = t.match(/^- heading "([^"]+)"/);
        if (m) contentinfoHeadings.push(m[1]);
      }
      continue;
    }
  }

  if (current) {
    if (state === "contentinfo") flushContentInfo();
    flushText();
    finalizePost();
  }

  return {
    idol: {
      ...idol,
      followers: parseCount(idol.followers_raw),
      following: parseCount(idol.following_raw),
    },
    posts,
  };
}

const fetchedAt = new Date().toISOString();

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--uid") {
      flags.uid = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--source-url") {
      flags.sourceUrl = argv[i + 1];
      i += 1;
      continue;
    }
    positional.push(a);
  }
  return { flags, positional };
}

function inferUid({ uid, sourceUrl }) {
  const explicit = (uid ?? process.env.WEIBO_UID ?? "").toString().trim();
  if (explicit) return explicit;

  const u = (sourceUrl ?? "").toString().trim();
  const m1 = u.match(/\/u\/(\d+)/);
  if (m1) return m1[1];
  const m2 = u.match(/[?&]uid=(\d+)/);
  if (m2) return m2[1];
  return "7449968177";
}

// 输入（兼容两种写法）：
// 1) node weibo_collect.mjs weibo_snapshot.json weibo_snapshot.txt idol_weibo_posts.json --uid 7449968177 --source-url https://m.weibo.cn/u/7449968177
// 2) node weibo_collect.mjs --uid 7449968177 --source-url https://m.weibo.cn/u/7449968177 weibo_snapshot.json weibo_snapshot.txt idol_weibo_posts.json
const { flags, positional } = parseArgs(process.argv.slice(2));
const snapshotJsonPath = positional[0] ?? "weibo_snapshot.json";
const snapshotTxtPath = positional[1] ?? "weibo_snapshot.txt";
const outJsonPath = positional[2] ?? "idol_weibo_posts.json";
const uid = inferUid({ uid: flags.uid, sourceUrl: flags.sourceUrl });
const sourceUrl = (flags.sourceUrl ?? process.env.WEIBO_SOURCE_URL ?? `https://m.weibo.cn/u/${uid}`).toString().trim();

const snapshotText = reconstructSnapshotText(snapshotJsonPath, snapshotTxtPath);
const parsed = parseWeiboSnapshotText(snapshotText, fetchedAt);
parsed.idol.uid = uid;

const out = {
  source_url: sourceUrl,
  fetched_at: fetchedAt,
  note: "数据来自agent-browser可访问性树快照；created_at_local_guess仅基于fetched_at做相对时间推断（未做微博时区校准）。",
  idol: parsed.idol,
  posts: parsed.posts,
};

fs.writeFileSync(outJsonPath, JSON.stringify(out, null, 2));
process.stdout.write(`ok posts=${out.posts.length} -> ${outJsonPath}\n`);
