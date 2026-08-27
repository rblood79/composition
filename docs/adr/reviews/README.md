# ADR Review Logs — Layer 0 Observation Store

> This directory stores structured review results for ADRs in `docs/adr/`. Written by `review-adr` skill Phase 4.5 (Layer 0); consumed by future Layer 1 pattern-extraction agents.
>
> **Schema SSOT**: this file. Design rationale: [docs/reference/schemas/ADR_REVIEW_LAYER0.md](../../reference/schemas/ADR_REVIEW_LAYER0.md).
> **Writer**: `.claude/scripts/adr-review/writer.mjs` | **Validator**: `.claude/scripts/adr-review/validate.mjs`

## File Naming

- `NNN.md` — 3-digit zero-padded ADR number (e.g., `076.md`)
- `NNN.{timestamp}.md` — malformed-frontmatter recovery (preserved for manual repair)
- `README.md` — this file (schema SSOT, excluded from aggregation)

## Frontmatter Schema

```yaml
---
adr: 076 # (required) integer, ADR number
title: "ADR 제목" # (required) string
reviews: # (required) array, accumulates per round
  - round: 1 # (required) integer, auto-increment by writer
    ts: 2026-04-16T14:30:00Z # (required) ISO 8601 UTC
    reviewer: codex # (optional) claude|codex|human, default "claude"
    source: live # (optional) live|backfill-YYYY-MM-DD, default "live"
    issues: # (required) array, 0 allowed
      - id: c1 # (optional) round-local, severity prefix + index
        severity: CRITICAL # (required) CRITICAL|HIGH|MEDIUM|LOW
        category: generator-extension-gap # (required) from taxonomy
        summary: "..." # (required) 한 줄 요약
        evidence: "path/to/file.ts:L12" # (optional) grep-able code path
        root_cause: "..." # (optional) why
        outcome: fixed # (optional) fixed|deferred|rejected|pending, default "pending"
        addressed_in: "commit sha or ADR-NNN" # (optional) resolution reference
    hate: # (optional, 2026-08-28) review-adr Phase 3-H — root 1 + first nail
      assumption: "..." # load-bearing 가정
      root: "..." # 반론 1개
      axis: "..." # 공격 축
      first_nail: "..." # 가장 싼 반증 검사
      verdict: "G0 커버 | issue:m1"
    prism: # (optional) Phase 3-P — HIGH ≥1 또는 phase ≥3 인 ADR 만
      lenses:
        - { lens: "cost", verdict: "unclear", reason: "..." } # verdict: pass|fail|unclear
      convergence: "일치 | 다른 이유로 일치 | 불일치"
      question: "해결 질문 1 | 없음"
---
```

## Taxonomy (9 fixed)

| 키                            | 설명                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| `evidence-missing`            | 코드 경로/파일/함수 grep 근거 부재                              |
| `generator-extension-gap`     | Spec Generator 확장 미지원 → 수동 CSS debt                      |
| `migration-cost-unquantified` | BC 영향 범위/비율 미수식화                                      |
| `phase-split-late`            | HIGH 누적 후 Phase 분리 후행                                    |
| `ssot-violation`              | D1/D2/D3 경계 침범                                              |
| `alternative-strawman`        | 대안 기각 사유 부실, 이관 비용 없음                             |
| `risk-4axis-incomplete`       | 4축 평가 일부 축 누락/편중                                      |
| `adr-structure-violation`     | 스캐폴딩/Status 전이/README 동기화 위반                         |
| `other`                       | 상위 8개에 매칭 안 됨 — `Pending Categories` 섹션에서 주기 검토 |

**변경 정책**: taxonomy 변경은 design spec 수정 + 이 README 갱신 + `writer.mjs`/`validate.mjs` 동일 상수 수정 3곳 동시. 운영 중 신규 패턴은 `other` 로 저장하고 아래 섹션에 축적.

## Severity (4 levels)

- `CRITICAL` — blocking; ADR cannot proceed as written
- `HIGH` — significant risk requiring mitigation
- `MEDIUM` — should address before implementation
- `LOW` — nice-to-have, optional polish

## Outcome States

- `fixed` — resolved in code or ADR revision (`addressed_in` recommended)
- `deferred` — acknowledged, scheduled for future ADR
- `rejected` — reviewed and intentionally not addressed (rationale in body)
- `pending` — not yet addressed (default)

## Pending Categories

Issues saved with `category: other` + 원문 분류을 본문에 기록합니다. 동일 패턴 ≥3 건 축적되면 신규 카테고리 승인 요청.

| 원문 분류                          | 건수 | 출처                  | 설명                                                                            |
| ---------------------------------- | :--: | --------------------- | ------------------------------------------------------------------------------- |
| 계승 누락 (regression-inheritance) |  1   | 182 round 1           | 대체 대상 코드의 부수 가드(선행 ADR 산물)가 신규 경로 계승 목록에서 빠짐        |
| 미정의 토큰 (dead-declaration)     |  1   | 182 round 1           | 삭제/이관 대상 CSS 가 정의 0건 토큰 사용 — 복사 시 결함 이관                    |
| 설계 미명세 (undefined-branch)     |  1   | 182 round 1           | 참조 함수의 null/예외 반환 분기를 설계가 규정하지 않음                          |
| 게이트 조건 부족 / 실효성          |  2   | 182 round 1 · round 2 | Gate 통과 조건이 실패 모드를 덮지 못하거나, 지목한 테스트가 해당 회귀를 못 잡음 |

## Scripts

```bash
# Write a review (stdin JSON):
cat payload.json | node .claude/scripts/adr-review/writer.mjs

# Validate all reviews:
node .claude/scripts/adr-review/validate.mjs
```

## Related

- Design spec: [ADR_REVIEW_LAYER0.md](../../reference/schemas/ADR_REVIEW_LAYER0.md)
- Checklist seed: `.claude/rules/adr-writing.md` (§반복 패턴 선차단)
- Skill: `.claude/skills/review-adr/SKILL.md` (Phase 4.5)
