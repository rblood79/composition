#!/bin/bash
# PreToolUse Hook: 사용자 명시 발의 없이 ADR 신규 파일 자동 생성 차단
#
# Why: 60일 ADR 243건 중 84건 Proposed (35%) 일부 claude 주도 발의.
#      `feedback-no-derived-adr-mid-execution.md` / `feedback-adr-dependency-direction-stale-baseline.md`
#      memory 명문화에도 반복 위반 (verbal correction 의존, hook 강제 X).
#
# 동작:
#   1. tool_input.file_path 가 docs/adr/<숫자>-...md 신규 파일 패턴인지 확인
#   2. transcript_path 에서 직전 사용자 메시지 (userType=external, content=string) 추출
#   3. 직전 5개 사용자 메시지에 ADR 발의 의도 키워드 ("ADR" / "/new-adr" / "create-adr") 매칭
#   4. evidence 없으면 permissionDecision: deny + 안내
#
# 예외:
#   - design/, reviews/, completed/ 하위 파일은 ADR 본문 아니므로 통과
#   - 기존 파일 수정 (Edit) 은 통과 — 신규 생성 (Write 으로 file 미존재) 만 검증

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)

[ -z "$FILE_PATH" ] && exit 0

# Edit/Write 만 매칭 — Edit 도 일부 통과 시켜야 안전 (기존 ADR 본문 수정)
# 신규 생성은 보통 Write. Edit 라도 file 이 없으면 신규로 간주.
if [ "$TOOL_NAME" != "Write" ] && [ "$TOOL_NAME" != "Edit" ]; then
  exit 0
fi

# ADR 본문 신규 패턴 매칭 (design/reviews/completed/ 제외)
case "$FILE_PATH" in
  */docs/adr/design/*|*/docs/adr/reviews/*|*/docs/adr/completed/*)
    exit 0
    ;;
  */docs/adr/[0-9]*.md|*/docs/adr/[0-9][0-9]*.md|*/docs/adr/[0-9][0-9][0-9]*.md|*/docs/adr/[0-9][0-9][0-9][0-9]*.md)
    # ADR 본문 패턴 매칭. 기존 파일이면 (수정) skip
    if [ -f "$FILE_PATH" ]; then
      exit 0
    fi
    ;;
  *)
    exit 0
    ;;
esac

# 여기 도달 = 신규 ADR 본문 파일 생성 시도
# transcript 에서 직전 사용자 명시 발의 evidence 검증
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  # transcript 접근 불가 → 안전하게 ask (사용자 1회 confirm)
  if command -v jq >/dev/null 2>&1; then
    jq -n '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "신규 ADR 파일 생성 — transcript 검증 불가, 사용자 1회 confirm 요구"
      }
    }'
  else
    echo "신규 ADR 파일 생성 — transcript 접근 불가" >&2
    exit 2
  fi
  exit 0
fi

# 직전 사용자 메시지 (userType=external + content=string) 최근 5개
RECENT_USER_MSG=$(jq -r '
  select(.type == "user"
    and (.userType // "") == "external"
    and ((.message.content // "") | type) == "string")
  | .message.content
' "$TRANSCRIPT" 2>/dev/null | tail -5)

# 발의 의도 키워드 매칭 (case-insensitive)
# - "ADR" 단독 또는 "ADR-NNN" / "ADR 발의" / "ADR 생성" / "ADR 작성" / "ADR 만들"
# - "/new-adr" / "create-adr" slash 또는 skill 호출
if echo "$RECENT_USER_MSG" | grep -qiE 'ADR|new-adr|create-adr'; then
  exit 0
fi

# evidence 없음 → deny
REASON_TEXT=$(cat <<INNER_EOF
자동 ADR 발의 차단: $FILE_PATH

직전 5개 사용자 메시지에 ADR 발의 의도 키워드가 없습니다.
필요 키워드: ADR / new-adr / create-adr / /new-adr (case-insensitive)

[정책 근거]
- ~/.claude/projects/-Users-admin-work-composition/memory/feedback-no-derived-adr-mid-execution.md
- ~/.claude/projects/-Users-admin-work-composition/memory/feedback-adr-dependency-direction-stale-baseline.md
- composition CLAUDE.md §"본질 사고 작업은 extended thinking 명시 진입"

[해결 방법]
1. 사용자에게 명시 ADR 발의 confirm 요청
   - 예: "이 변경을 ADR 로 정리할까요? (네/아니오)"
2. 사용자가 명시 발의 응답 후 다시 시도
   - 예: "네, ADR 작성해주세요" / "ADR-NNN 발의해주세요"
3. design breakdown 으로 분리 가능한 sub-phase 인지 재검토

[Edge case 우회]
- 사용자가 직전에 "ADR" 키워드 없이 의도 전달한 경우 사용자에게 명시 요청
- 절대 우회 금지 — claude 자체 판단으로 ADR 발의 = 사용자 신뢰 손실 + 진행 흐름 차단
INNER_EOF
)

if command -v jq >/dev/null 2>&1; then
  jq -n --arg r "$REASON_TEXT" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
else
  echo "$REASON_TEXT" >&2
  exit 2
fi
exit 0
