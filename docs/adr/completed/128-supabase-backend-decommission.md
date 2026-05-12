# ADR-128: Supabase backend decommission — auth-only 격하 + cloud data layer dead code 인정

## Status

Implemented — 2026-05-12

진행 로그:

- 2026-05-12 Proposed (codex review 0/0 — single-author 본문, 사용자 explicit base scope confirm)
- 2026-05-12 Phase 1 land (`704350cbb`) — builder canvas 영역 cloud 호출 제거 (옵션 A): marginCollapseAudit / dbPersistence / historyActions cloud 25+ 호출 / TableEditor / TableHeaderEditor / PropertiesPanel / useCollectionItemManager / ComponentFactory / TableComponents. type-error baseline 699→695 (-4)
- 2026-05-12 Phase 2 land (`a58ae1975`) — cloud adapter + projectSync/projectMerger 전수 제거 (단일 작업):
  - canonical mutation cloud boundary 해체 (canonicalMutations 의 createElement/updateElement/createMultipleElements Primary wrapper 3개 + elements.ts / useIframeMessenger.ts 의 element-level cloud persistence 호출 제거)
  - cloud-only file 삭제 11개: legacyElementsApiService / BaseApiService / ProjectsApiService / PagesApiService / DocumentsApiService / projectSync / projectMerger + 관련 boundary/sync test 4건
  - dashboard cloud UI 제거 (~470→~250 line) — cloud filter / Sync to cloud / Download from cloud / cloud project query / merge / cloud branch 전체 제거, IndexedDB-only dashboard 로 단순화
  - TokenService IndexedDB-native 통일 (Phase 3 narrow scope 의 design_tokens 흡수) — BaseApiService extends 해제, createToken/updateToken/deleteToken IndexedDB 전환
  - legacyElementSanitizer: SupabaseElement type + sanitizeElementForSupabase 함수 제거
  - usePageManager: ApiPage 를 file-local interface 로 inline / BuilderCore: Project type local 정의 / urlGenerator: Page → UrlPage 통일
  - type-error baseline 695→683 (-12, -16 cumulative)
- 2026-05-12 Phase 3 결정 lock-in — `exportLegacyDocument()` + `legacyToCanonical()` file export/import 시나리오 유지 (JSON 파일 IndexedDB round-trip 의도로 재정의), TokenService 는 Phase 2 commit 에서 IndexedDB-native 흡수 완결
- 2026-05-12 Phase 4 land — ADR-121~127 Status block 에 "Superseded in part by ADR-128" 1-line addendum 추가 (ADR-123 은 in full)
- 2026-05-12 Phase 5 baseline 측정 — type-error 683 / 번들 raw 5.4MB / gzipped 1.5MB 산출. Phase 0 절대 baseline 부재로 본 측정은 "ADR-128 land 후 reference baseline"
- 2026-05-12 Phase 6 final freeze — `.type-errors-baseline.txt` 683 freeze + Status Implemented 승격 + README + CHANGELOG

## Context

composition Builder 의 backend 의존성을 재평가한 결과, Supabase 사용이 **로그인 (auth) 만 실효 사용 중** 이고 cloud data layer (`elements` / `pages` / `projects` table query) 는 모두 **dead code** 임이 확인됐다. 본 ADR 은 이 상태를 공식 정책화하고 누적 dead code 를 단계적으로 제거한다.

**Evidence (2026-05-12 grep)**:

- `supabase.auth.*` 호출: 4 (signIn, signUp, getSession ×2) — 로그인 영역
- `supabase.from(...)` 호출: 9 — `elements` / `pages` / `projects` table query (production hot path 포함: `historyActions.ts` 3, `TableEditor` 2, `legacyElementsApiService.ts` 2, `PagesApiService.ts` 1, `marginCollapseAudit.ts` 1)
- 사용자 명시 (2026-05-12): "현재 로그인 후 모두 IndexedDB 에서 구현 중. 그 외에는 Supabase 로그인 기능 외에는 제거해도 된다"

**baseline drift evidence**:

`apps/builder/.type-errors-baseline.txt` 의 699 type 에러 중 G1 (snake_case `order_num` / `layout_id` / `slot_name` 227건) 의 상당 부분이 cloud row schema 호환 보존 코드에서 유래 — `ADR-128` 가 cloud premise 를 해체하면 G1 의 dead 기인 부분이 함께 제거 가능.

**SSOT 체인 연계**: 본 ADR 은 [`ssot-hierarchy.md`](../../.claude/rules/ssot-hierarchy.md) 의 **D2 (Props/API) 외부 backend boundary** 영역. 3-domain 분할 중 D1 / D3 와 무관. ADR-116 (canonical-only runtime, internal data shape) 와 **직교** — internal canonical schema 결정과 external backend dependency 결정은 독립.

**Baseline framing reverse (CRITICAL)**:

ADR-121~127 의 본문이 명시한 "cloud transport boundary 유지" 명분 (예: ADR-122 `exportLegacyDocument()` 는 cloud/export/import/temporary compatibility boundary 에서만, ADR-123 cloud documents row schema 단일화, ADR-126 boundary 18 file 유지) 은 **cloud 사용을 가정한 premise 기반**이었다. 본 사실 (cloud 사용 zero) 확정 후 그 premise 가 stale 이며, 본 ADR 이 ADR-121~127 의 cloud-only boundary 부분을 **part-supersede** 한다 (internal canonical 정리 부분은 그대로 유지).

**Hard Constraints**:

1. Supabase auth 기능 (signIn, signUp, getSession, signOut, token refresh) 정상 동작 유지 — 로그인 시나리오 회귀 금지
2. 기존 user IndexedDB 데이터의 호환 유지 — schema 마이그레이션 필요 시 본 ADR phase 안 명시
3. baseline 699 의 cloud-dead 기인 부분 자동 감소 측정 가능 — Phase 5 검증 입력

**Soft Constraints**:

- ADR-121~127 본문 Status 전면 변경 회피 — part-supersede 만으로 충분 (Status 7건 일괄 변경은 history 끊김 + 본 ADR scope 초과)
- 사용자 dev 환경 / production 환경 차이 없음 가정 (사용자 명시 — 단일 환경)
- legacyExtensionRoundtrip.test 같은 cloud-format roundtrip 검증 test 의 의도 재정의 vs 제거 결정은 Phase 3 narrow framing

## Alternatives Considered

### 대안 A: Status quo + 명시 미적용

- 설명: 코드 변경 없이 cloud 호출 9 위치를 boundary quarantine 명분으로 보존. ADR-121~127 의 premise stale 을 비공식 인지만 함
- 근거: legacy 호환 보존 패턴은 일부 보일러플레이트 industry 에서 사용 (예: feature flag off 로 dead 보존). 변경 비용 zero
- 위험:
  - 기술: **H** — dead code 누적, 새 개발자 인지 부하 + cloud 시나리오 false-positive 분석 시간 낭비
  - 성능: L — runtime 영향 없음 (호출되지 않으므로)
  - 유지보수: **H** — debt 영구화, baseline 699 의 cloud-dead 기인 부분 정리 불가
  - 마이그레이션: L — 변경 없음

### 대안 B: Auth-only 격하 + 단계적 dead code 제거 (권장)

- 설명: Supabase 사용을 auth (signIn / signUp / getSession / signOut / token refresh) 전용으로 격하 결정 선언. 9 호출 위치 + cloud-only adapter / boundary file 의 dead 인정. design breakdown phase (Phase 1~6) 로 단계적 제거 + 회귀 검증
- 근거: TypeScript / industry 표준 dead code elimination 패턴 (예: webpack tree-shaking, ts-unused-exports). 점진 제거 + 각 단계 회귀 검증으로 위험 분산. legacy quarantine 패턴이 **future scenario 보존** 명분이 stale 일 때 표준 해체 절차
- 위험:
  - 기술: M — dead 검증 필요 (false positive — dev tooling / benchmark / one-time migration script 의존성 사전 grep 필수)
  - 성능: L — runtime 영향 없음, 번들 사이즈 감소
  - 유지보수: L↓ — debt 해소, baseline 정리 입력 자료 생성
  - 마이그레이션: M — cloud 복원 시나리오 영구 차단 (사용자 명시 정합)

### 대안 C: 즉시 일괄 제거

- 설명: 9 호출 위치 + 5 legacy file + cloud-only boundary code 를 한 commit 에 일괄 제거
- 근거: 단일 atomic 변경 시 review / rollback 단순. 메모리 `feedback-execute-adr-surface-minimization` 의 "옵션 1 즉시 진행" 정합 일부
- 위험:
  - 기술: **H** — 검증 부족 시 회귀 (예: history undo/redo 가 cloud 의존 가정한 일부 edge case)
  - 성능: L
  - 유지보수: L — 변경 후 정리됨
  - 마이그레이션: **H** — cloud 복원 시나리오 영구 차단 + rollback 시 7 ADR 영역 영향

### 대안 D: Supabase 완전 decommission (auth 도 별 backend 로 이전)

- 설명: Supabase 완전 제거. auth 를 Clerk / Auth0 / IndexedDB-only auth 등으로 이전
- 근거: 단일 backend dependency 의 완전 zero 화. 라이센스 / 비용 / 외부 의존 최소화 motivation
- 위험:
  - 기술: **H** — auth 이전은 다른 backend 도입 = 새 의존성 학습
  - 성능: L
  - 유지보수: L↓ — Supabase 의존 zero
  - 마이그레이션: **C** — 기존 사용자 auth credential 마이그레이션 + auth 흐름 광범위 변경

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  H   |  L   |    H     |      L       |     2      |
| B    |  M   |  L   |    L     |      M       |   **0**    |
| C    |  H   |  L   |    L     |      H       |     2      |
| D    |  H   |  L   |    L     |      C       |   1 (C)    |

**판정**: 대안 B 만 HIGH+ 0. 대안 A 는 debt 영구화로 HIGH 2, C 는 일괄 제거 위험으로 HIGH 2, D 는 scope 초과로 CRITICAL 1. 추가 대안 루프 불필요 — B 직접 채택.

## Decision

**대안 B (Auth-only 격하 + 단계적 dead code 제거)** 를 선택한다.

**위험 수용 근거**:

1. 기술 위험 MED (dead 검증 필요) — design breakdown Phase 1 의 sub-phase 별 회귀 검증 (targeted vitest + 사용자 환경 smoke) 으로 false positive 완화
2. 마이그레이션 위험 MED (cloud 복원 시나리오 영구 차단) — 사용자 명시 정합 ("Supabase 로그인 기능 외에는 제거해도 된다"), 미래 cloud 복원 시 본 ADR Superseded by 신규 ADR 으로 reverse 가능
3. baseline 699 의 cloud-dead 기인 부분 자동 감소 측정 가능 — Phase 5 의 evidence layer 가 ADR-116 후속 phase 의 정확한 scope 결정 입력

**기각 사유**:

- **대안 A 기각**: dead code 영구화는 신규 개발자 인지 부하 + baseline 정리 불가 + 메모리 `feedback-no-eslint-disable` 의 "근본 회피 패턴" 위반
- **대안 C 기각**: 일괄 제거는 sub-phase 별 회귀 검증 불가 + 메모리 `feedback-agent-completion-failure-pattern` 의 "마감 단계 누락" 위험 동일 (단일 atomic 변경이 검증 단계 압축)
- **대안 D 기각**: 사용자 명시 ("로그인 기능 외에는 제거") 는 auth 유지를 전제. auth 이전은 본 ADR scope 초과 — 미래 별 ADR 검토 영역

> 구현 상세: [128-supabase-backend-decommission-breakdown.md](design/128-supabase-backend-decommission-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                | 심각도 | 대응                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | cloud 복원 시나리오 영구 차단 — 사용자 명시 정합하나 미래 결정 자유도 감소                                                          |  LOW   | 미래 cloud 도입 결정 시 본 ADR Superseded by 신규 ADR 으로 reverse, design breakdown 의 grep evidence 활용 가능                                                                               |
| R2  | Phase 1 dead code 식별 false positive — 실제 dev tooling / benchmark / one-time migration script 의존 가능성                        |  MED   | sub-phase 별 grep import + targeted vitest + 사용자 환경 smoke 의 3-layer 검증. 의존 발견 시 해당 sub-phase 분리 (예: `marginCollapseAudit.ts` 는 dev only 로 격리)                           |
| R3  | Supabase auth token refresh / session 재발급 의존성 — auth 영역 변경 시 회귀 가능                                                   |  LOW   | 본 ADR scope 는 auth 변경 zero, refresh / session 흐름 그대로 유지. Phase 1~6 전체에서 `supabase.auth.*` 호출 grep 변경 0 검증                                                                |
| R4  | ADR-121~127 part-supersede addendum 처리 후 history 추적 시 본문 Status 와 README entry 정합 일부 어긋남                            |  LOW   | Phase 4 의 addendum 형식 표준화 (각 ADR 본문 상단에 "Superseded in part by ADR-128 (cloud transport boundary 명분)" 1줄 + README 비고에 동일 1줄 추가) — 본문 Status 전면 변경 없이 정합 유지 |
| R5  | legacyExtensionRoundtrip.test (17 baseline 위반) 같은 cloud-format roundtrip 검증 test 의 의도가 stale — fix 시 검증 의도 손상 위험 |  MED   | Phase 3 narrow framing 에서 사용자 confirm — 본 test 의도 재정의 (IndexedDB persistence 검증 으로 재해석) vs 제거 결정. 별 phase scope                                                        |

## Gates

| Gate          | 시점                                        | 통과 조건                                                                                                                                                                                                                                                        | 실패 시 대안                                                                   |
| ------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| G-Phase-1     | sub-phase 1-α~1-ε 진행 직전                 | (a) grep import 으로 cloud 의존 외부 호출자 0건 (b) targeted vitest baseline PASS                                                                                                                                                                                | 외부 호출자 발견 시 해당 sub-phase 분리 + 호출자 우선 정리                     |
| G-Phase-2     | adapter file 제거 직전                      | (a) `legacyElementsApiService` / `PagesApiService` cloud part import grep 0건 (b) `apps/builder/src/services/api/` 영역 의존 분석 완료                                                                                                                           | 잔존 호출자 발견 시 file scope 재정의 (IndexedDB-only adapter 로 rename)       |
| G-Phase-3     | export/import scope 결정 직전               | 사용자 explicit confirm — file export / import 시나리오 유지 vs 제거                                                                                                                                                                                             | confirm 미완료 시 Phase 3 진입 차단, Phase 1~2 만 land 후 ADR Implemented 보류 |
| G-Phase-4     | ADR-121~127 addendum 작성 직전              | 본 ADR 본문 §Risks R4 의 addendum 형식 표준화 사용                                                                                                                                                                                                               | 형식 미정합 시 R4 대응 절차 적용                                               |
| G-Phase-5     | baseline refresh (type-error + 번들 사이즈) | (a) Phase 1~4 commit 후 `pnpm type-check` PASS + type-error baseline 자동 감소량 측정 결과 메모리 `project-type-baseline-categories` 에 반영 (b) `pnpm build` 후 번들 사이즈 감소량 측정 + design breakdown §7 §5-B 에 수치 기록 (목표 추정 -15~-40KB 정합 확인) | 자동 감소 0 시 dead 기인 가정 재검토 + ADR scope 축소                          |
| G-Implemented | ADR Status 승격                             | (a) Phase 1~4 all PASS (b) Phase 5 baseline 측정 완료 (c) 사용자 환경 smoke (create/edit/delete/undo/redo 시나리오) PASS                                                                                                                                         | 미통과 항목 잔존 시 Implemented 보류, Accepted 단계 유지                       |

## Consequences

### Positive

- **legacy adapter / boundary file 대거 dead 인정**: `legacyElementsApiService.ts`, `PagesApiService.ts` cloud 부분, `historyActions.ts` cloud delete 3 호출, `TableEditor` / `TableHeaderEditor` cloud write, `marginCollapseAudit.ts` benchmark 가 명시적 dead. design breakdown Phase 1~2 로 단계적 제거 가능
- **ADR-121~127 의 boundary quarantine 명분 stale 공식 해체**: 7 ADR 의 cloud-only boundary 부분이 part-superseded. 후속 cleanup 작업의 framing 단순화
- **baseline 699 의 G1 (snake_case 227) 의 cloud-dead 기인 부분 자동 감소**: Phase 5 의 측정 결과가 ADR-116 후속 phase 의 정확한 scope 결정 입력 자료
- **신규 개발자 인지 부하 감소**: cloud 시나리오 검토 불필요 명시. `supabase.from(...)` 호출 발견 시 즉시 dead 판정 가능
- **번들 사이즈 감소**: cloud adapter / legacy adapter 제거 분만큼 production 번들 감소. 측정 baseline + 목표 수치 + 검증 절차는 design breakdown §7 Phase 5 에서 type-error baseline 측정과 동시 수행 (R6 반영)

### Negative

- **cloud 복원 시나리오 영구 차단**: 미래 cloud sync 도입 시 본 ADR Superseded by 신규 ADR 필요. design breakdown 의 grep evidence 가 reverse 자료로 활용 가능하나 새 ADR 설계 비용
- **legacyExtensionRoundtrip.test 같은 cloud-format roundtrip test 의도 재정의 필요**: Phase 3 narrow framing 단계에서 사용자 confirm + 결정. test 의도 손상 위험 존재
- **5 legacy file 의 scope 재정의 작업**: 단순 제거 아닌 IndexedDB-only / file export 등 scope 정의 결정 필요 — Phase 3 의 결정 비용
- **ADR-121~127 의 part-supersede addendum 작성**: 7 ADR 본문 + README entry 동시 갱신 (Phase 4)
