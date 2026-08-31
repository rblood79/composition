#!/usr/bin/env bash
# SessionStart hook — 세션 시작 시 composition 전용 agent/skill 로스터 및 권장 워크플로 주입
# Wave A* (metrics-based auto-progression):
#   - daily-stats-snapshot.sh (백그라운드, 기존)
#   - metrics-snapshot.sh (백그라운드, 신규) — ADR drift 누적 수집
#   - auto-progression-check.sh (foreground, 신규) — Wave 진입 조건 평가 출력
set -euo pipefail

# 일별 통계 스냅샷 (하루 1회만 기록, 백그라운드 실행으로 세션 시작 블로킹 없음)
if [ -x "$CLAUDE_PROJECT_DIR/.claude/hooks/daily-stats-snapshot.sh" ]; then
  "$CLAUDE_PROJECT_DIR/.claude/hooks/daily-stats-snapshot.sh" >/dev/null 2>&1 &
fi

# Wave A* metrics 수집 (백그라운드 — 새 ADR Implemented commit 분석 후 stats/adr-drift.jsonl 누적)
if [ -x "$CLAUDE_PROJECT_DIR/.claude/hooks/metrics-snapshot.sh" ]; then
  "$CLAUDE_PROJECT_DIR/.claude/hooks/metrics-snapshot.sh" >/dev/null 2>&1 &
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

# Wave A* auto-progression check (foreground — sample 충족 시 Wave B 진입 알림)
progression_block=""
if [ -x "$CLAUDE_PROJECT_DIR/.claude/hooks/auto-progression-check.sh" ]; then
  progression_block=$("$CLAUDE_PROJECT_DIR/.claude/hooks/auto-progression-check.sh" 2>/dev/null || true)
fi

# 로스터는 §핵심 Skills 하나만 게시한다 (agent-catalog-gate §7·§12 의 catalog 대조 표면 + 사용자 전용 표기).
# 프로세스 규율·agent 라우팅·slash 목록·hook 게이트는 CLAUDE.md 와 시스템 프롬프트의 skill/agent description 이 정본이라
# 여기 중복 게시하지 않는다 (2026-08-31 — 3중 중복 제거, 세션당 ~1k tok).
cat <<EOF
<composition-workflow-roster>
# composition 전용 워크플로 (자동 주입 — SessionStart)

## 핵심 Skills (표시 없으면 자연어 발동 + \`/\` 호출 모두 가능 — "사용자 전용" 은 \`/\` 직접 입력만, 모델 자동 호출 비활성)
- \`composition-patterns\` — 코드 규칙/패턴 (코드 작업 전 확인)
- \`cross-check\` — CSS↔Skia 렌더링 정합성 (렌더링 수정 후 필수)
- \`parallel-verify\` — 컴포넌트 패밀리 일괄 검증
- \`component-design\` — 새 컴포넌트 설계 (React Aria/Spectrum 참조)
- \`create-adr\` — 새 ADR 작성 — 사용자 전용 (\`/create-adr <제목>\` 직접 입력)
- \`review-adr\` — ADR 검증
- \`react-aria\` / \`react-spectrum\` — 공식 API 레퍼런스
- \`match-target\` — Vision-based visual tuning 루프 (참조 이미지 + budget) — 사용자 전용 (\`/match-target\` 직접 입력)
- \`execute-adr\` — ADR design breakdown 의 미반영 phase 자율 실행 (type-check + cross-check + main 직접 push) — 사용자 전용 (\`/execute-adr NNN\` 직접 입력)

${drift_block}${memory_block}${progression_block}
</composition-workflow-roster>
EOF

exit 0
