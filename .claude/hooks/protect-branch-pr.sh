#!/bin/bash
# PreToolUse Hook (Bash matcher): branch 분기 / PR 생성 차단
#
# 2026-05-12 신설 — ~/.claude/plans/adr-123-124-125-126-sunny-crescent.md E6
# (retro 결과 PR #277 머지 발견 후 추가)
#
# Why: 메모리 `feedback-pr-vs-direct-push` "web PR 자체 금지. 예외 없음."
# 그러나 본 plan 의 E1 hook (derived-adr-block.sh) 은 ADR 신규 파일만 차단 — branch/PR
# 영역 미포함. PR #277 (claude/adr-128-vocabulary-alignment → main) 머지 우회 사례
# 후속 보강.
#
# 동작:
#   1. tool_input.command 가 다음 패턴 매칭 시 검증 진입:
#      - `git checkout -b <branch>` (단 main / master 외)
#      - `git switch -c <branch>`
#      - `git push -u origin <branch>` (단 origin main 외)
#      - `git push origin <branch>` (단 origin main 외)
#      - `gh pr create ...`
#   2. transcript_path 에서 직전 5개 사용자 메시지 추출
#   3. 사용자 명시 PR/branch 발의 표현 grep — 미발견 시 deny
#
# 통과 표현 (case-insensitive):
#   - 한국어: "PR 생성" / "PR 만들" / "PR 머지" / "branch 분기" / "branch 분리"
#     / "feature branch" / "워크트리 push" / "외부 branch push"
#   - 영어: "create PR" / "make PR" / "merge PR" / "new branch" / "branch fork"
#     / "feature branch" / "/gh pr"
#
# 통과 안 됨 (일상 git 명령):
#   - "이거 push 해줘" (단순 push, branch 명시 없음 → main push 가정)
#   - "git checkout main" / "git checkout <existing-branch>" (기존 branch 전환)

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)

# Bash tool 만 매칭
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

[ -z "$COMMAND" ] && exit 0

# 차단 대상 명령 패턴 매칭
# - git checkout -b <name> / git switch -c <name>
# - git push -u origin <name> (main 제외)
# - git push origin <name> (main 제외)
# - gh pr create
TRIGGERED=""

if echo "$COMMAND" | grep -qE '\bgit[[:space:]]+(checkout[[:space:]]+-b|switch[[:space:]]+-c)[[:space:]]+'; then
  # 신규 branch 분기 — main/master 분기는 통과 (drift fallback)
  if echo "$COMMAND" | grep -qE '\b(checkout[[:space:]]+-b|switch[[:space:]]+-c)[[:space:]]+(main|master)\b'; then
    exit 0
  fi
  TRIGGERED="git checkout -b / switch -c (신규 branch 분기)"
fi

if echo "$COMMAND" | grep -qE '\bgit[[:space:]]+push[[:space:]]+(-u[[:space:]]+)?origin[[:space:]]+'; then
  # origin main / master push 는 통과 (default 흐름)
  if echo "$COMMAND" | grep -qE '\bpush[[:space:]]+(-u[[:space:]]+)?origin[[:space:]]+(main|master)\b'; then
    exit 0
  fi
  # branch 명시 없는 단순 push 도 통과
  if echo "$COMMAND" | grep -qE '\bgit[[:space:]]+push[[:space:]]*$'; then
    exit 0
  fi
  TRIGGERED="${TRIGGERED:+$TRIGGERED + }git push origin <branch> (main 외)"
fi

if echo "$COMMAND" | grep -qE '\bgh[[:space:]]+pr[[:space:]]+create\b'; then
  TRIGGERED="${TRIGGERED:+$TRIGGERED + }gh pr create"
fi

[ -z "$TRIGGERED" ] && exit 0

# 여기 도달 = 차단 대상 명령. transcript 에서 사용자 명시 발의 evidence 검증
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  # transcript 접근 불가 → 안전하게 ask
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg t "$TRIGGERED" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: ("branch/PR 명령 — transcript 검증 불가, 사용자 1회 confirm 필요: " + $t)
      }
    }'
  else
    echo "branch/PR 명령 — transcript 접근 불가: $TRIGGERED" >&2
    exit 2
  fi
  exit 0
fi

# 직전 5개 사용자 메시지 (userType=external + content=string) 추출
RECENT_USER_MSG=$(jq -r '
  select(.type == "user"
    and (.userType // "") == "external"
    and ((.message.content // "") | type) == "string")
  | .message.content
' "$TRANSCRIPT" 2>/dev/null | tail -5)

# 발의 의도 키워드 매칭 (case-insensitive)
# 한국어: "PR 생성/만들/머지" / "branch 분기/분리/생성" / "feature branch" / "워크트리 push"
# 영어: "create PR" / "make PR" / "merge PR" / "new branch" / "branch fork" / "feature branch" / "/gh pr"
if echo "$RECENT_USER_MSG" | grep -qiE 'PR[[:space:]]*(생성|만들|머지|올려|올려줘|create|make|merge)|(생성|만들|create|make|new)[[:space:]]*PR|(branch|브랜치)[[:space:]]*(분기|분리|생성|fork|create|new|push)|feature[[:space:]]*branch|워크트리[[:space:]]*push|gh[[:space:]]*pr'; then
  exit 0
fi

# evidence 없음 → deny
REASON_TEXT=$(cat <<INNER_EOF
자동 branch/PR 명령 차단: $TRIGGERED
명령: $COMMAND

직전 5개 사용자 메시지에 PR/branch 명시 발의 표현이 없습니다.
필요 키워드 (case-insensitive):
  - 한국어: "PR 생성/만들/머지" / "branch 분기/분리/생성" / "feature branch" / "워크트리 push"
  - 영어: "create PR" / "make PR" / "merge PR" / "new branch" / "feature branch"

[정책 근거]
- ~/.claude/projects/-Users-admin-work-composition/memory/feedback-pr-vs-direct-push.md
- composition .claude/rules/git-workflow.md (web PR 자체 금지 정책, 2026-04-27 강화)
- ~/.claude/plans/adr-123-124-125-126-sunny-crescent.md E6

[해결 방법]
1. main 직접 push 가능한지 먼저 점검:
   git push origin main (default 흐름)
2. main 차단 시 사용자에게 직접 ! 명령 실행 요청
3. PR 가 정말 필요하면 사용자 명시 발의 ("PR 생성해줘") 받은 후 재시도

[Edge case 우회]
- worktree 작업도 main 직접 통합 (PR 불필요): worktree commit → main worktree merge → git push origin main
- 사용자 명시 "PR 만들어줘" 시점에만 통과 — 자동 발의 절대 금지
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
