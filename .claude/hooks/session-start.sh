#!/usr/bin/env bash
# SessionStart hook — CHANGELOG drift · MEMORY.md 비대화 경고 (상시 컨텍스트가 계산 못 하는 시점 신호만)
set -euo pipefail

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

# MEMORY.md 비대화 감시 (harness 가 인덱스 로드 시 ~24KB 초과분을 truncate → 뒷부분 항목 소실)
#   임계 30KB 초과 시 세션 시작에 1회 경고. 비차단 — 압축 권고만.
memory_block=""
MEMORY_PATH="$HOME/.claude/projects/-Users-admin-work-composition/memory/MEMORY.md"
if [ -f "$MEMORY_PATH" ]; then
  mem_bytes=$(wc -c < "$MEMORY_PATH" 2>/dev/null | tr -d ' ' || echo 0)
  if [ "$mem_bytes" -gt 30000 ]; then
    mem_kb=$(( mem_bytes / 1024 ))
    memory_block=$(cat <<MEMORY_EOF

## ⚠️ MEMORY.md 비대화 감지

- 현재 크기: ${mem_kb}KB (임계 30KB 초과) — harness 인덱스 로드 한도(~24KB) 넘으면 뒷부분 항목 truncate
- 권고: 항목당 \`[제목](파일) — 한 줄 hook\` 형태 유지 (상세는 topic .md 본문에). 한 줄 200자 이내
- 절차: 비대 줄은 hook 만 남기고 압축(정보는 topic 파일에 보존), stale/완료 entry 는 archive 포인터로 통합
MEMORY_EOF
)
  fi
fi

# 로스터 (skill 목록) 는 2026-09-09 제거 — 시스템 프롬프트의 skill description · CLAUDE.md §작업 워크플로 와
# 같은 정보였다 (PROMPT_AUDIT_2026-09 A1, 세션당 ~1k tok). 상시 컨텍스트가 계산하지 못하는 두 경고만 낸다.
cat <<EOF
<composition-session-warnings>
${drift_block}${memory_block}
</composition-session-warnings>
EOF

exit 0
