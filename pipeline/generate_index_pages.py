#!/usr/bin/env python3
import argparse
import subprocess
import sys


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sync-only", action="store_true", help="只同步 web/public，不构建")
    args = ap.parse_args()

    run([sys.executable, "pipeline/generate_apple_style_report.py", "--in-json", "idol_weibo_posts.json", "--out-md", "report.md"])
    run(["node", "web/scripts/sync-data.mjs"])

    if not args.sync_only:
        run(["npm", "--prefix", "web", "install", "--no-fund", "--no-audit"])
        run(["npm", "--prefix", "web", "run", "build"])


if __name__ == "__main__":
    main()
