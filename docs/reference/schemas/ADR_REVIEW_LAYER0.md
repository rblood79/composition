# ADR Review Layer 0 Schema — Design Spec

- **Date**: 2026-04-20
- **Status**: Draft — approved via brainstorming session
- **Scope**: Layer 0 only (Observation, 무비용 관찰 계층)
- **Related**: `.claude/rules/adr-writing.md` (2026-04-20 체크리스트 seed), `.claude/skills/review-adr/SKILL.md`

## 1. Context & Motivation

### 1.1 문제

`review-adr` skill은 Phase 1~4 결과를 마크다운 테이블로 사용자에게 출력한다. 그러나 결과를 **파일로 영속화하지 않는다**. 따라서:

- 과거 리뷰 결과는 대화 context / auto-memory / git commit message 에 흩어진다
- 반복 패턴(예: 최근 10-ADR 메타 분석에서 확증된 Top 1 "코드 경로 확증 부재" 5/10) 추출은 **매번 ad-hoc Explore agent** 가 수행해야 한다
- 통계적 유의성 검증이 불가능 — "정말 반복되는가? 우연인가?" 를 데이터로 답할 수 없다

### 1.2 상위 목표 (4-Layer Promotion Pipeline)

ADR 설계 품질을 **데이터 기반 self-improvement 루프**로 개선한다. 전체 파이프라인은 4 계층:

```
Layer 0: Observation    → 모든 리뷰 결과 구조화 저장 (무비용, 비파괴)
Layer 1: Hypothesis     → 패턴 후보 자동 추출 (candidate rule, 적용 X)
Layer 2: Shadow         → advisory-only 체크 (FP rate 측정)
Layer 3: Enforced       → 정식 rule (budget 10 상한, swap 메커니즘)
Archive: Pruned         → 미사용/FP 증가 시 자동 강등
```

각 Layer 전이는 promotion gate 로 차단 (최소 빈도, FP rate 등). 자세한 설계 근거는 `.claude/rules/adr-writing.md` 의 "반복 패턴 선차단 (experimental seed)" 서브섹션에 요약.

### 1.3 본 ADR 범위

**In-scope**: Layer 0 (Observation) 인프라 — review-adr 결과를 파일로 영속화.
**Out-of-scope**: Layer 1 (패턴 추출), Layer 2 (Shadow), Layer 3 (Enforcement), Pipeline-level sunset counterfactual. 각각 별도 ADR 로 후속.

## 2. Design Decisions (Q1~Q6)

brainstorming 세션에서 6개 핵심 결정을 각각 3-option trade-off 비교로 확정:

| #   | 결정 사항                  | 선택                                                         | 기각된 대안                                                 |
| --- | -------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Q1  | 여러 라운드 리뷰 저장 방식 | **타임라인 누적** (파일 1개에 reviews 배열)                  | 파일 분리(B, aggregation join 부담), 덮어쓰기(C, 이력 손실) |
| Q2  | 저장 trigger               | **자동** (review-adr skill Phase 4 내장)                     | 반자동(B, 커버리지 부족), 수동(C, 현재 상태)                |
| Q3  | 파일 포맷                  | **Markdown + frontmatter** (`NNN.md`)                        | YAML(B, 원본 마크다운 손실), JSON(C, 주석 불가)             |
| Q4  | 백필 정책                  | **최근 10개 백필** (054/056/063/075/076/078/079/100/102 + 1) | 백필 없음(A, Layer 1 지연), 완전 백필(C, 비용 과다)         |
| Q5  | Severity granularity       | **4단계** (CRITICAL/HIGH/MEDIUM/LOW)                         | 3단계(B, CRITICAL 정보 손실), 2단계(C, 과단순화)            |
| Q6  | 카테고리 taxonomy          | **빈도 기반 Top 8 + `other`**                                | 도메인 기반(B, 실데이터 불일치), 2차원(C, 과복잡)           |

## 3. Architecture

```
[review-adr skill]
    └─ Phase 1~4 (기존 유지)
        └─ Phase 4 마크다운 사용자 출력 (기존 유지)
            └─ ★ 신규: writer 호출 (fail-soft)
                └─ docs/adr/reviews/NNN.md append-or-create
                    └─ (미래) Layer 1 consumer: Glob + frontmatter parse
```

**책임 분할**:

- **review-adr skill**: Phase 4 완료 후 writer 호출. writer 실패해도 사용자 리뷰 출력은 정상.
- **writer**: pure I/O + frontmatter 병합. 비즈니스 로직 없음.
- **Layer 1 consumer** (미래): Glob → Read frontmatter only → 집계. 본 ADR 에서는 interface 명세만.

## 4. Data Model

### 4.1 Frontmatter 스키마

```yaml
---
adr: 076 # 대상 ADR 번호 (필수)
title: "ListBox items SSOT + Hybrid 해체" # 검색 편의 (필수)
reviews: # 라운드별 누적 배열 (필수)
  - round: 1 # 라운드 번호 (필수, auto-increment by writer)
    ts: 2026-04-16T14:30:00Z # ISO 8601 UTC (필수)
    reviewer: codex # claude | codex | human (선택, 기본 claude)
    source: live # live | backfill-YYYY-MM-DD (선택, 기본 live)
    issues: # 이슈 리스트 (필수, 0개 가능)
      - id: c1 # round-local id (c/h/m/l + index) (선택)
        severity: CRITICAL # CRITICAL | HIGH | MEDIUM | LOW (필수)
        category: generator-extension-gap # taxonomy 9개 중 1개 (필수)
        summary: "ListBoxItem.spec 부재로 자식 selector emit 불가" # 한 줄 요약 (필수)
        evidence: "packages/specs/src/generator/CSSGenerator.ts:L213" # 코드 경로 (선택)
        root_cause: "Generator가 nested spec 의 자식 selector emit 미지원" # (선택)
        outcome: fixed # fixed | deferred | rejected | pending (선택, 기본 pending)
        addressed_in: "commit 2fdc2205" # 해결 증거 (선택, outcome=fixed 일 때 권장)
---
```

### 4.2 Taxonomy (카테고리 9개 고정)

| 키                            | 설명                                                        | 오늘 백필 빈도 |
| ----------------------------- | ----------------------------------------------------------- | :------------: |
| `evidence-missing`            | 코드 경로/파일/함수 grep 근거 부재                          |  5/10 (Top 1)  |
| `generator-extension-gap`     | Spec Generator 확장 미지원 → 수동 CSS debt                  |  3/10 (Top 2)  |
| `migration-cost-unquantified` | BC 영향 범위/비율 미수식화                                  |  3/10 (Top 3)  |
| `phase-split-late`            | HIGH 누적 후 Phase 분리 후행                                |  3/10 (부차)   |
| `ssot-violation`              | D1/D2/D3 경계 침범                                          |      4/10      |
| `alternative-strawman`        | 대안 기각 사유 부실, 이관 비용 없음                         |      2/10      |
| `risk-4axis-incomplete`       | 4축 평가 일부 축 누락/편중                                  |     미집계     |
| `adr-structure-violation`     | 스캐폴딩/Status 전이/README 동기화 위반                     |     미집계     |
| `other`                       | 상위 8개에 매칭 안 됨 — N≥3 축적 시 신규 카테고리 승인 요청 |       —        |

Taxonomy 변경은 본 ADR 의 수정으로만 가능. 운영 중 신규 카테고리 후보는 `other` 로 저장 + 본문에 원문 기록 → `reviews/README.md` 의 "Pending Categories" 섹션에서 주기 검토.

### 4.3 본문 구조

frontmatter 뒤에 `review-adr` Phase 4 **원본 마크다운 그대로** append. 라운드별 헤더로 구분:

```markdown
# ADR-076 Review Log

## Round 1 — 2026-04-16 (reviewer: codex)

### [CRITICAL] ListBoxItem.spec 부재로 자식 selector emit 불가

- **Category**: generator-extension-gap
- **Evidence**: `packages/specs/src/generator/CSSGenerator.ts:L213`
- **Root cause**: Generator가 nested spec 의 자식 selector emit 미지원
- **Outcome**: fixed — commit `2fdc2205`

### [HIGH] ...

## Round 2 — 2026-04-17 (reviewer: codex)

...
```

이로써 구조화 데이터(frontmatter) + 원본 서술(본문) 이 한 파일에 공존. aggregation query 는 frontmatter 만 파싱 (gray-matter 등), 본문은 사람 검토 시에만 읽음.

## 5. File Layout

```
docs/adr/reviews/
├── README.md                   # 스키마 명세 + taxonomy 정의 + 신규 카테고리 승인 프로세스 + Pending Categories
├── 054.md                      # backfill
├── 056.md                      # backfill
├── 063.md                      # backfill
├── 075.md                      # backfill
├── 076.md                      # backfill (codex 1~6차 라운드 포함)
├── 078.md                      # backfill
├── 079.md                      # backfill
├── 100.md                      # backfill
├── 102.md                      # backfill
└── 080.md ...                  # 이후 live (ADR-080 부터 자동 저장)
```

**Naming rule**: `NNN.md` (3자리 zero-pad ADR 번호). 라운드 번호는 파일 내부 frontmatter.
**README.md**: 스키마/taxonomy SSOT. 본 design doc 과 중복 내용은 README.md 가 정본 (운영용 짧은 버전).

## 6. Flow: Review → Save

```
1. 사용자: "ADR-080 리뷰해줘"
2. review-adr skill Phase 1~4 실행 (기존 로직, 변경 없음)
3. Phase 4 마크다운 결과 사용자에게 출력 (기존 로직, 변경 없음)
4. ★ 신규: Phase 4 종료 직후 writer 호출
   4a. docs/adr/reviews/080.md 존재 여부 확인
       - 존재: 기존 frontmatter 파싱 → reviews 배열 길이 N → round = N+1 append,
               본문 하단에 "## Round N+1 — YYYY-MM-DD (reviewer: X)" 섹션 append
       - 부재: 신규 파일 생성 (frontmatter + 본문 round 1 섹션)
   4b. 실패 시: console.warn("writer failed: <reason>") + 사용자 리뷰 출력은 영향 없음 (fail-soft)
5. writer 성공 시 skill 결과 끝에 "→ saved to docs/adr/reviews/080.md (round N+1)" 한 줄 추가
```

**Round auto-increment**: writer 가 기존 `frontmatter.reviews` 배열 길이 + 1 로 결정. 사용자 수동 지정 불필요.

**Reviewer 감지**: 기본 `claude`. 사용자가 Codex/외부 리뷰 결과를 붙여넣는 경우 skill 에 수동 힌트(예: `reviewer: codex`) 전달 → writer 가 해당 값 사용. 감지 로직 복잡화 금지.

## 7. Aggregation Interface (명세만, 구현은 Layer 1)

```
Layer 1 consumer 가 수행할 pseudo-code:

files = Glob("docs/adr/reviews/*.md") excluding "README.md"
records = []
for each file:
    frontmatter = parseFrontmatter(file)  # gray-matter or similar
    for review in frontmatter.reviews:
        for issue in review.issues:
            records.push({
                adr: frontmatter.adr,
                round: review.round,
                ts: review.ts,
                severity: issue.severity,
                category: issue.category,
                outcome: issue.outcome or "pending",
            })
aggregate:
    - category 별 빈도 (dict)
    - severity 분포 (dict)
    - outcome 비율 (fixed / deferred / rejected / pending)
    - 시계열 추이 (월별 category 빈도 변화)
```

본 ADR 에서는 interface 명세만. 실구현은 Layer 1 별도 ADR 에서.

## 8. Error Handling

| 상황                                            | 처리                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Race condition** (동시 2 리뷰)                | 파일 lock 없음. 현실에서 드물고 충돌 시 append 순서 교란만 가능. 수용.                                                                      |
| **ADR 번호 미지정**                             | writer 는 `adr: NNN` 필수. 누락 시 `unknown-{timestamp}.md` 에 저장 + warning 로그                                                          |
| **Taxonomy 미매칭**                             | `category: other` + 본문에 원문 분류 기록. README.md 의 "Pending Categories" 섹션에 자동 append (N≥3 시 사용자에게 신규 카테고리 승인 요청) |
| **Malformed frontmatter** (기존 파일 파싱 실패) | 새 파일 `NNN.{timestamp}.md` 로 분리 저장 (데이터 보존 우선, 복구는 사용자)                                                                 |
| **Writer IO 실패**                              | console.warn + 리뷰 출력은 정상 (fail-soft)                                                                                                 |

**원칙**: 데이터 손실 > 일관성 위반. 파싱/IO 실패 시 옆으로 분리 저장, 사용자가 복구.

## 9. Testing

- **Writer unit tests** (3 케이스):
  - 신규 파일 생성 (frontmatter + 본문)
  - 기존 파일 append (round = 기존 길이 + 1)
  - Malformed frontmatter 복구 (분리 저장)
- **Integration test**:
  - 가상 ADR 리뷰 2라운드 → frontmatter.reviews 길이 = 2, 본문에 Round 1/2 섹션 존재 (snapshot)
- **Backfill validation**:
  - 9개 파일 생성 후 schema validation script (필수 필드 존재 확인, severity/category enum 확인)

## 10. Backfill 절차

| 단계 | 작업                                                                                              | 비고                                      |
| ---- | ------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| B1   | `docs/adr/reviews/README.md` 작성 (스키마/taxonomy 정본)                                          | 9개 파일 작성 전 선행 필수                |
| B2   | 오늘 Explore agent 분석 결과(054/056/063/075/076/078/079/100/102) 를 9개 `NNN.md` 파일로 encoding | `source: backfill-2026-04-20` 메타 필수   |
| B3   | 10번째 파일 결정 (Explore agent 미집계 중 최근 ADR 1개 추가 분석)                                 | 옵션 — 현재 9개만으로도 Layer 1 가동 충분 |
| B4   | Schema validation script 실행 → 9개 모두 PASS 확인                                                |                                           |
| B5   | Writer 실구현 + integration test                                                                  |                                           |
| B6   | `review-adr` skill 에 writer 호출 추가 + fail-soft 확인                                           |                                           |
| B7   | ADR-080 첫 live 리뷰로 end-to-end 검증                                                            | 다음 ADR 작성 시 자연스러운 테스트        |

## 11. 성공 지표 (2026-10-20 재평가)

**Quantitative**:

- 백필 9 + live ADR-080~085 5건 = **총 14+ 리뷰 파일**이 `docs/adr/reviews/` 에 무손실 저장
- Schema validation script 실행 시 **0 failures**
- Layer 1 agent 가 실행 가능한 상태 (frontmatter 파싱 → 카테고리 빈도 집계 가능)

**Qualitative**:

- 현재 체크리스트 4줄의 effectiveness 검증 가능해야 함
  - Top 1 (`evidence-missing`) 빈도가 5/10 → 기대치 2/10 이하로 감소했는가?
  - Top 2/3/부차 각각 재평가
- **Pipeline-level counterfactual**: 이 시스템(Layer 0) 이 없었다면 리뷰 품질이 어땠을까? 효용 불명확 시 Layer 0 단독 유지(Layer 1 진입 보류) 또는 해체 검토

## 12. 리스크

| 리스크                                                 |  수준  | 완화                                                                            |
| ------------------------------------------------------ | :----: | ------------------------------------------------------------------------------- |
| 리뷰 결과 파싱/저장 실패로 데이터 유실                 |  LOW   | Fail-soft + malformed 분리 저장 (§8)                                            |
| Taxonomy drift (동일 이슈를 매번 다른 카테고리로 분류) | MEDIUM | 9개 고정 taxonomy + `other` 버퍼 + 신규 승인 프로세스                           |
| 백필 정확도 (대화/메모리 기반 역산)                    | MEDIUM | `source: backfill-2026-04-20` 메타로 live 와 구분, 6개월 후 재평가 시 비중 조정 |
| review-adr skill 수정이 기존 Phase 1~4 동작 영향       |  LOW   | Phase 4 후 호출(fail-soft)만 추가, 기존 로직 변경 0                             |
| Layer 1 agent 미구현으로 데이터 가치 불명확            | MEDIUM | 6개월 후 재평가 시점에 Layer 1 ADR 발의 시점 결정                               |

## 13. Out of Scope (후속 ADR 후보)

- Layer 1: Hypothesis 패턴 추출 Explore agent 자동화 — 3개월 후
- Layer 2: Shadow advisory checklist — 6개월 후
- Layer 3: Enforcement (L3 budget swap 메커니즘) — 1년 후
- Pipeline-level sunset counterfactual 방법론 — 6개월 후 재평가 시 정의
- `review-adr` skill 자체의 Phase 1~3 로직 개선 (ADR-067 류 성능 최적화 등) — 별도

## 14. 결정 이력 (brainstorming)

본 design doc 은 2026-04-20 brainstorming 세션에서 Q1~Q6 6회 trade-off 비교 후 전부 "옵션 A (권장안)" 확정으로 도출. 대화 기록은 session context 참조.

---

**Next step**: writing-plans skill 호출 → implementation plan 작성 (writer 구현, review-adr skill patch, 백필 9개, README.md, tests).
