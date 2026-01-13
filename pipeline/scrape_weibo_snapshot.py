#!/usr/bin/env python3
import argparse
import asyncio
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


def _indent(n: int) -> str:
    return " " * n


def _escape_quotes(s: str) -> str:
    return s.replace('"', '\\"')


def _node_label(node: Dict[str, Any]) -> str:
    role = node.get("role") or "node"
    name = node.get("name")
    level = node.get("level")

    if role == "text":
        if name is None:
            return "text:"
        return f"text: {name}"

    if role == "heading":
        if name is None:
            base = "heading"
        else:
            base = f'heading "{_escape_quotes(str(name))}"'
        if level is not None:
            return f"{base} [level={level}]"
        return base

    if role == "link":
        if name is None:
            return "link"
        return f'link "{_escape_quotes(str(name))}"'

    if role == "img":
        if name is None:
            return "img"
        return f'img "{_escape_quotes(str(name))}"'

    if name is None:
        return f"{role}"
    return f'{role} "{_escape_quotes(str(name))}"'


def snapshot_to_text(snapshot: Dict[str, Any]) -> str:
    lines: List[str] = []

    def walk(node: Dict[str, Any], indent: int) -> None:
        children = node.get("children") or []
        props = node.get("properties") or []
        has_url_prop = False
        if isinstance(props, list):
            for p in props:
                try:
                    k = p.get("name")
                except Exception:
                    continue
                if k in ("url", "href"):
                    has_url_prop = True
                    break

        has_children = (isinstance(children, list) and len(children) > 0) or has_url_prop

        label = _node_label(node)
        prefix = f"{_indent(indent)}- "

        if has_children:
            lines.append(f"{prefix}{label}:")
        else:
            lines.append(f"{prefix}{label}")

        # link URL / other props -> 以子行形式输出，便于下游解析
        if isinstance(props, list):
            for p in props:
                try:
                    k = p.get("name")
                    v = p.get("value")
                except Exception:
                    continue
                if not k or v is None:
                    continue
                if k in ("url", "href"):
                    lines.append(f"{_indent(indent + 2)}- /url: {v}")

        for c in children:
            if isinstance(c, dict):
                walk(c, indent + 2)

    # 兼容不同浏览器/平台：强制用 document 作为根节点，保证 banner/article/contentinfo 等块的缩进稳定。
    synthetic_root = {"role": "document", "children": snapshot.get("children") or []}
    walk(synthetic_root, 0)
    return "\n".join(lines)


async def scrape(uid: str, scrolls: int, scroll_px: int, wait_ms: int, headless: bool) -> Dict[str, Any]:
    from playwright.async_api import async_playwright  # type: ignore

    url = f"https://m.weibo.cn/u/{uid}"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(user_agent=DEFAULT_UA, locale="zh-CN", viewport={"width": 390, "height": 844})
        page = await context.new_page()

        await page.goto(url, wait_until="domcontentloaded", timeout=90_000)
        await page.wait_for_timeout(wait_ms)

        for _ in range(scrolls):
            await page.mouse.wheel(0, scroll_px)
            await page.wait_for_timeout(wait_ms)

        snap = await page.accessibility.snapshot()
        if not isinstance(snap, dict):
            raise RuntimeError("accessibility.snapshot() 返回非 dict，无法处理")

        await context.close()
        await browser.close()
        return snap


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--uid", required=True)
    ap.add_argument("--scrolls", type=int, default=6)
    ap.add_argument("--scroll-px", type=int, default=2500)
    ap.add_argument("--wait-ms", type=int, default=1200)
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--out-json", default="weibo_snapshot.json")
    ap.add_argument("--out-txt", default="weibo_snapshot.txt")
    args = ap.parse_args()

    snap = asyncio.run(scrape(args.uid, args.scrolls, args.scroll_px, args.wait_ms, headless=not args.headed))
    txt = snapshot_to_text(snap)

    payload = {"success": True, "data": {"snapshot": txt, "refs": {}}, "error": None}
    with open(args.out_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    with open(args.out_txt, "w", encoding="utf-8") as f:
        f.write(txt)


if __name__ == "__main__":
    main()
