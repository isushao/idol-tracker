#!/usr/bin/env python3
import argparse
import json
from datetime import datetime
from typing import Any, Dict, List, Optional


def _excerpt(s: str, n: int = 80) -> str:
    s = (s or "").strip().replace("\n", " ")
    return s if len(s) <= n else s[: n - 1] + "…"


def _count(posts: List[Dict[str, Any]], pred) -> int:
    return sum(1 for p in posts if pred(p))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-json", default="idol_weibo_posts.json")
    ap.add_argument("--out-md", default="report.md")
    args = ap.parse_args()

    with open(args.in_json, "r", encoding="utf-8") as f:
        data = json.load(f)

    idol = data.get("idol") or {}
    posts = data.get("posts") or []

    name = idol.get("name") or idol.get("uid") or "Weibo"
    fetched_at = data.get("fetched_at")
    try:
        fetched_dt = datetime.fromisoformat(fetched_at.replace("Z", "+00:00")) if fetched_at else None
    except Exception:
        fetched_dt = None

    pinned = _count(posts, lambda p: bool(p.get("is_pinned")))
    videos = _count(posts, lambda p: any(m.get("type") == "video" for m in (p.get("media") or [])))
    lives = _count(posts, lambda p: any(m.get("type") == "live" for m in (p.get("media") or [])))

    lines: List[str] = []
    lines.append(f"# {name} · 动态日报")
    lines.append("")
    lines.append(f"- 抓取时间：{fetched_dt.isoformat(sep=' ', timespec='seconds') if fetched_dt else (fetched_at or '—')}")
    lines.append(f"- 动态条数：{len(posts)}（置顶 {pinned} / 视频 {videos} / 直播 {lives}）")
    lines.append(f"- 来源：{data.get('source_url') or '—'}")
    if data.get("note"):
        lines.append(f"- 备注：{data['note']}")
    lines.append("")
    lines.append("## 列表")
    lines.append("")

    for i, p in enumerate(posts, 1):
        t = p.get("created_at_raw") or "—"
        src = p.get("source_raw")
        stats = p.get("stats") or {}
        likes = stats.get("likes_raw") or "—"
        comments = stats.get("comments_raw") or "—"
        reposts = stats.get("reposts_raw") or "—"
        url = p.get("status_url") or (p.get("links") or [{}])[0].get("url")

        flags = []
        if p.get("is_pinned"):
            flags.append("置顶")
        if any(m.get("type") == "video" for m in (p.get("media") or [])):
            flags.append("视频")
        if any(m.get("type") == "live" for m in (p.get("media") or [])):
            flags.append("直播")

        meta = " · ".join([t, *( [src] if src else [] ), f"赞 {likes}", f"评 {comments}", f"转 {reposts}", *( [f"[{f}]" for f in flags] )]).strip()
        lines.append(f"### {i}. {meta}")
        lines.append("")
        lines.append(_excerpt(p.get("text") or "", 140))
        if url:
            lines.append("")
            lines.append(f"- 链接：{url}")
        lines.append("")

    with open(args.out_md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).strip() + "\n")


if __name__ == "__main__":
    main()
