# ADR-123: Cloud document-level row schema 단일화

## Status

Implemented — 2026-05-10

> **Superseded in full by [ADR-128](128-supabase-backend-decommission.md) (2026-05-12)** — cloud `documents` row schema 단일화 결정 자체가 cloud data layer dead 정책으로 무효화. canonical document persistence 는 IndexedDB `documents` table 단일 path 유지.

진행 로그:

- 2026-05-10 Proposed (codex review 9/9 closure 후 stakeholder review)
- 2026-05-10 Accepted (Decision/Gates/Risks lock-in)
- 2026-05-10 Phase 0-6 직렬 land — Phase 0 inventory / Phase 1 documents table + DocumentsApiService / Phase 2 cloud read path canonical primary / Phase 3 cloud write path + dashboard seed / Phase 4 boundary quarantine + grep gate / Phase 5-6 verification (preflight + browser load PASS)
- 2026-05-10 Implemented (cloud row schema canonical-primary 전환 완료, Supabase migration 002 deployment 환경별 별도 적용)

> Supabase migration 002 의 실제 DB 적용은 deployment 환경별 별도 단계 (`docs/migrations/002_create_documents_table.sql` 수동 실행). 코드 layer 의 canonical-primary 전환은 완료 — `documentsApi` 가 미적용 환경에서도 graceful degradation (try/catch 후 legacy fallback) 보장.

## Context

### 배경 — ADR-122 closure note 후속

ADR-116은 `CompositionDocument`를 저장/편집/render의 primary SSOT로 승격했다.
ADR-118/119는 structural order를 `children[]` source order로 수렴시켰고,
ADR-120/121은 local IndexedDB의 `pages`/`elements`/`layouts` mirror persistence를 제거했다.
ADR-122는 Builder runtime에서 mutable legacy mirror를 제거하고 canonical-only runtime을
달성했다.

ADR-122 §Context HC 7번은 이를 명시한다:

> "Supabase physical schema drop, public cloud row contract removal, external API
> migration은 별도 ADR 또는 explicit gate 없이는 수행하지 않는다."

ADR-122는 cloud/Supabase `pages`/`elements` row schema를 **boundary allowlist**로 분류해
격리했다. 이 ADR은 해당 boundary를 `documents` row 단일화로 정리하는 **1군 cleanup**이다.

### SSOT 체인 domain 분류

본 ADR은 **D2(Props/API) cloud transport boundary + D3(시각 스타일) 무관**한 영역이다.
cloud row schema는 시각 렌더링(D3)에 관여하지 않으며, React Aria 접근성(D1)과도 직교한다.
Builder runtime의 mutation/read pipeline이 canonical document를 primary로 소비하는 ADR-122
결정의 cloud transport side를 정합화한다.

### 현재 상태 — 6개 legacy surface

ADR-122 boundary allowlist로 격리된 cloud legacy surface는 다음 6개이다.

**Surface 1 — Supabase row schema**:
`apps/builder/src/types/integrations/supabase.types.ts:150-172`에 `pages` + `elements` row
schema가 존재한다. 정확히는 `pages.Row`에 `parent_id?` + `order_num?` 필드, `elements.Row`에
`page_id` + `parent_id?` 필드가 있다 (`order_num`은 `elements`에 없음). local IndexedDB에서
제거된 schema가 cloud에만 남아 있는 상태이다.

**Surface 2 — legacy element row API**:
`apps/builder/src/adapters/canonical/legacyElementsApiService.ts`의 `ElementsApiService`
전체 method surface — `createElement`/`updateElement`/`updateElementProps`/`createMultipleElements`/
`getElementsByPageId` (`fetchElements` alias 포함)/`deleteElement`/`deleteMultipleElements` 가
Supabase `elements` row에 직접 쓰고 읽는다. 현재 production caller는 일부 method (create/update/
createMultiple/getByPageId/deleteMultiple) 만 사용 중이며, 나머지 method도 row API surface
allowlist에 포함된다.

**Surface 3 — pages row API**:
`apps/builder/src/services/api/PagesApiService.ts`의 `PagesApiService` 전체 method surface —
`createPage`/`updatePage`/`getPagesByProjectId` (`fetchPages` alias 포함)/`deletePage` 가
Supabase `pages` row에 직접 쓰고 읽는다.

**Surface 4 — canonicalMutations thin wrapper**:
`apps/builder/src/adapters/canonical/canonicalMutations.ts:1699-1733`에
`createElementCanonicalPrimary`/`updateElementCanonicalPrimary`/`createMultipleElementsCanonicalPrimary`
3개의 thin pass-through wrapper가 존재한다. 이는 ADR-122 G5 second work에서 격리된
canonical-aware label을 달고 있지만 실질적으로 `elementsApi.createElement` 등을 그대로 위임한다.
cloud row API와 canonical mutation의 경계가 불분명한 상태이다.

**Surface 5 — dashboard project seed**:
`apps/builder/src/dashboard/index.tsx:302-320`의 cloud project 생성 경로에서
`pagesApi.createPage` + `elementsApi.createElement`를 직접 호출해 `pages`/`elements`
row를 시드한다. local project 생성 시에는 `db.documents.put`만 호출하여 cloud와 local의
seed 경로가 비대칭이다.

**Surface 6 — projectSync element-level upsert**:
`apps/builder/src/utils/projectSync.ts`의 `syncProjectToCloud`가 canonical document →
`deriveProjectRenderModelFromDocument` → page 단위 `elements` row delete+insert 순환으로
cloud에 쓴다. `downloadProjectFromCloud`는 반대 방향으로 `pages`/`elements` row를 읽어
`legacyToCanonical()`로 `CompositionDocument`를 재구성한다.

### Hard Constraints

1. cloud transport primary는 `documents` row 단일이어야 한다. Builder runtime이 cloud에서
   읽을 때 `CompositionDocument`를 직접 hydrate해야 하며, `pages`/`elements` row를
   `legacyToCanonical()`로 재조립하는 경로를 제거한다.
2. cloud write 시 `documents` row에 `CompositionDocument`를 직접 upsert한다. 기존
   element-level row insert/delete batch 패턴을 제거한다.
3. `documents` Supabase table이 존재하지 않으면 Phase 1에서 migration tooling을 통해 생성한다.
   기존 `pages`/`elements` row는 migration window 동안 read-only fallback으로만 허용한다.
4. Supabase RLS policy는 `documents` table에 `project_id` column 기반으로 적용해야 한다.
5. `documents` row의 `content` column은 `CompositionDocument` JSON payload를 저장한다.
   column size 제약(Supabase max JSON column size)을 측정해 Gate 조건으로 설정한다.
6. cloud download latency p95는 ADR-122 이전 baseline(element-level 호출 합산) 이하여야 한다.

### Soft Constraints

- `pages`/`elements` Supabase table은 migration window 동안 유지한다. 완전 drop은 Gate G5
  이후 별도 Supabase migration으로 진행한다.
- `legacyToCanonical()`과 `legacyElementsApiService.ts`는 migration fallback adapter로 유지하되
  Builder hot path에서 제거한다.
- dashboard project seed 경로의 cloud/local 비대칭을 해소한다.

## Alternatives Considered

### 대안 A: row-level legacy schema 유지 + canonical view layer만 추가

- **설명**: 현재 `pages`/`elements` row schema를 그대로 두고, cloud read 시 `legacyToCanonical()`
  변환을 유지한다. 대신 read/write 경로에 canonical view 추상화 레이어만 얇게 추가한다.
- **근거**: 변경량이 가장 작고 Supabase schema migration이 불필요하다.
- **위험**:
  - 기술: M — cloud transport가 계속 legacy row 기반이므로 ADR-122가 제거한 runtime mirror를
    cloud 경계에서 재현한다. `legacyToCanonical()` 경로가 cloud download마다 살아남는다.
  - 성능: M — element row 수에 비례하는 N+1 round-trip이 지속된다.
  - 유지보수: H — local persistence(IndexedDB)는 ADR-120/121로 documents 단일화가 완료됐으나,
    cloud만 row-level 구조를 유지하면 두 transport의 schema 불일치가 영구화된다.
  - 마이그레이션: L — 기존 cloud data와 schema를 건드리지 않으므로 data migration 비용 없다.

### 대안 B: documents row 단일화 + 모든 row-level API 즉시 제거

- **설명**: Supabase에 `documents` table을 생성하고 `pages`/`elements` row API를 즉시 제거한다.
  기존 cloud project 데이터는 bulk migration script로 일괄 변환한다.
- **근거**: 최종 상태에 가장 빠르게 도달하고 legacy 코드를 최소화한다.
- **위험**:
  - 기술: H — Supabase schema 변경, RLS 재설계, migration script 작성, 기존 프로젝트 bulk
    변환이 단일 phase에서 동시 진행된다. 롤백 윈도우가 없다.
  - 성능: M — document-level payload 집중으로 대형 프로젝트의 cloud diff/write 전략을
    재설계해야 한다. payload 크기 상한 확인 필요.
  - 유지보수: L — 완료 후 schema가 단순하지만, cutover 중 진단 surface가 부족하다.
  - 마이그레이션: H — 기존 cloud project 데이터 손실 위험. 외부 consumer(publish/export)가
    `pages`/`elements` row에 의존하면 즉시 파괴된다.

### 대안 C: documents row 단일화 + boundary adapter로 row-level legacy export 격리 (권장)

- **설명**: Supabase에 `documents` table을 생성하고, cloud read/write primary를 `documents` row로
  전환한다. `pages`/`elements` row는 migration window 동안 read-only fallback으로 유지하되,
  Builder cloud path에서는 `documents` row만 읽고 쓴다. 기존 `legacyElementsApiService.ts`와
  `PagesApiService.ts`는 boundary adapter로 격리하고 Builder hot path에서 제거한다.
- **근거**: ADR-122 boundary allowlist 격리 패턴(canonical-only runtime, legacy → boundary
  quarantine)을 cloud transport까지 연장한다. migration window 중 기존 cloud data는
  legacy row fallback으로 보호하면서 새 write는 documents row 전용으로 전환한다.
- **위험**:
  - 기술: M — Supabase `documents` table 생성, RLS policy, payload size 측정, `projectSync`
    재작성이 필요하다.
  - 성능: M — document-level single row upsert로 전환하면 element count와 무관한 O(1) round-trip이
    된다. 단, 대형 프로젝트에서 payload 크기 증가가 column size 제약을 초과할 경우 청크 전략 필요.
  - 유지보수: L — 완료 후 cloud/local 모두 `CompositionDocument` 단일 schema이므로 transport
    불일치 제거.
  - 마이그레이션: H — 기존 cloud `pages`/`elements` row를 `documents` row로 변환하는 migration
    window 관리 필요. 기존 프로젝트 데이터 보존이 필수이다.

### 대안 D: schema 그대로 + element-level upsert만 canonical document diff로 변경

- **설명**: `pages`/`elements` Supabase schema는 유지하되, `projectSync`의 element-level
  delete+insert batch를 canonical document diff(changed elements만 upsert)로 교체한다.
- **근거**: Supabase schema migration 없이 sync 효율을 개선할 수 있다.
- **위험**:
  - 기술: M — canonical document diff 알고리즘을 `pages`/`elements` row 레벨로 적용해야 하므로
    node identity(id) 기반 변경 감지가 필요하다.
  - 성능: L — element-level upsert로 변경된 요소만 전송하면 payload는 줄지만, round-trip 횟수는
    element 수에 따라 증가한다.
  - 유지보수: H — cloud transport가 row-level 구조를 유지하므로 ADR-120/121 이후 local/cloud
    schema 불일치가 영구화된다. ADR-126 Element type deprecate 이후 row-level schema가
    다시 문제가 된다.
  - 마이그레이션: L — Supabase schema 변경이 없으므로 data migration 비용 없다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  M   |    H     |      L       |     1      |
| B    |  H   |  M   |    L     |      H       |     2      |
| C    |  M   |  M   |    L     |      H       |     1      |
| D    |  M   |  L   |    H     |      L       |     1      |

- 대안 A: HIGH 1개(유지보수). cloud/local schema 영구 불일치가 ADR-122 목표와 역행한다.
- 대안 B: HIGH 2개(기술 + 마이그레이션). CRITICAL에 근접. 별도 루프 불필요 — 2개이므로
  대안 C가 트레이드오프 개선이다.
- 대안 C: HIGH 1개(마이그레이션). Gate G0-G2로 migration window 관리. 수용 가능.
- 대안 D: HIGH 1개(유지보수). ADR-126 prerequisite 관점에서 cloud row schema가 남으면
  Element type deprecate 시 다시 cloud migration이 필요하다.

→ 대안 C 선택. 유지보수 위험이 L(최저)이고, 마이그레이션 H는 Gate로 통제 가능하다.

## Decision

**대안 C 채택**: `documents` row 단일화 + boundary adapter로 row-level legacy export 격리.

**기각된 대안 사유**:

- **대안 A 기각**: cloud transport가 row-level 구조를 유지하면 ADR-122의 canonical-only 완결이
  transport layer에서 절반으로 끊긴다. ADR-126 Element type deprecate 시 다시 cloud migration이
  필요해지므로 장기 유지보수 비용이 더 크다.
- **대안 B 기각**: Supabase schema 변경 + 기존 데이터 bulk migration + row-level API 즉시 제거를
  단일 phase에서 진행하면 롤백 윈도우가 없다. 기존 클라우드 프로젝트 데이터 손실 위험이 허용 범위를
  초과한다.
- **대안 D 기각**: Supabase `pages`/`elements` schema가 남으면 ADR-126 전후로 cloud migration을
  두 번 수행해야 하는 debt가 생긴다. cloud/local schema 불일치도 영구화된다.

**위험 수용 근거**: 마이그레이션 HIGH 위험은 Phase 1의 migration window 설계(read-only legacy
fallback 보존) + G1 gate(기존 cloud project 데이터 손실 0건 검증)로 통제한다. document-level
payload 크기 위험은 G0에서 상위 10개 프로젝트의 `CompositionDocument` JSON 크기를 측정하고
Supabase column 제약과 비교해 확인한다.

> 구현 상세: [123-cloud-document-row-schema-breakdown.md](../design/123-cloud-document-row-schema-breakdown.md)

**후속 ADR**: ADR-126 (Element type deprecate)의 prerequisite 중 하나. ADR-123 G6 완료 후
ADR-126 착수 가능.

**의존 ADR**: ADR-122 Implemented (boundary allowlist 격리 확립) / ADR-116 (canonical primary
결정) / ADR-120/121 (local persistence cleanup)

## Risks

| ID  | 위험                                                                                                                      | 심각도 | 대응                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------ |
| R1  | 기존 cloud `pages`/`elements` row 데이터 손실 — migration window에서 fallback이 실패하면 프로젝트 복구 불가               |  HIGH  | G1: migration window 설계(pages/elements read-only fallback 보존). migration 완료 후 legacy row는 30일 보존.       |
| R2  | `documents` payload 크기가 Supabase column 제약 초과 — 대형 프로젝트에서 upsert 실패                                      | MEDIUM | G0: 상위 10개 프로젝트 `CompositionDocument` JSON 크기 측정 + Supabase max JSON 제약 확인. 초과 시 청크 전략 설계. |
| R3  | RLS policy 누락 — `documents` table에 project-level RLS 미적용 시 cross-project data leakage                              |  HIGH  | G1: Supabase migration에 RLS policy `(project_id = auth.uid()::text OR ...)` 포함. G6: RLS smoke test.             |
| R4  | `projectSync` 재작성 중 upload/download 비대칭 — write는 documents row, read는 아직 legacy row를 읽는 transitional window | MEDIUM | Phase 2-3을 순서대로 진행. G2(read) → G3(write) gate 순서 보장. 동시 전환 금지.                                    |
| R5  | dashboard seed 경로의 cloud/local 비대칭이 ADR-123 후에도 잔존 — cloud project 생성 시 `documents` row seed 누락          | MEDIUM | Phase 3에서 dashboard seed path 통일. G3 gate: cloud project 생성 후 documents row 존재 검증.                      |
| R6  | ADR-126 선행 의존 — cloud row schema가 cleanup되지 않으면 Element type deprecate 시 재작업                                |  LOW   | G6 완료 후 ADR-126 착수. 순서 보장은 ADR README로 관리.                                                            |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                            | 실패 시 대안                                                          |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| G0   | Phase 0 완료 | 상위 10개 프로젝트 `CompositionDocument` JSON 크기 측정 완료. Supabase `documents` table column 제약 확인. inventory freeze(6 surface 버킷 확정).                                                                                                                                                    | 크기 초과 시 청크 전략 Phase 1 포함하여 재설계.                       |
| G1   | Phase 1 완료 | Supabase `documents` table 생성 + RLS policy 적용 완료. `projects.documents` 테이블에 `project_id` FK 제약 확인. 기존 cloud project `pages`/`elements` row는 read-only fallback으로 보존됨 확인.                                                                                                     | RLS 실패 시 policy 수정 후 재적용.                                    |
| G2   | Phase 2 완료 | cloud read path: `downloadProjectFromCloud`가 `documents` row를 먼저 시도 → fallback only if documents row missing. `legacyToCanonical()` 호출이 Builder hot path에서 제거됨. vitest static guard PASS.                                                                                              | fallback 동작 실패 시 Phase 2 롤백.                                   |
| G3   | Phase 3 완료 | cloud write path: `syncProjectToCloud`가 `documents` row upsert 전용으로 전환. element-level `createMultipleElements`/`deleteMultipleElements` 호출 0건. dashboard seed cloud 경로가 `documents` row seed로 전환. vitest static guard + browser smoke PASS.                                          | write 실패 시 legacy row write fallback 복원 후 재설계.               |
| G4   | Phase 4 완료 | `legacyElementsApiService.ts`가 Builder hot path에서 import 0건. `canonicalMutations` thin wrapper 3개 제거 또는 경계 명확화. `PagesApiService`가 boundary adapter로만 참조됨. rg grep gate PASS.                                                                                                    | hot path 의존 발견 시 Phase 3 보완 후 재시도.                         |
| G5   | Phase 5 완료 | stale tests 재정렬(projectSync, dashboard, legacyElements 관련). `pnpm run codex:typecheck` PASS. legacy surface grep gate(pages/elements row direct call) 0건.                                                                                                                                      | test 실패 시 해당 surface 보완.                                       |
| G6   | Phase 6 완료 | browser smoke: cloud project 생성 → sync → download → 재개가 documents row 기반으로 동작. **RLS smoke**: 다른 user 의 `documents` row read/write 가 RLS policy 로 차단되는지 명시 검증 (auth.uid() mismatch case). `pnpm run codex:preflight` PASS. docs/rules/CHANGELOG sync. ADR Implemented 승격. | 실패 시 해당 phase 롤백 후 재진입. RLS 차단 실패 시 G1 policy 재설계. |

## Consequences

### Positive

- cloud/local transport schema가 `CompositionDocument` 단일로 통일된다. ADR-122 canonical-only
  runtime의 transport layer 완결.
- cloud download latency: element row N+1 round-trip → `documents` row single round-trip
  으로 전환. element 수에 비례하던 latency가 O(1)이 된다.
- `legacyToCanonical()` 호출이 Builder cloud download hot path에서 제거된다.
- ADR-126 (Element type deprecate) 착수를 위한 cloud prerequisite 달성.
- dashboard cloud/local project seed 경로가 대칭화된다.

### Negative

- Supabase `documents` table 생성 + RLS 설계가 필요하다. DevOps/Supabase 관리 작업 포함.
- `projectSync.ts` 전면 재작성으로 cloud sync 로직의 리그레션 위험이 있다. Phase 2-3에서
  targeted vitest와 browser smoke로 닫아야 한다.
- 대형 프로젝트에서 `CompositionDocument` JSON payload가 Supabase column 제약에 근접할 경우
  청크 전략이 필요하며 이는 추가 설계 비용이다.
- migration window 기간(G1~G3) 동안 legacy `pages`/`elements` row와 `documents` row가
  공존한다. 이중 schema 관리가 일시적으로 필요하다.

## 반복 패턴 선차단 체크리스트 (adr-writing.md §"반복 패턴 선차단" 4 항목 selfcheck)

- [x] **HIGH+ 위험 코드 경로 3곳 이상 구체 인용**: R1 (cloud `pages`/`elements` row 데이터 손실 H) → §Context Surface 1-6 에 6 surface file:line 인용 (`supabase.types.ts:150-172`, `legacyElementsApiService.ts`, `PagesApiService.ts`, `canonicalMutations.ts:1699-1733`, `dashboard/index.tsx:305-319`, `projectSync.ts`). R3 (RLS 누락 H) → G1 + G6 RLS smoke test 명시 (auth.uid() mismatch case).
- [x] **Spec/Generator 확장 ADR 여부**: 본 ADR 은 cloud transport schema cleanup, Spec/Generator 확장 아님. N/A.
- [x] **BC 훼손 수식화**: 외부 cloud 호환성 위험 (R1) → "기존 cloud project `pages`/`elements` row 100% read-only fallback 보존, migration 완료 후 30일 보존" (G1 + Risks R1 대응). 마이그레이션 영향 = 모든 cloud project (100%), 평균 row 수 = project 별 element 수에 비례.
- [x] **HIGH+ Phase 분리 가능 여부 검토**: 마이그레이션 H 1개. cloud schema migration 자체를 단일 ADR 로 닫는 것이 최소 단위 (read/write path 별도 분리 시 ADR-123-A/B drift 위험). Phase 0-6 7-phase 분할로 risk 누적 차단. 별도 ADR 분리 불필요.
