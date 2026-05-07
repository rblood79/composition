#!/usr/bin/env bash
# 주간 사용 리포트 — 지난 7일간 세션/skill/agent 활용도 분석
# 사용: .claude/hooks/weekly-report.sh [days]  (기본 7)
set -euo pipefail

days="${1:-7}"
proj_sessions="$HOME/.claude/projects/-Users-admin-work-composition"

if [ ! -d "$proj_sessions" ]; then
  echo "세션 디렉토리 없음: $proj_sessions"
  exit 1
fi

cd "$proj_sessions"

echo "=== composition 최근 ${days}일 사용 리포트 ($(date +%Y-%m-%d)) ==="
echo ""

# 세션 수
sess_count=$(find . -name "*.jsonl" -mtime -"$days" -maxdepth 2 | wc -l | tr -d ' ')
echo "세션 수: $sess_count"

# user turns
turns=$(find . -name "*.jsonl" -mtime -"$days" -maxdepth 2 -print0 | xargs -0 grep -hc '"type":"user"' 2>/dev/null | awk '{s+=$1} END {print s+0}')
echo "사용자 턴: $turns"

# skill/agent totals
skill_tot=$(find . -name "*.jsonl" -mtime -"$days" -maxdepth 2 -print0 | xargs -0 grep -hc '"name":"Skill"' 2>/dev/null | awk '{s+=$1} END {print s+0}')
agent_tot=$(find . -name "*.jsonl" -mtime -"$days" -print0 | xargs -0 grep -hc '"name":"Agent"' 2>/dev/null | awk '{s+=$1} END {print s+0}')
echo "Skill 호출: $skill_tot"
echo "Agent 호출: $agent_tot"

if [ "$turns" -gt 0 ]; then
  rate=$(awk "BEGIN {printf \"%.2f\", $skill_tot*1000/$turns}")
  echo "Skill 발동율 (turn 1000당): $rate"
fi

echo ""
echo "--- Skill Top 10 ---"
find . -name "*.jsonl" -mtime -"$days" -maxdepth 2 -print0 | xargs -0 grep -h '"name":"Skill"' 2>/dev/null \
  | grep -oE '"skill":"[^"]+"' | sort | uniq -c | sort -rn | head -10

echo ""
echo "--- Agent Top 10 ---"
find . -name "*.jsonl" -mtime -"$days" -print0 | xargs -0 grep -h '"name":"Agent"' 2>/dev/null \
  | grep -oE '"subagent_type":"[^"]+"' | sort | uniq -c | sort -rn | head -10

# 경고: 미사용 핵심 skill
echo ""
echo "--- 미사용 핵심 Skills 경고 ---"
used=$(find . -name "*.jsonl" -mtime -"$days" -maxdepth 2 -print0 | xargs -0 grep -hE '"skill":"[^"]+"' 2>/dev/null | grep -oE '"skill":"[^"]+"' | sort -u)
for s in "brainstorming" "writing-plans" "verification-before-completion" "systematic-debugging" "test-driven-development"; do
  if ! echo "$used" | grep -q "$s"; then
    echo "  ⚠️  $s — 최근 ${days}일간 0회"
  fi
done

# INDEX.md 자동 갱신 (update-index.sh 연동)
if [ -x "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-index.sh" ]; then
  echo ""
  echo "--- INDEX.md 갱신 ---"
  "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-index.sh" "$days"
fi

exit 0
