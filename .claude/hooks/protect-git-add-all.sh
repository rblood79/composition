#!/bin/bash
# PreToolUse Hook (Bash matcher, if: Bash(git *)): 전체 스테이징이 다른 세션의 변경을 삼키는 것을 막는다.
#
# 2026-11-15 신설. Why: 같은 checkout 에 병렬 세션 WIP · 수동 편집이 있을 때 `git add -A` 가
# 그것까지 잘못된 메시지로 main 에 올렸다 (2026-07-25 3045fd979 · 2026-08-30 47636a999).
# git-workflow.md §1 의 「자기가 편집하지 않은 파일이 보이면 -A · -u 를 쓰지 않는다」 는 문장이라
# 지켜지지 않을 수 있다 — hook 으로 결정적으로 묻는다.
#
# 동작:
#   1. 전체 스테이징 명령만 대상 — `git add -A|--all|-u|--update|.|:/` · `git commit -a|--all`.
#      경로를 준 `git add <paths>` · `git commit -- <paths>` 는 통과.
#   2. `git status` 의 변경 중 이 세션이 Edit/Write 로 고치지 않은 것
#      (.agent/session-edits/<session_id>.txt 에 없는 것 — track-session-edits.sh 가 기록) 을 찾는다.
#      `-u` · `commit -a` 는 추적 파일만 본다 (untracked 는 스테이징되지 않는다).
#   3. 없으면 통과 (출력 없음). 있으면 목록과 함께 ask.
# 한계: Bash 로 바꾼 자기 파일 (생성기 · 스크립트) 도 「고치지 않은 변경」 으로 보인다 → 묻는다.
#       명령 문자열 전체를 보므로 커밋 메시지 안의 ` -a ` 글자에도 반응할 수 있다 (ask 일 뿐).

set -uo pipefail

INPUT=$(cat)
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
SID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)

[ "$TOOL_NAME" != "Bash" ] && exit 0
[ -z "$COMMAND" ] && exit 0

END='([[:space:];&|)]|$)'
MODE=""
if printf '%s' "$COMMAND" | grep -qE "(^|[^[:alnum:]_])git[[:space:]]+add[[:space:]]([^;&|]*[[:space:]])?(-A|--all|\.|:/)$END"; then
  MODE="all"
elif printf '%s' "$COMMAND" | grep -qE "(^|[^[:alnum:]_])git[[:space:]]+add[[:space:]]([^;&|]*[[:space:]])?(-u|--update)$END"; then
  MODE="tracked"
elif printf '%s' "$COMMAND" | grep -qE "(^|[^[:alnum:]_])git[[:space:]]+commit[[:space:]]([^;&|]*[[:space:]])?(-[b-zA-Z]*a[a-zA-Z]*|--all)$END"; then
  MODE="tracked"
fi
[ -z "$MODE" ] && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
git -C "$PROJECT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

LOG=""
case "$SID" in ""|*[!A-Za-z0-9_-]*) ;; *) LOG="$PROJECT_DIR/.agent/session-edits/$SID.txt" ;; esac

FOREIGN=""
COUNT=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  status="${line:0:2}"
  path="${line:3}"
  case "$path" in *" -> "*) path="${path##* -> }" ;; esac
  [ "$MODE" = "tracked" ] && [ "$status" = "??" ] && continue
  if [ -n "$LOG" ] && grep -qxF -- "$path" "$LOG" 2>/dev/null; then continue; fi
  COUNT=$((COUNT + 1))
  [ "$COUNT" -le 15 ] && FOREIGN="${FOREIGN}  ${status} ${path}
"
done <<LIST
$(git -C "$PROJECT_DIR" -c core.quotePath=false status --porcelain --untracked-files=all 2>/dev/null)
LIST

[ "$COUNT" -eq 0 ] && exit 0

MORE=""
[ "$COUNT" -gt 15 ] && MORE="  … 외 $((COUNT - 15))개
"
REASON="전체 스테이징 — 이 세션이 Edit/Write 로 고치지 않은 변경 ${COUNT}개가 함께 올라갑니다:
${FOREIGN}${MORE}
다른 세션의 WIP · 수동 편집이면 자기 파일만 올리세요: git add <paths> 또는 git commit -- <paths>
(이 세션이 Bash 로 만든 변경이면 그대로 승인. 근거: .claude/rules/git-workflow.md §1)"

jq -n --arg r "$REASON" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: $r
  }
}'
exit 0
