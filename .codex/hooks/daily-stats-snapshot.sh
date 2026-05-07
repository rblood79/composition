#!/usr/bin/env bash
# 일별 통계 스냅샷 — 매일 최초 세션 시작 시 1회 기록 (SessionStart에서 호출)
# 기록 형식: {"date":"YYYY-MM-DD","skills":{"name":count,...},"agents":{"type":count,...}}
# 하루 1 entry 누적. 일간 활동 = (오늘 - 어제) diff로 계산 가능
set -euo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
log_file="$project_dir/.claude/stats/daily-log.jsonl"
mkdir -p "$(dirname "$log_file")"
touch "$log_file"

today=$(date +%Y-%m-%d)

# 이미 오늘 기록됨 → skip
if grep -q "\"date\":\"$today\"" "$log_file" 2>/dev/null; then
  exit 0
fi

# mkdir atomic lock (중복 세션 시작 시 race 방지)
lock_dir="$log_file.lock.d"
if ! mkdir "$lock_dir" 2>/dev/null; then
  # 다른 세션이 이미 처리 중 → skip
  exit 0
fi
trap "rmdir '$lock_dir' 2>/dev/null || true" EXIT

# Double-check (lock 획득 이후)
if grep -q "\"date\":\"$today\"" "$log_file" 2>/dev/null; then
  exit 0
fi

proj_sessions="$HOME/.claude/projects/-Users-admin-work-composition"
[ ! -d "$proj_sessions" ] && exit 0

cd "$proj_sessions"

# 전체 기간 누적 집계 (skill / agent)
skill_json=$(find . -name "*.jsonl" -maxdepth 2 -print0 2>/dev/null \
  | xargs -0 grep -h '"name":"Skill"' 2>/dev/null \
  | grep -oE '"skill":"[^"]+"' | sed 's/"skill":"//; s/"$//' \
  | sort | uniq -c | awk 'BEGIN{sep=""} {printf "%s\"%s\":%d", sep, $2, $1; sep=","}')

agent_json=$(find . -name "*.jsonl" -maxdepth 2 -print0 2>/dev/null \
  | xargs -0 grep -h '"name":"Agent"' 2>/dev/null \
  | grep -oE '"subagent_type":"[^"]+"' | sed 's/"subagent_type":"//; s/"$//' \
  | sort | uniq -c | awk 'BEGIN{sep=""} {printf "%s\"%s\":%d", sep, $2, $1; sep=","}')

# 세션 수 / turn 수
session_count=$(find . -name "*.jsonl" -maxdepth 2 2>/dev/null | wc -l | tr -d ' ')
turn_count=$(find . -name "*.jsonl" -maxdepth 2 -print0 2>/dev/null \
  | xargs -0 grep -hc '"type":"user"' 2>/dev/null | awk '{s+=$1} END {print s+0}')

echo "{\"date\":\"$today\",\"sessions\":$session_count,\"turns\":$turn_count,\"skills\":{$skill_json},\"agents\":{$agent_json}}" >> "$log_file"

exit 0
