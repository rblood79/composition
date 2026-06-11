#!/bin/bash
# PreToolUse Hook (Bash matcher): 커밋 메시지 금지 어휘 차단
#
# 2026-06-11 신설 — "발효" 반복 지적에도 안 고쳐진 근본 원인 = 텍스트 규칙은 모델이
# 무시 가능 + 커밋 메시지가 git log 로 매 세션 재유입하는 최대 source.
#
# Why: CLAUDE.md §"응답·문서 어휘 규칙" 의 어휘 표는 system prompt 자료일 뿐 행동을
# 보장하지 못함 (GitHub Issue #45569 — model-level memory/규칙 ignored 사례 동일).
# git-workflow.md 의 PR 차단이 protect-branch-pr.sh hook 으로 결정적 집행되는 것과
# 동일하게, 어휘도 hook 으로만 결정적 차단된다. 과거 박힌 어휘 (메모리/docs/history)
# 는 건드리지 않음 (append-only, "여러 군데 또 손대기" 회피) — 본 hook 은 신규 유입만 차단.
#
# 동작:
#   1. tool_input.command 가 `git commit` 이고 메시지 (-m/-F/-c heredoc) 에
#      금지 어휘가 있으면 deny.
#   2. 검사 대상 = 커밋 메시지 텍스트만 (-m "..." 인용 안 내용, --file 은 ask 로 우회).
#      코드 식별자/파일 내용/경로는 검사 안 함 → false positive 최소.
#
# 금지 어휘 (CLAUDE.md 어휘 표와 1:1):
#   - "발효"  → 대체: 전환 / 적용 / 도입 / 이관 완료
#   (다른 어휘는 산문 표현이라 커밋 메시지에선 드물고 false positive 위험 → 발효만 hard-block)

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Bash tool 만 매칭
[ "$TOOL_NAME" != "Bash" ] && exit 0
[ -z "$COMMAND" ] && exit 0

# git commit 명령만 대상
if ! echo "$COMMAND" | grep -qE '\bgit[[:space:]]+commit\b'; then
  exit 0
fi

# 금지 어휘 정의 (확장 시 여기 + emit_deny reason 둘 다 갱신)
FORBIDDEN='발효'

# -F <file> / --file=<file> 로 메시지를 파일에서 읽는 경우 → 내용 검사 불가 → ask
if echo "$COMMAND" | grep -qE '\bgit[[:space:]]+commit\b.*(-F[[:space:]=]|--file[[:space:]=])'; then
  if echo "$COMMAND" | grep -qE "$FORBIDDEN"; then
    : # 파일 경로 자체에 어휘가 있을 일은 없으나 fallthrough 하여 일반 검사로
  fi
fi

# 커밋 명령 전체 문자열에서 금지 어휘 grep.
# 메시지는 -m "..." / -m '...' / heredoc 안에 있고, git commit 명령에 어휘가 등장하는
# 경우는 사실상 메시지뿐 (코드 식별자에 "발효" 없음) → 명령 전체 grep 으로 충분.
if echo "$COMMAND" | grep -qE "$FORBIDDEN"; then
  HIT=$(echo "$COMMAND" | grep -oE "[^[:space:]\"']*${FORBIDDEN}[^[:space:]\"']*" | head -3 | tr '\n' ' ')
  REASON_TEXT=$(cat <<INNER_EOF
커밋 메시지 금지 어휘 차단: "발효"
감지: $HIT
명령: $COMMAND

"발효(發效)" 는 법령·조약이 효력을 발생시킨다는 어감이라 catalog/spec 전환 같은
코드 작업에 과잉·부정합입니다. 반복 지적된 어휘이며 CLAUDE.md 어휘 표에 등록됨.

[대체어 — 문맥별]
  - "catalog 발효" / "X 발효"   → "catalog 전환" / "X 전환"
  - "발효 완료"                  → "전환 완료" / "이관 완료"
  - "3종 발효"                   → "3종 전환"
  - 어색하면                     → "적용 / 도입 / 이관" 중 선택

[정책 근거]
- CLAUDE.md §"응답·문서 어휘 규칙 — 의회적·영어 은어 표현 회피"
- 2026-06-11 hook 신설: 텍스트 규칙은 무시 가능, hook 만 결정적 차단

[해결] 커밋 메시지에서 "발효" 를 위 대체어로 바꿔 재시도하세요.
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
fi

exit 0
