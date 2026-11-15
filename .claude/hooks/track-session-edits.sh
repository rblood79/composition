#!/bin/bash
# PostToolUse Hook (Edit|Write): 이 세션이 고친 파일 경로를 기록한다.
#
# 2026-11-15 신설 — protect-git-add-all.sh 가 「이 세션이 고치지 않은 변경」 을 가려내는 근거.
# 기록: $CLAUDE_PROJECT_DIR/.agent/session-edits/<session_id>.txt (저장소 기준 상대 경로, 한 줄 하나 — gitignore).
# Bash 로 바꾼 파일 (스크립트 · 생성기) 은 기록되지 않는다 → guard 가 확인을 묻는 쪽으로 간다 (안전한 쪽).
# 어떤 경우에도 도구 호출을 막지 않는다 (exit 0).

INPUT=$(cat)
SID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
FP=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$SID" ] && exit 0
[ -z "$FP" ] && exit 0
case "$SID" in *[!A-Za-z0-9_-]*) exit 0 ;; esac

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
case "$FP" in
  "$PROJECT_DIR"/*) REL="${FP#"$PROJECT_DIR"/}" ;;
  /*) exit 0 ;;          # 저장소 밖 파일
  *) REL="$FP" ;;
esac

DIR="$PROJECT_DIR/.agent/session-edits"
mkdir -p "$DIR" 2>/dev/null || exit 0
LOG="$DIR/$SID.txt"
grep -qxF -- "$REL" "$LOG" 2>/dev/null || printf '%s\n' "$REL" >> "$LOG" 2>/dev/null
# 7일 넘은 세션 기록 정리
find "$DIR" -name '*.txt' -mtime +7 -delete 2>/dev/null
exit 0
