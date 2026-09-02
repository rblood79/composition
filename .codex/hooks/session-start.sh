#!/usr/bin/env bash
# SessionStart hook — 세션 시작 시 composition 전용 agent/skill 로스터 및 권장 워크플로 주입
set -euo pipefail
INPUT=$(cat)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/codex-hook-utils.sh"
PROJECT_DIR=$(codex_hook_project_dir "$INPUT")

# CHANGELOG drift 자동 감시 (rules/changelog.md §2 명시 — 14일/100 commit 초과 시 catch-up 권고)
drift_block=""
CHANGELOG_PATH="$PROJECT_DIR/docs/CHANGELOG.md"
if [ -f "$CHANGELOG_PATH" ]; then
  last_date=$(grep -m1 -oE '^## \[.*\] - [0-9]{4}-[0-9]{2}-[0-9]{2}' "$CHANGELOG_PATH" 2>/dev/null \
              | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || true)
  if [ -n "$last_date" ]; then
    today_epoch=$(date +%s)
    last_epoch=$(date -j -f "%Y-%m-%d" "$last_date" +%s 2>/dev/null || echo 0)
    if [ "$last_epoch" -gt 0 ]; then
      days_diff=$(( (today_epoch - last_epoch) / 86400 ))
      commits_since=$(git -C "$PROJECT_DIR" log --since="$last_date" --oneline 2>/dev/null | wc -l | tr -d ' ')
      if [ "$days_diff" -gt 14 ] || [ "$commits_since" -gt 100 ]; then
        drift_block=$(cat <<DRIFT_EOF

## ⚠️ CHANGELOG DRIFT 감지

- 마지막 엔트리: $last_date (${days_diff}일 전, 그 이후 ${commits_since} 커밋)
- 기준 초과: ${days_diff}일 > 14일 OR ${commits_since}개 > 100
- 권고: 새 엔트리 추가 전 \`## [Catch-up YYYY-MM-DD ~ YYYY-MM-DD]\` catch-up 블록 먼저 작성
- 절차: rules/changelog.md §5 참조 (ADR/주제별 bundle, 개별 커밋 나열 금지)
DRIFT_EOF
)
      fi
    fi
  fi
fi

cat <<EOF
<composition-workflow-roster>
# composition 전용 워크플로 (자동 주입 — SessionStart)

## 핵심 Skills (Codex host invocation 정책 반영)
- \`composition-patterns\` — 코드 규칙/패턴 (코드 작업 전 확인)
- \`cross-check\` — CSS↔Skia 렌더링 정합성 (렌더링 수정 후 필수)
- \`parallel-verify\` — 컴포넌트 패밀리 일괄 검증
- \`component-design\` — 새 컴포넌트 설계 (React Aria/Spectrum 참조)
- \`review-adr\` — ADR 검토
- \`create-adr\` — 사용자 명시 요청 시에만 ADR 생성 (user-only)
- \`react-aria\` / \`react-spectrum\` — 공식 API 레퍼런스
- \`match-target\` — 사용자 명시 요청 시에만 실행하는 visual tuning 루프 (user-only)
- \`execute-adr\` — 사용자 명시 요청 시에만 ADR phase 실행 (user-only, HIGH 위험은 사용자 surface)

## Agents (사용자가 위임·병렬 작업을 명시한 경우에만)
| 상황 | 1차 agent | 2차 검증 |
|---|---|---|
| 새 기능 구현 | implementer | reviewer → evaluator |
| 버그 재현/수정 | debugger | cross-check skill |
| 아키텍처 설계/ADR | architect | review-adr skill |
| 대규모 리팩토링 | refactorer (worktree) | reviewer |
| UI 실제 동작 검증 | evaluator (Chrome MCP) | — |
| 테스트 작성 | tester | — |
| 문서 작성 | documenter | — |

## 자동 규칙 (UserPromptSubmit hook)
프롬프트에 아래 키워드 포함 시 관련 skill/gate 힌트 자동 주입:
- "렌더링/Canvas/Skia" → cross-check
- "ADR/아키텍처 결정" → review-adr. create-adr/execute-adr 은 사용자 명시 요청일 때만
- "새 컴포넌트/S2 전환" → component-design
- "버그/에러/실패" → composition-patterns 기반 root-cause 추적
- "리팩토링" → composition-patterns + scoped gate
- "테스트" → 변경 모듈 인접 focused test
- "완료/머지/PR" → evidence 확인 + codex:preflight
- "정정/아니야/그게 아니라" → same-session memory 적재 권고

## Codex Entry Points
- \`\$cross-check\` — 렌더링 정합성 검증
- \`\$parallel-verify\` — 사용자 명시 병렬 검증에만 사용
- \`\$create-adr\` — ADR 생성 (user-only)
- \`\$match-target\` — 참조 이미지 시각 수렴 루프 (user-only)
- \`\$execute-adr\` — ADR phase 실행 (user-only, HIGH 위험은 사용자 surface)
- \`pnpm run agent:work -- verify\` — scope 기반 gate + evidence ledger

## 자동 게이트 (Hook)
- PostToolUse: spec/* 편집 시 \`.codex/.spec-rebuild-pending\` flag → Stop hook 시점 \`pnpm build:specs\` 1회 실행
- Stop: type-check 전 spec rebuild 게이트 → flag 있으면 build → 그 후 type-check

규칙: 한 줄 수정/단순 질문은 skill 스킵 가능. CRITICAL/HIGH 이슈는 즉시 수정.${drift_block}
</composition-workflow-roster>
EOF

exit 0
