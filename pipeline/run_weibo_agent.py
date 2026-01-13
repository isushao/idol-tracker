#!/usr/bin/env python3
import argparse
import asyncio
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional
import shutil
import json
from datetime import datetime, timezone


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def has_anthropic_key() -> bool:
    """检查是否配置了 Anthropic 认证(支持 API_KEY 或 AUTH_TOKEN)"""
    return bool(
        os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("ANTHROPIC_AUTH_TOKEN")
    )

def _read_fetched_at(path: str) -> Optional[str]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        v = data.get("fetched_at")
        return str(v) if v else None
    except Exception:
        return None

def _assert_updated(old_fetched_at: Optional[str], json_path: str) -> None:
    new_fetched_at = _read_fetched_at(json_path)
    if not new_fetched_at:
        raise RuntimeError(f"{json_path} 缺少 fetched_at，疑似未生成/未更新")
    if old_fetched_at and new_fetched_at == old_fetched_at:
        raise RuntimeError(f"{json_path} fetched_at 未变化（{new_fetched_at}），疑似复用旧结果")

    # 再做一个“新鲜度”校验：fetched_at 距离当前时间不应太久（避免误用旧文件）
    try:
        dt = datetime.fromisoformat(new_fetched_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta = abs((now - dt).total_seconds())
        if delta > 6 * 3600:
            raise RuntimeError(f"{json_path} fetched_at 过旧：{new_fetched_at}")
    except ValueError:
        # 允许解析失败（比如你后续改格式）；至少保证 fetched_at 有变化
        pass


async def run_with_agent(uid: str, scrolls: int) -> None:
    from claude_agent_sdk import ClaudeAgentOptions, query  # type: ignore

    # 构建 options 参数,支持自定义 base_url
    options_dict = {
        "allowed_tools": ["Bash", "Read", "Write", "Glob", "Skill"],
        "permission_mode": "bypassPermissions",
        "setting_sources": ["project"],
        "model": "sonnet",
        "max_turns": 40,
        "system_prompt": (
            "你是在CI里运行的自动化agent。目标：更新 idol_weibo_posts.json，并生成静态站点所需文件。"
            "优先使用 agent-browser（如果环境里有该命令）完成页面抓取；否则使用 Playwright 脚本。"
            "严格按步骤执行，不要改代码，不要做额外输出文件。"
        ),
    }

    # 如果配置了自定义 base_url,传入 SDK
    base_url = os.environ.get("ANTHROPIC_BASE_URL")
    if base_url:
        options_dict["base_url"] = base_url

    # 如果配置了 AUTH_TOKEN 而非 API_KEY,需要设置环境变量映射
    auth_token = os.environ.get("ANTHROPIC_AUTH_TOKEN")
    if auth_token and not os.environ.get("ANTHROPIC_API_KEY"):
        os.environ["ANTHROPIC_API_KEY"] = auth_token

    options = ClaudeAgentOptions(**options_dict)

    prompt = f"""
你要在当前仓库根目录执行一次“Idol动态 -> JSON -> 报告 -> 静态站点”的流水线。

重要：无论现有文件是否存在/是否非空，都必须重新抓取并重新生成所有产物；不要因为文件存在而跳过任何步骤。

要求：
1) 抓取 https://m.weibo.cn/u/{uid} ，滚动加载更多内容（scrolls={scrolls}），生成 weibo_snapshot.json + weibo_snapshot.txt
2) 用 node weibo_collect.mjs 把快照解析成 idol_weibo_posts.json（必须传入 uid/source-url 参数）
3) 去重合并：python pipeline/combine_results.py
4) 生成 report.md：python pipeline/generate_apple_style_report.py
5) 同步到 web/public：node web/scripts/sync-data.mjs
6) 生成静态站点：npm --prefix web install && npm --prefix web run build（产物在 web/dist）

抓取实现（必须二选一，优先A）：
A) 如果系统里存在 agent-browser 命令（用 `command -v agent-browser` 判断），则按“agent-browser技能”的方式抓取：
   - agent-browser --session weibo open https://m.weibo.cn/u/{uid}
   - 滚动加载：循环 {scrolls} 次执行 `agent-browser --session weibo scroll down 2500`，每次后 `agent-browser --session weibo wait --load networkidle`
   - 导出：`agent-browser --session weibo snapshot -d 12 --json > weibo_snapshot.json`
   - 关闭：`agent-browser --session weibo close`
B) 如果没有 agent-browser（例如 GitHub Actions），使用 Playwright 脚本抓取：
   - python pipeline/scrape_weibo_snapshot.py --uid {uid} --scrolls {scrolls}

工具使用约束：
- 全程只用 Bash 工具执行命令；
- 运行前先记录旧的 fetched_at（如果存在）：OLD=$(node -e 'try{{console.log(require(\"./idol_weibo_posts.json\").fetched_at||\"\")}}catch(e){{}}' 2>/dev/null || true)
- 运行后必须验证 idol_weibo_posts.json 的 fetched_at 与 OLD 不同（如果 OLD 非空）；
- 最后用 Read 检查 web/public/idol_weibo_posts.json 是否存在且非空，并把其前 20 行打印出来；
- 另外检查 web/dist/index.html 是否存在（静态站点已生成）。
""".strip()

    async for msg in query(prompt=prompt, options=options):
        # CI日志只要能看到agent在干嘛即可
        t = getattr(msg, "type", None)
        if t == "assistant" and getattr(msg, "message", None):
            for c in msg.message.content:
                if getattr(c, "type", None) == "text":
                    sys.stdout.write(c.text + "\n")


def run_fallback(uid: str, scrolls: int) -> None:
    old_fetched_at = _read_fetched_at("idol_weibo_posts.json")

    if shutil.which("agent-browser"):
        run(["agent-browser", "--session", "weibo", "open", f"https://m.weibo.cn/u/{uid}"])
        for _ in range(scrolls):
            run(["agent-browser", "--session", "weibo", "scroll", "down", "2500"])
            run(["agent-browser", "--session", "weibo", "wait", "--load", "networkidle"])
        with open("weibo_snapshot.json", "w", encoding="utf-8") as f:
            subprocess.run(
                ["agent-browser", "--session", "weibo", "snapshot", "-d", "12", "--json"],
                check=True,
                stdout=f,
            )
        run(["agent-browser", "--session", "weibo", "close"])
    else:
        # 友好提示：如果 playwright 没装，会直接报 ModuleNotFoundError
        try:
            subprocess.run([sys.executable, "-c", "import playwright"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                "当前环境缺少抓取依赖：未找到 `agent-browser`，且 Python 未安装 `playwright`。\n"
                "任选其一：\n"
                "1) 安装 agent-browser：npm i -g agent-browser && agent-browser install\n"
                "2) 安装 Python Playwright：pip install -r pipeline/requirements.txt && python -m playwright install chromium\n"
            ) from e
        run([sys.executable, "pipeline/scrape_weibo_snapshot.py", "--uid", uid, "--scrolls", str(scrolls)])

    run(
        [
            "node",
            "weibo_collect.mjs",
            "weibo_snapshot.json",
            "weibo_snapshot.txt",
            "idol_weibo_posts.json",
            "--uid",
            uid,
            "--source-url",
            f"https://m.weibo.cn/u/{uid}",
        ]
    )
    _assert_updated(old_fetched_at, "idol_weibo_posts.json")
    run([sys.executable, "pipeline/combine_results.py"])
    run([sys.executable, "pipeline/generate_apple_style_report.py", "--in-json", "idol_weibo_posts.json", "--out-md", "report.md"])
    run(["node", "web/scripts/sync-data.mjs"])
    run(["npm", "--prefix", "web", "install", "--no-fund", "--no-audit"])
    run(["npm", "--prefix", "web", "run", "build"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--uid", default="7449968177")
    ap.add_argument("--scrolls", type=int, default=6)
    ap.add_argument("--force-agent", action="store_true", help="强制用Claude Agent SDK编排（需要ANTHROPIC_API_KEY）")
    args = ap.parse_args()

    if args.force_agent or has_anthropic_key():
        try:
            asyncio.run(run_with_agent(args.uid, args.scrolls))
            return
        except ModuleNotFoundError as e:
            if args.force_agent:
                raise
            sys.stderr.write(f"[warn] 未安装 Claude Agent SDK（{e}），改用本地fallback流程\n")

    run_fallback(args.uid, args.scrolls)


if __name__ == "__main__":
    main()
