#!/usr/bin/env python3
import argparse
import json
from typing import Any, Dict, List


def _dedupe(posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []
    for p in posts:
        key = str(p.get("status_id") or "") + "|" + str(p.get("created_at_raw") or "") + "|" + (p.get("text") or "")[:80]
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-json", default="idol_weibo_posts.json")
    ap.add_argument("--out-json", default="idol_weibo_posts.json")
    args = ap.parse_args()

    with open(args.in_json, "r", encoding="utf-8") as f:
        data = json.load(f)

    posts = data.get("posts") or []
    data["posts"] = _dedupe(posts)

    with open(args.out_json, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
