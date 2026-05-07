#!/usr/bin/env bash
# SessionStart hook — 세션 시작 시 composition 전용 agent/skill 로스터 및 권장 워크플로 주입
set -euo pipefail

# 일별 통계 스냅샷 (하루 1회만 기록, 백그라운드 실행으로 세션 시작 블로킹 없음)
if [ -x "$CLAUDE_PROJECT_DIR/.claude/hooks/daily-stats-snapshot.sh" ]; then
  "$CLAUDE_PROJECT_DIR/.claude/hooks/daily-stats-snapshot.sh" >/dev/null 2>&1 &
fi

# CHANGELOG drift 자동 감시 (rules/changelog.md §2 명시 — 14일/100 commit 초과 시 catch-up 권고)
drift_block=""
CHANGELOG_PATH="$CLAUDE_PROJECT_DIR/docs/CHANGELOG.md"
if [ -f "$CHANGELOG_PATH" ]; then
  last_date=$(grep -m1 -oE '^## \[.*\] - [0-9]{4}-[0-9]{2}-[0-9]{2}' "$CHANGELOG_PATH" 2>/dev/null \
              | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || true)
  if [ -n "$last_date" ]; then
    today_epoch=$(date +%s)
    last_epoch=$(date -j -f "%Y-%m-%d" "$last_date" +%s 2>/dev/null || echo 0)
    if [ "$last_epoch" -gt 0 ]; then
      days_diff=$(( (today_epoch - last_epoch) / 86400 ))
      commits_since=$(git -C "$CLAUDE_PROJECT_DIR" log --since="$last_date" --oneline 2>/dev/null | wc -l | tr -d ' ')
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

## 핵심 Skills (자연어 발동 + \`/\` 호출 모두 가능)
- \`composition-patterns\` — 코드 규칙/패턴 (코드 작업 전 확인)
- \`cross-check\` — CSS↔Skia 렌더링 정합성 (렌더링 수정 후 필수)
- \`parallel-verify\` — 컴포넌트 패밀리 일괄 검증
- \`component-design\` — 새 컴포넌트 설계 (React Aria/Spectrum 참조)
- \`create-adr\` / \`review-adr\` — 아키텍처 결정 문서
- \`react-aria\` / \`react-spectrum\` — 공식 API 레퍼런스
- \`match-target\` — Vision-based visual tuning 루프 (참조 이미지 + budget)
- \`execute-adr\` — ADR design breakdown 의 미-land phase 자율 실행 (type-check + cross-check + main 직접 push)

## Superpowers Skills (워크플로 프로세스)
- \`brainstorming\` → \`writing-plans\` → \`executing-plans\` (다단계 구현)
- \`systematic-debugging\` — 버그 root-cause 4단계
- \`test-driven-development\` — RED-GREEN-REFACTOR
- \`verification-before-completion\` — 완료 직전 evidence 검증
- \`using-git-worktrees\` — 격리된 리팩토링

## Agents (작업 유형별 라우팅)
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
프롬프트에 아래 키워드 포함 시 관련 skill/agent 힌트 자동 주입:
- "렌더링/Canvas/Skia" → cross-check + debugger
- "ADR/아키텍처 결정" → create-adr / review-adr
- "새 컴포넌트/S2 전환" → brainstorming → component-design → implementer
- "버그/에러/실패" → systematic-debugging → debugger
- "리팩토링" → refactorer + worktree
- "테스트" → tester + TDD
- "완료/머지/PR" → verification-before-completion → reviewer
- "정정/아니야/그게 아니라" → same-session memory 적재 권고

## Slash Commands (표준 워크플로)
- \`/cross-check\` — 렌더링 정합성 검증
- \`/new-adr\` — ADR 생성
- \`/impl\` — brainstorm → plan → implement 파이프라인
- \`/fix\` — debug → cross-check 파이프라인
- \`/review\` — 완료 전 품질 검증
- \`/sweep\` — 패밀리 일괄 검증 + audit JSON report
- \`/match-target\` — 참조 이미지 시각 수렴 루프
- \`/execute-adr\` — ADR 자율 phase 실행 (HIGH 위험은 사용자 surface)

## 자동 게이트 (Hook)
- PostToolUse: spec/* 편집 시 \`.claude/.spec-rebuild-pending\` flag → Stop hook 시점 \`pnpm build:specs\` 1회 실행
- Stop: type-check 전 spec rebuild 게이트 → flag 있으면 build → 그 후 type-check

규칙: 한 줄 수정/단순 질문은 skill 스킵 가능. CRITICAL/HIGH 이슈는 즉시 수정.${drift_block}
</composition-workflow-roster>
EOF

exit 0
