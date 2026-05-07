#!/usr/bin/env bash
# composition 전용 statusline — 기본 모델/컨텍스트 + 최근 agent/worktree 정보 + spec-rebuild 보류 표시
set -euo pipefail

input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // empty' 2>/dev/null)
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty' 2>/dev/null)
cwd=$(echo "$input" | jq -r '.workspace.current_dir // empty' 2>/dev/null)

RESET='\033[0m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; CYAN='\033[36m'; MAGENTA='\033[35m'; DIM='\033[2m'

# 컨텍스트 bar
bar=""
if [ -n "$used" ]; then
  filled=$(echo "$used" | awk '{v=int($1/10+0.5); print (v>10?10:v)}')
  empty=$((10 - filled))
  for i in $(seq 1 "$filled"); do bar="${bar}█"; done
  for i in $(seq 1 "$empty"); do bar="${bar}░"; done
  pct=$(echo "$used" | awk '{printf "%d", $1}')
  if [ "$pct" -lt 50 ]; then C="$GREEN"; elif [ "$pct" -lt 80 ]; then C="$YELLOW"; else C="$RED"; fi
  ctx_str=$(printf "${C}[%s] %d%%${RESET}" "$bar" "$pct")
else
  ctx_str=""
fi

# worktree / branch
branch=""
if [ -n "$cwd" ] && [ -d "$cwd/.git" ] || git -C "${cwd:-.}" rev-parse --git-dir >/dev/null 2>&1; then
  branch=$(git -C "${cwd:-.}" branch --show-current 2>/dev/null || echo "")
  [ -n "$branch" ] && branch="${CYAN}⎇ ${branch}${RESET}"
fi

# spec rebuild 보류 표시 (PostToolUse spec-rebuild-flag.sh 가 생성한 flag 존재 시)
spec_flag=""
PROJECT_ROOT="${cwd:-${CLAUDE_PROJECT_DIR:-.}}"
if [ -f "$PROJECT_ROOT/.claude/.spec-rebuild-pending" ]; then
  spec_flag="${MAGENTA}⟳ specs${RESET}"
fi

# 출력 조립
out="$model"
[ -n "$ctx_str" ] && out="$out $ctx_str"
[ -n "$branch" ] && out="$out $branch"
[ -n "$spec_flag" ] && out="$out $spec_flag"

printf '%b' "$out"
