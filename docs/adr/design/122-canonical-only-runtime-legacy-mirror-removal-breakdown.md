# ADR-122 구현 상세 — Canonical-only runtime 전환 및 legacy mirror 제거

본 문서는 [ADR-122](../completed/122-canonical-only-runtime-legacy-mirror-removal.md)의 phase plan,
inventory, gate 측정 방법을 정의한다. Phase 0 inventory freeze는
[122-canonical-only-runtime-legacy-mirror-removal-inventory.md](122-canonical-only-runtime-legacy-mirror-removal-inventory.md)에
기록한다. 핵심은 local persistence cleanup이 아니라
runtime data source cleanup이다. `CompositionDocument`를 저장 primary로만 쓰는 상태에서
벗어나 Builder mutation/read/render/preview path가 canonical document를 직접 소비하도록
전환한다.

## 1. Target State

| Layer                | Target                                                              | 금지 대상                                                                            |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Mutation             | canonical document patch/command가 primary write path               | canonical write 후 legacy `setElements(exportLegacyDocument(doc))` mirror write-back |
| Store read           | canonical selectors, canonical node lookup, resolved canonical tree | mutable `elementsMap`/`childrenMap` authoritative read                               |
| Skia                 | canonical scene snapshot 또는 resolved canonical tree input         | render 직전 `canonicalDocumentToElements()` full projection                          |
| Preview              | `UPDATE_CANONICAL_DOCUMENT` active channel                          | active render channel의 `UPDATE_ELEMENTS` 의존                                       |
| LayerTree/Properties | canonical node/path/alias 기반 view model                           | legacy `Element` shape를 primary selected/read model로 사용                          |
| Boundary             | cloud/export/import/publish compatibility adapter                   | Builder hot path에서 `exportLegacyDocument()` 호출                                   |

## 2. Current Hybrid Inventory Seed

Phase 0에서 아래 seed를 실제 코드 기준으로 재측정하고 bucket을 확정한다.

| Surface                                                                             | 현재 의미                                                                      | 목표 bucket                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------- |
| `apps/builder/src/adapters/canonical/canonicalMutations.ts`                         | canonical store update 후 legacy mirror `setElements()` write-back             | runtime 제거                     |
| `apps/builder/src/adapters/canonical/exportLegacyDocument.ts`                       | canonical → legacy `Element[]` compat payload 생성                             | boundary allowlist               |
| `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts`                | canonical document를 legacy `Element[]` view로 projection                      | transition-only, hot path 제거   |
| `apps/builder/src/builder/main/BuilderCore.tsx`                                     | canonical store subscribe 후 `canonicalDocumentToElements()`로 Preview publish | active protocol 전환             |
| `apps/builder/src/builder/hooks/useIframeMessenger.ts`                              | `UPDATE_ELEMENTS`와 `UPDATE_CANONICAL_DOCUMENT` 병행                           | canonical active channel         |
| `apps/builder/src/preview/messaging/messageHandler.ts`                              | preview가 legacy/canonical message를 모두 수신                                 | canonical primary, legacy compat |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`                       | active doc을 `canonicalDocumentToElements()`로 Skia input화                    | canonical scene snapshot         |
| `apps/builder/src/builder/stores/index.ts::useSelectedElementData`                  | canonical selected element 우선 + legacy fallback                              | canonical selected node model    |
| `apps/builder/src/builder/panels/properties/**`                                     | 여러 editor가 `useStore.getState().elementsMap`을 직접 조회                    | canonical selection/node helpers |
| `apps/builder/src/adapters/canonical/frameLayoutCascade.ts` / `pageFrameBinding.ts` | canonical update 후 legacy mirror export를 일부 caller에 전달                  | canonical-only command result    |
| `apps/builder/src/utils/projectSync.ts`                                             | Supabase compatibility row projection                                          | boundary allowlist               |
| `packages/shared/src/utils/export.utils.ts`                                         | project export/publish compatibility                                           | boundary allowlist               |

Inventory command seed:

```bash
rg -n "exportLegacyDocument\\(|canonicalDocumentToElements\\(|UPDATE_ELEMENTS|UPDATE_CANONICAL_DOCUMENT|useStore\\.getState\\(\\)\\.elementsMap|state\\.elementsMap|childrenMap|setElements\\(" \
  apps/builder/src packages/shared/src apps/publish/src \
  -g '*.ts' -g '*.tsx'
```

## 3. Phase Plan

| Phase   | Goal                              | Main output                                        | Gate | Status                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | --------------------------------- | -------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 | hybrid inventory freeze           | allowlist + forbidden runtime bucket               | G0   | Complete — inventory bucket classified and closure audit updated                                                                                                                                                                                                                                                                                                                                      |
| Phase 1 | mutation mirror 제거              | canonical command wrappers, no legacy write-back   | G1   | Complete — `canonicalMutations` wrapper write-back 0 and add/update/remove store helpers now canonical-before-cache                                                                                                                                                                                                                                                                                   |
| Phase 2 | runtime read canonicalization     | Properties/LayerTree/History/Skia read source 전환 | G2   | Slices complete — selected fallback cut, LayerTree stale map 차단, drag read map 전환                                                                                                                                                                                                                                                                                                                 |
| Phase 3 | Preview/Skia active protocol 전환 | canonical document/scene channel primary           | G3   | Slices complete — Preview active canonical sync, Skia canonical scene model, drag/drop/selection/shared renderer read-model maps, legacy canvas surface cleanup                                                                                                                                                                                                                                       |
| Phase 4 | legacy boundary quarantine        | export/import/cloud/publish allowlist only         | G4   | Closure slices landed — Preview inbound recovery, unused full-snapshot messaging cleanup, mutation/history canonical-first source, History diff/event undo-redo, add/remove/group canonical node events, `recoverElementsSnapshot` removal, direct legacy `state.elements` 70→0, full-replace prune/runtime smoke, page-shell bridge preservation, and deleted-page anti-resurrection slices complete |
| Phase 5 | stale tests/gates 재정렬          | ADR-116/118/119/120/121 aligned test suite         | G5   | Complete — stale gates realigned; ADR-113/116 grep gate recovery PASS                                                                                                                                                                                                                                                                                                                                 |
| Phase 6 | final verification                | browser smoke + preflight + docs/rules sync        | G6   | Complete — exact builder/shared G6 commands PASS, full browser checklist PASS, docs/rules sync updated, `pnpm run codex:preflight` PASS, ADR Implemented archive complete                                                                                                                                                                                                                             |

Current execution snapshot (2026-05-09):

- Current phase: Implemented archive complete.
- Progress estimate: implementation 100%, formal gate closure 100%.
- Latest closed slice: page-shell bridge preservation/deleted-page
  anti-resurrection, Runtime Compare Mode canonical Preview sync, Preview
  canonical-empty render guard, ADR-113/116 grep gate recovery,
  add/update/remove store helper canonical-before-cache closure, and full Phase 6
  browser checklist smoke.
- Current blocker/next entry: none for ADR-122; future cloud/Supabase physical
  schema removal remains outside this ADR.
- Latest verification: `pnpm run codex:preflight` PASS.
  Exact G6 commands also PASS:
  `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__ src/builder/stores/canonical`
  and `pnpm -F @composition/shared exec vitest run src/utils`.

## 4. Phase 0 — Hybrid Inventory Freeze

작업:

1. inventory seed command를 실행해 모든 hit를 bucket으로 분류한다.
2. bucket은 `runtime-forbidden`, `transition-derived-readonly`, `boundary-allowed`,
   `test-doc` 네 가지로 제한한다.
3. `transition-derived-readonly`는 phase와 owner를 반드시 갖는다. owner 없는 derived view는
   `runtime-forbidden`으로 분류한다.
4. ADR-116 canonical adapter test fail을 ADR-119 이후 stale contract와 실제 regression
   후보로 나눈다.

검증:

```bash
pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__
rg -n "order_num|metadata\\.order_num|canonicalDocumentToElements\\(|exportLegacyDocument\\(" \
  apps/builder/src packages/shared/src apps/publish/src docs/adr
```

완료 조건:

- 모든 hit에 bucket/owner/target phase가 있다.
- `children[]` order regression 후보는 stale `order_num` assertion과 분리되어 있다.
- Phase 1 착수 전 금지 runtime bucket이 명확하다.

2026-05-08 진행:

- raw seed 607 hit를 inventory 문서에 bucket rule과 target phase로 분류했고,
  latest cleanup 후 current raw seed는 462 hit다.
- 초기 runtime-forbidden bucket은 Skia scene snapshot과 Builder store mutation facade로
  고정했고, closure audit에서 canonical scene model 및 canonical-before-cache store
  helper ordering으로 닫았다.
- transition-derived Builder canonical-derived store cache bridge는 제거했다.

## 5. Phase 1 — Mutation Mirror 제거

작업:

1. `canonicalMutations` in-memory wrappers에서 legacy `actions.setElements(exportLegacyDocument(doc))`
   write-back을 제거한다.
2. wrapper return type이 legacy `Element[]`를 반환해야 하는 caller를 canonical command result
   또는 void로 전환한다.
3. `moveElementCanonicalPrimary`, `applyElementOrderCanonicalPrimary`는 canonical `children[]`
   splice result를 primary result로 반환한다.
4. `frameLayoutCascade`, `pageFrameBinding`, `elementCreation`, `elementUpdate`,
   `elementRemoval`, `instanceActions`, `historyActions` caller를 canonical command result 기준으로
   정리한다.
5. legacy store mirror가 transition 중 남더라도 canonical store에서 파생되는 read-only cache로
   한정하고 mutation API를 숨긴다.

금지:

- `order_num` 재도입.
- wrapper 내부에서 `legacyToCanonical()` full rebuild를 재도입.
- 실패 시 legacy `setElements()` fallback을 숨겨서 유지.

검증:

```bash
rg -n "actions\\.setElements\\(|setElements\\(exportLegacyDocument|exportLegacyDocument\\(doc\\)" \
  apps/builder/src/adapters/canonical/canonicalMutations.ts
pnpm -F @composition/builder exec vitest run \
  src/adapters/canonical/__tests__/canonicalMutations.test.ts \
  src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts \
  src/builder/stores/utils/__tests__/instanceActions.test.ts
```

2026-05-08 진행:

- `canonicalMutations` wrapper 내부 `actions.setElements(...)`,
  `setElements(exportLegacyDocument(...))`, `exportLegacyDocument(doc)` write-back 0건.
- `frameLayoutCascade`/`pageFrameBinding`의 command result path에서 direct
  `setElements` write-back 제거.
- builder canonical adapter suite 19 files / 217 tests PASS.

## 6. Phase 2 — Runtime Read Canonicalization

작업:

1. `useSelectedElementData`를 legacy `Element` fallback 중심이 아니라 canonical selected node/path
   model로 재정의한다.
2. Properties editor helper는 `elementsMap` 직접 조회 대신 canonical node lookup, resolved ref,
   frame scope helper를 사용한다.
3. LayerTree는 `Element[]` derived view가 아니라 canonical tree view model을 직접 만든다.
4. History/Undo는 legacy element diff가 아니라 canonical patch/event 단위로 기록한다.
5. Skia pre-work로 canonical scene model input contract를 정의한다.

검증:

```bash
rg -n "useStore\\.getState\\(\\)\\.elementsMap|state\\.elementsMap|childrenMap" \
  apps/builder/src/builder/panels apps/builder/src/builder/stores apps/builder/src/builder/workspace \
  -g '*.ts' -g '*.tsx'
pnpm -F @composition/builder exec vitest run \
  src/builder/stores/index.test.tsx \
  src/builder/panels/properties \
  src/builder/panels/nodes/tree
```

2026-05-08 진행:

- `useSelectedElementData`는 active canonical document 존재 시 legacy `elementsMap`
  fallback을 사용하지 않고 selected ref override props fallback도 active canonical
  document를 직접 traversal한다.
- LayerTree/LayersSection은 canonical layer node와 editing context map을 우선 사용해
  stale legacy `elementsMap`이 canonical tree node를 덮어쓰지 않는다.
- `useTreeExpandState`는 store `elementsMap` 구독 없이 caller-provided
  frame/tree elements에서 parent lookup map을 파생한다. FramesTab refresh test도
  canonical frame descendants가 존재하면 mirror merge 없이 canonical view를
  사용하는 계약으로 정렬했다.
- `FramesTab` hydration fallback은 store `elementsMap` 구독 대신 store
  `elements`에서 read-only map을 파생한다. Follow-up으로 active canonical elements가
  있으면 store `elements` subscription도 empty bootstrap fallback으로 고정했다.
- `useIframeMessenger` selection echo는 store `elementsMap` subscription 없이
  active canonical document traversal을 우선 사용한다.
- `useIframeMessenger`의 preview-generated column/field element dedupe도 active
  canonical document traversal을 우선 사용하고 direct store `elementsMap` read를
  사용하지 않는다.
- deprecated `useDeltaMessenger`의 통계용 count는 canonical elements length를
  우선 사용하고 store `elementsMap.size` 구독을 사용하지 않는다. active canonical
  elements가 있을 때 store `elements.length` subscription도 bootstrap fallback으로만
  남긴다.
- `performanceMonitor` element count/store memory estimate는 active canonical document
  traversal count를 우선 사용하고 store `elementsMap.size` count를 사용하지 않는다.
- Monitor `useComponentMemory`는 active canonical elements에서 element/child lookup
  map을 파생하고 store `elementsMap`/`childrenMap` 구독을 사용하지 않는다. Follow-up으로
  active canonical elements가 있으면 store `elements` subscription도 empty bootstrap
  fallback으로 고정했다.
- `useCanonicalPropertyRead` fallback은 store `elementsMap`/`childrenMap` 직접
  구독 대신 store `elements[]`에서 read-only lookup map을 파생한다.
- `useCollectionItemManager` children read는 active canonical elements를 우선
  사용하고 store `childrenMap` 직접 read를 사용하지 않는다.
- `useCanvasSelectedElement` selected element lookup은 active canonical elements
  우선, store `elements[]` fallback으로 수행한다.
- `canvasStore.useCanvasElements` current page elements도 active canonical elements에서
  파생하고, legacy `pageElementsSnapshot`은 canonical 비활성 bootstrap fallback으로만
  사용한다.
- LayerTree resolution fallback은 store `elementsMap` 구독 대신 store `elements[]`
  에서 read-only map을 파생한다.
- `BuilderCore` mutation registration/page-shell bridge fallback은 store
  `elementsMap.values()` 대신 store `elements[]`를 사용한다.
- `BuilderCanvas` Skia input fallback maps는 store map 구독 대신 canonical/store
  `elements[]`에서 파생한다. Follow-up으로 active canonical document가 있으면 store
  `elements` subscription도 empty bootstrap fallback으로 고정했다.
- `useSelectedElementData` legacy-bootstrap fallback은 store `elementsMap`
  get/values 대신 store `elements[]`에서 selected/ref lookup을 수행한다.
- exported `useElementById`/`useChildElements` selectors는 store map direct read
  대신 canonical-first `useElements()` source에서 read-only lookup을 파생한다.
  `useCurrentPageElements`/`useCurrentPageElementCount`도 같은 canonical-first source를
  사용하고, standalone `elements.ts`의 미사용 중복/current-page hook surface는 제거했다.
- `frameLayoutCascade` frame delete removed-id collection은 store
  `elementsMap.values()` 대신 store `elements[]`를 사용한다.
- `inspectorActions` style/fill resolved-read lookup은 active canonical document
  traversal fallback을 사용하고 store `elementsMap`을 전달하지 않으며 bootstrap
  fallback은 store `elements[]` iterable로 제한한다.
- `elementLoader` lazy-load disabled/already-loaded/loading wait read path는 store
  `elementsMap.forEach` 순회 대신 store `elements[]`에서 page elements를 필터링한다.
- Selection hierarchy editing context lookup은 active canonical document traversal에서
  선택에 필요한 최소 element shape를 파생하고 store `elements[]` fallback으로
  parent/child 관계를 계산한다.
- `elementRemoval` 삭제 대상 수집은 caller의 `state.elementsMap`/`state.childrenMap`
  입력을 받지 않고 store `elements[]`에서 read-only lookup을 파생한다.
- `instanceActions` origin/instance lookup, child list, persisted snapshot lookup은
  store map 직접 read 대신 store `elements[]` 기반 helper를 사용한다.
- `elementUpdate` props/batch pre-read와 dirty descendant traversal은 store map direct
  read 대신 store `elements[]`에서 element/children lookup을 파생한다.
- `elements.ts` 일반화 items/Menu 액션은 direct `get().elementsMap.get(...)` 대신
  store `elements[]` lookup helper를 사용한다.
- `useTextEdit` live text edit는 active `canonicalElementSnapshot` helper 대신
  canonical document traversal로 edit element를 찾고 canonical mutation wrapper를
  우선 통과한다. legacy store patch는 canonical hydration 전 bootstrap fallback으로만
  남긴다.
- `StylesPanel` panel-level type/style read는 direct `elementsMap` selector 대신
  canonical selected data hook을 사용한다.
- Style value hooks는 `useElementStyleContext`를 공유하고, 해당 context는
  canonical property element hook을 사용한다. fill/transform read는 direct
  selected `elementsMap` 조회 대신 이 context를 재사용한다.
- Generic property editor와 child item manager는 canonical element/children을
  우선 사용하고 legacy map은 canonical 비활성 fallback으로만 사용한다.
- Generic `ItemsManager`와 style `useResetStyles`/`useTransformAuxiliary`도
  canonical property element hook을 사용한다. `useResetStyles` reset action은 active
  `canonicalElementSnapshot` helper 대신 canonical document traversal을 직접 사용하고,
  per-hook direct selected `elementsMap`/`childrenMap` read를 제거했다.
- `useCanonicalPropertyRead` hook을 추가하고 Column/Cell/Row/Tag editor가
  canonical property element/children read를 우선 사용한다.
- `ComponentsPanel` add path는 active canonical document traversal에서 element list를
  만들고, page/layout 후보 계산에서 legacy `state.elements`/`getPageElements`
  snapshot을 읽지 않는다.
- `PropertyCustomId` validation과 `TreeItemEditor` customId 생성은 canonical-derived
  element source를 우선 사용하고 store `elements`는 canonical 비활성 bootstrap
  fallback으로만 사용한다.
- ListBoxItem/TreeItem/TableBody/TableHeader editor도 같은 canonical property
  read hook으로 전환했다.
- TableEditor도 canonical-derived element/children map helper를 사용한다.
- Breadcrumb/DataTable/GridListItem/ColumnGroup/LayoutBody/PageBody editor의
  단일 element read도 canonical property element hook을 사용한다.
- ElementSlotSelector/ListBoxPropertyEditor/SliderEditor의 specialized read도
  canonical property element/map hook을 사용하고, store는 mutation action 호출에만
  남긴다.
- SliderEditor 전용 child sync는 canonical property maps를 직접 사용하며, 미사용
  `useSyncChildProp`/`useSyncGrandchildProp` legacy hooks와 barrel export를 제거했다.
- ComponentSemanticsSection/FrameSlotSection/ComponentSlotFillSection의 section-level
  element/map read도 canonical property hook을 사용하고, stale `order_num` 테스트
  기대를 제거했다.
- LayoutPresetSelector/usePresetApply의 slot/body read도 canonical property hook을
  사용하고, replace handler 내부 store map 조회를 제거했다.
- PropertiesPanel 본체의 editor update baseline, multi-select copy/paste/group/
  align/distribute 계산, slot change read도 canonical-derived map hook을 사용한다.
- Central pointer handler는 interactive canonical map provider 누락 시 legacy
  store map으로 fallback하지 않는다.
- Drop target resolver와 drag bridge의 drag/drop context는
  `DropTargetReadModel`/`DragReadModel` read-only 계약으로 분리하고
  `elementsById`/`childrenByParent` 명칭을 사용한다.
- drag/drop hot path는 Skia renderer input에서 나온 interactive canonical-derived
  `elementsMap`/`childrenMap`을 우선 사용한다.
- shared `RenderContext`도 `ReadonlyMap` 기반 `elementsById`/`childrenByParent`
  read model로 전환하고, Preview는 canonical-resolved tree에서 이 context를 주입한다.
- `BuilderCore`/`PagesSection` page-shell reverse bridge와 canonical mutation
  registration snapshot 입력은 active canonical document 기반으로 좁혔다.
  `BuilderCore` registration/page-shell bridge와 `PagesSection` page-delete bridge는
  canonical document traversal을 직접 사용하고, legacy `state.elementsMap`/store
  elements는 canonical document 부재 시 bootstrap fallback으로만 남긴다.
- `pageFrameBinding`의 page body 보존 입력은 active canonical document를 직접
  traversal하고 legacy map은 canonical document에 없는 항목 보강용으로만 병합한다.
- `frameLayoutCascade`의 unused reusable frame duplicate helper와 해당 helper의
  `exportLegacyDocument(doc)` projection을 제거하고 static gate를 추가했다.
- `BuilderCore` transition `recoverElementsSnapshot` subscriber는 제거됐다.
  `canonicalLegacyStoreCacheBridge` 파일과 store `recoverElementsSnapshot` action surface도
  삭제했고, production grep 0건으로 고정한다.
- frame element loader, LayoutPreset slot replace, drag/drop history payload의
  direct `canonicalDocumentToElements(...)` projection은 먼저 helper boundary로 이동한 뒤,
  후속 slice에서 `visitCanonicalDocumentElements` 직접 traversal로 전환했다.
  document-input `getCanonicalElementsSnapshotFromDocument` export와 active snapshot
  helper 파일은 제거했다.
- History undo/redo/goToHistoryIndex 이후 cloud compatibility upsert map은 active
  canonical document traversal을 우선 사용하고 legacy store elements는 canonical document
  부재 시 fallback으로만 남긴다. Redo props/batch update lookup도 같은 traversal helper를
  사용해 direct `get().elementsMap` read를 제거했다.
- AI tool read path는 `getAiToolReadModel()` 내부에서 active canonical document를
  직접 traversal하고, 개별 tool의 direct `elementsMap`/`childrenMap` read를 static
  gate로 차단한다.
- Selection overlay body 판정과 PropertyCustomId validation도 active
  `canonicalElementSnapshot` helper 대신 canonical document traversal을 직접 사용해
  direct `elementsMap` lookup을 제거했다.
- Broader History/Undo contract는 canonical-first source로 좁혔고, add/remove/group/
  ungroup payload는 canonical node event sequence로 전환했다. update/batch diff event와
  canonical node events 모두 active canonical document에 먼저 replay된다.
  `recoverElementsSnapshot` transition bridge와 active snapshot helper consumers/file은
  제거됐다.

## 7. Phase 3 — Preview/Skia Active Protocol 전환

작업:

1. Builder → Preview active channel을 `UPDATE_CANONICAL_DOCUMENT` 중심으로 고정한다.
2. `UPDATE_ELEMENTS`는 preview recovery/legacy import compatibility로만 남기고, active render
   sync에서는 사용하지 않는다.
3. Preview runtime store는 canonical document를 primary render input으로 보관하고, legacy element
   payload는 compatibility adapter를 통과한 one-shot input으로만 처리한다.
4. Skia `BuilderCanvas`/scene snapshot은 canonical document 기반 scene model 또는
   resolved canonical tree를 직접 사용한다.
5. layout invalidation packet은 canonical node id/path 기준으로 정의한다.

검증:

```bash
rg -n "type: \"UPDATE_ELEMENTS\"|canonicalDocumentToElements\\(" \
  apps/builder/src/builder apps/builder/src/preview apps/builder/src/builder/workspace/canvas \
  -g '*.ts' -g '*.tsx'
pnpm -F @composition/builder exec vitest run \
  src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts \
  src/preview \
  src/builder/workspace/canvas
```

2026-05-08 진행:

- `BuilderCore`의 canonical document → `Element[]` active Preview publish subscription을
  제거했다.
- `useIframeMessenger`는 canonical document 변경을 `UPDATE_CANONICAL_DOCUMENT`로
  전송하는 effect를 active sync로 사용한다.
- `UPDATE_ELEMENTS`는 canonical document가 아직 없는 legacy bootstrap/compat path와
  recovery/compat message type으로만 남긴다.
- Skia `BuilderCanvas`는 active canonical document가 있으면 page/frame mode 모두
  canonical-derived read-only `elements/elementsMap/childrenMap`를 입력으로 사용한다.
- `BuilderCanvas`는 direct `canonicalDocumentToElements(...)` projection call site 대신
  canonical scene model 경계를 사용한다.
- `SceneStructureSnapshot`는 `canonical`/`legacy-bootstrap` source marker를 보유하고,
  `BuilderCanvas`는 active canonical document에서 만든 snapshot을 `canonical`로
  태그한다.
- `BuilderCanvas`는 active canonical document가 있으면 Skia scene snapshot의
  `pageIndex`도 store mirror 인덱스 대신 canonical scene model에서 재구성한
  read-only index를 사용한다.
- drag/drop commit 후 history payload는 canonical move result document에서 파생한
  snapshot을 우선 사용한다.
- `useCanvasDragDropHelpers`는 store `childrenMap` 직접 조회 대신 hook 입력
  `elements`에서 파생한 children map을 descendant/container/insertion 계산에 사용한다.
- `useCanvasElementSelectionHandlers`는 interactive canonical map provider를 필수
  입력으로 사용하며 stale `state.elementsMap`/`state.childrenMap` fallback을
  선택 source로 사용하지 않는다.
- Skia hover interaction은 `rendererInput`의 canonical-derived maps를 provider로
  받아 hover target/leaf 계산에 우선 사용한다.
- Skia hover interaction은 rendererInput map provider를 필수 입력으로 사용하며
  stale `state.elementsMap`/`state.childrenMap` fallback을 사용하지 않는다.
- Skia scroll wheel hit-test는 rendererInput map provider를 필수 입력으로 사용하며
  direct store `elementsMap` read를 사용하지 않는다.
- `StoreRenderBridge`는 `rendererInput` 변경 effect에서 직접 sync되며, subscription은
  theme/layout publish boundary로 좁혔다.
- 미사용 legacy retained-mode `sceneGraph/*`와 sprite-era
  `sprites/useResolvedElement.ts` source surface를 제거하고 static gate로 재도입을
  차단했다.
- Canvas detach context menu target resolver는 interactive canonical-derived
  `elementsMap`만 사용하며 stale `state.elementsMap` fallback을 제거했다.
- shared `RenderContext`의 legacy `elementsMap`/`childrenMap` contract를
  `ReadonlyMap` 기반 `elementsById`/`childrenByParent` read model로 전환했다.
- active snapshot helper consumers/file은 제거됐다. layout engine map contract는
  canonical-derived internal render input으로 유지하며, mutable legacy mirror source가
  아니므로 ADR-122 G6 blocker에서 제외한다.

Browser smoke:

- Builder URL 진입
- create/edit/delete/reorder
- origin/instance navigation and detach/reset
- refresh 후 `db.documents` document와 rendered canvas/Preview parity 확인
- console/page errors 0

## 8. Phase 4 — Legacy Boundary Quarantine

허용 boundary:

- `apps/builder/src/utils/projectSync.ts` cloud upload/download compatibility projection
- `packages/shared/src/utils/export.utils.ts` project export/import compatibility
- publish/runtime import adapter가 외부 legacy payload를 받아 canonical document로 변환하는 one-shot path
- canonical adapter tests and fixtures

금지 boundary:

- Builder mutation wrapper
- Builder hot path render/selection/layout/drag/drop
- Preview active render channel
- Skia scene input
- local IndexedDB project state persistence

검증:

```bash
rg -n "exportLegacyDocument\\(|legacyToCanonical\\(|canonicalDocumentToElements\\(" \
  apps/builder/src packages/shared/src apps/publish/src \
  -g '*.ts' -g '*.tsx'
```

모든 production hit는 allowlist table에 연결되어야 한다.

2026-05-08 진행:

- Preview inbound `UPDATE_ELEMENTS` recovery branch를 제거했다. Preview가 legacy
  `Element[]` snapshot을 Builder `recoverElementsSnapshot`으로 되살리는 역방향 write는
  canonical-only runtime boundary에서 금지한다.
- `usePageManager.initializeProject`의 canonical document hydrate는 일반 `setElements`
  대신 `hydrateProjectSnapshot`으로 좁혔다.
- shared TagGroup renderer의 parent `UPDATE_ELEMENTS` legacy snapshot 송신을 제거했다.
  이 메시지는 Builder 수신부에서 이미 recovery metadata 없이는 수용되지 않던 경로다.
- unused `MessagingService.updateElements`, `IframeMessenger.updateElements`,
  `useMessageCoalescing`, `CanvasDeltaMessenger.sendFullElements`, deprecated delta messenger
  full `UPDATE_ELEMENTS` fallback을 제거했다.
- targeted gate: useIframeMessenger/usePageManager static tests 2 files / 17 tests PASS,
  shared collection renderer contract 1 file / 1 test PASS, messaging facade contract 1 file /
  1 test PASS, export SSOT grep gate 1 file / 2 tests PASS, type-check PASS.

2026-05-09 진행:

- `elementLoader`의 lazy-loading disabled/already-loaded/loading-wait read path와
  page activation invariant lookup을 active canonical document 우선으로 정렬했다.
  legacy `elements[]` read는 canonical document 부재 시 bootstrap fallback으로만 남는다.
- `inspectorActions` resolved lookup은 active canonical document가 있으면 mutable legacy
  fallback과 병합하지 않도록 고정했다. style/fill commit·preview lookup도 canonical
  traversal을 우선 사용한다.
- `useTextEdit` live edit는 active canonical document가 있으면 missing element를 legacy
  cache에서 되살리지 않고, canonical mutation wrapper가 unchanged여도 active canonical
  document 존재 시 legacy patch를 생략한다.
- `PagesSection` page-delete bridge는 active canonical document traversal을 우선 유지하면서
  fallback 필요 시 삭제 후 최신 store snapshot을 사용한다.
- `useIframeMessenger` selection echo와 preview-generated dedupe도 active canonical
  document가 있으면 missing element/id를 legacy cache에서 되살리지 않는다.
  `UPDATE_ELEMENTS` bootstrap은 canonical document 부재 시에만 legacy snapshot을 읽는다.
- `useResetStyles` reset action도 active canonical document가 있으면 missing selected
  element를 legacy cache에서 되살리지 않는다.
- `useSelectedElementData` legacy mode selected/ref override props lookup은 이미 읽은
  selected element를 재사용해 같은 id를 store `elements[]`에서 다시 찾지 않는다.
- `BuilderCore` mutation registration/page-shell bridge fallback은
  `getCanonicalOrBootstrapBuilderElements()` helper로 격리해 canonical-first bootstrap
  boundary를 명시한다.
- `elementUpdate`/`elementRemoval`/`instanceActions`/`elements`/`historyActions` mutation-history
  source는 active canonical document elements를 우선 사용하고, legacy store `elements[]`는
  canonical document 부재 시 bootstrap fallback으로만 사용한다.
- `canonicalLegacyStoreCacheBridge`와 store `recoverElementsSnapshot` action surface를 제거했다.
- targeted gate: elementLoader/inspectorActions/useTextEdit static tests 3 files / 3 tests
  PASS, PagesSection test 1 file / 5 tests PASS, useIframeMessenger canonical test 1 file /
  8 tests PASS, style read/reset tests 2 files / 22 tests PASS, selected element data test
  1 file / 7 tests PASS, BuilderCore static test 1 file / 4 tests PASS, mutation source
  tests 5 files / 28 tests PASS, store source tests 5 files / 29 tests PASS, recover bridge
  removal tests 4 files / 21 tests PASS, type-check PASS. raw seed는 462로 유지,
  direct legacy `state.elements` grep은 후속 direct fallback cleanup 후 70 -> 0으로 감소.
- History diff/event undo-redo slice에서 `data.diff`/`data.diffs` payload를 snapshot
  payload보다 먼저 적용하고, canonical document sync를 index rebuild보다 먼저 수행하도록
  고정했다. targeted gate: historyActions diff/static tests 2 files / 3 tests PASS.
- Direct fallback cleanup slice 후 direct legacy `state.elements` grep은 70 -> 0.
- `setElementsCanonicalPrimary()` full-replace shell이 omitted page-owned runtime sibling을
  canonical `db.documents`에 남기던 drift를 수정했다. page/layout shell과 structural
  `body` node는 유지하면서 full snapshot에 없는 legacy-exportable runtime node를 prune한다.
  targeted gate: canonicalMutations test 1 file / 23 tests PASS, history diff/static tests
  2 files / 3 tests PASS, `pnpm run codex:typecheck` PASS, seeded Builder browser smoke
  PASS (`button-2` 삭제 후 redo/reload에도 store/document ids 모두 `page-1`, `button-1`).
- History add/remove/group/ungroup canonical node event schema를 land했다.
  `HistoryEntry.data.canonicalEvents`는 insert/remove/move sequence로 active canonical
  document에 직접 replay되며, add/remove/group/ungroup 신규 entry는 legacy
  `element`/`childElements`/`elements`/`prevElements` snapshot을 기록하지 않는다.
  실제 page body parent(`legacy-page -> body`) 아래 생성되는 element의 add history
  누락도 parent ancestor page/reusable context 판정으로 수정했다.
  targeted gate: history/creation/removal/helper tests 5 files / 28 tests PASS,
  realistic Builder browser smoke PASS.

## 9. Phase 5 — Stale Tests/Gates 재정렬

작업:

1. ADR-116 canonical tests에서 `order_num` expected value를 제거하고 `children[]` order assertion으로
   교체한다.
2. `diffLegacyRoundtrip`의 `reorder` contract를 `order_num` 기반이 아니라 canonical child order
   diff 또는 removed contract로 재정의한다.
3. `adr113DescendantsGrepGate`는 canonical `compositionDocumentOrder` 같은 shared canonical helper를
   금지하지 않도록 allowlist를 갱신한다.
4. `g5LegacyFieldGrepGate`는 domain-neutral `overrides` 변수명과 legacy component overrides를
   구분한다.
5. static string test는 구현 세부 문자열 대신 behavior/contract 검증으로 교체한다.
6. dormant `shadowWriteDiff`는 canonical document를 직접 legacy export하는 convenience
   wrapper를 제거하고, compatibility boundary에서 명시적으로 만든 legacy snapshot만
   비교한다.
7. BuilderCore의 no-op `useValidation`/`validateOrderNumbers` path를 제거해 page change
   마다 legacy `state.elements`를 읽던 dead order validation surface를 삭제한다.

검증:

```bash
pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__
pnpm -F @composition/shared exec vitest run src/utils
```

완료 조건:

- canonical adapter suite가 ADR-119/120/121 기준으로 green이다.
- stale gate 수정이 실제 runtime regression을 숨기지 않는다.

2026-05-08 진행:

- builder canonical adapter suite 19 files / 217 tests PASS.
- shared utils suite 5 files / 54 tests PASS.
- Preview active-channel static slice 2 files / 10 tests PASS.
- LayerTree/LayersSection canonical map slice 2 files / 12 tests PASS.
- DragBridge canonical map slice 2 files / 8 tests PASS.
- Canvas auxiliary drag/drop helper slice 2 files / 4 tests PASS.
- Canvas selection handler canonical map slice 2 files / 6 tests PASS.
- Canvas selection handler required-map slice 2 files / 7 tests PASS.
- Skia hover canonical map slice 3 files / 21 tests PASS.
- Skia hover required-map slice 2 files / 15 tests PASS.
- Skia scene source marker slice 3 files / 14 tests PASS.
- Skia scene pageIndex canonical-derived slice 3 files / 14 tests PASS.
- Skia canonical scene model direct traversal slice 5 files / 34 tests PASS.
- Canonical traversal API slice 6 files / 35 tests PASS.
- Active snapshot helper removal + direct traversal cleanup slice 6 files / 37 tests PASS.
- Skia scroll provider slice 2 files / 4 tests PASS.
- Legacy canvas surface cleanup slice 5 files / 57 tests PASS.
- PageFrameBinding direct traversal input slice 2 files / 7 tests PASS.
- FramesTab/useTreeExpandState canonical input slice 2 files / 15 tests PASS.
- FramesTab hydration fallback derived-map slice 2 files / 20 tests PASS.
- FrameLayoutCascade unused legacy projection cleanup slice 2 files / 10 tests PASS.
- ShadowWriteDiff stale canonical export wrapper cleanup slice 1 file / 21 tests PASS.
- BuilderCore no-op order validation cleanup slice 2 files / 5 tests PASS.
- Canonical element snapshot projection boundary slice 5 files / 18 tests PASS.
- useIframeMessenger direct traversal selection/dedupe slice 1 file / 8 tests PASS.
- Text edit + reset style direct traversal slice 2 files / 5 tests PASS.
- Delta messenger canonical count slice 1 file / 1 test PASS.
- Performance monitor direct traversal count slice 1 file / 1 test PASS.
- Monitor component memory canonical read slice 1 file / 1 test PASS.
- Canonical property read fallback slice 2 files / 4 tests PASS.
- Collection item manager canonical children read slice 1 file / 1 test PASS.
- Canvas selected element canonical read slice 1 file / 1 test PASS.
- LayerTree canonical resolution fallback slice 1 file / 11 tests PASS.
- BuilderCore direct traversal fallback slice 2 files / 5 tests PASS.
- BuilderCanvas store map fallback slice 3 files / 14 tests PASS.
- Selected element data direct traversal fallback slice 1 file / 5 tests PASS.
- Exported lookup selector cleanup slice type-check PASS.
- Frame layout cascade deleted-id fallback slice 2 files / 10 tests PASS.
- Inspector lookup fallback slice 2 files / 11 tests PASS.
- Inspector direct traversal fallback slice 1 file / 1 test PASS.
- Element loader page elements fallback slice 1 file / 1 test PASS.
- Selection hierarchy direct traversal lookup slice 1 file / 1 test PASS.
- Element removal target collection slice 2 files / 4 tests PASS.
- Instance action lookup/children slice 2 files / 23 tests PASS.
- Element update pre-read/dirty traversal slice 3 files / 21 tests PASS.
- Elements items/Menu action lookup slice 1 file / 8 tests PASS.
- SliderEditor child sync legacy hook cleanup slice 1 file / 3 tests PASS.
- Shared renderer read-model context slice 4 files / 37 tests PASS.
- BuilderCore direct traversal bridge slice 1 file / 4 tests PASS.
- Canonical legacy cache bridge initial quarantine slice 2 files / 5 tests PASS;
  follow-up removal slice 4 files / 21 tests PASS.
- PagesSection page-delete bridge direct traversal slice 1 file / 5 tests PASS.
- History direct traversal compatibility sync slice 1 file / 1 test PASS.
- AI tool + PropertyCustomId direct traversal slice 2 files / 9 tests PASS.
- Overlay body lookup direct traversal slice type-check covered.
- `pnpm run codex:typecheck` PASS.
- ComponentsPanel/PropertyCustomId/TreeItem/FramesTab/monitor/canvas subscription
  cleanup slice 6 files / 17 tests PASS + type-check PASS.
- Exported lookup selector canonical-first slice 1 file / 6 tests PASS +
  type-check PASS. direct legacy `state.elements` grep은 74 → 70.
- CanvasStore current page elements canonical-first slice 1 file / 2 tests PASS +
  type-check PASS.
- Current page selector canonical-first slice 1 file / 7 tests PASS +
  type-check PASS.
- Mutation source canonical-first slice 5 files / 28 tests PASS.
- Store source canonical-first slice 5 files / 29 tests PASS.
- Canonical legacy cache bridge removal slice 4 files / 21 tests PASS.
- `pnpm run codex:typecheck` PASS. raw seed 462, direct legacy `state.elements`
  grep 70 → 0.
- History diff/event undo-redo slice 2 files / 3 tests PASS. Direct fallback cleanup
  slice 15 files / 39 tests PASS. Direct legacy `state.elements` grep 70 → 0.
- Post-format verification: direct fallback/static gate suite 16 files / 43 tests PASS,
  runtime targeted suite 11 files / 86 tests PASS, `pnpm run codex:typecheck` PASS,
  direct legacy `state.elements` grep 0, raw seed 462, recover bridge production grep 0.
  Follow-up `pnpm run codex:preflight` PASS.
- Full-replace prune follow-up verification: `pnpm -F @composition/builder exec vitest run
src/adapters/canonical/__tests__/canonicalMutations.test.ts` — 1 file / 23 tests PASS;
  `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.diff.test.ts
src/builder/stores/history/historyActions.static.test.ts` — 2 files / 3 tests PASS;
  `pnpm run codex:typecheck` — 3 packages PASS; seeded Builder browser smoke PASS for
  `add/remove/undo/redo/reload` with no `button-2` resurrection.
- History canonical node event follow-up verification: RED confirmed in
  `elementCreationCanonical.test.ts` for `legacy-page -> body` add history; after fix
  `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts src/builder/stores/utils/__tests__/historyHelpers.test.ts`
  — 5 files / 28 tests PASS. Realistic Builder browser smoke on
  `legacy-page -> body -> button` confirmed `button-2` add undo/redo, remove undo/redo,
  reload persistence, and absence of local `pages`/`elements`/`layouts` objectStores.
- Closure audit grep-gate recovery: exact G6 builder command initially exposed
  ADR-113 descendants quarantine and ADR-116 G5 strict logic-access regressions in
  `canonicalHistoryEvents.ts` / `elementCreation.ts`. Ref override traversal now goes
  through `canonicalElementsView` helper boundary, and frame ownership lookup uses
  `getFrameElementMirrorId()` instead of direct `layout_id` access. Recovery gate:
  `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/adr113DescendantsGrepGate.test.ts src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts src/builder/stores/utils/__tests__/historyHelpers.test.ts src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts`
  — 5 files / 17 tests PASS.
- Closure audit store helper ordering: `elementCreation`, `elementUpdate`, and
  `elementRemoval` now call canonical mutation wrappers before updating the
  derived `elements`/`elementsMap`/`childrenMap` store cache. Guard tests:
  `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/elementUpdate.static.test.ts src/builder/stores/utils/__tests__/elementUpdate.test.ts src/builder/stores/utils/__tests__/elementRemoval.static.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts src/builder/stores/utils/__tests__/historyHelpers.test.ts`
  — 7 files / 33 tests PASS.

## 10. Phase 6 — Final Verification / Docs Sync

검증:

```bash
pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__ src/builder/stores/canonical
pnpm -F @composition/shared exec vitest run src/utils
pnpm run codex:preflight
```

Browser smoke checklist:

- 새 page/body/element 생성 후 refresh persistence
- sibling reorder / cross-page reparent / slot fill reorder
- component origin delete / page delete / instance materialization
- `Go to component` / `Select instances` cross-page selection
- Preview render and Skia render parity
- IndexedDB `composition.documents` active record 존재
- local `pages`/`elements`/`layouts` objectStore 없음 유지

문서 sync:

- ADR-122 본문 Status / Gate 결과 갱신
- 본 breakdown phase status 갱신
- `docs/adr/README.md` row/count 갱신
- `docs/CHANGELOG.md` 변경 내역 추가
- `.agents/skills/composition-patterns` canonical runtime rule 갱신

2026-05-09 진행:

- History canonical node event slice 관련 ADR 본문, breakdown, inventory,
  README, changelog, state-management rule, composition-patterns history rule을
  동기화했다.
- Partial browser smoke: realistic `legacy-page -> body -> button` seed에서
  `button-2` add undo/redo, remove undo/redo, reload 후 `db.documents` persistence,
  local `pages`/`elements`/`layouts` objectStore absence를 확인했다.
- Full browser smoke: local IndexedDB v15 schema를 새로 seed한 뒤 page/body/element
  생성 후 reload persistence, sibling reorder, cross-page reparent, slot fill reorder,
  cross-page `Go to component`/`Select instances` selection, origin page delete 후
  instance materialization, reload persistence, Preview canonical DOM render, Skia
  canvas presence, `documents` primary 및 local `pages`/`elements`/`layouts`
  objectStore absence를 확인했다. Screenshot:
  `/tmp/adr122-phase6-full-browser-smoke.png`.
- G6 verification result: full browser checklist PASS and `pnpm run codex:preflight`
  PASS. Exact builder/shared G6 commands also PASS:
  `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__ src/builder/stores/canonical`
  — 25 files / 311 tests PASS;
  `pnpm -F @composition/shared exec vitest run src/utils` — 5 files / 54 tests PASS.
- Closure audit follow-up: add/update/remove store helper cache ordering is now
  canonical-before-cache and covered by targeted/static guard tests. Final
  verification rerun passed, and ADR-122 is archived as Implemented.

## 11. Completion Definition

ADR-122 완료는 repo-wide `legacy` 문자열 0건이 아니다. 완료 조건은 다음이다.

1. Builder internal runtime mutation/read/render/preview path가 mutable legacy mirror를 source로
   사용하지 않는다.
2. legacy `Element[]` 생성은 boundary allowlist에만 남는다.
3. `CompositionDocument.children[]` order가 structural order의 유일한 runtime source다.
4. local persistence는 `db.documents`만 project document state primary로 유지된다.
5. browser smoke와 targeted tests가 canonical-only runtime path를 검증한다.
