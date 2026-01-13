import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Heart, MessageCircle, Repeat2, Video, Pin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ScrollAreaViewport } from "@/components/ui/scroll-area-viewport";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type WeiboStats = {
  reposts_raw: string | null;
  comments_raw: string | null;
  likes_raw: string | null;
  reposts: number | null;
  comments: number | null;
  likes: number | null;
};

type WeiboLink = { text: string | null; url: string };
type WeiboMedia =
  | { type: "video"; url: string }
  | { type: "live"; url: string }
  | { type: "video_meta"; play_count_raw: string; play_count: number | null; duration: string };

type WeiboPost = {
  is_pinned: boolean;
  author: string | null;
  created_at_raw: string | null;
  created_at_local_guess: string | null;
  source_raw: string | null;
  text: string;
  emojis: string[];
  links: WeiboLink[];
  media: WeiboMedia[];
  stats: WeiboStats;
  status_id: string | null;
  status_url: string | null;
};

type WeiboIdol = {
  uid: string;
  name: string | null;
  followers_raw: string | null;
  following_raw: string | null;
  verified_raw: string | null;
  followers: number | null;
  following: number | null;
};

type WeiboData = {
  source_url: string;
  fetched_at: string;
  note?: string;
  idol: WeiboIdol;
  posts: WeiboPost[];
};

function formatNumber(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("zh-CN").format(n);
}

function postHasVideo(post: WeiboPost) {
  return post.media.some((m) => m.type === "video");
}

function postHasLive(post: WeiboPost) {
  return post.media.some((m) => m.type === "live");
}

function postTextIncludes(post: WeiboPost, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const hay = [post.text, post.created_at_raw ?? "", post.source_raw ?? "", ...(post.emojis ?? [])].join("\n").toLowerCase();
  return hay.includes(query);
}

function parseSortKey(post: WeiboPost) {
  const s = post.created_at_local_guess ?? "";
  // YYYY-MM-DD HH:MM
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (m) return Number(new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`).getTime()) || 0;

  // YYYY-MM-DD
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return Number(new Date(`${d[1]}-${d[2]}-${d[3]}T00:00:00`).getTime()) || 0;

  return 0;
}

function pickMainUrl(post: WeiboPost) {
  if (post.status_url) return post.status_url;
  const video = post.media.find((m) => m.type === "video") as Extract<WeiboMedia, { type: "video" }> | undefined;
  if (video) return video.url;
  const live = post.media.find((m) => m.type === "live") as Extract<WeiboMedia, { type: "live" }> | undefined;
  if (live) return live.url;
  const any = post.links.find((l) => l.url);
  return any?.url ?? null;
}

function useLocalDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const v = localStorage.getItem("theme");
    if (v === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    } else if (v === "light") {
      document.documentElement.classList.remove("dark");
      setDark(false);
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  return { dark, toggle };
}

export default function App() {
  const [data, setData] = useState<WeiboData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "pinned" | "video" | "live">("all");
  const { dark, toggle } = useLocalDarkMode();

  async function load() {
    setErr(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}idol_weibo_posts.json`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as WeiboData;
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const base = data.posts.filter((p) => postTextIncludes(p, q));
    const byTab = base.filter((p) => {
      if (tab === "pinned") return p.is_pinned;
      if (tab === "video") return postHasVideo(p);
      if (tab === "live") return postHasLive(p);
      return true;
    });
    return byTab.slice().sort((a, b) => parseSortKey(b) - parseSortKey(a));
  }, [data, q, tab]);

  const idol = data?.idol;
  const fetchedAt = data?.fetched_at ? new Date(data.fetched_at) : null;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/40">
      <header className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="container py-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">Weibo 动态看板</h1>
                <Badge variant="secondary">JSON 驱动</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {idol?.name ?? "—"} · 粉丝 {formatNumber(idol?.followers ?? null)} · 关注 {formatNumber(idol?.following ?? null)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                抓取时间：{fetchedAt ? fetchedAt.toLocaleString("zh-CN") : "—"} · 共 {data?.posts.length ?? 0} 条（当前筛选 {filtered.length} 条）
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={toggle}>
                {dark ? "浅色" : "深色"}
              </Button>
              <Button variant="outline" onClick={load}>
                刷新
              </Button>
              {data?.source_url ? (
                <Button variant="outline" asChild>
                  <a href={data.source_url} target="_blank" rel="noreferrer">
                    打开主页 <ExternalLink />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          {idol?.verified_raw ? <p className="mt-3 text-sm text-muted-foreground">{idol.verified_raw}</p> : null}
          {data?.note ? <p className="mt-1 text-xs text-muted-foreground">{data.note}</p> : null}
        </div>
      </header>

      <main className="container py-6">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>筛选</CardTitle>
              <CardDescription>支持搜索正文/时间/来源/表情。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex w-full items-center gap-2 md:max-w-md">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索…" />
                <Button variant="secondary" onClick={() => setQ("")}>
                  清空
                </Button>
              </div>
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full md:w-auto">
                <TabsList className="w-full md:w-auto">
                  <TabsTrigger value="all">全部</TabsTrigger>
                  <TabsTrigger value="pinned">置顶</TabsTrigger>
                  <TabsTrigger value="video">视频</TabsTrigger>
                  <TabsTrigger value="live">直播</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {err ? (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle>加载失败</CardTitle>
                <CardDescription className="text-destructive">{err}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  需要在 `web/public/` 放置 `idol_weibo_posts.json`。你也可以先跑 `npm run sync-data` 同步根目录的 JSON。
                </p>
              </CardContent>
            </Card>
          ) : null}

          <ScrollArea className="h-[70dvh] rounded-xl border bg-background">
            <ScrollAreaViewport className="p-4">
              <div className="grid gap-4">
                {filtered.map((post, idx) => (
                  <PostCard key={`${post.status_id ?? "noid"}-${idx}`} post={post} />
                ))}
                {!data ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
                {data && filtered.length === 0 ? <p className="text-sm text-muted-foreground">没有匹配的内容。</p> : null}
              </div>
            </ScrollAreaViewport>
            <ScrollBar />
          </ScrollArea>
        </div>
      </main>

      <footer className="container pb-10 pt-2 text-xs text-muted-foreground">
        <Separator className="mb-3" />
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <span>数据文件：`{import.meta.env.BASE_URL}idol_weibo_posts.json`（静态）</span>
          <span className="flex items-center gap-2">
            <a className="underline underline-offset-4" href={`${import.meta.env.BASE_URL}report.md`} target="_blank" rel="noreferrer">
              查看报告
            </a>
            <span>· 定时跑 `pipeline/run_weibo_agent.py` 自动更新。</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

function PostCard({ post }: { post: WeiboPost }) {
  const [expanded, setExpanded] = useState(false);
  const mainUrl = pickMainUrl(post);
  const hasVideo = postHasVideo(post);
  const hasLive = postHasLive(post);

  const videoMeta = post.media.find((m) => m.type === "video_meta") as Extract<WeiboMedia, { type: "video_meta" }> | undefined;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {post.is_pinned ? (
                <Badge variant="secondary" className="gap-1">
                  <Pin className="size-3.5" /> 置顶
                </Badge>
              ) : null}
              {hasVideo ? (
                <Badge variant="outline" className="gap-1">
                  <Video className="size-3.5" /> 视频
                </Badge>
              ) : null}
              {hasLive ? <Badge variant="outline">直播</Badge> : null}
              {post.source_raw ? <Badge variant="secondary">{post.source_raw}</Badge> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>时间：{post.created_at_raw ?? "—"}</span>
              {post.created_at_local_guess ? <span>推断：{post.created_at_local_guess}</span> : null}
              {videoMeta ? (
                <span>
                  播放：{videoMeta.play_count_raw} · 时长：{videoMeta.duration}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "收起" : "展开"}
            </Button>
            {mainUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={mainUrl} target="_blank" rel="noreferrer">
                  打开 <ExternalLink />
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className={expanded ? "whitespace-pre-wrap text-sm leading-relaxed" : "max-h-24 overflow-hidden whitespace-pre-wrap text-sm leading-relaxed"}>
          {post.text || "—"}
        </p>

        {post.emojis?.length ? (
          <div className="flex flex-wrap gap-2">
            {post.emojis.map((e) => (
              <Badge key={e} variant="outline">
                [{e}]
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Repeat2 className="size-4" /> 转发 {post.stats.reposts_raw ?? "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-4" /> 评论 {post.stats.comments_raw ?? "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="size-4" /> 赞 {post.stats.likes_raw ?? "—"}
          </span>
        </div>

        {post.links?.length ? (
          <div className="flex flex-col gap-1">
            <Separator />
            <div className="flex flex-wrap gap-2">
              {post.links.map((l, i) => (
                <Button key={`${l.url}-${i}`} variant="link" size="sm" asChild className="h-auto px-0 py-0">
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.text ?? l.url}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
