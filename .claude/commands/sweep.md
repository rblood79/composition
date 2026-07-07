---
description: 패밀리 단위 일괄 검증 — parallel-verify skill로 spec/factory/renderer/CSS 정합성 동시 확인 + JSON audit report 누적
argument-hint: [패밀리명 또는 글롭]
---

"$ARGUMENTS" 범위에 대해 패밀리 단위 병렬 검증을 수행한다.

절차:

1. `parallel-verify` skill 호출 — 서브에이전트가 컴포넌트별로 spec/factory/CSS renderer/Skia renderer/editor 5개 레이어 동시 검증
2. 불일치 요약 테이블 생성
3. 동일 패턴 반복 시 codebase grep → 한 번에 수정 (배치 sweep)
4. 수정 후 `/cross-check` 샘플 재실행
5. **Audit report 영속화 (NEW)** — 검증 결과를 JSON 으로 누적:

```bash
# 디렉토리 보장
mkdir -p .claude/stats/audits

# 오늘 날짜 기준 파일명 (확장자는 .json 이나 내용은 JSONL append)
DATE=$(date +%Y-%m-%d)
REPORT_FILE=".claude/stats/audits/sweep-${DATE}.json"

# JSON 구조 (한 줄 entry append, JSONL 형식):
# {
#   "timestamp": "ISO8601",
#   "scope": "$ARGUMENTS",
#   "components": ["Button", "Checkbox", ...],
#   "issues": [
#     { "component": "...", "layer": "spec|factory|css|skia|editor",
#       "severity": "CRITICAL|HIGH|MEDIUM|LOW",
#       "summary": "...", "fixed": true|false }
#   ],
#   "elapsed_ms": 1234
# }
```

각 sweep 실행 후 위 구조로 한 줄 JSON 을 `sweep-${DATE}.json` 에 append.

- **목적**: drift trend 추적 — 같은 컴포넌트 / 레이어에 반복적으로 issue 발견되면 근본 ADR 작성 시점 판단
- **활용 예**: `jq -s 'group_by(.scope) | map({scope: .[0].scope, count: length})' .claude/stats/audits/sweep-*.json` 으로 패밀리별 drift 빈도
- **PR 자동 생성 금지** — `.claude/rules/git-workflow.md` 절대 정책 준수. report 만 누적, fix 는 동일 세션 또는 사용자 승인 후 main 직접 push

**금지 패턴**:

- ❌ JSON entry 에 unresolved CRITICAL 만 기록 — fixed 항목도 누적해야 trend 가치 (수정 추세 추적)
- ❌ stale `.spec-rebuild-pending` flag 보류 상태에서 sweep 진입 — Phase 0 dist 신선도 게이트 통과 필수 (cross-check skill §5.0 동일 기준)
