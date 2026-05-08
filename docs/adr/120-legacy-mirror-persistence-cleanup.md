# ADR-120: Legacy mirror persistence 제거 계획

## Status

Proposed — 2026-05-08

## Context

ADR-111/112/113/116/118/119 이후 Builder의 canonical format 방향은 이미
정해졌다.

- ADR-111은 reusable frame/page-frame surface를 canonical `FrameNode`/`RefNode`
  계열로 고정했다.
- ADR-112는 `reusable: true`, `type: "ref"`, `ref`, `descendants`, `slot` 기반
  editing semantics를 UI 계약으로 고정했다.
- ADR-113은 `tag -> type` 전환과 legacy mirror field quarantine을 완료했다.
- ADR-116은 local IndexedDB `documents` store와 `DatabaseAdapter.documents`를
  `CompositionDocument` primary persistence로 승격했다.
- ADR-118은 Element structural order를 canonical parent `children[]` index로
  고정했다.
- ADR-119는 Page/Layout order mirror를 canonical source order로 수렴시켰다.

그러나 현재 codebase에는 `documents` primary와 별개로 local IndexedDB
`pages`/`elements`/`layouts` objectStore, `DatabaseAdapter.pages/elements/layouts`
API, dashboard/projectSync/history/editor write path의 legacy mirror persistence가
남아 있다. 이 mirror는 더 이상 format SSOT가 아니며, 남겨둘수록 refresh,
origin/instance, frame binding, project sync에서 "document와 mirror 중 무엇이
진짜인가"라는 재발 조건을 만든다.

ADR-120은 canonical format 자체를 다시 설계하지 않는다. 목표는 남은 legacy
mirror persistence surface를 제거하거나 명시적 projection boundary로 격리해,
runtime read/write primary를 `CompositionDocument` 하나로 닫는 것이다.

**Hard Constraints**:

1. Builder local hydrate의 primary source는 `db.documents.get(projectId)`로 유지한다.
2. Builder local persist의 primary target은 `db.documents.put(projectId, doc)`로
   유지한다.
3. non-adapter runtime code는 `db.pages`, `db.elements`, `db.layouts`를 project
   document state의 read/write source로 사용하지 않는다.
4. `CompositionDocument.children[]` order, `type`, `reusable`, `type: "ref"`, `ref`,
   `descendants`, `slot`, `x-composition`의 canonical contract는 변경하지 않는다.
5. `apps/builder/src/adapters/canonical/**`와 `packages/shared/src/utils/export.utils.ts`
   같은 canonical/export bridge는 삭제 대상이 아니라 compatibility boundary로
   재분류한다.
6. Supabase physical `pages`/`elements` schema 제거는 별도 migration 승인이 없으면
   수행하지 않는다. cloud schema가 아직 `documents` payload를 저장하지 못하면, cloud
   upload는 canonical document에서 call-time projection한 compatibility payload만 보낸다.
   cloud legacy-only download는 remote transport adapter로만 허용하며, remote rows를
   one-shot으로 `CompositionDocument`로 변환한 뒤 local에는 `db.documents.put()`만
   수행한다.
7. IndexedDB objectStore 제거는 먼저 production runtime call site 0건과 test gate를
   통과한 뒤 `DB_VERSION` bump로 수행한다.
8. legacy-only project payload를 local `pages`/`elements`/`layouts` primary로 되살리는
   migration/read-through 경로를 새로 만들지 않는다. 허용되는 예외는 cloud transport
   payload를 `CompositionDocument`로 변환하는 one-shot import boundary뿐이다.
9. 변경 후 실제 Builder refresh, page/frame binding, reusable origin/instance,
   drag/drop, project create/delete, import/export flow를 browser 또는 targeted test로
   검증한다.

**Soft Constraints**:

- cleanup은 한 번에 대량 삭제하지 않고 read path, write path, project sync, schema
  cleanup 순서로 나눈다.
- cloud compatibility는 local runtime cleanup보다 늦게 닫아도 된다.
- 테스트 fixture와 Table/collection component data의 `order_num` 같은 별도 data model은
  이 ADR의 local mirror persistence 제거 범위에 섞지 않는다.
- 문서/grep gate가 "legacy 문자열 0건"을 목표로 삼지 않고, runtime primary surface
  0건과 boundary allowlist를 구분한다.

## Alternatives Considered

### 대안 A: legacy mirror store/API 유지

- 설명: `documents` primary는 유지하되 local `pages`/`elements`/`layouts` mirror와
  `DatabaseAdapter` API를 compatibility cache로 계속 유지한다.
- 근거: 현재 코드 변경량이 가장 작고 `projectSync`/dashboard/delete path를 바로
  바꾸지 않아도 된다.
- 위험:
  - 기술: H — document와 mirror가 계속 drift할 수 있고 refresh/origin/instance/frame
    regression 원인이 유지된다.
  - 성능: M — 같은 문서 상태를 document + 3개 mirror store에 중복 write한다.
  - 유지보수: H — 새 기능마다 canonical path와 mirror path를 둘 다 확인해야 한다.
  - 마이그레이션: L — physical schema 변화가 없다.

### 대안 B: local과 Supabase legacy schema를 한 번에 삭제

- 설명: IndexedDB `pages`/`elements`/`layouts`, `DatabaseAdapter` legacy surface,
  Supabase `pages`/`elements` physical schema/API를 한 번에 제거하고 document payload만
  남긴다.
- 근거: 최종 상태에 가장 빨리 도달한다.
- 위험:
  - 기술: H — local runtime, cloud sync, API services, dashboard create/delete가 동시에
    깨질 수 있다.
  - 성능: L — 완료 후에는 가장 단순하다.
  - 유지보수: M — 완료 후 단순하지만 cutover 중 fallback과 diagnosis가 어렵다.
  - 마이그레이션: H — Supabase schema/API 배포 순서와 기존 cloud row 처리가 필요하다.

### 대안 C: strong local mirror removal + cloud projection boundary

- 설명: local Builder runtime에서 `pages`/`elements`/`layouts` mirror persistence를
  최종 제거 대상으로 고정한다. non-adapter runtime `db.pages/elements/layouts`
  call site를 0건으로 만들고, `DatabaseAdapter.pages/elements/layouts` public surface와
  IndexedDB `pages`/`elements`/`layouts` objectStore를 삭제한다. Supabase physical schema가
  legacy row API를 요구하는 동안에는 `CompositionDocument`에서 call-time projection한
  compatibility payload만 허용한다.
- 근거: ADR-116 direct cutover와 ADR-118/119 order SSOT의 방향을 보존하면서 rollback
  surface를 phase별로 제한한다. guard/deprecation은 삭제 전 안전장치일 뿐 완료 조건이
  아니다.
- 위험:
  - 기술: M — history/editor/drag/drop/projectSync의 기존 mirror write를 한 번에 놓치면
    stale UI 또는 cloud sync 회귀가 생긴다.
  - 성능: L — local 중복 write가 줄어든다.
  - 유지보수: L — runtime state source가 `documents` 하나로 줄어든다.
  - 마이그레이션: M — IndexedDB store 제거와 cloud projection boundary 재설계가 필요하다.

### 대안 D: local mirror는 삭제하되 `pagesApi/elementsApi`를 primary sync로 유지

- 설명: IndexedDB mirror만 제거하고 cloud sync는 계속 `pagesApi`/`elementsApi` row를
  primary로 간주한다.
- 근거: local DB cleanup 범위는 줄이고 기존 Supabase API를 유지할 수 있다.
- 위험:
  - 기술: H — local은 document primary, cloud는 elements/pages primary가 되어 또 다른
    dual-SSOT가 생긴다.
  - 성능: M — cloud upload/download에서 document projection/merge 비용과 row sync 비용이
    모두 남는다.
  - 유지보수: H — local/cloud 의미가 달라져 bug reproduction이 어려워진다.
  - 마이그레이션: M — cloud schema는 유지하지만 sync protocol 재정의가 필요하다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | H    | M    | H        | L            |     2      |
| B    | H    | L    | M        | H            |     2      |
| C    | M    | L    | L        | M            |     0      |
| D    | H    | M    | H        | M            |     2      |

루프 판정: A/B/D는 HIGH 위험이 1개 이상이라 primary plan으로 채택하지 않는다.
대안 C는 모든 축이 MEDIUM 이하이며, local runtime mirror 삭제를 강제하면서 cloud physical
schema 제거를 분리해 rollout 위험을 제한한다.

## Decision

**대안 C: strong local mirror removal + cloud projection boundary**를 선택한다.

선택 근거:

1. ADR-116의 `CompositionDocument` primary persistence 결정을 유지하면서 남은 local
   mirror write/read drift를 최종 제거한다.
2. ADR-118/119의 structural order SSOT를 깨지 않고, page/element/layout mirror row를
   order 또는 ownership source로 되살리지 않는다.
3. Supabase physical schema 제거를 local cleanup과 분리해, cloud migration 승인 없이도
   runtime bug source를 먼저 줄일 수 있다.
4. `DatabaseAdapter.pages/elements/layouts`와 IndexedDB `pages`/`elements`/`layouts`
   objectStore는 완료 시점에 제거한다.
5. `apps/builder/src/adapters/canonical/**`는 삭제하지 않고 projection/export boundary로
   남겨 compatibility 책임을 명확히 한다.

기각 사유:

- **대안 A 기각**: 중복 persistence를 유지하면 ADR-116 이후 반복된 refresh/origin/frame
  drift 재발 조건이 남는다.
- **대안 B 기각**: local cleanup과 Supabase schema migration을 동시에 묶어 rollback
  surface를 불필요하게 키운다.
- **대안 D 기각**: local과 cloud primary source가 갈라져 dual-SSOT 문제가 형태만 바뀐다.

> 구현 상세: [120-legacy-mirror-persistence-cleanup-breakdown.md](design/120-legacy-mirror-persistence-cleanup-breakdown.md)
> 구현 인벤토리:
> [120-legacy-mirror-persistence-inventory.md](design/120-legacy-mirror-persistence-inventory.md)

## Risks

| Risk                                   | Impact                                                                            | Mitigation                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| missed runtime mirror write            | property update, origin/instance, frame binding, drag/drop drift가 재발할 수 있다 | Phase 0 allowlist와 phase별 `rg` gate로 production `db.pages/elements/layouts` project-state call site를 0건으로 고정한다        |
| cloud legacy transport conversion loss | Supabase legacy-only download에서 page/body/frame/ref semantics가 손실될 수 있다  | legacy rows는 one-shot `CompositionDocument` import boundary로만 변환하고, 변환 불가 payload는 explicit error로 중단한다         |
| DB/API surface deletion blast radius   | tests/mocks/debug UI 또는 non-project-data store가 함께 깨질 수 있다              | delete-runtime/delete-schema/non-project-data/test-fixture bucket을 분리하고 `DatabaseAdapter` mock shape를 단계별로 축소한다    |
| canonical/export bridge over-deletion  | import/export, frame/ref materialization, legacy fixture coverage가 깨질 수 있다  | `apps/builder/src/adapters/canonical/**`와 shared export bridge는 projection boundary로 유지하고 DB mirror read/write만 제거한다 |
| IndexedDB upgrade/stale data handling  | 기존 dev DB에서 objectStore 삭제 upgrade가 실패하거나 stale row가 남을 수 있다    | runtime call site 0건 이후 `DB_VERSION` bump, delete-only upgrade allowlist, browser IndexedDB smoke로 검증한다                  |

## Scope Clarification

ADR-120의 완료 의미는 repo 전체에서 `legacy` 문자열이나 legacy compatibility helper를
0건으로 만드는 것이 아니다. 완료 기준은 다음이다.

- local Builder runtime의 project document state read/write primary가
  `CompositionDocument` 하나로 닫힌다.
- production runtime에서 `db.pages`, `db.elements`, `db.layouts` project mirror call
  site는 0건이다. 테스트/static grep gate와 Supabase projection API 이름만 allowlist로
  남길 수 있다.
- `DatabaseAdapter.pages/elements/layouts` public surface는 제거된다.
- IndexedDB `pages`/`elements`/`layouts` objectStore는 runtime 미사용 상태를 확인한 뒤
  `DB_VERSION` bump와 upgrade cleanup으로 제거된다. read/write 차단 guard는 삭제 전
  임시 안전장치이며 ADR-120 완료 조건이 아니다.
- cloud sync가 legacy row API를 계속 사용해야 할 경우, canonical document에서
  call-time projection한 payload만 사용하고 local mirror를 primary로 재생성하지 않는다.
  legacy-only cloud download도 remote rows를 local mirror store에 쓰지 않고 one-shot
  canonical document로 변환해 `db.documents.put()`만 수행한다.

다음은 범위 밖이다.

- canonical format 재설계.
- Pencil import/export adapter 전체 삭제.
- Table/collection component data model의 `order_num` 제거.
- Supabase physical schema drop을 승인 없이 수행하는 작업.

## Gates

| Gate                            | 시점         | 통과 조건                                                                                                                                  | 실패 시 대안                                                |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| G0: inventory + allowlist       | Phase 0 종료 | `db.pages/elements/layouts`, `pagesApi/elementsApi`, legacy mirror field access를 runtime/delete/boundary/test bucket으로 분류             | 구현 착수 금지                                              |
| G1: local hydrate/create/delete | Phase 1 종료 | dashboard/usePageManager/project lifecycle이 local mirror 없이 `documents` primary로 create, hydrate, delete를 수행                        | dashboard/local lifecycle만 rollback                        |
| G2: runtime write cutover       | Phase 2 종료 | add/update/remove/drag/history/editor path가 local mirror row가 아니라 active document를 먼저 persist                                      | mutation family별 rollback                                  |
| G3: frame/page binding cleanup  | Phase 3 종료 | frame create/delete/update, page-frame binding, frame element load가 `layouts/elements/pages` mirror를 project state source로 안 씀        | canonical adapter boundary로 임시 격리 후 G3 재시도         |
| G4: project sync boundary       | Phase 4 종료 | upload는 document-derived projection만 사용하고, legacy-only download는 one-shot `CompositionDocument` 변환 후 `db.documents.put()`만 수행 | 변환 불가 payload는 explicit error + 후속 import/schema ADR |
| G5: DB/API surface removal      | Phase 5 종료 | `DatabaseAdapter.pages/elements/layouts` 제거, IndexedDB `pages/elements/layouts` objectStore 삭제 + `DB_VERSION` upgrade 완료             | 임시 runtime guard 후 G5 재시도. guard-only는 완료 아님     |
| G6: verification/docs/rules     | Phase 6 종료 | targeted tests, `codex:typecheck`, browser refresh/drag/frame/origin-instance smoke, README/changelog/rule sync 완료                       | allowlist 재분류 후 실패 phase 재실행                       |

## Consequences

### Positive

- Builder local state의 SSOT가 `CompositionDocument` 하나로 단순해진다.
- property update 후 sibling order 변경, origin 삭제 후 instance ref 잔류, page-frame
  refresh drift 같은 mirror 재발 조건이 줄어든다.
- IndexedDB schema와 `DatabaseAdapter` surface가 ADR-116 이후 architecture에 맞게
  삭제된다.
- cloud compatibility가 필요해도 projection boundary로 한정되어 local runtime과 분리된다.

### Negative

- history/editor/drag/drop/projectSync 경로가 넓어 phase별 targeted test가 필요하다.
- Supabase physical schema 제거가 별도 결정으로 남으면 compatibility adapter는 당분간
  유지된다.
- `apps/builder/src/adapters/canonical/**`를 무분별하게 삭제하면 export/import,
  frame/ref materialization, legacy fixture coverage가 깨질 수 있다.
- IndexedDB objectStore 삭제는 기존 dev DB의 stale data 확인과 upgrade cleanup 검증이
  필요하다.
