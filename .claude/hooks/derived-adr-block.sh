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

# 직전 사용자 메시지 (userType=external + content=string) 최근 8개
#
# 2026-06-01 버그 수정 (사용자 ADR-910 생성 차단 사례):
#   jq 필터가 system 주입 메시지(<task-notification> / slash command / local-command
#   stdout / 자율 loop tick / bash-input 등)도 userType=external + content=string 으로
#   통과시켜, 이것들이 tail 윈도우를 잠식 → 진짜 사용자 입력이 밀려남 → 사용자 명시 발의
#   ("adr-910 생성해")가 윈도우 밖으로 사라져 deny. 동시 세션/자율 loop 환경에서 악화.
#   → system 주입 패턴을 사용자 입력에서 제외한 뒤 tail -8 (마진 확대) 로 진짜 입력만 검사.
RECENT_USER_MSG=$(jq -r '
  select(.type == "user"
    and (.userType // "") == "external"
    and ((.message.content // "") | type) == "string")
  | .message.content
  | select(
      (startswith("<task-notification") | not)
      and (startswith("<command-") | not)
      and (startswith("<local-command") | not)
      and (startswith("<bash-input>") | not)
      and (startswith("<bash-stdout>") | not)
      and (startswith("<bash-stderr>") | not)
      and (startswith("Caveat:") | not)
      and (contains("autonomous-loop") | not)
      and (startswith("# Autonomous loop") | not)
      and (startswith("You scheduled this tick") | not)
      and (startswith("Use PushNotification") | not)
      and ((. | gsub("^[[:space:]]+";"")) != "")
    )
' "$TRANSCRIPT" 2>/dev/null | tail -8)

# 발의 의도 키워드 매칭 (case-insensitive)
# 2026-05-11 정밀화 (ADR-123~126 retro E1 — 원 plan 파일은 소멸):
# 단순 "ADR" mention 만으로는 통과 안 됨. ADR-127 우회 사례 (사용자 메시지에 ADR 단순 mention 만 있어도 통과).
# 명시 발의 표현만 매칭:
# - 한국어: "새 ADR" / "신규 ADR" / "ADR 발의" / "ADR 생성" / "ADR 작성" / "ADR 만들" / "ADR 분리" / "ADR-NNN 발의" / "fork"
# - 영어: "new ADR" / "create ADR" / "propose ADR" / "draft ADR" / "ADR fork" / "/new-adr" / "create-adr"
# 일상 mention ("ADR-126 Phase 2 진행 중" / "ADR 참조" / "ADR 본문 갱신") 는 통과 X
if echo "$RECENT_USER_MSG" | grep -qiE '(새|신규|new|create|propose|draft)[[:space:]]*ADR|ADR(-[0-9]+)?[[:space:]]*(발의|생성|작성|만들|분리|fork|propose|draft|create)|/new-adr|create-adr'; then
  exit 0
fi

# evidence 없음 → ask (deny 아님)
#
# 2026-06-01 버그 수정: 과거 deny 는 윈도우 오염(system 메시지 잠식)으로 사용자 명시
# 발의를 못 잡았을 때 사용자에게 선택권조차 주지 않아, 사용자 ADR 생성을 막는 버그가 됐다.
# ask 로 완화 — hook 본래 의도(claude 자가 발의 무한 생산 차단)는 유지된다:
#   - claude 자가 발의 (사용자 미요청) → 사용자가 거부 → 차단 효과 그대로
#   - 사용자 명시 발의인데 윈도우 오염으로 키워드 못 잡음 → 사용자가 승인 → 정상 통과
# 즉 "자가 발의 차단" 과 "사용자 발의 허용" 둘 다 사용자 판단 1회로 정확히 분리된다.
REASON_TEXT=$(cat <<INNER_EOF
ADR 신규 파일 생성 확인: $FILE_PATH

직전 사용자 입력에서 ADR 발의 키워드를 못 찾았습니다.
(키워드: 새/신규 ADR, ADR 생성/작성/발의/분리, create-adr 등)

판단 기준:
- 사용자가 이 ADR 생성을 명시 요청했다면 → 승인 (정상)
- claude 가 사용자 요청 없이 자가 발의 중이면 → 거부

[정책 근거] feedback-no-derived-adr-mid-execution.md / CLAUDE.md §전제·관점 의문 처리
INNER_EOF
)

if command -v jq >/dev/null 2>&1; then
  jq -n --arg r "$REASON_TEXT" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: $r
    }
  }'
else
  echo "$REASON_TEXT" >&2
  exit 2
fi
exit 0
