#!/usr/bin/env bash
# INDEX.md 사용 빈도 자동 갱신
# 데이터 소스: ~/.claude/projects/-Users-admin-work-composition/*.jsonl (session transcripts)
# 실행: .claude/hooks/update-index.sh [days]   (기본 30)
set -euo pipefail

days="${1:-30}"
proj_sessions="$HOME/.claude/projects/-Users-admin-work-composition"
index="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/skills/INDEX.md"

[ ! -d "$proj_sessions" ] && { echo "세션 디렉토리 없음"; exit 1; }
[ ! -f "$index" ] && { echo "INDEX.md 없음"; exit 1; }

cd "$proj_sessions"

# skill 호출 집계
skill_counts=$(find . -name "*.jsonl" -mtime -"$days" -maxdepth 2 -print0 \
  | xargs -0 grep -h '"name":"Skill"' 2>/dev/null \
  | grep -oE '"skill":"[^"]+"' | sed 's/"skill":"//; s/"$//' \
  | sort | uniq -c | awk '{print $2"\t"$1}')

# agent 호출 집계 (transcript 기반 — 가장 포괄적)
agent_counts=$(find . -name "*.jsonl" -mtime -"$days" -maxdepth 2 -print0 \
  | xargs -0 grep -h '"name":"Agent"' 2>/dev/null \
  | grep -oE '"subagent_type":"[^"]+"' | sed 's/"subagent_type":"//; s/"$//' \
  | sort | uniq -c | awk '{print $2"\t"$1}')

# 블록 생성
ts=$(date +%Y-%m-%d)
block_start="<!-- usage-stats-begin -->"
block_end="<!-- usage-stats-end -->"

{
  echo "$block_start"
  echo "<!-- 자동 생성: .claude/hooks/update-index.sh — 수동 편집 금지 -->"
  echo ""
  echo "## 📊 최근 ${days}일 사용 빈도 (갱신: ${ts})"
  echo ""
  echo "### Skills"
  echo ""
  if [ -n "$skill_counts" ]; then
    echo "| Skill | 호출 수 |"
    echo "| --- | ---: |"
    echo "$skill_counts" | sort -k2 -rn -t$'\t' | awk -F'\t' '{printf "| %s | %s |\n", $1, $2}'
  else
    echo "_데이터 없음_"
  fi
  echo ""
  echo "### Agents"
  echo ""
  if [ -n "$agent_counts" ]; then
    echo "| Agent | 호출 수 |"
    echo "| --- | ---: |"
    echo "$agent_counts" | sort -k2 -rn -t$'\t' | awk -F'\t' '{printf "| %s | %s |\n", $1, $2}'
  else
    echo "_데이터 없음_"
  fi
  echo ""
  echo "$block_end"
} > /tmp/usage-stats-block.md

# INDEX.md 갱신: 기존 블록 있으면 교체, 없으면 최하단에 append
if grep -q "$block_start" "$index"; then
  awk -v block_start="$block_start" -v block_end="$block_end" -v block_file="/tmp/usage-stats-block.md" '
    BEGIN { in_block=0 }
    $0 ~ block_start { in_block=1; while ((getline line < block_file) > 0) print line; close(block_file); next }
    $0 ~ block_end   { in_block=0; next }
    !in_block { print }
  ' "$index" > "$index.new" && mv "$index.new" "$index"
else
  echo "" >> "$index"
  cat /tmp/usage-stats-block.md >> "$index"
fi

rm -f /tmp/usage-stats-block.md
echo "INDEX.md 갱신 완료 (${days}일 윈도우)"
