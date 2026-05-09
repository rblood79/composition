# ADR-122: Canonical-only runtime 전환 및 legacy mirror 제거

## Status

Implemented — 2026-05-09

Closure snapshot:

- Completed phases: G0-G6.
- Final closed slices: page-shell bridge preservation/deleted-page
  anti-resurrection, Runtime Compare Mode canonical Preview sync, Preview
  canonical-empty render guard, ADR-113/116 grep gate recovery, add/update/remove
  store helper canonical-before-cache closure, exact G6 builder/shared
  verification, full Phase 6 browser checklist smoke, and `pnpm run
codex:preflight`.
- Residual policy: repo-wide `legacy`/`Element[]` string 0건이 아니라,
  Builder internal runtime hot path에서 mutable legacy mirror를 source로 쓰지 않는
  것이 completion 기준이다. `UPDATE_ELEMENTS` Preview compatibility receive type,
  publish/cloud/export/import boundary, and canonical-derived renderer maps remain
  allowed by bucket.

## Context

ADR-116은 `CompositionDocument`를 저장/편집/export/import의 SSOT로 승격했고,
ADR-118/119는 structural order를 `children[]` source order로 수렴시켰다.
ADR-120/121은 local IndexedDB의 `pages`/`elements`/`layouts` mirror persistence와
dormant DB surface를 제거했다.

ADR 작성 시점의 local persistence primary는 `db.documents`로 닫혔지만, Builder runtime에는
canonical-first hybrid가 남아 있었다. 대표적으로 `canonicalMutations` wrapper는
canonical store를 갱신한 뒤 `exportLegacyDocument()` 결과를 legacy `setElements()` mirror로
되돌렸고, 일부 Skia/Preview/Properties/LayerTree 경로는 `Element[]` 또는 `elementsMap`
derived view를 runtime input으로 소비했다. 이 구조는 legacy primary는 아니지만
"canonical-only runtime"도 아니었다.

이 ADR은 ADR-116의 후속으로, 내부 runtime에서 mutable legacy mirror를 제거하고
`CompositionDocument`/canonical selectors/resolved canonical tree를 직접 소비하도록 전환한다.
cloud/Supabase physical `pages`/`elements` schema 제거는 이번 ADR의 기본 scope가 아니며,
compatibility export/import boundary로 분리한다.

**Hard Constraints**:

1. `CompositionDocument`와 IndexedDB `composition.documents`는 project document state의
   유일한 local persistence primary로 유지한다.
2. runtime mutation은 canonical document를 먼저 갱신해야 하며, legacy `Element[]` mirror를
   mutable store source로 되돌리는 `setElements()` write-back을 최종 제거한다.
3. `exportLegacyDocument()`는 cloud/export/import/temporary compatibility boundary에서만
   허용한다. Builder hot path mutation, Skia render input, Preview active channel,
   Selection/Properties read source에서는 사용할 수 없다.
4. `useStore.elementsMap`, `useStore.elements`, `childrenMap`은 final state에서 runtime
   authority가 될 수 없다. transition 중 필요하면 canonical-derived read-only snapshot으로만
   제한한다.
5. Element/page/layout order는 `CompositionDocument.children[]` index가 SSOT이며,
   `order_num`이나 page/layout `metadata.order_num`을 재도입하지 않는다.
6. Preview, Skia, LayerTree, Properties, History/Undo, drag/drop commit은 각각 canonical
   input으로 회귀 0을 검증해야 한다.
7. Supabase physical schema drop, public cloud row contract removal, external API migration은
   별도 ADR 또는 explicit gate 없이는 수행하지 않는다.

**Soft Constraints**:

- 한 번에 `Element` 타입을 삭제하지 않고, runtime source 제거 → derived view 축소 →
  compatibility boundary quarantine 순서로 진행한다.
- 기존 사용자-visible Builder flow는 phase마다 targeted Vitest와 browser smoke로 닫는다.
- stale ADR-116 tests/gates는 ADR-119/120/121 이후 기준으로 재정의하되, 실제
  `children[]` order regression은 stale test로 묻지 않는다.

## Alternatives Considered

### 대안 A: canonical primary + legacy mirror hybrid 유지

- 설명: 현재처럼 canonical document를 primary로 저장하되, runtime store에는 계속
  `Element[]`/`elementsMap` mirror를 유지한다.
- 근거: 변경량이 가장 작고 기존 UI consumer를 거의 건드리지 않는다.
- 위험:
  - 기술: M — persistence primary와 runtime source가 계속 다른 모델이라 drift 탐지가 어렵다.
  - 성능: M — mutation마다 canonical → legacy export mirror를 반복한다.
  - 유지보수: H — ADR-116/118/119의 SSOT 규칙을 설명할 때마다 legacy 예외가 남는다.
  - 마이그레이션: L — 기존 runtime consumer를 유지하므로 단기 이동 비용은 낮다.

### 대안 B: runtime과 cloud/Supabase legacy schema를 한 번에 제거

- 설명: Builder runtime mirror 제거와 동시에 Supabase `pages`/`elements` row contract,
  legacy export/import payload까지 삭제한다.
- 근거: 최종 상태에 가장 빠르게 도달하고 legacy 문자열 allowlist를 최소화한다.
- 위험:
  - 기술: H — local runtime, cloud sync, external publish/import contract가 동시에 바뀐다.
  - 성능: M — 단일 document payload 집중으로 cloud diff/write 전략을 새로 설계해야 한다.
  - 유지보수: M — 완료 후 단순하지만 cutover 중 fallback과 진단 surface가 부족하다.
  - 마이그레이션: H — 원격 프로젝트와 외부 consumer 호환성 깨짐 위험이 크다.

### 대안 C: internal runtime canonical-only 전환, legacy는 boundary로만 격리

- 설명: Builder runtime mutation/read/render/preview 경로에서 mutable legacy mirror를 제거하고,
  legacy `Element[]` 생성은 cloud/export/import compatibility adapter로만 남긴다.
- 근거: ADR-116의 `CompositionDocument` primary 결정을 runtime까지 닫으면서, cloud schema
  migration은 별도 의사결정으로 분리할 수 있다.
- 위험:
  - 기술: M — Selection/Properties/Skia/Preview/History/LayerTree 소비자를 순차 전환해야 한다.
  - 성능: M — canonical selectors/resolver가 잘못 설계되면 render마다 deep traversal이 생길 수 있다.
  - 유지보수: L — 완료 후 runtime source가 하나로 줄어든다.
  - 마이그레이션: M — 테스트/gate와 일부 compatibility adapter를 재정렬해야 한다.

### 대안 D: legacy `Element[]`를 read-only derived view로 영구 유지

- 설명: mutable legacy store write-back은 제거하되, 대부분 runtime consumer는
  `canonicalDocumentToElements()` 같은 derived `Element[]` view를 계속 읽게 한다.
- 근거: 기존 consumer 수정량을 줄이면서 write-back 루프는 끊을 수 있다.
- 위험:
  - 기술: M — derived view cache invalidation과 canonical node identity 정합이 새 문제로 남는다.
  - 성능: H — render/selection hot path에서 document-wide projection이 반복될 수 있다.
  - 유지보수: H — runtime model은 여전히 legacy shape이므로 canonical-only라고 판정하기 어렵다.
  - 마이그레이션: M — 나중에 다시 consumer별 canonical 전환이 필요하다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | M    | H        | L            |     1      |
| B    | H    | M    | M        | H            |     2      |
| C    | M    | M    | L        | M            |     0      |
| D    | M    | H    | H        | M            |     2      |

루프 판정: A/B/D는 HIGH 위험이 1개 이상이므로 primary plan으로 채택하지 않는다.
대안 C는 모든 축이 MEDIUM 이하이며, cloud schema migration과 runtime canonicalization을
분리해 rollback surface를 줄인다.

## Decision

**대안 C: internal runtime canonical-only 전환, legacy는 boundary로만 격리**를 선택한다.

선택 근거:

1. ADR-116의 `CompositionDocument` primary 결정을 storage뿐 아니라 runtime mutation/read
   source까지 확장한다.
2. ADR-118/119의 `children[]` order SSOT를 유지하면서 `order_num` 기반 legacy mirror를
   다시 만들지 않는다.
3. cloud/Supabase physical schema 제거를 별도 gate로 분리해 local runtime cleanup의 위험을
   통제한다.
4. `exportLegacyDocument()`는 compatibility adapter로만 남기므로 외부 transport는 유지하면서
   내부 hot path drift는 제거할 수 있다.

기각 사유:

- **대안 A 기각**: 현재 hybrid를 유지하면 ADR-116의 Implemented 의미가 계속 약해지고,
  mutation마다 canonical → legacy mirror drift 위험이 남는다.
- **대안 B 기각**: local runtime cleanup과 cloud schema migration을 동시에 수행하면 실패 시
  원인 분리가 어렵고 외부 호환성 위험이 과도하다.
- **대안 D 기각**: mutable write-back은 줄지만 runtime data model이 계속 legacy `Element`
  중심이라 canonical-only completion gate를 통과할 수 없다.

> 구현 상세: [122-canonical-only-runtime-legacy-mirror-removal-breakdown.md](../design/122-canonical-only-runtime-legacy-mirror-removal-breakdown.md)
> / [inventory](../design/122-canonical-only-runtime-legacy-mirror-removal-inventory.md)

## Risks

| Risk                          | Impact                                                                 | Mitigation                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| false canonical-only closure  | `Element[]` derived view가 사실상 runtime source로 영구화될 수 있다    | G0 inventory bucket과 G4 boundary grep gate로 hot path derived view를 금지한다              |
| Skia/Preview parity break     | canonical tree 직접 소비 중 layout, selection, hit-test가 깨질 수 있다 | Phase별 Skia/Preview targeted tests와 browser smoke를 gate로 둔다                           |
| history/undo regression       | legacy element diff 기반 history가 canonical patch를 놓칠 수 있다      | History phase에서 canonical patch/event 계약을 별도 검증하고 undo/redo targeted test를 둔다 |
| selection/properties stale UI | selected node lookup이 legacy id/metadata fallback에 묶일 수 있다      | canonical selection path와 node alias resolver를 먼저 확정한다                              |
| cloud compatibility drift     | Supabase row projection이나 export/import가 깨질 수 있다               | compatibility boundary를 유지하고 projectSync/export/import tests를 별도 gate로 둔다        |
| performance regression        | canonical resolver가 render마다 full traversal을 수행할 수 있다        | selector cache, scene snapshot, invalidation packet 기준을 Phase 2/3 gate에 포함한다        |

## Gates

| Gate                                  | 시점         | 통과 조건                                                                                                                                                                                   | 실패 시 대안                                              |
| ------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| G0: hybrid inventory freeze           | Phase 0 종료 | `exportLegacyDocument`, `canonicalDocumentToElements`, `UPDATE_ELEMENTS`, `elementsMap`, `setElements` 사용처를 runtime hot path / transition derived / boundary / test-doc bucket으로 분류 | 구현 착수 금지, bucket 재분류                             |
| G1: mutation mirror 제거              | Phase 1 종료 | `canonicalMutations` in-memory wrappers가 canonical document만 갱신하고 legacy `actions.setElements(exportLegacyDocument(doc))` write-back을 수행하지 않음                                  | wrapper별 fallback 없이 phase rollback                    |
| G2: runtime read canonicalization     | Phase 2 종료 | Selection/Properties/LayerTree/Skia/History가 mutable `elementsMap`을 authoritative source로 읽지 않고 canonical selectors/resolved tree를 사용                                             | consumer별 temporary read-only adapter로 격리 후 재시도   |
| G3: Preview/Skia active protocol 전환 | Phase 3 종료 | Builder→Preview active channel은 `UPDATE_CANONICAL_DOCUMENT` 중심이며 `UPDATE_ELEMENTS`는 recovery/compat boundary로만 남음. Skia render input은 canonical scene snapshot 기반              | Preview 또는 Skia path만 rollback                         |
| G4: legacy boundary quarantine        | Phase 4 종료 | `exportLegacyDocument()`와 legacy `Element[]` 생성은 projectSync/cloud/export/import/publish compatibility boundary allowlist에만 존재                                                      | boundary allowlist 보강 후 재시도                         |
| G5: stale test/gate 재정렬            | Phase 5 종료 | ADR-116 canonical tests가 ADR-119/120/121 기준으로 갱신되고 `order_num` 기대, stale descendants allowlist, stale static strings가 제거됨                                                    | test contract와 runtime contract 재검토                   |
| G6: final verification                | Phase 6 종료 | targeted Vitest, grep gates, `pnpm run codex:preflight`, Builder browser smoke에서 create/edit/delete/reorder/origin-instance/refresh 회귀 0                                                | 실패 bucket을 ADR 본문에 residual로 기록하고 phase 재실행 |

## Implementation Progress

2026-05-08 실행 상태:

- Phase 0 inventory freeze를 시작했고 raw seed 607 hit를 `runtime-forbidden`,
  `transition-derived-readonly`, `boundary-allowed`, `test-doc` bucket으로 분류했다.
  latest cleanup 후 current raw seed는 462 hit다.
- Phase 1 mutation mirror 제거 slice를 land했다. `canonicalMutations` wrapper 내부
  legacy `actions.setElements(exportLegacyDocument(doc))` write-back은 0건이다.
- Closure audit follow-up으로 `elementCreation`, `elementUpdate`, `elementRemoval`
  store helper가 derived store cache를 먼저 갱신하고 canonical document를 뒤따라
  맞추던 순서를 제거했다. 이제 add/update/remove helper는 canonical mutation
  wrapper를 먼저 호출하고 `elements`/`elementsMap`/`childrenMap` cache를 이후
  갱신한다.
- Phase 2 첫 slice로 `useSelectedElementData`가 active canonical document 존재 시
  legacy `elementsMap` fallback으로 선택 데이터를 되살리지 않도록 변경했다.
  Follow-up으로 selected ref override props fallback도 active canonical document를 직접
  traversal하고 `canonicalElementSnapshot` helper 의존을 제거했다.
- Phase 2 추가 slice로 LayerTree/LayersSection 선택/트리 view model에서 canonical
  layer node를 stale legacy `elementsMap`이 덮어쓰지 않도록 canonical-derived map을
  우선 사용한다.
- Phase 2 보강 slice로 `useTreeExpandState`가 store `elementsMap`을 구독하지 않고
  caller-provided canonical frame/tree elements에서 parent lookup map을 파생하도록
  전환했다. FramesTab의 refresh test도 canonical frame descendants가 있으면 mirror
  merge 없이 canonical view를 사용하는 계약으로 정렬했다.
- Phase 2 보강 slice로 `FramesTab`의 hydration fallback도 store `elementsMap`
  구독 대신 store `elements`에서 read-only map을 파생하도록 좁혔다.
- Phase 3 첫 slice로 `BuilderCore`의 active Preview `UPDATE_ELEMENTS` publish
  subscription을 제거하고, `useIframeMessenger`의 canonical document 변경 effect를
  active `UPDATE_CANONICAL_DOCUMENT` sync로 고정했다. `UPDATE_ELEMENTS`는 canonical
  hydration 이전 legacy bootstrap/compat message type으로만 남아 있다. Skia는 active
  canonical document가 있으면 page/frame mode 모두 canonical-derived read-only tree를
  input으로 사용하도록 전환했고, follow-up으로 `buildCanonicalSceneModel()` 경계를 통해
  document-backed scene model을 직접 소비하도록 닫았다.
- Phase 3 보강 slice로 `useIframeMessenger` selection echo가 store `elementsMap`
  subscription을 사용하지 않고 active canonical document traversal을 우선 조회하도록
  전환했다.
- Phase 3 보강 slice로 `useIframeMessenger`의 preview-generated
  column/field element dedupe도 active canonical document traversal을 우선 사용하고,
  direct `useStore.getState().elementsMap` read를 제거했다.
- Phase 3 보강 slice로 deprecated `useDeltaMessenger`의 통계용 element count도
  canonical elements length를 우선 사용하고 store `elementsMap.size` 구독을 제거했다.
  Follow-up으로 active canonical elements가 있을 때는 store `elements.length`
  subscription도 bootstrap fallback으로만 남도록 좁혔다.
- Phase 4 보강 slice로 `performanceMonitor`의 element count/store memory estimate도
  active canonical document traversal count를 우선 사용하고 store `elementsMap.size`
  count를 제거했다.
- Phase 4 보강 slice로 Monitor `useComponentMemory`도 active canonical elements에서
  element/child lookup map을 파생하고 store `elementsMap`/`childrenMap` 구독을
  제거했다.
- Phase 2 보강 slice로 `useCanonicalPropertyRead` fallback도 store
  `elementsMap`/`childrenMap` 직접 구독 대신 store `elements[]`에서 read-only
  lookup map을 파생하도록 정렬했다.
- Phase 2/4 보강 slice로 `useCollectionItemManager` children read도 active
  canonical elements를 우선 사용하고 store `childrenMap` 직접 read를 제거했다.
- Phase 3/4 보강 slice로 `useCanvasSelectedElement`는 selected id만 store에서
  읽고 element lookup은 active canonical elements 우선, store `elements[]`
  fallback으로 수행한다.
- Phase 2 보강 slice로 LayerTree resolution fallback도 store `elementsMap`
  구독 대신 store `elements[]`에서 read-only map을 파생한다.
- Phase 2/4 보강 slice로 `BuilderCore` mutation registration/page-shell bridge
  fallback도 store `elementsMap.values()` 대신 store `elements[]`를 사용한다.
- Phase 3 보강 slice로 `BuilderCanvas`의 Skia input fallback `elementsMap`/
  `childrenMap`도 store map 구독 대신 canonical/store `elements[]`에서 파생한다.
- Phase 2 보강 slice로 `useSelectedElementData` legacy-bootstrap fallback도 store
  `elementsMap` get/values 대신 store `elements[]`에서 selected/ref lookup을
  수행한다.
- Phase 2/4 보강 slice로 exported `useElementById`/`useChildElements` selectors도
  store `elementsMap`/`childrenMap` direct read 대신 store `elements[]`에서
  read-only lookup을 파생한다.
- Phase 2/4 보강 slice로 `frameLayoutCascade` frame delete removed-id collection도
  store `elementsMap.values()` 대신 store `elements[]`를 사용한다.
- Phase 2/4 보강 slice로 `inspectorActions` style/fill resolved-read lookup도 active
  canonical document traversal fallback을 사용하고 store `elementsMap`을 전달하지 않으며
  bootstrap fallback은 store `elements[]` iterable로 제한한다.
- Phase 2/4 보강 slice로 `elementLoader` lazy-load disabled/already-loaded/loading
  wait read path도 store `elementsMap.forEach` 순회 대신 store `elements[]`에서 page
  elements를 필터링한다.
- Phase 2/4 보강 slice로 selection hierarchy editing context lookup도 active
  canonical document traversal에서 선택에 필요한 최소 element shape를 파생하고 store
  `elements[]` fallback으로 parent/child 관계를 계산한다.
- Phase 2/4 보강 slice로 `elementRemoval` 삭제 대상 수집도 caller의
  `state.elementsMap`/`state.childrenMap` 입력을 받지 않고 store `elements[]`에서
  read-only lookup을 파생한다.
- Phase 2/4 보강 slice로 `instanceActions` origin/instance lookup, child list,
  persisted snapshot lookup도 store map 직접 read 대신 store `elements[]` 기반 helper를
  사용한다.
- Phase 2/4 보강 slice로 `elementUpdate` props/batch pre-read와 dirty descendant
  traversal도 store map direct read 대신 store `elements[]`에서 element/children lookup을
  파생한다. 해당 slice 후 raw seed는 485 hit였다.
- Phase 2/4 보강 slice로 `elements.ts` 일반화 items/Menu 액션도 direct
  `get().elementsMap.get(...)` 대신 store `elements[]` lookup helper를 사용한다. raw
  seed는 485로 유지된다.
- Phase 2/4 보강 slice로 `elements.ts` page activation target lookup과 selected props
  hydration fallback도 store `elementsMap` direct read 대신 store `elements[]` 우선,
  active canonical document traversal fallback으로 전환했다. `lazyLoadPageElements`
  selection invariant test fixture도 legacy `getByPage` mock이 아니라 canonical document
  source를 사용하도록 정렬했다. 해당 slice 후 raw seed는 482 hit였다.
- Phase 2/4 보강 slice로 `elements.ts` `mergeElements`/`replaceElementId` pre-read와
  set/select/multi-select props fallback도 store map direct read 대신 store
  `elements[]` 우선, active canonical document traversal fallback을 사용하도록 정렬했다.
  해당 slice 후 raw seed는 480 hit였다.
- Phase 2/4 보강 slice로 `elements.ts` page shell append, page removal, cross-container
  move fallback도 store map direct read 대신 store `elements[]`에서 index를 재생성하거나
  파생한 read-only index를 사용한다. move fallback은 target sibling insertion 기준으로
  `order_num`도 함께 갱신하도록 고정했다. 해당 slice 후 raw seed는 478 hit였다.
- Phase 2/4 보강 slice로 `inspectorActions` selected element, style/fill preview,
  update commit dirty-subtree 경로도 store `elementsMap`/`childrenMap` direct read 대신
  store `elements[]`와 active canonical document traversal fallback에서 lookup/index를
  파생한다.
  해당 slice 후 raw seed는 476 hit였다.
- Phase 2/4 보강 slice로 `elementCreation` customId generation, `instanceActions`
  origin toggle/reset override, `TableHeaderEditor` row discovery도 store map direct read
  대신 caller/store `elements[]`에서 local lookup/children index를 파생한다. 해당 slice 후
  raw seed는 474 hit였다.
- Phase 4 boundary cleanup slice로 Preview inbound `UPDATE_ELEMENTS` recovery가 Builder
  legacy store cache를 갱신하던 역방향 경로를 제거했다. `usePageManager` project hydrate는
  일반 `setElements` 대신 `hydrateProjectSnapshot` boundary로 좁혔고, shared TagGroup
  renderer의 parent `UPDATE_ELEMENTS` legacy snapshot 송신, unused `MessagingService`/
  `IframeMessenger.updateElements` facade, dead `useMessageCoalescing` hook, delta messenger
  full `UPDATE_ELEMENTS` fallback을 제거했다. 해당 slice 후 raw seed는 463 hit였다.
- Phase 3 보강 slice로 `BuilderCanvas` Skia input bridge의 direct
  `canonicalDocumentToElements(...)` projection call site를 제거하고 canonical scene
  model 경계로 축소했다.
- Phase 3 보강 slice로 `SceneStructureSnapshot`에 `canonical`/
  `legacy-bootstrap` source marker를 추가하고, `BuilderCanvas`가 active canonical
  document 기반 snapshot을 명시적으로 태그하도록 했다.
- Phase 3 보강 slice로 `BuilderCanvas`가 active canonical document 존재 시 Skia
  scene snapshot의 `pageIndex`도 store mirror 인덱스가 아니라 canonical scene
  model에서 재구성한 read-only index를 사용하도록 전환했다.
- Phase 3 보강 slice로 `BuilderCanvas`의 Skia scene input을
  `useCanonicalElements()` hook boundary 대신
  `buildCanonicalSceneModel(activeCanonicalDocument)`로 격리했다. active canonical
  document가 있으면 `elements`/`elementsMap`/`childrenMap`/`pageIndex`/
  `frameElementScopes`를 하나의 canonical scene model에서 공급하고, store mirror는
  hydration fallback으로만 남는다. 추가 slice로 scene model 내부도
  `canonicalElementSnapshot` helper를 거치지 않고 canonical document traversal을 직접
  사용하도록 좁혔다.
- Phase 3/4 보강 slice로 `canonicalElementSnapshot` helper 자체도
  `canonicalDocumentToElements(...)` 호출 대신 `visitCanonicalDocumentElements`
  traversal API를 사용하도록 정렬했고, 후속 G4 slice에서 production consumer 0건을
  확인한 뒤 helper 파일과 전용 static test를 제거했다. 해당 slice 후 raw seed는
  462 hit다.
- Phase 3 추가 slice로 canvas drag/drop hot path가 Skia renderer input의 interactive
  canonical-derived `elementsMap`/`childrenMap`을 우선 사용한다. canonical move 후
  history payload도 move result document에서 파생한 snapshot을 우선 사용한다.
- Phase 3 보강 slice로 `useCanvasDragDropHelpers`의 descendant/container/insertion
  계산이 store `childrenMap` 직접 조회 대신 hook 입력 `elements`에서 파생한
  read-only children map을 사용한다.
- Phase 3 보강 slice로 `useCanvasElementSelectionHandlers`의 interactive map provider를
  필수 입력으로 고정하고, selection hot path의 stale `state.elementsMap`/
  `state.childrenMap` fallback을 제거했다.
- Phase 2/3/4 보강 slice로 `useTextEdit` live text edit가 active
  `canonicalElementSnapshot` helper 대신 canonical document traversal로 편집 element를
  찾고, store `elementsMap` 직접 패치 대신 canonical mutation wrapper를 우선
  통과하도록 전환했다. legacy store patch는 canonical hydration 전 bootstrap
  fallback으로만 남겼다.
- Phase 3 보강 slice로 Skia hover interaction이 `rendererInput`에서 파생한
  canonical-derived `elementsMap`/`childrenMap` provider를 우선 사용한다.
- Phase 3 보강 slice로 Skia hover interaction의 rendererInput map provider를
  필수화하고 hover hot path의 stale `state.elementsMap`/`state.childrenMap`
  fallback을 제거했다.
- Phase 3 보강 slice로 Skia scroll wheel hit-test가 `rendererInput`에서 파생한
  `elementsMap` provider를 사용하도록 전환하고 direct store map read를 제거했다.
- Phase 3 보강 slice로 `StoreRenderBridge` 재동기화를 store map identity
  subscription 대신 `rendererInput` 변경 effect와 theme/layout publish boundary에
  묶었다.
- Phase 3 보강 slice로 현재 import되지 않는 legacy retained-mode
  `sceneGraph/*`와 sprite-era `sprites/useResolvedElement.ts` surface를 제거하고
  재도입 방지 static gate를 추가했다.
- Phase 3 보강 slice로 canvas detach context menu hit target 해석이 stale
  `state.elementsMap` fallback 대신 interactive canonical-derived map만 사용하도록
  좁혔다.
- Phase 2 보강 slice로 `StylesPanel`의 panel type/style read를 direct
  `elementsMap` 구독 대신 canonical selected data hook 기반으로 전환했다.
- Phase 2 보강 slice로 style value hooks가 `useElementStyleContext`를 공유하고,
  해당 context 자체도 canonical property element hook을 사용하도록 전환했다.
  fill/transform read의 selected `elementsMap` 직접 조회는 제거됐다.
- Phase 2 보강 slice로 `GenericPropertyEditor`와 `ChildItemManager`의 generic
  property read가 canonical element/children을 우선 사용하고 legacy map은
  fallback으로만 남도록 정렬했다.
- Phase 2/4 보강 slice로 generic `ItemsManager`와 style `useResetStyles`/
  `useTransformAuxiliary` read도 canonical property element hook 기반으로 전환하고,
  reset action의 selected element lookup은 canonical document traversal을 직접
  사용한다. per-hook direct
  `elementsMap`/`childrenMap` selected read도 제거했다.
- Phase 2 보강 slice로 `useCanonicalPropertyRead` hook을 추가하고
  `ColumnEditor`/`CellEditor`/`RowEditor`/`TagEditor`가 canonical property
  element/children read를 우선 사용하도록 전환했다.
- Phase 2 보강 slice로 `ListBoxItemEditor`/`TreeItemEditor`/`TableBodyEditor`/
  `TableHeaderEditor`도 canonical property element/children map read hook을
  사용하도록 전환했다.
- Phase 2 보강 slice로 `TableEditor`가 canonical-derived element/children map을
  우선 사용하도록 전환했다.
- Phase 2 보강 slice로 Breadcrumb/DataTable/GridListItem/ColumnGroup/LayoutBody/
  PageBody editor의 단일 element read를 canonical property element hook으로
  전환했다.
- Phase 2 보강 slice로 ElementSlotSelector/ListBoxPropertyEditor/SliderEditor의
  specialized read도 canonical property element/map hook으로 전환하고, store는
  mutation action 호출에만 남기도록 좁혔다.
- Phase 2 보강 slice로 SliderEditor 전용 child sync가 canonical property maps를
  직접 사용하도록 전환하고, 미사용 `useSyncChildProp`/`useSyncGrandchildProp`
  legacy hooks와 barrel export를 제거했다.
- Phase 2 보강 slice로 ComponentSemanticsSection/FrameSlotSection/
  ComponentSlotFillSection의 section-level element/map read도 canonical property
  hook으로 전환하고, slot insertion 테스트의 stale `order_num` 기대를 제거했다.
- Phase 2 보강 slice로 LayoutPresetSelector/usePresetApply의 slot/body read도
  canonical property element/map hook으로 전환하고, replace handler 내부
  `useStore.getState().elementsMap` 조회를 제거했다.
- Phase 2 보강 slice로 PropertiesPanel 본체의 editor update baseline, multi-select
  copy/paste/group/align/distribute 계산, slot change read도 canonical-derived map
  hook을 사용하도록 전환했다.
- Phase 3 보강 slice로 central pointer handler가 interactive canonical map provider
  누락 시 legacy `state.elementsMap`/`state.childrenMap`으로 fallback하지 않도록
  제한했다.
- Phase 3 보강 slice로 drop target resolver와 drag bridge의 drag/drop context를
  `DropTargetReadModel`/`DragReadModel` read-only 계약으로 분리하고
  `elementsById`/`childrenByParent` 명칭으로 전환했다.
- Phase 3 보강 slice로 shared `RenderContext`의 legacy `elementsMap`/`childrenMap`
  contract를 `ReadonlyMap` 기반 `elementsById`/`childrenByParent` read model로
  전환하고, Preview가 canonical-resolved tree에서 이 context를 주입하도록 정렬했다.
- Phase 2/4 보강 slice로 `BuilderCore`/`PagesSection` page-shell reverse bridge와
  canonical mutation registration snapshot 입력을 active canonical document 기반으로
  좁혔다. `BuilderCore` registration/page-shell bridge와 `PagesSection`
  page-delete bridge는 canonical document traversal을 직접 사용하고, legacy store
  elements는 canonical document 부재 시 bootstrap fallback으로만 남긴다.
- Phase 2/4 보강 slice로 `pageFrameBinding`의 page body 보존 입력도 active
  canonical document를 직접 traversal하고, legacy map은 canonical document에 없는
  항목 보강용으로만 병합하도록 좁혔다.
- Phase 2/4 보강 slice로 `frameLayoutCascade`의 unused reusable frame duplicate
  helper와 그 안의 `exportLegacyDocument(doc)` projection을 제거하고 static gate를
  추가했다.
- Phase 2/4 보강 slice로 `BuilderCore` transition `recoverElementsSnapshot`
  subscriber의 direct `canonicalDocumentToElements(doc)` projection과 active snapshot
  helper 경유를 제거하고 active canonical document traversal 입력으로 좁혔다.
- Phase 2/4 보강 slice로 `BuilderCore` 내부의 live `recoverElementsSnapshot`
  subscriber를 `canonicalLegacyStoreCacheBridge` transition boundary로 격리하고,
  `BuilderCore`에 legacy cache recovery 직접 호출이 재도입되지 않도록 static gate를
  추가했다.
- Phase 2/4 보강 slice로 frame element loader, LayoutPreset slot replace,
  drag/drop history payload의 direct `canonicalDocumentToElements(...)` projection을
  먼저 helper boundary로 격리한 뒤, 후속 slice에서 `visitCanonicalDocumentElements`
  직접 traversal로 전환했다. document-input
  `getCanonicalElementsSnapshotFromDocument` export와 active snapshot helper 파일은
  제거했다.
- Phase 2/4 보강 slice로 History undo/redo/goToHistoryIndex 이후 cloud compatibility
  upsert map이 active canonical document traversal을 우선 사용하고 legacy store
  elements는 canonical document 부재 시 fallback으로만 남도록 좁혔다. Redo props/batch
  update lookup도 같은 traversal helper를 사용해 direct `get().elementsMap` read를
  제거했다.
- Phase 2/4 보강 slice로 AI tool read path가 `getAiToolReadModel()` 내부에서
  active canonical document를 직접 traversal하고, 개별 tool에서 direct
  `elementsMap`/`childrenMap` read를 하지 않도록 static gate를 추가했다.
- Phase 2/4 보강 slice로 Selection overlay의 body 판정과 PropertyCustomId
  validation도 active `canonicalElementSnapshot` helper 대신 canonical document
  traversal을 직접 사용하도록 좁히고 direct `elementsMap` lookup을 제거했다.
- Phase 2/4 follow-up slice로 `ComponentsPanel` add path와 `PropertyCustomId`
  validation이 active canonical document/element list를 직접 사용하도록 좁혔다.
  `TreeItemEditor` customId 생성, `FramesTab` hydration fallback,
  `useComponentMemory` monitor analysis, `BuilderCanvas` Skia fallback subscription은
  canonical source가 있을 때 legacy `state.elements` 구독을 empty bootstrap
  fallback으로 고정한다.
- Phase 2/4 follow-up slice로 unified store의 exported
  `useElements`/`useElementById`/`useChildElements` hook을 canonical-first로 전환하고,
  standalone `elements.ts`의 미사용 중복 lookup hook surface를 제거했다.
  direct legacy `state.elements` grep은 74에서 70으로 감소했다.
- Phase 2/4 follow-up slice로 `canvasStore.useCanvasElements`도 active canonical
  elements에서 current page elements를 파생하고, legacy `pageElementsSnapshot`은
  canonical 비활성 bootstrap fallback으로만 사용하도록 좁혔다.
- Phase 2/4 follow-up slice로 `useCurrentPageElements`/
  `useCurrentPageElementCount`도 unified canonical-first `useElements()` source를
  사용하도록 전환하고, standalone `elements.ts`의 미사용 current page selector
  surface를 제거했다.
- Phase 2/4 follow-up slice로 `elementLoader`의 lazy-loading disabled/already-loaded/
  loading-wait read path와 page activation invariant lookup을 active canonical document
  우선으로 전환했다. legacy `elements[]`는 canonical document가 없을 때의 bootstrap
  fallback으로만 남는다.
- Phase 2/4 follow-up slice로 `inspectorActions` resolved lookup은 active canonical
  document가 있으면 mutable legacy fallback과 병합하지 않는다. selected/style/fill
  commit·preview lookup은 canonical traversal을 우선 사용하고, fallback iterable은
  canonical document 부재 시에만 소비한다.
- Phase 2/3/4 follow-up slice로 `useTextEdit`는 active canonical document가 있으면
  missing element도 canonical 결과로 처리해 legacy cache로 되살리지 않는다. live text
  mutation이 canonical wrapper에서 unchanged로 끝나도 active canonical document가 있으면
  legacy store patch를 수행하지 않는다.
- Phase 2/4 follow-up slice로 `PagesSection` page-delete bridge는 삭제 후 최신 store
  snapshot을 fallback으로 사용하되 active canonical document traversal을 우선한다.
- Phase 3/4 follow-up slice로 `useIframeMessenger` selection echo와 preview-generated
  dedupe도 active canonical document가 있으면 missing element/id를 legacy cache에서
  되살리지 않는다. `UPDATE_ELEMENTS` bootstrap은 canonical document가 없을 때만 legacy
  snapshot을 읽는다.
- Phase 2/4 follow-up slice로 `useResetStyles` reset action도 active canonical document가
  있으면 missing selected element를 legacy cache에서 되살리지 않는다.
- Phase 2 follow-up slice로 `useSelectedElementData` legacy mode selected/ref override
  props lookup은 이미 읽은 selected element를 재사용하고, 같은 id를 store `elements[]`에서
  다시 찾지 않는다.
- Phase 2/4 follow-up slice로 `BuilderCore` mutation registration/page-shell bridge
  fallback도 `getCanonicalOrBootstrapBuilderElements()` helper로 격리해 canonical-first
  bootstrap boundary를 명시했다.
- Phase 2/4 follow-up slice로 `elementUpdate`/`elementRemoval`/`instanceActions`/
  `elements`/`historyActions` mutation-history source를 active canonical document
  elements 우선으로 전환했다. legacy store `elements[]`는 canonical document 부재 시의
  bootstrap fallback으로만 남는다.
- Phase 4 follow-up slice로 `canonicalLegacyStoreCacheBridge`와 store
  `recoverElementsSnapshot` action surface를 제거했다. active canonical document 변경 후
  legacy store cache를 되살리는 transition subscriber production hit는 0건이다.
- Phase 4 follow-up slice로 History undo/redo/goToHistoryIndex가
  `historyManager.addDiffEntry()`/`addBatchDiffEntry()`에서 생성한 serialized
  `data.diff`/`data.diffs` event payload를 snapshot payload보다 먼저 적용한다.
  canonical document sync를 index rebuild보다 먼저 수행해 active canonical document와
  store `elementsMap`이 같은 diff 결과를 보도록 고정했다.
  이번 follow-up 후 raw seed는 462로 유지되고 direct legacy `state.elements` grep은
  70에서 0으로 감소했다.
- Phase 4 follow-up slice로 `setElementsCanonicalPrimary()` full-replace shell이
  incoming element children만 비우고 omitted page-owned runtime sibling을 남기던
  persistence drift를 수정했다. page/layout shell과 structural `body` node는 유지하되,
  full snapshot에 없는 legacy-exportable runtime node를 canonical shell에서 prune한다.
  `remove -> undo -> redo -> reload` runtime smoke에서 삭제된 `button-2`가
  `db.documents`와 store 양쪽에서 되살아나지 않음을 확인했다.
- Phase 5 stale gate 첫 slice로 ADR-119/120/121 이후 기준에 맞춰 stale
  `order_num`/strict grep/static string tests를 정렬했다.
- Phase 5 추가 slice로 BuilderCore의 no-op `useValidation`/`validateOrderNumbers`
  path를 제거해 page change마다 legacy `state.elements`를 읽던 dead order validation
  surface를 삭제했다.
- Phase 5 추가 slice로 dormant `shadowWriteDiff`의 canonical→legacy export
  convenience wrapper를 제거하고, shadow-write evaluator가 compatibility
  boundary에서 명시적으로 받은 legacy snapshot만 비교하도록 좁혔다.
- Phase 4/G4 승인 후속 slice로 History add/remove/group/ungroup payload를
  legacy `data.element`/`childElements`/`elements`/`prevElements` snapshot 대신
  canonical `canonicalEvents` insert/remove/move sequence로 기록하고
  undo/redo/goToHistoryIndex가 active canonical document에 직접 replay하도록
  전환했다. 이 과정에서 실제 page body parent(`legacy-page -> body`) 아래 생성되는
  element가 History add entry를 누락하던 원인도 parent ancestor page/reusable context
  판정으로 수정했다.

검증:

- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__`
  — 19 files / 217 tests PASS.
- `pnpm -F @composition/shared exec vitest run src/utils`
  — 5 files / 54 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/main/BuilderCore.static.test.ts`
  — 2 files / 10 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/LayersSection.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx`
  — 2 files / 12 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts`
  — 2 files / 8 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.test.ts src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.static.test.ts`
  — 2 files / 4 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.static.test.ts`
  — 2 files / 6 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts`
  — 3 files / 21 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/interaction/canvasContextMenu.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/panels/styles/StylesPanel.static.test.ts src/builder/panels/styles/hooks/styleReadCanonical.static.test.ts src/builder/panels/styles/hooks/useFillActions.test.tsx src/builder/panels/styles/hooks/useTransformAuxiliary.test.tsx src/builder/panels/properties/generic/genericEditorCanonical.static.test.ts`
  — covered in targeted builder regression batch, 20 files / 83 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/canonicalPropertyEditors.static.test.ts`
  — 1 file / 3 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/panels/properties/FrameSlotSection.test.tsx src/builder/panels/properties/ComponentSlotFillSection.test.tsx`
  — 3 files / 29 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts`
  — 1 file / 4 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.static.test.ts`
  — 1 file / 2 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/selection/dropTargetResolver.test.ts src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts`
  — 3 files / 21 tests PASS.
- `pnpm -F @composition/shared exec vitest run src/renderers`
  — 4 files / 37 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts`
  — 1 file / 4 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts src/builder/main/canonicalLegacyStoreCacheBridge.static.test.ts`
  — canonical legacy cache bridge initial quarantine slice, 2 files / 5 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts`
  — Preview-generated element dedupe direct traversal slice, 1 file / 8 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/overlay/useTextEdit.static.test.ts src/builder/panels/styles/hooks/styleReadCanonical.static.test.ts`
  — Text edit + reset style direct traversal slice, 2 files / 5 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/useDeltaMessenger.static.test.ts`
  — Delta messenger canonical count slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/utils/performanceMonitor.static.test.ts`
  — Performance monitor direct traversal count slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/monitor/hooks/useComponentMemory.static.test.ts`
  — Monitor component memory canonical read slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/hooks/useCanonicalPropertyRead.static.test.ts src/builder/panels/properties/editors/canonicalPropertyEditors.static.test.ts`
  — Canonical property read fallback slice, 2 files / 4 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/useCollectionItemManager.static.test.ts`
  — Collection item manager canonical children read slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canvasStore.static.test.ts`
  — Canvas selected element canonical read slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx`
  — LayerTree canonical resolution fallback slice, 1 file / 11 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts src/builder/main/canonicalLegacyStoreCacheBridge.static.test.ts`
  — BuilderCore direct traversal fallback slice, 2 files / 5 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts src/builder/main/canonicalLegacyStoreCacheBridge.static.test.ts`
  — BuilderCore no-op order validation cleanup slice, 2 files / 5 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts`
  — BuilderCanvas store map fallback slice, 3 files / 14 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx`
  — Selected element data direct traversal fallback slice, 1 file / 5 tests PASS.
- `pnpm run codex:typecheck`
  — exported lookup selector cleanup slice, 3 packages PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameLayoutCascade.static.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts`
  — Frame layout cascade deleted-id fallback slice, 2 files / 10 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/inspectorActions.static.test.ts src/builder/stores/__tests__/inspectorFills.test.ts`
  — Inspector lookup fallback slice, 2 files / 11 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/inspectorActions.static.test.ts`
  — Inspector direct traversal fallback slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/elementLoader.static.test.ts`
  — Element loader page elements fallback slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/selection.static.test.ts`
  — Selection hierarchy direct traversal lookup slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementRemoval.static.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts`
  — Element removal target collection slice, 2 files / 4 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/instanceActions.static.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts`
  — Instance action lookup/children slice, 2 files / 23 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementUpdate.static.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts`
  — Element update pre-read/dirty traversal slice, 3 files / 21 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/itemsActions.test.ts`
  — Elements items/Menu action lookup slice, 1 file / 8 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/services/ai/tools/canonicalToolReadModel.static.test.ts src/builder/components/property/PropertyCustomId.test.tsx`
  — AI tool read model + PropertyCustomId direct traversal slice, 2 files / 9
  tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/PagesSection.test.tsx`
  — PagesSection page-delete bridge direct traversal slice, 1 file / 5 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.static.test.ts`
  — History direct traversal compatibility sync slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/generic/genericEditorCanonical.static.test.ts src/builder/panels/styles/hooks/styleReadCanonical.static.test.ts src/builder/panels/styles/hooks/useResetStyles.test.tsx src/builder/panels/styles/hooks/useTransformAuxiliary.test.tsx`
  — 4 files / 36 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts`
  — Skia scene pageIndex canonical-derived slice, 3 files / 14 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts`
  — 2 files / 7 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts`
  — 2 files / 15 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useScrollWheelInteraction.static.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts`
  — 2 files / 4 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/legacyCanvasSurfaces.static.test.ts src/builder/workspace/canvas/hooks/useScrollWheelInteraction.static.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts`
  — 5 files / 57 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/g6ParityCompletion.static.test.ts`
  — PageFrameBinding direct traversal input slice, 2 files / 7 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/hooks/useTreeExpandState.static.test.ts`
  — 2 files / 15 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx`
  — FramesTab hydration fallback derived-map slice, 2 files / 20 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameLayoutCascade.static.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts`
  — 2 files / 10 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/persistenceWriteThroughStub.test.ts`
  — 1 file / 21 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameElementLoader.test.ts src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts`
  — 4 files / 17 tests PASS. Superseded by later active snapshot helper removal.
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts`
  — 1 file / 7 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts`
  — Preview inbound recovery removal + project hydrate boundary slice, 2 files / 17 tests PASS.
- `pnpm -F @composition/shared exec vitest run src/renderers/__tests__/collectionRendererCanonicalContract.test.ts`
  — shared renderer legacy `UPDATE_ELEMENTS` snapshot send removal slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/services/messaging.canonical.static.test.ts`
  — legacy messaging full-snapshot facade removal slice, 1 file / 1 test PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/exportSsotGrepGate.test.ts`
  — stale G4 allowlist/comment cleanup slice, 1 file / 2 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/builder/workspace/canvas/scene/canonicalSceneModel.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts`
  — Skia canonical scene model direct traversal slice, 5 files / 34 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameElementLoader.test.ts src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/builder/workspace/canvas/scene/canonicalSceneModel.test.ts`
  — active snapshot helper removal + direct traversal cleanup slice, 6 files / 38
  tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/canonicalPropertyEditors.static.test.ts`
  — 1 file / 3 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/components/property/PropertyCustomId.test.tsx src/builder/panels/components/ComponentsPanel.projection.static.test.ts src/builder/panels/properties/editors/canonicalPropertyEditors.static.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/monitor/hooks/useComponentMemory.static.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts`
  — 6 files / 17 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx`
  — 1 file / 6 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canvasStore.static.test.ts`
  — 1 file / 2 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx`
  — 1 file / 7 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/elementLoader.static.test.ts src/builder/stores/inspectorActions.static.test.ts src/builder/workspace/overlay/useTextEdit.static.test.ts`
  — 3 files / 3 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/PagesSection.test.tsx`
  — follow-up page delete bridge fallback slice, 1 file / 5 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementUpdate.static.test.ts src/builder/stores/utils/__tests__/elementRemoval.static.test.ts src/builder/stores/utils/__tests__/instanceActions.static.test.ts src/builder/stores/utils/__tests__/elementUpdate.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts`
  — mutation source canonical-first slice, 5 files / 28 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/pageRemovalSemantics.test.ts src/builder/stores/__tests__/pageActivation.test.ts src/builder/stores/__tests__/itemsActions.test.ts src/builder/stores/index.test.tsx src/builder/stores/__tests__/elementMove.test.ts`
  — store source canonical-first slice, 5 files / 29 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/main/canonicalLegacyStoreCacheBridge.static.test.ts src/builder/main/BuilderCore.static.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/stores/index.test.tsx`
  — recover bridge removal slice, 4 files / 21 tests PASS.
- grep gates: `canonicalMutations` legacy write-back 0 hits, canvas helper/context
  menu stale map fallback 0 hits, specialized editor direct legacy map lookup
  0 hits, PropertiesPanel direct store map read 0 hits, central pointer legacy
  map fallback 0 hits, drag/drop resolver legacy map contract 0 hits, raw seed
  462 hits.
- direct legacy `state.elements` grep: 70 -> 0 hits after the elementLoader,
  inspectorActions, text edit, PagesSection, useIframeMessenger, useResetStyles,
  useSelectedElementData/BuilderCore, mutation source, history source,
  direct-fallback cleanup, and `recoverElementsSnapshot` removal follow-up slices.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts`
  — History diff/event undo-redo slice, 2 files / 3 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/canonicalMutations.test.ts`
  — full-replace omitted sibling prune regression, 1 file / 23 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts`
  — History diff/event follow-up after full-replace prune, 2 files / 3 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts src/builder/stores/utils/__tests__/historyHelpers.test.ts`
  — History canonical node event schema slice, 5 files / 28 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/adr113DescendantsGrepGate.test.ts src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts src/builder/stores/utils/__tests__/historyHelpers.test.ts src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts`
  — ADR-113/116 grep gate recovery slice, 5 files / 17 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts`
  — realistic legacy-page body parent add-history regression, 1 file / 17 tests PASS
  after RED failure confirmation.
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/useDeltaMessenger.static.test.ts src/builder/hooks/useCollectionItemManager.static.test.ts src/builder/panels/properties/hooks/useCanonicalPropertyRead.static.test.ts src/builder/utils/performanceMonitor.static.test.ts src/builder/stores/canvasStore.static.test.ts src/builder/panels/monitor/hooks/useComponentMemory.static.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/stores/index.test.tsx src/builder/stores/selection.static.test.ts src/builder/stores/history/historyActions.static.test.ts src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/utils/__tests__/elementUpdate.static.test.ts src/builder/stores/utils/__tests__/elementRemoval.static.test.ts src/builder/stores/utils/__tests__/instanceActions.static.test.ts`
  — direct fallback/static gate suite, 16 files / 43 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementUpdate.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts src/builder/stores/__tests__/pageRemovalSemantics.test.ts src/builder/stores/__tests__/pageActivation.test.ts src/builder/stores/__tests__/itemsActions.test.ts src/builder/stores/index.test.tsx src/builder/stores/__tests__/elementMove.test.ts src/builder/main/canonicalLegacyStoreCacheBridge.static.test.ts src/builder/main/BuilderCore.static.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts`
  — runtime targeted suite, 11 files / 86 tests PASS.
- `pnpm run codex:typecheck` — 3 packages PASS.
- grep gates: direct legacy `state.elements` 0, raw seed 462,
  `recoverElementsSnapshot`/bridge subscriber production hits 0.
- `pnpm run codex:preflight` — PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__ src/builder/stores/canonical`
  — exact G6 builder verification, 25 files / 311 tests PASS after moving
  History canonical event ref override traversal and frame mirror lookup behind
  canonical helper boundaries.
- `pnpm -F @composition/shared exec vitest run src/utils` — exact G6 shared
  verification, 5 files / 54 tests PASS.
- grep gate: `getCanonicalElementsSnapshotFromDocument` production hits 0.
- `git diff --check` — PASS.
- `pnpm run codex:typecheck` — 3 packages PASS.
- Browser runtime smoke — seeded local IndexedDB `composition.documents`, performed
  `updateElementProps -> addElement(button-2) -> removeElement(button-2) -> undo -> redo -> reload`.
  Before and after reload, store elements = `["button-1"]` and document ids =
  `["page-1", "button-1"]`; IndexedDB stores remained
  `api_endpoints`, `data_tables`, `design_themes`, `design_tokens`, `documents`,
  `projects`, `transformers`, `variables`. Screenshot:
  `/tmp/adr122-runtime-smoke-after-fix.png`. Expected fake-auth 401 and WebGL
  ReadPixels warnings only.

Compatibility note: History/Undo는 serialized diff/event payload와 add/remove/group/ungroup
canonical node event payload를 canonical-first source에 적용하는 경로까지 land했다.
legacy `element`/`childElements`/`elements`/`prevElements` snapshot fields는
기존 IndexedDB history entry, update/batch fallback, auto-detach batch 같은
compatibility/fallback 경계를 위해 타입 surface에 남아 있다.
`recoverElementsSnapshot` subscriber와 store action은 production surface에서 제거됐고,
active `canonicalElementSnapshot` helper production consumer와 helper 파일도 제거됐다.
targeted remove/redo/reload 및 realistic add/remove History event browser smoke는 PASS했다.
2026-05-09 follow-up으로 `BuilderCore` page-shell bridge가 새 page body shell을
보존하고 삭제된 origin page snapshot을 되살리지 않도록 보강했으며,
`useIframeMessenger`는 runtime Compare Mode에서도 canonical document를 Preview로
보내도록 고정했다. Preview `App`은 legacy preview `elements[]`가 비어 있어도
수신한 canonical document가 있으면 canonical tree를 렌더링한다.
Full Phase 6 browser smoke는 page/body/element 생성 후 reload persistence,
sibling reorder, cross-page reparent, slot fill reorder, cross-page
`Go to component`/`Select instances` selection, origin page delete 후 instance
materialization, reload persistence, Preview canonical DOM render, Skia canvas
presence, IndexedDB `documents` primary 및 local `pages`/`elements`/`layouts`
objectStore 부재를 PASS했다. `pnpm run codex:preflight`도 PASS했다. exact G6
builder/shared commands도 PASS했다. Closure audit 중 History canonical event helper의
direct `descendants` / `layout_id` access가 ADR-113/116 grep gate를 깨는 것을 발견해
canonical helper boundary로 이동했다. 이어서 add/update/remove store helper의
cache-first mutation 순서를 canonical-before-cache로 전환하고 targeted/static guard를
추가했다. final verification rerun 후 ADR-122를 Implemented로 전환했다.

## Consequences

### Positive

- Builder runtime source가 `CompositionDocument` 하나로 수렴한다.
- ADR-116의 "storage primary"와 실제 runtime mutation/read source 사이의 hybrid gap을 닫는다.
- `order_num`과 legacy `Element[]` mirror drift가 mutation path에서 재발할 가능성을 낮춘다.
- Preview/Skia/Properties/LayerTree의 canonical parity를 명시 gate로 검증할 수 있다.

### Negative

- Skia, Preview, Properties, LayerTree, History, drag/drop까지 걸치는 대형 전환이다.
- 기존 `Element` shape 기반 test fixture와 static grep gate를 광범위하게 갱신해야 한다.
- cloud/export/import compatibility boundary는 당분간 남으므로 repo-wide legacy string 0건은
  이 ADR의 완료 조건이 아니다.
- canonical selectors/resolver 성능 설계가 부족하면 projection 제거 후에도 다른 형태의
  full traversal 비용이 생길 수 있다.
