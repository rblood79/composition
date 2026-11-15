#!/usr/bin/env python3
"""하네스 문서 크기 상한 게이트 — rule · CLAUDE.md · MEMORY.md 가 다시 불어나는 것을 막는다.

  pnpm docs:rule-size            # 상한 초과 시 exit 1
  pnpm docs:rule-size --tighten  # 상한을 현재 크기 + 여유 5% 로 낮춘다 (올리지 않는다)

Why (2026-11-15): layout-engine.md 는 2026-08-31 에 116KB → 분리했는데 상한이 없어 84KB 로 다시 자랐다.
경로별 rule 은 매칭 파일을 읽을 때 전량 로드되고 (catalogRuntime 파일 하나가 rule 3개 · 157k자),
MEMORY.md 는 200줄 · 25KB 뒤가 경고 없이 잘린다 (Claude Code memory 문서).
상한을 올려야 하면 scripts/rule-size-budget.json 을 직접 고치고 커밋 메시지에 사유를 적는다 —
먼저 사건 기록 (Why · 실측 수치) 을 skill reference 로 옮길 수 있는지 본다.
"""
import json, os, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUDGET = os.path.join(ROOT, "scripts", "rule-size-budget.json")
MEMORY = os.path.expanduser(
    "~/.claude/projects/" + ROOT.replace("/", "-") + "/memory/MEMORY.md")


def main():
    cfg = json.load(open(BUDGET))
    default, files = cfg["defaultBytes"], cfg["files"]
    tighten = "--tighten" in sys.argv
    fails, rows = [], []
    for path in sorted(glob.glob(os.path.join(ROOT, ".claude/rules/*.md"))):
        rel = os.path.relpath(path, ROOT)
        size = os.path.getsize(path)
        limit = files.get(rel, default)
        rows.append((rel, size, limit))
        if size > limit:
            fails.append(f"{rel}: {size:,} B > 상한 {limit:,} B")
        elif tighten and rel in files:
            files[rel] = min(limit, max(default, int(size * 1.05)))
    for rel, limits in cfg["lineLimited"].items():
        path = MEMORY if rel == "MEMORY.md" else os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        data = open(path, "rb").read()
        lines, size = data.count(b"\n"), len(data)
        rows.append((rel, size, limits.get("bytes", 0)))
        if lines > limits["lines"]:
            fails.append(f"{rel}: {lines} 줄 > 상한 {limits['lines']} 줄")
        if "bytes" in limits and size > limits["bytes"]:
            fails.append(f"{rel}: {size:,} B > 상한 {limits['bytes']:,} B")
    if tighten:
        json.dump(cfg, open(BUDGET, "w"), ensure_ascii=False, indent=2)
        open(BUDGET, "a").write("\n")
    if "--list" in sys.argv or fails:
        for rel, size, limit in rows:
            print(f"{size:>8,} / {limit:>8,}  {rel}")
    if fails:
        print("\n크기 상한 초과 — 사건 기록 · 실측 수치를 skill reference 로 옮긴다:", file=sys.stderr)
        for f in fails:
            print("  " + f, file=sys.stderr)
        sys.exit(1)
    print(f"rule-size OK ({len(rows)} 파일)")


if __name__ == "__main__":
    main()
