#!/usr/bin/env python3
"""낡은 코드 심볼 스캔 — 문서 · 메모리가 소스에 없는 이름을 현재 것처럼 인용하는지 잡는다.

삭제 커밋이 소스만 지우고 `.claude/` 규칙 · skill · 메모리의 이름은 두고 가서 생긴 drift
(2026-10-08: contracts.md 의 `readImmediateSelectionSnapshot` 등 10개, ssot-hierarchy.md 2개,
composition-patterns 4개, docs/ 26 파일 → legacy) 를 재발 전에 잡기 위한 게이트.

판정:
  - 백틱으로 감싼 식별자 (SCREAMING_SNAKE · camelCase · PascalCase, 8자 이상) 가 소스
    (apps · packages · scripts · .claude/hooks, .md 제외) 어디에도 없으면 「부재」.
  - 같은 줄에 「옛 · 삭제 · 제거 · 기록 · 당시 · 정정 · →」 류 표지가 있으면 HIST (이력 인용, 허용),
    없으면 LIVE (현재 것처럼 인용 — 수정 대상). 문맥 = 줄 + 직전 줄 + 표 머리행 + 가까운 제목.
    파일 첫 5줄에 `<!-- stale-symbols: ledger -->` 가 있으면 파일 전체를 이력 기록으로 본다.
  - 외부 API 참조 문서 (react-aria · react-spectrum skill reference · docs/explanation/research 등)
    는 기본 제외.

사용:
  pnpm docs:stale-symbols                 # 게이트 영역 (.claude/rules · skills/composition-patterns · review · agents) — LIVE 있으면 exit 1
  pnpm docs:stale-symbols --docs       # docs/ 현행 영역까지 보고 (exit 는 게이트 영역만 반영)
  pnpm docs:stale-symbols --memory     # auto-memory 디렉터리까지 보고 (/wiki-lint 가 호출)
  pnpm docs:stale-symbols --all        # 둘 다
  pnpm docs:stale-symbols --json out.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict

ROOT = subprocess.run(
    ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True
).stdout.strip()
MEMORY_DIR = os.path.expanduser(
    "~/.claude/projects/-Users-admin-work-composition/memory"
)

GATE_ROOTS = [
    ".claude/rules",
    ".claude/agents",
    ".claude/skills/composition-patterns",
    ".claude/skills/review",
    ".claude/skills/review-adr",
    ".claude/skills/cross-check",
    ".claude/skills/evaluate",
    ".claude/skills/fix",
    ".claude/skills/create-adr",
    ".claude/skills/execute-adr",
    ".claude/skills/component-design",
    "CLAUDE.md",
    "AGENTS.md",
]
DOCS_ROOTS = [
    "docs/README.md",
    "docs/adr/README.md",
    "docs/reference",
    "docs/explanation/architecture",
    "docs/how-to",
    "docs/features",
    "docs/migrations",
]
# 외부 API · 외부 제품 조사 — 우리 소스에 없는 이름이 정상
EXCLUDE = re.compile(
    r"docs/explanation/research/|docs/reference/upload/|docs/reference/api/|"
    r"REACT_ARIA_LIBRARIES|docs/reference/audits/|docs/legacy/|"
    r"project-pen-|reference-devtools-|reference-obsidian|reference-webllm|"
    r"project-openpencil|project-taffy|project-adobe-oss|/archive/"
)
SYMBOL = re.compile(r"`([A-Za-z_][A-Za-z0-9_]*)`")
HIST = re.compile(
    r"옛|삭제|제거|deleted|removed|legacy|이전|폐기|대체|→|당시|소멸|정정|기록|실측|"
    r"Superseded|superseded|Phase 4e|없다|없음|사라|확증|20\d\d-\d\d-\d\d"
)
LEDGER_MARK = "<!-- stale-symbols: ledger -->"  # 파일 전체가 실측 · 이력 기록 — 전부 HIST


def hist_context(lines: list[str], i: int) -> str:
    """줄 자체 + 직전 비어 있지 않은 줄 + (표 안이면) 표 머리행 + 가까운 위 제목."""
    parts = [lines[i]]
    j = i - 1
    while j >= 0 and not lines[j].strip():
        j -= 1
    if j >= 0:
        parts.append(lines[j])
    if lines[i].lstrip().startswith("|"):
        k = i
        while k > 0 and lines[k - 1].lstrip().startswith("|"):
            k -= 1
        parts.append(lines[k])  # 표 머리행
    for k in range(i, -1, -1):
        if lines[k].startswith("#"):
            parts.append(lines[k])
            break
    return "\n".join(parts)


def looks_like_symbol(s: str) -> bool:
    if len(s) < 8:
        return False
    if re.fullmatch(r"[A-Z][A-Z0-9_]+", s) and "_" in s:
        return True
    if re.fullmatch(r"[a-z]+[A-Z][A-Za-z0-9]+", s):
        return True
    return bool(re.fullmatch(r"[A-Z][a-z]+[A-Z][A-Za-z0-9]+", s))


def source_corpus() -> str:
    files = subprocess.run(
        ["git", "ls-files", "apps", "packages", "scripts", ".claude/hooks",
         "pnpm-workspace.yaml", "package.json"],
        capture_output=True, text=True, cwd=ROOT, check=True,
    ).stdout.split()
    parts: list[str] = []
    for p in files:
        if p.endswith(".md"):
            continue
        fp = os.path.join(ROOT, p)
        if os.path.isfile(fp):
            with open(fp, errors="ignore") as f:
                parts.append(f.read())
    return "\n".join(parts)


def md_files(roots: list[str], base: str) -> list[str]:
    out: list[str] = []
    for r in roots:
        p = os.path.join(base, r)
        if os.path.isfile(p):
            out.append(p)
        elif os.path.isdir(p):
            for d, _, fs in os.walk(p):
                out += [os.path.normpath(os.path.join(d, f)) for f in fs if f.endswith(".md")]
    return sorted(set(out))


def scan(files: list[str], corpus: str):
    """파일 → {symbol: (tag, line, excerpt)} — 파일당 심볼 첫 등장만."""
    result: dict[str, dict[str, tuple[str, int, str]]] = {}
    for f in files:
        rel = os.path.relpath(f, ROOT) if f.startswith(ROOT) else f
        if EXCLUDE.search(rel):
            continue
        with open(f, errors="ignore") as fh:
            lines = fh.read().split("\n")
        seen: dict[str, tuple[str, int, str]] = {}
        ledger = any(LEDGER_MARK in l for l in lines[:5])
        for i, line in enumerate(lines):
            for m in SYMBOL.finditer(line):
                s = m.group(1)
                if s in seen or not looks_like_symbol(s) or s in corpus:
                    continue
                j = line.find(s)
                ex = line[max(0, j - 60): j + len(s) + 40]
                tag = "HIST" if ledger or HIST.search(hist_context(lines, i)) else "LIVE"
                seen[s] = (tag, i + 1, ex.strip())
        if seen:
            result[rel] = seen
    return result


def report(title: str, res, live_only: bool) -> int:
    live = 0
    rows = []
    for f, syms in sorted(res.items()):
        items = [(s, v) for s, v in syms.items() if v[0] == "LIVE" or not live_only]
        if not items:
            continue
        n_live = sum(1 for _, v in items if v[0] == "LIVE")
        live += n_live
        rows.append((f, items, n_live))
    print(f"\n## {title} — LIVE {live} (파일 {len(rows)})")
    for f, items, _ in sorted(rows, key=lambda r: -r[2]):
        print(f"  {f}")
        for s, (tag, ln, _) in items:
            print(f"    [{tag}] {s} @L{ln}")
    return live


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs", action="store_true")
    ap.add_argument("--memory", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--hist", action="store_true", help="HIST 인용도 같이 출력")
    ap.add_argument("--json")
    args = ap.parse_args()

    corpus = source_corpus()
    out = {}
    gate = scan(md_files(GATE_ROOTS, ROOT), corpus)
    out["gate"] = gate
    live = report("게이트 영역 (.claude 규칙 · skill · agent)", gate, not args.hist)

    if args.docs or args.all:
        docs = scan(md_files(DOCS_ROOTS, ROOT), corpus)
        out["docs"] = docs
        report("docs/ 현행 영역 (보고만)", docs, not args.hist)
    if args.memory or args.all:
        if os.path.isdir(MEMORY_DIR):
            mem = scan(md_files(["."], MEMORY_DIR), corpus)
            out["memory"] = mem
            report("auto-memory (보고만 — /wiki-lint 가 정정 노트 추가)", mem, not args.hist)
        else:
            print(f"\n(memory dir 없음: {MEMORY_DIR})")

    if args.json:
        with open(args.json, "w") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)

    if live:
        print(
            f"\n✗ 게이트 영역에 현재 것처럼 인용된 낡은 심볼 {live}개 — 현재 이름으로 바꾸거나 "
            "「옛 … 삭제」 로 이력 표시 (줄에 표지어가 있으면 HIST 로 통과)."
        )
        return 1
    print("\n✓ 게이트 영역 낡은 심볼 0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
