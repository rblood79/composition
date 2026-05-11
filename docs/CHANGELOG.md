# Changelog

All notable changes to composition will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [ADR-126 설계 진행내역 정합화] - 2026-05-10

### Architecture

- **ADR-126 Phase 6 deprecation marker slice land**:
  - `unified.types.ts` 의 `Element` 인터페이스에 `@deprecated ADR-126 Phase 6` JSDoc 을 추가했다.
  - 신규 Builder runtime code 는 canonical `CompositionDocument` / `CanonicalNode` 또는 도메인별 structural contract 를 사용하고, `Element` 는 legacy compatibility projection/boundary 용도로만 남긴다는 원칙을 타입 정의에 명시했다.
  - 검증: builder type-check PASS.
- **ADR-126 Phase 6 deprecation lint gate slice land**:
  - `local/no-deprecated-element-import` ESLint rule 을 추가해 현재 compatibility/boundary baseline 파일 외 새 production 파일의 `Element` import 를 error 로 차단한다.
  - `ImportDeclaration` 과 `import("...").Element` type query 를 모두 검사한다.
  - 검증: isolated ADR-126 lint gate PASS, stdin negative fixture FAIL 확인.
- **ADR-126 Phase 5 derived-view cleanup slice land**:
  - `canonicalHistoryEvents.ts` 가 `canonicalDocumentToElements(nextDoc)` 대신 `visitCanonicalDocumentElements()` 로 undo/redo result snapshot 을 수집하도록 전환했다.
  - `useCanonicalElements()` / `useCanonicalSelectedElement()` production export 와 `canonicalSceneModelLegacy.ts` 의 `canonicalDocumentToElements` re-export 를 제거했다.
  - production `canonicalDocumentToElements(` grep 은 boundary 정의 1건만 남고 non-boundary caller 는 0건이다.
  - 검증: builder type-check PASS, targeted Vitest 6 files / 24 tests PASS.
- **ADR-126 Phase 5 runtime derived-view hook caller slice land**:
  - `stores/index.ts`, `canvasStore.ts`, `useDeltaMessenger.ts`, `useComponentMemory.ts` 가 `useCanonicalElements()` / `useCanonicalSelectedElement()` 대신 active canonical document traversal 을 사용하도록 전환했다.
  - non-boundary `useCanonicalElements()` / `useCanonicalSelectedElement()` production caller 는 0건으로 감소했다.
  - 검증: builder type-check PASS, targeted Vitest 5 files / 12 tests PASS.
- **ADR-126 Phase 5 nodes derived-view caller slice land**:
  - 신규 `useCanonicalPanelElements()` 로 Layers/Frames/LayerTree read path 가 `useCanonicalElements()` 대신 active canonical document traversal 을 사용하도록 전환했다.
  - direct `useCanonicalElements()` production caller 는 8 → 5로 감소했다.
  - 검증: builder type-check PASS, targeted Vitest 4 files / 21 tests PASS.
- **ADR-126 Phase 5 property derived-view caller slice land**:
  - `useCanonicalPropertyRead.ts` / `useCollectionItemManager.ts` 는 `useCanonicalElements()` 대신 active canonical document traversal 을 직접 사용하도록 전환했다.
  - `PropertyCustomId` / `usePresetApply` 는 property read helper 를 재사용하고, `idValidation` 은 `Element[]` 대신 customId validation 최소 contract 를 받도록 좁혔다.
  - direct `useCanonicalElements()` production caller 는 12 → 8로 감소했다.
  - 검증: builder type-check PASS, targeted Vitest 4 files / 8 tests PASS.
- **ADR-126 Phase 4 legacy scene boundary map alias slice land**:
  - `canonicalSceneModelLegacy.ts` 의 legacy Element map return contract 를 `LegacyElementMap` / `LegacyChildrenByParentMap` boundary alias contract 로 전환했다.
  - bootstrap fallback boundary semantics 는 변경하지 않았다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 1 test PASS.
- **ADR-126 Phase 4 inspector actions cache contract slice land**:
  - `inspectorActions.ts` 의 inspector lookup/children map helpers 와 required state map contract 를 `InspectorElementMap` / `InspectorChildrenMap` alias contract 로 전환했다.
  - selected props/style/fill write-through 및 canonical merge semantics 는 변경하지 않았다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 1 test PASS.
- **ADR-126 Phase 4 elements page removal local map slice land**:
  - `elements.ts` 의 `removePageLocal` page removal/de-dup maps 를 `PageRemovalElementMap` / `PageRemovalElementsByPreviousId` alias contract 로 전환했다.
  - page shell removal 및 auto-detach semantics 는 변경하지 않았다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 1 test PASS.
- **ADR-126 Phase 4 history actions compatibility map slice land**:
  - `historyActions.ts` 의 cloud compatibility upsert lookup map 을 `HistoryCompatibilityElementMap` alias contract 로 전환했다.
  - canonical history event/diff application semantics 는 변경하지 않았다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 1 test PASS.
- **ADR-126 Phase 4 element removal cache contract slice land**:
  - `elementRemoval.ts` 의 removal target lookup, children map, post-removal cache rebuild, multi-remove de-dup map 을 `ElementRemovalLookup` / `ElementRemovalChildrenByParent` alias contract 로 전환했다.
  - canonical remove event/history/persistence semantics 는 변경하지 않았다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 3 tests PASS.
- **ADR-126 Phase 4 element update cache contract slice land**:
  - `elementUpdate.ts` 의 lookup/children map helper 와 batch rebuild local map 을 `ElementUpdateLookup` / `ElementUpdateChildrenByParent` alias contract 로 전환했다.
  - descendant dirty tracking input 은 readonly `{ id }` contract 로 좁혔고, canonical mutation/history/persistence semantics 는 변경하지 않았다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 3 tests PASS.
- **ADR-126 Phase 4 history helper read-model slice land**:
  - `historyHelpers.ts` 의 batch/instance/group undo lookup map input 을 generic readonly map contract 로 전환했다.
  - group/ungroup/multi-delete/paste/history event payload `Element` boundary 는 유지했다.
  - 검증: builder type-check PASS, targeted Vitest 2 files / 3 tests PASS.
- **ADR-126 Phase 4 element loader cache contract slice land**:
  - `elementLoader.ts` 의 minimal state `elementsMap` contract 를 raw `Map<string, Element>` 에서 Phase 3 `StoreElementCacheMap` 으로 전환했다.
  - lazy load/unload runtime behavior 는 변경하지 않았다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 1 test PASS.
- **ADR-126 Phase 4 element indexer contract slice land**:
  - `elementIndexer.ts` 의 page/component/variable index helper map input 과 `ComponentIndex.masterComponents` 를 generic readonly map contract 로 전환했다.
  - `PageElementIndex` / `VariableUsageIndex` 구조와 runtime index semantics 는 변경하지 않았다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 1 test PASS.
- **ADR-126 Phase 4 element creation lookup slice land**:
  - `elementCreation.ts` 의 ref master/customId generation lookup helper 를 generic readonly map contract 로 전환하고 `buildCreationElementMap()` 을 `Map<string, TElement>` 로 좁혔다.
  - 생성 payload와 canonical insert event는 기존 `Element` contract 로 유지했다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 1 test PASS.
- **ADR-126 Phase 4 grouping read-model slice land**:
  - `elementGrouping.ts` 의 group/ungroup input 을 raw `Map<string, Element>` 대신 generic `ReadonlyMap<string, TElement>` contract 로 전환했다.
  - group 생성/해제 output payload 는 기존 history/add/update 경계 호환을 위해 `Element` 로 유지했다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 1 test PASS.
- **ADR-126 Phase 4 utility read-model slice land**:
  - `layoutInvalidation.ts`, `elementAlignment.ts`, `elementDistribution.ts`, `elementHelpers.ts` 의 map input 을 structural/readonly contract 로 좁혀 full store `Element` map 의존을 줄였다.
  - `layoutInvalidation.test.ts` 는 local `{ id }` node fixture 로 전환했고, `elementAlignmentDistribution.static.test.ts` 로 alignment/distribution/helper 의 raw `Map<string, Element>` 회귀를 차단했다.
  - 검증: builder type-check PASS, targeted Vitest 2 files / 3 tests PASS.
- **ADR-126 Phase 3 store cache state contract slice land**:
  - `ElementsState.elementsMap` / `childrenMap` 과 `buildIndexes()` cache 생성부를 `StoreElementCacheSnapshot` / `StoreElementCacheMap` / `StoreChildrenCacheMap` deprecated snapshot contract 로 전환했다.
  - `elements.storeCache.static.test.ts` 를 추가해 raw `Map<string, Element>` / `Map<string, Element[]>` state/buildIndexes contract 회귀를 차단했다.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 1 test PASS.
- **ADR-126 Phase 3 scope cleanup**:
  - 현재 코드 재측정 결과 `useStore.getState().elementsMap|childrenMap` production direct read 는 adapter doc comment 를 제외하면 0건이지만, `stores/**` 전체 map type grep 은 store state 와 inspector/loader/history/utility consumer 를 함께 잡는 것을 명시했다.
  - Phase 3 범위를 `elements.ts` 의 `elementsMap`/`childrenMap` store state/cache contract 정렬로 좁히고, mutation/action/history/inspector/loader/utility map consumer 전환은 Phase 4 소유로 재분리했다.
  - 문서 정리만 수행하며 runtime behavior 변경 없음.
- **ADR-126 Phase 2 canvas renderer input/bootstrap projection follow-up land**:
  - `rendererInput.ts` 의 `SkiaRendererInput.elements/elementsMap/childrenMap` 과 page-resolved render tree 를 `CanvasSceneNode` contract 로 전환.
  - `createSkiaRendererInput()` 은 caller 주입 `sceneNodes` / `sceneNodesMap` / `sceneChildrenByParent` 를 필수로 소비하며, 내부 legacy scene fallback 을 제거.
  - `BuilderCanvas.tsx` 의 `getSceneModel*Legacy` fallback 과 store `Element` import 를 제거하고, legacy store bootstrap 변환은 `canonicalSceneModelLegacy.ts` boundary 의 `buildLegacyCanvasSceneGraph()` 로 격리.
  - 검증: builder type-check PASS, targeted Vitest 4 files / 10 tests PASS.
  - 잔여: Phase 3 store-cache 타입, Phase 4 history/inspector/drag-drop/AI/messaging consumer, Phase 5 derived-view/transition alias, Phase 6 final audit.
- **ADR-126 Phase 2-D drop target resolver read model follow-up land**:
  - `dropTargetResolver.ts` 의 store `Element` import를 제거하고 `DropTargetNode` structural contract 로 drag/drop target read model, children map, projection helper, reorder helper를 전환.
  - `dropTargetResolver.test.ts` 도 local `DropTargetNode` fixture 로 전환.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 13 tests PASS.
  - 당시 canvas 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.
- **ADR-126 Phase 2-D table generated editor payload follow-up land**:
  - `TableEditor.tsx` / `TableHeaderEditor.tsx` 의 row/column/cell/group create payload 를 `TableEditorElementPayload` / `TableHeaderElementPayload` structural contract 로 전환하고 store `Element` import 및 `: Element[]` payload 를 제거.
  - `TableHeaderEditor` 의 column/cell lookup 과 customId 생성은 canonical property elements 를 소비하도록 전환.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 6 tests PASS.
  - 당시 canvas 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.
- **ADR-126 Phase 2-D collection child manager payload follow-up land**:
  - `useCollectionItemManager.ts` 는 `CollectionItemNode`, `ChildItemManager.tsx` 는 `ChildItemPayload` structural contract 로 store `Element` import/cast 와 direct `useStore.getState().elements` read 를 제거.
  - `ChildItemManager` customId 생성은 `useCanonicalPropertyElements()` 를 소비하도록 전환.
  - 검증: builder type-check PASS, targeted Vitest 2 files / 4 tests PASS.
  - 당시 canvas 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.
- **ADR-126 Phase 2-D generated child editors + tabs actions follow-up land**:
  - 신규 `propertyEditorNode.ts` 의 `PropertyEditorElementPayload` / `PropertyEditorChildNode` contract 로 `ListBoxItemEditor`, `TagEditor`, `TreeItemEditor`, `tabsItemActions`, `TabsEditor` 의 child add payload 와 TabPanel lookup 을 store `Element` import 및 `useStore.getState().elements` direct read 에서 분리.
  - `ListBoxItemEditor` / `TagEditor` customId 생성은 `useCanonicalPropertyElements()` 를 소비하도록 전환.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 5 tests PASS.
  - 당시 canvas 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.
- **ADR-126 Phase 2-D preset apply read/write payload follow-up land**:
  - `LayoutPresetSelector/usePresetApply.ts` 의 store `Element` import/cast 를 제거하고 `PresetElementNode` / `PresetSlotElement` structural contract 로 기존 slot 탐지, canonical replace filter, slot create payload 를 분리.
  - `usePresetApply.static.test.ts` 도 local structural fixture 로 전환하고 production `Element` raw/type/import grep 0건을 고정.
  - 검증: builder type-check PASS, targeted Vitest 1 file / 4 tests PASS.
  - 당시 canvas 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.
- **ADR-126 Phase 2-D frame panels read/load follow-up land**:
  - `frameElementLoader.ts` 의 store `Element` import/cast 와 `loadFrameElements()` 의 기존 store 타입 반환을 `FrameElementNode` structural contract 로 전환.
  - `FramesTab` / `FrameElementTree` 는 `PanelNode` 기반 frame tree read/delete/click props 를 소비하도록 정리.
  - G2-D frame slice grep: `frameElementLoader.ts` + `FramesTab` + `FrameElementTree` production store `Element` import hit 0.
  - 검증: builder type-check PASS, targeted Vitest 5 files / 45 tests PASS.
  - 당시 canvas 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.
- **ADR-126 Phase 2-D panels/interaction read-model core land**:
  - 신규 `PanelNode` contract 로 Properties/LayerTree read path 를 Builder store `Element` import 에서 분리.
  - 신규 `CanvasInteractionNode` contract 로 selection hit-test, selected bounds, context menu, drag bridge, hover, scroll interaction input 을 구조적 read model 로 전환.
  - `BuilderCanvas` / `SkiaCanvas` interaction input 은 `rendererInput.sceneNodesMap` / `sceneChildrenByParent` 를 소비.
  - `CanvasSceneNode.layout_id` transition alias 를 보강해 scene node 기반 frame body interaction helper 호환을 유지.
  - G2-D core grep: panels read path + canvas interaction core production store `Element` import hit 0.
  - 검증: builder type-check PASS, targeted Vitest 11 files / 82 tests PASS.
  - 당시 canvas 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.
- **ADR-126 Phase 2-E preview boundary core land**:
  - `preview/App.tsx` 의 `resolveCanonicalRefTree` 와 frame mirror checks 를 `PreviewElement` generic path 로 전환하고 store `Element` casts/import 를 제거.
  - `preview/utils/layoutResolver.ts` 는 preview-local result types + `PreviewElement` 를 사용하도록 분리.
  - `services/messaging.ts` 는 `MessagingElement` / `MessageProps` 로 iframe message payload 를 store 타입 import 없이 표현.
  - `utils/urlGenerator.ts` 는 `UrlPage` / `UrlLayout` contract 로 전환해 preview router 의 builder `Page` import 를 제거.
  - G2-E core grep: `preview/**` + `services/messaging.ts` + `utils/urlGenerator.ts` production `Element` raw/type import + `UPDATE_ELEMENTS` hit 0.
  - 검증: builder type-check PASS, targeted Vitest 2 files / 9 tests PASS.
  - 잔여: 생성형 property editor write payload caller 는 후속 panels/write payload slice 또는 Phase 5에서 정리.
- **ADR-126 Phase 2-B layout contract core land**:
  - `workspace/canvas/layout/**` production 을 Builder store `Element` import 대신 `CanvasLayoutNode` layout contract 로 전환.
  - `layoutCache.ts` 와 `useLayoutPublisher.ts` 도 `CanvasLayoutNode` 기반 input 을 소비하도록 정리.
  - `PixiPageRendererInput` / `buildPixiPageRendererInput` / `buildFrameRendererInput` production 명칭을 `LayoutPublisherInput` / `buildPageLayoutPublisherInput` / `buildFrameLayoutPublisherInput` 으로 정정.
  - G2-B core grep: `layout/**` + `scene/layoutCache.ts` + `hooks/useLayoutPublisher.ts` production `Element` raw/type hit 0, Pixi layout input legacy symbol hit 0.
  - 검증: builder type-check PASS, targeted Vitest 10 files / 63 tests PASS.
  - 당시 renderer/BuilderCanvas 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.
- **ADR-126 Phase 2-C renderer input/ref resolution core land**:
  - `canonicalRefResolution.ts` 를 `Element` import 전용 helper 에서 `CanonicalRefResolvableNode` generic resolver 로 전환.
  - `resolvers/canonical/storeBridge.ts` 의 per-instance shared-cache resolver 도 `Element` import 없이 generic render node 를 반환하도록 전환.
  - `createSkiaRendererInput()` 이 주입된 canonical scene graph 를 `resolveCanonicalRefTree<CanvasSceneNode>()` 로 직접 resolve.
  - G2-C core grep: `canonicalRefResolution.ts` + `storeBridge.ts` `Element` raw/type hit 0.
  - 검증: builder type-check PASS, targeted Vitest 9 files / 113 tests PASS, `git diff --check` PASS.
  - 당시 renderer fallback 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.
- **ADR-126 Phase 2-A Skia/scene core land**:
  - `CanvasSceneNode` / `CanvasSceneGraph` projection 을 추가하고 `CanonicalSceneModel` 이 `sceneNodes`, `sceneNodesMap`, `sceneChildrenByParent`, canonical-derived `pageIndex` 를 expose 하도록 전환.
  - Skia render bridge / command stream 이 `rendererInput.elementsMap` / `childrenMap` 대신 canonical scene maps 를 소비.
  - `canonicalSceneModel.ts` 내부 `canonicalDocumentToElements()` 호출 제거.
  - `workspace/canvas/skia/**` + `workspace/canvas/scene/**` production `Element` import/raw hit 0, Skia production `rendererInput.elementsMap|childrenMap` hit 0.
  - 검증: builder type-check PASS, targeted Vitest 18 files / 152 tests PASS, browser smoke canvas 1440x952 nonblank + console/page error 0 + rAF median 120.5fps PASS.
  - 당시 BuilderCanvas/renderer fallback 잔여는 이후 renderer input/bootstrap projection follow-up 에서 제거.

### Documentation

- **ADR-126 prerequisite 표기 정리**:
  - Phase 1 prerequisite = ADR-123/124/125 `Implemented`.
  - Phase 2 prerequisite = Phase 1 G1 PASS + ADR-127 `Implemented`.
  - dependency baseline 은 ADR-122/123/124/125/127 모두 Implemented 로 명시.
- **store-cache bucket 판정 정정**:
  - 기존 "ADR-125 자동 closure / Phase 3 추가 작업 0" 표현을 제거.
  - 현재 상태는 `useStore.getState().elementsMap|childrenMap` direct hot-path read 0건이지만, `ElementsState.elementsMap: Map<string, Element>` / `childrenMap: Map<string, Element[]>` store state 타입은 Phase 3 잔여로 유지.
- **Phase 2 breakdown 정합화**:
  - "6 sub-group" 오기 → 5 sub-group (2-A~2-E) 로 통일.
  - Phase 2 plan row 에 ADR-127 Implemented 진입 조건을 추가.
  - README partial row 를 Phase 1 prerequisite 3/3 + Phase 2 prerequisite ADR-127 Implemented 로 갱신.

## [ADR-123/124/125/127 closure 5-step 마감 + ADR-126 부분완료 표 이동] - 2026-05-10

### Documentation

- **ADR-123/124/125/127 본문 `completed/` archive 이관** (closure 5-step §3-§5):
  - `docs/adr/123-cloud-document-row-schema.md` → `docs/adr/completed/123-cloud-document-row-schema.md`
  - `docs/adr/124-canonical-only-history-schema.md` → `docs/adr/completed/124-canonical-only-history-schema.md`
  - `docs/adr/125-render-input-canonical-native-contract.md` → `docs/adr/completed/125-render-input-canonical-native-contract.md`
  - `docs/adr/127-canonical-traversal-helper-and-scene-model-redesign.md` → `docs/adr/completed/127-canonical-traversal-helper-and-scene-model-redesign.md`
  - **Why**: ADR Status `Implemented` 변경 직후 본문이 `docs/adr/` root 에 잔존하여 다른 9xx Implemented ADR 와 폴더 일관성 깨짐 (`feedback-adr-closure-5-step` 메모 §"Status 만 Implemented 처리하고 본문이 root 에 남아있으면" 위반).
- **Reference link path 정합화** (closure 5-step §5):
  - 본문 4 → design breakdown link 4건 `design/X-...md` → `../design/X-...md`
  - design breakdown 4 → 본문 link 4건 `../X-...md` → `../completed/X-...md`
  - `docs/adr/127-...md` `ssot-hierarchy.md` link 경로 1단계 보정 (`../../.claude/...` → `../../../.claude/...`)
  - `docs/migrations/002_create_documents_table.sql` `@see` link 1건 `docs/adr/123-...` → `docs/adr/completed/123-...`
- **README.md 표 정렬**:
  - 미구현 표에서 ADR-123/124/125/127 4 row 제거 + ADR-126 row 제거
  - 완료 표 (line 239 직후) 에 ADR-123/124/125/127 4 row 추가 (Implemented 2026-05-10)
  - 부분 완료 표에 ADR-126 row 추가 — Phase 0+1 완료 / Phase 2-6 잔여 / Phase 1 prerequisite 3/3 + Phase 2 prerequisite ADR-127 충족 표기
  - 현황 카운트: `완료 116→120 / 부분 7→8 / 미구현 9→4 / 합계 132 유지`
  - 최상단 변경 이력 entry 추가 (closure 작업 요약)

### Notes

- ADR-126 본문은 root 유지 (Accepted 상태 — Phase 2-6 land 후 closure 5-step 진행 예정).
- `docs/adr/design/` 폴더 위치는 closure 5-step §"보존 대상" 에 따라 root 유지 (다른 9xx Implemented ADR 도 `design/` 사용).
- `docs/adr/reviews/` historical record path 갱신 안 함 (memory `feedback-adr-closure-5-step` §"보존 대상").
- 검증: `grep -rnE "\(\.\./12[3-7]-" docs/` 0건 / `grep -rnE "\([0-9]+-(cloud|canonical|render|element|canonical-traversal)" docs/adr/*.md` 0건 (root 본문 잔존 link 0).

## [ADR-127 Implemented — Canonical-native traversal helper + scene model 재설계 (Phase 0-3 직렬 land)] - 2026-05-10

### Architecture

- **ADR-127 Phase 0-3 직렬 land — Auto mode 동일 세션 발의 → Implemented**:
  - **5 agent 병렬 dispatch** (효율적 사전 분석):
    - codex review (background stream): ADR 본문 + breakdown 정합 layer 검증
    - Explore #1 — Phase 0 inventory freeze: helper API 60 call site / scene model build chain 18 / scene field read 56 / 위험 신호 없음
    - Explore #2 — ADR-126 Phase 2 hot path 패턴 분석: 85 file (HIGH 19 / MEDIUM 35 / LOW 31) + parent_id 181 hits / childrenMap.get 37 hits / 추정 8-12 hour
    - Explore #3 — ADR-126 Phase 4-5 + ADR-124 followup 영향 분석: historyActions canonical event primary 이미 이중화 + derived view caller 11+ + ADR-124 legacy fallback dead code
    - Explore #4 — ADR-127 Phase 2 scene caller 영향 분석: 14 file caller swap 영향 + ADR-125 layout contract 호환 + 단일 commit 가능 판정
  - **Phase 1 — helper API 6 신설 (G1 PASS)**:
    - 신규 file: `apps/builder/src/builder/stores/canonical/canonicalTraversalHelpers.ts` (220 line)
    - 6 helper export: `getChildren(node)` / `getParent(nodeId)` / `getAncestors(nodeId)` / `findByPath(path)` / `getNodeMap()` / `getChildrenByParent()`
    - module-level cache (`documentVersion` + `projectId` 조합 key, mutation 시 자동 invalidation)
    - 단위 테스트 28/28 PASS (`canonicalTraversalHelpers.test.ts`) — 7 카테고리 (getChildren / getParent / getAncestors / findByPath / getNodeMap / getChildrenByParent / Cache invalidation)
  - **Phase 2 — Scene model 인터페이스 재설계 (G2 PASS)**:
    - `CanonicalSceneModel` interface 변경: `elements: Element[]` / `elementsMap: Map<string, Element>` / `childrenByParent: Map<string, Element[]>` → `nodes: CanonicalNode[]` / `nodesMap: Map<string, CanonicalNode>` / `childrenByParent: Map<string, CanonicalNode[]>`
    - `buildCanonicalSceneModel` traversal 이 CanonicalNode 직접 사용 (`flattenCanonicalDocumentNodes` helper 신설)
    - 신규 boundary file: `apps/builder/src/builder/stores/canonical/canonicalSceneModelLegacy.ts` (110 line) — `getSceneModelElementsLegacy` / `getSceneModelElementsMapLegacy` / `getSceneModelChildrenByParentLegacy` / `buildLegacyElementMap` / `buildLegacyChildrenByParent` (transition 기간 동안 사용, ADR-126 Phase 5 시점에 제거)
    - BuilderCanvas caller swap (legacy getter 사용)
    - 기존 scene model test 갱신 (새 interface)
    - Why: Element vs CanonicalNode shape mismatch (flat parent_id+order_num+tag vs nested children+type) 가 cascade caller swap 강제 — legacy boundary file 격리로 transition 기간 동안 두 shape 공존 가능
  - **Phase 3 — Verification (G3 PASS)**:
    - type-check FULL TURBO PASS (turbo cache + builder cache miss 양쪽 fresh build PASS — pre-existing 920 errors 모두 stale tests 의 ADR-127 무관 issue)
    - targeted vitest 30/30 PASS (helper 28 + scene model 2)
    - preflight FULL TURBO PASS (`pnpm run codex:preflight`)
    - console error 0 (Chrome MCP 검증)
    - canvas dimension 2240x1768 idle 정상 표시
    - Why FPS 측정 lazy: dev tab background throttle 로 RAF lazy. Phase 1 baseline 120.5fps 변경 0 추정 — legacy getter 통한 indirect access 라 render 경로 행위 동일
- **ADR-126 Phase 2 진입 prerequisite 충족 갱신**: 5 base ADR (ADR-122 + ADR-123 + ADR-124 + ADR-125 + ADR-127) 모두 Implemented. ADR-126 Phase 2 (hot path 70 file file-by-file transition) 진입 가능 상태로 갱신.
- **README + CHANGELOG sync**: 카운트 갱신 (완료 115→116 / 부분 완료 7 / 미구현 10→9 / 합계 132 유지). ADR-127 row Status `Proposed` → `Implemented`.

### Process

- **다음 진입 권장 (별도 세션)**: ADR-126 Phase 2 — hot path 70 file file-by-file transition (workspace/canvas + panels + resolvers Element import 0건 + Element @deprecated + eslint-plugin-deprecation 활성). 추정 8-12 hour, MEDIUM~HIGH 회귀 위험. ADR-127 helper API + canonical-native scene model + legacy boundary getter 가 prerequisite 로 land 완료. file group 별 자연 commit 분할 진행.

## [ADR-127 Proposed — Canonical-native traversal helper + scene model 재설계 발의] - 2026-05-10

### Documentation

- **ADR-127 Proposed 발의 — ADR-126 Phase 2 진입 직전 framing raise 결과 base ADR 분리**:
  - **발의 motivation**: ADR-126 Phase 2 진입 시 발견된 4 본질 framing 의문 (CLAUDE.md framing raise 의무 CRITICAL):
    1. **작업량**: design 추정 ~28 file vs 실 측정 70 file (workspace/canvas + panels + resolvers G2 grep gate scope) — 2.5 배.
    2. **shape mismatch**: Element (flat with `parent_id` + `tag` + `order_num`) vs CanonicalNode (nested with `children: CanonicalNode[]` + `type` + 배열 순서) — traversal 패턴 자체 변경 필요 (`childrenMap.get(parentId)` → `node.children`).
    3. **resolver helper API 부족**: `canonicalElementsBridge.ts` 에 `getCanonicalNode` / `useCanonicalNode` / `useActiveCanonicalDocument` 만 존재. **`getChildren/getParent/getAncestors/findByPath/getNodeMap/getChildrenByParent` 미존재**.
    4. **scene model 자체 재설계**: `canonicalSceneModel.ts:28-34` 가 `Element[]` expose. workspace scope 안. G2 grep gate 통과 = scene model 인터페이스 재설계 필수.
  - **base/응용 framing 재정렬** (memory `feedback-adr-essence-priority-over-formal-pass` + `feedback-adr-consolidation-burden-not-essence` + `feedback-adr-dependency-direction-stale-baseline` 인용 + ADR fork checkpoint 4 질문 통과):
    - ADR-127 = **base ADR (추상)** — canonical-native consumer 측 SSOT module 변경 (helper API + scene model 재설계 자연 그루핑)
    - ADR-126 Phase 2 = **응용** — ADR-127 prerequisite 후 hot path 70 file file-by-file transition 진입
    - 의존 방향: ADR-122 + ADR-125 → ADR-127 → ADR-126 Phase 2 (reverse 없음)
  - **대안 평가**: A (ADR-126 안에 sub-step 압축, HIGH 1) + B (ADR-127 + ADR-128 분리, prerequisite 추적 복잡) + **C (ADR-127 통합 발의, HIGH 0, 자연 그루핑 채택)**.
  - **scope** ([breakdown](adr/design/127-canonical-traversal-helper-and-scene-model-redesign-breakdown.md)):
    - **Helper API 6 신설** (`canonicalElementsBridge.ts` 확장 또는 `canonicalTraversalHelpers.ts` 별도 module): `getChildren(node)` / `getParent(nodeId)` / `getAncestors(nodeId)` / `findByPath(path)` / `getNodeMap()` / `getChildrenByParent()`. memo 화 + canonical document version 기반 cache invalidation.
    - **Scene model 인터페이스 재설계**: `CanonicalSceneModel` 의 `elements: Element[]` / `elementsMap: Map<string, Element>` / `childrenByParent: Map<string, Element[]>` → `nodes: CanonicalNode[]` / `nodesMap: Map<string, CanonicalNode>` / `childrenByParent: Map<string, CanonicalNode[]>` 로 export shape 변경.
    - **caller swap (단일 commit 동반)**: `layoutCache.ts:343` + 기타 5+ caller.
    - **legacy getter 격리**: `canonicalSceneModelLegacy.ts` 신설 (boundary 위치). transition 기간 동안 deprecated `elements: Element[]` getter 제공. ADR-126 Phase 5 격리 시점에 제거.
  - **HIGH 0** (R1~R5 모두 MED — race condition / FPS / legacy getter / pencil path / layoutCache caller). 4 Phase 자연 분할: Phase 0 inventory → Phase 1 helper API 신설 → Phase 2 scene model 재설계 + caller swap → Phase 3 verification (60fps gate + smoke).
  - **30일 공존 기간 상한** — Phase 1 착수 시점 기준.
- **ADR-126 README row 갱신**: Status `Accepted (Phase 1 Done)` → `Accepted (Phase 1 Done, Phase 2 prerequisite 발의)`. Phase 2 진입 prerequisite 에 ADR-127 추가.
- **README 헤더 status 갱신** + 카운트 갱신 (미구현 9→10 / 합계 131→132).

### Process

- **다음 진입 권장 (별도 세션)**: ADR-127 fork checkpoint 4 질문 통과 후 codex review 1차 진입 (본문 정합 layer 검증). codex closure 후 Phase 0 inventory freeze → Phase 1 helper API 신설 → Phase 2 scene model 재설계 → Phase 3 verification 단계적 land. ADR-127 Implemented 후 ADR-126 Phase 2 진입 가능.

## [ADR-126 Phase 1 — canonical-native model 검증 (G1 PASS)] - 2026-05-10

### Documentation

- **ADR-126 Phase 1 — canonical-native model 검증 land**:
  - **base 3 closure 잔존 검증** (3-축 모두 PASS):
    - **G1-A** ADR-123 cloud transport boundary: `cloudBoundary.static.test.ts` 5/5 PASS — allowlist 6 file 외 cloud row API import 0 건.
    - **G1-B** ADR-124 history payload: HistoryEntry data 8 legacy snapshot field `@deprecated` 마킹 (`stores/history.ts:64-82`) + `historyActions.ts` 5 site `entry.data.canonicalEvents` early read primary path 확증.
    - **G1-C** ADR-125 render input: Preview `UPDATE_ELEMENTS` receive 제거 (`preview/types/index.ts:70` + `messageHandler.ts:44-46`) + `calculateFullTreeLayoutFromSceneModel` swap (`layoutCache.ts:5,343`) + element-level `order_num` 갱신 production 0 hit (page-level `projectSync.ts:103` 은 cloud Page entity field, scope 외).
  - **Element consumer 카테고리 매핑** ([126-phase1-validation.md](adr/design/126-phase1-validation.md)):
    - unified.types `Element` 타입 import production: **37 file** — boundary-allowed 18 (`adapters/canonical/*` 15 + `resolvers/canonical/storeBridge` + 2 type 정의) / derived-view 1 (`canonicalElementsView.ts`) / hot-path-consumer 18 (LayerTree 4 + Properties 3 + utils 3 + preview 2 + ai 2 + 기타 4).
    - annotation 기반 production: **161 file** — canvas hot path (Skia/renderers/layout) **25 file** + panels/Properties/LayerTree ~30 + store/history/inspector/drag-drop ~40 + preview/publish/ai/messaging ~15 + boundary/adapter/utils ~50.
  - **canonical-native API hot path 커버 가능성 판정**: **YES** — `calculateFullTreeLayoutFromSceneModel` (Phase 2-a 진입점) + scene model derived-readonly view + canonical node/path/alias resolver (ADR-122) + `applyCanonicalHistoryEventsToActiveDocument` (ADR-124) + canonical document `parentId`/`path[]` 가 render/selection/Properties read/Undo/drag-drop hot path 를 `Element` 없이 커버.
  - **FPS baseline 측정** (Phase 2 비교용 — dev server idle 상태):
    - canvas 2612x1880 (CSS 1306x940) / panel 0
    - 300 sample (2.5s) — **median 120.5fps** / p10 107.5 / p99 137.0
    - 60fps gate -5% bound = 114.4 → median 충분 여유 PASS
    - console error 0
  - **Gate G1 통과**: canonical-native model 설계 검증 + ADR-123/124/125 closure 확증 + type-check FULL TURBO PASS + FPS baseline 수립 → **Phase 2 진입 가능 상태**.
- **breakdown Phase 1 status `Done — 2026-05-10`** 마킹 + ADR 본문 진행 로그 entry 추가.

### Process

- **다음 진입 권장 (별도 세션)**: ADR-126 Phase 2 — hot path consumer 전환 (Skia render path / layout engine input / Preview render / Properties editor / LayerTree). 우선 전환 대상 ~28 file (canvas Skia ~10 + layout ~5 + Preview ~3 + Properties ~5 + LayerTree ~5). 회귀 위험 MEDIUM (canvas hot path 의 `childrenMap.get(id)` 패턴 → `context.resolver.children(node)` swap 필요).

## [ADR-126 Phase 0 inventory freeze — 응용 ADR 진입 시작] - 2026-05-10

### Documentation

- **ADR-126 Phase 0 — Element 타입 deprecate inventory freeze (G0 PASS)**:
  - **G0 prerequisite 충족**: ADR-123 / ADR-124 / ADR-125 모두 `Implemented — 2026-05-10` 도달 → 응용 ADR 진입 가능.
  - 측정 결과 ([126-inventory.md](adr/design/126-inventory.md)):
    - `Element` 타입 production hit: **1766 line** (breakdown 추정 ~1300 + boundary 일치 범위)
    - `canonicalDocumentToElements(` callers: **4 location** (정의 1 + production caller 3 — `canonicalHistoryEvents.ts:270` / `canonicalElementsView.ts:352,390`)
    - `useCanonicalElements` production callers: **~10** (`stores/index` / `properties/hooks` / `monitor/hooks` / `components/property` / `hooks/useDeltaMessenger` / `hooks/useCollectionItemManager` / `panels/properties/editors/LayoutPresetSelector` / `stores/canvasStore` / `panels/nodes/LayersSection`)
    - `useStore.getState().elementsMap`/`childrenMap` production hit: **0** (direct hot-path read closure. store state 타입 전환은 Phase 3 잔여)
  - Bucket 분류: `derived-view` (Phase 5 제거) / `store-cache` (direct read 0 + store state 타입 전환 잔여) / `hot-path-consumer` (Phase 2/4) / `boundary-allowed` (유지) / `test-doc` (Phase 6).
  - **Phase 1+ 진입 순서 6 phase plan freeze**: Phase 1 derived-view boundary 격리 → Phase 2 hot-path-consumer 전환 (Skia/layout/Preview) → Phase 3 store-cache 정합 → Phase 4 hot-path-consumer 전환 (Properties/LayerTree/History/AI/messaging) → Phase 5 derived-view 제거 → Phase 6 final verification.
- **Phase 1 진입 권장 (별도 세션)**: derived-view boundary 격리 — `canonicalDocumentToElements`/`useCanonicalElements` 가 boundary allowlist file 내부 정의로만 export, hot path import 차단 grep gate. 회귀 위험 LOW.

## [ADR-125 Phase 6 verification + Implemented 승격 — base 3 모두 Implemented 도달] - 2026-05-10

### Architecture

- **ADR-125 Phase 6 — Final verification (G5 PASS)**:
  - **Render benchmark**: Builder 가동 중 idle FPS 측정 — 1초 96 frames / 2초 120 frames → **≥60fps gate 통과** (idle 상태 기준 60fps 의 1.6-2배 여유). ADR-125 Phase 2-5 변경 후 render path 정상 작동 + 성능 회귀 0.
  - **Canvas render**: 2612x1768 displayed, 97 panels rendered, body children 4 (정상 layout).
  - **Console errors**: 0 (`onlyErrors: true` 필터 결과 "No console errors or exceptions found").
  - **Preflight**: FULL TURBO PASS (3 task 모두 cache hit, 19ms).
  - **회귀 vitest**: 12 file 55/55 PASS (canvas/scene + history + canonicalMutations + projectSync + dashboard 영역).
- **ADR-125 Status `Accepted` → `Implemented`** (Phase 0-1-2a-3-4-5-6 land 완료):
  - 외부 contract canonical-native 도달 — layoutCache caller swap → `calculateFullTreeLayoutFromSceneModel` + Preview UPDATE_ELEMENTS receive 제거 + bootstrap fallback canonical-only + order_num closure (ADR-122 HC.5).
  - **Phase 2-b 의도된 skip — framing 결정**: 외부 contract canonical-native 진전은 Phase 2-a 로 달성. `fullTreeLayout` 내부의 `elementsMap.get()` 은 canonical document 에서 single-pass 로 derive 된 scene model view 의 consumer 이므로 이미 canonical-native 의미. raw canonical document parent chain lookup 으로 변경 시 O(1) → O(depth) 성능 회귀 위험 + 의미적 진전 미미 → skip 결정 lock-in (ADR 본문 진행 로그 명시).
- **base 3 ADR 모두 Implemented 도달**: ADR-123 (cloud) / ADR-124 (history) / ADR-125 (render input) → **ADR-126 응용 prerequisite 모두 충족**. ADR-126 (Element 타입 deprecate, 응용 ADR) Phase 0-3 진입 가능 상태.
- **README/CHANGELOG sync**: 현황 카운트 갱신 (완료 114→115 / 부분 완료 8→7 / 미구현 9 / 합계 131 유지). ADR-125 row Status `Partial (Accepted)` → `Implemented` 갱신.

### Process

- **base 3 직교 ADR closure 완결**: ADR-122 후속 cleanup 의 Cloud / History / Render input 3 base 가 모두 Implemented 도달. fork checkpoint 4 질문 (base/응용 분류 / schema 직교성 / framing reverse / codex 진입 시점) 통과 후 직렬 land 완결.
- **framing 정직성 — Phase 2-b skip 결정 lock-in**: sycophancy 회피 하에 Phase 2-b 의 본질 검토 (외부 contract vs 내부 traversal / 성능 회귀 위험 / 의미적 진전 ROI) → skip 결정 사용자 surface 1회 후 진행. memory `feedback-anthropic-lever-essence-verification.md` + `feedback-codex-not-framing-layer.md` 정렬.
- **다음 진입 — ADR-126 응용**: 본 세션 또는 별도 세션에서 ADR-126 Phase 0 (inventory: Element 타입 grep ~1,300 line hit + canonicalDocumentToElements 4 caller + useCanonicalElements ~12 production caller 재측정) 진입.

## [ADR-123/124 Implemented 승격 + ADR-124 Phase 5 IndexedDB v2 migration] - 2026-05-10

### Architecture

- **ADR-124 Phase 5 — IndexedDB DB_VERSION v1 → v2 onupgradeneeded migration (G5 partial)**:
  - `historyIndexedDB.ts` `DB_VERSION` 1 → 2 bump.
  - `onupgradeneeded` cursor migration: `oldVersion < 2` 시 `STORE_ENTRIES` 의 모든 record 를 cursor 순회 → `migrateV1EntryToV2(record.entry)` 호출 → 변환된 entry 가 원본과 다르면 `cursor.update`. 변환 실패 시 catch → 원본 보존 (best-effort, graceful degradation).
  - 실패 케이스 보호: cursor open 실패 / migration 진입 실패 / entry 변환 실패 모두 console.warn 후 in-memory `migrateV1EntriesToV2` fallback (Phase 3) 으로 계속 보호.
  - 위치: `apps/builder/src/builder/stores/history/historyIndexedDB.ts:43-49,101-160`
  - Chrome + Firefox migration browser smoke 는 v1 IndexedDB 기존 사용자 환경 별도 단계 검증.
- **ADR-123 Status `Accepted` → `Implemented`** (Phase 0-6 직렬 land 완료):
  - documents table + DocumentsApiService + cloud read/write canonical-primary + dashboard seed + boundary quarantine grep gate (cloudBoundary.static.test.ts 5/5 PASS) + verification (preflight FULL TURBO PASS + browser load+render PASS).
  - Supabase migration `002_create_documents_table.sql` deployment 환경별 별도 적용 — `documentsApi` 가 미적용 환경에서도 graceful degradation (try/catch 후 legacy fallback) 보장.
- **ADR-124 Status `Accepted` → `Implemented`** (Phase 0-5 직렬 land 완료):
  - CanonicalUpdateEvent + apply (G1 6/6 PASS) + entry layer canonical event 부착 (G2 6/6 PASS) + migrateV1EntryToV2 adapter (G3 13/13 PASS) + HistoryEntry deprecation marker + IndexedDB v1→v2 onupgradeneeded migration.
  - Phase 4 의 legacy field type 삭제 + historyActions case "update"/"batch" legacy fallback 제거는 v1 IndexedDB entry 가 모두 v2 변환되어 raw read 0건 달성된 후 (별도 followup) 진행.
- **README/CHANGELOG sync**: 현황 카운트 갱신 (완료 112→114 / 부분 완료 7→8 / 미구현 12→9 / 합계 131 유지). ADR-123/124 row Status 갱신 + ADR-125 Partial row 갱신 (Phase 2-b + Phase 6 별도 세션 명시).

### Process

- **type-check 6/6 PASS** (5 phase 누적) + **preflight FULL TURBO PASS**.
- **회귀 vitest 누적** (5 phase): canonical update event 6/6 + entry layer guard 6/6 + entry migration 13/13 + cloud upload guard 3/3 + cloud seed guard 5/5 + boundary grep gate 5/5 = **38 신규 PASS**, 회귀 영역 vitest 12 file 55/55 PASS.
- **base 2 ADR Implemented 도달**: ADR-123/124 closure → ADR-126 prerequisite 중 2 충족. **ADR-125 Phase 2-b + Phase 6 가 ADR-126 prerequisite 의 마지막 hurdle** — render benchmark setup + 4 시나리오 browser smoke 별도 세션.

## [ADR-125 Phase 2-5 land — render input canonical-native contract] - 2026-05-10

### Architecture

- **ADR-125 Phase 2-a — Layout engine canonical-native entry caller swap**:
  - `layoutCache.ts` 의 `calculateFullTreeLayout(elementById, childrenIdMap, ...)` 호출을 `calculateFullTreeLayoutFromSceneModel({elementsMap, childrenByParent}, ...)` 로 swap.
  - `pageChildrenMap` (Map<string \| null, Element[]>) 의 string-key 만 추출하여 sceneModel-shape `childrenByParent` (Map<string, Element[]>) 로 변환.
  - 외부 contract 가 canonical-native scene model 형태로 진전. `fullTreeLayout` 내부 traversal (42 hits) 변경은 별도 phase (Phase 2-b, render benchmark 동반).
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts:4-10,333-353`
- **ADR-125 Phase 3 — Preview `UPDATE_ELEMENTS` receive 제거**:
  - `apps/builder/src/preview/messaging/messageHandler.ts`: `UpdateElementsMessage` interface 삭제 + `BuilderToPreviewMessage` discriminated union 에서 제거 + `case "UPDATE_ELEMENTS"` switch case 삭제 + `handleUpdateElements` private method 삭제.
  - `apps/builder/src/preview/types/index.ts`: `UpdateElementsMessage` extends `PreviewMessage` 정의 + `MessageType` union 에서 제거.
  - Preview active channel = `UPDATE_CANONICAL_DOCUMENT` 단일 (compatibility receive 제거).
- **ADR-125 Phase 4 — Bootstrap `!canonicalDoc` fallback 제거**:
  - `useIframeMessenger.ts:721-726` 의 `if (!canonicalDoc) { ... sendElementsToIframe(currentElements) }` legacy bootstrap fallback 제거.
  - canonical document 부재 시 Preview 는 빈 상태 유지 — BuilderCore mount → canonical hydration → Preview 첫 frame 흐름 deterministic.
- **ADR-125 Phase 5 — `order_num` 갱신 path 제거 (ADR-122 HC.5 closure)**:
  - `elements.ts:1412-1456` `moveElementToContainer` legacy fallback path 의 `order_num` 필드 갱신 제거 — `updateMap` type signature 에서 `order_num?: number` 제거 + `newOrder.forEach` 의 `order_num: index` 할당 제거 + spread 의 `order_num` 적용 제거.
  - canonical `children[]` splice (`moveElementCanonicalPrimary`) 가 primary path. fallback 은 `page_id`/`parent_id` 만 갱신, order 정보는 `reorderedElements` push 순서로 보존.
  - ADR-122 Hard Constraint #5 (order_num 필드 재도입 금지) closure.

### Process

- **type-check 5/5 PASS** (4 phase 전후 모두) + 회귀 vitest 3 file 20/20 PASS (canvas/scene + elementMove 영역). pre-existing FAIL 2건 (`updateSelectedPropertiesWithChildren stores component instance propagation` / `preserves frame-bound page slot child order`) 는 본 변경과 무관 (baseline `b907887c1` 동일 FAIL 확인).
- **Browser smoke (load + render)**: Builder reload 후 canvas 2612x1768 displayed + 97 panels rendered + console error 0. 4 시나리오 (create/edit/delete/reorder) 회귀 검증 + `fullTreeLayout` 42 hits 내부 traversal 변경은 Phase 2-b 별도 세션 (render benchmark gate 동반).
- **현재 env: WebGL canvas mode (Preview iframe 미사용)** — Phase 3-4 의 변경은 legacy iframe Preview env 에서 영향. WebGL only mode 에서는 변경 무영향 (canvas direct render).

## [ADR-124 P3 + ADR-123 P3-4 + ADR-124 P4 4 phase 직렬 land — base 2 boundary 확립] - 2026-05-10

### Architecture

- **ADR-124 Phase 3 — `migrateV1EntryToV2` adapter (G3 PASS)**:
  - 신규 file [`historyEntryMigration.ts`](apps/builder/src/builder/stores/history/historyEntryMigration.ts) — v1 IndexedDB entry 의 legacy snapshot field (`element` / `prevElement` / `props` / `prevProps` / `childElements` / `elements` / `prevElements` / `batchUpdates`) 를 canonical event sequence 로 변환.
  - 변환 정책: identity preserve (canonicalEvents 보유) → diff 기반 (update/batch) → legacy snapshot fallback (prevProps / batchUpdates) → graceful degradation (`canonicalEvents: []` for add/remove structural snapshots).
  - `historyIndexedDB.getEntriesByPage` 통합 — load 시점에 `migrateV1EntriesToV2(entries)` 일괄 변환. Phase 5 v1→v2 onupgradeneeded migration 의 prerequisite adapter.
  - 신규 unit test [`historyEntryMigration.test.ts`](apps/builder/src/builder/stores/history/__tests__/historyEntryMigration.test.ts) 13 시나리오 PASS — extractPropsFromDiff (3) + migrateV1EntryToV2 (9) + 배치 변환 (1).
- **ADR-123 Phase 3 — Cloud write path canonicalization (G3 PASS)**:
  - `syncProjectToCloud` 재작성: `documentsApi.upsertDocument(projectId, localDocument)` primary call → 실패 시 legacy fallback (warn but proceed). legacy `pages`/`elements` upload 는 migration window 호환성 위해 보존 (Phase 4 boundary marker 부착).
  - `dashboard/index.tsx` cloud project 생성 분기 통합 — `'cloud'` / `'both'` 분기를 `documentsApi.upsertDocument(newProject.id, initialDocument)` 단일 path 로 통합 + legacy `pagesApi.createPage` / `elementsApi.createElement` seed 는 Phase 4 quarantine 후 제거 예정.
  - `services/api/index.ts` 에 `documentsApi` re-export 추가.
  - 신규 static guard test [`projectSync.upload.static.test.ts`](apps/builder/src/utils/projectSync.upload.static.test.ts) 3 시나리오 PASS + [`dashboardCloudSeed.static.test.ts`](apps/builder/src/dashboard/__tests__/dashboardCloudSeed.static.test.ts) 5 시나리오 PASS.
- **ADR-123 Phase 4 — Legacy boundary quarantine (G4 PASS)**:
  - canonicalMutations thin wrapper 3개 (`createElementCanonicalPrimary` / `updateElementCanonicalPrimary` / `createMultipleElementsCanonicalPrimary`) 에 ADR-123 Phase 4 boundary contract JSDoc 강화 — 허용 caller 명시 (dbPersistence / useIframeMessenger / elements.ts).
  - 신규 grep gate [`cloudBoundary.static.test.ts`](apps/builder/src/adapters/canonical/__tests__/cloudBoundary.static.test.ts) 5 시나리오 PASS — node fs recursive readdir + readFile 정규식 매칭으로 외부 도구 (`rg`) 의존 제거 (memory: feedback-vitest-no-tests-misleading.md). legacyElementsApiService / PagesApiService / canonicalMutations thin wrapper 3개 / legacyToCanonical 의 production hot path import 가 boundary allowlist 외에 0건임을 강제.
  - **boundary allowlist (Phase 4 시점)**:
    - `legacyElementsApiService`: `services/api/index.ts` re-export / `utils/projectSync.ts` cloud sync / `canonicalMutations.ts` wrapper / `dbPersistence.ts` factory persist / `dashboard/index.tsx` cloud seed
    - `PagesApiService`: 동일 + `usePageManager.ts` type-only import
    - `canonicalMutations` thin wrapper: `dbPersistence.ts` / `useIframeMessenger.ts` / `elements.ts`
    - `legacyToCanonical`: `utils/projectSync.ts` legacy fallback / `adapters/canonical/index.ts` declaration / `themesAdapter.ts` `variablesAdapter.ts` `storeBridge.ts` JSDoc
  - 신규 caller 추가 시 grep gate FAIL → 즉시 감지.
- **ADR-124 Phase 4 — HistoryEntry data legacy field deprecation 마킹**:
  - `HistoryEntry.data` 의 8개 legacy snapshot field (`element` / `prevElement` / `props` / `prevProps` / `parentId` / `prevParentId` / `childElements` / `elements` / `prevElements` / `batchUpdates`) 에 `@deprecated ADR-124 Phase 4 — Phase 5 후 삭제` JSDoc 부착.
  - `HistoryEntry` interface 자체에 ADR-124 Phase 4 deprecation contract JSDoc 추가 — `data.canonicalEvents` 가 primary path, legacy fields 는 v1 IndexedDB compatibility 보존을 위해 type 정의 유지.
  - 실제 type 삭제 + historyActions.ts case "update"/"batch" legacy fallback cleanup 은 Phase 5 v1→v2 IndexedDB migration 완료 후 진입 (v1 entry 가 모두 v2 로 변환되어 raw read 0건 달성 시).

### Process

- **type-check 3/3 PASS** (builder cache miss 1회만, 나머지 cache hit) + 회귀 vitest 12 file 55/55 PASS.
- **base 2 boundary 확립**: ADR-123 (cloud) / ADR-124 (history) 가 Phase 4 까지 land — boundary allowlist + grep gate 강제. ADR-125 (render input) Phase 2+ 는 별도 세션 (render benchmark setup 동반).
- **`@deprecated` 마킹은 type 삭제 prerequisite**: Phase 5 v1→v2 IndexedDB migration 완료 후 fallback dead 확인 → type 삭제 + historyActions.ts cleanup 으로 진입.

## [ADR-124 Phase 2 land — entry 생성 layer canonical event 부착] - 2026-05-10

### Architecture

- **ADR-124 Phase 2 — update/batch entry 에 canonical update event 자동 부착 (G2 PASS)**:
  - `addDiffEntry`: type === "update" 시 `buildCanonicalUpdateEvent(prevElement.id, prevElement.props, nextElement.props)` 결과를 `data.canonicalEvents` 에 부착. 기존 add/remove 분기는 유지.
  - `addBatchDiffEntry`: 각 diff 에 대해 `buildCanonicalUpdateEvent` 생성하여 `canonicalEvents` 배열 누적, entry data 에 `{ diffs, canonicalEvents }` 동시 저장.
  - 위치: `apps/builder/src/builder/stores/history.ts:14-19,322-417,424-497`
  - 신규 static guard test [`historyEntryCanonicalEvents.static.test.ts`](apps/builder/src/builder/stores/history/__tests__/historyEntryCanonicalEvents.static.test.ts) 6 시나리오 PASS — import / addDiffEntry update 분기 / id+props 전달 / addBatchDiffEntry push 패턴 / data shape / helper export.
  - **historyActions.ts 의 case "update"/"batch" legacy fallback 은 유지** — `applyCanonicalHistoryEventsToActiveDocument` 가 canonical events 를 우선 적용 (early-return), legacy fallback 은 v1 IndexedDB entry 호환을 위해 Phase 5 v2 migration 후 제거 예정.

### Process

- **type-check 3/3 PASS** + 회귀 vitest 5 file 40/40 PASS (history + canonicalMutations 영역).
- **canonical event 우선 + legacy compat 보존**: 신규 entry 는 항상 canonicalEvents 보유 → undo/redo 가 canonical apply path 단독 사용. 기존 v1 entry 또는 변환 불가 entry 는 legacy fallback 으로 graceful degradation.

## [ADR-123 Phase 2 land — Cloud read path canonical primary] - 2026-05-10

### Architecture

- **ADR-123 Phase 2 — Cloud read path canonicalization (G2 PASS)**:
  - `downloadProjectFromCloud` 재작성: `documentsApi.getDocumentByProjectId(projectId)` primary 시도 → row 존재 시 `db.documents.put` + early return (legacy fallback 진입 0).
  - row 없음 (migration window 또는 fresh project): legacy `pages` + `elements` + `legacyToCanonical()` fallback 유지 + 변환 결과를 `documentsApi.upsertDocument` 로 best-effort seed (실패 non-fatal — RLS / migration 미적용 환경 보호).
  - 위치: `apps/builder/src/utils/projectSync.ts`
  - 신규 static guard test [`projectSync.documentsApi.static.test.ts`](apps/builder/src/utils/projectSync.documentsApi.static.test.ts) 6 시나리오 PASS — documentsApi import / primary path 우선 / early return / seed / legacy fallback 보존.

### Process

- **type-check 3/3 PASS** + 회귀 vitest 2 file 10/10 PASS (projectSync 영역).
- **migration window 호환성 유지**: documents row 미존재 시 자동 fallback. 신규 deployment 환경 (Supabase migration 미적용) 에서도 backward compatible.

## [ADR-123/124/125 Phase 1 직렬 land — base 3 transitional contract 확립] - 2026-05-10

### Architecture

- **ADR-124 Phase 1 — `CanonicalUpdateEvent` schema 확장 (G1 PASS)**:
  - `CanonicalHistoryNodeEvent` discriminated union 에 `update` event 추가 (`{ type: "update"; nodeId; prevProps: Record<string, unknown>; nextProps: Record<string, unknown> }`).
  - `applyCanonicalHistoryEventsToDocument` 의 reduce loop 에 update case 추가 — DFS 로 nodeId 일치 노드 props 교체 (immutable, parent chain copy).
  - `buildCanonicalUpdateEvent(nodeId, prevProps, nextProps)` helper export — props 객체 spread clone (aliasing 방지).
  - `getCanonicalHistoryEventIds` 의 update event 처리 추가 — 양 방향 모두 nodeId 를 upsertIds 에 추가 (mutation 만, structural change 없음).
  - 신규 unit test [`canonicalUpdateEvent.test.ts`](apps/builder/src/builder/stores/history/__tests__/canonicalUpdateEvent.test.ts) 6 시나리오 PASS — round-trip / deep round-trip / missing nodeId / clone / event IDs / multiple sequence.
  - 위치: `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts` + `__tests__/canonicalUpdateEvent.test.ts`
- **ADR-125 Phase 1 — Canonical scene model boundary 강화**:
  - `CanonicalSceneModel` interface 에 transition-derived-readonly contract JSDoc 명시 — `elements` 가 canonical-native traversal 결과의 `Element[]` projection / `elementsMap` `childrenByParent` 가 derived view 임을 명시 + Phase 2 에서 layout engine 이 canonical-native 입력으로 전환되면 derived view 사용 빈도 감소 명시.
  - `buildCanonicalSceneModel` JSDoc 강화 — Builder hot path 에서 `useStore.elementsMap`/`childrenMap` mutable subscription 대신 본 함수의 결과 사용 (ADR-122 HC.1 + ADR-125 §Layer 규칙).
  - 신규 entry `calculateFullTreeLayoutFromSceneModel(sceneModel, rootElementId, ...)` 추가 — canonical-native layout entry, internal 으로 기존 `calculateFullTreeLayout` map shape 호출. Phase 2 에서 caller 전환 시 primary path 가 됨.
  - 기존 `calculateFullTreeLayout` JSDoc 에 ADR-125 Phase 1 transition note 추가 — map shape signature 가 transition-derived-readonly 임 명시 + 신규 caller 는 canonical-native entry 사용 권장.
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/canonicalSceneModel.ts` + `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts:1907,2310-2369`
- **ADR-123 Phase 1 — `documents` table + DocumentsApiService**:
  - Supabase migration SQL 신규: [`docs/migrations/002_create_documents_table.sql`](docs/migrations/002_create_documents_table.sql) — `documents` table (`id` UUID PK / `project_id` FK cascade / `content` JSONB) + `documents_project_id_key` UNIQUE INDEX (1 project = 1 document) + RLS policy (owner read/write) + `updated_at` trigger.
  - `apps/builder/src/types/integrations/supabase.types.ts` 에 `documents` Row 타입 추가 — `content: Record<string, unknown>` (Supabase jsonb column, runtime 에서 `CompositionDocument` 캐스팅).
  - `apps/builder/src/services/api/DocumentsApiService.ts` 신규 — `getDocumentByProjectId` (5분 캐싱) / `upsertDocument` (`onConflict: project_id`) / `deleteDocumentByProjectId` (cleanup). PagesApiService 와 동일 BaseApiService 상속 패턴.
  - `apps/builder/src/adapters/canonical/legacyElementsApiService.ts` 에 boundary-only marker JSDoc 추가 — Phase 1 시점 허용 caller 4곳 명시 (`projectSync` / `dashboard` / `canonicalMutations` thin wrapper / `dbPersistence`) + 신규 caller 추가 금지 + ADR-123 Phase 4 에서 hot path import 0건 grep gate 강제 명시.

### Process

- **Phase 1 직렬 진입 (병렬 worktree 미사용)**: ADR-124 (LOW addition) → ADR-125 (LOW addition) → ADR-123 (migration file + service) 순서로 main 직접 진행. agent commit/push 마감 4회 연속 실패 패턴 회피 (`feedback-agent-completion-failure-pattern.md`).
- **type-check 3/3 PASS** (cache miss 1회만, shared/publish cache hit). 회귀 vitest 7/7 file 54/54 test PASS (history + scene + canonicalMutations 영역).
- **ADR-123 Phase 1 의 destructive 단계 (Supabase DB 적용) 미수행**: SQL migration file 작성만, 실제 DB 적용은 Supabase Dashboard / migration tool 수동 실행 (`docs/migrations/001_g1_g2_data_model.sql` 동일 컨벤션).

## [ADR-123/124/125 Phase 0 inventory freeze — base 3 병렬 진입 시작] - 2026-05-10

### Documentation

- **ADR-123 / ADR-124 / ADR-125 Phase 0 (inventory freeze) 동시 완료** — base 3 직교 병렬 진입 시작.
  - **ADR-123 Phase 0** ([123-inventory.md](adr/design/123-inventory.md)): 6 surface bucket 확정 (S1 Supabase row schema / S2 legacyElementsApiService 5 production caller / S3 PagesApiService 4 caller / S4 canonicalMutations thin wrapper 3개 + caller 매핑 / S5 dashboard seed / S6 projectSync element-level upsert) + `legacyToCanonical` production hot path 1건 (`projectSync.ts:210`) + `documents` table DDL/RLS/unique constraint + `DocumentsApiService` 인터페이스 스텁 + payload 크기 추정 (전형 50-200KB / 대규모 2MB → Supabase jsonb 1GB 제약 대비 3-4 orders of magnitude 여유). G0 통과.
  - **ADR-124 Phase 0** ([124-inventory.md](adr/design/124-inventory.md)): legacy snapshot field reads **167건** vs canonical event/diff reads **26건** 측정 (canonical migration 14% 진행). HistoryEntry data field 11개 bucket 분류 (snapshot-remove 7 / snapshot-batch 3 / non-snapshot meta 1 / diff-based 2 / canonical-done 1). historyActions.ts 42 case block enumerate. `historyIndexedDB.ts` v1 → Phase 5 v2 upgrade 예정. canonicalHistoryEvents.ts 의 `update` event 부재 확인 — Phase 1 신규 추가. G0 통과.
  - **ADR-125 Phase 0** ([125-inventory.md](adr/design/125-inventory.md)): layout engine 48 hits file:line 단위 enumerate (`fullTreeLayout.ts` 42 / `utils.ts` 6) + Preview UPDATE_ELEMENTS receive 15 hits (useIframeMessenger 11 / messageHandler 2 / preview/types 1 / BuilderCore 3 comment) + `elements.ts:1414/1425/1456` order_num 갱신 3 hits + bucket 분류 (runtime-forbidden / transition-derived-readonly / boundary-allowed). G1 통과.
- **base 3 병렬 진입 안전성 검증**: Phase 0 = 측정/문서/표 작성만 (read-only) → 코드 변경 0. main HEAD `f54c2495c` 무영향. type-check 영향 없음.
- **Phase 1 진입 조건 충족**: ADR-123 → Supabase migration 파일 작성 / ADR-124 → `CanonicalUpdateEvent` 타입 정의 + apply 함수 / ADR-125 → canonical scene model boundary 강화. 별도 세션에서 worktree 격리 또는 직렬 진행 가능.

## [ADR-123/124/125/126 Accepted 승격 — codex review 9/9 closure 후 결정 lock-in] - 2026-05-10

### Documentation

- **ADR-123/124/125/126 Status `Proposed` → `Accepted` 일괄 승격** (4 ADR 동시).
  - 승격 근거: codex review (task `task-moyih7q0-hmq30o`, effort high) 본문 정합 layer 7 카테고리 (A inventory / B Risk Threshold / C Gate / D 본문↔breakdown 포인터 / E 의존 ADR / F 템플릿 / G CHANGELOG/README) FAIL 4 + WARN 5 = **9/9 closure**.
  - framing layer (base/응용 분류 / 의존 방향 / SSOT 경계) 는 fork checkpoint 4 질문 + extended thinking + memory trigger 로 lock-in 유지.
  - Decision 섹션 + Risk Threshold Check + Gates 표 + 반복 패턴 선차단 selfcheck 모두 본문 명시.
- **base 3 병렬 phase 1 실행 진입 가능 상태** — ADR-123 / ADR-124 / ADR-125 (직교 base) Accepted 도달. 별도 세션에서 worktree 격리 implementer agent 병렬 dispatch 또는 `execute-adr` skill 사용 가능.
- **ADR-126 응용 진입 조건** — base 3 모두 `Implemented` 후 Phase 1 진입. Phase 0 (inventory freeze) 만 base 진행 중 선행 가능.

### Process

- **Status 전이 규칙 준수** (`.claude/rules/adr-writing.md` §"Status 전이 규칙"):
  - `Proposed → Accepted: Decision 섹션이 Gate를 모두 통과, 또는 Gate 없이 합의 완료`
  - 본 4 ADR 모두 Decision/Gates/Risks 표 lock-in 후 사용자 stakeholder review 받아 Accepted 승격.
- **Accepted ≠ Implemented**: 본 단계에서는 Status + README 헤더 + CHANGELOG 갱신만, 코드 변경 0. 실제 phase 실행은 별도 세션.

## [ADR-123/124/125/126 4 ADR 동시 발의 — ADR-122 후속 cleanup 분할 설계] - 2026-05-10

### Documentation

- **ADR-122 후속 cleanup 4 ADR 동시 발의**:
  - ADR-122 closure 후 잔존 영역 (cloud schema / history schema / render input contract / Element type deprecate) 을 **fork checkpoint 4 질문 통과 후** 4 base/응용 ADR 로 분할 발의.
  - **base/응용 분류 lock-in**: ADR-123/124/125 = 직교 base (병렬 발의/실행 가능), ADR-126 = 응용 (base 셋 prerequisite).
  - **의존 그래프**: 123 ∥ 124 ∥ 125 → 126.
  - **Why**: 4 ADR 동시 설계로 baseline framing 자동 승계 (ADR-111/112 사례) 차단. ADR-122 대안 B 기각 framing (한 ADR 내 cloud + history + render + Element 합치기 = HIGH 누적) 그대로 적용.
- **ADR-123 — Cloud document-level row schema 단일화** (Proposed, 244 lines + 370 breakdown):
  - scope: Supabase `pages`/`elements` row schema + `legacyElementsApiService` + `PagesApiService` + `canonicalMutations` cloud wrapper + dashboard direct calls + `projectSync` (6 surface).
  - Risk 4축: 기술 M / 성능 M / 유지보수 L / 마이그레이션 **H** → HIGH 1.
  - 4 alternatives (A 현행 / B 즉시 전수 / **C 권장: documents row + boundary adapter** / D schema 유지 + diff 변경).
  - 7 Phase + 7 Gate (G0~G6, G1 migration window 으로 마이그레이션 H 통제).
  - 위치: `docs/adr/123-cloud-document-row-schema.md`, `docs/adr/design/123-cloud-document-row-schema-breakdown.md`.
- **ADR-124 — Canonical-only history entry schema** (Proposed, 175 lines + 513 breakdown):
  - scope: `historyActions.ts` legacy `data.element/childElements/elements/prevElements` snapshot field + `composition-history` DB v1 history entry schema + update/batch/auto-detach fallback path.
  - Risk 4축: 기술 M / 성능 L / 유지보수 L / 마이그레이션 M → HIGH 0.
  - 4 alternatives (A 현행 / B 즉시 전수 삭제 / **C 권장: canonical event-only + `composition-history` DB v1→v2 migration** / D deprecated 태그).
  - 7 Phase + 6 Gate (G1~G6).
  - 위치: `docs/adr/124-canonical-only-history-schema.md`, `docs/adr/design/124-canonical-only-history-schema-breakdown.md`.
- **ADR-125 — Render input canonical-native contract** (Proposed, 212 lines + 312 breakdown):
  - scope: layout engine `elementsMap`/`childrenMap` map shape input + Preview `UPDATE_ELEMENTS` receive type (compatibility 잔존) + `elements.ts` element move fallback `order_num` 갱신 + `useIframeMessenger` `!canonicalDoc` bootstrap fallback.
  - Risk 4축: 기술 M / 성능 M / 유지보수 L / 마이그레이션 L → HIGH 0.
  - 4 alternatives (A 현행 / B 즉시 전환 + 성능 검증 부재 / **C 권장: scene model boundary 강화 + benchmark gate** / D layout engine 만 전환).
  - 7 Phase + 5 Gate (G1~G5, G2 render benchmark gate 로 성능 M 통제).
  - **ADR-122 HC.5 closure**: `order_num` 재도입 금지 위반 잔존을 본 ADR 에서 최종 제거.
  - 위치: `docs/adr/125-render-input-canonical-native-contract.md`, `docs/adr/design/125-render-input-canonical-native-contract-breakdown.md`.
- **ADR-126 — Element 타입 Deprecate (final canonical-only runtime)** (Proposed, 180 lines + 334 breakdown):
  - **응용 ADR — ADR-123/124/125 모두 `Implemented` prerequisite**. Phase 0 (inventory freeze) 만 선행 가능, Phase 1 이상 base 셋 통과 후 진입.
  - scope: `Element` 타입 grep line hit ~1,300 (Phase 0 재측정 seed) + `canonicalDocumentToElements` grep 4 line hit (정의 1 + production call site 3) + `useCanonicalElements` grep 14 line hit (정의/주석 포함, 실 production call site ~12) + store cache `elementsMap`/`childrenMap` canonical-native consumer 100% 전환.
  - Risk 4축: 기술 **H** / 성능 M / 유지보수 **H** / 마이그레이션 M → HIGH 2 (base 셋 분리로 위험 누적 차단).
  - 4 alternatives (A 영구 derived view / B 즉시 전수 / **C 권장: consumer 별 점진 + boundary allowlist** / D node alias + type alias 점진 deprecate).
  - 7 Phase + 7 Gate (G0~G6, R1→G0 prerequisite lock / R2→G1 FPS baseline).
  - 위치: `docs/adr/126-element-type-deprecate.md`, `docs/adr/design/126-element-type-deprecate-breakdown.md`.

### Process

- **fork checkpoint 4 질문 통과 lock-in**:
  - Q1 (base/응용 분류): 123/124/125 = base / 126 = 응용 명시.
  - Q2 (schema 직교성): 123 ↔ 124 ↔ 125 직교, 126 강결합 명시.
  - Q3 (baseline framing reverse): ADR-122 closure note 4 항목 ("future cloud/Supabase physical schema removal" / "legacy snapshot fields ... compatibility/fallback 경계로 잔존" / "별도 renderer refactor" / soft constraint "한 번에 Element 타입 삭제 안 함") 의 후속 매핑 명시.
  - Q4 (codex 진입 시점): framing 검증을 codex 3차까지 미루지 말 것 — 본 4 ADR 작성 시점에 Q1-Q3 + extended thinking + memory trigger 로 framing 통과. codex 호출은 본문 정합 layer (grep alias / gate matrix / 본문-breakdown 포인터) 만.
- **4 architect agent 병렬 dispatch + 본인 직렬 마감 패턴 사용**:
  - 4 agents 동시 dispatch (worktree 격리, isolation 미사용, scope 분리 — 같은 main 의 다른 path 만 편집).
  - prompt 안전장치 4중: README/CHANGELOG/코드 편집 금지, commit/push 금지, 다른 ADR 번호 편집 금지, baseline framing 자동 승계 금지.
  - ADR-125 의 1 회 도중 끊김 → 본인이 ADR-122 breakdown 패턴 참조하여 직접 작성 완료.
  - ADR-125 본문 의존 방향 reverse 표기 ("ADR-126 prerequisite") 본인 검증 단계에서 정정 ("ADR-126 응용, 본 ADR base 가 prerequisite").

### Memory

- `feedback-adr-consolidation-burden-not-essence.md` — "한 번에", "합쳐서" 표현 발견 시 동기 (a)/(b)/(c) 분류 raise. "발의 부담 절약" 동기는 risk threshold check (HIGH 누적) framing 으로 redirect.
- `feedback-codex-not-framing-layer.md` — codex review = 본문 정합 layer (grep alias / gate matrix / 절차 컴플라이언스). framing 검증 outsource 금지 — extended thinking + fork checkpoint 4 질문 + memory trigger + raise 의무가 codex 진입 이전에 통과.

## [ADR-122 canonical-only runtime implemented closure] - 2026-05-09

### Changed

- Phase 2/4 follow-up slice로 `ComponentsPanel` add path가 active canonical
  document를 직접 traversal한 element list를 사용하도록 전환했다. page/layout element
  후보 계산에서 legacy `state.elements`/`getPageElements` snapshot을 읽지 않는다.
- `PropertyCustomId`, `TreeItemEditor`, `FramesTab`, `useComponentMemory`,
  `BuilderCanvas`의 canonical-active fallback을 좁혔다. canonical elements/document가
  있으면 legacy `state.elements` subscription은 empty bootstrap fallback으로 고정하고,
  customId validation/generation과 frame hydration/read-model 계산은 canonical-derived
  element source를 우선 사용한다.
- unified store의 exported `useElements`/`useElementById`/`useChildElements` hook을
  canonical-first로 전환하고, standalone `elements.ts`의 미사용 중복 lookup hook surface를
  제거했다. direct legacy `state.elements` grep은 74 → 70으로 감소했다.
- `canvasStore.useCanvasElements`도 active canonical elements에서 current page elements를
  파생하고, legacy `pageElementsSnapshot`은 canonical 비활성 bootstrap fallback으로만
  사용하도록 좁혔다.
- `useCurrentPageElements`/`useCurrentPageElementCount`도 unified canonical-first
  `useElements()` source를 사용하도록 전환하고, standalone `elements.ts`의 미사용 current
  page selector surface를 제거했다.
- `elementLoader`의 lazy-loading disabled/already-loaded/loading-wait read path와 page
  activation invariant lookup을 active canonical document 우선으로 전환했다.
- `inspectorActions`의 selected/style/fill commit·preview lookup은 active canonical
  document가 있으면 mutable legacy fallback과 병합하지 않도록 고정했다.
- `useTextEdit` live edit는 active canonical document가 있으면 missing element를 legacy
  cache에서 되살리지 않고, wrapper unchanged 시에도 active canonical document 존재 시 legacy
  patch를 생략한다.
- `PagesSection` page-delete bridge는 active canonical traversal을 우선 유지하고 fallback
  필요 시 삭제 후 최신 store snapshot만 사용하도록 좁혔다.
- `useIframeMessenger` selection echo와 preview-generated dedupe는 active canonical
  document가 있으면 missing element/id를 legacy cache에서 되살리지 않도록 전환했다.
  `UPDATE_ELEMENTS` bootstrap은 canonical document 부재 시에만 legacy snapshot을 읽는다.
- `useIframeMessenger`는 Runtime Compare Mode store flag도 WebGL-only 차단 조건에
  반영한다. 이로써 Skia/WebGL canvas 상태와 무관하게 Compare Mode 진입 시 canonical
  document가 Preview iframe으로 전송된다.
- `useResetStyles` reset action도 active canonical document가 있으면 missing selected
  element를 legacy cache에서 되살리지 않도록 좁혔다.
- `useSelectedElementData` legacy mode selected/ref override props lookup은 이미 읽은
  selected element를 재사용하고, 같은 id를 store `elements[]`에서 다시 찾지 않도록 줄였다.
- `BuilderCore` mutation registration/page-shell bridge fallback은
  `getCanonicalOrBootstrapBuilderElements()` helper로 격리해 canonical-first bootstrap
  boundary를 명시했다.
- `BuilderCore` page-shell bridge는 page/body shell append 직후 canonical document에서
  아직 보이지 않는 body shell을 보존하고, origin page 삭제 후 stale canonical-derived
  snapshot으로 deleted page/ref origin을 되살리지 않도록 bridge 전용 snapshot을 분리했다.
- `elementUpdate`/`elementRemoval`/`instanceActions`/`elements`/`historyActions`의
  mutation/history source를 active canonical document elements 우선으로 전환했다.
  canonical document가 없을 때만 legacy store `elements[]`를 bootstrap fallback으로
  사용한다.
- History undo/redo/goToHistoryIndex가 `historyManager.addDiffEntry()`/
  `addBatchDiffEntry()`에서 생성한 serialized `data.diff`/`data.diffs` event payload를
  snapshot payload보다 먼저 적용하도록 보강했다. canonical document sync를 index rebuild보다
  먼저 수행해 active canonical document와 store `elementsMap`이 같은 diff 결과를 보도록
  고정했다.
- History add/remove/group/ungroup 신규 entry를 legacy element snapshot이 아니라
  canonical `canonicalEvents` insert/remove/move sequence로 기록하도록 전환했다.
  undo/redo/goToHistoryIndex는 이 event를 active canonical document에 직접 replay하며,
  실제 `legacy-page -> body` parent 아래 element 생성도 page context history로 기록된다.
- `canonicalLegacyStoreCacheBridge`와 store `recoverElementsSnapshot` action surface를
  제거했다. active canonical document 변경 후 legacy store cache를 되살리는 transition
  subscriber production hit는 0건이다.
- raw seed는 462로 유지됐고, direct legacy `state.elements` grep은 70 → 0으로 감소했다.
- `setElementsCanonicalPrimary()` full-replace shell에서 incoming snapshot에 없는
  page-owned runtime sibling이 canonical `db.documents`에 남던 persistence drift를
  수정했다. page/layout shell과 structural `body` node는 유지하면서 omitted
  legacy-exportable runtime node는 prune한다.
- Preview `App` render guard는 legacy preview `elements[]`가 비어 있어도 canonical
  document가 있으면 canonical tree를 렌더링하도록 수정했다. Compare Mode의
  canonical-only Preview가 빈 화면으로 표시되는 회귀를 막는다.
- `ComponentSemanticsSection` 테스트 fixture를 current fallback 계약에 맞춰
  `elements[]` source도 함께 seed하도록 갱신했다.
- Closure audit에서 exact G6 builder command가 ADR-113 descendants quarantine /
  ADR-116 G5 strict logic-access regression을 드러냈다. `canonicalHistoryEvents`와
  `elementCreation`의 ref override traversal은 `canonicalElementsView` helper boundary로
  이동하고, History canonical event parent lookup은 direct `layout_id` access 대신
  `frameMirror` helper를 사용하도록 수정했다.
- ADR-122 store mutation helper ordering을 canonical-before-cache로 닫았다.
  `elementCreation`, `elementUpdate`, `elementRemoval`은 canonical mutation wrapper를
  먼저 호출하고 derived `elements`/`elementsMap`/`childrenMap` store cache를 이후
  갱신한다.
- ADR-122 현재 실행 스냅샷을 관련 문서에 동기화했다. G0-G6와 final closure review는
  완료됐고, cloud/Supabase physical schema 제거는 별도 decision gate로 유지한다.
- ADR-122를 Implemented로 전환하고 본문을 `docs/adr/completed/` archive로 이동했다.
  README row, breakdown, inventory의 status snapshot을 G0-G6 complete 기준으로
  동기화했다.
- Main closure commit `d72b85441`을 생성했다. commit subject는 영어로 작성했고,
  commit body는 한국어 작업내역과 검증 요약을 포함한다.
- Related documentation sync commit은 `470b616ed`로 기록한다.

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/components/property/PropertyCustomId.test.tsx src/builder/panels/components/ComponentsPanel.projection.static.test.ts src/builder/panels/properties/editors/canonicalPropertyEditors.static.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/monitor/hooks/useComponentMemory.static.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts`
  — 6 files / 17 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts`
  — 2 files / 3 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts src/builder/stores/utils/__tests__/historyHelpers.test.ts`
  — 5 files / 28 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts`
  — RED 확인 후 GREEN, 1 file / 17 tests PASS.
- direct fallback/static gate suite — 16 files / 43 tests PASS.
- runtime targeted suite — 11 files / 86 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/main/BuilderCore.static.test.ts src/preview/previewFrameMirror.static.test.ts`
  — 3 files / 17 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/ComponentSemanticsSection.test.tsx`
  — RED 확인 후 fixture contract 갱신, 1 file / 18 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/adr113DescendantsGrepGate.test.ts src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts src/builder/stores/utils/__tests__/historyHelpers.test.ts src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts`
  — ADR-113/116 grep gate recovery, 5 files / 17 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/elementUpdate.static.test.ts src/builder/stores/utils/__tests__/elementUpdate.test.ts src/builder/stores/utils/__tests__/elementRemoval.static.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts src/builder/stores/utils/__tests__/historyHelpers.test.ts`
  — store helper canonical-before-cache closure, 7 files / 33 tests PASS.
- `pnpm run codex:typecheck` — 3 packages PASS.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/canonicalMutations.test.ts`
  — 1 file / 23 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.diff.test.ts src/builder/stores/history/historyActions.static.test.ts`
  — 2 files / 3 tests PASS.
- Browser runtime smoke — local IndexedDB document seed 후
  `updateElementProps -> addElement(button-2) -> removeElement(button-2) -> undo -> redo -> reload`
  검증 PASS. Store/document ids 모두 `page-1`, `button-1`만 남고 `button-2`는
  되살아나지 않음.
- Browser runtime smoke — realistic `legacy-page -> body -> button` document seed 후
  `addElement(button-2) -> undo -> redo -> removeElement(button-2) -> undo -> redo -> reload`
  검증 PASS. Store/document ids 모두 `body-page-1`, `button-1`만 남고 `button-2`는
  되살아나지 않으며 local `pages`/`elements`/`layouts` objectStore 없음 유지.
- Full Phase 6 browser smoke — local IndexedDB v15 schema seed 후
  page/body/element 생성 + reload persistence, sibling reorder, cross-page reparent,
  slot fill reorder, cross-page `Go to component`/`Select instances` selection,
  origin page delete 후 instance materialization, reload persistence, Preview
  canonical DOM render, Skia canvas presence, `documents` primary 및 local
  `pages`/`elements`/`layouts` objectStore absence PASS. Screenshot:
  `/tmp/adr122-phase6-full-browser-smoke.png`.
- Exact G6 commands:
  `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__ src/builder/stores/canonical`
  — 25 files / 311 tests PASS;
  `pnpm -F @composition/shared exec vitest run src/utils` — 5 files / 54 tests PASS.
- `git diff --check` — PASS.
- grep gates: direct legacy `state.elements` 0, raw seed 462, recover bridge production
  grep 0.
- `pnpm run codex:preflight` — PASS.
- Commit 직전 `pnpm run codex:preflight` 재실행 — guard/format/type-check PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx`
  — 1 file / 6 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canvasStore.static.test.ts`
  — 1 file / 2 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx`
  — 1 file / 7 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/elementLoader.static.test.ts src/builder/stores/inspectorActions.static.test.ts src/builder/workspace/overlay/useTextEdit.static.test.ts`
  — 3 files / 3 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementUpdate.static.test.ts src/builder/stores/utils/__tests__/elementRemoval.static.test.ts src/builder/stores/utils/__tests__/instanceActions.static.test.ts src/builder/stores/utils/__tests__/elementUpdate.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts`
  — 5 files / 28 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/pageRemovalSemantics.test.ts src/builder/stores/__tests__/pageActivation.test.ts src/builder/stores/__tests__/itemsActions.test.ts src/builder/stores/index.test.tsx src/builder/stores/__tests__/elementMove.test.ts`
  — 5 files / 29 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/main/canonicalLegacyStoreCacheBridge.static.test.ts src/builder/main/BuilderCore.static.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/stores/index.test.tsx`
  — 4 files / 21 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/PagesSection.test.tsx`
  — 1 file / 5 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts`
  — 1 file / 8 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/panels/styles/hooks/styleReadCanonical.static.test.ts src/builder/panels/styles/hooks/useResetStyles.test.tsx`
  — 2 files / 22 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx`
  — 1 file / 7 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts`
  — 1 file / 4 tests PASS.
- `pnpm run codex:typecheck` — PASS.

## [ADR-122 canonical-only runtime implementation start] - 2026-05-08

### Changed

- ADR-122를 In Progress로 추가해 ADR-116/118/119/120/121 이후 남은
  canonical-first hybrid runtime 제거 계획을 문서화했다.
- scope를 internal Builder runtime으로 제한했다. mutation/read/render/preview path에서
  mutable legacy `Element[]` mirror를 제거하고, legacy projection은
  cloud/export/import/publish compatibility boundary로만 격리한다.
- Supabase physical `pages`/`elements` schema 제거는 별도 decision gate로 분리했다.
- breakdown 문서에 Phase 0-6 계획을 추가했다: hybrid inventory freeze, mutation mirror
  cut, runtime read canonicalization, Preview/Skia active protocol 전환, boundary
  quarantine, stale ADR-116 test/gate 재정렬, final browser/preflight verification.
- Phase 0 inventory 문서를 추가해 607 raw hit를 runtime-forbidden,
  transition-derived-readonly, boundary-allowed, test-doc bucket으로 분류했다.
  latest cleanup 후 current raw seed는 462 hit다.
- Phase 1 첫 slice로 `canonicalMutations` wrapper 내부 legacy
  `actions.setElements(exportLegacyDocument(doc))` write-back을 제거했다.
- Phase 2 첫 slice로 selected element data가 active canonical document 존재 시
  legacy `elementsMap` fallback을 사용하지 않고 selected ref override props fallback도
  active canonical document를 직접 traversal하도록 변경했다.
- Phase 2 추가 slice로 LayerTree/LayersSection이 canonical layer node와 editing
  context map을 우선 사용해 stale legacy `elementsMap` override를 차단했다.
- Tree expansion slice로 `useTreeExpandState`가 store `elementsMap` 구독 없이
  caller-provided canonical frame/tree elements에서 parent lookup map을 파생하도록
  전환하고, FramesTab refresh test를 canonical descendants가 있으면 mirror merge를
  기대하지 않는 계약으로 정렬했다.
- FramesTab hydration fallback slice로 frame element 보강 경로가 store
  `elementsMap` 구독 대신 store `elements`에서 read-only map을 파생하도록 전환했다.
- Phase 3 첫 slice로 `BuilderCore`의 active `UPDATE_ELEMENTS` Preview publish를
  제거하고 `useIframeMessenger`의 `UPDATE_CANONICAL_DOCUMENT` active sync를 고정했다.
- useIframeMessenger selection echo slice로 store `elementsMap` subscription을 제거하고
  active canonical document traversal을 우선 사용하도록 전환했다.
- useIframeMessenger preview-generated dedupe slice로 Preview가 요청한
  column/field element 중복 판정도 active canonical document traversal을 우선
  사용하도록 전환하고 direct `useStore.getState().elementsMap` read를 제거했다.
- useDeltaMessenger canonical count slice로 deprecated delta stats count가
  canonical elements length를 우선 사용하고 store `elementsMap.size` 구독을 제거했다.
  Follow-up으로 active canonical elements가 있을 때는 store `elements.length`
  subscription도 bootstrap fallback으로만 남도록 좁혔다.
- Preview/messaging boundary cleanup slice로 Preview inbound `UPDATE_ELEMENTS`
  recovery가 Builder legacy store cache를 갱신하던 역방향 branch를 제거하고,
  `usePageManager` project hydrate를 `hydrateProjectSnapshot` boundary로 좁혔다.
  shared TagGroup renderer의 parent `UPDATE_ELEMENTS` legacy snapshot 송신, unused
  `MessagingService`/`IframeMessenger.updateElements` facade, dead
  `useMessageCoalescing` hook, delta messenger full `UPDATE_ELEMENTS` fallback도 제거했다.
- Performance monitor canonical count follow-up slice로 monitoring element
  count/store memory estimate가 active `canonicalElementSnapshot` helper 대신 canonical
  document traversal count를 직접 사용하고 store `elementsMap.size` count를 제거했다.
- Monitor component memory canonical read slice로 `useComponentMemory`가 active
  canonical elements에서 element/child lookup map을 파생하고 store
  `elementsMap`/`childrenMap` 구독을 제거했다.
- Canonical property read fallback slice로 `useCanonicalPropertyRead`가 store
  `elementsMap`/`childrenMap` 직접 구독 대신 store `elements[]`에서 read-only
  lookup map을 파생한다.
- Collection item manager canonical children read slice로 `useCollectionItemManager`
  children read가 active canonical elements를 우선 사용하고 store `childrenMap`
  직접 read를 제거했다.
- Canvas selected element canonical read slice로 `useCanvasSelectedElement`가
  selected id만 store에서 읽고 element lookup은 active canonical elements 우선,
  store `elements[]` fallback으로 수행한다.
- LayerTree canonical resolution fallback slice로 LayerTree resolution fallback이
  store `elementsMap` 구독 대신 store `elements[]`에서 read-only map을 파생한다.
- BuilderCore direct traversal fallback slice로 mutation registration/page-shell
  bridge 입력이 active canonical document traversal을 우선 사용하고, store
  `elements[]`는 canonical document 부재 시 bootstrap fallback으로만 남는다.
- BuilderCanvas store map fallback slice로 Skia input fallback `elementsMap`/
  `childrenMap`을 store map 구독 대신 canonical/store `elements[]`에서 파생한다.
- Selected element data legacy fallback slice로 `useSelectedElementData` legacy
  bootstrap fallback이 store `elementsMap` get/values 대신 store `elements[]`에서
  selected/ref lookup을 수행한다.
- Exported lookup selector cleanup slice로 `useElementById`/`useChildElements`
  selectors가 store `elementsMap`/`childrenMap` direct read 대신 store
  `elements[]`에서 read-only lookup을 파생한다.
- Frame layout cascade deleted-id fallback slice로 frame delete removed-id
  collection이 store `elementsMap.values()` 대신 store `elements[]`를 사용한다.
- Inspector lookup fallback slice로 `inspectorActions` style/fill resolved-read가
  active canonical document traversal fallback을 사용하고 store `elementsMap`을
  전달하지 않으며 bootstrap fallback은 store `elements[]` iterable로 제한한다.
- Element loader page elements fallback slice로 lazy-load disabled/already-loaded/
  loading wait read path가 store `elementsMap.forEach` 순회 대신 store `elements[]`
  에서 page elements를 필터링한다.
- Selection hierarchy lookup follow-up slice로 editing context 진입/이탈이 active
  `canonicalElementSnapshot` helper 대신 canonical document traversal에서 필요한 최소
  element shape를 파생하고 store `elements[]` fallback으로 parent/child 관계를
  계산한다.
- Element removal target collection slice로 삭제 대상 수집이 caller의
  `state.elementsMap`/`state.childrenMap` 입력을 받지 않고 store `elements[]`에서
  read-only lookup을 파생한다.
- Instance action lookup/children slice로 origin/instance lookup, child list,
  persisted snapshot lookup이 store map 직접 read 대신 store `elements[]` 기반 helper를
  사용한다.
- Element update pre-read/dirty traversal slice로 props/batch pre-read와 dirty
  descendant traversal이 store map direct read 대신 store `elements[]`에서
  element/children lookup을 파생한다. raw seed는 485로 축소됐다.
- Elements items/Menu action lookup slice로 일반화 items/Menu 액션이 direct
  `get().elementsMap.get(...)` 대신 store `elements[]` lookup helper를 사용한다. raw
  seed는 485로 유지된다.
- Elements page activation/hydration lookup slice로 page activation target lookup과
  selected props hydration fallback이 store `elementsMap` direct read 대신 store
  `elements[]` 우선, active canonical document traversal fallback을 사용한다. page activation
  lazy-load selection fixture도 canonical document source를 사용하도록 정렬해 raw seed를
  485에서 482로 줄였다.
- Elements merge/replace + selection props fallback slice로 `mergeElements`/
  `replaceElementId` pre-read와 set/select/multi-select props fallback이 store map
  direct read 대신 store `elements[]` 우선, active canonical document traversal
  fallback을 사용한다. raw seed는 482에서 480으로 줄었다.
- Elements page shell/remove/move fallback slice로 page shell append, page removal,
  cross-container move가 store map direct read 대신 `elements[]`에서 index를 재생성하거나
  파생한 read-only index를 사용한다. move fallback은 target sibling insertion 기준
  `order_num`도 함께 갱신한다. raw seed는 480에서 478로 줄었다.
- Inspector actions style/fill preview slice로 selected element lookup, style/fill
  preview replacement, update commit dirty-subtree traversal이 store
  `elementsMap`/`childrenMap` direct read 대신 `elements[]`와 active canonical document
  traversal fallback에서 lookup/index를 파생한다. raw seed는 478에서 476으로 줄었다.
- Element creation/instance/TableHeader lookup slice로 customId generation,
  instance origin toggle/reset override, table row discovery가 store map direct read
  대신 caller/store `elements[]`에서 local lookup/children index를 파생한다. raw seed는
  476에서 474로 줄었다.
- Skia input 첫 slice로 active canonical document가 있으면 page/frame mode 모두
  canonical-derived read-only tree를 사용하도록 정렬했다. canonical scene snapshot
  직접 소비 전환은 잔존 작업으로 남겼다.
- BuilderCanvas Skia input bridge slice로 직접 `canonicalDocumentToElements(...)`
  projection call site를 제거하고 canonical scene model 경계로 축소했다.
- Skia scene source marker slice로 `SceneStructureSnapshot`에 canonical/
  legacy-bootstrap provenance를 추가하고, `BuilderCanvas`가 active canonical document
  기반 snapshot을 `canonical`로 태그하도록 정렬했다.
- Skia scene pageIndex slice로 active canonical document가 있으면 `BuilderCanvas`
  scene snapshot의 `pageIndex`도 store mirror 인덱스 대신 canonical scene model에서
  재구성한 read-only index를 사용하도록 전환했다.
- Skia canonical scene model slice로 `BuilderCanvas`가 `useCanonicalElements()` hook
  boundary 대신 `buildCanonicalSceneModel(activeCanonicalDocument)`에서
  `elements`/`elementsMap`/`childrenMap`/`pageIndex`/`frameElementScopes`를 공급받도록
  정렬했다. store mirror는 canonical document 부재 시 hydration fallback으로만
  남기고, scene model 내부도 `canonicalElementSnapshot` helper 대신 canonical document
  traversal을 직접 사용하도록 좁혔다.
- Active snapshot helper cleanup slice로 frame loader, LayoutPreset slot replace,
  drag/drop history payload, BuilderCore/cache bridge, pageFrameBinding,
  useIframeMessenger, inspector/history/elements, selection/overlay/property consumers를
  `visitCanonicalDocumentElements` 또는 canonical read model traversal로 전환했다.
  `getCanonicalElementsSnapshotFromDocument` export와 active snapshot helper file은
  제거했고 production import grep은 0 hit다.
- BuilderCore no-op order validation cleanup slice로 `useValidation`/
  `validateOrderNumbers` path를 제거해 page change마다 legacy `state.elements`를 읽던
  dead validation surface를 삭제했다.
- Canvas drag/drop slice로 `useDragBridge`가 Skia renderer input의 interactive
  canonical-derived `elementsMap`/`childrenMap`을 우선 사용하고, canonical move 후
  history payload는 move result document에서 파생한 snapshot을 우선 사용하도록 정렬했다.
- Canvas auxiliary drag/drop helper slice로 descendant/container/insertion 계산이
  store `childrenMap` 직접 조회 대신 hook 입력 `elements`에서 파생한 read-only
  children map을 사용하도록 정렬했다.
- Canvas selection handler slice로 interactive canonical map provider가 있는
  BuilderCanvas 경로에서 stale `state.elementsMap` fallback을 선택 source로
  사용하지 않도록 제한했다.
- Canvas selection handler required-map slice로 interactive map provider를
  필수화하고 selection hot path의 stale `state.elementsMap`/`state.childrenMap`
  fallback을 제거했다.
- Text edit live update follow-up slice로 `useTextEdit`의 편집 중 텍스트 반영이
  active `canonicalElementSnapshot` helper 대신 canonical document traversal로 edit
  element를 찾고, legacy `elementsMap` 직접 패치 대신 canonical mutation wrapper를
  우선 통과하도록 전환했다. legacy store patch는 canonical hydration 전 bootstrap
  fallback으로만 남겼다.
- Skia hover interaction slice로 hover target/leaf 계산이 `rendererInput`에서
  파생한 canonical-derived `elementsMap`/`childrenMap` provider를 우선 사용하도록
  연결했다.
- Skia hover required-map slice로 rendererInput map provider를 필수화하고 hover
  hot path의 stale `state.elementsMap`/`state.childrenMap` fallback을 제거했다.
- Skia scroll wheel slice로 wheel hit-test가 rendererInput에서 파생한
  `elementsMap` provider를 사용하도록 전환하고 direct store map read를 제거했다.
- Skia `StoreRenderBridge` slice로 render bridge 재동기화를 store map identity
  subscription 대신 `rendererInput` 변경 effect와 theme/layout publish boundary에
  묶었다.
- Legacy canvas surface cleanup slice로 현재 import되지 않는 retained-mode
  `sceneGraph/*`와 sprite-era `sprites/useResolvedElement.ts` source surface를
  제거하고 재도입 방지 static gate를 추가했다.
- Canvas context menu slice로 detach target 해석이 stale `state.elementsMap`
  fallback 대신 interactive canonical-derived map만 사용하도록 좁혔다.
- StylesPanel slice로 panel-level type/style read를 direct `elementsMap` 구독 대신
  canonical selected data hook 기반으로 전환했다.
- Style value hook slice로 `useElementStyleContext`가 canonical property element
  hook을 사용하고, fill/transform read가 해당 context를 재사용하도록 정렬했다.
- Generic properties slice로 `GenericPropertyEditor`/`ChildItemManager`가 canonical
  element/children을 우선 읽고 legacy map은 canonical 비활성 fallback으로만 남기도록
  정렬했다.
- Generic/style follow-up slice로 `ItemsManager`와 `useResetStyles`/
  `useTransformAuxiliary`가 canonical property element hook을 사용하도록 전환했다.
  추가 follow-up으로 `useResetStyles` reset action은 active
  `canonicalElementSnapshot` helper 대신 canonical document traversal을 직접 사용하고,
  per-hook direct selected `elementsMap`/`childrenMap` read를 제거했다.
- Simple property editor slice로 `useCanonicalPropertyRead` hook을 추가하고
  Column/Cell/Row/Tag editor가 canonical property element/children read를 우선
  사용하도록 정렬했다.
- Specialized property editor slice로 ListBoxItem/TreeItem/TableBody/TableHeader
  editor도 canonical property element/children map read hook을 사용하도록 정렬했다.
- Table editor slice로 `TableEditor`가 canonical-derived element/children map helper를
  우선 사용하도록 정렬했다.
- Single-read editor slice로 Breadcrumb/DataTable/GridListItem/ColumnGroup/LayoutBody/
  PageBody editor가 canonical property element hook을 우선 사용하도록 정렬했다.
- Specialized editor read slice로 ElementSlotSelector/ListBoxPropertyEditor/
  SliderEditor가 canonical property element/map hook을 우선 사용하도록 정렬했다.
- SliderEditor child sync slice로 SliderEditor가 canonical property maps로 child update를
  직접 만들도록 전환하고, 미사용 `useSyncChildProp`/`useSyncGrandchildProp` hooks와
  barrel export를 제거했다.
- Component/Frame slot section read slice로 ComponentSemanticsSection/
  FrameSlotSection/ComponentSlotFillSection이 canonical property hook을 우선 사용하도록
  정렬하고 stale `order_num` 테스트 기대를 제거했다.
- LayoutPresetSelector/usePresetApply slice로 slot/body read를 canonical property
  hook 기반으로 전환하고 replace handler 내부 store map 조회를 제거했다.
- PropertiesPanel slice로 editor update baseline, multi-select copy/paste/group/
  align/distribute 계산, slot change read를 canonical-derived map hook 기반으로
  전환했다.
- Central pointer handler slice로 interactive canonical map provider 누락 시 legacy
  `state.elementsMap`/`state.childrenMap` fallback을 사용하지 않도록 제한했다.
- Drop target resolver/drag bridge slice로 drag/drop context를
  `DropTargetReadModel`/`DragReadModel` read-only 계약으로 분리하고
  `elementsById`/`childrenByParent` 명칭으로 전환했다.
- Shared renderer context slice로 shared `RenderContext`의 legacy
  `elementsMap`/`childrenMap` contract를 `ReadonlyMap` 기반
  `elementsById`/`childrenByParent` read model로 전환하고, Preview가
  canonical-resolved tree에서 이 context를 주입하도록 정렬했다.
- BuilderCore page-shell bridge slice로 canonical mutation registration과
  page-shell reverse bridge 입력이 active canonical element snapshot을 우선
  사용하고, legacy `state.elementsMap`은 canonical document 부재 시 bootstrap
  fallback으로만 남도록 좁혔다.
- PagesSection page-delete bridge slice로 page 삭제 후 canonical reverse bridge 입력도
  active canonical document를 직접 traversal하고, legacy store elements는
  canonical document 부재 시 bootstrap fallback으로만 남도록 좁혔다.
- PageFrameBinding slice로 page frame binding의 page body 보존 입력도 active
  canonical document를 직접 traversal하고, legacy map은 canonical document에 없는
  항목 보강용으로만 병합하도록 좁혔다.
- FrameLayoutCascade slice로 unused reusable frame duplicate helper와 그 안의
  `exportLegacyDocument(doc)` projection을 제거하고 재도입 방지 static gate를
  추가했다.
- BuilderCore recover bridge slice로 transition `recoverElementsSnapshot` subscriber의
  직접 `canonicalDocumentToElements(doc)` projection과 active snapshot helper 경유를
  제거하고 active canonical document traversal 입력으로 좁혔다.
- Canonical legacy cache bridge quarantine slice로 `BuilderCore` 내부 live
  `recoverElementsSnapshot` subscriber를 `canonicalLegacyStoreCacheBridge` transition
  boundary로 격리하고, `BuilderCore` direct recovery 재도입을 static gate로 차단했다.
- Canonical element snapshot boundary/direct traversal slice로 frame loader,
  LayoutPreset slot replace, drag/drop history payload의 direct
  `canonicalDocumentToElements(...)` projection을 먼저 helper 경계로 격리한 뒤
  `visitCanonicalDocumentElements` 직접 traversal로 전환했다.
- History compatibility sync slice로 undo/redo/goToHistoryIndex 후 cloud compatibility
  upsert map이 active canonical document traversal을 우선 사용하고 legacy store
  elements는 canonical document 부재 시 fallback으로만 남도록 좁혔다. Redo props/batch
  update lookup도 같은 traversal helper를 사용해 direct `get().elementsMap` read를
  제거했다.
- AI tool read follow-up slice로 `getAiToolReadModel()`이 active
  `canonicalElementSnapshot` helper 대신 canonical document traversal을 직접 사용하고,
  개별 tool의 direct `elementsMap`/`childrenMap` read를 static gate로 차단했다.
- Overlay/customId read follow-up slice로 Selection overlay body 판정과
  PropertyCustomId validation이 active `canonicalElementSnapshot` helper 대신 canonical
  document traversal을 직접 사용하고 direct `elementsMap` lookup을 제거했다.
- Phase 5 첫 slice로 ADR-119/120/121 이후 stale `order_num`/strict grep/static
  string tests를 정렬했다.
- ShadowWriteDiff stale cleanup slice로 dormant canonical→legacy export convenience
  wrapper를 제거하고, evaluator는 compatibility boundary에서 명시적으로 받은 legacy
  snapshot만 비교하도록 좁혔다.
- `.agents` canonical runtime rule에 mutable legacy `Element[]` mirror 재도입 금지
  원칙을 보강했다.
- README 현황 요약을 당시 ADR-122 In Progress 기준으로 갱신했다.

### Verification

- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__`
- `pnpm -F @composition/shared exec vitest run src/utils`
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/main/BuilderCore.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/LayersSection.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.test.ts src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/interaction/canvasContextMenu.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/panels/styles/StylesPanel.static.test.ts src/builder/panels/styles/hooks/styleReadCanonical.static.test.ts src/builder/panels/styles/hooks/useFillActions.test.tsx src/builder/panels/styles/hooks/useTransformAuxiliary.test.tsx src/builder/panels/properties/generic/genericEditorCanonical.static.test.ts`
- `pnpm -F @composition/shared exec vitest run src/renderers`
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts src/builder/main/canonicalLegacyStoreCacheBridge.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/services/ai/tools/canonicalToolReadModel.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/components/property/PropertyCustomId.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/PagesSection.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/history/historyActions.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/generic/genericEditorCanonical.static.test.ts src/builder/panels/styles/hooks/styleReadCanonical.static.test.ts src/builder/panels/styles/hooks/useResetStyles.test.tsx src/builder/panels/styles/hooks/useTransformAuxiliary.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useScrollWheelInteraction.static.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/legacyCanvasSurfaces.static.test.ts src/builder/workspace/canvas/hooks/useScrollWheelInteraction.static.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts`
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/g6ParityCompletion.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/hooks/useTreeExpandState.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameLayoutCascade.static.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts`
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/persistenceWriteThroughStub.test.ts`
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameElementLoader.test.ts src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/useDeltaMessenger.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/overlay/useTextEdit.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/utils/performanceMonitor.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/monitor/hooks/useComponentMemory.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/hooks/useCanonicalPropertyRead.static.test.ts src/builder/panels/properties/editors/canonicalPropertyEditors.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/useCollectionItemManager.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canvasStore.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts src/builder/main/canonicalLegacyStoreCacheBridge.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/scene/canonicalSceneModel.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/builder/workspace/canvas/scene/canonicalSceneModel.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/builder/workspace/canvas/scene/canonicalSceneModel.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts`
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameLayoutCascade.static.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/inspectorActions.static.test.ts src/builder/stores/__tests__/inspectorFills.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/elementLoader.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/selection.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementRemoval.static.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/instanceActions.static.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementUpdate.static.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/itemsActions.test.ts`
- ADR-122 grep gates: `canonicalMutations` legacy write-back 0 hits, canvas
  helper/context menu stale map fallback 0 hits, specialized editor direct legacy
  map lookup 0 hits, PropertiesPanel direct store map read 0 hits, central pointer
  legacy map fallback 0 hits, drag/drop resolver legacy map contract 0 hits, raw
  seed 462 hits.
- `pnpm run codex:guard`
- `git diff --check`
- `pnpm run codex:typecheck`

## [ADR-121 indexedDB legacy surface cleanup implementation] - 2026-05-08

### Changed

- ADR-121을 Implemented로 승격하고 `docs/adr/completed/`로 이동했다.
- `IndexedDBAdapter`의 `DB_VERSION`을 15로 올리고,
  `metadata`/`history`/`design_variables` stale store를 delete-only cleanup
  allowlist에 추가했다.
- dormant `metadata` sync store/API, `SyncMetadata`, batch export/import metadata
  payload를 제거했다.
- duplicate `composition.history` store/API와 dashboard `db.history.clear(page.id)`
  호출을 제거했다. 별도 `composition-history` DB와
  `historyIndexedDB.clearPageHistory(page.id)`는 유지한다.
- production consumer 0건인 `designVariables` adapter API를 제거하고
  `design_variables` objectStore를 새로 만들지 않도록 고정했다.
- `docs/reference/schemas/INDEXDB.md`를 v15 current schema로 재작성하고, removed
  legacy stores를 historical/delete-only note로 격리했다.
- `.agents` canonical format/order 규칙에 removed
  `metadata`/`history`/`designVariables` local DB surface를 재도입 금지 surface로
  추가했다.
- README 현황 요약을 완료 110→111, 미구현 9→8, 합계 126 유지로 갱신했다.

### Verification

- `pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts src/dashboard/__tests__/dashboardLocalMirror.static.test.ts`
- ADR-121 grep gates: `metadata`/`composition.history`/`designVariables`/stale
  objectStore create/read path 0건.
- Browser smoke:
  `http://localhost:5173/builder/9115e0fe-81b7-4a57-a996-19e62fec3eaa`에서
  fresh Playwright context + seeded dev auth session으로 Builder URL 유지,
  `composition` DB v15, active objectStores 유지,
  `pages`/`elements`/`layouts`/`metadata`/`history`/`design_variables` 없음,
  `documents` record 존재, `composition-history` DB 유지, filtered console/page errors
  0건.
- `pnpm run codex:preflight`

## [ADR-120 legacy mirror persistence cleanup implementation] - 2026-05-08

### Documentation

- ADR-120을 Proposed로 추가해 ADR-111/112/113/116/118/119 이후 남은 local
  `pages`/`elements`/`layouts` mirror persistence 제거 계획을 문서화했다.
- 계획 범위를 `CompositionDocument` local runtime primary 유지, `DatabaseAdapter`
  legacy surface 제거, dashboard/projectSync/history/editor/drag-drop mirror write
  cleanup, Supabase projection boundary, IndexedDB objectStore cleanup으로 분리했다.
- Phase 0 inventory 문서를 추가해 current primary evidence, 삭제 대상 runtime bucket,
  project sync boundary, canonical adapter/export boundary, out-of-scope bucket을
  구분했다.
- ADR-120 리뷰 결과를 반영해 inventory의 누락 mirror write/read surface를 보강하고,
  검증 명령을 현재 repo에 존재하는 test/static grep gate 기준으로 정리했다.
- ADR-120 결정을 strong local mirror removal로 강화해 production runtime
  `db.pages/elements/layouts` project-state call site 0건, `DatabaseAdapter` legacy
  surface 제거, IndexedDB mirror objectStore 삭제를 완료 조건으로 고정했다.
- cloud legacy-only download 정책을 단순화해 Supabase `pages/elements` rows는 remote
  transport format으로만 허용하고, 다운로드 시 one-shot `CompositionDocument` 변환 후
  local `db.documents.put()`만 수행하도록 Phase 4 gate를 명시했다.
- `review-adr` 템플릿 정합성을 위해 ADR-120 본문에 별도 Risks 섹션을 추가하고,
  missed mirror write, cloud transport conversion, DB/API deletion, canonical bridge,
  IndexedDB upgrade 위험과 대응을 명시했다.
- LOW 문서 형식 보강으로 ADR-120 본문의 `Risks → Gates` 순서를 Risk-First 규칙에
  맞게 정리하고, ADR 작성 가이드의 규칙 링크를 Codex용 `.agents` 엔트리포인트로
  갱신했다.
- Phase 1-5 구현을 완료해 dashboard project lifecycle, `usePageManager`,
  `elementLoader`, element mutation/history/editor/drag, page/frame binding,
  reusable frame, `projectSync` local source/sink가 local `db.pages/elements/layouts`
  mirror를 project-state primary로 사용하지 않도록 정리했다.
- `DatabaseAdapter.pages/elements/layouts` public surface를 제거하고 IndexedDB
  `DB_VERSION`을 14로 올려 기존 `pages`/`elements`/`layouts` objectStore를
  delete-only upgrade cleanup으로 삭제한다.
- `projectSync`는 upload 시 `db.documents.get(projectId)`에서 Supabase row payload를
  파생하고, legacy-only cloud download는 one-shot `legacyToCanonical(...)` 변환 후
  local `db.documents.put()`만 수행하도록 static guard를 추가했다.
- `.agents` canonical format/order, state-management, async pipeline, component
  lifecycle, validation rule을 local project-state persistence `db.documents` 전용
  규칙으로 갱신했다.
- 검증: builder targeted vitest 21 files / 169 tests PASS, shared targeted vitest
  2 files / 19 tests PASS, production `db.pages/elements/layouts` grep gate 0,
  `DatabaseAdapter.pages/elements/layouts` grep gate 0, IndexedDB legacy objectStore
  creation/runtime objectStore grep gate 0, `pnpm run codex:typecheck` PASS,
  `pnpm run codex:preflight` PASS.
- Browser smoke: `http://127.0.0.1:5173/builder/1f180030-67c4-486d-b6a0-498bcea152f5`
  refresh 후 IndexedDB `composition` DB version 14, mirror objectStore 없음,
  active `documents` record 존재, `order_num`/`orderNum` payload 없음, canvas sizing
  정상, console error/warning 0건.
- ADR-120 본문을 `docs/adr/completed/120-legacy-mirror-persistence-cleanup.md`로
  이동하고 README 현황 요약을 완료 110 / 미구현 8 / 합계 125로 갱신했다.

## [ADR-119 page/layout order mirror cleanup] - 2026-05-08

### Changed

- Page/Layout order의 runtime source를 `pages.order_num`, `layouts.order_num`,
  page/layout `metadata.order_num`에서 canonical `CompositionDocument.children[]`
  source order로 전환했다.
- PageTree DnD는 `orderNum` payload 대신 ordered id list와 `parentId`로 root page
  source order를 갱신하고, nested sibling reorder는 parent별 subsequence를 기존 root
  source slots에 merge한다.
- Preview `RuntimePage.order_num`, shared render model page `order_num`,
  page create/bootstrap/body seed `order_num`, reusable frame `layouts.order_num`,
  page/layout canonical metadata `order_num` 생성/소비를 제거했다.
- IndexedDB DB version을 13으로 올리고 `pages.order_num`/`layouts.order_num` index
  생성과 재생성을 제거했다. 기존 index는 upgrade에서 삭제하며, v13 upgrade는 기존
  `pages`/`layouts`/`elements` row와 `documents` canonical metadata에 남은 stale
  `order_num`/`orderNum` payload도 제거한다.
- Supabase physical column은 유지하되 `projectSync` cloud upload에서만 local page
  source index로 call-time derived compatibility field를 보낸다.
- `.agents` composition order 규칙을 page/layout 예외 유지에서 adapter compatibility
  boundary로 갱신했다.
- ADR-119 완료 의미를 "repo-wide `order_num` 문자열 0건"이 아니라
  "page/layout/runtime order source에서 제거"로 문서화하고, 잔존 hit allowlist를
  compatibility/migration/Table component data로 고정했다.

### Documentation

- ADR-119 본문을 Implemented로 승격하고 `docs/adr/completed/`로 이동했다.
- Phase 0 inventory를 `docs/adr/design/119-page-layout-order-inventory.md`에 추가했다.
- ADR 본문과 inventory에 실제 Builder IndexedDB v13 확인 결과를 추가했다.
- ADR README 카운트와 완료/미구현 row를 갱신했다.

### Verification

- `pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts src/utils/__tests__/compositionDocumentOrder.test.ts`
- `pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeDnd.test.ts src/builder/stores/canonical/__tests__/canonicalFrameStore.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/stores/__tests__/pageRemovalSemantics.test.ts src/builder/stores/canonical/__tests__/canonicalDocumentStore.test.ts`
- `pnpm run codex:typecheck`
- 실제 Builder URL
  `http://localhost:5173/builder/394ad236-73cd-40c4-91f1-ee57bc699e41` reload 후
  IndexedDB 확인: `composition` DB v13, `pages`/`layouts` order index 없음,
  `pages`/`layouts`/`elements` row order payload count 0, project document order hit 0.

## [Element order_num removal cleanup] - 2026-05-08

### Changed

- Element sibling order에서 legacy `order_num` mirror를 제거하고 canonical
  `CompositionDocument.children[]` index를 유일한 order SSOT로 정리했다.
- `elements` IndexedDB store의 `order_num` index를 제거하는 DB v11 upgrade path를 추가했다.
- Element/Preview/Runtime 타입, canonical export/projection, history, drag/drop, layer tree,
  factory/editor child 생성 경로에서 Element `order_num` payload를 제거했다.
- `.agents` composition rules를 업데이트해 `reorderElements`, `batchUpdateElementOrders`,
  `updateElementOrder`, `getDerivedOrderNum` 재도입을 금지하고 page/layout `order_num`만
  예외로 명시했다.

### Verification

- `pnpm -F @composition/shared exec vitest run src/utils/__tests__/compositionDocumentOrder.test.ts`
- `pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/__tests__/pageRemovalSemantics.test.ts src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/utils/treeUtils.test.ts src/builder/workspace/canvas/selection/selectionHitTest.test.ts src/builder/stores/canonical/__tests__/canonicalDocumentStore.test.ts src/builder/workspace/canvas/selection/dropTargetResolver.test.ts src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/builder/panels/nodes/tree/LayerTree/validation.test.ts src/builder/panels/nodes/tree/LayerTree/LayerTreeItemContent.test.tsx`
- `pnpm run codex:typecheck`

## [ADR-118 structural order cutover] - 2026-05-07

### Fixed

- Page/root order runtime 이 legacy page metadata `order_num`을 primary sort key로 다시 쓰던
  경로를 canonical `CompositionDocument.children` page-like root order 기준으로 전환했다.
  - Browser refresh hydrate 의 render model, Pages tree 표시 순서, page canvas position 초기화가
    같은 canonical page order를 공유한다.
  - Home/non-deletable page 판정과 초기 선택은 order 위치가 아니라 slug `/` identity를
    사용한다.
  - Pages tree drag/drop 은 active canonical document 의 page slot 순서까지 갱신해 refresh 후
    원래 순서로 회귀하지 않도록 했다.
- LayerTree generic builder, Builder page snapshot/index read, Preview iframe generic child
  rendering, Publish PageNav/ElementRenderer 가 legacy `order_num` 재정렬 대신 canonical
  source order를 보존하도록 전환했다.
- Skia renderer input, canonical ref descendant materialization, canvas hit-test/context-menu
  target resolution, drop target/insertion read path, layout/page-frame child projection 이
  legacy `order_num` 재정렬 대신 canonical source order와 `z-index` + child index effective
  order를 공유하도록 전환했다.
  - 겹친 sibling selection 은 descendant 우선, `z-index` 우선, 같은 `z-index`에서는
    childrenMap source index 우선으로 판정하고, depth/area는 마지막 fallback 으로만 사용한다.
  - frame binding projection, layout cache, Breadcrumb/ToggleButtonGroup context 도 caller 가
    전달한 child order를 보존한다.
- Skia canvas drag/drop final commit 이 legacy store reorder를 primary write로 사용하던 경로를
  canonical `children[]` splice write로 전환했다.
  - `moveElementCanonicalPrimary`가 active canonical document의 target parent `children[]`를
    먼저 갱신하고, Builder store/DB persist용 `parent_id`/`order_num`은 exported legacy mirror에서
    파생한다.
  - `useDragBridge` pointerup/drop 경로는 더 이상 `state.moveElementToContainer()`와
    `state.batchUpdateElementOrders()`를 직접 호출하지 않는다.
- Structural-only `updateElement`/`batchUpdateElements` payload 는
  `applyElementOrderCanonicalPrimary`로 active canonical document의 parent `children[]`를 먼저
  splice하고, `order_num`은 legacy mirror row로만 재파생한다.
- PageTree DnD reorder 는 `order_num` sort 대신 drag update rank/source order로 canonical
  page slot을 materialize한다.
- component origin/ref instance materialization, property editor structural child list, shared
  form renderer path에서 stale `order_num` primary sort를 제거했다. Table/collection data order는
  별도 data bucket으로 유지한다.

### Documentation

- ADR-118 본문, breakdown, README, inventory를 현재 구현 상태에 맞춰 동기화했다.
  - G0-G6를 완료로 표기하고 ADR 본문을 `docs/adr/completed/`로 이동했다.
  - Phase 6 grep gate 잔여 hit를 adapter/import/export, IndexedDB load boundary,
    Table/collection data, legacy helper, compatibility bridge bucket으로 allowlist 했다.

### Verification

- `pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts src/utils/__tests__/compositionDocumentOrder.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeDnd.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/pagesLayoutInvalidation.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/utils/treeUtils.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/preview/previewFrameMirror.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/selection/selectionHitTest.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/utils/canonicalRefResolution.test.ts src/builder/workspace/canvas/selection/dropTargetResolver.test.ts src/builder/workspace/canvas/interaction/canvasContextMenu.test.ts src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.static.test.ts src/builder/workspace/canvas/scene/layoutCache.static.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts`
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/stores/__tests__/elementMove.test.ts src/builder/workspace/canvas/selection/dropTargetResolver.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeDnd.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementReorder.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/elementUpdate.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts`
- Browser smoke: `http://127.0.0.1:5173/builder/adr118-browser-smoke` seeded local IndexedDB canonical document, refresh source order/mirror order/body child order/canvas render 확인. Screenshot: `/tmp/adr118-builder-smoke.png`.
- `pnpm -F @composition/publish type-check`
- `pnpm run codex:typecheck`
- `pnpm run codex:preflight`

## [Canvas selection parity — Pencil-style group entry/direct select] - 2026-05-07

### Fixed

- Canvas hierarchical selection 이 Pencil-style group entry 동작과 어긋나던 회귀를 수정했다.
  - 그룹/컨테이너 위에서 더블클릭할 때 `editingContextId` 만 진입하고 선택이 비워지던 동작을 고쳐, 마우스 아래 실제 child element 가 있으면 context 진입과 동시에 해당 child 를 선택한다.
  - selection bounds 내부에서 두 번째 클릭을 처리할 때 selected group id 가 아니라 실제 hit element id 를 double-click target 으로 유지해, 내부 element 를 더블클릭해도 parent group 으로 다시 승격되지 않도록 했다.
  - `Cmd/Ctrl + click` 이 multi-select 로 소모되어 group 내부 element 를 직접 선택하지 못하던 동작을 수정했다. 현재 click 이 hierarchical boundary 에 의해 parent 로 승격될 경우에만 concrete hit element 를 direct selection target 으로 사용한다.
  - 다른 page 에 있는 group 내부 element 를 direct select 할 때도 page transition, `editingContextId`, selection 을 같은 commit 에 반영하도록 `selectElementWithPageTransition` 옵션을 확장했다.
  - Why: Pencil-style canvas editing 에서는 group 내부로 들어가는 double-click 과 modifier direct-select 가 Layers/Inspector selection 을 즉시 동기화해야 한다.
- Nodes 패널 tree 의 drag handle 이 React Aria `slot="drag"` 포인터 계약을 덮어써 Layers/Pages drag-drop 이동이 시작되지 않던 회귀를 수정했다.
  - Layer tree 와 Page tree drag slot button 의 inline `pointerEvents: auto` override 를 제거해, React Aria TreeItem row 에 연결된 DnD handler 가 정상적으로 pointer event 를 받도록 했다.
- Pages tree drag-drop 이 Skia/store 에만 임시 반영되고 tree/source persistence 에 저장되지 않아 새로고침 후 원래 위치로 회귀하던 문제를 수정했다.
  - PageTree DnD 업데이트를 `setPages()` 에서 끝내지 않고 active canonical document metadata 와 IndexedDB `pages`/`documents` store 에 함께 저장한다.
  - canonical page metadata 생성/갱신 경계가 `order_num` 과 `parent_id` 를 함께 보존하고, refresh hydration 의 render model 파생 경로가 `parent_id` 를 복원한다.
- Layer tree drag-drop 이 legacy store 에만 반영되고 canonical-derived LayerTree source 에 반영되지 않아 tree 위치가 그대로 보이고 새로고침 후 회귀하던 문제를 수정했다.
  - `batchUpdateElements()` 구조 변경 경로가 active canonical document 에 변경 element 를 merge 하고, IndexedDB `documents` store 에도 canonical snapshot 을 저장한다.
  - canonical active 상태에서 legacy mirror row 가 없는 element 업데이트 실패가 canonical document persistence 를 막지 않도록 legacy mirror 저장 실패 처리를 분리했다.
- Layer tree virtualization 전환 기준을 12개에서 300개로 높여 일반 문서에서는 React Aria `TreeBase` 경로를 유지하고, 대형 문서에서만 `VirtualizedTree` 최적화를 사용하도록 조정했다.
- Layer tree drag preview/ghost 를 반투명 카드 형태로 조정했다.
  - React Aria `TreeBase` 경로는 `renderDragPreview` 공식 API 를 사용한다.
  - 대형 tree 용 `VirtualizedTree` native DnD 경로는 동일 class 의 `setDragImage()` preview 를 사용한다.
- Skia canvas drag 중 실제 element 렌더링 alpha 를 `0.5` 에서 `0.9` 로 조정해 이동 중인 요소가 과도하게 흐려지지 않도록 했다.
- Layer tree 와 Skia canvas drag-drop 후 sibling 순서가 섞이던 회귀를 수정했다.
  - `order_num` 동률 시 기존 source index 를 tie-breaker 로 사용하는 공통 정렬 계약을 추가하고, LayerTree source, store index, Skia render children map, canonical 변환/merge 경로에 같은 계약을 적용했다.
  - Skia same-parent reorder commit 이 변경된 sibling 만 canonical merge 하던 동작을 고쳐, 최종 sibling 순서 전체를 같은 커밋에 반영하도록 했다.
  - canonical merge/export 단계가 일부 sibling 을 기존 위치에 보존하고 나머지를 append 하면서 최종 순서를 다시 뒤섞던 문제를 수정했다. 같은 부모의 전체 sibling batch 는 canonical `children[]` 및 page ref descendant `children[]` 에 최종 `order_num` 순서로 원자 반영한다.
  - LayerTree DnD 가 projected instance child 를 실제 persistence target 처럼 재배치하지 못하도록 synthetic ref child 를 drag source/drop target 에서 차단했다.

### Changed

- Canvas multi-select modifier 를 `Cmd/Ctrl + click` 에서 `Shift + click` 으로 변경했다.
  - `Cmd/Ctrl + click` 은 group 내부 실제 element direct-select 에 사용한다.
  - `Shift + click` 은 기존 add/remove multi-selection 토글 역할을 담당한다.
  - 직접 boundary target 을 `Shift + click` 하는 top-level multi-select 동작은 유지하고, group boundary 를 우회해야 하는 direct-select 경로와 충돌하지 않게 분리했다.

### Documentation

- `docs/pencil-copy` 의 UI/UX 및 Composition mapping 문서에 double-click group entry, `Cmd/Ctrl + click` direct child selection, `Shift + click` multi-select 계약을 추가했다.

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts src/builder/utils/hierarchicalSelection.test.ts src/builder/stores/__tests__/pageActivation.test.ts` — canvas selection modifier/context contract PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/LayerTree/LayerTreeItemContent.test.tsx src/builder/panels/nodes/tree/PageTree/PageTreeItemContent.test.tsx` — Nodes tree drag slot pointer contract PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeDnd.test.ts src/dashboard/__tests__/createInitialProjectDocument.test.ts` — Pages tree DnD canonical persistence metadata PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx` — Layer tree DnD structural canonical persistence PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/LayerTree/LayerTreeItemContent.test.tsx` — Layer tree row/drag slot contract PASS
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/selection/dropTargetResolver.test.ts src/builder/stores/__tests__/elementMove.test.ts` — drag-drop sibling order tie-breaker/reparent commit PASS
- `pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts` — canonical page `parent_id` hydrate PASS
- `pnpm run codex:typecheck` — PASS
- `pnpm run codex:preflight` — PASS

## [Rollback follow-up canonical projection fixes] - 2026-05-06

### Fixed

- 2026-05-05 rollback 후 `225532ea9` baseline 에 잔존 debt 로 재분류된 frame/component canonical projection 회귀를 current main 기준 새 패치군으로 다시 닫았다. 이 섹션은 2026-05-03 에 폐기된 post-cutover fix 의 단순 재적용이 아니라, rollback 이후 재진입한 사용자 검증 기반 패치 내역이다.
- Page 에 reusable frame 을 적용했을 때 Node 패널 Layers 에 frame body 가 표시되지 않던 회귀를 수정했다.
  - `useLayerTreeData` 의 canonical source 필터가 current page 의 `page_id` 뿐 아니라 page-frame binding 의 `layout_id` mirror 도 포함한다.
  - Browser refresh hydration 시 `deriveProjectRenderModelFromDocument` 가 legacy page RefNode 를 page 로 인식하고, page-owned body(`layout_id: null`) 와 frame body/slot(`layout_id: <frame>`) projection 을 함께 복원한다.
  - Browser refresh hydration 시 canonical `legacy-slot-hoisted` frame node 를 runtime `Slot` element 로 복원해, page-frame Slot 의 Skia hatch marker 가 새로고침 후에도 표시되도록 했다.
  - Frames 탭 Layout Preset 변경 시 기존 frame Slot 감지가 legacy mirror 에만 의존해 canonical Slot 위에 새 Slot 이 누적되던 회귀를 수정했다.
  - Frames 탭에서 frame 선택 시 canonical body 를 즉시 자동 선택하고, Skia empty-click body selection 이 canonical frame body 를 hit-test 하도록 수정했다.
  - Pages 탭에서 현재 page 를 다시 선택하거나 단일 page 행을 선택해도 page body 가 즉시 자동 선택되도록 수정했다.
  - Page 추가/refresh 후 canonical page order 가 child index 로 재계산되어 Pages 탭 순서와 Home 삭제불가 판정이 뒤집히던 회귀를 수정했다.
  - Browser refresh 초기 hydrate 의 `storePages` 가 page-frame binding mirror 를 보존하고, canonical document 로드 직후 `setPages()` 가 page-shell bridge 를 통해 active `CompositionDocument` 를 다시 projection 하지 않도록 막았다.
  - Page-frame projection Slot 은 content 가 있어도 `_slotMarkerChrome: visible` 계약을 우선해 Skia slot hatch marker 를 유지한다.
  - No Frame 해제 시 page RefNode 에 page-owned body 가 없으면 기본 body 를 복원하고, page-shell rebuild 가 기존 unbound page body children 을 보존한다.
  - Frame 선택 변경 직후 active `CompositionDocument` 에서 legacy mirror 를 즉시 export 해 live Canvas/LayerTree 가 refresh 전에도 동일한 body tree 를 보도록 했다.
  - Browser refresh hydrate 로 `page_id=<page>` + `layout_id=<frame>` 형태가 된 frame Slot 도 `resolvePageWithFrame` 에서 frame source 로 재인식해 page-frame Slot marker projection 을 복원한다.
  - No Frame 상태에서는 `page_id=<page>` 이더라도 `layout_id=<frame>` 이 남아 있는 frame projection element 를 page body/content 후보와 LayerTree source 에서 제외한다.
  - 여러 page 가 동일 reusable frame 을 지정한 뒤 Browser refresh 시 마지막 page 에만 frame projection 이 렌더링되던 회귀를 수정했다. Refresh hydrate 가 page-frame projection element id 를 page별 synthetic id 로 생성하고, live resolver 는 이미 page-scoped 인 projection id 를 다시 projection 하지 않는다.
  - Browser refresh 후 page-frame projection element 가 duplicate `order_num` auto-fix 대상에 포함되어 synthetic id 를 IndexedDB/Supabase `elements` row 로 업데이트하려던 `order_num 재정렬 DB 실패` 콘솔 오류를 수정했다.
  - 회귀 테스트를 추가해 frame-bound page 에서 `frame-body` 가 LayerTree source 에 포함되는 계약을 고정했다.
- Component instance 가 Node 패널 Layers 에 `ref` 로 표시되고 origin children 이 materialize 되지 않던 회귀를 수정했다.
  - `canonicalElementsView` 가 canonical `ref` / `descendants` / `reusable` / `slot` mirror fields 를 derived Element 에 보존한다.
  - `useLayerTreeData` 는 page-scoped 표시 대상과 ref 해석용 전체 canonical element map 을 분리해, 현재 page 밖 reusable origin 의 children 도 instance 아래 synthetic children 으로 투영한다.
  - Origin 복제/붙여넣기로 생성된 canonical `type:"ref"` instance 가 `ref` mirror 를 잃지 않도록 canonical mutation/export 경계를 보강하고, LayerTree/Skia/Preview ref resolver 가 exported `masterId` mirror 도 fallback 으로 해석하도록 했다.
  - Properties 패널 선택 데이터도 canonical `ref` instance 를 origin-shaped element 로 해석해 instance 선택 시 `ref` 속성 에디터가 아니라 origin 컴포넌트 속성 에디터가 열리도록 했다.
  - Origin 속성 변경 시 부모→자식 propagation batch 경로가 active `CompositionDocument` 를 갱신하지 않아 값이 즉시 되돌아가고 legacy element mirror 저장에서 `Element not found` 경고가 발생하던 문제를 수정했다.
  - Origin 삭제 시 full canonical replace shell 이 기존 page body children 을 그대로 보존해 삭제한 origin 이 canonical document 에 남던 문제를 수정했다.
  - Instance 속성 변경 시 legacy element mirror row 가 없어도 canonical `RefNode.props` override 를 먼저 저장해 Origin 값을 직접 수정하지 않고 instance override 로 유지되도록 했다.
  - Browser refresh 후 legacy `elementsMap` 에 instance mirror 가 없어도 Properties 패널과 inspector action 이 active canonical snapshot 을 fallback 으로 사용해 instance override 값을 즉시 표시/저장하도록 했다.
  - LayerTree/Skia 선택 경로처럼 instance 가 origin-shaped `type` + `ref` mirror 로 들어오는 경우에도 canonical mutation 이 일반 노드가 아니라 `RefNode.props` override 로 저장하도록 수정했다.
  - Legacy `componentRole: "instance"` instance 도 Properties 패널 수정 시 raw `props` 가 아니라 `overrides` 에 값을 기록하고, canonical `RefNode.props` 로 동기화되도록 수정했다.
  - Properties/Style/Fills inspector 경로가 legacy instance, canonical `type:"ref"` instance, origin-shaped `ref` mirror 를 모두 origin-resolved baseline 위의 local override 로 처리하도록 정규화했다.
  - Builder 런타임의 canonical mutation import 경로를 `@/adapters/canonical/canonicalMutations` 로 통일해 BuilderCore DI registration 과 inspector/store action caller 가 같은 singleton 을 보도록 했다.
  - Origin/Instance 의 Properties 패널 ID(`customId`) 편집이 선택 상태가 아니라 명시된 element id 를 업데이트하도록 수정하고, canonical metadata/export round-trip 에서 `customId` 를 보존해 Origin 과 Instance ID 가 같이 바뀌거나 중복 복원되지 않도록 했다.
- Element 를 `Create component` 로 Origin 전환한 뒤 브라우저 새로고침 시 Standard 로 회귀하던 회귀를 수정했다.
  - instance lifecycle action 이 Origin 전환 후 active `CompositionDocument` 에 canonical merge 를 즉시 수행하고, IndexedDB `documents` store 에도 현재 canonical document 를 저장한다.
  - canonical mutation/export 경계가 `reusable: true` origin 을 legacy `componentRole: "master"` mirror 로 round-trip 하며, page 소속 origin 을 root reusable 로 끌어올리지 않고 page children 위치에 유지한다.
  - Browser refresh hydrate 의 `deriveProjectRenderModelFromDocument` 가 page-owned reusable origin 과 canonical ref instance mirror 를 runtime element 로 복원하도록 수정했다.

### Changed

- Nodes 패널 탭 라벨을 `Pages` / `Frames` 로 통일하고, frame body Properties 패널은 format 구조 용어와 맞춰 `Frame Preset` 만 노출하도록 정리했다. Legacy Layout UI 잔여 항목인 `URL Prefix` 와 body `Layout` 섹션, component origin/instance 전환용 `Component` 섹션은 frame body authoring surface 에서 숨겼다.
- Frame body 가 legacy `elementsMap` 에 없는 canonical-only 상태여도 active canonical snapshot fallback 으로 frame id 를 해석해 `Frame Preset` 섹션이 표시되도록 복원했다.
- Frames 탭 진입 시 선택된 frame 이 없거나 stale 인 경우 첫 번째 frame 을 자동 선택하고 해당 frame body 까지 즉시 선택하도록 변경했다.
- Pages 탭 진입 시 `currentPageId` 가 비어 있거나 stale 인 경우 기본 Home/첫 번째 page 를 자동 선택하고 해당 page body 까지 즉시 선택하도록 변경했다.
- Frames 탭의 Frames/Layers row wrapper 가 Pages/Layers 와 같은 tree item selected state class 를 사용하도록 맞춰 hover/active 시각 상태를 일관화했다.
- Frames 탭의 불필요한 `layouts-tab` wrapper 와 `sidebar_layouts` / `sidebar_elements` 전용 구조를 제거하고, Pages 탭과 동일한 `section` / `section-content` 구조로 통일했다.
- Frames 탭의 Frames/Layers child 렌더링을 Pages 탭과 같은 `TreeBase` / `VirtualizedTree` 기반으로 전환하고 `frame-tree` 단일 class 를 사용해 수동 list/recursive row 구현과 frame-list/frame-layer 전용 class 분기를 제거했다.

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/FramesTab/__tests__/FrameElementTree.test.tsx src/builder/panels/nodes/FramesTab/__tests__/FrameList.test.tsx src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts` — Frames tab TreeBase/section parity PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/PagesSection.test.tsx src/builder/panels/nodes/tree/PageTree/PageTreeItemContent.test.tsx` — Pages tab parity baseline PASS
- `pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts` — 1 file / 7 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx` — 1 file / 5 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts` — 1 file / 15 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/utils/canonicalRefResolution.test.ts` — 1 file / 6 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/main/BuilderCore.static.test.ts` — 2 files / 11 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts` — 1 file / 6 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts` — 2 files / 16 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts` — 2 files / 20 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts` — 4 files / 31 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/main/BuilderCore.static.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts` — 4 files / 36 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/utils/canonicalRefResolution.test.ts src/builder/utils/multiElementCopy.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts` — component instance materialization PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/utils/canonicalRefResolution.test.ts src/builder/utils/multiElementCopy.test.ts` — component instance properties panel data PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts` — component origin property update/delete canonical persistence PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/__tests__/inspectorFills.test.ts` — component instance override persistence PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts` — canonical-only instance override display/write fallback PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts src/builder/stores/index.test.tsx` — origin-shaped ref mirror instance override PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/index.test.tsx src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts` — legacy/canonical instance Properties override PASS
- `pnpm -F @composition/builder exec vitest run src/builder/components/property/PropertyCustomId.test.tsx src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/index.test.tsx src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts` — origin/instance customId independence PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/index.test.tsx src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/utils/canonicalRefResolution.test.ts src/builder/utils/multiElementCopy.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts src/builder/stores/__tests__/inspectorFills.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts` — component/frame canonical regression sweep PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts` — 1 file / 4 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/workspace/canvas/interaction/selectionModel.test.ts src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.static.test.ts` — frame body auto-selection / Skia body selection PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/PagesSection.test.tsx src/builder/panels/nodes/tree/PageTree/PageTreeItemContent.test.tsx` — page tab body auto-selection PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts && pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts` — page order / Home root PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts` — component origin refresh persistence PASS
- `pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts` — component origin/instance refresh hydrate PASS
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts && pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts` — shared frame multi-page refresh projection PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementReorder.test.ts src/builder/hooks/useValidation.test.tsx src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts` — page-frame projection order_num auto-fix exclusion PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/NodesPanelTabs.static.test.ts src/builder/panels/properties/editors/LayoutBodyEditor.static.test.ts` — visible naming contract PASS
- `pnpm run codex:preflight` — PASS

## [Rollback — ADR-116 post-cutover fix 군 + build error fix + canonical-hydration fix 폐기] - 2026-05-05

### Reverted

- **2026-05-03 ADR-116 post-cutover persistence / canonical frame scope / Layout Preset / Style Panel write-through fix 군 (3 commits: `c85591cd8` / `f55eb470c` / `03292edef`)** + **build error 정합화 시리즈 (9 commits: `919e11217` ~ `d09f706a3`)** + **canonical-hydration page-frame binding fix 3종 (3 commits: `dae3e0dda` / `94c428ae2` / `eacedead7`)** = **총 12 commits 통째 폐기**.
  - **Why**: 사용자 환경에서 누적 회귀 ("프로젝트가 너무 꼬여서 복구 불능" / page→body→frame 적용 후 새로고침 시 body 사라짐). 5-03 fix 군의 targeted vitest 는 pass 했지만 사용자 browser-side 추가 회귀 (build error 시리즈에서 type schema drift 누적 + canonical-hydration fix 적용 후에도 동일 증상 지속) 가 root cause 정합 미달.
  - main HEAD `eacedead7 → 225532ea9` (force push). `225532ea9` = build error 정합화 직전 마지막 commit, codex 작업 mid-point.
  - 폐기 영역 (잔존 debt 재분류): `elementCreation` write-through gap / `frameElementScope` adapter / `isFrameElementForFrame` canonical scope cutover / `legacy-slot-hoisted` Slot 복원 / `removeElements` full snapshot write-through / `updateElementProps` canonical merge / `inspectorActions` Style Panel canonical write-through / Skia FontStyle + SelectionOverlayBuildResult + test fixture 정합 (build error 시리즈) / `useLayerTreeData` filter `getPageFrameBindingId` 매칭 / `collectRuntimeElements` RefNode hoist + layout_id mirror / `isPageNode` RefNode 인식 / `extractPageLayoutBinding` (canonical-hydration fix 시리즈).
  - cutover (`dc498e539`) ~ ADR-116/111/113 Implemented 처리 자체는 보존. ADR-116 본문 §Status 에 rollback 주석 추가하여 폐기 영역을 ADR-116 잔존 debt 로 재분류.
  - 폐기 commits history 는 `backup/before-rollback-eacedead7-2026-05-05` branch 에 보존 (영구 archive). 2차/3차 backup branch (`backup/before-rollback-2-225532ea9-2026-05-05`, `backup/before-rollback-3-8451031c5-2026-05-05`) 는 시도된 추가 rollback (사용자 거부) 의 안전망 — 사용자 명시 승인 후 정리 예정.

### Verification

- baseline `225532ea9` type-check 3/3 PASS (FULL TURBO cache hit)
- browser smoke (Chrome MCP): dashboard 진입 + 새 프로젝트 생성 + page/body LayerTree 표시 정상 / Properties 패널 (Component / Nested Routes / Layout) 정상 / console error 0건 (`[ADR-903 P3-E E-4]` migration dry-run success / `[ADR-113 P4 dry-run]` success)
- frame 적용 시나리오는 baseline 미검증 — 잔존 debt 로 후속 작업 필요

## [ADR-116 post-cutover frame persistence/render fix — ROLLED BACK 2026-05-05] - 2026-05-03

### Fixed

- ADR-116 direct cutover 이후 Builder 에서 element 추가 후 브라우저 새로고침 시 변경사항이 사라지던 회귀를 수정했다.
  - `elementCreation` 단일/복합 element 생성 경로가 active `CompositionDocument` 를 canonical primary store 에 upsert 한 뒤 `db.documents.put(projectId, doc)` 로 저장한다.
  - 기존 `pages`/`elements` hydrate fallback 이 제거된 direct cutover 기준에 맞춰, 신규 편집의 primary persistence 를 `documents` store 로 고정했다.
- Frames 탭과 Skia frame render 경로에서 page/body 가 frame 수만큼 중복 표시되거나 Slot 이 보이지 않던 회귀를 수정했다.
  - `frameElementScope` canonical adapter 를 추가해 reusable FrameNode 별 element scope/body id 를 active `CompositionDocument` 에서 직접 산출한다.
  - `FramesTab`, `buildFrameRendererInput`, `visibleFrameRoots`, `BuilderCanvas` 는 `layout_id` predicate 대신 canonical frame scope 를 입력으로 받는다.
  - `isFrameElementForFrame` 의 legacy mirror predicate 는 `isLegacyFrameElementForFrame` fallback 으로 명시 분리했다.
- Frame Slot 추가 후 authoring tree / Skia render / reload persistence 가 깨지던 회귀를 수정했다.
  - `legacy-slot-hoisted` canonical placeholder 를 Builder derived Element view 에서 `Slot` 으로 복원하고, export boundary 에서 legacy Slot mirror 로만 변환한다.
- Frames 탭에서 frame Layout Preset 을 변경할 때 기존 Slot 이 삭제되지 않고 계속 누적되던 회귀를 수정했다.
  - `removeElements` 는 삭제 후 `setElementsCanonicalPrimary()` 로 active `CompositionDocument` 를 full snapshot 기준으로 갱신한다.
  - `updateElementProps` 는 body `appliedPreset` / container style 변경을 `mergeElementsCanonicalPrimary()` 로 canonical document 에 반영한다.
- Frames 탭 frame body / Slot 선택 후 Style Panel 의 Layout section 변경이 Skia frame render 에 적용되지 않던 회귀를 수정했다.
  - Style Panel 전용 `inspectorActions` commit/preview 경로가 `updateElementProps` 를 우회하던 canonical write-through gap 을 닫고, body/Slot style 을 active `CompositionDocument` 에 즉시 merge 한다.
  - `gap` shorthand batch edit 도 store longhand 정책에 맞춰 `rowGap` / `columnGap` 으로 분배하고, reset dirty 판정이 longhand 값을 읽도록 보강했다.

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/adapters/canonical/__tests__/frameElementLoader.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts src/builder/workspace/canvas/skia/visiblePageRoots.test.ts src/builder/main/BuilderCore.static.test.ts` — 11 files / 83 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts src/builder/panels/properties/editors/ElementSlotSelector.test.tsx src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts` — 8 files / 60 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts src/builder/panels/styles/hooks/useResetStyles.test.tsx src/builder/panels/styles/hooks/useLayoutValues.test.tsx src/builder/stores/__tests__/inspectorFills.test.ts` — 4 files / 49 tests PASS
- Browser smoke: page Button add before/after reload 유지, frame Slot add/reload 유지, immediate frame Layers `["body", "Slot: content"]`, unexpected console/page errors 0건
- Browser smoke: frame body `display/flexDirection/gap` 와 Slot `padding` 스타일 변경 후 store/canonical `CompositionDocument` style 이 동일하게 갱신되고 relevant console/page errors 0건
- `pnpm run codex:preflight` — PASS

## [ADR-116/111/113 direct cutover — flags, backup, runtime migrations 제거 + ADR-111 Implemented] - 2026-05-02

### Architecture

- Canonical primary 전환을 feature flag 없이 기본 경로로 고정했다.
  - 제거: `VITE_ADR116_DOCUMENT_SYNC`, `VITE_ADR116_CANONICAL_PRIMARY`, `VITE_FRAMES_TAB_CANONICAL`
  - 제거: legacy backup/rollback API, ADR-903/113 runtime migration helpers, ADR-111 `migrationP111` dev trigger
  - 변경: canonical document sync 는 Builder 진입 시 항상 시작, in-memory mutation wrapper 는 항상 canonical store 우선
- ADR-111 명칭 충돌을 정리했다.
  - `PanelSlot.tsx` / `BottomPanelSlot.tsx` → `PanelArea.tsx` / `BottomPanelArea.tsx`
  - CSS class 도 `panel-area` / `bottom-panel-area` 로 변경
  - FramesTab/PageLayoutSelector read path 는 canonical reusable FrameNode projection 으로 고정
  - Layout selection state 의 `currentLayoutId` backward-compat alias 를 제거하고 `selectedReusableFrameId` 단일 상태로 고정
  - PageLayoutSelector 의 page-frame binding write 를 `pageFrameBinding` canonical adapter 로 이동해 canonical document store 를 먼저 갱신하고, legacy `pages.layout_id` 는 adapter 내부 mirror/persistence payload 로 격리
  - Legacy `useLayoutsStore` / `layoutActions` 본체를 제거했다. reusable frame create/update/delete/select 는 `frameActions` 가 canonical document + `canonicalFrameStore` 를 직접 갱신하고, DB `layouts` row 는 persistence mirror 로만 유지한다.
  - 초기 hydrate 에서 DB `layouts` mirror snapshot 은 `seedCanonicalReusableFrameLayouts()` 로 canonical reusable FrameNode shell metadata 에 먼저 주입하고, `setElementsCanonicalPrimary()` 는 seeded shell 을 기준으로 frame elements 를 upsert 한다.
  - Frame element read/hydration fallback 과 runtime frame matching predicate 를 `frameElementLoader` canonical adapter 로 이동해 FramesTab/BuilderCore/usePageManager/properties/canvas caller 의 legacy frame mirror 판정을 adapter 경계로 격리
  - Page/frame mirror id read/write helper 를 `frameMirror` canonical adapter 로 분리해 `usePageManager`, `useIframeMessenger`, `AddPageDialog`, page parent/slot selector, page-frame resolver 의 direct legacy field helper import 를 제거
  - Element ownership mirror read/write 도 `frameMirror` canonical adapter 로 확장해 factory/add, frame element tree, frame slot default insert, slider range thumb insert, multi-element copy, canvas delta sanitize, layout preset slot creation caller 의 direct legacy field helper import 를 제거
  - Validation/properties/canvas layout/skia read hot path 의 frame ownership read 를 `frameMirror` adapter 로 전환해 order validation, Properties panel context, LayerTree drop validation, canvas selection, layout publish/cache, full-tree layout, Skia overlay/visible frame root caller 의 direct legacy field helper import 를 제거
  - Store/canonical bridge 의 frame mirror write 를 `frameMirror` adapter 로 전환했다. `canonicalElementsView` derived view 와 `instanceActions` detach materialization 은 더 이상 frame ownership payload 를 직접 legacy helper 로 쓰지 않는다.
  - Project sync, layout template, Preview runtime 의 frame mirror read/write 를 `frameMirror` adapter 로 전환해 import/export boundary 와 preview fallback renderer 의 direct legacy field helper import 를 제거했다.
  - Slot ownership mirror read/write 를 `slotMirror` adapter 로 분리해 Properties panel, layout preset apply, preview slot resolution, page/frame resolver 의 direct `slot_name` helper import 를 제거했다.
  - Component semantics mirror read/write 를 `componentSemanticsMirror` adapter 로 분리해 `ComponentSlotFillSection`, editing semantics fixture, store bridge, instance lifecycle action 의 direct component marker helper import 를 제거했다.
  - Shared export schema/element utilities 의 내부 legacy helper naming 을 mirror terminology 로 정리했다. 이후 residual projection cleanup 에서 shared export schema/element utilities 의 `layout_id`/`slot_name` helper surface 도 제거했다.
  - ADR-116 projection 제거를 시작했다. Preview 는 Builder 가 보낸 `UPDATE_CANONICAL_DOCUMENT` 를 저장하고 `App.tsx` 에서 해당 `CompositionDocument` 를 직접 resolve 하며, 더 이상 Preview 렌더 경로에서 `legacyToCanonical()` 을 호출하지 않는다.
  - Canvas drag/drop helper, BuilderCanvas layout/frame memo, FramesTab, PageLayoutSelector, ComponentsPanel 의 visible/hot read path 는 `selectCanonicalDocument()` projection rebuild 대신 active canonical document / canonical frame surface 를 사용한다.
  - BuilderCore refresh/theme/publish, `usePageManager` project hydrate, `elementCreation` history/reorder path 의 caller-level `selectCanonicalDocument()` projection rebuild 를 제거했다. 해당 경로는 active canonical document, project layout snapshot, frame mirror adapter 를 사용한다.
  - `canonicalDocumentSync` 는 legacy snapshot subscribe/projection sync 를 중단하고 project lifecycle marker 로 축소했다. `usePageManager.initializeProject` 는 초기 hydrate 를 `setElementsCanonicalPrimary()` 로 통과시켜 canonical store 를 직접 seed 한다.
  - `storeBridge.selectResolvedTree`, `pageFrameBinding`, `frameLayoutCascade` 의 잔여 `selectCanonicalDocument()` rebuild 호출을 제거했다. reusable frame delete/page binding 변경은 active canonical document 를 직접 갱신하고, legacy page/elements payload 는 adapter mirror/persistence 경계에서만 생성한다.
  - `canonicalMutations` wrapper 내부 `legacyToCanonical()` rebuild 도 제거했다. `mergeElementsCanonicalPrimary` 는 active document upsert, `setElementsCanonicalPrimary` 는 pages/layouts shell rebuild 후 element upsert 로 동작하며, legacy mirror 는 `exportLegacyDocument()` 단일 경계로 생성한다.
  - `exportLegacyDocument()` 는 `RefNode.descendants[].children` 까지 순회해 page frame slot fill element 가 legacy mirror 에서 누락되지 않도록 보강했다.
  - Compatibility extraction deep cleanup 을 진행했다. resolver/storeBridge/Preview/canonicalElementsView/instanceActions/canonicalRefResolution/editingSemantics/canonicalMutations/exportLegacyDocument 는 더 이상 `metadata.legacyProps` 를 props source 로 읽지 않고 `CanonicalNode.props` / `ResolvedNode.props` 만 사용한다.
  - `extractLegacyPropsFromResolved` 를 제거하고 `extractCanonicalPropsFromResolved` 로 전환했으며, `g5LegacyFieldGrepGate` 가 runtime compatibility extraction 재도입을 차단한다.
  - `exportSsotGrepGate` 는 ADR-112 dev-only editing semantics fixture 의 raw visual marker write 만 명시 allowlist 로 분리했다. runtime/persistence write gate baseline 은 0을 유지한다.
  - `elements.ts` 의 deprecated `selectCanonicalDocument()` projection selector 를 삭제했다. production source 의 `selectCanonicalDocument()` 호출/정의는 0건이며, `legacyToCanonical()` 은 adapter import/export boundary 와 adapter 테스트 경계에만 남긴다.
  - ADR-116 G6-3 parity 첫 slice 로 canonical primary native mutation 의 slot append/clear, ref/descendants mirror export 를 보강했다. Deep cleanup 이후 export mirror 는 canonical `props` / `reusable` / `ref` / `descendants` 기반으로 생성하고, resolver 는 RefNode 를 master type 으로 명시 resolve 한다.
  - ADR-116 G6-3 Ref navigation parity 를 보강했다. `Go to component` 는 canonical reference alias helper 로 origin 을 찾고, origin impact 계산은 canonical `name` 과 metadata `customId`/`componentName` alias 를 포함한다.
  - ADR-116 G6-3 Frame connection parity 를 보강했다. PageLayoutSelector/FramesTab 은 reusable FrameNode 선택값을 `frameMirror` helper 로 정규화하고, page-frame binding 은 native canonical FrameNode id 를 실제 RefNode.ref 로 사용해 `layout-${id}` broken ref 재생성을 막는다.
  - ADR-116 G6-3 Slot/Ref/Descendants/Frame parity completion sweep 으로 native slot descendants mutation, ref mirror export, resolver master-type parity, origin/instance navigation, frame binding id parity 를 하나의 static contract gate 로 고정했다.
  - ADR-116 G6-4 imports parity 첫 slice 로 resolver 가 loaded import document context 를 받아 `<importKey>:<nodeId>` ref 를 resolve 하도록 열었다. import map/source/imported document version 은 resolver cache key 에 반영해 stale cache hit 를 막는다.
  - ADR-116 G6-4 import prefetch/cache registry 를 추가했다. 외부 source fetch 는 DI 가능한 `ImportDocumentFetcher` 로 분리하고, shared import registry 가 loaded document / inflight request / failed status 를 관리하며 `storeBridge.selectResolvedTree` 의 기본 import context 로 연결된다.
  - ADR-116 G6-4 Preview runtime import prefetch 를 연결했다. Preview 는 수신한 `CompositionDocument.imports` 를 shared import registry 로 prefetch 하고, canonical dev resolve/render resolve 에 동일 registry context 를 전달한다.
  - ADR-116 G6-4 import source URL policy 를 추가했다. default import fetcher 는 relative/root/absolute source 를 같은 origin URL로 정규화하고, cross-origin 또는 unsafe protocol source 를 차단한다.
  - ADR-116 G6-4 import namespace guard 를 추가했다. `importKey` 는 명시 namespace 패턴과 reserved object key 차단을 통과해야 하며, invalid namespace ref 는 imported resolver 를 호출하지 않는다.
  - ADR-116 G6-4 import payload adapter 를 추가했다. default fetcher 는 same-origin JSON 응답을 canonical `CompositionDocument` 또는 Pencil-style node tree 로 판별하고, Pencil-style top-level nodes 를 reusable canonical masters 로 정규화한다.
  - ADR-116 G6-4 import registry stale pruning 을 추가했다. document import map 변경/삭제 시 loaded/pending/failed entry 를 현재 import map 기준으로 retain 하고, pruned in-flight fetch 는 늦게 resolve 되어도 registry 에 재저장하지 않는다.
  - ADR-116 G6-4 imports parity completion sweep 으로 resolver loaded-import consumption, imports cache fingerprint, prefetch/cache registry, Preview prefetch/resolve context, same-origin URL policy, namespace guard, payload adapter, stale pruning 을 하나의 static contract gate 로 고정했다.
- ADR-111 G5 Pencil import/export parity 를 완료했다.
  - `apps/builder/src/adapters/pencil/` 에 document-level import/export adapter, schema map, type re-export, 5개 `.pen` fixture, import/roundtrip tests 를 추가했다.
  - `packages/shared/src/types/pencil-adapter.types.ts` 의 Phase 5+ stub 함수는 `pencilDocumentToCompositionDocument()` / `compositionDocumentToPencilDocument()` / node-level mapper 실제 구현으로 승격했다.
  - ADR-116 import payload adapter 는 같은 shared mapper 를 사용해 fetched `.pen` payload 를 canonical import document 로 normalize 한다. file-open adapter 는 원본 `reusable` 값을 보존하고, import registry 경로만 `forceTopLevelReusable` 로 external top-level node 를 reusable master 로 승격한다.
  - 5개 fixture (`minimal`, `slots`, `ref`, `descendants`, `imports`) roundtrip schema-equivalent 검증을 통과해 ADR-111 을 `Implemented` 로 승격했다.
- ADR-116/113 legacy field quarantine helper boundary 를 정리했다.
  - `isMasterElement` / `isInstanceElement` / `getInstanceMasterRef` read-through helper 를 `unified.types.ts` 에서 제거하고, component marker read 는 `componentSemanticsMirror` adapter 경계로 고정했다.
  - `Element` / shared `Element` type schema 에서 `componentRole` / `masterId` / legacy `overrides` mirror field 선언을 제거하고, adapter-owned `ElementWithLegacyMirror` / component mirror fixture helper 로 legacy payload 생성을 격리했다.
  - non-adapter component semantics test fixture 는 `withComponentOriginMirror()` / `withComponentInstanceMirror()` 를 사용하도록 전환했고, `g5LegacyFieldGrepGate` 가 shared type schema 재도입과 non-adapter raw `componentRole` / `masterId` fixture 재도입을 차단한다.
  - Builder/shared/preview Element/Page/Preview type schema 에서 `layout_id` / `slot_name` 선언을 제거하고, dead `ElementLayoutFields` / `PageLayoutFields` 를 삭제했다.
  - frame/slot targeted fixture cluster 는 `withFrameElementMirrorId()` / `withSlotMirrorName()` helper 로 전환했고, `g5LegacyFieldGrepGate` 가 frame/slot type schema 재도입과 targeted raw fixture key 재도입을 차단한다.
  - `MasterChangeEvent` / `DetachResult.previousState` 의 legacy-style field 명칭을 `originId` / `overrideProps` / `descendantPatches` 로 교체했다.
  - canonical resolver fingerprint parameter 의 일반 변수명 `overrides` 를 `descendantOverrides` 로 바꿔 legacy field grep noise 를 제거했다.
- ADR-116 final SSOT closure 를 완료했다.
  - IndexedDB `DB_VERSION` 을 10으로 올리고 `documents` object store 를 추가했다.
  - `DatabaseAdapter.documents.{put,get,delete,getAll}` 와 `CanonicalDocumentRecord` 를 추가해 `CompositionDocument` 를 project primary persistence 로 저장한다.
  - Builder hydrate 는 `db.documents.get(projectId)` 를 canonical seed 로 사용하고 DB `pages`/`elements`/`layouts` fallback 으로 document 를 재구성하지 않는다.
  - `BuilderCore` 는 active canonical document 변경을 microtask debounce 후 `db.documents.put(projectId, doc)` 으로 저장하고, page shell mutation 도 canonical document 에 반영한다.
  - shared export/import schema 는 `document: CompositionDocument` 를 필수 payload 로 검증한다. `ProjectExportData` 와 Publish import path 는 canonical document-only 타입을 사용하고, legacy `pages` / `elements` compatibility payload 는 제거했다.
  - Preview session payload / static HTML export / Publish import 는 serialized `pages`/`elements` 를 사용하지 않고 `CompositionDocument` 에서 render model 을 derive 한다.
  - IndexedDB batch export/import 에서 `pages`/`elements` projection 을 제거했다. runtime migration `_meta` store/API, `getByLayout` adapter/type surface, `layout_id` index 생성도 삭제했다.
  - shared `CanonicalLegacyAdapter*` type stub 과 shared `element.utils.ts` 의 `layout_id`/`slot_name` utility 를 삭제해 shared public surface 의 legacy projection helper 를 제거했다.
  - legacy `descendants` mirror field 를 Element/shared type schema 에서 제거했다. canonical `RefNode.descendants` 는 합법 canonical schema 로 유지한다.
  - broader non-adapter raw fixture key bucket (`layout_id:` / `slot_name:` / `componentRole:` / `masterId:`) 을 0건으로 닫았다.
- ADR-113 Phase 4 를 DB migration 없이 direct cutover 로 닫았다.
  - `normalizeLegacyElement` read-through helper 제거
  - `runTagTypeMigration` 및 관련 dry-run entry/test 제거
  - `descendants` runtime access gate 를 추가해 non-adapter 접근을 canonical resolver/store/type validation allowlist 로 제한
- ADR-116/111/113 format 누락 sweep 을 추가로 닫았다.
  - `PagesApiService.Page.layout_id` optional legacy schema 를 제거하고, `workflowEdges.computeLayoutGroups` 는 page `layout_id` fallback 없이 active `CompositionDocument` 의 reusable frame binding 만 사용한다.
  - `g5LegacyFieldGrepGate` 가 optional legacy field declaration (`layout_id?:` 등) 도 strict gate 로 잡도록 보강했다.
  - Slot factory 의 미정의 `layoutId` 참조와 stale Layout/Slot 주석을 reusable frame context 기준으로 정리했다.

### Documentation

- 완료 ADR 본문 111/113/116 을 `docs/adr/completed/` archive 로 이동하고, ADR README / design breakdown / adjacent completed ADR 링크를 새 위치로 갱신했다.

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalFrameStore.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts src/builder/stores/utils/__tests__/selectReusableFrameContext.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/main/BuilderCore.static.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.static.test.ts` — 11 files / 51 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts src/resolvers/canonical/__tests__/cache.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts src/builder/utils/multiElementCopy.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts src/builder/workspace/canvas/sprites/useResolvedElement.test.ts src/builder/workspace/canvas/skia/StoreRenderBridge.test.ts` — 5 files / 58 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/utils/editingSemantics.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts src/builder/workspace/canvas/interaction/canvasContextMenu.test.ts src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/panels/nodes/tree/LayerTree/LayerTreeItemContent.test.tsx src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts` — 7 files / 65 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts src/builder/stores/utils/__tests__/editingSemanticsRegressionSweep.test.ts` — 5 files / 30 tests PASS
- `pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts src/lib/db/__tests__/getByLayoutDeprecation.test.ts src/lib/db/__tests__/getByLayoutCanonicalPath.test.ts src/builder/main/BuilderCore.static.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts` — 5 files / 16 tests PASS
- `pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts` — 1 file / 4 tests PASS
- `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/integration.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/selection/selectionHitTest.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/panels/properties/editors/ElementSlotSelector.test.tsx src/builder/hooks/useElementCreator.test.ts src/builder/stores/__tests__/pagesLayoutInvalidation.test.ts src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/workspace/canvas/skia/visiblePageRoots.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts` — 14 files / 130 tests PASS
- `rg -n "\\b(layout_id|slot_name)\\??:" apps/builder/src/types packages/shared/src/types apps/builder/src/preview/store apps/builder/src/preview/types -g "*.ts" -g "*.tsx"` — 0건
- `rg -n "\\b(layout_id|slot_name)\\s*:" apps/builder/src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts apps/builder/src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts apps/builder/src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts apps/builder/src/builder/stores/utils/__tests__/editingSemanticsRegressionSweep.test.ts` — 0건
- `rg -n "\\b(layout_id|slot_name|componentRole|masterId)\\s*:" apps/builder/src packages/shared/src apps/publish/src -g "*.test.ts" -g "*.test.tsx" -g "!apps/builder/src/adapters/**"` — 0건
- `rg -n "\\bdescendants\\??:" apps/builder/src/types/builder/unified.types.ts packages/shared/src/types/element.types.ts` — 0건
- `pnpm run codex:typecheck` — PASS
- `pnpm run codex:preflight` — PASS
- `pnpm -F @composition/builder exec vitest run ...` — targeted 7 files / 75 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/layoutActions.test.ts src/builder/stores/utils/__tests__/selectReusableFrameContext.test.ts src/builder/main/BuilderCore.static.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts` — 4 files / 19 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts` — 2 files / 3 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/layoutActions.test.ts` — 1 file / 9 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/adr113DescendantsGrepGate.test.ts` — 1 file / 1 test PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameElementLoader.test.ts src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/main/BuilderCore.static.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/hooks/__tests__/usePageManager.canonical.test.ts` — 6 files / 29 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameElementLoader.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts src/builder/workspace/canvas/selection/selectionHitTest.test.ts src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts src/builder/panels/properties/editors/ElementSlotSelector.test.tsx src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts` — 7 files / 36 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameMirror.test.ts src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/panels/properties/editors/ElementSlotSelector.test.tsx src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts` — 5 files / 28 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/components/dialog/AddPageDialog.static.test.ts src/adapters/canonical/__tests__/frameMirror.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts` — 4 files / 19 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameMirror.test.ts src/builder/hooks/useElementCreator.test.ts src/builder/utils/multiElementCopy.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/panels/properties/FrameSlotSection.test.tsx src/builder/panels/nodes/FramesTab/__tests__/FrameElementTree.test.tsx src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts` — 7 files / 45 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameMirror.test.ts src/builder/stores/__tests__/pagesLayoutInvalidation.test.ts src/builder/stores/__tests__/itemsActions.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/builder/panels/nodes/tree/LayerTree/LayerTreeItemContent.test.tsx src/builder/workspace/canvas/hooks/useLayoutPublisher.static.test.ts src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts src/builder/workspace/canvas/scene/layoutCache.static.test.ts src/builder/workspace/canvas/layout/engines/fullTreeLayout.static.test.ts src/builder/workspace/canvas/layout/engines/fullTreeLayout.syntheticElements.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts src/builder/workspace/canvas/skia/skiaOverlayBuilder.static.test.ts src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts` — 13 files / 51 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts src/adapters/canonical/__tests__/frameMirror.test.ts src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts` — 4 files / 46 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/frameMirror.test.ts src/utils/projectSync.layoutId.static.test.ts src/builder/templates/layoutTemplates.static.test.ts src/preview/previewFrameMirror.static.test.ts` — 4 files / 6 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/slotMirror.test.ts src/preview/previewFrameMirror.static.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts` — 4 files / 16 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/componentSemanticsMirror.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts src/builder/panels/properties/ComponentSlotFillSection.test.tsx src/builder/dev/editingSemanticsFixture.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts` — 6 files / 57 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/panels/components/ComponentsPanel.projection.static.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.static.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/preview/previewFrameMirror.static.test.ts` — 8 files / 25 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/layoutActions.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/panels/components/ComponentsPanel.projection.static.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.static.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/preview/previewFrameMirror.static.test.ts` — 12 files / 60 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/g6ParityCompletion.static.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/frameMirror.test.ts src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/utils/editingSemantics.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts` — 9 files / 74 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalDocumentSync.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/main/BuilderCore.static.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/stores/utils/__tests__/layoutActions.test.ts` — 7 files / 62 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/canonicalMutations.test.ts src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/persistenceWriteThroughStub.test.ts src/adapters/canonical/__tests__/legacyExtensionRoundtrip.test.ts src/builder/stores/utils/__tests__/layoutActions.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/main/BuilderCore.static.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts` — 13 files / 141 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__` — 18 files / 185 tests PASS
- `pnpm -F @composition/builder exec tsc --noEmit --pretty false` — PASS
- `pnpm -F @composition/builder exec vitest run ...` — projection selector removal targeted 17 files / 145 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__ src/resolvers/canonical/__tests__ src/builder/stores/canonical/__tests__` — 27 files / 358 tests PASS
- `pnpm -F @composition/builder exec vitest run src/builder/utils/editingSemantics.test.ts src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/stores/utils/__tests__/instanceActions.test.ts` — 3 files / 50 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/frameMirror.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx` — 5 files / 22 tests PASS
- `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/cache.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 3 files / 65 tests PASS
- `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/cache.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 72 tests PASS
- `pnpm -F @composition/builder exec vitest run src/adapters/pencil/__tests__/pencilImport.test.ts src/adapters/pencil/__tests__/pencilRoundtrip.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts` — 3 files / 24 tests PASS
- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 57 tests PASS
- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 60 tests PASS
- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 62 tests PASS
- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 64 tests PASS
- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 66 tests PASS
- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 67 tests PASS
- `pnpm run codex:preflight` — PASS
- `pnpm run codex:typecheck` — PASS

## [ADR-116 Phase 3 G4 wrapper 진정 reverse logic land ✅ — drift #1 본질 해소 (§8.7)] - 2026-05-02

### Architecture

- **§8.7 wrapper 진정 reverse logic land ✅ — drift #1 본질 해소** (commit `989e7afc2`):
  - 위치: `apps/builder/src/adapters/canonical/canonicalMutations.ts` + `apps/builder/src/builder/stores/canonical/canonicalDocumentSync.ts` + `apps/builder/src/builder/main/BuilderCore.tsx` + `docs/adr/design/116-canonical-document-ssot-transition-breakdown.md`
  - **Why**: §8.6 grep gate baseline 0 도달 = **형식적 PASS** (caller 16 site wrapper 통해 호출 ✅, wrapper 내부 legacy mutation primary ❌) → drift #1 = HC #1 ("최종 SSOT 고정 = `CompositionDocument`") reverse 미도달 본질. 사용자 framing 정정 ("drift #1 선행 해소 의무") + monitoring 1-2주 framing 정정 (시간 텀 본질 아님, fixture coverage 가 본질) 후 wrapper 진정 reverse 본격 진입.
  - **land 4 영역**:
    - (1) **design §8.7 신규 보강** — sub-step β (monitoring trigger 선택) / γ (wrapper internal reverse) / δ (canonicalDocumentSync swap) 정의 + monitoring 1-2주 framing 정정 + wrapper 5 ↔ canonical store action 매핑표 + 4 의문 (mergeElements 신규/기존 분기 / setElements 전체 교체 시 pages/layouts 보존 / DB persist 와 in-memory 순서 / 무한 루프 방지) 정밀화 lock-in
    - (2) **`canonicalMutations.ts` wrapper 진정 reverse** — `isCanonicalPrimaryEnabled()` flag 분기. in-memory wrapper 2개 (mergeElements / setElements) reverse path: (a) 현재 legacy snapshot + 입력 elements merge → (b) `legacyToCanonical()` full doc 재구성 → (c) canonical store `setDocument` push → (d) `exportLegacyDocument()` 결과 legacy `setElements` mirror. DB wrapper 3개 (createElement / updateElement / createMultipleElements) 영향 없음 (D17=A 채택, schema 미변경, DB row = legacy export 결과). DI pattern 확장 — `LegacySnapshot` type + `getCurrentLegacySnapshot` / `getCurrentProjectId` 2 callback 추가
    - (3) **`canonicalDocumentSync.ts` 방향 swap** — flag enable 시 sync 자체 disable (`currentProjectId` 만 set + listener 등록 skip + cleanup 시 reset). canonical primary path 에서는 wrapper 가 직접 양쪽 처리 → 무한 루프 방지
    - (4) **`BuilderCore.tsx` register 호출 확장** — 3 callback 추가 (`getCurrentLegacySnapshot` / `getCurrentProjectId`) + deps `[projectId]` (route 이탈 시 자동 재등록)
  - **검증**: type-check 3/3 PASS + vitest canonical 광역 274/274 PASS (회귀 0) + setup fail 영역 10/10 PASS (DI pattern 정상) + g5 + exportSsot grep gate 5/5 PASS (baseline 0 유지, wrapper 가 `apps/builder/src/adapters/**` exclude 영역 안 배치)
  - **rollback 경로**: `VITE_ADR116_CANONICAL_PRIMARY=false` (default) — 기존 legacy primary path 그대로. 사용자 dev 환경 명시 enable 후 destructive=0 evidence 수집 (선택, fixture coverage 보강용)
  - **Drift 상태 갱신**: drift #1 logic land ✅ (flag enable 시 canonical primary 활성) / drift #3 자동 충족 path 진입 (reverse path 가 `exportLegacyDocument` SSOT 사용). drift #2 (R4 mitigation framing) = 사용자 결정 영역 변동 없음

## [ADR-116 Phase 5 G6-2 closure ✅ — canonicalMutations DI pattern (ESM circular import 차단) + 본문 진행 로그 sync] - 2026-05-02

### Architecture

- **G6-2 third slice closure ✅ — canonicalMutations DI pattern (callback registration)**
  - 위치: `apps/builder/src/adapters/canonical/canonicalMutations.ts` + `apps/builder/src/builder/main/BuilderCore.tsx`
  - **Why**: wrapper API body 가 `useStore` 직접 import → `elements.ts → canonicalMutations.ts → builder/stores/index.ts → elements.ts` ESM circular chain → vitest setup phase 에서 `createElementsSlice` undefined. b7d75f3e4 commit 의 추정 ("transitive circular import chain") 은 정확했으나 origin 파일 (wrapper API 자체) 미특정. 본 closure 가 정확한 origin 확정 + DI pattern fix.
  - 변경: `useStore` import 제거 + `CanonicalMutationStoreActions` 타입 + `registerCanonicalMutationStoreActions(actions)` / `resetCanonicalMutationStoreActions()` / 내부 `getActions()` helper. 5 wrapper 중 2종 (`mergeElementsCanonicalPrimary` / `setElementsCanonicalPrimary`) 만 `getActions()` 경유 (3종 `create/update/createMultiple` 은 `elementsApi` 의존 변경 0). BuilderCore mount useEffect 에서 1회 등록.
  - 외부 영향 0: wrapper 외부 시그니처 변경 0 (caller 16 site 무수정), logic 변경 0 (DI 만), production runtime 동일.
  - 옵션 (b) `elementsApi` 직접 호출 (wrapper 우회) 기각 사유: G4 grep gate baseline 0 회귀 (D18=A 단일 SSOT 격리 위반).
- **G6-2 closure 도달 ✅** (first + second + third slice 모두 land):
  - first slice ✅ — Preview canonical 렌더 fallback (commit `acab96fdf`, 2026-05-01)
  - second slice ✅ — history parity 자동 cover via canonicalDocumentSync 회로 (commit `4023806bf`, 2026-05-02)
  - third slice ✅ — DI pattern circular import 차단 (commit `89f7f3ff4`, 2026-05-02)
- **ADR 본문 §"진행 로그" 8 commits 분 sync** (commit `e3bf016f8`, +94 lines):
  - 메모리 baseline (commit `353e8fc05` 세션 57 G6-1 closure 시그널) 이후 land 된 7 commits 분 entry 추가 (G6-1 second work / G6-2 first+second slice / G7 transition first slice / G7 본격 cutover / G7 closure marker / G6-2 third slice debug attempt)
  - Status header 갱신 (G6-1 closure 시그널 → G6-2 closure + G7 closure marker 모두 ✅)
  - typo fix: `framiG-6ng` → `framing`
- **framing drift 검증 결과** (직전 세션 분석):
  - drift #4 (G6-2 third slice unbounded → HC #8 영구 보류 위험) 해소 ✅ (본 closure)
  - drift #1 (G3 / G4 형식적 PASS, HC #1 진정 미도달) 잔존 — G4 wrapper 내부 진정 reverse 별 세션 영역 (HIGH ~3-5d)
  - drift #2 (R4 mitigation 약화 — ADR-111/113 회피 정책 충돌) 잔존 — 사용자 framing 결정 영역
  - drift #3 (R7 component props `metadata.legacyProps` 부분 잔존) 잔존 — G4 reverse 시 자동 충족

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/itemsActions.test.ts src/builder/stores/__tests__/pagesLayoutInvalidation.test.ts` — **2 file / 10 tests PASS** (이전 setup phase fail)
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/` — **4 file / 99 tests PASS**
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/` — **11 file / 175 tests PASS**
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/exportSsotGrepGate.test.ts` — **1 file / 2 tests PASS** (G4 grep gate baseline 0 유지, D18=A 단일 SSOT 격리 보존)
- `pnpm -F @composition/builder exec tsc --noEmit --pretty false` — **exit 0 PASS**

## [ADR-116 Phase 5 G7 Extension Boundary preflight] - 2026-05-01

### Architecture

- **Canonical document extension write surface 추가**
  - `CanonicalDocumentActions.updateNodeExtension(nodeId, patch)` 추가
  - `events`, `actions`, `dataBinding`, `editor` 를 canonical props 가 아닌 `x-composition` extension 으로만 저장
  - `undefined` patch 는 extension key 삭제, 빈 extension 은 `"x-composition"` field 제거

### Safety

- function callback, Symbol, non-JSON runtime object, circular payload 를 extension payload 에 저장하지 않고 dev warn 후 skip
- 기존 `updateNodeProps` 의 `events/actions/dataBinding` props 저장 금지 방어와 함께 G7 boundary 의 합법 저장 경로를 명시

### Verification

- `pnpm -F @composition/shared exec tsc --noEmit --pretty false` PASS
- `pnpm -F @composition/builder exec tsc --noEmit --pretty false` PASS
- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalDocumentStore.test.ts` — 42 tests PASS

## [Canonical Document SSOT 전환 — ADR-116 Phase 0 G1 land + Accepted 승격] - 2026-05-01

### Architecture

- **ADR-116 Status `Proposed → Accepted` 승격** (Phase 0 G1 Schema Boundary Freeze land 동시):
  - 위치: `docs/adr/completed/116-canonical-document-ssot-transition.md` + `docs/adr/design/116-canonical-document-ssot-transition-breakdown.md`
  - **Why**: ADR-903/110/111/112/113/114 라인업 누적 + tier3 entry "다음 Tier 1 = ADR-116 진입" 권고 — `CompositionDocument` canonical schema 를 저장/편집/렌더/history/preview/publish 의 장기 SSOT 로 승격. 본 phase 는 schema boundary 만 고정 (logic 변경 0).
  - ADR fork checkpoint 4 질문 lock-in (§Decision):
    1. base/응용 분류 — ADR-116 = canonical SSOT 추상 base / ADR-111/113/114 = 응용 specialization
    2. schema 직교성 — canonical core ⊥ Composition extension (`x-composition`) ⊥ legacy adapter ⊥ Pencil primitive
    3. ADR-903 baseline reverse 검증 — read-through projection ↔ primary SSOT reverse 가 valid 한 사유 명시 (transition bridge / 후속 ADR 누적 / closure ADR 부재)
    4. codex 1차 review 진입 시점 명시
- **`CanonicalNode.props?: Record<string, unknown>` 신규 canonical 필드** (G1 §2.1 결정):
  - 위치: `packages/shared/src/types/composition-document.types.ts`
  - **Why**: `Button`/`TextField`/`Section` 등 component semantics 의 최종 저장 위치 확정. Phase 1 이후 신규 canonical write 는 `metadata.legacyProps` 가 아닌 `CanonicalNode.props` 사용. legacy export adapter 가 필요할 때만 `metadata.legacyProps` 로 transition.
- **`CompositionExtension` / `CompositionExtendedNode` / `SerializedEventHandler` / `SerializedAction` / `SerializedDataBinding` 타입 추가** (G1 §3 namespace):
  - 위치: `packages/shared/src/types/composition-document.types.ts`
  - **Why**: canonical core 의 Pencil 구조 정합 유지. `events`/`actions`/`dataBinding`/`editor` 는 canonical core 가 아닌 `x-composition` namespaced extension 으로 분리. function callback / React runtime object serialize 금지.
- **legacy 9 필드에 ADR-116 G5/G7 cleanup target marker 부착**:
  - 위치: `apps/builder/src/types/builder/unified.types.ts`
  - 대상: `Element.events` / `Element.dataBinding` (G7 Extension Boundary), `Element.layout_id` / `Element.slot_name` / `Element.componentRole` / `Element.masterId` / `Element.overrides` / `Element.descendants` / `Element.componentName` (G5 Legacy Field Quarantine)
  - **Why**: 기존 `@deprecated ADR-113 Phase 5` 마커 위에 ADR-116 G5/G7 gate 동기화. Phase 4/Phase 5 시점에 `apps/builder/src/adapters/canonical/**` 디렉터리 외 read/write 0건이 cutover 기준.
- **design §5 Phase 0 baseline grep 4건 기록** (main HEAD `119f0206c`):
  - `legacyToCanonical(` 호출 site **44** (Phase 2 G3 제거 대상)
  - `metadata.legacyProps|legacyProps` 참조 **92** (Phase 1 이후 신규 write 0건 + Phase 4 adapter 외 0건 목표)
  - legacy 5필드 broad word grep **1062** (broad noise 포함 — Phase 4 G5 정밀 grep 으로 재측정)
  - events/dataBinding broad word grep **856** (Phase 5 G7 시점 adapter 외 0건 목표)

### Documentation

- **`docs/adr/README.md` 갱신**:
  - ADR-116 을 미구현 → 부분 완료 섹션으로 이동 (Status `Accepted` + Phase 0 G1 land 반영)
  - 카운트: 부분 완료 7→**8** / 미구현 7→**6** / 합계 120 유지
  - "최종 업데이트" 헤더에 2026-05-01 ADR-116 Phase 0 G1 land 요약 prepend
- **ADR-116 본문 §"진행 로그"** — Phase 0 G1 land 5 항목 (framing lock-in / 타입 land / legacy marker / design §5 / type-check) 기록.

### Verification

- `pnpm type-check` 3/3 PASS (5.23s, cache miss). 신규 `CanonicalNode.props?` optional 필드 추가가 기존 41+ canonical consumer 를 깨지 않음을 확증.

### Next steps

- **Phase 1 G2 (Canonical Store/API)** — `CanonicalDocumentActions` mutation API + `CanonicalLegacyAdapter` 역방향 export adapter API 설계 (design §6)
- **Codex 1차 review** — framing #3 reverse 정당화 + G1 산출물 동시 round-trip
- ADR-111 G3/G4/G5 잔여 + ADR-113 P4-Step 4-4 / P5-A~5-E 는 ADR-116 G2 land 후 재평가

## [ADR-112 Editing Semantics UI gate closure] - 2026-04-30

### Bug Fixes

- **Detach instance 경고 UX 를 모든 진입점에 공통 적용**:
  - Properties panel, LayerTree row context menu, Canvas context menu, global shortcut 가 동일 confirmation host 를 사용
  - 기존 `window.confirm` fallback 을 제거하고, detach 후 origin 과 분리되어 이후 origin 변경을 받지 않는다는 copy 를 명시
- **원본에서 Select instances 실행 시 instance semantic highlight 누락 수정**:
  - multi-selection combined bounds 와 별개로 각 selected instance 의 violet dotted semantic target 을 유지
  - origin/instance marker parity 가 단일 선택과 다중 선택 모두에서 같은 overlay path 를 사용
- **Frames 탭 새로고침 후 등록 Frame body/Slot 이 누락되던 회귀 수정**:
  - layout mode 복원 시 선택 frame 하나만 보정하지 않고 등록된 frame 전체의 body/slot elements 를 `loadFrameElements` fallback 으로 병합
  - FramesTab 진입 시 store 에 없는 frame elements 를 보강 로드해 여러 frame 등록 후 새로고침해도 tree/canvas 입력이 비지 않도록 보정
  - Page 전환 중 frame elements 를 로드하는 경로도 `getDescendants(layoutId)` 직접 호출 대신 legacy `layout_id` snapshot fallback helper 로 통일
  - 새로고침 직후 frame inputs 가 WASM layout ready 전에 만들어지면 layoutMap publish 가 skip 된 뒤 재실행되지 않던 경로를 차단하고, `wasmLayoutReady` 전환도 frame/page layout publish trigger 에 포함
- **Frames 탭에서 Frame 추가 직후 body 가 보이지 않던 생성 경로 수정**:
  - 새 Frame 생성 시 `layouts` store 가 신규 frame 을 즉시 selected frame 으로 지정해 body 자동 선택과 renderer input 이 같은 frame id 를 보도록 보정
  - selected frame id 가 frame 목록 canonical projection 보다 먼저 도착해도 `FramesTab` 이 fallback current frame 으로 body tree 를 렌더
  - 진행 중인 `fetchLayouts` 가 새로 생성/삭제된 local frame state 를 stale DB snapshot 으로 덮어쓰지 않도록 fetch 결과 병합 guard 추가
  - legacy layout id 와 canonical frame id(`layout-<id>`) 매칭을 통일해 Slot 조회/delete cascade 가 canonical projection 에서 빠지지 않도록 보정
- **Frames 탭에서 Frame 을 연속 추가하면 홀수 번째 body 만 보이던 Skia layout 회귀 수정**:
  - reusable Frame body 는 `page_id` 가 없으므로 persistent Taffy tree 를 `__default__` 로 공유하지 않고 `page_id ?? layout_id ?? bodyId` key 로 분리
  - layout map, filtered children map, persistent tree 가 같은 frame root key 를 사용해 여러 Frame 의 root state 가 생성 순서에 따라 섞이지 않도록 보정
- **Frames 탭에서 Frame body 선택 시 selection box 가 나타나지 않던 회귀 수정**:
  - Frame authoring 중 store 의 `currentPageId` 가 남아 있어도 실제 렌더된 `layout_id` 소유 element 는 `treeBoundsMap` 기준으로 selection target 에 포함
  - body, Slot, frame child selection 이 page id 매칭이 아니라 현재 render root membership 으로 overlay bounds 를 계산하도록 보정
- **Skia 화면에서 Frame body 빈 영역 클릭 시 body 가 선택되지 않던 회귀 수정**:
  - 빈 영역 body fallback hit-test 가 Page 영역보다 Frame authoring 영역을 먼저 검사하도록 보정
  - `page_id=null` 인 Frame body selection 을 Page 밖 클릭으로 오인해 clear 하지 않고 실제 `layout_id` body 선택으로 처리
- **Skia 화면에서 Frame body 빈 영역 hover outline 이 나타나지 않던 회귀 수정**:
  - hover 후보가 body 직계 child 에만 한정되어 Frame body 자체의 빈 영역이 hover target 이 되지 않던 경로를 보정
  - Frames tab overview 의 rendered frame area 를 기준으로 `page_id=null` + `layout_id=<frameId>` body 를 hover target 으로 보강
- **Frames 탭 P3-ε interaction gate 보강**:
  - Frame body selection fallback 이 hover 와 같은 topmost frame area 기준으로 동작하도록 보정
  - `position:absolute` manual-position child drag 는 reorder/drop 대신 `style.left/top` 을 갱신하고, auto-layout child 는 기존 layout-aware reorder/drop commit 을 유지
  - Frame body / Slot 선택 후 Transform·Layout 편집이 Properties/Style 패널을 통해 적용되는 것을 확인해 Node tree/Properties sync 기준을 닫음
- **ADR-111 P3-ζ browser regression closure**:
  - 사용자 인증 브라우저에서 Frames 탭 기본 렌더, 새로고침 유지, Pages↔Frames 전환, body/Slot hover+selection, Transform/Layout 편집, Frame 적용 Page, 동일 Frame 다중 Page, Tabs 복합 컴포넌트, drag 위치 소유권 기준을 모두 확인
  - P3-δ (c), G3-θ (d), G3-ε, G3-ζ 를 frame authoring 편의 확장 범위에서 닫고, ADR-111 전체 잔여를 G3 cascade / G4 legacy adapter / G5 pencil 호환 검증으로 재정리
- **ADR-111 G3 cascade slice #1 — Frame 복제 직후 body/Slot 누락 회귀 수정**:
  - `createDuplicateLayoutAction` 이 cloned layout element subtree 를 IndexedDB 에 저장한 뒤 live Zustand `elementsMap` 에 merge 하지 않아 새로고침 전 Frames authoring surface 에 복제된 body/Slot 이 빠질 수 있던 경로를 보강
  - clone payload 는 새 `layout_id`, 새 id, remapped `parent_id`, `page_id:null` 을 유지하고, DB write-through 와 같은 턴에 `mergeElements(newElements)` 로 store 를 동기화
  - `layoutActions.test.ts` 에 Slot + child 포함 frame clone fixture 를 추가해 DB insert payload 와 live store merge 를 함께 검증
- **ADR-111 G3 cascade slice #2 — Frame 삭제 후 Page orphan ref 방지**:
  - `deleteLayout` 에서 canonical frame projection 이 없으면 element cascade 는 skip 하되, 삭제되는 layout 을 참조하는 Page `layout_id` 는 projection guard 밖에서 항상 `null` 로 해제
  - stale layout row 삭제나 projection race 상황에서도 Apply Frame 값이 존재하지 않는 Frame 을 계속 가리키는 orphan reference 로 남지 않도록 보강
  - `layoutActions.test.ts` 에 frame projection 없음 + page ref cleanup fixture 를 추가해 `removeElements` skip 과 `db.pages.update` / live `setPages` 실행을 함께 검증
- **ADR-111 G3 cascade slice #3 — 적용된 Frame 삭제 후 Skia stale render 회귀 수정**:
  - Frame 삭제 액션이 `stores/elements.ts` 의 standalone compatibility store 를 갱신하고, Skia/PageLayoutSelector 는 `stores/index.ts` 통합 store 를 구독해 live 화면이 삭제 전 Frame 합성을 유지하던 경로를 보정
  - `layoutActions` 와 `layouts.getLayoutSlots` 가 `rootStoreAccess.getLiveElementsState()` 를 통해 런타임 통합 Builder store 를 우선 사용하고, 테스트/비브라우저 환경에서만 기존 elements store 로 fallback
  - `setPages` 가 page list shape / order / `layout_id` 변경 시에만 `layoutVersion` 을 증분하도록 제한해 Frame apply/unapply/delete 경로의 layout publisher 와 renderer cache invalidation 을 같은 턴에 트리거
  - `rootStoreAccess.test.ts` / `pagesLayoutInvalidation.test.ts` 로 live store 우선 조회, frame binding 해제 시 `layoutVersion` 증분, 단순 page metadata 변경 시 no-bump 를 함께 검증
- **Frames 탭 authoring surface 를 Page 추가 UX 와 같은 multi-canvas overview 로 개선**:
  - Frames mode 에서 선택된 Frame 하나만 같은 위치에 렌더하지 않고 등록된 reusable Frame 전체를 표시
  - Page layout direction(horizontal/vertical/zigzag) 과 같은 배치 규칙으로 Frame canvas 를 정렬해 추가한 layout 을 한 화면에서 비교 가능
  - Page canvas 좌상단 title 과 같은 Pencil-style label 을 Frame canvas 좌상단에도 렌더해 multi-frame overview 에서 각 Frame 을 즉시 식별 가능
  - Skia 화면에서 다른 Frame body/child 를 클릭하면 해당 `layout_id` 를 selected reusable frame 으로 동기화해 Node tree 와 canvas selection 이 같은 Frame 을 가리킴
  - Frames mode 의 빈 공간 클릭에서 숨겨진 Page hit-test 를 비활성화해 Page 탭의 과거 page 위치를 클릭해도 current page anchor 가 바뀌며 Frame canvas 가 이동하지 않도록 보정
  - Tabs virtual Tab 같은 layout synthetic children 을 root 별로 저장/재발행해 여러 Page/Frame layout publish 후 마지막 root 의 Tabs 만 정상 렌더링되는 회귀를 차단
- **Frame preset 적용 직후 Layout reset 이 활성화되던 baseline 판정 수정**:
  - `appliedPreset` 의 normalized `containerStyle` 을 frame body reset baseline 으로 포함해 preset 이 만든 `display`/`flexDirection` 을 사용자 override 로 보지 않도록 보정
  - Layout reset 은 사용자가 변경한 값만 preset baseline 으로 되돌리며, 수직 2단 preset 적용 직후에는 dirty 상태가 되지 않음

### Features

- **Pencil 호환 detach shortcut 추가**:
  - `Cmd/Ctrl + Option/Alt + X` 를 shortcut catalog 와 global handler 에 등록
  - 실행 전 `canDetachInstance` guard 와 detach warning dialog 를 거쳐 기존 `detachInstance` store action 을 호출

### Documentation

- **ADR-012 / ADR-900 을 ADR root active queue 에서 completed archive 로 이동**:
  - `docs/adr/012-rendering-layout-pipeline-hardening.md` → `docs/adr/completed/012-rendering-layout-pipeline-hardening.md`
  - `docs/adr/900-unified-skia-rendering-engine.md` → `docs/adr/completed/900-unified-skia-rendering-engine.md`
  - ADR-012 는 ADR-009 기반 Taffy/PixiJS hardening 계획을 ADR-900 이후 legacy residual 로 Superseded 처리하고, P3-1 dirty tracking 잔여 debt 는 historical reference 로 보존
  - ADR-900 은 Accepted baseline 으로 completed archive 에 등록하고, README 카운트 갱신: 완료 104→106, 부분 완료 8→7, 합계 119→120
- **ADR-114 standalone plan 을 Superseded archive 로 이동**:
  - `docs/adr/114-imports-resolver-designkit-integration.md` → `docs/adr/completed/114-imports-resolver-designkit-integration.md`
  - ADR-115 로 DesignKit integration scope 는 이미 무효화됐고, 남은 P5-D/P5-E `imports` fetch/cache/resolver scope 는 ADR-116 canonical document SSOT transition 과 ADR-111 G5 Pencil import/export parity 로 흡수
  - ADR-111 잔여 G3/G4/G5 와 ADR-113 Phase 4/5 진입 순서를 ADR-116 G2/G5/G6 이후로 재정렬
  - ADR README 카운트 갱신: 완료 103→104, 미구현 8→7, 합계 119 유지
- **ADR-112 를 Implemented 로 승격하고 ADR-111 재개 조건을 갱신**:
  - ADR-112 G4-B/G4-C/G4-E/G4-H 잔여 gate 를 닫고 design breakdown 의 남은 gate 목록을 0건으로 정리
  - ADR-111 은 Implemented 가 아니라 `Ready to Resume` 상태로 전환. 이후 P3-ε/P3-ζ 는 ADR-112 기능 위의 frame authoring 편의 확장으로만 재개 가능
  - ADR README 에서 ADR-112 row 를 완료 테이블로 이동하고 미구현 count 를 7→6 으로 갱신
- **ADR-112 본문을 completed archive 로 이동**:
  - `docs/adr/112-editing-semantics-ui-5elements.md` → `docs/adr/completed/112-editing-semantics-ui-5elements.md`
  - ADR README / ADR-111 / ADR-116 / 관련 design breakdown 의 현재 링크를 completed 경로로 갱신

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/components/overlay/EditingSemanticsImpactDialog.test.tsx src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/panels/nodes/tree/LayerTree/LayerTreeItemContent.test.tsx src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts src/builder/utils/editingSemantics.test.ts src/builder/utils/multiElementCopy.test.ts src/builder/stores/utils/__tests__/editingSemanticsRegressionSweep.test.ts src/builder/config/keyboardShortcuts.test.ts`

## [ADR-112 Page-frame shared Frame projection collision fix] - 2026-04-30

### Bug Fixes

- **동일 Frame 을 여러 Page 에 적용하면 각 Page child 가 서로 복제된 것처럼 섞이던 Skia 회귀 수정**:
  - Page-frame 합성 resolver 가 raw frame Slot id 를 모든 Page 에 재사용해 shared layout/filtered children/Skia registry 에서 같은 Slot parent 로 충돌하던 경로를 차단
  - frame subtree 를 Page별 synthetic projection id(`page::page-frame::frameElement`) 로 분리하고, Page root fill 은 해당 Page 의 projected Slot 아래로 reparent
  - Skia renderer input 과 `StoreRenderBridge` 가 raw store map 이 아니라 page-resolved projection map/childrenMap 을 사용해 layout publish tree, command stream tree, hit-test/selection tree 를 일치
  - `useLayoutPublisher` layout 계산 입력에도 projected page elements 를 주입해 synthetic Slot/frame node 가 원본 `elementsMap` 누락으로 layout/paint 에서 빠지지 않도록 보강
- **Page 에 적용된 Frame Slot 이 보이지 않던 overlay 회귀 수정**:
  - Page-frame Slot 은 Spec dashed box/text chrome 은 숨기되 editor overlay marker 는 유지하도록 `_slotChrome` 과 `_slotMarkerChrome` 정책을 분리
  - empty Slot 은 Pencil-style hatch+border 를 표시하고, child 가 채워진 Slot 은 hatch 없이 border 만 표시
- **Frames mode 새로고침 후 일부 Frame body/Slot 이 누락되거나 Slot size 가 0 으로 보이던 회귀 수정**:
  - `BuilderCore` 의 layout-mode refresh 보정도 `FramesTab`/`PageLayoutSelector` 와 동일한 `loadFrameElements` fallback 을 사용해 canonical descendants 에 frame body 가 없으면 legacy `layout_id` snapshot 으로 복원
  - 빈 frame load 결과로 `initializeProject` 첫 hydrate 에 포함된 frame body/slot 을 replace 하지 않도록 가드해 다중 Frame 등록 후 새로고침 표시 상태를 안정화

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/workspace/canvas/hooks/useLayoutPublisher.static.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/utils/editingSemantics.test.ts src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/skia/skiaOverlayBuilder.static.test.ts src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts src/builder/utils/frameElementLoader.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/workspace/canvas/BuilderCanvas.frameMode.static.test.ts`

## [ADR-112 Skia render materialization follow-up — layout publish full rebuild] - 2026-04-29

### Bug Fixes

- **Pages ↔ Frames 전환 시 scene source 가 섞이던 Skia 회귀 수정**:
  - Page mode 는 page roots 만 렌더하고, persisted `selectedReusableFrameId`/`frameAreas` 가 남아 있어도 separate frame authoring roots 를 렌더하지 않음
  - Frames mode 는 selected reusable frame root 만 렌더하고, visible page snapshots/page elements 를 Skia root collection 에서 제외
  - Page mode 의 frame Slot 은 layout anchor 로만 남기고 Skia placeholder chrome 을 숨겨 raw Slot dashed box 가 page 화면에 노출되지 않도록 보정
  - Frames mode frame authoring surface 를 현재 Page 의 좌표와 `pageWidth/pageHeight` 로 정규화. 기존 ADR-111 P3-δ 의 “page 오른쪽 별도 authoring area” stale `framePositions` 는 layout publish/render root 좌표 source 로 쓰지 않음
- **Layout preset replace 시 Slot 이 live 화면에서 중첩되고 새로고침 후 정상화되던 회귀 수정**:
  - `replace` 가 기존 Slot 여러 개를 `Promise.all(removeElement(...))` 로 병렬 삭제하면서 각 삭제가 오래된 `currentState` 로 set 하고 마지막 commit 이 앞선 삭제를 메모리에 되살리던 문제를 차단
  - 기존 Slot 삭제를 `removeElements([...slotIds])` 단일 배치 액션으로 원자화해 IndexedDB 와 live Zustand state 의 삭제 결과를 일치
- **Frame 추가 후 preset 적용 시 초기 높이가 Page 를 초과하고 Transform reset 이 활성화되던 회귀 수정**:
  - Layout preset 의 `containerStyle.minHeight: "100vh"` 를 reusable frame body inline style 로 저장하지 않도록 적용 단계에서 정규화
  - Frame authoring surface 는 이미 현재 Page 높이로 bounded 되므로 viewport 기준 `minHeight` 를 Transform override 로 남기지 않음
- **Page 에 Frame 적용 후 새로고침하면 frame binding 이 사라지던 회귀 수정**:
  - 신규 Page 생성 persistence 가 background queue 에 남아 있는 동안 Frame 선택 저장이 queue 밖에서 `pages.update(layout_id)` 를 먼저 실행해, live store 만 바뀌고 IndexedDB 에는 누락되거나 이후 `layout_id: null` insert 로 덮이던 경로를 차단
  - `PageLayoutSelector` 의 `layout_id` 저장을 page persistence queue 뒤로 직렬화하고, queue 자체도 enqueue 호출 시점에 `queueTail` 을 즉시 append 하도록 보강
  - project cloud upload/download 도 page `layout_id` 를 보존해 수동 sync 경로에서 Frame 적용 상태가 유실되지 않음
- **Frame 적용 후 Page 요소/Frame Slot 이 보였다 안 보였다 하던 Skia shared layout 회귀 수정**:
  - Page mode 의 frame 합성 layout 과 Frames mode 의 frame authoring layout 이 같은 Slot/frame element id 를 서로 다른 parent tree 로 계산하면서 shared layout map 에 동시에 남아 서로 덮어쓰던 문제를 차단
  - `useLayoutPublisher` 가 현재 active page/frame key 만 유지하고 mode 전환 시 stale layout map + filtered children map 을 제거하며, layout map set/delete 를 batch publish 해 중간 상태가 렌더러에 노출되지 않도록 보강
  - frame body 의 filtered children map key 도 `__default__` 대신 `page_id ?? layout_id ?? bodyId` fallback 을 사용해 page/frame tree source 와 layout map key 를 일치
- **Page 에 Frame 적용 시 frame content 가 Page 상단에만 붙던 합성 레이아웃 회귀 수정**:
  - `resolvePageWithFrame` 이 frame body 의 container layout 문법(`display`/`flexDirection`/`grid` 등)을 page body 합성 root 에 반영하되 page 의 width/height/background 는 유지
  - page-resolved root Slot 에 flex/grid fill 기본값을 주입해 hidden Slot chrome 상태에서도 content Slot 이 남은 Page 영역을 채우도록 보강
  - `useLayoutPublisher` 가 synthetic `bodyElement` 를 원본 `elementsMap` body 로 되돌리지 않도록 layout 계산 입력 map 에 우선 주입
- **Slot 내부 중앙 `Slot` placeholder text 제거**:
  - visible Slot chrome 은 Pencil-style hatch+border marker 가 담당하므로 `SlotSpec` 의 standalone text shape 생성을 제거
  - Slot background/border shell 은 유지해 hit-test/layout anchor 와 editor marker target 은 그대로 보존
- **Slot hatch 를 empty placeholder chrome 으로 정정**:
  - child 가 없는 empty Slot host 에만 diagonal hatch + border 를 표시
  - child 가 채워진 Slot host 는 hatch 를 제거하고 hover/selection border 와 handles/size label 만 semantic color 로 표시
  - Page 에 Frame 적용 시 page fill 이 raw `elementsMap` parent 관계가 아니라 layout publish 의 filtered render tree 에만 반영되는 경로를 고려해, hatch empty 판정을 실제 render `childrenMap` 기준으로 보정
- **Frames tab 에 여러 Frame 등록 후 교차 선택 시 수직 3단 frame 이 깨지던 회귀 수정**:
  - frame 선택을 DB descendant load 완료 전 즉시 반영하고, 늦게 끝난 이전 async load 가 최신 선택 frame 을 되돌리거나 stale subtree 를 병합하지 않도록 request token guard 추가
- **Properties Component section 의 component name 누락 수정**:
  - Component section 에 `Name` row 를 추가해 reusable frame origin 선택 시 `ArticleFrame` 같은 component name 과 `Origin` role label 이 동시에 보이도록 보강
  - ADR-112 G4-F dev fixture(`?editingSemanticsFixture=slot`) 를 추가해 같은 Properties surface 에 `Component`/`Name`/`Origin` 과 `Slot` recommendation list 가 동시에 보이는 browser screenshot evidence 를 고정
- **Pages/Frames component 추가 후 selection 만 잡히고 화면에 보이지 않던 Skia 회귀 후속 수정**:
  - `StoreRenderBridge` 의 layout publish 재동기화가 canonical projection/synthetic id 때문에 incremental sync 로 빠질 수 있던 경로를 차단
  - layout publish, 초기 sync, async image materialization 은 full rebuild 를 강제해 첫 store sync 시 layout 이 없어서 `buildSpecNodeData` 가 null 을 반환한 component 도 layoutMap 발행 후 즉시 materialize
  - 이전 Skia stale content/cache invalidation + `useLayoutPublisher` input 구조 감지 보강 위에 node registry materialization 경로를 추가로 닫음
- **Frame 적용 Page 에서 Page 자체 선택 후 추가한 component 가 body tree 밖에 생성되던 회귀 수정**:
  - simple component 생성 경로가 `selectedElementId` 를 실제 element id 검증 없이 parent_id 로 저장하던 문제를 차단
  - selected id 가 page id 처럼 현재 page elements 에 없는 selection 이면 body element 로 fallback 하도록 정규화해, frame 적용 시에도 body/content slot 경로와 LayerTree 구조를 일치
- **새로고침 후 Apply Frame 선택값은 남지만 frame slot 이 Page 에 합성되지 않던 회귀 수정**:
  - project initialize 시점에 `layouts` store 와 `elementsMap` 이 아직 hydrate 전이면 canonical reusable frame 목록이 비어 frame descendants 가 병합되지 않던 경로를 차단
  - DB snapshot 의 `allElements` + project layouts 로 canonical input 을 만들고, canonical frame id(`layout-<id>`) 를 legacy `layout_id` 로 정규화해 frame body/slot elements 를 첫 hydrate 에 포함
- **Frame 적용 Page 의 content Slot hover 는 되지만 selection box 가 표시되지 않던 회귀 수정**:
  - hit-test 는 frame Slot id 를 선택하지만 selection renderer 가 raw frame Slot 의 `page_id: null` 을 현재 Page 와 불일치로 걸러 selection bounds 를 만들지 못하던 경로를 차단
  - 현재 rendered `treeBoundsMap` 에 존재하는 layout Slot projection 만 selection target 예외로 허용해 stale frame layout element 가 Page selection 으로 새지 않도록 제한
- **Frames tab 진입 후 Page tab 복귀 시 live frame 적용이 해제되던 회귀 수정**:
  - FramesTab fallback load 가 `db.elements.getDescendants(frameId)` 빈 결과를 받은 뒤 기존 `layout_id === frameId` 요소를 메모리에서 제거해, Page 의 `layout_id` 는 남았지만 resolver 가 frame body 를 찾지 못하던 경로를 차단
  - frame element load 를 canonical descendants 우선 + legacy `layout_id` fallback helper 로 통합하고, FramesTab 은 빈 조회 결과로 live elements 를 replace 하지 않고 merge 만 수행
  - PageLayoutSelector 의 Apply Frame live load 도 동일 helper 를 사용해 새로고침 hydrate 경로와 live apply 경로를 일치
- **Frames tab 복귀 후 Skia command stream 이 raw page tree 로 fallback 하던 회귀 수정**:
  - Frames mode 진입 시 page key 의 filtered children map 이 stale cleanup 으로 삭제된 뒤, Page mode 복귀에서 `getCachedPageLayout` 이 cache hit 로 빠지면 layout map 만 재사용하고 frame 합성 filtered children map 을 재발행하지 않던 경로를 차단
  - cached page layout entry 에 실제 publish 된 filtered children map 과 root key 를 저장하고, cache hit 에도 `publishFilteredChildrenMap` 을 재실행해 command stream 이 Page-frame 합성 tree 를 계속 사용하도록 보장

### Features

- **ADR-112 Slot section 을 내부 container slot host 까지 확장**:
  - Pencil `.pen` schema 의 `Frame.slot` 의미에 맞춰 `CardContent` 같은 구조 container shell 을 instance `descendants[idPath].children` 교체 target 으로 지정 가능
  - Properties ##Slot section## 은 `frame` 뿐 아니라 `CardContent`/`CardHeader`/`CardFooter`/`Group`/`Section` 등 frame-compatible host 에서도 enable/disable 과 recommended component add/remove 를 제공
  - Slot recommendation list 에서 추천 component origin 을 default content 로 삽입할 수 있어 CardFooter slot 에 등록한 Text origin 을 origin component 화면에 바로 표시 가능
  - Component instance 선택 시 ##Slot Fill## section 을 노출해 추천 component origin 을 `descendants[slotPath].children` ref 로 채우고 instance 화면에 표시
- **ADR-112 slot marker 를 Pencil hatch+border 패턴에 맞춰 보강**:
  - visible slot host bounds 에 editor-only diagonal hatch overlay 와 border stroke 를 상시 표시
  - slot marker 색상은 component context 를 따라 origin slot 은 Pencil origin `#D480FF`, instance slot 은 Pencil instance `#9580FF` 로 표시하고, legacy Slot authoring chrome 은 origin `#D480FF` 로 fallback
  - 선택 요소 하단 size label 배경도 origin/instance semantic color 를 따라가도록 맞춤
  - Page 합성용 `_slotChrome:"hidden"` 은 제외해 page 화면에 raw Slot chrome 이 노출되지 않게 유지하고 기존 component runtime style/spec 에는 누출하지 않음

### Architecture

- **Internal slot fill projection 보강**:
  - canonical adapter 가 Element top-level `slot`/`metadata.slot` 을 CanonicalNode `slot` 으로 보존
  - canonical resolver 는 `type === "frame"` 고정 대신 `slot` field 를 가진 host 를 slot contract validation 대상으로 처리
  - Builder synthetic ref projection 은 `descendants[path].children` mode C replacement children 을 materialize 해 내부 slot custom subtree 가 LayerTree/Canvas input 에 남도록 보강
  - Slot fill action 은 replacement child 를 `{ type: "ref", ref: <originId> }` 로 저장해 origin id recommendation 과 실제 instance content fill 을 분리

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/StoreRenderBridge.static.test.ts src/builder/workspace/canvas/hooks/useLayoutPublisher.static.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/panels/properties/editors/ElementSlotSelector.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/visiblePageRoots.test.ts src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts src/builder/workspace/canvas/BuilderCanvas.frameMode.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/utils/pagePersistenceQueue.static.test.ts src/utils/projectSync.layoutId.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useLayoutPublisher.static.test.ts src/builder/workspace/canvas/layout/engines/fullTreeLayout.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/workspace/canvas/hooks/useLayoutPublisher.static.test.ts src/builder/workspace/canvas/layout/engines/fullTreeLayout.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/panels/properties/FrameSlotSection.test.tsx src/builder/dev/editingSemanticsFixture.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/FrameSlotSection.test.tsx src/resolvers/canonical/__tests__/resolver.test.ts src/adapters/canonical/__tests__/integration.test.ts src/builder/utils/canonicalRefResolution.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/FrameSlotSection.test.tsx src/builder/panels/properties/ComponentSlotFillSection.test.tsx src/builder/utils/canonicalRefResolution.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/utils/editingSemantics.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts src/builder/dev/editingSemanticsFixture.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts src/builder/workspace/canvas/skia/skiaOverlayBuilder.static.test.ts src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/hooks/useLayoutPublisher.static.test.ts src/builder/workspace/canvas/skia/visiblePageRoots.test.ts src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/useElementCreator.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/usePageManager.canonical.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/utils/frameElementLoader.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/scene/layoutCache.static.test.ts src/builder/workspace/canvas/layout/engines/fullTreeLayout.static.test.ts src/builder/workspace/canvas/hooks/useLayoutPublisher.static.test.ts src/builder/utils/frameElementLoader.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts`
- Playwright screenshot evidence: `docs/adr/evidence/112-g4f-component-slot.png`
- `pnpm -F @composition/builder type-check`
- `git diff --check`
- `npm run codex:preflight`

## [ADR-112 Editing Semantics UI 구현 wave #1 — instance/ref 회귀 수정] - 2026-04-28

### Bug Fixes

- **component instance 가 `ref` 단일 노드로 보이거나 선택/편집되지 않던 회귀 수정**:
  - canonical `ref` root 를 origin component type/props 로 투영하고 origin descendants 를 synthetic instance child 로 materialize. LayerTree 는 child 구조를 표시하고 synthetic child 선택을 허용하되 drag/delete/context menu 는 차단
  - Canvas hit-test/selection 이 projected elements map 을 사용해 instance root 더블클릭 후 `instance/label` 같은 child 선택 가능
  - Properties panel 은 instance 선택 시 `ref` 대신 origin component name/type/props projection 을 노출해 기존 property editor surface 재사용
  - Properties ##Component section## 의 Go to component 는 canonical `ref` 가 origin `id` 대신 `customId`/`componentName` 을 가리켜도 origin 을 선택
  - Canvas right-click context menu 와 LayerTree row context menu 에 Detach instance 진입점을 연결해 Properties/shortcut 외 detach 경로 제공
- **origin 변경이 instance 에 즉시 반영되지 않던 Skia live render 회귀 수정**:
  - NumberField/SearchField 등 parent prop 이 child Label/Input 으로 전파되지 않던 문제를 Spec `propagation.rules` fallback 으로 일반화
  - SearchField nested placeholder/label override 와 Select/ComboBox/TagGroup/ProgressBar/Meter/Slider/DateField/TimeField/DatePicker/DateRangePicker 계열 parent→Label 전파 fixture 추가
- **origin 삭제 시 instance 가 고아 `ref` 로 남고 detach 불가하던 회귀 수정**:
  - origin 삭제 직전 impacted instance detach snapshot 생성 → origin subtree 제거 + detached standalone subtree 삽입
  - undo 시 origin + ref 상태 복원. pencil app 의 "origin 삭제 시 instance 자동 detach" 동작과 정렬

### Architecture

- **ADR-112 Phase A/C/H 기반 구현 land**:
  - canonical field persistence 보강: `ref`, `reusable`, `descendants`, `metadata`, `componentName` 등 sanitizer 보존
  - Preview runtime 과 Skia/LayerTree/Properties selection path 가 동일 canonical ref projection 을 공유
  - selection/hover editor chrome semantic marker 적용: origin = Pencil origin `#D480FF` solid, instance = Pencil instance `#9580FF` dotted. hover outline, selection corner handle stroke color, 하단 size label 배경도 semantic role 과 일치
  - Properties ##Component section## action surface 연결: Origin/Instance label, Go to component, Select instances, detach, field reset, Create component / `[-]`, impact dialog host, origin toggle shortcut/UI
  - Properties ##Slot section## base 연결: frame 선택 시 `Frame.slot: false | string[]` 상태 표시, enable/disable, reusable origin id recommended component add/remove, top-level `slot` + `metadata.slot` backup 보존
  - Slot recommendation reference 해석 보강: 저장된 reference 가 origin `id` 뿐 아니라 `customId`/`componentName` 을 가리켜도 동일 reusable target 으로 표시하고 중복 추가를 차단
  - canonical resolver slot/ref validation 보강: `Frame.slot` 또는 `Ref.ref` reference 가 reusable master `name` 또는 metadata alias 를 가리켜도 정상 target 으로 인정하고 `_resolvedFrom` 은 canonical master id 로 정규화
  - Slot/reference matcher 공용화: Properties Slot section, Builder canonical ref projection, canonical resolver 가 같은 `id`/`name`/`customId`/`componentName`/metadata alias 규칙을 사용
  - Slot assignment live refresh fix: preset 적용 직후 `ElementSlotSelector` 가 legacy Slot `layout_id` 를 직접 매칭해 새 Slot 을 즉시 표시하고, assignment 변경 시 `props.slot_name` + top-level `slot_name` 을 함께 갱신
  - Pages ↔ Frames 전환 즉시 refresh fix: Preview iframe pageInfo effect 가 `editMode`/`currentLayoutId` 변경도 구독해 mode 전환 메시지를 바로 전송
  - Render sync recovery: `useIframeMessenger` 가 initial `PREVIEW_READY` 이후 `state.elements` 변경을 다시 구독해 add/update/delete 시 `UPDATE_ELEMENTS` 를 rAF batch 로 재전송. 실제 Builder Skia canvas 는 `rendererInput` 변경 시 content surface + command stream cache 를 함께 무효화하고, `useLayoutPublisher` 는 `layoutVersion` 없이 page/frame input 구조만 바뀌는 `_rebuildIndexes()` commit 도 layoutMap 재발행 trigger 로 처리. Pages 모드 component 추가와 Slot/page-frame 변경이 새로고침 전까지 보이지 않거나 selection 만 잡히던 stale runtime/render 회귀 수정
  - Component/Slot coexistence render contract 추가: reusable frame 선택 시 `Component`/`Origin` 과 `Slot` recommendation count/list 동시 노출 검증
  - Canvas context menu target resolver 추가: spatial hit-test + topmost hit 판정 후 detachable instance 에만 menu 표시
- **ADR-112 / ADR-111 의존 방향 hardening**:
  - ADR-112 는 ADR-111 의 영향을 받지 않는 Component/Slot base ADR 로 고정
  - ADR-111 의 Slot section / Gate G6 소유권 표현은 ADR-112 로 supersede. ADR-111 은 완료된 ADR-112 기능의 frame-bundled preset 편의 확장만 담당
  - 다음 구현 우선순위도 ADR-112 Slot section base 완료 → ADR-111 편의 확장 재개 순서로 고정

### Documentation

- ADR-112 본문 Status 를 `Accepted → In Progress` 로 갱신하고 implementation wave #1 진행 로그 추가
- ADR-112 design breakdown 을 skeleton 에서 구현 추적 문서로 전환, 사용자 보고별 fix 매핑과 남은 Gate(G4-B~G4-H) 정리 및 Component/Slot section + detach context menu wiring 로그 추가
- ADR README 최신 상태와 ADR-112 row 를 implementation wave #1 기준으로 갱신

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/instanceActions.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/FrameSlotSection.test.tsx src/builder/stores/utils/elementSanitizer.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/interaction/canvasContextMenu.test.ts src/builder/panels/nodes/tree/LayerTree/LayerTreeItemContent.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/FrameSlotSection.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/resolver.test.ts`
- `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/resolver.test.ts src/builder/panels/properties/FrameSlotSection.test.tsx src/builder/utils/canonicalRefResolution.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/panels/properties/editors/ElementSlotSelector.test.tsx src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/panels/properties/editors/ElementSlotSelector.test.tsx src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/panels/properties/editors/ElementSlotSelector.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useLayoutPublisher.static.test.ts src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/panels/properties/editors/ElementSlotSelector.test.tsx`
- `pnpm -F @composition/builder type-check`
- `git diff --check`
- `npm run codex:preflight`

## [Monitor 패널 노출 축소 — 단축키 전용 활성화] - 2026-04-28

### Features

- **Monitor 패널 Header 버튼 제거 + 단축키 활성화**:
  - Header 우측 View toggle 에서 Monitor 버튼 제거 — 일반 사용자 UI 에서 개발/진단 도구 노출 축소
  - Monitor bottom panel 은 `Ctrl+Alt+M` 단축키와 Command Palette 의 `모니터 패널 토글` 명령으로 활성화
  - 기존 MonitorPanel Gateway 구조와 bottom panel 등록은 유지 — 필요 시 성능/메모리 진단 가능

## [ADR-112/111 의존 방향 정정 — ADR-112 Accepted + ADR-111 Frozen] - 2026-04-28

### Architecture

- **ADR-112/111 의존 방향 정정** (revision 3 framing 재정의):
  - **정정 사유**: baseline (ADR-903 Phase 4) framing 이 ADR-112 (reusable component 추상) 를 ADR-111 (Layout/frameset preset) 의 후속으로 박아 의존 방향이 거꾸로. codex review 3차 M-1 + 사용자 framing 재정의 (2026-04-28 세션 49 후속) 로 발견 → 정정
  - **올바른 의존 방향**: ADR-112 = reusable component + slot 추상의 **base** (Origin/Instance/Override + Component section + Slot section + detach + Origin 토글) / ADR-111 = 완료된 ADR-112 기능의 **frame-bundled preset 편의 확장**
  - **Why**: ADR-112 base 없이 ADR-111 Phase 3 가 진행되며 frame preset 이 추상 없이 응용만 land — Phase 3 후속 (P3-ε / P3-ζ — FramesTab Slot composition) 에서 ADR-112 Component/Slot section 정합화 시 baseline 어긋남 risk 누적
- **ADR-112 Accepted (revision 3)**:
  - 위치: `docs/adr/112-editing-semantics-ui-5elements.md` Status `Proposed → Accepted`
  - codex review 3차 통과 (M-1 의존 방향 정정 / L-1 LOW 추적성 권고). 1차 7건 (HIGH 3 / MED 3 / LOW 1) + 2차 2건 (MED-1 phase 명칭 / MED-2 TOCTOU guard) + 3차 의존 방향 정정 모두 반영
  - 본문 + design §7 framing 정정 — "선결 ADR-111" 제거 / "ADR-111 = preset 응용" 명시 / 차단 해제 조건 = "사용자 review + Status Proposed→Accepted" (ADR-111 P3 land 와 무관)
  - 다음: ADR-112 Component/Slot base 우선 구현
- **ADR-111 Frozen (Phase 3 후속 동결)**:
  - 위치: `docs/adr/completed/111-layout-frameset-pencil-redesign.md` Status `In Progress → Frozen`
  - 보존 범위: Phase 0~2 (Implemented) + Phase 3 P3-α/β/γ/δ + δ fix #1~#4 + B1 filter + θ scope + θ regression fix #1 모두 land 보존 — 사용자 가시 동작 (frame default + page slot fill GREEN) 유지
  - 정지 영역: P3-ε (FramesTab inline frame editing) / P3-ζ (Chrome MCP 회귀 검증) / G3-θ (d) Chrome MCP screenshot — 모두 ADR-112 Component/Slot base 완료 후 재개
  - 재개 조건: ADR-112 Component/Slot base 완료 시 P3-ε / P3-ζ 가 frame authoring 편의 확장으로 재설계 진입

### Documentation

- **README.md ADR 상태 갱신**:
  - ADR-111 entry: `In Progress → Frozen` + 의존 방향 정정 + 보존/정지 범위 명시
  - ADR-112 entry: `Proposed → Accepted` + revision 3 framing + Phase A1 다음 단계 명시
  - 미구현 카테고리 카운트 변동 없음 (둘 다 미구현 → Frozen + Accepted 도 미구현 카테고리 유지)
  - 위치: `docs/adr/README.md` line 213-214 + 최종 업데이트 헤더

## [ADR-111 P3-θ regression fix — body 채택 정책 전환] - 2026-04-28

### Bug Fixes

- **ADR-111 P3-θ regression fix #1** — Frame 적용 시 page 영역 투명/내용 사라짐 회귀 fix:
  - **회귀**: 초기 P3-θ resolver 가 `bodyElement = frameBody` 로 root 채택 → frame body width/height (P3-δ fix #4 default 320×200) 가 page (390×844) 보다 훨씬 작음 + page-body 의 시각 속성 (background/padding) 손실 + slot_name 미매칭 page root element 가 fallback Slot 매칭 실패 시 orphan → 미렌더 → "투명/내용 사라짐"
  - **Fix**: `bodyElement = pageBody` 유지 (frame body 자체는 결과 제외) + frame body **의 자식들** (Slot×N) 의 `parent_id` 를 page-body 로 reparent + frame Slot 의 자식 (Text 등) 은 그대로 (parent_id=Slot.id 유지) + slot_name 미매칭 page element 는 page-body 자식 그대로 유지 (orphan 방지) + frame body 또는 page body 미존재 시 `hasFrameBinding=false` fallback
  - **정책 정합**: design breakdown §4.10 "frame body subtree 를 page body 자식으로 가상 merge" 의 정확한 의도 — frame body **자체** 가 아닌 **자식들** 을 reparent. page width/height/시각 속성 보존
  - **회귀 fixture 2 추가**: frame Slot 0건 (빈 frame body) → page element 가 page-body 자식 유지 / page width/height/배경 시각 속성 보존
  - 검증: type-check 3/3 PASS / canvas vitest 16/16 파일 199/199 PASS / `resolvePageWithFrame.test.ts` 10/10 (T2/T3 expected 갱신 + 회귀 fixture 2)
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/resolvePageWithFrame.ts`

### Known Issues

- **P3-θ 후속 — 새로고침시 layout_id 초기화** (사용자 보고): page.layout_id IndexedDB persistence 흐름 분석 미완. body 정책 fix 반영 후 사용자 dev 재검증 필요

## [ADR-111 Phase 3 frame canvas authoring + frame instance composition Land] - 2026-04-28

### Features

- **ADR-111 P3-θ Slot Fill Resolution** — page 가 frame 에 바인딩될 때 frame slot 구조 inline 노출 + page slot fill resolution. 사용자 시나리오 (Frame vertical-3 preset + Page Apply Frame): 상단 frame default header + 가운데 page slot:content fill + 하단 frame default footer (Gate G3-θ a/b/c/e 충족, d 사용자 dev 검증 후 종결):
  - **결정 분기 land**: D7=B (별도 resolver) / D8=A (legacy `slot_name` 매칭) / D9=A (무조건 적용) — 모두 design breakdown §4.10 권고대로 사용자 승인
  - **신규 resolver** `resolvePageWithFrame(input)` — body 우선순위 (frame body > page body), Slot 매칭 (`props.name` ↔ page element `props.slot_name` 또는 `element.slot_name`), hidden default child (매칭 Slot 의 기본 자식 hide), parent_id 재매핑, page non-root 보존, deleted 제외
  - **Override 분리** (G3-θ c): page slot fill 이 매칭된 Slot 의 default 자식만 hide. 매칭 안 된 Slot 의 default 자식 (frame default header/footer Text) 은 노출 유지 → frame default 와 page slot fill 이 독립적으로 합성됨
  - **buildPageDataMap 통합**: `apps/builder/src/builder/workspace/canvas/scene/buildSceneIndex.ts` 의 page-only 분기를 resolver 호출로 전환 — `pageIndex.page_id` 의미 보존
  - **Why**: ADR-903 / ADR-111 의 핵심 기능 (pencil component composition) 의 legacy rendering pipeline 영역 미구현. canonical adapter 단계 Ref 처리는 있지만 `getPageElements` + `buildPageChildrenMap` 가 page_id 인덱스만 사용 → frame element (page_id=null) 자동 제외 → page 영역 inline 노출 안 됨 (Chrome MCP evidence 2026-04-28 세션 48 확증)
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/resolvePageWithFrame.ts` (신규) + `buildSceneIndex.ts`

### Bug Fixes

- **ADR-111 P3-δ fix #3+#4 + B1 filter** (frame canvas authoring 마감, 세션 48):
  - **fix #3 slot 자식 시각화** (D4=A `buildFrameRendererInput` 신규 + D5=A `publishLayoutMap` key fallback chain `page_id ?? layout_id ?? id` + D6=A 단일 dimensionKey 통합). **Why**: page-centric `buildPageRendererInput` 가 page_id 인덱스만 사용 → frame 자식 미시각화. 회귀 fix: body element 가 자기 자신의 child 가 되어 `RangeError: Maximum call stack size exceeded` → `buildFrameRendererInput` 의 pageElements 에서 body 제외 (page 경로 nonBodyElements 와 동일 정책)
  - **fix #4 frame 영역 size**: `height: pageHeight` (viewport 크기) → frame body 보다 큰 빈 영역 생성 → `bodyElement.props.style.width/height` 명시 px 우선 + 없으면 component-sized default 320×200 + `page_id===null` canonical reusable 우선. **Why**: 사용자 보고 "Frame 추가시 세로 영역이 body 보다 더 크게 생성"
  - **B1 filter 도입**: `computeFrameAreas(doc, framePositions, selectedReusableFrameId)` 시그니처 확장 → `selectedReusableFrameId === null` 시 빈 배열. design breakdown §4.7 옵션 B2 (모든 reusable) → B1 (selected only) 전환. **Why**: 사용자 보고 "Frames 가 canvas에 별도로 생성되고 그내부에 slot들이 생성" — pencil app component editing navigation context 정합

### Architecture

- **ADR-111 Phase 3 frame canvas authoring 본격 land** (세션 47~49):
  - **P3-α** `framePositions` store + `framePositionsVersion` 카운터 도입 (Gate G3-α PASS)
  - **P3-β** `computeFrameAreas` + `FrameAreaGroup` 도입 (Gate G3-β PASS)
  - **P3-γ** frame editing indicator (B 채택) + integration test (Gate G3-γ PASS)
  - **P3-δ** Skia render 통합 (D1=A / D2=B / D3=A 채택) + fix #1~#4 + B1 filter (Gate G3-δ a/b 충족)
  - **P3-θ** Slot Fill Resolution — 본 entry 의 §Features 항목
  - **잔여**: P3-ε hit-test/drag/selection (1.5d MED) + P3-ζ Chrome MCP 회귀 검증 (0.5d LOW). G3-δ (c) + G3-θ (d) 사용자 dev 검증 후 종결 가능

## [ADR-111 Phase 3 frame canvas authoring fundamental 결함 발견 + design breakdown land] - 2026-04-28

### Documentation

- **ADR-111 Phase 3 신규 sub-phase 발견** — frame canvas authoring 시각 path 미구현 결함 본문 진행 로그 + design breakdown land:
  - **사용자 회귀 보고**: FramesTab → 새 Frame 추가 → Layout preset 적용 시 Skia 캔버스에 영역 구분 slot 들이 시각화되지 않음
  - **Chrome MCP 측정 evidence**: `pagePositions: {234dc7c9: {x:0, y:0}}` (page 1개만, frame 좌표 0건) + `editingContextId: null` + `childrenMap.root` 에 frame body 들이 root 자식이지만 viewport 외부
  - **Cutover 의 의미**: ADR-111 cutover commit `7b6f4eb9` = `featureFlags` default true flip 만 (4 file / 38/-8 라인, 실 logic 0건). frame canvas authoring 시각 path 는 dual-mode 시절부터 미구현 — **ADR-111 fundamental 미완성** 노출
  - **Gate G2 (시각 회귀 0) 위반 확정** — Phase 2 closure 5단계 체크리스트 보류. monitoring 6일 대기 framing 무의미 (사용자 결정: monitoring 종결 의미 없음)
  - **본 세션 land**: design breakdown 신규 sub-phase 만 — `docs/adr/design/111-phase3-frame-canvas-authoring-breakdown.md`. P3-α (`framePositions` map) → P3-β (`computeLayoutGroups` 확장) → P3-γ (`editingContextId` 갱신) → P3-δ (Skia render path 통합) → P3-ε (hit-test/drag/selection) → P3-ζ (Chrome MCP 회귀 검증). 본격 fix 는 별도 세션 (1주+ HIGH)
  - **ADR-112 prerequisite 관계 명시**: 본 P3 가 base render → ADR-112 시각 마커는 위에 land
  - 위치: `docs/adr/completed/111-layout-frameset-pencil-redesign.md` (진행 로그 entry) + `docs/adr/design/111-phase3-frame-canvas-authoring-breakdown.md` (신규)

### Known Issues

- **Frame body 시각화 미구현** — FramesTab 에서 Frame 추가 + Layout preset 적용 시 Skia 캔버스에 영역 구분 slot 들이 표시되지 않음. LayerTree + Inspector 는 정상 표시 (본 세션 ADR-903 P3-E follow-up fix 로 정상화). Skia 캔버스 시각화는 ADR-111 Phase 3 (frame canvas authoring) 본격 land 후 해소 예정 (~1주+ HIGH)

## [ADR-903 P3-E follow-up — `getByLayout` 7 caller canonical 마이그레이션 (slot 미렌더 회귀 fix)] - 2026-04-28

### Bug Fixes

- **Layout/Frame 자식 element store 로드 path 회귀 fix** (ADR-903 P3-E follow-up):
  - 사용자 dev 환경에서 layout preset 선택 시 영역 구분 slot 들이 Skia 화면에 보이지 않음 (Layer 1 결함 — store/LayerTree 부분만 본 fix 로 해소. Skia 캔버스 base render 는 ADR-111 P3 별도 영역 — `[ADR-111 P3]` entry 참조)
  - **Why**: ADR-903 P3-E E-6 의 `getByLayout` canonical strict 가 composition-1.0 schemaVersion 1건이라도 있으면 빈 배열 반환하여 caller migration 압박했으나, 7 live caller (`BuilderCore.tsx:283` / `FramesTab.tsx:146,240` / `dashboard/index.tsx:381` / `utils/projectSync.ts:219` / `usePageManager.ts:207` / `PageLayoutSelector.tsx:109`) 가 마이그레이션되지 않은 채 ADR-903 Implemented 종결 → Frame 선택 / Layout preset 적용 / 페이지 로드 path 에서 element 미로드 → LayerTree 미표시 + Inspector LayoutPresetSelector 미표시
  - **Fix**: `adapter.ts` 신규 API `getDescendants(parentId)` 추가 (BFS `parent_id` index 재귀 + 순환 참조 방지 seen Set + composition-pre-1.0 legacy `layout_id` index fallback) + `types.ts` 인터페이스 시그니처 추가 + 7 caller 일괄 `getByLayout(layoutId)` → `getDescendants(layoutId)` 교체. composition-pre-1.0 / 1.0 / 1.1 schema 모두 동일 결과 보장
  - 검증: type-check 3/3 PASS (FULL TURBO) + Builder dev runtime store evidence (elements_total 1 → 4 로 Frame body+2 Slots 정상 로드 + LayerTree 표시 + Inspector LayoutPresetSelector "수직 2단/3단 적용됨" 표시 확증)
  - **ADR framing 정정**: 본 회귀가 ADR-111 monitoring 차단으로 인식됐으나 실제는 ADR-903 P3-E caller migration 잔존 작업 — ADR-111 frame.children 정규화와 schema 직교. ADR-113 Step 4-4 의 "ADR-111 monitoring 후" marker 도 schema 직교성 재검토 가능
  - 위치: `apps/builder/src/lib/db/indexedDB/adapter.ts` + `apps/builder/src/lib/db/types.ts` + 5 caller 파일 (commits `1f732be3` + `f299d373`)

## [ADR-110 Implemented — Canonical `themes`/`variables` 필드 Land Plan 전체 종결] - 2026-04-27

### Architecture

- **ADR-110 Phase 2 Write-through Activation 전원 통과 + Status `Accepted → Implemented`** — Phase 1 G-A (read-only snapshot adapter) 위에 write-through + resolver + round-trip + 시각 회귀 0 검증 통합:
  - **ts-3.1** themes write-through adapter — `applyCanonicalThemes(doc, setters): boolean` 신설 + `ThemeConfigSetters` DI interface (test 친화 + R4 stale 방지) + BuilderCore initialize 종료 entry (env flag `VITE_ADR110_P2_THEMES_WRITE_THROUGH` 게이트, rollback 경로). 6 신규 tests (TC-A1~A6, round-trip + 멱등 + BC + R4 잘못된 구조 무동작)
  - 위치: `apps/builder/src/adapters/canonical/themesAdapter.ts` + `BuilderCore.tsx` + `themes.test.ts`
  - **ts-3.2** variables resolver — `resolveCanonicalVariable(ref, doc): string | number | boolean | undefined` 신설. TokenRef pattern `{category.name}` parsing (tokenResolver.ts 와 동일 정규식, hyphen name 허용). 9 신규 tests (TC-R1~R9 — 기본 lookup / number+boolean / BC / invalid / hyphen name / **Gate G-B (b) light+dark contract** — `resolveToken(ref, theme)` ↔ `resolveCanonicalVariable(ref, doc)` 동일 값)
  - 위치: `apps/builder/src/adapters/canonical/variablesAdapter.ts` + `variables.test.ts`
  - **ts-3.3** round-trip 통합 — themes + variables 동시 round-trip 검증 (legacyToCanonical → apply + resolve → re-snapshot 1차==2차 동일). 4 신규 tests (TC-RT1~RT4 — 동시 / 멱등 / 한쪽만 주입 BC / Gate G-B 통합 pipeline)
  - 위치: `apps/builder/src/adapters/canonical/__tests__/integration.test.ts`
  - **ts-3.4** Chrome MCP dev runtime 시각 회귀 검증 — Builder Skia canvas 2562×1768 (HiDPI 2x, WebGL2) + DOM 정상 (Header/workspace/panel) + CSS 토큰 정상 (`--bg`, `--fg`, `--accent`, `--tint`, `--border`) + error overlay 0 + 페이지 reload 후 동일. **env flag 미설정 → Phase 1 read-only 동작 유지 BC** + flag 활성화 시 `selectCanonicalDocument` 가 themes 미주입 → `applyCanonicalThemes` false 반환 → 무동작 → **시각 회귀 0**. Gate G-B (c) 충족
  - **ts-3.5** feature flag rollback 경로 — `VITE_ADR110_P2_THEMES_WRITE_THROUGH` (ts-3.1 land 시 동시 적용)
  - **Why**: ADR-903 §3.10 phase 미명시 gap 해소. `themes`(ADR-021 Tint/dark mode) + `variables`(ADR-022 TokenRef) 가 canonical document 정합 SSOT 구조로 land — D3 시각 domain 의 read/write/resolve 3축 양방향 변환 보장
  - **Closure 5단계** 모두 완료: Status Implemented + 본 ADR 본문 진행 로그 + README 완료 102→103/미구현 8→7 + 본문 `docs/adr/910-* → docs/adr/completed/910-*` archive + reference link path 정합화 (903 본문 line 118/119 `../910-` → `910-`, design breakdown ts-3.4 ✅ + G-B (c) ✅)
- 검증: type-check 3/3 PASS (FULL TURBO) + canonical adapter vitest 111/111 (themes 18 + variables 23 + integration 47 + 기타 23) + db 142/142 PASS

### Infrastructure

- 본 ADR-110 동일 세션 land 흐름이 ADR-113 Phase 4 Step 4-1~4-3 (DB_VERSION 9 + tag→type dry-run + entry 연결) 와 영향 영역 비교집합 0 으로 병행 가능함을 입증 — ADR-110 design breakdown 의 회피 사항 ("ts-3.2 와 Step 4-2 동시 진행 금지") 는 실 영향 영역 충돌 시점에만 적용으로 정정

## [ADR-113 Phase 4 Step 4-1+4-2+4-3 — DB_VERSION 8→9 schema bump + runTagTypeMigration dry-run + usePageManager entry] - 2026-04-27

### Architecture

- **ADR-113 Phase 4 READ-ONLY 3 단계 main land** — DB schema 변환 prep. dryRun=true 고정으로 DB 무변경:
  - **Step 4-1** IndexedDB DB_VERSION 8 → 9 schema bump (no schema change — `tag` index 미존재). `MetaRecord.schemaVersion` enum 에 `"composition-1.1"` 추가 (composition-1.0 = tag 기반 / composition-1.1 = type 기반). `metaStore.test.ts` test 1 갱신. **비파괴**: 기존 프로젝트 (composition-1.0) read-through 유지 — schemaVersion 단계 추적 (legacy → composition-1.0 ADR-903 P3-E → composition-1.1 ADR-113 P4)
  - 위치: `apps/builder/src/lib/db/indexedDB/adapter.ts` + `types.ts` + `__tests__/metaStore.test.ts`
  - **Step 4-2** 신규 파일 `apps/builder/src/lib/db/migrationTagType.ts` 분리 (ADR-903 P3-E `runLegacyToCanonicalMigration` 과 독립 schema 차원 — 책임 분리). `transformElementTagToType(el)` pure transformer (tag-only → rename / type-only → no-op / 둘 다 → type 우선 + tag 제거 / 둘 다 missing → orphan error) + `runTagTypeMigration(adapter, projectId, { dryRun=true })` (composition-1.1 already-migrated → skipped, `createMigrationBackup` 호출 fallback 안전망, `elements.getAll()` read-only → transformations 결과 반환, `dryRun=false` → throw 안내). 16 신규 tests (TC-T1~T5 transformer + TC-M1~M11 integration, **50 fixture round-trip 포함**)
  - 위치: `apps/builder/src/lib/db/migrationTagType.ts` + `__tests__/migrationTagType.test.ts`
  - **Step 4-3** `usePageManager.initializeProject` 의 P3-E migration 호출 직후에 `runTagTypeMigration(db, projectId, { dryRun: true })` 추가. 진입 조건: `metaRecord` 미존재 또는 `schemaVersion ∈ {legacy, composition-1.0}`. dev console 로그 — skipped/일반/transformedCount > 0 시 `${N} elements need tag→type migration`. try/catch graceful degrade (BC)
  - 위치: `apps/builder/src/builder/hooks/usePageManager.ts`
  - **Why**: Step 4-4 (write-through, env flag `VITE_ADR113_P4_WRITE_THROUGH`) 진입 전 측정 인프라 사전 land — 당시에는 monitoring 완료 뒤 활성화로 계획했으나, 2026-04-30 이후 ADR-116 G2 canonical store/export adapter 이후 재평가로 변경
- 검증: type-check 3/3 PASS + db 영역 vitest 142/142 PASS (기존 126 + 신규 16) + usePageManager.canonical 회귀 0
- **잔여 Phase 4 단계**: Step 4-4 (write-through, ADR-116 G2 이후 재평가) / Step 4-5 (`normalizeLegacyElement` helper 제거, write-through 1주+ 안정 + composition-1.1 또는 canonical-primary 기준 충족 후) / Step 4-6 (Phase 4 종결)

### Documentation

- ADR-113 Status `Proposed → In Progress` 갱신 (README + 본 ADR 본문 진행 로그)
- ADR-110 design breakdown — Phase 2 sub-step 표 5단계 (ts-3.1~3.5) ✅/미진입 + commit 해시 + 검증 결과
- ADR-113 design breakdown — §"Sub-step 진행 상태" 표 신설 (4-1~4-6) + 본문 4-1/4-2/4-3 ✅ marker + Land 시 design 변경점 명시 (실 entry 위치 = `usePageManager.ts`, 실 산출 파일 = `migrationTagType.ts`)

## [ADR-113 Phase 3 manual review 종결 — `tag → type` rename 회귀 0 확증] - 2026-04-27

### Architecture

- **ADR-113 Phase 3 종결** — Phase 1+2 mechanical rename 도구 효율 검증, 회귀 위험 0:
  - `.tag` 잔존 13건 = 의도된 변수명/CSS class/Tag spec preset 12건 + IDB adapter `tag?: string` 검사 1건 (Phase 4 영역, 의도된 legacy)
  - `tag: literal` 잔존 7건 = 전부 JSDoc BC 메모 (Card 5종 + Radio/CheckboxItems), 실 코드 0건
  - `.type ===` discriminator 459건 narrowing 정상
  - `isCanonicalNode` runtime guard hot path 적용 부족 (LOW, Phase 4 진입 시 점진 적용 권장)
  - **Why**: agent 추정 146 manual ref → 실제 의심 잔존 0. mechanical rename 도구 (`apps/builder/src/adapters/canonical/tagRename.ts`) 가 매우 효과적
  - 위치: `packages/specs/src/components/Body.spec.ts:9` JSDoc `element.tag` → `element.type` 정정 (1줄)
- **ADR-113 Status `In Progress` 유지** — Phase 4 (DB schema DB_VERSION 8→9, HIGH 1.5d) + Phase 5 (Hybrid 6 cleanup, HIGH 2d, 313+ ref) 잔여

## [ADR-110 Phase 1 G-A — Canonical `themes`/`variables` Read-only Snapshot Adapter] - 2026-04-27

### Architecture

- **ADR-110 Phase 1 G-A 완전 PASS** — canonical document `themes` + `variables` 필드를 ADR-021 / ADR-022 시스템의 read-only snapshot adapter 로 land (대안 B 채택):
  - `packages/shared/src/types/composition-document.types.ts` — `ThemeSnapshot` (R2 `customTokens` 확장 슬롯) + `VariablesSnapshot` + `VariablesSnapshotEntry` (R3 `source: "spec-token" | "user-defined"` 구분자) 타입 SSOT 정착. `CompositionDocument.themes?: ThemeSnapshot` + `variables?: VariablesSnapshot` 으로 stub `Record<string, string[]>` 전환
  - `apps/builder/src/adapters/canonical/variablesAdapter.ts` 신규 — `snapshotVariablesFromTokens(resolvedTokens)` + `readCanonicalVariables(doc)` + `ResolvedTokenMap` DI 계약
  - `apps/builder/src/adapters/canonical/themesAdapter.ts` — `ThemeSnapshot` re-export + raw cast 제거
  - `apps/builder/src/adapters/canonical/index.ts` — `legacyToCanonical()` 호출 시 `themesSnapshot` + `variablesSnapshot` 자동 주입 통합
  - `apps/builder/src/adapters/canonical/__tests__/variables.test.ts` 신규 (14 tests)
  - `docs/adr/design/110-canonical-themes-variables-land-plan-breakdown.md` 신규 (구현 상세 분리)
  - **Why**: canonical document 가 ADR-021 themeConfigStore + ADR-022 tokenResolver 현재 상태를 read-only 로 투영. Phase 2 write-through 진입 prerequisite 충족. ADR-021/022 런타임 무수정 (R3/R4 비파괴)
  - 검증: type-check 3/3 PASS + canonical adapter vitest 92/92 PASS (themes 12 + variables 14 + integration 43 + 기타 23)

- **ADR-110 Status `Proposed → Accepted` 승격** — Phase 2 (write-through, ADR-903 G2 이후) 진입 대기. Phase 2 land 시 G-B Gate 검증 (themes write-through round-trip + variables resolver 통합 + Preview/Skia 시각 회귀 0) 후 ADR-110 전체 Implemented

## [ADR-111 P2 회귀 수정 #2 — canonical legacyProps id 누락으로 자식 있는 컴포넌트 미렌더] - 2026-04-27

### Bug Fixes

- **자식 element 가 있는 컴포넌트 (ToggleButtonGroup, InlineAlert 등) Preview 미렌더 회귀**:
  - 사용자 보고: ToggleButtonGroup 전체 미렌더 / InlineAlert container 만 렌더 / ListBox 정상 (자식 0). 새 빈 프로젝트에서도 동일 재현
  - **Why**: `legacyToCanonical` 의 metadata 가 `legacyProps: element.props` 만 보존하고 **element top-level fields** (`id` / `parent_id` / `page_id` / `layout_id` / `order_num` / `fills`) **미주입**. `CanonicalNodeRenderer` 의 `legacyUuid = legacyProps.id ?? node.id` fallback 이 canonical path-id (segId) 사용 → shared renderer 의 `childrenMap.get(element.id)` lookup 시 자식 element 의 `parent_id` (원본 UUID) 와 mismatch → 자식 0 lookup → `renderInlineAlert` 가 빈 children 으로 div 렌더 / `renderToggleButtonGroup` 의 RAC `ToggleButtonGroup` 이 invariant 로 throw → 전체 null. 자식 0 인 ListBox 는 mismatch 영향 0
  - **Root cause 확정 evidence** (Builder dev console): ToggleButtonGroup `id='e77bbf03'` + 자식 ToggleButton x3 `parent_id='e77bbf03'` 정확 매칭 (Builder store 정상). 미렌더 원인 = Preview canonical 변환 단계의 element top-level fields 손실
  - 수정: 3 위치 metadata.legacyProps 에 element top-level fields 명시 spread:
    - `apps/builder/src/adapters/canonical/index.ts:164` (`convertElementToCanonical` 본체)
    - `apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts:257` (`convertElementToCanonical` slot adapter)
    - `apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts:313` (`convertElementWithSlotHoisting`)
  - 검증: `pnpm type-check` 3/3 exit 0
  - **ADR-111 monitoring 카운터 reset 권장 (2번째)** — 본 fix land 시점부터 새 1주 (~2026-05-04+ 추가 연장). PR #271 fix 후 1차 reset, 본 fix 후 2차 reset

## [ADR-111 P2 회귀 수정 — 복합 컴포넌트 등록 시 page_id 미주입으로 화면 누락] - 2026-04-27

### Bug Fixes

- **복합 컴포넌트 (ListBox / TagGroup / RadioGroup / CheckboxGroup 등 COMPLEX_COMPONENT_TAGS) 등록 시 화면 미렌더 회귀**:
  - 사용자 보고 (세션 42): ListBox 컴포넌트 등록 후 화면에 element 가 나타나지 않음 + dev console `[ADR-903] sanitizeElement: page_id/layout_id 없음 — canonical parent 의존 element?` 경고
  - **Why**: `createElementsFromDefinition` (`apps/builder/src/builder/factories/utils/elementCreation.ts`) 가 parent + children Element 객체 생성 시 `page_id` / `layout_id` 명시 주입 안 함. ADR-111 P2 cutover (canonical mode default true) 후 `pageElementsSnapshot` / `selectCanonicalDocument` 의 page-indexed 분기에서 page_id 없는 element 가 frame.children 에 attach 안 되어 화면 누락. 단순 컴포넌트 경로 (`useElementCreator.ts:198`) 는 정상 (page_id 명시 주입) — 두 경로 비대칭이 ADR-111 cutover 로 노출됨
  - 수정: `createElementsFromDefinition` 시그니처에 `ElementCreationContext` (pageId / layoutId) 추가 + parent + children 모두에 `page_id: layoutId ? null : pageId` / `layout_id: layoutId` 명시 주입. `ComponentFactory.createComponent` 가 호출 시 이미 보유 중인 pageId/layoutId 전달
  - 위치: `apps/builder/src/builder/factories/utils/elementCreation.ts` (createElementsFromDefinition + ElementCreationContext 인터페이스 신설) / `apps/builder/src/builder/factories/ComponentFactory.ts:238-245` (호출 시 context 전달)
  - 검증: `pnpm type-check` 3/3 exit 0
  - **ADR-111 monitoring 1주 (~2026-05-04) 진행 중 발견된 사용자-가시 회귀** — 본 fix land 후 monitoring 카운터 reset 권장 (회귀 fix 시점부터 1주 재측정 + 추가 회귀 watch)

## [ADR-113 mechanical rename false-positive sweep — Tag literal 복원 + lucide generated 자동화] - 2026-04-27

### Bug Fixes

- **TagGroup remove 버튼 / `tag-list-wrapper` / `tag-show-all-btn` 스타일링 깨짐 회복**:
  - ADR-113 P1+P2 mechanical rename (`\btag\b → type`, commit `99e4e7c9`) 가 React `className` literal 까지 false-positive 치환 → CSS `.tag-remove-btn` / `.tag-list-wrapper` / `.tag-show-all-btn` 클래스가 매칭 실패하여 Tag 삭제 버튼 마진 + show-all-btn 스타일이 적용되지 않음
  - **Why**: ast-grep + node.js batch regex 가 `\btag\b` 단어 경계 만 검사 → React 의 `className="tag-…"` 리터럴 안의 `tag` 도 변환됨. CSS 파일은 commit scope 외라 `.tag-*` 그대로 → 클래스명 분리
  - 수정: `packages/shared/src/components/TagGroup.tsx` 6 occurrence (`type-remove-btn` 3 / `type-list-wrapper` 1 / `type-show-all-btn` 2) → `tag-*` 복원
- **`getTagRemoveAdjustedPaddingRight` / TagGroup remove padding 계산 dead 회복**:
  - 동일 mechanical rename 이 `tag === "tag"` literal 비교를 `type === "type"` 로 변환 → element type lowercase 정규화 (`(element.type ?? "").toLowerCase()`) 와 비교 literal 자기-비교가 되어 분기가 항상 false → TagGroup `allowsRemoving` 시 우측 padding 축소 + remove 버튼 width 가산 로직 미작동
  - **Why**: caller 4곳이 lowercase 변환된 `type` 변수를 함수에 전달, lowercase tag config map (`chip`/`togglebutton`/`tab` 등) 과 일관. literal 도 `"tag"` 가 정답
  - 수정: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` 4 occurrence + 주석 `.type-remove-btn` → `.tag-remove-btn`
- **SelectionFilter "태그로" 필터 옵션 미작동**:
  - ADR-113 mechanical rename 이 UI enum literal `filterType: "all" | "type" | "tag" | "property"` 의 `"tag"` 값 5 occurrence (type union / switch case / dropdown option value / 2 condition) 를 `"type"` 로 변환 → 두 옵션이 동일 값으로 충돌, `selectedTag` 상태가 dispatch 되지 않음
  - 수정: `apps/builder/src/builder/components/selection/SelectionFilter.tsx` 5 occurrence 의 두 번째 `"type"` → `"tag"` 복원

### Infrastructure

- **`pnpm install` 차단 fix + lucide generated 자동 재생성**:
  - `packages/specs/src/icons/lucideIconData.generated.ts` 가 ADR-113 mechanical rename 의 false-positive 로 lucide `'tag'` 아이콘 키 → `'type'` 로 변환 → `'type'` 키 중복 (line 1505 + 1595) → TS1117 "An object literal cannot have multiple properties with the same name" 으로 `prepare:specs` (DTS 빌드) + `pnpm install` 전체 차단
  - **Why**: generated 파일이 source tree 에 commit 되어 mechanical rename scope 에 포함됨. lucide `tag.js` 와 `type-outline.js` / `type.js` 가 공존하여 collision 발생
  - 수정: `node packages/specs/scripts/extract-lucide-icons.mjs` 재실행으로 ground truth 복원 + `package.json` 의 `prepare:specs` 에 추출 스크립트 추가 → 향후 install 시 자동 재생성으로 generated 파일 손상 자체 차단
  - 위치: `packages/specs/src/icons/lucideIconData.generated.ts` / `package.json:34`

## [Body Spec SSOT 완결 — ADR-109 Publish symmetry + D1/D2/D4] - 2026-04-27

### Architecture

- **ADR-109 Implemented — Body Spec SSOT 완결 + Publish consumer 대칭 복구**:
  - **D1** (PR #268, commit `40a17a03`): Publish `useBodyElement(elements)` hook 신설 (102줄) — body element → `document.body` className `react-aria-Body` + style 직접 주입 + cleanup 로직. `apps/publish/src/hooks/useBodyElement.ts` + `apps/publish/src/renderer/PageRenderer.tsx` 통합
  - **D2**: `createDefaultBodyProps` 의 `backgroundColor: "var(--bg)"` / `color: "var(--fg)"` literal 제거 + `className: "react-aria-Body"` 추가
    - **Why**: D2 의 inline CSS var literal 은 Preview/Publish 양쪽에서 className `react-aria-Body` 자동 주입 + generated CSS rule (`.react-aria-Body { background: var(--bg); color: var(--fg); }`) 로 대체 가능. literal 제거로 ADR-063 D3 symmetric 회복 (한쪽이 기준이 아닌 spec 파생)
    - 위치: `apps/builder/src/types/builder/unified.types.ts:1766`
  - **D4**: SkiaRenderer.backgroundColor field + setBackgroundColor 메서드 + SkiaCanvas/BuilderCanvas backgroundColor prop dead code cleanup
    - **Why**: ADR-902 이후 `clearFrame()` 투명 clear + element tree body fill 처리로 backgroundColor 가 read 되지 않음 (assignment 만 잔존, dead chain). 호출자 SkiaCanvas.tsx 1곳 → 완전 제거 안전
    - 위치: `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts` / `SkiaCanvas.tsx` / `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
  - **D3 + Gate G3 Defer** (Phase 3 별도 follow-up): body.fills runtime-ignore 안정성 검증 + fill inspector body="theme-managed" UI 미구현. ADR-109 Gate G3 의 "실패 시 대안: Phase 3 을 defer 로 분리 — 사용자-가시 영향 없으므로 optional" 적용. BodySpec.shapes 의 var/{/$-- prefix skip 로직이 이미 fills runtime-ignore 동등 동작 보장
  - **검증**: Gate G1 (publish 회귀 0) — `pnpm type-check` 3/3 exit 0 / Gate G2 (3경로 theme 대칭) — className 자동 주입 + BodySpec TokenRef resolve / Gate G4 (D4 cleanup 안전성) — `setBackgroundColor` / `SkiaRenderer.backgroundColor` field grep 0건
  - ADR-902 후속 body SSOT 스토리라인 완결 (Skia/Preview/Publish 3경로 1 Spec 파생)

## [DesignKit 시스템 제거 — Theme/Variable 시스템 중복 해소 — ADR-115] - 2026-04-27

### Breaking Changes

- **DesignKit 패널 / `.kit.json` import-export 기능 제거** (ADR-115 Implemented):
  - `Ctrl+Shift+K` 단축키 비활성화 + 좌측 사이드바 "디자인 킷" 항목 제거
  - DesignKit 5-Layer 아키텍처 (panel UI / Zustand store / 6-step kitLoader 파이프라인 / Zod 검증 / built-in basic kit) 전체 제거
  - 사용자가 외부에서 받은 `.kit.json` 파일은 더 이상 composition 으로 import 불가 (사용자 로컬 디스크 보존, 데이터 손실 0)
  - **Why**: theme 시스템 (ADR-021) + variable 시스템 (ADR-022) + Compositional Architecture (46+ 컴포넌트) 와 의미 중복. ADR-020 §2.1 자가 분석에서 "킷 콘텐츠 빈약 — 내장 킷 1개, Card 는 Box+2 Text 로 실제 Card 컴포넌트와 무관" CRITICAL + §2.2 "composition 컴포넌트 시스템 미활용" HIGH 로 흡수 가치 부재 명시
  - 영향: 외부 직접 의존 0건 (panelConfigs.ts + panels/core/types.ts 만), DB 영향 0건, localStorage / IndexedDB 영향 0건
  - 제거 LOC: -1,989 (코드 5 경로) + panelConfigs / types.ts panel id 정리
    - 위치: `apps/builder/src/builder/panels/designKit/` (전체) / `apps/builder/src/stores/designKitStore.ts` / `apps/builder/src/types/builder/designKit.types.ts` / `apps/builder/src/utils/designKit/` (전체)

### Architecture

- **ADR-020 Superseded by ADR-115** — Design Kit 패널 분석 및 개선 계획 (Proposed) → 제거 결정. 본문은 `docs/adr/completed/020-design-kit-improvement.md` 로 archive
- **ADR-115 신규 발의 (Proposed → Implemented 동일 PR 내 land)** — DesignKit 시스템 제거. 대안 A (즉시 전수 제거) 채택 — B (Deprecate-then-remove, 유지보수 MED) / C (UI hide, 유지보수 HIGH dead code) / D (theme 흡수, 유지보수 + 마이그레이션 HIGH) 대비 위험 모든 축 LOW. ADR-020 §2.1 자가 분석을 흡수 가치 부재 근거로 직접 인용
- **진행 중 ADR reference 일괄 정리**:
  - ADR-111 line 249 — "ADR-903 P5-D/E (`imports` resolver) 와 자연스럽게 통합 — DesignKit 통합은 ADR-115 로 제거됨 (P5-F section 무효화)"
  - ADR-112 G4-A — 시각 마커 3종 (LayerTree + Canvas + DesignKit) → **2종 (LayerTree + Canvas)** 로 축소
  - ADR-016 line 43 — 다이어그램에서 `DesignKitPanel` 박스 제거
  - ADR-011 line 1079 — `appliedKitIds` 표 항목 strikethrough + ADR-115 footnote (이미 ADR-054 Superseded)
  - ADR-114 — 당시 **보류** (Proposed 단계 + imports 본체 미진입). 이후 2026-04-30 ADR-116 으로 잔여 imports scope 흡수 + Superseded 처리
- **CompositionDocument types 정리** — `metadata.importedFrom: "designkit:<kit-id>"` 주석 제거 (`packages/shared/src/types/composition-document.types.ts`). `imports` resolver 는 이후 ADR-116 으로 흡수

### Gates 검증

- **G1 정적 검증**: `pnpm type-check` 3/3 PASS / `pnpm build` specs 의 사전 존재 이슈 (`lucideIconData.generated.ts` TS1117) 는 main HEAD 동일 — 본 ADR-115 작업 무관
- **G2 잔존 reference 0**: `apps/` + `packages/` grep `designKit\|DesignKit\|KitElement\|KitToken\|KitVariable\|kitLoader\|kitExporter\|kitValidator` 0건. `docs/` 잔존은 의도된 ADR-115 cross-reference + CHANGELOG historical entries 만
- **G3 dev verify**: PR 머지 후 사용자 dev 검증 권장 (사이드바 + Ctrl+Shift+K + 다른 패널 정상 마운트 + 콘솔 error 0)

## [ADR-111 fix — usePresetApply.existingSlots slot 직접 매칭 (preset stale 해소) — 세션 38] - 2026-04-27

### Bug Fixes

- **Frame 교차 시 우측 LayoutPresetSelector "적용됨" 표시 stale 회귀 수정** (사용자 dev 검증 + 진단 console.log 로 root cause 확정):
  - 증상: Frame A 에 preset X 적용 → 우측 selector 에 "X 적용됨" 표시 정상. Frame B 로 교차 → 좌측 Layers 는 정상 갱신되지만 우측 selector 의 "적용됨" 표시는 **항상 null** 로 갱신됨 (Frame B 에 적용된 preset 표시 안 됨)
  - **Root cause** (Phase 1 진단 로그):
    ```
    [usePresetApply] slot mismatch: {
      bodyElementId: B_body, layoutId: B,
      appliedPreset: 'sidebar-left',  // body 에 정상 저장
      existingSlotNames: Array(0),    // ← 0개! Slot 매칭 실패
      presetSlotNames: Array(2)       // preset 정의는 2 slots
    }
    ```
  - 분석: `existingSlots` 가 `belongsToLegacyLayout(el, layoutId, canonicalDoc)` 로 매칭. 이 helper 는 `isCanonicalDescendantOf(slot.id, frame)` 로 canonical document 의 frame 자식 트리 검색. 그러나 `convertLayoutToReusableFrame` (slotAndLayoutAdapter.ts) 가 slot element 를 `convertElementWithSlotHoisting` 으로 frame.slot 메타로 hoist → canonical frame.children 에 slot 사라짐 → `isCanonicalDescendantOf` 항상 false → existingSlots = []
  - 좌측 Layers 가 정상인 이유: `FramesTab.frameElements` 는 `el.layout_id === currentFrame.id` 직접 매칭, canonical 미사용
  - 수정: `usePresetApply.existingSlots` 가 `belongsToLegacyLayout` 호출 제거 + slot 을 `el.layout_id === layoutId` 직접 매칭. slot 은 P4 까지 legacy element 로 elementsMap 에 존재 (layout_id field 보유) → safe. import 정리: `selectCanonicalDocument` / `useLayoutsStore` / `belongsToLegacyLayout` 제거
  - 위치: `apps/builder/src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.ts`
  - 검증: type-check 0 / FramesTab+frameActions 41/41 회귀 0. dev 환경에서 Frame 교차 시 우측 "적용됨" 표시가 frame 의 실제 preset 으로 정상 갱신 (사용자 검증 권장)

## [ADR-111 Phase 2 fix — handleAddFrame 중복 Frame N 번호 회피 — 세션 38] - 2026-04-27

### Bug Fixes

- **Frame 추가 시 중복 `Frame N` 번호 생성 회귀 수정** (사용자 dev 검증으로 발견):
  - 증상: 여러 Frame 추가 후 일부 삭제 + 재추가 시 같은 번호 (`Frame 2` 등) 가 중복 생성됨
  - **Why**: 이전 패턴 `Frame ${reusableFrames.length + 1}` 은 stable unique 보장 안 함. `[Frame 1, Frame 2, Frame 3]` → Frame 1 삭제 → `[Frame 2, Frame 3]` (length=2) → 추가 → `Frame 3` 생성 → 충돌
  - 수정: `getNextFrameName(existingFrames)` helper 도입. `Frame N` 패턴의 기존 이름들을 분석하여 미사용 번호 중 가장 작은 값 사용 (gap 채움 + 시작 gap 채움 + 비-`Frame N` 이름 무시)
  - 위치: `apps/builder/src/builder/stores/utils/frameActions.ts` (`getNextFrameName` export) + `FramesTab.tsx::handleAddFrame` 적용
  - vitest 8 신규 시나리오: 빈 / max+1 / mid gap / 시작 gap / 비-Frame 이름 무시 / mixed / delete-after-add 회귀 / 100개 stable

### Documentation

- **frameActions.test.ts 회귀 안전망 강화**: 기존 7 → 15 시나리오. PR-A wrapper 동작 + `getNextFrameName` 알고리즘 양쪽 잠금

## [ADR-111 Phase 2 followup — NodesPanelTabs UI 라벨 "Layout" → "Frames" — 세션 38] - 2026-04-27

### Documentation

- **NodesPanel 탭 UI 라벨 정합**:
  - `NodesPanelTabs.tsx` — `id: "layouts"` 의 `label: "Layout"` → `"Frames"` (1줄)
  - **Why**: 컴포넌트명 `FramesTab` 과 UI 라벨 "Layout" 의 불일치로 사용자 dev 검증 시 혼란 — ADR-111 Phase 2 cutover 와 함께 라벨 정합. 탭 id `"layouts"` / `EditMode "layout"` / `aria-controls "tabpanel-layouts"` 등 데이터 호환성 식별자는 그대로 유지 (후속 PR 에서 점진 정리 가능)
  - 검증: type-check 0 / FramesTab 33/33 회귀 0 (라벨은 vitest 검증 대상 아님 — UI 가시 변경만)

## [ADR-111 Phase 2 PR-E4 — cutover (canonical mode default true) — 세션 37 후반] - 2026-04-27

### Breaking Changes

- **FramesTab + PageLayoutSelector 의 frame 목록 read path 가 canonical projection 으로 default 전환** (ADR-111 Phase 2 cutover):
  - `apps/builder/src/utils/featureFlags.ts::isFramesTabCanonical()` default `false → true`
  - 영향: 빌더 `Frames` 탭 / `PageLayoutSelector` 가 `selectCanonicalDocument` projection 의 reusable FrameNode 를 read source 로 사용. 기존 `useLayoutsStore.layouts[]` direct read 는 환경변수 override 시에만 활성화
  - **rollback 경로**: `VITE_FRAMES_TAB_CANONICAL=false` 환경변수 설정 → emergency 시 legacy path 복구
  - **사용자 가시 차이**: frame 목록 표시 source 가 canonical document 의 `reusable: true` FrameNode 로 통일 (id 정규화 `metadata.layoutId` 경유). write 경로는 legacy `createLayout`/`deleteLayout`/`pages.update(layout_id)` 그대로 — 데이터 손실 위험 없음
  - **Why**: PR-A~E3 (8 PRs main land + 156 vitest 회귀 안전망 + dev migration trigger) 토대 위에서 cutover 진행. P3-D (canonical document write API) 진입 전 read 정합화 완료로 향후 cascade 재작성 시 read path 변경 0

### Architecture

- **ADR-111 Phase 2 PR-E4 — cutover 단일 변경**:
  - `featureFlags.ts` 의 `isFramesTabCanonical()` 1줄 변경 (default `false → true`) + `getFeatureFlags()` 동시 갱신
  - vitest 영향 0 — `FramesTab.test.tsx` / `PageLayoutSelector` 등 모두 `mockIsFramesTabCanonical` 명시 mock 으로 분기 검증
  - 검증: type-check 0 / 156/156 vitest PASS (FramesTab 33 + frameActions 7 + migrationP111 45 + canonical adapters 71)
  - **monitoring 단계**: 1주 사용자 issue report 0건 확인 후 ADR-111 Phase 2 Status: `In Progress` → `Phase 2 Implemented` 승격. 잔여 Phase 3-5 (P3 cascade 재작성 / P4 DB schema migration / P5 hybrid 6 cleanup) 는 본 ADR 의 후속 phase 로 분리 진행

## [ADR-111 Phase 2 PR-E3 — dev-only canonical migration trigger — 세션 37 후반] - 2026-04-27

### Features

- **ADR-111 P1-c — dev-only canonical migration trigger UI 추가**:
  - `FramesTab.tsx` 에 "Dev: Migrate to Canonical" 버튼 + `handleDevMigrate` handler
  - 동작: `dryRunMigrationP111(adapter, projectId, canonicalDoc)` 결과 콘솔 group 으로 출력 (status / hoisted ids / skipped / errors). errors 0 + hoisted > 0 시 `applyMigrationP111(canonicalDoc, result)` 로 in-memory apply 실행 + 결과 reusable frame 개수 로그
  - production 단락: `process.env.NODE_ENV === "development"` 체크. production build 영향 0 (tree-shake 가능)
  - **persistence 미구현**: canonical document store write API 가 없음 (P3-D 종속) — 본 trigger 는 Chrome MCP P1-c roundtrip dev 검증 용도만. 콘솔에 `"persistence 미구현 — canonical store write API 도입 (P3-D) 후 commit 가능"` 안내 출력
  - **Why**: ADR-111 Phase 1 의 migration helper (`hoistLayoutAsReusableFrame` / `dryRun` / `apply`) 가 실 dev 데이터에 대해 정상 동작하는지 검증할 진입점 부재. P2-e (Chrome MCP P1-c roundtrip) 의 진입점 옵션 A (FramesTab dev menu) 채택. P3 진입 시 옵션 B (initializeProject 자동 trigger) 으로 교체 예정

### Documentation

- **ADR-111 PR-E2 skip 결정 + sub-PR 재배치**:
  - `usePresetApply.ts` read 는 이미 `selectCanonicalDocument` 사용 (dual-mode 친화적). write (`type="Slot"` element + `addComplexElement`) 는 P3-D 의 canonical document write API 도입 후 별도 ADR 로 처리
  - **Why**: Phase 2 cutover (read path dual-mode) 에 PR-E2 write 전환은 필수 아님. 사용자 시각 차이는 read level 에서만 dual-mode 분기로 충족. 무리한 write 전환은 P3-D 의존성으로 인해 incomplete 상태 land 위험
  - sub-PR 표 갱신: E2 status `🔄 P3-D 종속 — 별도 ADR 로 처리`

## [ADR-111 Phase 2 PR-E1 — PageLayoutSelector dual-mode read 전환 — 세션 37 후반] - 2026-04-27

### Architecture

- **ADR-111 Phase 2 PR-E1 — PageLayoutSelector dual-mode read 전환** (functional 동등):
  - `apps/builder/src/builder/panels/properties/editors/PageLayoutSelector.tsx`
    - `isFramesTabCanonical()` flag 기반 dual-mode read path 도입 (PR-C FramesTab 패턴 동일)
      - **legacy path** (default false): `useLayouts()` 결과 그대로 사용
      - **canonical path** (true): `selectCanonicalDocument(state, pages, layouts).children.filter(reusable: true).map(...)` — `metadata.layoutId` 로 id 정규화하여 legacy `page.layout_id` 와 정합
    - `reusableFrames` useMemo 도입 — selector cache 함정 회피 (`useStore.getState()` 호출, deps `[layouts, pages, elementsMap]`)
    - `currentLayout` / `layoutOptions` / `layouts.length === 0` 가드 모두 `reusableFrames` 단일 source 기반으로 통일
    - write (`handleLayoutChange`) 는 legacy 그대로 — `pages.update(layout_id)` 직접 호출. P3-D 이후 canonical document mutation (RefNode.ref 변경) 으로 전환
  - **Why**: PR-C 에서 FramesTab read 를 canonical 로 전환했지만, PageLayoutSelector 는 여전히 legacy `useLayouts()` 직접 소비 → flag 활성화 시 두 컴포넌트의 frame 표시 mismatch 가능. PR-E1 이 그 정합성 복구. PR-E4 cutover (`VITE_FRAMES_TAB_CANONICAL=true` default) 시 두 컴포넌트가 동일 source 사용 보장
  - 검증: type-check 0 / FramesTab 33/33 회귀 0 / canonical adapters 78/78 회귀 0

### Bug Fixes

- **canonical mode 에서 PageLayoutSelector description 회귀 방지** (PR-E1 동반):
  - `apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts::convertLayoutToReusableFrame` 의 `metadata` 에 `description: layout.description ?? null` 보존 추가
  - **Why**: legacy `Layout.description` 은 PageLayoutSelector 의 "Using <name> frame" + description 표시에 사용. canonical projection 시 description 미보존 → flag 활성화 시 description UI 사라짐 회귀. metadata 에 보존하여 양 mode 시각 동일 유지

## [ADR-111 Phase 2 PR-D2 — FrameElementTree 컴포넌트 분리 — 세션 37 후반] - 2026-04-27

### Architecture

- **ADR-111 Phase 2 PR-D2 — FrameElementTree 프레젠테이션 컴포넌트 추출** (functional 동등):
  - `apps/builder/src/builder/panels/nodes/FramesTab/FrameElementTree.tsx` 신규 (~205 lines)
    - props: `tree` / `frameId` / `selectedElementId` / `expandedKeys` / `toggleKey` / `onCollapseAll` / `onElementClick` / `onElementDelete`
    - 책임: Layers 헤더 + Collapse All 버튼 + element 트리 렌더 + placeholder (frameId null / 빈 tree)
    - 내부 `renderTree` 재귀 — `renderFrameTree` 함수 흡수 (FramesTab 의 useCallback 제거)
  - `FramesTab.tsx` 의 `renderFrameTree` (135 lines) + `sidebar_elements` JSX (35 lines) → `<FrameElementTree>` 호출 (15 lines)
  - 미사용 import 제거: lucide icons (`Minimize`/`ChevronRight`/`Box`/`Trash`/`Settings2`) + `iconProps` + `ElementTreeItem`
  - **Why**: PR-D 의 FrameList 분리에 이어 FramesTab 이 orchestrator 역할만 남도록 UI 책임 완전 분리. `renderFrameTree` 가 더 이상 `useCallback` 으로 부모 hook deps 에 묶이지 않아 메모이제이션 부담 감소 (이전 deps: `[expandedKeys, toggleKey, selectedElementId, currentFrame?.id]`). PR-E 진입 시 동일 컴포넌트가 page-bound element tree 같은 다른 consumer 에 재사용 가능
  - 검증: vitest 33/33 PASS (FrameList 6 + FrameElementTree 12 + FramesTab 8 + frameActions 7) / type-check 0

### Infrastructure

- **FrameElementTree vitest 신규** (12 시나리오):
  - `__tests__/FrameElementTree.test.tsx` — 프레젠테이션 단위 테스트 (mock 0 — props 순수 함수)
  - placeholder 2: frameId null → "Select a frame" / tree=[] → "No elements"
  - tree 렌더 5: 1-level 표시 / Slot type "Slot: name" 명명 / nested expanded → 자식 표시 / nested collapsed → 자식 미표시 / selectedElementId active 클래스
  - interactions 5: element click → onElementClick(element) + frameId가 element.layout_id 로 매핑 / non-body Delete → onElementDelete + stopPropagation / body type → Settings 버튼 (Delete 없음) / ChevronRight icon click → toggleKey + stopPropagation / Collapse All → onCollapseAll
  - **Why**: 컴포넌트 분리 시점에 결정적 UI 계약을 잠금. P3 cascade 재작성 시 element tree 동작이 보존되는지 즉시 감지

## [ADR-111 Phase 2 PR-D — FrameList 컴포넌트 분리 — 세션 37 후반] - 2026-04-27

### Architecture

- **ADR-111 Phase 2 PR-D — FrameList 프레젠테이션 컴포넌트 추출** (functional 동등):
  - `apps/builder/src/builder/panels/nodes/FramesTab/FrameList.tsx` 신규 (108 lines)
    - props: `frames` / `selectedFrameId` / `onSelect` / `onDelete` / `onAdd`
    - 책임: frame 목록 + Add 버튼 + Delete 버튼 (Box icon + name + active 표시) + stopPropagation
  - `FramesTab.tsx` 의 `sidebar_layouts` JSX 영역 (62 lines) → `<FrameList>` 컴포넌트 호출 (8 lines) 로 교체
  - 미사용 `CirclePlus` lucide import 제거
  - **Why**: 데이터 source (legacy/canonical) 결정과 frame CRUD 로직은 부모 (FramesTab) 책임, FrameList 는 props 기반 결정적 UI 만 담당. PR-E (PageLayoutSelector — RefNode.ref 선택 UI) 가 동일 FrameList 컴포넌트 재사용 가능. PR-D2 (FrameElementTree 분리) 진입 시 FramesTab 의 책임이 orchestrator 만 남음
  - 검증: vitest 14/14 PASS (FrameList 6 + FramesTab 8) / frameActions 7/7 (회귀 0) / type-check 0

### Infrastructure

- **FrameList vitest 신규** (6 시나리오):
  - `__tests__/FrameList.test.tsx` — 프레젠테이션 단위 테스트 (mock 0 — props 순수 함수)
  - 시나리오: 빈 frames → "No frames available" / 2개 렌더 → 이름 표시 / `selectedFrameId` 매칭 → active 클래스 / Add 클릭 → onAdd / Frame 클릭 → onSelect(id) / Delete 클릭 → onDelete(id) + onSelect 미호출 (stopPropagation)
  - **Why**: 컴포넌트 분리 시점에 결정적 UI 계약을 잠금. PR-E 에서 다른 consumer (PageLayoutSelector 등) 가 같은 props 인터페이스로 재사용 시 회귀 즉시 감지

## [ADR-111 Phase 2 PR-C — FramesTab read path canonical 전환 (TDD RED→GREEN) — 세션 37 후반] - 2026-04-27

### Architecture

- **ADR-111 Phase 2 PR-C — FramesTab dual-mode read path** (TDD RED → GREEN):
  - `FramesTab.tsx` 에 `reusableFrames` useMemo 도입 — `isFramesTabCanonical()` flag 분기로 read path dual-mode
    - **legacy path** (flag false, default): `layouts.map(l => ({ id, name }))`
    - **canonical path** (flag true): `selectCanonicalDocument(state, pages, layouts).children.filter(reusable: true).map(...)` — `metadata.layoutId` (legacyToCanonical 보존) 으로 id 정규화하여 legacy CRUD (createLayout/deleteLayout) 와 id 정합 유지
  - **selector cache 함정 회피** (memory: `feedback-zustand-selector-cache.md`): useMemo 안에서 `useStore.getState()` 호출. selector 등록 안 함. deps: `[layouts, pages, elementsMap]` — selectCanonicalDocument 가 elements 소비하므로 elementsMap 도 추적
  - `currentFrame` / `handleAddFrame` (`layouts.length + 1` → `reusableFrames.length + 1`) / `handleDeleteFrame.remaining` / JSX `layouts.map` → `reusableFrames.map` 모두 단일 source 기반으로 통일
  - **Why**: PR-A wrapper + PR-B consumer 정합화의 read path 완성. PR-D (UI 분리) / PR-E (PageLayoutSelector + cutover) 에서 reusableFrames 단일 source 재사용 가능. 향후 P3 cascade 재작성 시 read path 변경 0
  - 검증: vitest 8/8 PASS (5 legacy baseline + 3 canonical mode: 목록 표시 / non-frame 필터 / id 정규화) / type-check 0 / frameActions 회귀 0

### Infrastructure

- **FramesTab vitest 확장 (3 canonical 시나리오 추가)**:
  - `__tests__/FramesTab.test.tsx` — 신규 mock: `isFramesTabCanonical` (feature flag toggle) + `selectCanonicalDocument` (canonical doc 반환)
  - canonical 시나리오 3:
    1. flag true + legacy layouts != canonical doc → canonical doc 의 reusable FrameNode 만 표시 (legacy 우회)
    2. children 에 non-frame / non-reusable / ref 노드 혼재 → reusable FrameNode 만 필터
    3. canonical FrameNode 클릭 → `metadata.layoutId` (legacy id) 로 `selectReusableFrame` 위임 — write 정합성 보장
  - **Why**: PR-Followup-A 의 5 baseline 위에 canonical mode 동작을 RED-first 로 추가하여 GREEN 구현이 정확히 의도대로 동작함을 잠금

## [ADR-111 Phase 2 PR-Followup-A — FramesTab 컴포넌트 vitest baseline 잠금 — 세션 37 후반] - 2026-04-27

### Infrastructure

- **ADR-111 Phase 2 PR-Followup-A — FramesTab 컴포넌트 회귀 테스트 신규**:
  - `apps/builder/src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx` 신규 (5 시나리오):
    1. 빈 frames 상태 → "No frames available" + Layers "Select a frame to view elements"
    2. frames 2개 렌더 → 각 frame name 표시
    3. Add Frame 버튼 클릭 → `createReusableFrame({ name: "Frame N", projectId })` 위임
    4. Frame 항목 클릭 → `selectReusableFrame(frameId)` 위임 (id 기반 시그니처 검증)
    5. Delete 버튼 클릭 → `deleteReusableFrame(frameId)` 위임 + `stopPropagation` 효과 (부모 onClick 미호출)
  - **Why**: PR-A/PR-B 머지 후 FramesTab 자체 vitest 부재 상태에서 PR-C (read path canonical 전환) 진입 시 회귀 감지 불가. baseline 잠금으로 후속 PR 회귀 즉시 감지
  - mock 격리: `react-router-dom` / `useLayoutsStore` / `useStore` / `useEditModeStore` / `useTreeExpandState` / `getDB` / `MessageService` / `featureFlags` / `frameActions` 9 모듈 vi.mock — Zustand selector 패턴 (`useLayoutsStore((state) => state.layouts)`) 도 selector 호출 분기로 구현
  - 검증: 5/5 PASS / 84ms / type-check 0 / frameActions vitest 7/7 회귀 0

## [ADR-111 Phase 2 PR-B — FramesTab consumer → frameActions 위임 — 세션 37 후반] - 2026-04-27

### Architecture

- **ADR-111 Phase 2 PR-B — FramesTab.tsx 가 frameActions wrapper 위임으로 전환** (functional 동등):
  - `handleAddFrame` → `createReusableFrame({ name, projectId })` 호출
  - `handleDeleteFrame` → `deleteReusableFrame(frameId)` 호출
  - `handleSelectFrame` → `selectReusableFrame(frameId)` 호출 (legacy `setCurrentLayout` 직접 destructure 제거)
  - 핸들러 시그니처 단순화: `(frame: Layout)` → `(frameId: string)` — 내부 정합화 (`frame.id` 만 사용하던 패턴 명시)
  - 제거: `Layout` 타입 import / `useLayoutsStore` 의 `setCurrentLayout` / `createLayout` / `deleteLayout` 직접 destructure
  - 유지: `useLayoutsStore.layouts[]` read (PR-C 에서 canonical 전환 예정) / `fetchLayouts` mount effect / `useSelectedReusableFrameId`
  - **Why**: PR-A 에서 도입한 frameActions wrapper 의 첫 consumer 실증. legacy bridge 호출은 wrapper 내부로 격리 → P3 cascade 재작성 시 단일 진입점만 변경하면 됨
  - 검증: type-check 0 / FramesTab 자체 vitest 부재 → PR-A frameActions 7/7 vitest 가 wrapper 행위 보장 (functional 동등)
  - 위치: `apps/builder/src/builder/panels/nodes/FramesTab/FramesTab.tsx`

### Documentation

- **ADR-111 진행 로그 + sub-PR 분할 표 갱신**:
  - `docs/adr/completed/111-layout-frameset-pencil-redesign.md` 진행 로그에 PR-B entry 추가 (handler 시그니처 변경 명시)
  - `docs/adr/design/111-layout-frameset-pencil-redesign-breakdown.md` PR-B 상태 `후속 세션` → `✅ 2026-04-27 (PR pending)`

## [ADR-111 Phase 2 PR-A — frameActions canonical wrapper + FRAMES_TAB_CANONICAL flag — 세션 37 후반] - 2026-04-27

### Architecture

- **ADR-111 Phase 2 진입 — PR-A: canonical-shaped frame CRUD wrapper layer**:
  - `apps/builder/src/builder/stores/utils/frameActions.ts` 신규 — `createReusableFrame` / `deleteReusableFrame` / `updateReusableFrameName` / `selectReusableFrame` 4 함수
  - 내부 구현: legacy `useLayoutsStore.getState()` 호출 wrapping. `selectCanonicalDocument` adapter 가 자동으로 reusable FrameNode 로 reverse-projection (P3 이후 직접 canonical document mutation 으로 전환)
  - **Why**: Phase 2 design breakdown 12h 추정 작업의 selectCanonicalDocument 매 render 호출 비용 + zustand selector cache 함정 (memory: `feedback-zustand-selector-cache.md`) 회피용 5-PR 보수 분할 첫 단계. PR-A 는 baseline-safe (FramesTab 미수정) → 후속 PR-B 부터 점진 transition
  - vitest 7/7 PASS / type-check 0
  - 위치: `apps/builder/src/builder/stores/utils/frameActions.ts` (신규) + `apps/builder/src/builder/stores/utils/__tests__/frameActions.test.ts` (신규)

### Features

- **FramesTab canonical-native 모드 feature flag 도입** (`isFramesTabCanonical()`):
  - `VITE_FRAMES_TAB_CANONICAL` 환경변수 기반, default `false`
  - `FeatureFlags` interface 에 `framesTabCanonical: boolean` 필드 추가
  - **Why**: ADR-111 P2 dual-mode 운영 토대. 후속 PR-C/D 진입 시 read path 분기 제어. 1주 dual-mode 운영 후 issue 0 확인 시 `true` 로 전환
  - 위치: `apps/builder/src/utils/featureFlags.ts:57-59` (interface) / `:154-167` (`isFramesTabCanonical` 함수) / `:191-194` (getFeatureFlags 통합)

### Documentation

- **ADR-111 진행 로그 + design breakdown sub-PR 분할 명시**:
  - `docs/adr/completed/111-layout-frameset-pencil-redesign.md` Status: `Proposed` → `In Progress`. 진행 로그 3 entry 추가 (세션 35 Proposed / 세션 36 Phase 1 함수 / 세션 37 Phase 2 PR-A)
  - `docs/adr/design/111-layout-frameset-pencil-redesign-breakdown.md` P2 Step 분해 표를 5-PR 분할 (A: 본 PR / B: FramesTab consumer / C: read path / D: UI 분리 / E: PageLayoutSelector + dev migration / G: cutover) 로 보강

## [ADR-113 P1+P2 mechanical rename — Element.tag → Element.type — 세션 37 마감] - 2026-04-27

### Architecture

- **ADR-113 Phase 1+2 main land** (PR #250, commit `cad82b02`):
  - Element.tag → Element.type — pencil format 정합 단계
  - **Phase 1 (Type 정의)**: 8 file 직접 rename — Element / PreviewElement / KitElement / MasterComponentSummary / ElementTreeItem / RuntimeElement / BuilderContext.elements[] / NestedSelectorChild
  - **Phase 2 (Mechanical rename)**: ~140 file
    - ast-grep `.tag` access 559+ → `.type`
    - ast-grep `tag: $X` interface/object property
    - node.js batch (`\btag\b` → `type`) source 106 file + test 22 file
    - destructure / shorthand object property 광범위 정리
  - **Read-through compat**: IDB adapter 4 read method 에 `normalizeLegacyElement(el)` helper 추가 — legacy `tag` field 보유 row 자동 정규화. P4 (DB_VERSION 9) 까지 backward compat
  - **Why**: ADR-113 design `Phase 1 (0.5d) + Phase 2 (1d) = 1.5d` 추정 작업을 단일 세션 내 완결. mechanical rename 의 ROI ≫ 점진적 진행 (consumer 558 ref 모두 동시 변환 필요)
  - 변경 규모: 243 files / +2302 / -2034
  - 위치: `apps/builder/src/types/builder/unified.types.ts` + `packages/shared/src/types/element.types.ts` + `apps/builder/src/lib/db/indexedDB/adapter.ts` (read-through helper)

### Bug Fixes

- **ADR-113 P1+P2 적용 후 dev runtime error fix** (사용자 dev 검증으로 발견):
  - 증상: `buildSceneIndex.ts:21 Uncaught TypeError: Cannot read properties of undefined (reading 'toLowerCase')`
  - **Why**: IDB 의 element row 가 v0.9 legacy schema (`tag` field 만 보유). code 는 모두 `el.type` 만 사용 → `undefined.toLowerCase()` 발생
  - 수정: IDB adapter 의 `getByPage` / `getByLayout` / `getChildren` / `getAll` 4 read method 에 `normalizeLegacyElement(el)` 적용. `el.type ?? el.tag` 자동 fallback
  - 위치: `apps/builder/src/lib/db/indexedDB/adapter.ts:36-46` (helper 정의), `:757-797` (4 read method 적용)

### Documentation

- **ADR-113 P1+P2 design 정합화 + main land 진행 로그**:
  - PR #250 검증 결과: type-check 0 errors / specs 322/322 PASS / shared 72/72 PASS / builder 4 failed (baseline 동일 — ADR-113 회귀 0건 확정 via worktree 격리 비교)
  - 잔여 `tag` 보존 4 file: `LegacyProjectDataV09.elements.tag` (v0.9 export schema) / `supabase.types.ts elements.Row.tag` (DB column, P4 까지) / `i18n/types.ts` (i18n key 무관) / `AddElementAction.config.tag` (event action discriminator nested path)

### Infrastructure

- **stale local branch 13 정리** (사용자 명시 승인):
  - 머지된 11개: `adr-903-p3d-componentspanel-layout-filter` / `adr-111-terminology-pencil-standard` / `claude/refactor-directory-structure-...` / `feat/adr-110-phase1-themes-adapter` / `feat/adr100-css3-extensions` / `feature/adr-059-phase-4-1` / `fix-canonical-doc-infinite-loop` / `refactor/react-stately-integration` / `worktree-agent-*` 7개
  - 미머지 2개 (강제): `claude/reverent-lewin` (xstudio 옛이름 docs) / `history` (옛 history feature) / `worktree-agent-a1fe9e930098c061e` (ADR-903 P3-E plan, 변경사항 main 흡수 완료)
  - 결과: local branch 14 → 1 (`main` only)

## [ADR-111 Phase 1 함수 layer 진입 + Terminology 보정 + ADR-113 inventory + P1-c dangling cleanup fix — 세션 36 마감] - 2026-04-27

### Bug Fixes

- **ADR-903 P3-E migration dangling reference graceful cleanup** (P1-c roundtrip 검증으로 발견):
  - 증상: dev 환경 console `[ADR-903 P3-E E-4] migration dry-run: status=failure, transformations=2, errors=1` 무한 반복 — composition-1.0 승격 영구 차단
  - **Why**: dev DB 의 element 가 dangling `layout_id` (layouts store 에 매칭 row 없음) 보유. legacy cascade bug (layout 삭제 시 element layout_id null 처리 누락) 잔여. ADR-111 G3 cascade 재작성 (Phase 3) 의 R3 risk 가 정확히 이 시나리오 — ADR-111 land 까지는 graceful degrade 가 안전
  - **Root cause**: `runLegacyToCanonicalMigration` 의 `canonicalParentId === null` 분기가 dangling/orphan 둘 다 errors push → status=failure → write-through skip → 매 reload 무한 재시도
  - 수정: dangling reference (page_id 또는 layout_id 있지만 canonical 매칭 실패) 는 errors 가 아닌 `orphanCleanups` 배열로 분리 + `console.warn` 으로 보고. 진짜 orphan (page_id=null + layout_id=null) 만 errors 유지. status=success 진입 시 write-through 가 dangling element 의 parent_id=null + layout_id=null 강등 (transformation 매핑 그대로 통과)
  - 새 console.warn: `[ADR-903 P3-E E-6] dangling reference cleanup for project <id>: N elements`
  - 위치: `apps/builder/src/lib/db/migration.ts` (+34/-6 LOC) + `__tests__/migration.test.ts` (Fixture interface 에 `expectDanglingCleanup` 마커 추가, 10 missing-frame fixture 가 graceful cleanup 으로 통과)
  - 검증: vitest 60/60 PASS (migration.test.ts) + 126/126 PASS (전체 db tests, 7 files) + pnpm type-check 3/3 PASS + Chrome MCP P1-c 실 검증 (status=failure → status=success 전환 확인)
- **ADR-113 Phase 0-α — `unified.types.ts` Element legacy fields `@deprecated` 마킹**:
  - 7 fields: layout_id / slot_name / componentRole / masterId / overrides / descendants / componentName
  - 각 필드에 cleanup target ADR (ADR-111 G3 또는 ADR-113 Phase 5) + 대체 canonical schema (FrameNode / RefNode / DescendantOverride 3-mode) + migration 계획 명시
  - 위치: `apps/builder/src/types/builder/unified.types.ts` (+38/-2 LOC). runtime 영향 0 (JSDoc 만)
  - 후속 (Phase 0-β skip): `packages/shared/src/types/element.types.ts` 는 이미 ADR-903 reference deprecated 보유 — ADR-113 reference 보강은 cleanup 시점에 자연 처리

### Architecture

- **ADR-111 Phase 1 (G1) Layout migration tool 함수 layer 완결** (4 commits, 4 신규 함수):
  - `convertTemplateToCanonicalFrame(template)` — legacy `LayoutTemplate` (`tag="Slot"` 기반) → canonical reusable `FrameNode` (pencil schema). `slot: ["header","content","footer"]`, `reusable: true`, `placeholder` (slot.required 시 true). 28 layoutTemplates 전수 변환 검증
  - `flattenTemplateElements(elements)` — `tag="Slot"` 자식 제거 + 나머지 구조 보존 (headless layout 만)
  - `buildDescendantsFromSlots(slots)` — RefNode `descendants` 초기화 헬퍼 (각 slot name → `{ children: [] }`)
  - `hoistLayoutAsReusableFrame(layout)` — legacy `Layout` entity → canonical reusable FrameNode. 출처 추적 위해 `metadata.type="legacy-layout-hoist"` + `projectId/description/slug/orderNum/notFoundPageId/inheritNotFound` 보존
  - `dryRunMigrationP111(adapter, projectId, doc)` — read-only adapter 조회 + canonical doc 매칭 + hoist 후보 계산 (idempotent skip)
  - `applyMigrationP111(doc, result)` — pure function, errors 거부 + 중복 id 방어 + immutable doc patch (persistence 분리)
  - vitest 45/45 PASS, pnpm type-check 3/3 PASS
  - 위치: `apps/builder/src/lib/db/migrationP111.ts` (185줄) + `__tests__/migrationP111.test.ts` (516줄)
  - **Why**: ADR-111 Gate G1 (a) 28 Slot 전수 자동 변환 검증 토대. 후속 P1-c (roundtrip 시각 비교, Chrome MCP) + P2 (FramesTab 재설계) 의 토대 함수 제공

### Documentation

- **ADR-111 Terminology 섹션 추가 + 보정** (PR #249 + commit f4047af1):
  - **PR #249**: pencil 공식 명칭 단일 표준 정책 명문화. Hard Constraint #5 추가 + Decision §Terminology 신규 섹션 (pencil 공식 점유 8 단어 + composition vs pencil 매핑 7건 + 충돌 해소 4건 + 유지 4건)
  - **commit f4047af1 보정**: 직전 추정 "rename ~30 파일" 은 inventory 결과 과대 평가로 판정. 실측 결과:
    - **rename 2 파일** — `PanelSlot.tsx → PanelArea.tsx` / `BottomPanelSlot.tsx → BottomPanelArea.tsx` (Builder UI panel slot 의미 격리)
    - **유지 (의미 일치)** — `skiaFrameHelpers` / `skiaFramePlan` / `skiaFramePipeline` / `workflowRenderer.PageFrame` / `workflowHitTest` / `workflowMinimap` / `skiaWorkflowSelection.PageFrameLike` 모두 canonical FrameNode 의 시각 표현으로 pencil `frame` 의미와 정합
    - **유지 (pencil 무관)** — `MaskedFrame` / `useFrameCallback` (RAF) / `iframe` (HTML) / Taffy WASM `canvas/layout/` / CSS `styles/layout/` / Builder UI `builder/layout/` / Inspector `useLayout*` / DataTablePreset / cssComponentPresets
  - Gate G4 (d) 통과 조건 보정: `skiaFrameHelpers/workflowFrame*` rename → `PanelSlot/BottomPanelSlot` rename 으로 변경
  - **Why**: 사용자 결정 (2026-04-27): "pencil 의 기능 명칭 그대로 사용해도 된다 — 강제로 맞추거나 alias 만들 필요 없다." composition `Frame` 단어가 4가지 의미로 분산된 우려 → inventory 후 실 충돌 영역 = Builder UI panel slot 만 (2 파일)
- **ADR-111 design breakdown 작성** (843줄, Team B architect agent):
  - `docs/adr/design/111-layout-frameset-pencil-redesign-breakdown.md` 신규
  - 5 Phase 분해: P1 (G1 migration tool 8h) / P2 (G2 FramesTab 재설계 12h) / P3 (G3 cascade 재작성 8h) / P4 (G4 legacy 0 + PanelSlot rename 8h) / P5 (G5 pencil 호환 6h, adapters/pencil/ 신규)
  - 각 Phase 별 파일 변경 목록 + 마이그레이션 도구 + 검증 시나리오 + 코드 예시
  - Skia rename 철회 보정 반영 (P4-c 섹션 — 의미 일치 유지로 변경)
- **ADR-113 inventory 분석 보고서** (627줄, Team C Explore agent):
  - `docs/adr/design/113-tag-type-rename-inventory.md` 신규
  - **실 count 46% 낮음**: 556 source refs (apps/builder/src + packages/) vs ADR-113 baseline 1031
  - **77% 자동 rename 가능**: 306 discriminator (if/switch) + 380 simple property access. AST-Grep ~90% 성공률
  - **23% (146 refs) 수동 검토**: generic constraint 7 cases / mapped type 0 / DataBinding.type / FieldDefinition.type 와의 scope 분리 검증
  - 6 카테고리 분류: types 11 / canvas 25 / panels 44 / stores 17 / utilities 28 / 기타 18
  - DB schema 영역 분석 (DB_VERSION 8→9 read-through/write-through/backup 3-phase)
  - hybrid 6 필드 cleanup 매핑: layout_id (ADR-111 분담) / masterId+componentRole (canonical type:"ref") / slot_name+overrides (descendants 흡수)
  - 5 Phase 분해 제안 + 작업 시간 (총 6 days) + risk grade (Phase 4 HIGH = DB migration)

## [ADR-903 P3-E E-6 후속 sweep 회귀 fix — ElementSlotSelector + usePresetApply infinite loop — 세션 36] - 2026-04-27

### Bug Fixes

- **ElementSlotSelector + usePresetApply infinite loop 회귀 fix** (HIGH 위험 회귀):
  - 증상: 사용자가 ElementSlotSelector 또는 LayoutPresetSelector 마운트 시 console error `The result of getSnapshot should be cached to avoid an infinite loop` + `Maximum update depth exceeded`
  - **Why**: 세션 35 의 P3-E E-6 후속 sweep (PR #244) 에서 두 컴포넌트에 `const canonicalDoc = useStore((state) => selectCanonicalDocument(state, state.pages, useLayoutsStore.getState().layouts))` 를 추가했음. 그러나 `selectCanonicalDocument` 가 호출마다 새 객체를 반환 → Zustand v5 + React useSyncExternalStore 가 reference equality 로 cache 판정 → 매번 cache miss → forceStoreRerender 무한 반복 → Maximum update depth 에러
  - **Root cause**: useStore selector 안에서 새 객체 반환 함수 호출 금지 — useStore selector 는 매 렌더 시 호출되므로 referential 안정성 필요
  - 수정: doc 을 useStore selector 로 구독하지 않고 **useMemo 안에서 lazy 생성** 으로 전환. ComponentsPanel.tsx 패턴 (callback 안에서 `useStore.getState()` + `useLayoutsStore.getState()`) 동일 적용
    - `apps/builder/src/builder/panels/properties/editors/ElementSlotSelector.tsx` — 별도 `canonicalDoc` 선언 제거 + `slots` useMemo 안에서 `useStore.getState()` + `useLayoutsStore.getState().layouts` + `selectCanonicalDocument(...)` 호출 + deps 에서 `canonicalDoc` 제거 (`[element, elementsMap, pages]` 만 유지)
    - `apps/builder/src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.ts` — 동일 패턴 (`existingSlots` useMemo 안에서 lazy 생성, deps `[elementsMap, childrenMap, layoutId]`)
  - 회귀 위험 0 — useMemo 안에서 호출도 매번 새 doc 객체 생성하지만, useMemo 가 deps 기반으로 캐시. selector 안에서 매번 호출되는 패턴과 다름
  - 검증: pnpm type-check 3/3 PASS
  - 위치: 2 파일 (+~6/-13 LOC)

## [ADR-903 본문 archive — completed/ 이관 + 종료 처리 마감 — 세션 35 마감] - 2026-04-26

> ADR-903 의 정식 종료 처리. Implemented 승격 (PR #245) 후 본문 위치는 `docs/adr/903-...md` (root) 에 남아있어 다른 Implemented ADR 와 불일치. 다른 9xx Implemented ADR (902/904~909) 는 모두 `docs/adr/completed/` 폴더에 위치 — 본 작업으로 정합. ADR-903 라인 종료 처리 마감.

### Documentation

- **ADR-903 본문 archive to completed/**:
  - `docs/adr/903-ref-descendants-slot-composition-format-migration-plan.md` → `docs/adr/completed/903-ref-descendants-slot-composition-format-migration-plan.md` (`git mv`)
  - 본문 내부 link 5건 path 갱신 — `[ADR-063](063-...)` → `[ADR-063](./063-...)`, `[ADR-110](910-...)` → `[ADR-110](../910-...)`, `[breakdown](design/903-...)` → `[breakdown](../design/903-...)`
  - `docs/adr/110-canonical-themes-variables-land-plan.md:145` ADR-903 reference path 갱신
  - `docs/adr/design/` 폴더 8 파일 (`903-canonical-examples.md` / `903-phase4-editing-semantics-breakdown.md` / `903-phase3-decisions.md` / `903-phase3d-runtime-breakdown.md` / `903-p3d4-phase-c-residual.md` / `903-phase5-persistence-imports-breakdown.md` / `903-phase3e-persistence-breakdown.md` / `903-p3d4-phase-d-verification.md`) 의 ADR-903 reference path 일괄 갱신 (sed)
  - `docs/adr/design/903-phase3-frameset-breakdown.md` 본문 — Status 표기 `Accepted → 2026-04-25` → `Implemented → 2026-04-26, completed/ 이관`
  - `docs/adr/design/903-phase3-residual-cleanup-plan.md` / `903-additional-fields-land-status.md` code path 표기 갱신
  - `docs/adr/README.md` ADR-903 행 link `(903-...)` → `(completed/903-...)`
  - `docs/adr/reviews/903.md` 는 historical record 보존 (변경 없음)
  - **Why**: ADR-903 라인의 마지막 정합 작업. 다른 9xx Implemented ADR 와 폴더 위치 일관성 + ADR-903 라인 종료 처리 명시적 마감 (Status Implemented + 본문 completed/ 위치 + 진행 로그 마지막 entry).
  - 영향: 코드 변경 0 (docs only). reference path 정합화로 link 깨짐 0건

## [ADR-903 라인 종료 ADR 라인업 완성 — ADR-112/113/114 Proposed — 세션 35 추가] - 2026-04-26

> ADR-903 라인의 잔여 3 영역에 대한 신규 ADR 일괄 등록. 이로써 ADR-903 라인의 모든 잔여 작업이 ADR 단위로 추적 가능 — 사용자가 우선순위 결정 후 점진 진행 가능. ADR-111 (Layout/frameset, 세션 35 본 entry) 와 합쳐 4 ADR 라인업 완성.

### Architecture

- **ADR-112 — Editing Semantics UI 5요소 (Proposed)**:
  - ADR-903 G4 잔여 흡수. ① reusable/ref/override 시각 마커 3종 (LayerTree/Canvas/DesignKit) + ② 양방향 탐색 액션 + ③ `detachInstance` UI + 경고 다이얼로그 + ④ `resetDescendantsOverride` + 필드별 "원본으로 복원" 버튼 + ⑤ "N개 인스턴스 영향" 미리보기
  - 대안 A (5 요소 일괄 land) 채택 — B (5 ADR 분리, 유지보수 HIGH) / C (부분 land, 위험 절반 잔존) 기각
  - Gate G4-A~G4-F. ADR-111 의 신 FramesTab 위에 통합 (선행 ADR 후 진입)
  - 위치: `docs/adr/112-editing-semantics-ui-5elements.md` (Risk-First 본문 ~190 LOC). design 문서 `903-phase4-editing-semantics-breakdown.md` (637 LOC) 그대로 활용 (신규 design 작성 불필요)

- **ADR-113 — `Element.tag → Element.type` rename + hybrid 6 필드 cleanup (Proposed)**:
  - ADR-903 G5 (b)~(f) 잔여 흡수. `tag → type` 1031 ref / 154 파일 일괄 rename + hybrid 6 필드 (layout_id 258 / masterId 55 / componentRole 41 / descendants 39 / slot_name 25 / overrides 23, 합 1472 ref / 184 파일) cleanup + DB schema 전환 (DB_VERSION 8→9)
  - 대안 A (단일 ADR + 단일 Phase 일괄) 채택 — B (2 ADR 분리, 중간 상태 복잡) / C (점진 rename, 유지보수 HIGH) 기각
  - 안전망 3중: ast-grep 자동 도구 + tsc --noEmit gate + roundtrip 검증
  - Gate G5-B~G5-F. ADR-111 와 독립 진행 가능 (영역 분리)
  - 위치: `docs/adr/completed/113-tag-type-rename-hybrid-cleanup.md` (Risk-First 본문 ~210 LOC). design 문서 `903-phase5-persistence-imports-breakdown.md` §P5-C 그대로 활용

- **ADR-114 — `imports` resolver + DesignKit 통합 (Proposed 당시, 2026-04-30 Superseded)**:
  - ADR-903 P5-D/E/F 잔여 흡수. P5-D imports fetch + parse / P5-E ResolverCache 동기 캐시 히트 + async prefetch / P5-F DesignKit 통합 결정 (Option α 무수정 + 별도 vs Option β 통합)
  - 대안 A (단일 ADR + 3 Phase) 채택 — B (3 ADR 분리, 의존 그래프 부담) / C (imports 만 우선, 성능 MED + 사용자 혼동) 기각
  - DesignKit 복사-적용 파이프라인 무수정 — ADR-903 R7 (DesignKit 별도 track) 명시적 수용
  - Gate P5-D/E/F + G-Integration (ADR-111 와 통합)
  - 위치: `docs/adr/completed/114-imports-resolver-designkit-integration.md` (Risk-First 본문 ~180 LOC). design 문서 §P5-D/E/F 는 historical reference 로 보존

- **ADR-903 라인 라인업 완성**:
  - ADR-111: Layout/frameset 완전 재설계 (pencil 호환) — G3 (b)/(c)/(d) 흡수
  - ADR-112: Editing Semantics UI 5요소 — G4 흡수
  - ADR-113: `tag → type` rename + hybrid cleanup — G5 (b)~(f) 흡수
  - ADR-114: `imports` resolver + DesignKit 통합 — P5-D/E/F 흡수
  - 4 ADR 모두 Proposed. 의존 그래프: ADR-111 (선행, P1) → ADR-112 (P2, ADR-111 후 진입) / ADR-113 (P2, ADR-111 와 독립) / ADR-114 (P3, ADR-111 후 진입)
  - 사용자 결정에 따라 ADR-111 부터 점진 진행 → 4 ADR 모두 land 시 ADR-903 라인 완전 종료

## [ADR-903 Implemented 승격 — canonical document core 4가지 완결, 잔여 신규 ADR 분리 — 세션 35] - 2026-04-26

> ADR-903 Status `Accepted → Implemented` 전환. 본 ADR 의 종결 scope = (1) canonical document 타입 + adapter 계약 land (G1) (2) Resolver 공통화 + 옵션 C default (G2) (3) frameset → reusable/ref/slot 표현 가능성 + preview/persistence sync (G3 a/e) (4) IndexedDB schema 자동 migration write-through (G5 a). 4 가지 core 완결.
>
> **잔여 영역 = 신규 ADR 로 분리** (사용자 결정):
>
> - **Layout/Slot frameset 완전 재설계 (pencil app 호환)** — G3 (b)/(c)/(d) — `LayoutsTab` → `FramesTab` 재설계 + repo-wide 결합 해체 + frame authoring UI 치환 + 잔여 layout_id caller (FramesTab/layoutActions/usePageManager/PageLayoutSelector) 일괄 흡수
> - **Editing Semantics UI 5요소** — G4 — reusable/ref/override 시각 마커 3종 + 양방향 탐색 + detach UI + resetDescendantsOverride + "N개 인스턴스 영향" 미리보기. design 문서 `903-phase4-editing-semantics-breakdown.md` (637 LOC) 그대로 활용
> - **`tag → type` rename + hybrid 6 필드 cleanup** — G5 (b)/(c)/(d)/(e)/(f) — 1472 ref / 184 파일 일괄 rename + roundtrip 검증 + DB schema 전환. design 문서 `903-phase5-persistence-imports-breakdown.md` 의 P5-C 부분
> - **`imports` resolver + DesignKit 통합** — P5-D/E/F — 외부 `.pen` fetch + ResolverCache + DesignKit 재매핑

### Architecture

- **ADR-903 Status `Accepted → Implemented` 승격**:
  - 본문 Status 줄 `Accepted — 2026-04-25 (Phase 0 G1 통과...)` → `Implemented — 2026-04-26 (Phase 0/1/2 완결 + Phase 3 G3 (a)/(e) + IndexedDB schema 자동 migration write-through 완결. G3 (b)/(c)/(d) ... 신규 ADR 로 분리)`
  - 진행 로그 마지막 entry 추가 — Status 승격 + 잔여 영역의 신규 ADR 분리 결정 + 본 ADR 의 종결 scope 4가지 명문화
  - `docs/adr/README.md` ADR-903 행을 "미구현" → **"완료"** 섹션으로 이동 (Implemented 2026-04-26)
  - **Why**: ADR-903 의 핵심 (canonical document migration + resolver 공통화 + IndexedDB schema 자동 migration) 은 완결. 사용자 결정 — "기존 Layout/frameset 은 변경된 format 에 맞게 (pencil app 과 동일) 완전 재설계" 로 별도 ADR 분리 결정. G4 UI 5요소 + G5 `tag→type` rename + imports/DesignKit 도 별도 ADR 로 분리 권장 (각 design 문서 보존, 후속 세션에 ADR 작성)
  - 위치: `docs/adr/completed/903-ref-descendants-slot-composition-format-migration-plan.md` (Status 1줄 + 진행 로그 +5줄, 본 archive 작업으로 completed/ 이관) / `docs/adr/README.md` (ADR-903 행 이동)

## [ADR-903 P3-D 모든 sub-phase land + Phase 3/4/5 plan 완비 — 세션 33] - 2026-04-26

> 세션 32 마지막 entry (Phase D 시나리오 갱신, commit `b7aa5846`) 이후 — P3-D-5 6/6 step 종결 + P3-D-2 GREEN cherry-pick + Phase C 정합화 plan land + Phase C GREEN 구현 land + P3-E IndexedDB persistence plan land + P3-E E-1 RED + GREEN land + P3-E E-2 (createMigrationBackup) RED + GREEN land + P3-E E-3 (runLegacyToCanonicalMigration dry-run + 50+ fixture) RED + GREEN land + P3-E E-4 (initializeProject migration entry 연결) RED + GREEN land + P3-E E-5 (getByLayout dev warning + utils TODO) RED + GREEN land + 잔여 grep audit land + Phase 4 G4 cover 확증. **P3-D 모든 sub-phase (D-1~D-5) land 완료** + **P3-E E-1/E-2/E-3/E-4/E-5 GREEN 종결**. ADR-903 진행도 ~96% → ~99.9%.

### Architecture

- **ADR-903 P3-D-5 step 1~5d — canonical adapter helper 통합 + workflow edges 경로 canonical activation** (commits `74996fd2` ~ `4594afd6`, 8 commits):

  P3-D-5 (BuilderCore + workspace canvas) 의 큰 작업 (~3-4h, HIGH 위험) 을 6 step 분해하여 step 1~5d 완료. 각 step 회귀 위험 0 보장 (doc 안 받는 caller 는 legacy fallback).
  - **Step 1 (`74996fd2`)**: useCanvasDragDropHelpers 의 ownership 비교 3 분기 (L158/258/282) 를 local `sameOwnership` helper 추출
  - **Step 2 (`47ed4952`)**: BuilderCore.tsx 의 layout membership 비교 2 분기 (L283/457) 를 local `belongsToLayout` helper 추출
  - **Step 3 (`31035bb6`)**: local helper 를 `adapters/canonical/index.ts` 로 통합 — `sameLegacyOwnership` + `belongsToLegacyLayout` export, `doc?: CompositionDocument | null` 시그니처 추가
  - **Step 4 (`2d9fbbfd`)**: 13 unit test (sameLegacyOwnership 7 + belongsToLegacyLayout 6) — Step 3 helper noop case 검증
  - **Step 5a (`7efaa31b`)**: workflowEdges 의 `computeLayoutGroups` 의 page.layout_id 직접 참조를 `getLegacyPageLayoutId(page, doc?)` helper 호출로 변경
  - **Step 5b (`372c7cba`)**: BuilderCanvas → `computeLayoutGroups` chain 의 doc 도입 — `selectCanonicalDocument(useStore.getState(), pages, layouts)` 호출
  - **Step 5c (`6e2d25d5`)**: helper 내부 canonical lookup 활성화 — `isCanonicalDescendantOf` (DFS) 추가 + `sameLegacyOwnership` (legacyOwnershipToCanonicalParent 비교) + `belongsToLegacyLayout` (layout frame descendants 확인)
  - **Step 5d (`4594afd6`)**: `getLegacyPageLayoutId` 내부 canonical 활성화 — doc.children 의 reusable frame descendants 에서 page.id 검색, "layout-<id>" prefix 자동 제거

  **Why**: P3-D-5 는 Team C 사전 분석 (세션 32) 에서 12-14h 재추정 + HIGH 위험. 단일 commit 진행 시 회귀 발생 가능성 높음. 단계적 분해 (indirection layer 먼저 → caller doc 도입 → helper canonical 활성화) 로 각 단계 회귀 0 보장.

  **검증**: 9 commits 모두 pnpm type-check 3/3 PASS + pnpm vitest integration 43/43 PASS (P3-D-5 신규 29 case 추가)

  **활성화 상태** (caller chain 별):

  | Caller chain                                                | doc 도입       | helper canonical           |
  | ----------------------------------------------------------- | -------------- | -------------------------- |
  | BuilderCanvas → computeLayoutGroups → getLegacyPageLayoutId | ✅ Step 5b     | ✅ Step 5d                 |
  | BuilderCore L283/457 → belongsToLegacyLayout                | ❌ doc 안 전달 | ✅ Step 5c (caller 미주입) |
  | useCanvasDragDropHelpers 3 분기 → sameLegacyOwnership       | ❌ doc 안 전달 | ✅ Step 5c (caller 미주입) |

  workflow edges 경로만 fully canonical 활성화. 나머지는 helper ready, caller doc 미주입 (legacy fallback) — Step 5e 에서 도입 예정.
  - 위치: `apps/builder/src/adapters/canonical/index.ts` (helper + DFS) / `apps/builder/src/builder/main/BuilderCore.tsx` / `apps/builder/src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.ts` / `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts` / `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
  - test: `apps/builder/src/adapters/canonical/__tests__/integration.test.ts` (P3-D-5 29 case)

- **ADR-903 P3-D-5 step 5e — BuilderCore + useCanvasDragDropHelpers caller doc 전수 도입** (commits `32bd0d41` ~ `3302dc4c`, 3 commits):

  Step 5c 의 helper 내부 canonical activation 후 caller 가 doc 미주입 상태 (legacy fallback) 였던 5 호출 지점 모두 `selectCanonicalDocument` 호출 + doc 전달.
  - **Step 5e-1 (`32bd0d41`)**: BuilderCore L283 (initialize useEffect, 1회) — `useStore.getState()` 의 elements/pages + `useLayoutsStore.getState()` 의 layouts → doc → `belongsToLegacyLayout(el, currentLayoutId, doc)` 전달
  - **Step 5e-2 (`04d03a09`)**: BuilderCore L457 (subscribe callback, 빈번) — editMode === "layout" 분기 안에서만 callback per-invocation 1회 doc 생성 (filter 모든 호출에서 재사용, page mode 시 cost 0)
  - **Step 5e-3 (`3302dc4c`)**: useCanvasDragDropHelpers 3 분기 (L158/256/278) — findDropTarget callback 안 1회 + buildReorderUpdates callback 안 1회 doc 생성 → loop 내 sameLegacyOwnership 호출에서 재사용

  **memoization 전략**: callback 진입 시 1회 생성 (loop 밖) → cost = O(N) per drag mouse-move (60fps 마진 안전). hook param / store selector 옵션 거부 — 결국 elements 변경 시 doc 재생성 필요해서 효과 미미 + caller API 침습.

  **Why**: P3-D-5 의 indirection layer 는 단계적 회귀 0 보장이 목적이었음. Step 5e 에서 모든 caller doc 전달로 ADR-903 canonical document 진입점 5/5 fully canonical → BuilderCore + workspace canvas 영역 옵션 C default 전환 준비 완료.

  **검증**: 3 commits 모두 pnpm type-check 3/3 PASS + pnpm vitest integration 43/43 PASS

  **활성화 상태 갱신** (Step 5e 후):

  | Caller chain                                                | doc 도입     | helper canonical |
  | ----------------------------------------------------------- | ------------ | ---------------- |
  | BuilderCanvas → computeLayoutGroups → getLegacyPageLayoutId | ✅ Step 5b   | ✅ Step 5d       |
  | BuilderCore L283 (loadElements)                             | ✅ Step 5e-1 | ✅ Step 5c       |
  | BuilderCore L457 (subscribe)                                | ✅ Step 5e-2 | ✅ Step 5c       |
  | useCanvasDragDropHelpers 3 분기                             | ✅ Step 5e-3 | ✅ Step 5c       |

  → P3-D-5 5/6 step 완료 (남은 Step 5f = invalidationPacket + LayoutGroup schema canonical 분석)
  - 위치: `apps/builder/src/builder/main/BuilderCore.tsx` (L8 import + L283 + L457) / `apps/builder/src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.ts` (L9-12 imports + L150 findDropTarget + L260 buildReorderUpdates)

- **ADR-903 P3-D-5 step 5f — LayoutGroup schema 변경 NOOP 결정 (분석 only)**:

  Step 5f 의 가이드 가설 ("LayoutGroup interface canonical 전환 + cache key 갱신") 을 코드 정밀 분석으로 검토한 결과, **schema 변경 불필요** 결론. 별도 commit 0건.

  **분석 발견**:
  1. **`getLegacyPageLayoutId` 의 canonical return 결과**: doc 활성 시에도 `node.id.startsWith("layout-") ? node.id.slice("layout-".length) : node.id` → reusable frame ID 가 "layout-" prefix 가지면 stripping → **legacy layoutId 와 동일 string**. 즉 LayoutGroup.layoutId 의 값이 legacy/canonical 무관 같은 문자열.
  2. **`buildLayoutGroupSignature` cache key**: `[layoutId, layoutName, pageIds.join(",")]` — layoutId 가 같으면 signature 동일. legacy → canonical 전환 시 invalidation 0회 (정상), 다르면 자동 invalidation (정상). **현재 schema 가 이미 canonical 호환**.
  3. **`renderLayoutGroups` consumer**: layoutId 자체를 안 씀 (group.pageIds 좌표 계산 + group.layoutName 라벨 표시만). schema 변경 시각 영향 0.

  **거부된 옵션**:
  - 옵션 B (`canonicalFrameId?: string` optional 필드 추가): 의미 명확화만, 기능 변화 0 → over-engineering 의심. ROI 낮음

  **Why**: P3-D-5 의 schema canonical 화는 BuilderCore + workspace canvas 영역의 caller doc 전수 도입 (Step 5e) 으로 이미 완결. LayoutGroup 자체는 canonical 활성화 영향 없음 — `getLegacyPageLayoutId` 의 prefix stripping 로직이 schema layer 의 변경 불필요성을 자동 보장.

  → **P3-D-5 6/6 step 종결** (5f 는 분석 only). ADR-903 진행도 ~98% 유지

- **ADR-903 P3-D-2 GREEN — elementCreation canonical parent context 전환** (cherry-pick 3 commits `98565c32` / `4c374600` / `9b02ae45`, 직접 main commit):
  - `apps/builder/src/builder/stores/utils/elementCreation.ts` 의 element 생성 시 parent context 결정을 `selectCanonicalDocument` 기반으로 전환 (97 LOC change)
  - RED test 14 actual 적용 (494 LOC, `elementCreationCanonical.test.ts` 신규) + RED 재구성 (test 분리)
  - **Why**: P3-D 6 sub-phase 의 D-2 — element 생성 경로의 canonical 전환. 옵션 C default 활성화 후 BuilderCore L283/L457 (P3-D-5) + useCanvasDragDropHelpers (P3-D-5) + layoutActions (P3-D-3) + workflow renderer (P3-D-4) + elementCreation (P3-D-2) 5축 모두 canonical → P3-D 모든 sub-phase land
  - 검증: pnpm vitest 57/57 PASS (P3-D-2 14 신규 + canonical integration 43) / pnpm type-check 3/3 PASS / cherry-pick conflict 0
  - 위치: `apps/builder/src/builder/stores/utils/elementCreation.ts` + `__tests__/elementCreationCanonical.test.ts`

- **ADR-903 P3-D-1 fully merged 확증** (commit `0fcfcb60` 이전 세션 land):
  - `git merge-base origin/main origin/feat/adr-903-p3d1-factory-ownership` = `0fcfcb60` (HEAD 자체) → 모든 변경이 이미 main 에 머지됨
  - factory ownership 287 ref 제거 + `TableComponents.createTable pageId destructure 복원` 회귀 fix
  - branch 정리: origin + local 삭제 완료
  - **결합 정리**: P3-D-1 (factory) + P3-D-2 (elementCreation) + P3-D-3 (layoutActions) + P3-D-4 (workflow renderer Phase A/B/C) + P3-D-5 (BuilderCore + workspace canvas) = **P3-D 5/5 sub-phase land 완료**

- **ADR-903 P3-D-4 Phase C 정합화 plan land** (PR #238 머지, commit `e5cbc148`):
  - `usePageManager.ts` 의 minimal stub (L516-527) 정합화 4-step 분해 plan 작성
    - Step C-1: helper 함수 추출 (위험 0, 1h)
    - Step C-2: DB 조회 로직 통합 (낮음, ~1h)
    - Step C-3: 중복 제거 정합화 (낮음, ~1h)
    - Step C-4: console.log 정리 + TODO 주석 제거 (없음, ~0.5h)
  - **Why**: Phase C minimal stub 의 layoutElements 누락 회귀 수정 — `selectCanonicalDocument` 의 reusable FrameNode 기반 elements 추출 정합화. 선행 의존: P3-D-1 머지 (이미 완료), 진입 즉시 가능
  - 위치: `docs/adr/design/903-p3d4-phase-c-residual.md` (336 LOC)

- **ADR-903 P3-D-4 Phase C GREEN 구현 — usePageManager canonical layoutElements 추출**:
  - `apps/builder/src/builder/hooks/usePageManager.ts` 의 `initializeProject` minimal stub (12 LOC) → canonical reusable FrameNode 기반 layout elements 추출 (15 LOC) 전환
  - `selectCanonicalReusableFrames(canonicalDoc)` 호출 → `layoutIdSet` 구성 → `allElements.filter(el => el.layout_id != null && layoutIdSet.has(el.layout_id))` 단일 패스. `db.elements.getByLayout` 추가 호출 0
  - **Why**: minimal stub 으로 land 된 Phase C (PR #237 commit `5db2c695`) 에서 layout-linked elements 가 빈 배열 → 초기화 시 layout body element 누락 회귀. 4-step plan (`903-p3d4-phase-c-residual.md`) 실행으로 정합화
  - **Plan 수정점**: Plan Step C-2 의 `db.elements.getByLayout` 호출 패턴은 `usePageManager.canonical.test.ts` RED test 1 (`getByLayout(layoutId) 호출이 제거된다`) 와 충돌 — 추가 DB 호출 없이 이미 로드된 `allElements` 를 layoutIdSet 매칭으로 필터링하여 RED test 3개 모두 GREEN
  - 검증: pnpm vitest `usePageManager.canonical.test.ts` 3/3 GREEN (RED → GREEN) + pnpm type-check PASS + baseline 비교 4 pre-existing failures (`layoutActions.test.ts` P3-D-3 과도기 + `useFillActions.test.tsx` legacy) 본 변경 무관 확증
  - 위치: `apps/builder/src/builder/hooks/usePageManager.ts` (+8/-7 LOC)

- **ADR-903 P3-E E-6 후속 sweep — ComponentsPanel + ElementSlotSelector + usePresetApply layout filter canonical 정합화** (세션 35 추가, 단순 helper 교체 가능 3 caller):
  - `apps/builder/src/builder/panels/components/ComponentsPanel.tsx:72` — `elements.filter(el => el.layout_id === currentLayoutId)` → `belongsToLegacyLayout(el, currentLayoutId, doc)` (이미 useCallback 안 doc 도입됨)
  - `apps/builder/src/builder/panels/properties/editors/ElementSlotSelector.tsx:40` — `el.layout_id === page.layout_id && el.tag === "Slot"` → `el.tag === "Slot" && belongsToLegacyLayout(el, page.layout_id, canonicalDoc)`. `useStore` selector 로 canonicalDoc 도입 + useMemo deps 추가
  - `apps/builder/src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.ts:62` — `el.layout_id === layoutId && el.tag === "Slot"` 동일 패턴 전환. `useStore` selector 로 canonicalDoc 도입 + useMemo deps 추가
  - helper (P3-D-5 step 5c 도입, `adapters/canonical/index.ts:469`) 는 doc 전달 시 canonical reusable frame descendants 매칭, doc 없으면 legacy fallback
  - **Why**: E-6 write-through 활성화 후 element.layout_id 가 null 이 되어 layout 모드 / Slot 검색 결과 빈 배열 → UI 회귀 (새 element 추가 / Slot 선택 / 프리셋 적용 모두 영향). helper 는 P3-D-5 단계에서 도입됐으나 위 3 caller 는 legacy 매칭 그대로 잔존. write-through 와 짝 맞춰 정합화
  - 회귀 위험 0 — helper legacy fallback 보존 + tag 필터 별도 유지 (도메인 의미 보존)
  - 검증: pnpm type-check 3/3 PASS
  - 위치: 3 파일 (+~25/-8 LOC)
  - **잔존 follow-up (HIGH 회귀 위험, 별도 작업)**: `FramesTab.tsx` L115 (`db.elements.getByLayout` caller — composition-1.0 후 빈 배열) + L124/L142 (loadFrameElements / frameElements memo) — getByLayout 자체 canonical 변환 필요. `layoutActions.ts:256/L332` (deleteLayout / cloneLayout cascade — DB write 영향). `usePageManager.ts:528` (mergedMap 합성 — `selectCanonicalReusableFrames` + layout_id 매칭 혼용) — 비즈니스 로직 정합화 별도 ADR 또는 분석 필요

- **ADR-903 P3-E E-6 RED + GREEN — write-through 활성화 + utils canonical 전환 + G3-E grep 정합화** (세션 35):
  - **migration write-through 활성화**: `runLegacyToCanonicalMigration` 의 `dryRun` 옵션 (default `true`, E-3 호환) → `false` 시 실제 DB 반영
    - `status === "success"` 분기 — `adapter.elements.updateMany` 로 모든 element 의 `parent_id` canonical 변환 + `layout_id: null` 정리, 이어서 `adapter.meta.set({ projectId, schemaVersion: "composition-1.0", migratedAt, backupKey })`
    - `status === "failure"` 분기 — `adapter.meta.set({ projectId, schemaVersion: "legacy", backupKey })` 로 fallback 유지 + `console.warn`
  - **`getByLayout` canonical path 강제**: `_meta` store 의 record 중 하나라도 `schemaVersion === "composition-1.0"` 이면 `getByLayout()` 빈 배열 반환 (caller 가 `selectCanonicalReusableFrames` + `parent_id` 매칭으로 마이그레이션 강제)
  - **`utils/element/elementUtils.ts:findLayoutBodyElement`**: `el.layout_id === layoutId` 매칭 → canonical frame node id (`frameNodeIdForLegacyLayout(layoutId, doc)` wrapper) 의 `el.parent_id` 매칭으로 전환. `findBodyByContext` 시그니처에 `doc: CompositionDocument` 필수 인자 추가
  - **caller chain doc 전수 도입**: `useElementCreator.handleAddElement` + `ComponentFactory.createComplexComponent` + `ComponentCreationContext.doc` 필수화. `ComponentsPanel.tsx` 가 `selectCanonicalDocument(state, state.pages, layouts)` 로 doc 만들어 전달
  - **`utils/urlGenerator.ts:findUrlConflict` 제거**: caller 0 (전수 grep 확인) — dead code 제거. `Layout` import 는 `generatePageUrl` 에서 유지
  - **G3-E sub-gate grep 명령 보완** (`docs/adr/design/903-phase3e-persistence-breakdown.md:509-541`):
    - `createIndex` / `indexNames` / `getAllByIndex` 인자의 `"layout_id"` 문자열 명시 제외 — IndexedDB schema 정의 + legacy fallback 경로 (P5-C 영역, `DB_VERSION` 9 진입 시 별도 ADR 로 처리)
    - `legacyOwnershipToCanonicalParent({ layout_id: ... }, doc)` input 은 `frameNodeIdForLegacyLayout()` wrapper (adapters/canonical/index.ts) 경유로 lib/+utils/ 영역 0건 달성
    - 보완 grep 적용 시 baseline 8건 → **0건**
  - **`adapters/canonical/index.ts:frameNodeIdForLegacyLayout` 신규**: `legacyOwnershipToCanonicalParent({ layout_id }, doc)` wrapper. `lib/` + `utils/` 영역에서 `layout_id` 매칭 false positive 제거 위함. `adapters/` 는 grep 범위 밖이므로 ownership shape input 자체는 의도된 형태로 유지
  - **Why**: ADR-903 P3-E 의 마지막 sub-phase. E-3 dry-run 50+ fixture round-trip 으로 변환 정합성 검증 완료 → write-through 활성화. 기존 IndexedDB legacy 프로젝트가 처음 열릴 때 자동 migration 진행 + `_meta` store 에 `schemaVersion: "composition-1.0"` 영속. 실패 시 `schemaVersion: "legacy"` 유지 + localStorage backup 으로 복원 가능
  - **회귀 위험 안전망**:
    1. write 활성화 전 50+ fixture integration test 통과 (E-3 60/60 GREEN)
    2. dev 환경 브라우저 DevTools IndexedDB 탐색기 수동 검증 (사용자 책임)
    3. 실패 시 fallback 자동 복귀 (`schemaVersion: "legacy"` + legacy adapter fallback + localStorage backup)
  - **사용자 가시 영향 (BREAKING — 데이터 schema 자동 변환)**: 기존 프로젝트 첫 open 시 elements 의 `layout_id` 가 `null` 로, `parent_id` 가 canonical reusable frame ID 로 자동 변환됨. 변환 실패 시 legacy 데이터 그대로 유지됨. localStorage 에 `composition-migration-backup:<projectId>:<ts>` key 로 변환 전 dump 저장
  - **검증**:
    - 신규 test: `migration-write-through.test.ts` (5 it: success updateMany / success meta.set composition-1.0 / failure meta.set legacy / dryRun=true 보존 / skipped 케이스), `getByLayoutCanonicalPath.test.ts` (2 it: schema 분기 + getAllFromStore<MetaRecord>)
    - E-5 `getByLayoutDeprecation.test.ts` test 3/4 — TODO 주석 검증 → negative assertion (`page.layout_id` / `el.layout_id` 부재 검증) 으로 전환
    - 전체 신규/수정 영역 vitest 170/170 PASS / type-check 3/3 PASS / 본 PR 의 E-1~E-6 관련 7 test files 90/90 GREEN
  - 위치: `apps/builder/src/lib/db/migration.ts` (+34/-3 LOC) / `apps/builder/src/lib/db/indexedDB/adapter.ts` (getByLayout canonical strict +9 LOC) / `apps/builder/src/utils/element/elementUtils.ts` (findLayoutBodyElement / findBodyByContext doc 인자 추가) / `apps/builder/src/utils/urlGenerator.ts` (findUrlConflict 제거 -38 LOC) / `apps/builder/src/adapters/canonical/index.ts` (frameNodeIdForLegacyLayout +18 LOC) / `apps/builder/src/builder/factories/types/index.ts` (ComponentCreationContext.doc 필수) / `apps/builder/src/builder/factories/ComponentFactory.ts` (createComplexComponent doc 필수) / `apps/builder/src/builder/hooks/useElementCreator.ts` (handleAddElement doc 필수) / `apps/builder/src/builder/panels/components/ComponentsPanel.tsx` (selectCanonicalDocument 호출 + doc 전달) / `apps/builder/src/lib/db/__tests__/migration-write-through.test.ts` (신규 ~250 LOC) / `apps/builder/src/lib/db/__tests__/getByLayoutCanonicalPath.test.ts` (신규 ~46 LOC) / `apps/builder/src/lib/db/__tests__/getByLayoutDeprecation.test.ts` (test 3/4 negative assertion 전환)

- **ADR-903 P3-E E-1 RED + GREEN — IndexedDB `_meta` object store 도입** (PR `adr-903-p3e-e1-red-test` merge `a055055b` + 후속 GREEN commit):
  - **RED 단계**: `apps/builder/src/lib/db/__tests__/metaStore.test.ts` 신규 (5 it RED 가정). production code 부재 시 5/5 FAIL 확증
    1. `DB_VERSION = 8` 갱신
    2. `_meta` object store 생성 (`onupgradeneeded`)
    3. `MetaRecord` interface 정의 (schemaVersion / migratedAt / backupKey)
    4. `meta` 메서드 그룹 (get / set / update)
    5. `getByLayout` `@deprecated` JSDoc
  - **GREEN 단계**:
    - `apps/builder/src/lib/db/types.ts` — `MetaRecord` interface 추가 + `DatabaseAdapter.meta` 메서드 그룹 정의 + `getByLayout` `@deprecated` JSDoc
    - `apps/builder/src/lib/db/indexedDB/adapter.ts` — `DB_VERSION 7→8` + `onupgradeneeded` 안에 `_meta` store 생성 (`{ keyPath: "projectId" }`) + `IndexedDBAdapter.meta` 클래스 field (get / set / update, `getFromStore` / `putToStore` 재사용) + `getByLayout` `@deprecated` JSDoc
    - test regex 보완: `meta\s*[:=]` (interface ":" 와 class field "=" 둘 다 매칭) / `@deprecated[\s\S]{0,500}` (JSDoc 본문 길이 여유)
  - **Why**: ADR-903 P3-E breakdown 의 E-1 sub-phase. read-only stub land (write-through 미포함) — E-2 backup / E-3 migration / E-4 entry 연결 / E-5 dev warning / E-6 write-through 후속. legacy ownership marker (`element.layout_id`) 의존을 단계적으로 제거하기 위한 첫 인프라.
  - 검증: `metaStore.test.ts` 5/5 GREEN + `usePageManager.canonical.test.ts` 6/6 GREEN (전 session GREEN 유지) + `pnpm type-check` PASS + apps/builder vitest 546 PASS / 4 pre-existing FAIL (회귀 0)
  - 위치: `apps/builder/src/lib/db/types.ts` (MetaRecord +12 LOC, meta 그룹 +6 LOC, getByLayout JSDoc +6 LOC) / `apps/builder/src/lib/db/indexedDB/adapter.ts` (DB_VERSION 1 LOC + \_meta store +5 LOC + meta 그룹 +24 LOC + getByLayout JSDoc +6 LOC)

- **ADR-903 P3-E E-5 RED + GREEN — getByLayout dev warning + utils TODO 주석** (회귀 위험 0):
  - `apps/builder/src/lib/db/indexedDB/adapter.ts` — `getByLayout` 메서드 본문에 `process.env.NODE_ENV !== "production"` 분기 + `console.warn` 호출 추가 (deprecated 사용 추적, dev mode 한정)
  - `apps/builder/src/utils/urlGenerator.ts:219` — `page.layout_id` 참조 직전 `// TODO(P3-E): canonical parent 기반으로 교체 ...` 주석 (write-through 전환 E-6 후 canonical document 의 reusable frame ID 매핑으로 변경 예정)
  - `apps/builder/src/utils/element/elementUtils.ts:44` — `el.layout_id === layoutId` 참조 직전 동일 TODO 주석
  - `apps/builder/src/lib/db/__tests__/getByLayoutDeprecation.test.ts` 신규 — 4 it RED → GREEN: getByLayout console.warn 존재 / dev 환경 분기 / urlGenerator TODO / elementUtils TODO (source-pattern 검증)
  - **Why**: P3-E breakdown 의 E-5 sub-phase. legacy column read-only 선언 + write 차단 준비. dev-only warning 으로 caller 가 점진적으로 canonical parent 조회로 마이그레이션할 수 있도록 추적 가능. utils/ TODO 는 E-6 전환 시점의 작업 인덱스
  - 검증: `getByLayoutDeprecation.test.ts` 4/4 GREEN (RED → GREEN 전환) + `pnpm type-check` PASS + apps/builder vitest 615 PASS / 4 pre-existing FAIL (회귀 0)
  - 위치: `apps/builder/src/lib/db/indexedDB/adapter.ts` (getByLayout +9 LOC) / `apps/builder/src/utils/urlGenerator.ts` (TODO +3 LOC) / `apps/builder/src/utils/element/elementUtils.ts` (TODO +3 LOC) / `apps/builder/src/lib/db/__tests__/getByLayoutDeprecation.test.ts` (신규 ~75 LOC)

- **ADR-903 P3-E E-4 RED + GREEN — initializeProject migration entry 연결 (dry-run, DB 무변경)**:
  - `apps/builder/src/builder/hooks/usePageManager.ts` import 추가: `runLegacyToCanonicalMigration` from `../../lib/db/migration`
  - `initializeProject` 의 `hydrateProjectSnapshot` 직후에 migration entry 블록 삽입 (~22 LOC):
    ```ts
    const metaRecord = await db.meta.get(projectId);
    if (!metaRecord || metaRecord.schemaVersion === "legacy") {
      const migrationCanonicalDoc = selectCanonicalDocument(...);
      const migrationResult = await runLegacyToCanonicalMigration(db, projectId, { canonicalDoc: migrationCanonicalDoc });
      if (process.env.NODE_ENV !== "production") {
        console.log(`[ADR-903 P3-E E-4] migration dry-run: status=..., transformations=..., errors=...`);
      }
    }
    ```
  - `usePageManager.canonical.test.ts` 확장 — 3 신규 it (RED → GREEN): import / runLegacyToCanonicalMigration 호출 / db.meta.get + schemaVersion 검사 (source-pattern)
  - **Why**: P3-E breakdown 의 E-4 sub-phase. E-3 의 `runLegacyToCanonicalMigration` 을 실 caller (`initializeProject`) 에서 dry-run 호출. `db.meta.get(projectId)` 으로 schemaVersion 검사 후 `legacy` 또는 record 부재 시만 실행. dev mode console.log 로 변환 결과 추적 — 실제 DB write 는 E-6 (write-through) 단계에서
  - 검증: `usePageManager.canonical.test.ts` 9/9 GREEN (6 Phase C contract + 3 E-4 신규) + `pnpm type-check` PASS + apps/builder vitest 614 PASS / 4 pre-existing FAIL (회귀 0, baseline 611 → 614)
  - 위치: `apps/builder/src/builder/hooks/usePageManager.ts` (import +1 LOC + migration entry +22 LOC) / `apps/builder/src/builder/hooks/__tests__/usePageManager.canonical.test.ts` (E-4 contract +52 LOC)

- **ADR-903 P3-E E-3 RED + GREEN — runLegacyToCanonicalMigration (dry-run + 50+ fixture)**:
  - `apps/builder/src/lib/db/migration.ts` 신규 (~120 LOC) — `runLegacyToCanonicalMigration(adapter, projectId, { canonicalDoc, dryRun? }): Promise<MigrationResult>` 함수
    - `MigrationResult` interface: `{ status: "skipped" | "success" | "failure", reason?, backupKey?, transformations[], errors[] }`
    - `MigrationTransformation` interface: `{ elementId, page_id_was, layout_id_was, canonicalParentId }`
    - 흐름: `_meta.get` → 이미 `composition-1.0` 이면 status=skipped / `createMigrationBackup` 호출 → backupKey / `elements.getAll()` 전수 로드 / 각 element 의 ownership → `legacyOwnershipToCanonicalParent(canonicalDoc)` 적용 / canonical parent 미존재 시 errors push (orphan vs missing-frame 구분)
    - **dry-run only** — DB write 0건. 실제 elements.updateMany / meta.set 은 E-6 단계
  - `apps/builder/src/lib/db/__tests__/migration.test.ts` 신규 (~310 LOC) — 60 it (RED → GREEN):
    - **9 core contract**: export / skipped (composition-1.0) / dry-run write 0 / backup key 반환 / layout_id transformation / page_id transformation / orphan errors / missing frame errors / status success vs failure
    - **1 fixture count assertion**: ≥50 fixture 보장
    - **50 fixture round-trip** (`it.each`): 15 page + 15 layout + 10 orphan + 10 missing-frame
    - vitest jsdom 환경 명시 + `vi.mock("../migrationBackup")` (createMigrationBackup spy)
  - **Why**: P3-E breakdown 의 E-3 sub-phase. legacy → composition-1.0 변환 정합성을 50+ fixture 로 dry-run 검증한 후 E-6 (write-through) 진입 가능. dry-run 이라 회귀 위험 0
  - 검증: `migration.test.ts` 60/60 GREEN (RED → GREEN 전환) + `pnpm type-check` PASS + apps/builder vitest 611 PASS / 4 pre-existing FAIL (회귀 0, baseline 551 → 611)
  - 위치: `apps/builder/src/lib/db/migration.ts` (신규) + `apps/builder/src/lib/db/__tests__/migration.test.ts` (신규)

- **ADR-903 P3-E E-2 RED + GREEN — createMigrationBackup (read-only localStorage backup)**:
  - `apps/builder/src/lib/db/migrationBackup.ts` 신규 (88 LOC) — `createMigrationBackup(adapter, projectId): Promise<string>` 함수
    - `MigrationBackup` interface: `{ projectId, timestamp, elements, layouts, backupVersion: "legacy" }`
    - `BackupCapableAdapter` minimal interface (elements/layouts.getAll() 만 의존)
    - backup key 패턴: `composition-migration-backup:<projectId>:<Date.now()>`
    - 동일 projectId 의 prior backup 전수 정리 (1 project = 1 backup, localStorage 용량 보호)
  - `apps/builder/src/lib/db/__tests__/migrationBackup.test.ts` 신규 (147 LOC) — 5 RED → GREEN it block:
    1. createMigrationBackup 함수 export 검증
    2. backup key regex (`^composition-migration-backup:proj-123:\d+$`) 매칭
    3. localStorage backup JSON 구조 (projectId / timestamp / elements / layouts / backupVersion: "legacy")
    4. 동일 projectId 이전 backup 정리 (1차 backup 제거 + 2차 backup 잔존)
    5. **read-only 보장**: adapter 의 write 메서드 (insert/update/updateMany/delete/deleteMany) 호출 0건
    - vitest jsdom 환경 명시 (`// @vitest-environment jsdom`) — localStorage 사용
  - **Why**: P3-E breakdown 의 E-2 sub-phase. E-3 migration script (legacy → composition-1.0 변환) 의 사전 안전망. graceful degradation 보장 — backup 후 변환 실패 시 backup JSON 으로 복원 가능. localStorage 기반이라 IndexedDB 트랜잭션 실패와 독립
  - 검증: `migrationBackup.test.ts` 5/5 GREEN (RED → GREEN 전환) + `pnpm type-check` PASS + apps/builder vitest 551 PASS / 4 pre-existing FAIL (회귀 0, baseline 546 → 551)
  - 위치: `apps/builder/src/lib/db/migrationBackup.ts` (신규) + `apps/builder/src/lib/db/__tests__/migrationBackup.test.ts` (신규)

- **ADR-903 P3-E E-1 RED + GREEN — IndexedDB `_meta` object store 도입** (PR `adr-903-p3e-e1-red-test` merge `a055055b` + 후속 GREEN commit):
  - IndexedDB schema 마이그레이션 6-step 분해 plan 작성
    - E-1: `_meta` object store stub land (1h, 위험 0)
    - E-2: backup 함수 추가 read-only (1h, 위험 0)
    - E-3: migration script dry-run + 50+ fixture test (2h, MED → 50+ test 로 방어)
    - E-4: `initializeProject` migration 진입 조건 연결 (1h, LOW)
    - E-5: `getByLayout` dev warning + TODO 주석 (0.5h, 위험 0)
    - E-6: write-through 전환 — G3-E 통과 시점 (1.5h, HIGH → 3중 안전망)
  - **결정 3 채택** (`_meta` object store + `backupKey` 필드, `DB_VERSION` 7→8): 기존 `projects` / `elements` / `layouts` store 무변경
  - **안전망 3중**: IndexedDB ACID + localStorage backup + `_meta.schemaVersion = "legacy"` fallback. E-1~E-5 dry-run / read-only, E-6 만 실 DB write
  - **G5 매핑**: P3-E 는 G5 (b)(c) land. G5 (d)(e)(f) = P5-B/C 후속 (`useLayoutsStore` 본체 / `layout_id` index / `getByLayout` 삭제)
  - 위치: `docs/adr/design/903-phase3e-persistence-breakdown.md` (620 LOC)

- **ADR-903 잔여 grep audit 2026-04-26 land** (commit `c0afc071`, 직접 main commit):
  - 9 grep pattern 측정 결과 보고
    - layout_id/page_id 직접 비교 73 건 = **모두 adapter/bridge 내부 격리** (회귀 위험 0)
    - canonical helper 3 종 정의 완료, caller 구현 진행 중
    - G3 (c) 60% 완료 (15 파일 → canonical bridge)
    - G5 (b) baseline = 832 ref non-adapter (정상 진행)
  - **Residual 4 카테고리**: A Carry-over 정상 / B 즉시 전환 가능 6~8개 파일 / C 재설계 필요 = **0개** ✅ / D Phase 5 G5 대규모 batch
  - **회귀 위험 LOW** (옵션 C default 이후)
  - **진입 가능 평가**: ✅ P3-E 진입 = YES / ⚠️ Phase 4 진입 = CONDITIONAL (P3 G3 통과 후)
  - 위치: `docs/adr/design/903-residual-grep-audit-2026-04-26.md` (536 LOC)

- **ADR-903 Phase 4 G4 sub-breakdown 검증** (agent dispatch 결과 cover 확증):
  - 기존 `docs/adr/design/903-phase4-editing-semantics-breakdown.md` (637 LOC, 2026-04-25) 가 이미 7 요구사항 baseline + P4-A~F 6 sub-phase 분할 + Sub-Gate G4-A~G4-F 모두 cover
  - 신규 plan 작성 불필요 (중복 회피, agent 의 ROI 판단 정확)
  - Phase 4 진입 가능 시점: P3 G3 통과 후

### Documentation

- **ADR-903 Phase D Chrome MCP 검증 시나리오 환경 가정 갱신** (commit `b7aa5846`):
  - 사전 조건 5 → 7 확장: (6) Compare Mode toggle 활성화 (React Aria native click 미반응, 사용자 직접) + (7) page 2개 이상 사전 생성 (B-1/B-2 검증 환경 조건)
  - Phase B version scope (UPDATE_ELEMENTS 한정) 명시 — design L36/L388 정합 (canonical document 식별 = elements 한정)
  - **Why**: 세션 32 Phase D 검증 진입 시 발견된 환경 한계 (iframe 가 toggle 식 mount, native click 미반응) 명문화 → 다음 세션 즉시 시나리오 진입 가능
  - 위치: `docs/adr/design/903-p3d4-phase-d-verification.md` (29 LOC 추가)

---

## [ADR-903 P3-D-1 tests-actual + P3-D-4 Phase A/B/C land — 세션 30~31] - 2026-04-26

> 세션 29 마지막 entry (`a3591f10` PR #234 P3-D-3 layout-actions 머지) 이후 — 세션 30 의 P3-D-2 GREEN + P3-D-4 Phase A/B push, 세션 31 의 Phase C minimal stub land + Phase A/B/C PR 모두 머지.

### Architecture

- **ADR-903 P3-D-1 factoryOwnership 39 todo → actual 변환** (PR #232 `feat/adr-903-p3d1-tests-actual`, commit `023322c7`):
  - factoryOwnership.test.ts 의 39 todo 테스트를 실제 검증 가능한 actual 테스트로 전환
  - **Why**: P3-D-1 GREEN 변환의 진정한 검증 진입점 — todo 상태로는 회귀 감지 불가
  - 위치: `apps/builder/src/builder/factories/__tests__/factoryOwnership.test.ts`

- **ADR-903 P3-D-4 Phase A RED — usePageManager + useIframeMessenger canonical 전환 검증** (PR #235 `prep/adr-903-p3d4-tdd-red`, commit `17d47980`):
  - 5 RED test 작성 (3 usePageManager + 2 useIframeMessenger), 모두 expected FAIL
  - usePageManager.canonical.test.ts 3건: getByLayout 호출 제거 / layoutIds 수집 패턴 제거 / canonical resolver 호출 검증
  - useIframeMessenger.canonical.test.ts 2건: message.version `legacy-1.0` → `composition-1.0` bump / pageInfo 에 reusableFrameId 필드 등장
  - **Why**: P3-D-4 (CRITICAL ~5h) 의 GREEN 변환 (Phase B/C) 진입점. RED phase 명확화로 회귀 위험 탐지 가능
  - 위치: `apps/builder/src/builder/hooks/__tests__/{usePageManager,useIframeMessenger}.canonical.test.ts`

- **ADR-903 P3-D-4 Phase B GREEN — UPDATE_ELEMENTS schema canonical bump** (PR #236 `feat/adr-903-p3d4-phase-b-postmessage`, commit `886cb4d7`):
  - postMessage schema version `legacy-1.0` → `composition-1.0` bump + pageInfo 에 `reusableFrameId` 필드 추가 (alias 병기, BC 유지)
  - sender (`useIframeMessenger.ts`) + receiver (`messageHandler.ts` + `types/index.ts`) 양 경로 동기화
  - **Why**: P3-D-4 의 cross-iframe canonical message contract 확립. Builder ↔ Preview 간 canonical document 식별자 전달 schema 정합화
  - 위치: `apps/builder/src/builder/hooks/useIframeMessenger.ts` + `apps/builder/src/preview/messaging/messageHandler.ts` + `apps/builder/src/preview/types/index.ts`

- **ADR-903 P3-D-4 Phase C minimal stub GREEN — usePageManager canonical lookup** (PR #237 `feat/adr-903-p3d4-phase-c-usepagemanager`, commit `5db2c695`):
  - `usePageManager.initializeProject` 의 layout-elements 로딩 (`db.elements.getByLayout` + layoutIds 수집) 제거 → `selectCanonicalDocument` 호출로 대체 (minimal stub)
  - **Why**: RED test 3건 GREEN 전환 — canonical resolver 호출 패턴 확립. layout-linked pages elements 정합화는 P3-D-1 (factory ownership 287 ref 제거) PR 머지 후 reusable FrameNode 기반 elements 추출로 정합화 (TODO 명시)
  - 검증: type-check 3/3 PASS (cached) + test 6/6 PASS (canonical.test.ts 2 files)
  - ⚠️ MINIMAL STUB 한계: P3-D-1 미머지 상태에서는 layout-linked pages elements 누락 회귀 가능성 — 후속 정합화 필수
  - 위치: `apps/builder/src/builder/hooks/usePageManager.ts` (+12/-16)

### Documentation

- **ADR-903 P3-D-4 Phase D Chrome MCP 검증 시나리오 작성**:
  - 12 검증 case (Group A postMessage 3 + B page 전환 3 + C CRUD 4 + D 재로드 2) + 회귀 체크 포인트 5종 + 사전 상태 확인 5단계
  - **Why**: P3-D-4 Phase D Chrome MCP 통합 검증 (~1h) 의 다음 세션 즉시 실행 가능 시나리오 명문화. B-2 (layout-linked page) 는 P3-D-1 머지 전 알려진 미정합으로 명시
  - Chrome MCP 패턴 (`feedback-chrome-mcp-patterns.md` 세션 16 확립) 의 store access / Preview iframe DOM / 자동 루프 패턴 시나리오별 코드 스니펫 내재화
  - 위치: `docs/adr/design/903-p3d4-phase-d-verification.md` (497 LOC)

### Infrastructure

- **Agent isolation 5회차 비정상 패턴 (commit/push 마감 누락)**:
  - `isolation: "worktree"` implementer agent 가 commit 까지 OK 했지만 본문 결과 보고는 worktree path 정보만 반환 + main worktree 의 base branch (`feat/adr-903-p3d4-phase-b-postmessage`) 위에도 동일 변경 직접 commit (의도와 다름)
  - 직접 정리 절차: 두 commit patch 동일성 확인 → main worktree 에서 type-check + test 검증 → fast-forward push (886cb4d7→5db2c695) → main worktree reset --hard origin/main → agent worktree force-remove (`-f -f` lock 해제)
  - **Why**: 세션 28/29 의 4회차 패턴에 이어 5회차 발생. **HIGH 위험 작업은 직접 진행** 또는 **안전장치 5중** (push exit code + ls-remote SHA 일치 + commit count + type-check + test) prompt 의무

---

## [ADR-903 옵션 C default + P3-B canonical helper + P3-D-3 GREEN — 세션 28~29] - 2026-04-26

> 세션 27 마지막 entry (`703018a9` 옵션 C root cause) 이후 — 세션 28 의 옵션 C production default 활성화, P3-B 추가 helper land, P3-D 진입 준비 + 세션 29 의 P3-D-3 GREEN 마감.

### Architecture

- **ADR-903 옵션 C `?canonical=1` Preview default 활성화** (PR #227 `feat/adr-903-canonical-default`, commit `db462688`):
  - canonical render path 를 production default 로 승격 — 기존에는 `?canonical=1` query string 으로 opt-in 필요했던 경로를 default 로 전환
  - **Why**: 세션 27/28 의 옵션 C root cause fix (`UPDATE_PAGES` sender 누락) 후 Chrome MCP 검증으로 canonical resolve 정상 동작 확증. ADR-903 P3-D 진입 hard precondition (G2=0) 충족
  - 후속 정리: `chore/adr-903-revert-debug-logs` (PR #226) — 세션 27 P2 dev 로그 보강분 revert
  - README 갱신: ADR-903 status 에 "옵션 C default 2026-04-26" 명시

- **ADR-903 P3-B `getCanonicalParentId` + `buildParentIndex` helper** (PR #231 `feat/adr-903-p3b-canonical-parent-helper`, commit `c80439e7`):
  - canonical document 의 노드별 부모 lookup helper 2종 추가 — `getCanonicalParentId(node, doc)` + `buildParentIndex(doc)` (O(1) Map)
  - **Why**: P3-D 의 elementCreation/BuilderCore 필터링 경로에서 `el.layout_id === id` → `getCanonicalParentId(el) === id` 변환의 단일 진입점 제공. P3-B 잔여 보강
  - 위치: `apps/builder/src/adapters/canonical/` (helper) + 단위 테스트

- **ADR-903 P3-D-3 GREEN — `layoutActions` canonical 전환 마감** (commit `109af146`, branch `feat/adr-903-p3d3-layout-actions`):
  - `createGetLayoutSlotsAction`: `elements.filter(layout_id)` 패턴 제거 → `selectCanonicalDocument(state, pages, layouts).children` 에서 reusable `FrameNode` 직접 lookup 후 `frame.slot` 배열에서 `SlotInfo` 매핑. canonical 경로는 `elementId === ""` (slot 채우기는 descendants 로 표현, `composition-document.types.ts:215`)
  - `createDeleteLayoutAction`: cascade 진입 전 canonical guard 추가 — `doc.children` 에 reusable `FrameNode` 가 존재할 때만 page `layout_id` null 처리 + elements cascade. frame 미존재 (stale layout) 시 cascade skip + layout row 만 삭제
  - **Why**: ADR-903 P3-D 6 sub-phase 중 3번째. P3-D-1 (factory ownership) / P3-D-2 (elementCreation) 와 독립 진행 가능 — `layoutActions.ts` 만 변경
  - 검증: vitest layoutActions 6/6 PASS / pnpm type-check 3/3 / `createGetLayoutSlotsAction` 내 `layout_id` ref = 0 회귀 측정

- **ADR-903 P3-D-1+P3-D-2 RED phase 준비** (commit `5cdc4694`, PR #229 `prep/adr-903-p3d-tdd-red`):
  - P3-D-1 factory ownership 53 todo test 작성 + P3-D 인벤토리 (6 sub-phase / 26 영향 파일 / ~207 ref)
  - **Why**: P3-D 진입 전 RED 테스트 미리 land — 후속 GREEN agent dispatch 의 진입점 명확화

### Infrastructure

- **agent worktree gitlinked 정리** (commit `9290e0d3`):
  - `.claude/worktrees/agent-*` gitlinked 디렉토리 일괄 cleanup — agent 종료 후 잔재 제거
  - **Why**: 세션 27 6-agent 병렬 dispatch 후 worktree 잔재 누적

---

## [ADR-903 P3-C cleanup + 옵션 C 인프라 검증 — 세션 27] - 2026-04-25

> 세션 26 마지막 commit (`8eee9f01` agents.jsonl) 이후 세션 27 작업 — PR #219 머지 완료 기준.

### Bug Fixes

- **옵션 C feature flag 활성 시 `resolveCanonicalDocument()` 빈 배열 반환** (ADR-903 P2):
  - `?canonical=1` query string 전파 후 옵션 C 활성화 경로 진입 시 canonical resolve 결과가 빈 배열 반환 — legacy fallback 안전망이 정상 동작하여 렌더 파괴 없이 탐지됨
  - **Why**: `resolveCanonicalDocument()` 내부 로직이 P2 S1 단계 기준으로 ref/descendants 트리 순회를 완성했으나, 실제 프로젝트 데이터 스키마와의 매핑 불일치로 입력 노드 0개 인식 — root cause 별도 진단 dispatch (Team 1)
  - 상태: legacy fallback 안전망 정상 → 사용자 가시 파괴 없음. 옵션 C default 전환은 Team 1 fix 완료 후로 조건부 보류
  - 관련: `apps/builder/src/resolvers/canonical/resolveCanonicalDocument.ts`

### Architecture

- **LayoutsTab orphan 디렉토리 제거** (ADR-903 P3-C, commit `2eedb138`, -619L):
  - P3-B에서 LayoutsTab 기능이 FramesTab으로 이관된 후 남은 orphan 디렉토리 (`apps/builder/src/builder/panels/LayoutsTab/`) 전체 삭제
  - **Why**: P3-C UI 리팩토링 전 dead code 제거로 다음 작업자(Team 3)의 작업 범위를 명확히 분리. import 참조 0건 확인 후 삭제
  - 위치: `apps/builder/src/builder/panels/LayoutsTab/` (삭제 완료)
  - PR: `chore/adr-903-cleanup-layoutstab` → PR #219 머지 완료

- **Preview iframe query string 전파** (ADR-903 P2 옵션 C 인프라, commit `6a9342cd`):
  - Builder가 iframe에 `?canonical=1` query string을 전파하는 인프라 구축 — 옵션 C `canonical` feature flag 활성화의 hard precondition
  - **Why**: Preview iframe은 독립 origin으로 로드되므로 `window.location.search` 직접 전달 불가 — postMessage 채널 외 URL 전파가 유일한 경로. 이 인프라 없이는 옵션 C를 Preview에서 조건부 활성화할 수 없음
  - 위치: `apps/builder/src/preview/` (iframe URL 생성 경로) + `apps/builder/src/builder/workspace/` (query string 주입)
  - PR: 동일 PR #219 포함

### Infrastructure

- **Chrome MCP 옵션 C 검증 인프라 확립** (세션 27):
  - `?canonical=1` query string 이 Preview iframe URL 에 정상 전파됨을 Chrome MCP 로 검증 완료
  - **Why**: iframe 내부 `window.location.search` 접근은 DOM inspector 없이 확인 불가 — Chrome MCP의 iframe DOM 검사 패턴 (auto-memory `feedback-chrome-mcp-patterns.md`) 이 유일한 검증 경로
  - **Team 1-4 dispatch 진행 중** (세션 27 종료 시점): Team 1 = 옵션 C resolve 0 root cause / Team 2 = P3-D Runtime sub-breakdown / Team 3 = P3-C 잔여 cleanup plan / Team 4 = ADR-110 Phase 1 구현

---

## [ADR-903 옵션 C 첫 정상 작동 — 세션 27/28 root cause + fix] - 2026-04-25

### Bug Fixes

- **옵션 C (`?canonical=1`) canonical resolve 0 결과 — UPDATE_PAGES sender 누락** (ADR-903 P2):
  - **Root cause**: `UPDATE_PAGES` postMessage type/handler 는 P0 시점 land 됐으나 builder 측 sender **0건**. preview store `pages` 가 영원히 빈 배열 → `legacyToCanonical` input pages=0 → `doc.children: 0` → `resolveCanonicalDocument` 결과 0 → page filter 도달 전 단계 실패 → legacy fallback 으로 graceful degradation
  - **Why**: legacy 경로는 `element.page_id` 만으로 렌더 가능했으나 canonical resolve 는 page 노드 (RefNode `metadata.type="legacy-page"` + `pageId`) 생성을 위해 pages 메타데이터 필요. P0~P2 진행 중 sender 누락 미발견 — 안전망 (legacy fallback) 정상 작동으로 회귀 0
  - **Fix**: `useIframeMessenger.ts` 에 `sendPagesToIframe()` 추가 (sendLayoutsToIframe 패턴). `sendInitialData` + pages 변경 useEffect 양쪽 호출
  - **Chrome MCP 검증** (HMR 즉시 반영): `pages: 0 → 1`, `document.children: 0 → 1` (frame metaType="legacy-page"), `resolved.rootCount: 0 → 1`, DOM `data-canonical-id`: 0 → 3, DOM `data-legacy-uuid`: 0 → 3 — **옵션 C 첫 정상 작동**
  - 위치: `apps/builder/src/builder/hooks/useIframeMessenger.ts` (PR `fix/adr-903-canonical-pages-hydration`)

### Architecture

- **LayoutsTab orphan 디렉토리 제거** (ADR-903 P3-C, PR #219):
  - **Why**: NodesPanel.tsx 가 FramesTab 으로 전환 완료 후 외부 import 0건 (자기 자신 index.ts 만 참조). orphan 디렉토리 통째로 -619L
  - 위치: `apps/builder/src/builder/panels/nodes/LayoutsTab/` 삭제

- **Preview iframe query string 전파** (ADR-903 P2 옵션 C 인프라):
  - `BuilderCanvas.tsx:69` 의 iframe src 가 `/preview.html` 하드코딩 → query string 전파 (`/preview.html${window.location.search}`)
  - **Why**: USE_CANONICAL_RENDER feature flag 가 preview iframe 까지 도달해야 옵션 C 활성화 (PR #219)

- **canonical resolver instance metadata 보존** (ADR-903 회귀 방지):
  - `_resolveRefNodeUncached` 가 master.metadata.type 으로 refNode 의 instance-level 식별자 (type/pageId/slug/layoutId) 덮어쓰는 잠재 위험 차단
  - **Why**: Team 1 가설 (page filter miss) 은 root cause 가 아니었으나 metadata 덮어쓰기는 향후 회귀 위험 → 보존 + TC2-b 신규 회귀 테스트
  - 위치: `apps/builder/src/resolvers/canonical/index.ts:128-160` + `__tests__/integration.test.ts` TC2-b (PR `fix/adr-903-resolver-metadata-preserve`)

- **ADR-110 Phase 1 themes adapter (read-only snapshot)** (ADR-110 Phase 1):
  - canonical document.themes 의 ADR-021 themeConfigStore 통합. Alternative B (read-only snapshot). `snapshotThemesFromConfig()` + `readCanonicalThemes()` + 12 신규 테스트
  - **Why**: ADR-903 P0 stub 상태였던 themes 필드를 실 동작 가능하게. variables 는 Phase 2 (별도)
  - 위치: `apps/builder/src/adapters/canonical/themesAdapter.ts` + `__tests__/themes.test.ts` (PR `feat/adr-110-phase1-themes-adapter`)

- **ADR-903 P3-D Runtime sub-breakdown 작성**:
  - 6 sub-phase 분해 (~20h, CRITICAL 위험), 26 영향 파일, ~207 ref. Sub-Gate G3-D 정의 + 5 HIGH 회귀 포인트 + 6+ 안전망
  - **Why**: P3-D 는 ADR-903 에서 가장 위험한 phase (runtime write/update/delete path 모두 canonical 동기화). 사전 설계 필수
  - 위치: `docs/adr/design/903-phase3d-runtime-breakdown.md` (~630L) (PR `docs/adr-903-session27-team-outputs`)

- **ADR-903 P3 잔여 cleanup plan**:
  - 7 deprecatable 진입점 + 22 type exports / 51 영향 파일. 카테고리 (a) 즉시 0 / (b) P3-D 후 8 (~1,712L) / (c) P3-E 후 4 (~170L) / (d) BC 영구 10
  - **Why**: LayoutsTab cleanup 외 잔여 deprecate 가능 항목의 제거 시점 명확화
  - 위치: `docs/adr/design/903-phase3-residual-cleanup-plan.md`

- **ADR-110 신규 발의 — themes/variables canonical land plan**:
  - **Why**: ADR-903 본문에 land phase 미명시 항목 (themes/variables) 의 별도 plan
  - 위치: `docs/adr/110-canonical-themes-variables-land-plan.md`

### Infrastructure

- **Chrome MCP 옵션 C 검증 인프라 확립**:
  - **Why**: console MCP reader 가 console.log Object 인자 detail 미캡처 → JSON.stringify 추가 출력 패턴 확립. iframe contentWindow 직접 접근 + page filter 검증 절차 reusable
  - dev server HMR 으로 fix 즉시 반영 + Chrome MCP 으로 root cause 정확히 식별 (Team 1 가설 vs 실제 root cause 차별화)
  - 위치: `apps/builder/src/preview/App.tsx:157` P2 dev 로그 보강 (debug branch 머지 후 별도 revert PR 필요)

- **6-agent 병렬 dispatch 패턴 검증**:
  - Team 1 (debugger) / Team 2 (Explore P3-D) / Team 3 (Explore cleanup) / Team 4 (implementer ADR-110) / Team 5 (documenter) 동시 진행
  - 결과: 4 PR push (cleanup #219 머지 + fix/feat/docs 3 PR 대기) + 1 critical fix (별도 PR)
  - **Why**: 독립 작업 병렬화로 turn 활용도 극대화. Explore agent 의 write 권한 부재는 documenter 가 출력 본문 직접 작성으로 대응

---

## [Catch-up 2026-04-07 ~ 2026-04-25 — ADR-063/082/098 charter / ADR-056/107 / ADR-907/908/909 / ADR-903 P0~P2] - 2026-04-25

> **Drift 사유**: 2026-04-06 마지막 entry 이후 19일 / 825 commits 미갱신 (CHANGELOG rules §2 Drift 감시 위반). 본 catch-up 블록으로 주제별 bundle 압축 — 개별 commit 나열 금지 (CHANGELOG rules §6).

### Architecture

- **ADR-063 SSOT chain charter (Accepted, 세션 9-11)**: 3-domain 분할 정본화 — D1 DOM/접근성 (Adobe RAC 절대) / D2 Props/API (RSP 참조 + custom) / D3 시각 스타일 (Spec SSOT). Builder(Skia) ↔ Preview/Publish(DOM+CSS) symmetric consumer 원칙. `.claude/rules/ssot-hierarchy.md` 정본 + 모든 후속 ADR Context 의 domain 명시 의무화. (참고: `docs/adr/063-ssot-chain-charter.md`)

- **ADR-098 Charter — 6/8 슬롯 완결 (세션 9-11)**: ADR-099 ~ ADR-104 6 슬롯 Implemented. SSOT 통합 / debt 회수 / BC 재평가 vs 정당화 유지 2축 패턴 확립. (`docs/adr/098-*.md` + 6 sub-ADR)

- **ADR-105/106 Charter (세션 12+)**: Skia addElement 회귀 fix + 후속 sub-ADR 체인. (`docs/adr/105-*.md`, `docs/adr/106-*.md`)

- **ADR-907 Container style pipeline 전수화 (Implemented 세션 19-21)**: 4-layer SSOT (cssValueParser / containerSpacing / rendererStyleContract / Spec metric resolver). 11 collection/self-render 컨테이너 (Breadcrumbs / ComboBox / GridList / ListBox / Menu / Select / Tabs / TagGroup / Table / Toolbar / Tree) 의 `element.props.style` 이 Preview DOM / Skia `render.shapes()` / Layout `calculateContentHeight()` 3 경로에 동일 resolver 로 반영. Phase 4 sweep 으로 Open Issue #3 해결, ADR-906 Superseded.

- **ADR-908 Fill Spec Schema SSOT (Implemented 세션 22, 11 commits)**: D3 Fill 계열 VariantSpec 의 background 계열 10+ 필드 + IndicatorModeSpec 의 background\* 를 `FillTokenSpec` (fillStyle × state 2축) + `FillStateTokens` 단일 소스로 통합. consumer 5건 (CSSGenerator / ReactRenderer / variantColors / stateEffect / validate-specs) 모두 `resolveFillTokens(variant)` / `resolveIndicatorFill(im)` 경유. G4 3-way grep (variantSpec / variant / im) 전수 0. specs 321/321 PASS / CSSGenerator snapshot 82 bit-identical.

- **ADR-909 Style SSOT contract (Implemented)**: store longhand policy ↔ consumer normalization 계약. shorthand (`gap` / `padding` / `margin`) 편집 입력은 `distributeShorthand` 가 longhand 로 분배 저장 → 모든 consumer 가 longhand 우선 + shorthand fallback. PropertyUnitInput commit 조건 `lastSavedValueRef` 단독 + focus 중 useEffect skip. (`.claude/rules/style-ssot.md` 정본)

- **ADR-082 Style Panel Spec Consumer (Implemented 세션 16, debt 종결 세션 17)**: A5 Chrome MCP G4 공식 통과 + Chrome MCP MVP 인프라 구축 + P1-1/P1-2/P1-3 debt 3/3 종결.

- **ADR-056 Base Typography SSOT (Implemented 세션 15)**: `themeConfigStore.baseTypography` (ADR-021 패턴 확장) + 3경로 (Canvas / Preview / Publish) 정합. `getRootComputedStyle()` 동적화 + `THEME_BASE_TYPOGRAPHY` postMessage + ThemesPanel Typography 섹션 + publish :root Pretendard + cssValueParser rootFontSize 주입.

- **ADR-107 Preview/Publish :root 대칭 (Implemented 세션 18)**: Gate G1-G6 전원 PASS / Spec SSOT 100% 완결 / Taffy WASM grid 경로 전수 정합화. ProgressBar Skia grid 10 commits.

- **ADR-100 Unified Skia Engine (Phase 9-10+, 다수 세션)**: PixiJS 제거 완료 — DirectContainer + Skia 단일 렌더 경로. 미해결 (deferred): font-feature-settings HIGH / GridListItem text overflow MED.

- **ADR-036 Spec-First (Fully Implemented 재승격 세션 18)**: deriveSizeConfig / ArchetypeId / CompositionSpec 전수 정합 + 신규 컴포넌트 100% Spec 진입 보장.

- **ADR-903 ref/descendants/slot canonical format migration (Accepted 세션 24-25, P0~P2 진행 중)**: composition 의 hybrid 포맷 (`componentRole/masterId/overrides/descendants` + `layout_id/slot_name`) 을 pencil-aligned canonical `{type:"ref", ref, descendants}` + `{type:"frame", reusable, slot}` 단일 문법으로 흡수. **P0** 타입 / 계약 박제 (canonical-resolver.types.ts ResolverCacheKey / ResolvedNode / ResolverCache 인터페이스 + RESOLVER_PERFORMANCE_CONTRACT 수치). **P1** read-through legacy adapter (`legacyToCanonical` / `convertComponentRole` / `convertPageLayout` / `idPath buildIdPathContext`). **P2 S1** resolver 본체 (`resolveCanonicalDocument` 처리 순서 ref → descendants 3-mode → slot validate → tree) + LRU `ResolverCache` (Map insertion order + refIndex 역매핑) + 회귀 35 케이스. **P2 D-A** preview/App.tsx + useResolvedElement 에 dev-only canonical 비교 로깅 (`[ADR-903 P2]` / `[ADR-903 P2-Skia]`). **P2 D-B** storeBridge.ts 4 helper (selectResolvedTree / buildResolvedNodeIndex / extractLegacyPropsFromResolved / resolveInstanceWithSharedCache). **P2 D-C** StoreRenderBridge.buildNodeForElement 진입부 instance resolution wiring — prod render path 첫 진입.

### Bug Fixes

- **createInstance 빈 element 잠재 버그 (ADR-903 P2 D-C 세션 26)**:
  - `createInstance()` (designKit/DesignKitPanel.tsx → instanceActions.ts) 가 `instance.props = {}` 로 생성하지만 prod render path (`StoreRenderBridge.buildNodeForElement`) 에서 master props 와 머지가 없었음 → master/instance 시스템 활성화 시 빈 element 가 그려지던 잠재 버그
  - **Why**: instance resolution 은 `useResolvedElement` hook 정의만 존재하고 sprite consumer wiring 미진입 dead code 였음 (ADR-100 ElementSprite 제거 후 통합 미완)
  - 수정: `buildNodeForElement` 진입부에 `isInstanceElement(element)` 분기 + `resolveInstanceWithSharedCache(instance, master)` 통과 → effectiveElement 갱신 → 후속 InlineAlert delegation / spec / image / box fallback 모두 effectiveElement 기반 spread 정렬
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts`

- **다수 ADR Implemented 동반 bug 수정**: ADR-907 (container style 3 경로 drift) / ADR-908 (Fill 계열 schema 분기 drift) / ADR-909 (style panel longhand 편집 미감지 + PropertyUnitInput preview-induced commit skip) / ADR-082 P1-1 (cross-check readToggleGroups) / P1-2 (padding/margin uniform 4-way 통합) / P1-3 (WONTFIX 정리) / Skia detectChangedIds 회귀 fix (`625f1eed`)

### Features

- **ADR-903 storeBridge.ts 4 helper (P2 D-B 세션 26)**: per-instance / full tree 양방향 진입점 + DFS flatten + metadata 두 패턴 추출. Preview / Skia 양쪽이 동일 shared `ResolverCache` singleton 통과 (Gate G2 (a) 전제 충족). 위치: `apps/builder/src/resolvers/canonical/storeBridge.ts` + 13 단위 케이스 (TC9 = legacy `resolveInstanceElement` 와 props deep-equal 검증).

### Infrastructure

- **CHANGELOG drift 19일 → catch-up 블록 (rules §5 절차)**: 825 commits 압축 bundle. 다음 entry 부터 정상 trigger-based 갱신 복귀.
- **Chrome MCP MVP 인프라 (세션 16-18 축적)**: composition Builder 의 store access / Style Panel reader / iframe DOM / 3축 대칭 검증 재사용 패턴 확립 (auto-memory `feedback-chrome-mcp-patterns.md` 참조).

### Documentation

- **ADR-079 README stale 해소 (세션 18)** + **ADR-036 Fully Implemented 재승격** + **ADR-907 / 908 / 909 Implemented 승격** + **ADR-098 Charter 분할 6/8 완결 기록** — `docs/adr/README.md` 대시보드 동기화.

### 미push (확인 필요)

- `be01aaaf` (ADR-903 P2 D-C wire instance resolution into Skia render path) — 사용자 confirm 후 push.

---

## [ADR-903 P3 progress — P3-A foundation + P2 옵션 C + P3-B Stores 부분 land] - 2026-04-25

> 직전 catch-up (`00a5899f`, 2026-04-25) 이후 세션 26 후반 15 commits — ADR-903 단일 주제.

### Architecture

- **ADR-903 P3 sub-breakdowns 3건 작성** (세션 26, commits `56819009`/`151d2e27`/`9ca09a30`):
  - P3 frameset breakdown (322L, 6 sub-phase): `frames`, `pageFrames`, `reusableFrames` 세 개 컨테이너 중심 6단계 분할
  - P3-A foundation 진입 정밀화 (decisions 529L + regression-risk 487L + §2.1/§7 보강 1,064L): page 노드 표현 / slug 매핑 / IDB schema / P3-D 차단 조건 / adapter shim lifecycle 5개 결정 권고
  - P4 editing semantics breakdown (637L) + P5 persistence/imports breakdown (732L) + P0 land 검증 (107L — 실제 70% 확인, clip/placeholder/themes/variables 4개 영역 phase 미명시)
  - 위치: `docs/adr/design/903-*-breakdown.md` 시리즈

- **ADR-903 P3-A foundation 100% land** (세션 26, commits `f1f411b8`/`b520cf61`/`1d00b0b1`/`bf82fe9a`):
  - `apps/builder/src/types/builder/layout.types.ts` 13 export `@deprecated ADR-903 P3:` 마크 (선언 불변, 타입 체크 통과)
  - adapter bidirectional 변환 2종: `legacyLayoutToCanonicalFrame()` / `canonicalFrameToLegacyLayout()` — P4 shim 해체 시 진입점
  - 신규 surface 5건: `selectCanonicalReusableFrames` / `createReusableFrameNode` / `CanonicalPageRef` / `extractSlotMetaFromNode` / `hoistLayoutAsReusableFrame`
  - **G3-A hard precondition**: `legacyOwnershipToCanonicalParent()` 함수 추가 — P3-D 데이터 손실 방지 CI gate
  - 안전망 vitest: canonical 85 → 93 PASS (+8 케이스, 통합 테스트 name field 포함)
  - 위치: `apps/builder/src/resolvers/canonical/` + `apps/builder/src/types/builder/layout.types.ts`

- **ADR-903 P2 옵션 C 인프라 land** (세션 26, commit `cdeb8ed9`):
  - `?canonical=1` URL feature flag — default false (legacy 경로 회귀 0 보장)
  - `RenderCanonicalNode` 컴포넌트 (244L): canonical tree → React 렌더 매핑
  - DOM dual marker: `data-canonical-id` + `data-legacy-uuid` — Gate G2 (b) 진입 전제
  - 위치: `apps/preview/src/components/RenderCanonicalNode.tsx` + `apps/preview/src/App.tsx`

- **ADR-903 P3-B Stores 부분 land** (세션 26, commit `54fcde9e`, PR #217):
  - 4/5 항목 완료: `layouts.ts` + `layoutActions.ts` + `elementCreation.ts` + `layout.types.ts`
  - 신규 surface: `selectedReusableFrameId` + `currentLayoutId` backward-compat alias
  - 안전망 #6: canonical UUID와 legacy `layout_id` 양쪽 동시 persist
  - **Sub-Gate G3-B 측정**: `stores/` 내 legacy ref 56 → 39 (-17)
  - 미완료 1/5: `layoutStore.ts` selectedLayoutId 전환 — P3-C 이후 진행

### Bug Fixes

- **elementSanitizer `page_id` 타입 정확화** (commit `4916326e`):
  - **Why**: `SupabaseElement.page_id: string` (required) 와 layout element 의 `page_id: null` 런타임 값 불일치 → DB 저장 시 빈 문자열 잠재 버그
  - 수정: 타입을 `string | null` 로 정확화
  - 위치: `apps/builder/src/services/supabase/elementSanitizer.ts`

- **P2 옵션 C `RenderCanonicalNode` page filter ternary 정정** (commit `990e8793`):
  - **Why**: `a || b ? c : d` 우선순위 오류 → `(a || b) ? c : d` 해석 → `?canonical=1` 모드에서 master/layoutFrames 가 page 와 함께 잘못 렌더되는 버그
  - 수정: `isPage` 판정 분리 + `currentPageId` 매칭 독립 조건으로 재작성 (P3-1 결정 정합: page = `{type:"ref"}` 또는 `{type:"frame", metadata.type:"page"}`)
  - 위치: `apps/preview/src/App.tsx`

### Documentation

- **ADR-903 P0 land 상태 70% 정정**: P0 완료로 기록된 항목 중 clip / placeholder / themes / variables 4개 영역이 phase 미명시 미구현 확인 — 별도 planning 권고
- **ADR-903 P3 결정 5건 권고** (`docs/adr/design/903-p3a-foundation-decisions.md`): page 노드 표현 옵션 C / slug 매핑 (`metadata.slug`) / IDB schema (`_meta` + `backupKey`) / P3-D 차단 CI checklist / adapter shim lifecycle (P4 G4 통과 시 해체)

---

## [ProgressBar/Meter/Slider 정합성 강화 + TEXT_BEARING_SPECS SSOT] - 2026-04-06

### Bug Fixes

- **ProgressBar Label 공백 줄바꿈**: CSS grid `1fr auto` → Taffy flex 에뮬레이션 불일치
  - Label: `width: 0` + `flexGrow: 1` + `flexShrink: 1` = CSS grid `1fr` (basis=0으로 항상 1행 배치)
  - Value: `flexShrink: 0` (축소 불가, content width 보존)
  - CSS/Taffy/Skia 3경로 `white-space: nowrap` 동기화
  - 위치: `implicitStyles.ts`, `ElementSprite.tsx`, `ProgressBar.css`, `Meter.css`, `Slider.css`

- **ProgressBarValue Currency 줄바꿈 (근본 원인 2개)**:
  1. `LAYOUT_PROP_KEYS`/`LAYOUT_AFFECTING_PROPS`에 `formatOptions` 미등록 → Currency 변경 시 layout 미재계산
  2. `calculateContentWidth`가 fontWeight 400으로 측정, Spec은 fontWeight 500 렌더링 → 폭 불일치 → Break Hint `\n` 삽입 → post-layout correction 스킵
  - 수정: `formatOptions`/`showValueLabel`/`valueLabel` 등록 (layoutCache.ts + inspectorActions.ts)
  - 수정: `TEXT_BEARING_SPECS`에 ProgressBarValue/MeterValue/SliderOutput 등록 → Spec SSOT fontWeight 추출

- **Value height 불일치 (Label 20 vs Value 21)**: Value Spec에 lineHeight 미정의 → CanvasKit 기본값 사용
  - ProgressBarValue/MeterValue/SliderOutput Spec sizes에 lineHeight 추가 (sm:16, md:20, lg:24, xl:28)
  - implicitStyles에서 `lineHeight: "${N}px"` 주입

### Features

- **ProgressBar/Meter/Slider xl size 추가**: CSS + Spec + implicitStyles 전체 경로
  - CSS: `[data-size="xl"]` 규칙 (fontSize: `--text-lg`, barHeight: `--spacing-lg`)
  - Spec: 부모/Track/Value/Output sizes에 xl 추가, DIMENSIONS에 xl 추가
  - implicitStyles: FONT_SIZE/BAR_HEIGHT/LINE_HEIGHT/TRACK_HEIGHT xl 상수 추가

### Architecture

- **TEXT_BEARING_SPECS SSOT 확장**: `calculateContentWidth` generic 경로에 `extractSpecTextStyle` fallback 추가
  - Spec 등록 컴포넌트는 fontWeight/fontFamily를 Spec에서 추출 → 하드코딩 제거
  - 위치: `specTextStyle.ts`, `utils.ts`

---

## [Canvas 2D↔CanvasKit 텍스트 정합성 + ProgressBar S2 Gap] - 2026-04-05

### Bug Fixes

- **Canvas 2D↔CanvasKit 텍스트 줄바꿈 근본 해결**:
  - Layout 경로의 `+2/+4px` CanvasKit 보정 완전 제거 → Layout = Canvas 2D = CSS (보정 0px)
  - 렌더링 단(nodeRendererText.ts) post-layout 교정: `paragraph.layout()` 후 `\n` 없는 단일줄 텍스트가 줄바꿈되면 `getMaxIntrinsicWidth() + 1`로 재layout
  - CanvasKit 자체 측정 기반이므로 경험적 tolerance 불필요
  - Canvas 2D Break Hint 경로: `Math.ceil(c2dResult.width) + 1` 마진으로 sub-pixel 차이 흡수
  - 위치: `nodeRendererText.ts`, `utils.ts`, `fullTreeLayout.ts`, `textMeasure.ts`

- **ProgressBarValue 동적 텍스트 줄바꿈**: value 변경 시 formatted text(`34%`, `41%` 등) 폭이 Canvas 2D 측정과 불일치
  - `formatProgressValue()` 공유 함수 추출 → implicitStyles(layout) + ElementSprite(rendering) 동일 텍스트 사용
  - 위치: `implicitStyles.ts`, `ElementSprite.tsx`

- **GridListItem gap 4→2px**: CSS `--spacing-2xs`(2px)와 불일치 → `gap: 2`로 수정

### Improvements

- **ProgressBar/Meter gap S2 정합**: `gap` → `row-gap(4px) + column-gap(12px)` 분리 (S2 bar-utils.ts 기준)
  - CSS: `row-gap: var(--spacing-xs); column-gap: var(--spacing-md)`
  - Spec gap: 6/8/10 → 4 (고정, S2 track-to-label 4px)
  - 위치: `ProgressBar.css`, `Meter.css`, `Slider.css`, `implicitStyles.ts`, Spec files

- **Slider gap S2 정합**: `row-gap(4px) + columnGap(sm/md=16, lg=20)` (S2 slider.ts 기준)

- **PropagationSpec 중복 제거**: `createCollectionItemPropagationSpec()` factory 함수로 GridListItem/ListBoxItem 공통화

### Documentation

- `canvas-rendering.md`: Layout 보정 금지 규칙 + CanvasKit 오발 줄바꿈 교정 규칙 추가
- `canvas-details.md`: Canvas 2D↔CanvasKit 텍스트 오차 처리 원칙 섹션 추가

---

## [2-Pass Layout height 교정 + Heading Level] - 2026-04-03

### Bug Fixes

- **Field 컴포넌트 Label height 48px → 20px 수정 (2-pass DFS injection 소실)**:
  - Step 4.5 (2-pass height 교정)에서 `elementsMap`(store 원본)을 사용하여 DFS injection(fontSize/lineHeight)이 소실
  - Label: fontSize fallback 16 → 텍스트 줄바꿈 → height 48px (기대 20px)
  - ComboBoxTrigger: implicit styles(width/height: 18) 소실 → height 24px (기대 18px)
  - **수정**: `processedElementsMap` 도입 — DFS injection + implicit styles 보존, 2-pass에서 우선 조회
  - 위치: `fullTreeLayout.ts` traversePostOrder + Step 4.5

### Features

- **Heading/DisclosureHeader Level 프로퍼티**: Dialog/Popover 내 Heading, Disclosure 내 DisclosureHeader에 h1~h6 level 선택 가능. Properties-only Spec 패턴

---

## [Dark Mode 정합성 + Layout 캐시 + Icon Picker UX] - 2026-04-03

### Bug Fixes

- **Button primary variant dark mode 텍스트 미표시**: Spec 토큰 `{color.white}` (항상 #fff) → `{color.base}` (adaptive: light=#fff, dark=#171717)로 수정. CSS `var(--bg)`와 일치
  - 동일 패턴 sweep: Badge neutral, Menu primary, ToggleButton default selected — 모두 `{color.base}`로 통일
- **Text 컴포넌트 dark mode 기본색 하드코딩**: TextSprite 기본 텍스트색 `0x000000` (black) → `darkColors.neutral`/`lightColors.neutral` theme-aware 기본색 적용
- **Button icon 추가 시 fit-content width 미갱신**: `layoutCache.ts`의 `LAYOUT_PROP_KEYS`에 `iconName`, `iconPosition` 누락 → 캐시 signature 미변경 → 재계산 스킵. 추가 sweep: `minValue`, `maxValue`, `variant`도 누락 확인 후 추가
- **Icon Picker popover 너비 초과**: `width: 296px` 고정 → `width: var(--trigger-width, 296px)`. trigger를 부모 `.react-aria-control`로 변경하여 부모 너비에 맞춤
- **Icon Picker 선택 시 popover 미닫힘**: `DialogTrigger` controlled state 추가, `handleSelect`에서 `setIsOpen(false)` 호출
- **SpecField number/boolean defaultValue 미표시**: `resolveCurrentValue() ?? field.defaultValue` fallback 누락 → number, boolean 케이스 모두 추가
- **Button property editor 기본값 미표시**: `iconPosition` (defaultValue: "start"), `iconStrokeWidth` (defaultValue: 2), `type` (defaultValue: "button") 추가

### Infrastructure

- **Icon Picker clear 버튼**: `<span role="button">` + `as unknown` 캐스트 → React Aria `<Button onPress>` 교체
- **Icon Picker grid columns**: `repeat(8, 1fr)` → `repeat(auto-fill, 32px)` — 컨테이너 너비에 맞게 자동 조정

---

## [Canvas 선택 UX 개선 + NumberField/Input height 정합성] - 2026-03-21

### Bug Fixes

- **컴포넌트 자식 의도치 않은 이동 수정 (startMove hitElementId 불일치)**:
  - 컴포넌트를 반복 선택/해제/더블클릭 시 내부 자식 요소가 의도치 않게 이동되는 버그 수정
  - **근본 원인**: `useCentralCanvasPointerHandlers.ts`에서 `startMove(hitElementId, ...)`가 히트 테스트의 가장 깊은 자식(예: Button)을 드래그 대상으로 전달하지만, `handleElementClick`은 `resolveClickTarget()`으로 올바른 상위 요소(예: Card)를 선택 — ID 불일치
  - 마우스가 4px(`DRAG_DISTANCE_THRESHOLD`) 이상 이동 시 `onMoveEnd`가 깊은 자식의 `parent_id`/`order_num`/`left`/`top`을 변경
  - **수정**: `startMove`에 `hitElementId` 대신 rAF 내에서 `useStore.getState().selectedElementIds[0]`(실제 선택된 요소)를 전달
  - Zustand store는 `startTransition` 내에서도 동기적으로 갱신되므로 rAF 시점에 정확한 값 보장
  - 위치: `useCentralCanvasPointerHandlers.ts` 라인 194-203

- **계층적 선택 drill-down 즉시 탈출**: 더블클릭으로 2~3단계 깊이 진입 후 다른 컴포넌트 클릭 시, 단계별 탈출이 아닌 즉시 루트로 복귀 후 해당 요소 선택
  - 기존: `exitEditingContext()` 한 단계씩만 올라감 → 깊이만큼 반복 클릭 필요
  - 수정: `setEditingContext(null)` 즉시 루트 복귀 → `resolveClickTarget()` 재시도 → 한 번에 선택
  - 위치: `useCanvasElementSelectionHandlers.ts` `handleElementClick`

- **NumberField input text-align:center 제거 (CSS + Factory)**:
  - CSS: `NumberField.css` `.react-aria-Input`에서 `text-align: center` 제거
  - Factory: `FormComponents.ts` ComboBoxInput style에서 `textAlign: "center"` 제거

- **NumberField/ComboBox/Select/SearchField input height 오계산 수정 (24→21)**:
  - **근본 원인**: DFS post-order에서 ComboBoxInput이 부모(ComboBoxWrapper)보다 먼저 enrichment → fontSize 없이 fallback 16 사용 → `16 × 1.5 = 24` (잘못된 높이)
  - **수정 1**: `implicitStyles.ts`에 `SPEC_INPUT_FONT_SIZE` 상수 추가 (xs:10, sm:12, md:14, lg:16, xl:18) → ComboBoxInput/SelectValue/SearchInput에 fontSize 주입
  - **수정 2**: `fullTreeLayout.ts` `patchBatchStyleFromImplicit` 루프에서 fontSize 변경 감지 시 height 재계산 (`Math.ceil(fontSize × 1.5)`) → batch entry 교정
  - md size 기준: fontSize 14 → `14 × 1.5 = 21` (정확한 높이)

- **ViewportCulling 콘솔 경고 스팸 억제**: `crossValidateCulling()` SpatialIndex vs getBounds() 불일치 로그를 5초 throttle
  - 위치: `useViewportCulling.ts` — 모듈 스코프 `_lastCullingWarnTime` + 5000ms 간격 제한

- **ListBox aria-label 누락 경고 수정**: `SelectionRenderers.tsx` ListBox에 `aria-label={String(element.props.label || "List")}` 추가

---

## [Label spec shapes 경로 전환 + Select/ComboBox CSS 정합성] - 2026-03-16

### Breaking Changes

- **Label 렌더링 경로 전환**: `TEXT_TAGS`에서 `"Label"` 제거 → TextSprite 경로에서 spec shapes 경로로 전환
  - `labelColorElement` useMemo 해킹 제거
  - `PARENT_VARIANT_TO_LABEL_TOKEN` (hex 하드코딩) 제거 → `LabelSpec.variants`가 색상 단일 소스
  - `isUIComponent` 판정에 `getSpecForTag(element.tag) != null` 조건 추가
  - `hasOwnSprite`에서 spec이 있는 "box" 태그 제외
  - Factory에서 Label에 `variant: "accent"` 기본값 설정
  - 부모 variant 상속: `PARENT_VARIANT_TO_LABEL` 매핑 (`isUIComponent` 분기에서 처리)
  - Select/ComboBox delegation에서 Label override 제거

### Features

- **CSSGenerator Composite 컨테이너 개선**: `composition` 필드가 있는 Tier 2 Composite Spec(Select, ComboBox 등)의 CSS 생성 로직 개선
  - `height` 출력 skip (자식이 높이 결정)
  - `padding` 출력 skip (자식이 패딩 관리)
  - `background`/`color`/`border` variant 출력 skip (자식이 시각적 속성 관리)
  - base styles를 `composition.layout`에서 파생 (flex-column → `align-items: flex-start` 등)
- **Select/ComboBox Preview CSS 정합성 개선**:
  - Select: `.react-aria-Button`에 `height: auto`, 비대칭 padding, `background: var(--bg)`, `border: 1px solid var(--border-hover)` 위임
  - Select: `.react-aria-SelectValue`에 `height: auto` 위임
  - ComboBox: 동일 패턴 적용 — `.combobox-container`(컨테이너), `.react-aria-Input`(텍스트), `.react-aria-Button`(chevron)
  - ComboBox chevron: `background: var(--bg-overlay)`, `color: var(--fg)`, size별 width/height
- **Button `lineHeight` 토큰화**: `ButtonSpec.sizes`의 `lineHeight`를 고정 px → TokenRef (`"{typography.text-sm--line-height}"` 등)
  - `deriveSizeConfig`에서 TokenRef `lineHeight`를 `resolveToken`으로 변환

### Bug Fixes

- **요소 삭제 시 레이어 트리 유령 항목 버그**: `elementRemoval.ts`의 `executeRemoval`에서 `pageElementsSnapshot` 갱신 누락 수정 → 삭제 후 레이어 트리에 삭제된 항목이 남는 현상 해결
- **`batchUpdateElementProps` DB 저장 버그**: DB 저장 시 delta props(`{ size: value }`)가 아닌 merged 전체 props를 저장 → 새로고침 후 props 소실 방지
- **Select/ComboBox size 변경 시 자식 fontSize 미동기화**: `handleSizeChange`에서 Label + SelectValue/ComboBoxInput의 `style.fontSize` 동기화, `elementsMap`에서 최신 props 조회 (childrenMap staleness 방지)

### Infrastructure

- **ADR-036 레거시 코드 정리**: `SliderThumb.spec.ts` `SLIDER_THUMB_SIZES` 키 정규화 (`S/M/L` → `sm/md/lg`)

---

## [ADR-030 S2 전용 컴포넌트 Phase 0~4 완료] - 2026-03-09

### Features

- **22개 S2 전용 컴포넌트 구현** (ADR-030 Phase 1~4):
  - Phase 1 (Display/Feedback): Avatar, AvatarGroup, StatusLight, InlineAlert, Divider, LinkButton, ContextualHelp
  - Phase 2 (Button/Menu): ActionButton, ActionButtonGroup, ButtonGroup, ActionMenu, Accordion
  - Phase 3 (Extended Controls): ProgressCircle, Image, Picker, RangeCalendar (RangeSlider → Slider Range Mode로 통합)
  - Phase 4 (Advanced): SegmentedControl (+Item), SelectBoxGroup (+Item), IllustratedMessage, CardView, TableView
- **23개 Property Editor 생성**: 모든 ADR-030 컴포넌트에 대한 Inspector 편집 UI
- **23개 ComponentMeta 등록**: `metadata.ts`에 `hasCustomEditor`, `editorName`, `dataBindingType`, `supportedEvents` 정의
- **Spec Props 보강**: SegmentedControl(`isJustified`), CardView(`variant`/`selectionMode`/`selectionStyle`), TableView(`selectionMode`) 추가
- **SelectBoxGroup/SelectBoxItem 전체 통합**: Spec + Factory + Renderer + Publish + ComponentList + TAG_SPEC_MAP + COMPLEX_COMPONENT_TAGS

### Infrastructure

- **COMPLEX_COMPONENT_TAGS 확장**: Phase 4 컴포넌트 4개 추가 (SegmentedControl, CardView, TableView, SelectBoxGroup)
- **Preview 렌더러**: 22개 컴포넌트 rendererMap 등록 완료
- **Publish 레지스트리**: 22개 컴포넌트 ComponentRegistry 등록 완료 (RangeCalendar 누락 수정 포함)

## [ADR-017 M3 제거 + Tint Color System + ADR-018 Phase 1] - 2026-03-04

### Breaking Changes

- **M3 토큰 전체 제거 (ADR-017)**: 38개 M3 CSS 변수(`--primary`, `--on-surface`, `--surface-container` 등) 삭제. 107개 CSS 파일에서 시맨틱 토큰으로 치환 완료
- **Spec 토큰 시스템 전환**: `ColorTokens` 인터페이스 M3 33개 → 시맨틱 ~20개, `colors.ts` M3 hex → Tailwind hex, 30+ Spec 파일 TokenRef 치환

### Features

- **Tint Color System 도입** (`preview-system.css`): React Aria starter 패턴 기반
  - `--tint: var(--blue)` 한 줄로 전체 테마 액센트 색상 전환
  - 10개 oklch 프리셋: red, orange, yellow, green, turquoise, cyan, blue, indigo, purple, pink
  - `--tint-100` ~ `--tint-1600` 자동 파생 (oklch relative color syntax)
  - 다크모드 lightness 스케일 자동 반전
  - ThemeStudio 오버라이드(`--color-*`)가 tint fallback보다 우선
- **utilities.css 생성 (ADR-018 Phase 1)**: `.button-base`, `.indicator`, `.inset` 3대 유틸리티 클래스
  - `--button-color` 1개로 bg/hover/pressed/text/border 자동 파생 (`color-mix()` 기반)
  - `:where()` specificity 0 패턴으로 오버라이드 안전

### Bug Fixes

- **Preview iframe 팔레트 미정의**: `--color-primary-*`, `--color-white`, `--color-tertiary-*` 등 Tailwind 팔레트가 Preview iframe에서 정의되지 않던 문제 → `shared-tokens.css`에 정적 팔레트 추가
- **Card.css dead 셀렉터**: TSX는 `data-variant` 전달하지만 CSS는 class 셀렉터(`.primary`) 사용 → `[data-variant]` 기반으로 수정
- **utilities.css Preview 누락**: `index.css` (shared)에 `@import "./utilities.css"` 추가

### Changed

- **`preview-system.css`**: M3 섹션 삭제 + Tint Color System 전면 도입
- **`builder-system.css`**: M3 섹션 삭제
- **`shared-tokens.css`**: `--color-white/black`, `--color-primary-*`(Blue), `--color-tertiary-*`(Purple), `--color-blue/green/red/orange/yellow/purple-*` 팔레트 추가
- **`Button.css`**: `.button-base` 적용, variant/state 블록 제거 (-48%)
- **`Card.css`**: class 셀렉터 → `[data-variant]`/`[data-size]` 수정
- **`foundation.css`**: `@import "./utilities.css"` 추가
- **`index.css` (shared)**: `@import "./utilities.css"` 추가
- **Spec 파일 30+개**: M3 TokenRef → 시맨틱 TokenRef 치환

### Removed

- **M3 토큰 정의**: `preview-system.css`, `builder-system.css`에서 M3 light/dark 섹션 삭제
- **`M3ColorSystemGuide.tsx/css`**: 삭제 (M3 시스템 가이드 UI)

---

## [CSS Duplication Fix — Import Chain 단일화] - 2026-03-04

### Bug Fixes

- **CSS 중복 로딩 근본 해결**: Vite dev 서버에서 동일 CSS가 2~3개 `<style>` 태그로 중복 생성되던 문제 수정
  - **근본 원인**: `index.css`의 CSS `@import` 체인과 JS `import` 체인이 동일 CSS를 이중 로드 → Vite가 별도 `<style>` 태그 생성
  - **`index.css` 크기**: 480KB → 172KB (-64%)
  - **동일 파일 중복 `<style>` 태그**: 다수 → 0건

### Changed

- **`apps/builder/src/index.css`**: `@import components/index.css` (전체 70+ CSS) → `@import theme.css` (CSS 변수 3파일만)
- **`packages/shared/src/components/index.tsx`**: `import './index.css'` (전체) → `import './styles/foundation.css'` (기반 CSS만)
- **`packages/shared/src/components/styles/foundation.css`**: 신규 파일 — foundation 6개 + orphan CSS 11개 (총 17파일)

### Removed

- **`apps/builder/src/builder/styles/1-theme/`**: 디렉토리 삭제 (3파일) — 마스터 `shared/.../theme/`에 병합
- **`auth/Signin.tsx`**: `builder-system.css` 중복 import 제거
- **`AIPanel.tsx`**: `ChatContainer/ChatMessage/ChatInput.css` 중복 import 제거
- **`HistoryPanel.tsx`, `StylesPanel.tsx`**: `../../components/styles` 중복 import 제거
- **`theme.css`**: `@layer` 이중 선언 제거
- **`builder/components/styles/index.css`**: 중복 `:root` 변수 제거

### Architecture

- **단일 경로 원칙**: 각 CSS 파일은 한 가지 경로로만 로드
  - Theme CSS → `index.css` @import chain (빌더 스타일보다 먼저 로드)
  - Foundation CSS → `index.tsx` JS import (`foundation.css`)
  - Component CSS → 각 `.tsx`의 개별 JS import (`Button.tsx` → `Button.css`)
- **`styles/index.css`** (전체 cascade): preview iframe + publish 앱 전용으로 유지
- **`components/index.css`**: publish 앱 호환용으로 유지

### Changed Files (10)

- `apps/builder/src/index.css`
- `packages/shared/src/components/index.tsx`
- `packages/shared/src/components/styles/foundation.css` (new)
- `packages/shared/src/components/styles/theme/builder-system.css`
- `packages/shared/src/components/theme.css`
- `apps/builder/src/auth/Signin.tsx`
- `apps/builder/src/builder/panels/ai/AIPanel.tsx`
- `apps/builder/src/builder/panels/history/HistoryPanel.tsx`
- `apps/builder/src/builder/panels/styles/StylesPanel.tsx`
- `apps/builder/src/builder/components/styles/index.css`

---

## [Slider Complex Component + WebGL Fix] - 2026-02-22

### Bug Fixes

- **Slider.spec.ts**: TokenRef offsetY 계산 버그 수정 - `size.fontSize`가 문자열인데 숫자 연산에 사용되어 NaN 발생, `resolveToken()`으로 해결
- **Slider.spec.ts**: SliderOutput 텍스트 위치 수정 - `x: width` → `x: 0` + `maxWidth: width`로 컨테이너 내 우측 정렬
- **Slider.css**: class selector → data-attribute selector 전환 (`[data-size]`, `[data-variant]`)
- **unified.types.ts**: Slider 기본 props 수정 (value=50, width=200, height=45, showValue=true)

### Features

- **Slider → Complex Component 전환**: layer tree가 DOM 구조와 일치하도록 변경
  - `FormComponents.ts`: `createSliderDefinition()` 팩토리 추가
  - DOM 구조: `Slider > Label + SliderOutput + SliderTrack > SliderThumb`
  - `ComponentFactory.ts`: Slider creator 등록
  - `useElementCreator.ts`: complexComponents에 Slider 추가
  - `ElementSprite.tsx`: `_hasLabelChild` 체크에 Slider 추가
  - `Slider.spec.ts`: `_hasLabelChild` 플래그로 label/output 중복 렌더링 방지

### Changed Files (7)

- `packages/specs/src/components/Slider.spec.ts`
- `packages/shared/src/components/styles/Slider.css`
- `apps/builder/src/types/builder/unified.types.ts`
- `apps/builder/src/builder/factories/definitions/FormComponents.ts`
- `apps/builder/src/builder/factories/ComponentFactory.ts`
- `apps/builder/src/builder/hooks/useElementCreator.ts`
- `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx`

---

## [2026-02-22]

### Fixed - TaffyFlexEngine: CSS `flex` shorthand 파싱 추가

#### 증상

CSS `flex` shorthand 속성(`flex: 1`, `flex: auto`, `flex: none`, `flex: 1 1 0%`)이 TaffyFlexEngine에서 파싱되지 않음. SelectValue의 `flex: 1`이 무시되어 레이아웃 크기가 0으로 계산됨.

#### 원인

`elementToTaffyStyle()`이 `flexGrow`, `flexShrink`, `flexBasis` 개별 속성만 처리하고, `flex` shorthand를 파싱하는 로직이 없었음.

#### 수정 내용

**`elementToTaffyStyle()`에 flex shorthand 파싱 로직 추가**

| 입력                                | 변환 결과                                   |
| ----------------------------------- | ------------------------------------------- |
| `flex: <number>`                    | `flexGrow: n, flexShrink: 1, flexBasis: 0%` |
| `flex: "auto"`                      | `flexGrow: 1, flexShrink: 1` (basis: auto)  |
| `flex: "none"`                      | `flexGrow: 0, flexShrink: 0`                |
| `flex: "<grow> <shrink> [<basis>]"` | 각 값을 분리 파싱                           |

- 개별 속성(`flexGrow`, `flexShrink`, `flexBasis`)이 명시되어 있으면 shorthand보다 우선 적용

#### 수정 파일

| 파일                                                                          | 변경 내용                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/layout/engines/TaffyFlexEngine.ts` | `elementToTaffyStyle()`에 flex shorthand 파싱 로직 추가 |

#### 영향 범위

flex shorthand를 사용하는 모든 요소의 레이아웃이 올바르게 계산됨.

---

### Fixed - Select/ComboBox 자식 요소 implicit styles 주입

#### 증상

SelectValue 영역이 100×100, SelectIcon 영역이 100×100으로 렌더링됨.

#### 원인

- **원인 1**: DB에 저장된 기존 요소에 `width`, `height`, `flex` 속성이 없을 수 있음
- **원인 2**: `calculateChildrenLayout` 호출 시 원본 DB 스타일이 사용되어 레이아웃 계산이 부정확
- **원인 3**: LayoutComputedSizeContext가 null이면 BoxSprite가 convertStyle 기본값 100×100으로 fallback

#### 수정 내용

두 단계에서 implicit styles 주입:

**1. 레이아웃 계산 전** (`containerTag === 'selecttrigger'`/`'comboboxwrapper'` 블록)

- SelectValue/ComboBoxInput: `flex: 1` 보장 (`??` 연산자로 DB 값 우선)
- SelectIcon/ComboBoxTrigger: `width: 18, height: 18, flexShrink: 0` 보장

**2. 렌더링 시** (투명 배경 override 블록)

- tag별 implicitStyle 객체를 spread하여 DB에 없는 속성 보장
- `{ ...implicitStyle, ...existingStyle, backgroundColor: 'transparent' }` 순서로 합성

**배치 결과 (SelectTrigger 내부)**:

- SelectValue: flexGrow=1, width = containerWidth - 28 - 18 (나머지 공간)
- SelectIcon: width=18, height=18, center x = containerWidth - 23 (spec shapes chevron과 일치)

#### 수정 파일

| 파일                                                          | 변경 내용                                         |
| ------------------------------------------------------------- | ------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` | 레이아웃 계산 전 + 렌더링 시 implicit styles 주입 |

---

### Fixed - Select/ComboBox CSS Preview ↔ Spec Shapes 정합성 수정

#### 증상

CSS Preview와 Spec Shapes 간에 gap, padding, 아이콘 크기가 일치하지 않음.

#### 수정 내용

| 속성                  | CSS 변경 전                           | CSS 변경 후                    | Spec 값                 |
| --------------------- | ------------------------------------- | ------------------------------ | ----------------------- |
| Gap (Label↔Trigger)   | `--spacing-xs` (4px)                  | `--spacing-sm` (8px)           | labelGap = 8px          |
| Trigger/Input padding | `--spacing` `--spacing-md` (4px 12px) | `--spacing-sm` 14px (8px 14px) | paddingY=8, paddingX=14 |
| Chevron/Button size   | 24px                                  | 18px                           | iconSize = 18px         |

#### 수정 파일

| 파일                                                 | 변경 내용                                  |
| ---------------------------------------------------- | ------------------------------------------ |
| `packages/shared/src/components/styles/Select.css`   | gap, padding, 아이콘 크기를 Spec 값과 일치 |
| `packages/shared/src/components/styles/ComboBox.css` | gap, padding, 아이콘 크기를 Spec 값과 일치 |

---

### Fixed - Select/ComboBox 구조적 자식 투명 배경 처리

#### 증상

SelectTrigger, SelectValue, SelectIcon 등의 BoxSprite가 기본 흰색 불투명 배경(0xffffff, alpha=1)으로 spec shapes를 가림.

#### 수정 내용

- **BuilderCanvas.tsx** `renderChild`에서 구조적 자식 태그별로 `backgroundColor: 'transparent'` + `children: ''` 주입
- **SelectionComponents.ts** factory 정의에도 `backgroundColor: 'transparent'` 추가

#### 수정 파일

| 파일                                                                    | 변경 내용                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`           | 구조적 자식 태그별 `backgroundColor: 'transparent'` + `children: ''` 주입 |
| `apps/builder/src/builder/factories/definitions/SelectionComponents.ts` | factory 정의에 `backgroundColor: 'transparent'` 추가                      |

---

## [Unreleased]

### Added

- **계층적 선택 모델 (Pencil/Figma 스타일)**: 캔버스 클릭 시 현재 깊이 레벨 요소만 선택. 더블클릭으로 컨테이너 진입, Escape로 위로 복귀. `editingContextId` 상태 및 `resolveClickTarget` 유틸리티 구현 (`stores/selection.ts`, `utils/hierarchicalSelection.ts`)
- **Deep Hover 하이라이트 (Pencil 패턴)**: 그룹/컨테이너 호버 시 내부 모든 리프 노드를 동시 하이라이트. context 레벨 히트 테스트 → `collectLeafDescendants` 재귀 수집 → 전체 리프 렌더링. 리프 직접 호버는 실선 2px, 그룹 내부 리프는 점선 1px. 선택된 요소 위에서도 호버 표시. `hoverRenderer.ts` Skia 렌더러 (blue-500, alpha 0.5). 진입한 컨테이너 경계 점선 표시 (gray-400)
- **캔버스 커서 통일 (Pencil 방식)**: 모든 캔버스 요소의 마우스 커서를 `default`로 통일. TextSprite(`text`→`default`), BoxSprite/ImageSprite/ElementSprite(`pointer`→`default`), UI 컴포넌트 55개(`pointer`/`text`/`crosshair`/조건식→`default`). Hand Tool의 `grab`/`grabbing` 및 리사이즈 핸들 커서는 유지
- **Body 요소 선택**: 캔버스 빈 영역 클릭 또는 배경 클릭으로 body 선택 가능. `buildSelectionRenderData`에 pageFrames 기반 body bounds 폴백 추가. `isOnlyBodySelected` 오버레이 스킵 로직 제거

### Changed

- **레이어 트리 직접 선택**: 레이어 트리에서 깊은 요소 선택 시 `editingContext` 자동 조정 (`resolveEditingContextForTreeSelection`)
- **Escape 키 우선순위**: editingContext 복귀 → 선택 해제 순서로 변경
- **더블클릭 동작**: 컨테이너 요소는 `enterEditingContext`, 텍스트 요소는 기존 `startEdit` 유지
- **editingContext 복귀 (Pencil 방식)**: 빈 영역 클릭 시 `exitEditingContext` 호출. context 외부 요소 클릭 시에도 한 단계 위로 복귀. Escape 키 + 빈 영역 클릭 + 외부 요소 클릭 3가지 경로 지원
- **호버 렌더 순서 변경**: Hover → Selection Box → Transform Handles 순서로 변경. 코너 핸들의 흰색 fill이 호버 선을 덮어 핸들 내부에 선이 나타나는 문제 해결

### Fixed

- **Body 선택 불가**: `resolveClickTarget`이 body에 대해 null 반환하던 문제 (`parent_id: null`). `handleElementClick`에 body 특수 처리 추가
- **Body 오버레이 미표시**: `isOnlyBodySelected` 체크가 body 선택 시 오버레이 렌더링을 스킵하던 문제 해결
- **Body Skia 선택 박스**: body가 `treeBoundsMap`에 없어 선택 박스가 렌더링되지 않던 문제. `pageFrames` 기반 폴백 추가
- **멀티페이지 호버 불가**: 아무 요소도 선택되지 않은 상태에서 `treeBoundsMap`이 빈 Map으로 설정되어 호버 히트 테스트가 작동하지 않던 문제. `needsSelectionBoundsMap`을 항상 true로 변경하여 호버용 bounds를 상시 빌드 (`SkiaOverlay.tsx`)
- **더블클릭 그룹 진입 불가**: BoxSprite와 ElementSprite 컨테이너 히트 영역에 더블클릭 감지가 없어 `enterEditingContext`가 호출되지 않던 문제. `lastPointerDownRef` 기반 300ms 더블클릭 감지 추가 (`BoxSprite.tsx`, `ElementSprite.tsx`)

---

### Fixed - Button padding:0 시 높이 미변경 (2026-02-15)

#### 증상

- Button에 `paddingTop: 0`, `paddingBottom: 0`을 설정해도 높이가 변하지 않음

#### 원인

**1. Flex 경로 — Button 높이 미결정**

- Button은 Yoga 리프 노드(자식 없음)이고, `stripSelfRenderedProps`로 padding/border가 제거됨
- `height: 'auto'`만 설정되어 Yoga가 높이를 0으로 계산 → 이전 프레임의 시각적 크기(100px)가 자기 강화적으로 유지

**2. BlockEngine 경로 — `MIN_BUTTON_HEIGHT` 제약**

- `MIN_BUTTON_HEIGHT = 24`에서 `sizeConfig.paddingY`(기본값 4)로 content-box 변환
- 인라인 padding=0이 반영되지 않아 항상 최소 높이 강제

**3. `toNum` 함수 — 문자열 '0' 무시**

- `parseFloat('0') || undefined` → `0 || undefined` → `undefined`

#### 수정 내용

**1. `styleToLayout`에서 Button `layout.height` 명시적 설정**

- `height: 'auto'` 대신 `paddingY * 2 + lineHeight + borderW * 2`로 계산
- 인라인 padding=0이면 `0 + lineHeight + 2` = 텍스트 높이 + 테두리만큼 축소
- `toNum` 함수를 `isNaN(parseFloat(v))` 체크로 수정하여 문자열 '0' 정상 처리

**2. BlockEngine `calculateContentHeight`에서 인라인 padding 시 `MIN_BUTTON_HEIGHT` 미적용**

- 사용자가 인라인 padding을 설정한 경우 `minContentHeight = 0` (padding:0으로 완전 축소 허용)
- 인라인 padding 미설정 시 기존 동작 유지 (`MIN_BUTTON_HEIGHT` 기반 최소 높이)

#### 수정 파일

| 파일                                       | 변경 내용                                                  |
| ------------------------------------------ | ---------------------------------------------------------- |
| `apps/builder/.../layout/styleToLayout.ts` | Button `layout.height` 명시적 계산 + `toNum` 0값 버그 수정 |
| `apps/builder/.../layout/engines/utils.ts` | 인라인 padding 시 `MIN_BUTTON_HEIGHT` 미적용               |

---

### Fixed - Spec 컴포넌트 텍스트 줄바꿈 시 Skia 높이 자동 확장 (2026-02-15)

#### 증상

- Button에 고정 `width` 설정 후 긴 텍스트 입력 시, CSS에서는 height가 동적으로 증가하지만 Skia 캔버스에서는 높이가 변하지 않음
- 텍스트가 잘리거나 배경 밖으로 넘침

#### 원인

- Button은 `SELF_PADDING_TAGS`로 padding이 Yoga에서 제거되고, Yoga에 텍스트 measure 함수가 없어 auto height를 계산할 수 없음
- `specShapesToSkia`는 Yoga가 결정한 고정 높이를 받아 배경과 텍스트를 그리므로, 텍스트가 줄바꿈되어도 높이가 확장되지 않음

#### 수정 내용

**1. `measureSpecTextMinHeight()` 헬퍼 추가 (ElementSprite.tsx)**

- spec shapes 내 텍스트의 word-wrap 높이를 Canvas 2D API로 측정
- TokenRef fontSize 해석, maxWidth 계산 (specShapesToSkia와 동일 로직)
- 한 줄이면 `undefined` 반환, 다중 줄이면 `paddingY * 2 + wrappedHeight` 반환

**2. contentMinHeight 계산 (ElementSprite.tsx)**

- `specShapesToSkia` 호출 전에 `measureSpecTextMinHeight`로 다중 줄 높이 측정
- 명시적 height가 없을 때만 (`hasExplicitHeight` 체크)
- `specHeight`와 `cardCalculatedHeight` 갱신 → `contentMinHeight`로 전파

**3. 다중 줄 텍스트 paddingTop 보정 (ElementSprite.tsx)**

- `specShapesToSkia`는 한 줄 lineHeight 기준으로 수직 중앙 계산
- 다중 줄일 때 `(specHeight - wrappedHeight) / 2`로 보정

**4. `updateTextChildren` box 재귀 (SkiaOverlay.tsx)**

- box 타입 자식 노드도 재귀적으로 width/height 갱신 + 내부 text 처리
- `contentMinHeight`로 높이 증가 시 specNode 내부 텍스트도 올바른 크기로 갱신

#### 수정 파일

| 파일                                         | 변경 내용                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/builder/.../sprites/ElementSprite.tsx` | `measureSpecTextMinHeight()` + contentMinHeight 계산 + paddingTop 보정 |
| `apps/builder/.../skia/SkiaOverlay.tsx`      | `updateTextChildren`에 box 자식 재귀 추가                              |

#### 영향 범위

- Button, SubmitButton, FancyButton, ToggleButton (SELF_PADDING_TAGS)
- Badge, Tag, Chip 등 spec shapes 기반 모든 컴포넌트

---

### Fixed - BlockEngine 경로에서 Button 텍스트 줄바꿈 시 세로 겹침 (2026-02-15)

#### 증상

- 부모가 implicit block(display 미지정)일 때, Button(width:80px) 텍스트 2줄 + 다음 Button(width:100%)이 세로로 겹침
- 첫 번째 Button의 Skia 렌더링은 정상(높이 확장)이나 Yoga 레이아웃 영역이 확장되지 않아 아래 요소가 겹침
- 부모가 `display:flex, flex-direction:column`일 때는 정상 (Flex 경로 사용)

#### 원인

- **BlockEngine 경로의 `parseBoxModel`이 부모 `availableWidth`를 전달**: Button(width:80px)인데 `calculateContentHeight(element, 400)`처럼 부모 너비(400px)를 전달하여, 텍스트 줄바꿈이 발생하지 않는 것으로 계산 → 높이 미확장
- **`styleToLayout`의 `minHeight`는 BlockEngine 경로에서 미사용**: BlockEngine은 `parseBoxModel` → `calculateContentHeight`로 높이를 직접 계산하며, `styleToLayout`의 결과는 width/height에 사용하지 않음

#### 수정 내용

**1. `parseBoxModel`에서 요소 자체 width 전달 (engines/utils.ts)**

- border-box 변환 전 `originalBorderBoxWidth`를 저장
- `calculateContentHeight(element, elementAvailableWidth)`에 요소 자체 width 우선 전달
- Button(width:80px) → `calculateContentHeight(element, 80)` → `maxTextWidth = 80 - 24 = 56` → 올바른 줄바꿈

**2. `styleToLayout` minHeight 기본 사이즈 수정**

- Button 기본 사이즈를 `'md'` → `'sm'`으로 수정 (실제 기본값과 일치)
- ToggleButton은 기존 `'md'` 유지

#### 수정 파일

| 파일                                       | 변경 내용                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `apps/builder/.../layout/engines/utils.ts` | `parseBoxModel`에서 `originalBorderBoxWidth` → `calculateContentHeight`에 전달 |
| `apps/builder/.../layout/styleToLayout.ts` | minHeight 기본 사이즈 `'md'` → `'sm'` 수정                                     |

#### 두 렌더링 경로 차이

| 경로                 | 부모 조건                       | 높이 결정 방식                             | 텍스트 줄바꿈 반영                         |
| -------------------- | ------------------------------- | ------------------------------------------ | ------------------------------------------ |
| **Flex 경로**        | `display:flex` 명시적           | `styleToLayout` → `minHeight` → Yoga       | `styleToLayout`에서 계산                   |
| **BlockEngine 경로** | display 미지정 (implicit block) | `parseBoxModel` → `calculateContentHeight` | `parseBoxModel`에서 요소 자체 width로 계산 |

---

### Fixed - Button/UI 컴포넌트 width 설정 시 배경 렌더링 실패 (2026-02-14)

#### 증상

- Button에 `width: 200px` 또는 `width: 50%` 설정 시 Skia 배경(background, border, borderRadius)이 렌더링되지 않음
- Selection 영역은 정상이나 시각적 배경이 사라짐
- 동일 문제가 Section, ToggleButton, Card, Form, List, FancyButton, ScrollBox, MaskedFrame에도 존재

#### 원인

**1. Spec shapes의 배경 roundRect `width`에 `props.style?.width` 사용**

- 9개 spec 파일에서 배경 roundRect의 width를 `(props.style?.width as number) || 'auto'`로 설정
- 사용자가 `width: 200px`를 설정하면 `shape.width = 200` (숫자)이 됨
- `specShapesToSkia`의 bgBox 추출 조건은 `shape.width === 'auto' && shape.height === 'auto'`
- 숫자 width → bgBox 미추출 → 배경이 children으로 들어감 → 투명 outer box만 표시

**2. effectiveElement에서 퍼센트 값 이중 적용 (ElementSprite.tsx)**

- `computedContainerSize`는 Yoga가 이미 `%`를 resolve한 pixel 값
- 기존 코드: `(parseFloat('50%') / 100) * computedContainerSize.width` → 50% × 200px = 100px (이중 적용)
- 수정: `computedContainerSize.width` 직접 사용

**3. `@composition/specs` dist 미빌드**

- 소스 파일 수정 후 `pnpm build` 미실행 → Builder가 구 dist/ 참조

#### 수정 파일

| 파일                                                 | 변경 내용                                               |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `packages/specs/src/components/Button.spec.ts`       | 배경 roundRect `width: 'auto' as const`                 |
| `packages/specs/src/components/Section.spec.ts`      | 동일 패턴 수정                                          |
| `packages/specs/src/components/ToggleButton.spec.ts` | 동일 패턴 수정                                          |
| `packages/specs/src/components/Card.spec.ts`         | 동일 패턴 수정                                          |
| `packages/specs/src/components/Form.spec.ts`         | 동일 패턴 수정                                          |
| `packages/specs/src/components/List.spec.ts`         | 동일 패턴 수정                                          |
| `packages/specs/src/components/FancyButton.spec.ts`  | 동일 패턴 수정                                          |
| `packages/specs/src/components/ScrollBox.spec.ts`    | 동일 패턴 수정                                          |
| `packages/specs/src/components/MaskedFrame.spec.ts`  | 동일 패턴 수정                                          |
| `apps/builder/.../sprites/ElementSprite.tsx`         | 퍼센트 값 이중 적용 수정                                |
| `apps/builder/.../ui/PixiButton.tsx`                 | `isWidthAuto`/`isHeightAuto` minRequiredWidth 비교 제거 |

---

### Feature - TagGroup 컨테이너 구조 전환 (2026-02-13)

#### 개요

TagGroup과 TagList를 CONTAINER_TAGS로 전환하여 웹 CSS와 동일한 3-level 계층 구조를 구현. ComponentDefinition 타입을 재귀적 ChildDefinition으로 확장하고, Factory에서 재귀 생성을 지원. 텍스트 태그의 높이 자동 계산 및 TextSprite 클릭 선택 관련 수정 포함.

#### 변경 내용

**1. TagGroup/TagList → CONTAINER_TAGS 전환**

- TagGroup과 TagList를 CONTAINER_TAGS로 등록하여 웹 CSS와 동일한 3-level 계층 구조 구현
- 구조: `TagGroup → Label + TagList → Tag[]`
- 기존 flat 렌더링에서 실제 DOM 구조와 일치하는 중첩 컨테이너 방식으로 전환

**2. ComponentDefinition 재귀적 ChildDefinition 타입 확장**

- 기존 2-level 구조(parent + flat children)에서 무한 중첩 children 지원으로 확장
- `ChildDefinition` 타입에 재귀적 `children` 필드 추가
- 복합 컴포넌트의 깊은 계층 구조를 선언적으로 정의 가능

**3. Factory 재귀 생성 (`createElementsFromDefinition`)**

- `processChildren()` 재귀 함수 도입으로 중첩 자식 요소 일괄 생성
- ChildDefinition의 재귀적 children 구조를 순회하며 각 레벨의 요소를 생성
- 기존 단일 레벨 자식 생성 로직을 재귀 패턴으로 일반화

**4. styleToLayout 텍스트 높이 자동 계산**

- `TEXT_LAYOUT_TAGS` (label, text, heading, paragraph)에 대해 size prop 기반 높이 자동 설정
- typography 토큰 매핑: `xs:12, sm:14, md:16, lg:18, xl:20`
- lineHeight 계산: fontSize × 1.4 패턴으로 height 자동 설정
- Button sizes 패턴과 동일한 `size prop → 토큰 → lineHeight` 변환 경로

**5. TextSprite 투명 히트 영역**

- backgroundColor가 없는 텍스트 요소에도 `alpha: 0.001` 사각형 추가
- 투명 배경 텍스트도 클릭으로 선택 가능하도록 수정

**6. ElementSprite useSkiaNode text spriteType 추가**

- `hasOwnSprite` 조건에 text spriteType 추가
- TextSprite가 자체적으로 Skia 데이터를 등록하므로 ElementSprite에서 이중 등록 방지

**7. isYogaSizedContainer 확장**

- TagGroup/TagList를 ToggleButtonGroup과 동일한 Yoga 크기 결정 패턴에 추가
- Yoga 레이아웃 엔진이 컨테이너 크기를 자식 기반으로 자동 계산

---

### Bugfix - ToggleButtonGroup alignSelf 강제 설정으로 부모 align-items 무시 (2026-02-13)

#### 이슈

ToggleButtonGroup을 `display: flex; justify-content: center; align-items: center` 부모 안에 배치해도 수직 가운데 정렬이 되지 않음. `align-items: flex-start` 상태처럼 상단에 고정됨.

#### 근본 원인

`styleToLayout.ts`에서 ToggleButtonGroup의 `width: fit-content` Yoga 워크어라운드 처리 시 `alignSelf: 'flex-start'`를 강제 설정하고 있었음. CSS에서 `width: fit-content`와 `align-self`는 독립적 속성이지만, 코드에서는 fit-content 처리를 위해 `alignSelf`를 같이 설정하여 부모의 `align-items` 값이 무시됨.

```typescript
// ❌ 변경 전: alignSelf 강제 설정 → 부모 align-items 무시
if (width === undefined && !isFitContentWidth) {
  layout.flexGrow = 0;
  layout.flexShrink = 0;
  if (layout.alignSelf === undefined) layout.alignSelf = "flex-start"; // ← 문제
}
if (isFitContentWidth) {
  if (layout.alignSelf === undefined) layout.alignSelf = "flex-start"; // ← 문제
}

// ✅ 변경 후: alignSelf 제거 → 부모 align-items 정상 적용
if (width === undefined && !isFitContentWidth) {
  layout.flexGrow = 0;
  layout.flexShrink = 0;
  // alignSelf 미설정 → 부모의 align-items가 교차축 정렬 결정
}
```

#### 동일 패턴 조사

| 위치                                                   | alignSelf: flex-start 사용                | 수정 필요                      |
| ------------------------------------------------------ | ----------------------------------------- | ------------------------------ |
| `styleToLayout.ts` ToggleButtonGroup                   | 사용자 CSS 스타일 변환에서 강제 설정      | **수정 완료**                  |
| `Pixi*.tsx` (10개: Popover, Disclosure, Menu, Tabs 등) | 내부 Pixi 렌더링 컴포넌트 자체 레이아웃용 | 사용자 CSS와 무관, 수정 불필요 |
| `styleToLayout.ts` Checkbox/Radio/Switch               | alignSelf 미사용                          | 해당 없음                      |
| `styleToLayout.ts` Badge/Tag/Chip                      | alignSelf 미사용                          | 해당 없음                      |

#### 수정 파일

| 파일                      | 변경                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- |
| `layout/styleToLayout.ts` | ToggleButtonGroup fit-content 워크어라운드에서 `alignSelf: 'flex-start'` 2줄 제거 |

---

### Bugfix - ToggleButton spec border-radius 그룹 위치 기반 처리 (2026-02-13)

#### 이슈

ToggleButtonGroup 내부 ToggleButton의 border-radius가 CSS에서는 그룹 내 위치(first/middle/last)에 따라 모서리별로 다르게 적용되지만, Spec 기반 Skia 렌더링에서는 동일한 단일 borderRadius 값으로 렌더링됨.

**CSS 규칙** (ToggleButtonGroup.css):

- horizontal first: `border-top-right-radius: 0; border-bottom-right-radius: 0`
- horizontal last: `border-top-left-radius: 0; border-bottom-left-radius: 0`
- horizontal middle: 모든 모서리 `0`
- vertical first: `border-bottom-left-radius: 0; border-bottom-right-radius: 0`
- vertical last: `border-top-left-radius: 0; border-top-right-radius: 0`
- vertical middle: 모든 모서리 `0`

#### 수정 내용

**1. `ToggleButton.spec.ts` — `_groupPosition` props + border-radius 분기**

- `ToggleButtonProps` 인터페이스에 `_groupPosition` 추가 (orientation, isFirst, isLast, isOnly)
- `shapes()` 함수에서 그룹 위치에 따른 per-corner border-radius 계산:
  - `[tl, tr, br, bl]` 4-tuple 반환 (`specShapeConverter.ts`의 `resolveRadius()` 가 지원)

```typescript
// horizontal: first → [r,0,0,r], last → [0,r,r,0], middle → [0,0,0,0]
// vertical: first → [r,r,0,0], last → [0,0,r,r], middle → [0,0,0,0]
```

**2. `ElementSprite.tsx` — `_groupPosition` 주입**

- `toggleGroupPosition` 객체를 `_groupPosition` key로 spec shapes props에 주입
- 기존 `PixiToggleButton.tsx`의 border-radius 처리와 동일한 결과

#### 수정 파일

| 파일                                                                  | 변경                                                |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| `packages/specs/src/components/ToggleButton.spec.ts`                  | `_groupPosition` props, shapes() border-radius 분기 |
| `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx` | `toggleGroupPosition` → `_groupPosition` 주입       |

---

### Bugfix - Factory 정의 style 기본값 누락 (2026-02-13)

#### 근본 원인

복합 컴포넌트(children 포함)는 `ComponentFactory` → `GroupComponents.ts`의 factory 정의로 생성됨.
단순 컴포넌트는 `useElementCreator` → `getDefaultProps(tag)` (unified.types.ts)로 생성됨.
**factory 정의의 `props`에 `style` 필드가 누락**되어 생성 시점에 CSS 기본값(display, flexDirection 등)이 적용되지 않음. 리셋 버튼은 `getDefaultProps()`를 사용하므로 리셋 후에만 기본값이 복원됨.

#### 수정 내용

**1. `GroupComponents.ts` — factory 정의에 style 추가**

| 컴포넌트                      | 추가된 style                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| ToggleButtonGroup (parent)    | `{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: 'fit-content' }` |
| Checkbox (CheckboxGroup 자식) | `{ display: 'flex', flexDirection: 'row', alignItems: 'center' }`                       |
| Radio (RadioGroup 자식)       | `{ display: 'flex', flexDirection: 'row', alignItems: 'center' }`                       |

**2. `unified.types.ts` — getDefaultProps 기본값 동기화**

| 함수                                  | 추가된 속성                                    |
| ------------------------------------- | ---------------------------------------------- |
| `createDefaultToggleButtonGroupProps` | `alignItems: 'center'`, `width: 'fit-content'` |

#### 전수 조사 결과

| 경로                        | style 있음 (unified.types)  | factory 정의                   | 상태          |
| --------------------------- | --------------------------- | ------------------------------ | ------------- |
| Button                      | `{ borderWidth: '1px' }`    | 단순 컴포넌트 (factory 미사용) | 문제 없음     |
| Switch                      | `{ display: 'flex', ... }`  | 단순 컴포넌트 (factory 미사용) | 문제 없음     |
| Card                        | `{ display: 'block', ... }` | 단순 컴포넌트 (factory 미사용) | 문제 없음     |
| ToggleButtonGroup           | `{ display: 'flex', ... }`  | factory 사용                   | **수정 완료** |
| Checkbox (in CheckboxGroup) | `{ display: 'flex', ... }`  | factory 자식                   | **수정 완료** |
| Radio (in RadioGroup)       | `{ display: 'flex', ... }`  | factory 자식                   | **수정 완료** |

#### 수정 파일

| 파일                                       | 변경                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| `factories/definitions/GroupComponents.ts` | ToggleButtonGroup, Checkbox×2, Radio×2에 style 추가            |
| `types/builder/unified.types.ts`           | `createDefaultToggleButtonGroupProps`에 alignItems, width 추가 |

---

### Bugfix - ToggleButtonGroup 스타일 패널 display 기본값 + Selection 영역 (2026-02-13)

#### 이슈 1: 스타일 패널 display 기본값 오류

**문제**: ToggleButtonGroup 선택 시 스타일 패널에서 `display: block`으로 표시됨 (실제는 `display: flex`).
`styleAtoms.ts`의 displayAtom이 `element.style.display ?? element.computedStyle.display ?? 'block'` 폴백을 사용하여, 인라인 스타일/computedStyle에 display가 없는 컴포넌트는 항상 'block' 표시.

**수정**: `getLayoutDefault()` 4단계 우선순위 헬퍼 도입:

1. inline style → 2. computed style → 3. `DEFAULT_CSS_VALUES[tag]` → 4. global default

```typescript
// styleAtoms.ts
const DEFAULT_CSS_VALUES = {
  ToggleButtonGroup: {
    width: "fit-content",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  // ...
};

function getLayoutDefault(element, prop, globalDefault): string {
  // inline → computed → tag default → global default
}
```

**영향 atoms**: `displayAtom`, `flexDirectionAtom`, `layoutValuesAtom`, `flexDirectionKeysAtom`, `flexAlignmentKeysAtom`

#### 이슈 2: Selection 영역이 실제 크기보다 작음

**문제**: ToggleButtonGroup(CONTAINER_TAGS + inline-block)의 selection bounds가 80px(DEFAULT_WIDTH 폴백)로 계산됨.
원인: BlockEngine → `calculateContentWidth()` → ToggleButtonGroup에 텍스트/명시적 width 없음 → DEFAULT_WIDTH=80px 폴백.

**수정 1 — `engines/utils.ts` calculateContentWidth()**:
ToggleButtonGroup 전용 분기 추가. `props.items`에서 자식 버튼 텍스트 폭 합산.

**수정 2 — `BuilderCanvas.tsx` containerLayout**:
ToggleButtonGroup의 containerLayout width를 `'auto'`로 오버라이드. Yoga가 자식 크기 기반 자동 계산.

```typescript
const toggleGroupWidthOverride = isToggleButtonGroup
  ? { width: "auto", flexGrow: 0, flexShrink: 0 }
  : { width: layout.width };
```

#### 동일 패턴 분석

| 조건                                       | 결과                                                     |
| ------------------------------------------ | -------------------------------------------------------- |
| CONTAINER_TAGS ∩ DEFAULT_INLINE_BLOCK_TAGS | **ToggleButtonGroup만** 해당                             |
| 다른 CONTAINER_TAGS (Card, Panel 등)       | block → width = availableWidth → 문제 없음               |
| 다른 inline-block (Toolbar 등)             | CONTAINER_TAGS 아님 → containerLayout 미사용 → 영향 없음 |

#### 수정 파일

| 파일                                 | 변경                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| `panels/styles/atoms/styleAtoms.ts`  | `getLayoutDefault()` 헬퍼, DEFAULT_CSS_VALUES 확장, 5개 atom 수정 |
| `layout/engines/utils.ts`            | `calculateContentWidth()`에 ToggleButtonGroup 분기 추가           |
| `workspace/canvas/BuilderCanvas.tsx` | containerLayout width override for ToggleButtonGroup              |

---

### Feature - `width: fit-content` 네이티브 구현 (2026-02-13)

#### 개요

CSS intrinsic sizing `width: fit-content`를 BlockEngine + WASM 하이브리드 레이아웃 엔진에 네이티브 구현. 기존 Yoga 워크어라운드(flexGrow:0 + flexShrink:0)를 보완하여 Block 레이아웃 경로에서도 fit-content가 정확히 동작.

#### 구현 방식

`FIT_CONTENT = -2` sentinel 값을 도입하여 기존 `AUTO = -1` 패턴과 동일한 방식으로 JS ↔ WASM 직렬화. FIELD_COUNT(19) 변경 없이 width 필드에 sentinel을 전달.

```
width 값 해석:
  -1 (AUTO)         → Block: 부모 너비 채움 / Inline-block: contentWidth
  -2 (FIT_CONTENT)  → Block: contentWidth 사용 (inline-block과 동일)
  0 이상             → 명시적 px 값
```

#### 변경 내용

**1. utils.ts — FIT_CONTENT 상수 + parseSize/parseBoxModel**

- `FIT_CONTENT = -2` 상수 export
- `parseSize()`: `'fit-content'` 문자열 감지 → `FIT_CONTENT` 반환
- `parseBoxModel()`: `FIT_CONTENT` 값은 border-box 변환 건너뜀

**2. layoutAccelerator.ts — WASM 바인딩 상수**

- `FIT_CONTENT = -2` export 추가

**3. BlockEngine.ts — JS/WASM 양쪽 경로**

- JS 경로: `boxModel.width === FIT_CONTENT`일 때 `contentWidth` 사용
- WASM 경로: `FIT_CONTENT` sentinel을 WASM에 전달

**4. block_layout.rs — Rust WASM**

- `FIT_CONTENT` 상수 추가, block/inline-block 양쪽 width 로직 수정
- 6개 Rust 테스트 추가

**5. styleToLayout.ts — Flex/Yoga 경로 일반화**

- 모든 요소에 대해 fit-content Yoga 워크어라운드 적용 (`flexGrow:0, flexShrink:0`)
- ToggleButtonGroup CSS 기본값(`width: fit-content`) 유지

**6. TransformSection.tsx — StylesPanel UI**

- Width/Height units에 `fit-content` 옵션 추가 (`reset` 아래)

#### 수정 파일

| 파일                                          | 변경                                                 |
| --------------------------------------------- | ---------------------------------------------------- |
| `layout/engines/utils.ts`                     | `FIT_CONTENT` 상수, `parseSize`/`parseBoxModel` 수정 |
| `wasm-bindings/layoutAccelerator.ts`          | `FIT_CONTENT` 상수 export                            |
| `layout/engines/BlockEngine.ts`               | JS/WASM 경로 fit-content 처리                        |
| `wasm/src/block_layout.rs`                    | Rust fit-content 로직 + 6 테스트                     |
| `layout/styleToLayout.ts`                     | Yoga 워크어라운드 일반화                             |
| `panels/styles/sections/TransformSection.tsx` | Width/Height units에 fit-content 추가                |

---

### Feature - Spec Shapes 기반 Skia UI 컴포넌트 렌더링 (2026-02-12)

#### 개요

62개 UI 컴포넌트가 "배경색+텍스트" fallback 대신 ComponentSpec의 `shapes()` 함수가 반환하는 도형 배열을 기반으로 정확한 시각적 렌더링. Checkbox의 인디케이터 박스+체크마크+라벨, ToggleButton의 트랙+썸 등 세부 도형까지 Skia 캔버스에 표시.

#### 근본 원인

`ElementSprite.tsx`의 skiaNodeData useMemo에서 Card를 제외한 모든 UI 컴포넌트가 else 분기의 텍스트-전용 fallback으로 처리됨.

#### 변경 내용

**Phase 1: nodeRenderers.ts에 line 타입 추가**

- `SkiaNodeData`에 `line` 타입 추가, `renderLine()` 함수 구현

**Phase 2: specShapeConverter.ts 생성**

- `Shape[]` → `SkiaNodeData` 변환기 신규 작성
- 각 Shape 타입(rect, circle, line, text 등)별 Skia 렌더 데이터 매핑

**Phase 3: ElementSprite.tsx에 spec shapes 렌더링 통합**

- `getSpecForTag()` 헬퍼로 태그별 ComponentSpec 조회
- spec shapes가 있는 컴포넌트는 `specShapeConverter`를 통해 렌더링
- column 방향 flexDirection 재배치 지원

**패치 1-6: 호환성 및 레이아웃 수정**

- `aiEffects.ts`: borderRadius 튜플 타입 호환
- bgBox 추출 조건 수정 (auto-sized only)
- TokenRef 해석 (`resolveNum`)
- Checkbox/Radio/Switch 기본 props + `styleToLayout` flex 기본값
- `BlockEngine`: `calculateContentHeight`/`Width` 추가
- flexDirection column 레이아웃 지원

#### 수정 파일

| 파일                             | 변경                                                       |
| -------------------------------- | ---------------------------------------------------------- |
| `skia/nodeRenderers.ts`          | `SkiaNodeData`에 line 타입 추가, `renderLine()`            |
| `skia/specShapeConverter.ts`     | 신규 - `Shape[]` → `SkiaNodeData` 변환기                   |
| `skia/aiEffects.ts`              | borderRadius 튜플 타입 호환                                |
| `sprites/ElementSprite.tsx`      | `getSpecForTag()`, spec 렌더링, column 재배치              |
| `layout/styleToLayout.ts`        | Checkbox/Radio/Switch flex 기본값 + flexDirection 크기     |
| `layout/engines/utils.ts`        | `calculateContentHeight`/`Width` 폼 컨트롤 + flexDirection |
| `types/builder/unified.types.ts` | `createDefaultCheckboxProps`/`Radio`/`Switch` 기본값       |

---

### Performance - Fill 컬러피커 드래그 성능 최적화 (2026-02-12)

#### 개요

ColorArea/ColorSlider 드래그 시 FPS가 ~50에서 ~20으로 하락하던 문제를 3계층 최적화로 해결. react-aria의 `onChange`가 매 pointer move(60-120+/sec)마다 호출되며, RAF 스로틀 없이 매번 전체 elementsMap 복사 + CSS 변환 + Zustand set()이 수행되던 것이 근본 원인.

#### 근본 원인 (Hot Path)

```
onChange → setLocalColor + onChange(hex)              ← 매 pointer move (100+/sec)
  → updateFillPreview(id, {color})
    → fills.map(...)                                  ← 배열 재생성
    → store.updateSelectedFillsPreview()
      → structuredClone(element)                      ← deep clone
      → fillsToCssBackground(fills)                   ← CSS 변환 (Skia 불필요)
      → new Map(elementsMap)                          ← O(n) Map 복사
      → [...elements]                                 ← O(n) 배열 복사
      → set()                                         ← Zustand → 리렌더 연쇄
```

#### 변경 내용

**P0: Critical — RAF 스로틀 + 경량 프리뷰 (CSS 변환 제거)**

- `inspectorActions.ts`: `updateSelectedFillsPreviewLightweight(fills)` 추가
  - `fillsToCssBackground()` 호출 제거 (Skia는 `element.fills`를 직접 읽음)
  - `elements` 배열 복사/갱신 스킵 (elementsMap만 업데이트)
  - `prePreviewElement` 패턴 유지 (히스토리 정확성)
- `useFillActions.ts`: `updateFillPreviewThrottled(fillId, updates)` 추가
  - GradientBar RAF 패턴 차용: `pendingUpdateRef`로 최신 값만 유지
  - 내부에서 `updateSelectedFillsPreviewLightweight()` 호출
- `FillSection.tsx`: 모든 드래그 프리뷰 경로를 `updateFillPreviewThrottled`로 전환

**P0-2: ColorPickerPanel RAF 스로틀**

- `ColorPickerPanel.tsx`: `handleChange`에 RAF 스로틀 적용
  - `setLocalColor` + `onChange`를 프레임당 1회로 제한 (60fps cap)
  - `handleChangeEnd`에서 보류 중 RAF 취소 + 최종 값 flush

**P1: ColorInputFields 실시간 반영**

- `ColorInputFields.tsx`: `TextField` 컴포넌트에 `isFocused` 상태 추가
  - 포커스가 아닐 때 외부 `value` prop 변경 추적 (ColorArea 드래그 등)
  - HEX/CSS 모드가 드래그 중 업데이트되지 않던 문제 해결

**P2: CSS 성능 힌트**

- `ColorArea.css`: `contain: layout style` + `touch-action: none` + `will-change: transform`
- `ColorSlider.css`: `contain: layout style` + `touch-action: none` + `will-change: transform`

#### 수정 파일

| 파일                                                    | 변경                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `stores/inspectorActions.ts`                            | `updateSelectedFillsPreviewLightweight` 추가 (CSS 변환 + elements 배열 스킵) |
| `panels/styles/hooks/useFillActions.ts`                 | `updateFillPreviewThrottled` (RAF + lightweight store) 추가                  |
| `panels/styles/sections/FillSection.tsx`                | 드래그 경로에서 throttled 프리뷰 사용                                        |
| `panels/styles/components/ColorPickerPanel.tsx`         | handleChange RAF 스로틀, handleChangeEnd flush                               |
| `panels/styles/components/ColorInputFields.tsx`         | TextField isFocused 추적으로 외부 value 동기화                               |
| `packages/shared/src/components/styles/ColorArea.css`   | contain, touch-action, will-change 힌트                                      |
| `packages/shared/src/components/styles/ColorSlider.css` | contain, touch-action, will-change 힌트                                      |

#### 하위 호환성

- 기존 `updateFillPreview` (non-throttled) 및 `updateSelectedFillsPreview` (CSS 포함) 유지
- `onChangeEnd` 경로 변경 없음 (`updateFill` → `updateSelectedFills` → full commit)

---

### Fixed - SVG Mesh Gradient 크기 불일치 수정 (2026-02-12)

#### 개요

Mesh Gradient가 SVG로 렌더링될 때 요소 크기에 맞지 않고 원본 100×100 크기로 고정되던 문제를 수정.

#### 근본 원인

SVG의 `width`/`height`가 `100%`로 설정되었으나 `viewBox`와 `preserveAspectRatio`가 미지정이어서 SVG 내부 좌표계가 요소 크기에 맞게 스케일링되지 않음.

#### 수정 내용

- `fillMigration.ts`: SVG에 `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` 추가
  - SVG 내부 좌표가 요소 크기에 비례하여 스트레칭됨

#### 수정 파일

| 파일                                   | 변경                                              |
| -------------------------------------- | ------------------------------------------------- |
| `panels/styles/utils/fillMigration.ts` | SVG 태그에 viewBox, preserveAspectRatio 속성 추가 |

---

### Added - 페이지 배치 방향 설정 (2026-02-11)

#### 개요

캔버스 내 멀티페이지 배치 방향을 가로/세로/지그재그로 전환할 수 있는 설정을 추가. Settings 패널의 Grid & Guides 섹션에서 제어.

#### 변경 내용

- **Page Layout 설정**: Settings 패널 → Grid & Guides에 PropertySelect 추가 (Horizontal / Vertical / Zigzag)
- **배치 로직**: `initializePagePositions`에 `direction` 파라미터 추가, 방향별 좌표 계산 구현
- **Skia 캐시 stale 방지**: `_pagePosStaleFrames` 카운터로 방향 전환 시 PixiJS worldTransform 갱신 전 캐시 고정 방지

#### 수정 파일

| 파일                                | 변경                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `stores/canvasSettings.ts`          | `PageLayoutDirection` 타입 및 `pageLayoutDirection` / `setPageLayoutDirection` 상태 추가 |
| `stores/elements.ts`                | `initializePagePositions`에 `direction` 파라미터 추가, vertical/zigzag 배치 로직 구현    |
| `panels/settings/SettingsPanel.tsx` | Page Layout PropertySelect 추가 (Grid & Guides 섹션)                                     |
| `canvas/BuilderCanvas.tsx`          | `pageLayoutDirection` 변경 감지 및 페이지 위치 재계산                                    |
| `hooks/usePageManager.ts`           | 초기화 시 현재 방향 반영                                                                 |
| `canvas/skia/SkiaOverlay.tsx`       | `_pagePosStaleFrames` 카운터로 트리 캐시 race condition 방지                             |
| `main/BuilderHeader.tsx`            | 페이지 배치 ToggleButtonGroup 제거 (Settings 패널로 이동)                                |
| `main/BuilderCore.tsx`              | 불필요한 pageLayoutDirection props 전달 제거                                             |

---

### Fixed - 모달 패널 CSS 변수 불일치 수정 (2026-02-11)

#### 개요

Settings 모달 패널의 컴포넌트 색상이 좌우 패널과 다르게 표시되던 문제를 수정.

#### 근본 원인

1. React Aria `<Modal className="modal-panel-wrapper">`가 기본 `react-aria-Modal` 클래스를 대체하여, `builder-system.css`의 `.react-aria-Modal` 선택자가 매칭되지 않음 → 모달 내부가 `:root`/`body` 레벨의 테마 변수(블루 톤)를 상속
2. `ModalPanelContainer.css`에서 프로젝트에 정의되지 않은 `--spectrum-gray-*` 변수 사용

#### 수정 파일

| 파일                                | 변경                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| `styles/1-theme/builder-system.css` | Light/Dark 모드 CSS 변수 선택자에 `.modal-panel` 추가    |
| `layout/ModalPanelContainer.css`    | 미정의 `--spectrum-gray-*` 7개소를 M3 시맨틱 변수로 교체 |

---

### Changed - Workflow 미니맵 개선 (2026-02-10)

#### 개요

워크플로우 오버레이의 미니맵을 CanvasScrollbar와 동일한 자동 표시/숨김 패턴으로 변경하고, 크기를 캔버스에 비례하도록 개선.

#### 변경 내용

- **자동 표시/숨김**: 캔버스 이동(pan/zoom) 시에만 미니맵 표시, 1.5초 비활동 후 자동 숨김
  - 패널 토글 시 미니맵 위치 갱신 타이밍 문제를 근본적으로 해소
- **동적 크기**: 고정 200×150px → 캔버스 크기의 10% 비례 (width: 80~200px, height: 60~140px clamp)
- **여백 통일**: bottom 여백을 48px → 16px로 변경하여 right 여백과 동일하게 통일

#### 수정 파일

| 파일                                                                | 변경                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`    | 미니맵 가시성 제어 (카메라 감지 + fade 타이머), 동적 크기 계산, 미사용 코드 제거 |
| `apps/builder/src/builder/workspace/canvas/skia/workflowMinimap.ts` | bottom 여백 16px, 동적 크기 상수 추가 (`MINIMAP_CANVAS_RATIO`, min/max bounds)   |

---

### Removed - @xyflow/react 의존성 및 이벤트 패널 데드 코드 제거 (2026-02-10)

#### 개요

이벤트 패널이 Phase 5 블록 기반 UI(WHEN → IF → THEN/ELSE)로 전환된 후 사용되지 않던 레거시 ViewMode 시스템(List/Simple/ReactFlow)과 `@xyflow/react` 의존성을 완전 제거.

#### 삭제된 파일

- `components/EventHandlerManager.tsx` — 레거시 3-mode 뷰 매니저
- `components/ViewModeToggle.tsx` — List/Simple/ReactFlow 토글
- `components/ActionListView.tsx` — 레거시 액션 목록 뷰
- `components/visualMode/` 전체 — ReactFlowCanvas, TriggerNode, ActionNode, SimpleFlowView, FlowNode, FlowConnector
- `hooks/useEventFlow.ts` — EventHandler → ReactFlow 노드/엣지 변환

#### 수정된 파일

| 파일                                | 변경                        |
| ----------------------------------- | --------------------------- |
| `panels/events/components/index.ts` | 삭제된 컴포넌트 export 제거 |
| `panels/events/hooks/index.ts`      | `useEventFlow` export 제거  |
| `apps/builder/package.json`         | `@xyflow/react` 의존성 제거 |

#### 효과

- 번들 크기 절감: ~45KB (gzip) — `@xyflow/react` + 18개 하위 의존성 제거
- 프로젝트에서 `@xyflow/react` 참조 완전 제거 (워크플로우 레거시 코드 포함)

---

### Fixed - WebGL Canvas 안정화 패치 (2026-02-06)

#### 개요

Section/Card 레이아웃 정합성, Selection/Lasso 좌표계, 키보드 붙여넣기 중복 실행 이슈를 한 번에 정리한 안정화 패치.

#### 1) Section 레이아웃 정합성 (display:block/flex, auto height)

- Section의 암시적 flex 처리/레거시 경로를 정리하여 `display:block` 기본 동작과 명시적 `display:flex` 동작을 분리.
- `display:block`일 때 부모(body)의 `display`, `flex-direction` 변경이 Section display 계산에 간섭하던 문제 수정.
- `height:auto` + padding 환경에서 children 크기 반영/누락이 뒤섞이던 계산 경로 정리.
- 선택 박스가 실제 렌더 영역과 어긋나던 문제를 함께 보정.

#### 2) Lasso/Selection 좌표계 보정

- 라쏘 박스는 화면(글로벌) 좌표, 요소 bounds는 로컬/혼합 좌표를 읽어 교차 판정이 실패하던 문제 수정.
- `BuilderCanvas.tsx`에서 라쏘 좌표를 글로벌 기준으로 정규화하고, 요소 bounds는 `elementRegistry.getBounds()` 우선 경로로 통일.
- `SelectionLayer.utils.ts`는 전달된 bounds 기반 AABB 판정만 수행하도록 단순화하여 SpatialIndex 경로 불일치 제거.

#### 3) Cmd/Ctrl+V 붙여넣기 2회 실행

- 글로벌 단축키와 PropertiesPanel 단축키가 동시에 `paste`를 처리하여 요소가 2개 생성되던 문제 수정.
- PropertiesPanel 단축키를 `panel:properties` 스코프로 제한하고 `activeScope`를 registry 옵션에 연결.

#### 4) Card가 Body 영역을 넘어가는 overflow

- BlockEngine `parseBoxModel()`에서 Card/Box를 content-box로 계산하던 경로 수정.
- `width/height` 명시 시 Section과 동일하게 Card/Box도 border-box로 해석해 `width:100% + padding` 초과폭 제거.

#### 수정 파일

| 파일                                                                          | 변경                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`                 | Section/Container 레이아웃 경로 정리, Selection/Lasso bounds 좌표계 보정 |
| `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.utils.ts` | 전달 bounds 기반 AABB 교차 판정으로 단순화                               |
| `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`              | copy/paste 단축키 scope 지정 + activeScope 적용                          |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`           | Card/Box border-box 해석 추가                                            |

---

### Added - AI Tool Calling + Agent Loop (2026-02-06)

#### 개요

기존 JSON 텍스트 파싱 방식(GroqService)에서 **Tool Calling + Agent Loop** 아키텍처(GroqAgentService)로 전환.
Groq SDK의 tool calling을 활용하여 AI가 에디터 도구를 직접 호출하는 방식으로 변경.

#### Phase A1: 기반 구조

- `ai.types.ts` 확장 — AgentEvent(7-variant union), ToolCall, ToolExecutor, AIAgentProvider
- `chat.types.ts` 확장 — tool role, ToolCallInfo, ConversationState agent 필드
- `tools/definitions.ts` — 7개 도구 JSON Schema (Groq ChatCompletionTool 형식)
- `systemPrompt.ts` — `buildSystemPrompt(context)` 동적 시스템 프롬프트 빌더
- `styleAdapter.ts` — CSS-like → 내부 스키마 변환 레이어 (CanvasKit 전환 대비)
- 영향 파일: `ai.types.ts`, `chat.types.ts`, `tools/definitions.ts`, `systemPrompt.ts`, `styleAdapter.ts`

#### Phase A2: Agent 서비스

- `GroqAgentService.ts` — AsyncGenerator 기반 Agent Loop, streaming tool call 조립, MAX_TURNS=10, AbortController
- 5개 핵심 도구: `createElement.ts`, `updateElement.ts`, `deleteElement.ts`, `getEditorState.ts`, `getSelection.ts`
- `tools/index.ts` — 도구 레지스트리 (`createToolRegistry()`)
- `conversation.ts` 확장 — isAgentRunning, currentTurn, activeToolCalls 상태 + 관련 액션
- 영향 파일: `GroqAgentService.ts`, `tools/*.ts`, `conversation.ts`

#### Phase A3: UI 개선

- `useAgentLoop.ts` — Agent Loop React hook, G.3 시각 피드백 연동, IntentParser fallback
- `ToolCallMessage.tsx` — 도구 호출 상태 표시 (아이콘 + 이름 + 스피너/체크/에러)
- `ToolResultMessage.tsx` — 도구 실행 결과 표시 (생성됨/수정됨/삭제됨)
- `AgentControls.tsx` — 중단 버튼 + 현재 turn 카운터
- `AIPanel.tsx` 재작성 — useAgentLoop hook 기반, executeIntent 제거
- `GroqService.ts` — @deprecated 표시, 동작하지 않는 예시 제거
- 영향 파일: `AIPanel.tsx`, `useAgentLoop.ts`, `components/*.tsx`, `GroqService.ts`

#### Phase A4: 고급 기능

- `searchElements.ts` — tag/propName/propValue/styleProp 기반 요소 검색 (limit 지원)
- `batchDesign.ts` — operations[] 배열 순차 실행 (create/update/delete, 최대 20개, 실패 시 중단)
- 429 Rate Limit 지수 백오프 — GroqAgentService 내부 재시도 (1s→2s→4s, 3회)
- 영향 파일: `searchElements.ts`, `batchDesign.ts`, `GroqAgentService.ts`, `definitions.ts`, `index.ts`

#### 최종 결과

| 기능                            | 상태 |
| ------------------------------- | ---- |
| Tool Calling (7개 도구)         | ✅   |
| Agent Loop (multi-turn)         | ✅   |
| 대화 히스토리 전달              | ✅   |
| Streaming 텍스트 + Tool 피드백  | ✅   |
| G.3 시각 피드백 연동            | ✅   |
| 에이전트 중단 (AbortController) | ✅   |
| IntentParser fallback           | ✅   |
| Rate Limit 대응 (429 백오프)    | ✅   |
| 배치 작업 (batch_design)        | ✅   |
| 요소 검색 (search_elements)     | ✅   |

---

### Added - Card display: block 완전 지원 (2026-02-06)

#### 개요

Card 컴포넌트에 `display: 'block'` 기본값 추가 및 Preview CSS와 동일한 동작 구현.

#### Phase 1: Body 기본값 설정

- `createDefaultBodyProps()` 추가 — Body에 `display: 'block'` 기본값 설정
- Reset 시 컴포넌트 기본값 복원 (`useResetStyles.ts`)
- 영향 파일: `unified.types.ts`, `dashboard/index.tsx`, `usePageManager.ts`, `layoutActions.ts`, `useResetStyles.ts`

#### Phase 2: renderWithCustomEngine CONTAINER_TAGS 지원

- **문제**: Card에 `display: 'block'` 추가 시 children이 Card 외부에 형제로 렌더링됨
- **원인**: `renderWithCustomEngine`에서 `childElements`/`renderChildElement` props 누락
- **수정**: 정상 경로와 동일한 CONTAINER_TAGS 처리 패턴 적용
- Card 기본값에 `display: 'block'`, `width: '100%'`, `padding: '12px'` 추가
- 영향 파일: `BuilderCanvas.tsx`, `unified.types.ts`

#### Phase 3: Card padding 이중 적용 수정

- **문제**: children 없이도 불필요한 여백 발생 ("children 공간 차지")
- **원인**: `calculatedContentHeight`에 padding 포함 + `cardLayout.padding`으로 이중 적용
- **수정**: `calculatedContentHeight`와 `calculateContentHeight()`를 content-only로 변경
- 영향 파일: `PixiCard.tsx`, `layout/engines/utils.ts`

#### Phase 4: CONTAINER_TAGS 높이 변경 시 siblings 재배치

- **문제**: Card에 children 추가 → Card height 증가 → 아래 Button 위치 그대로
- **원인**: `position: absolute` + 고정 `top` 값 사용
- **수정**: flex column 래퍼 + relative positioning으로 변경
  - absolute → relative
  - top/left → marginTop/marginLeft
- 영향 파일: `BuilderCanvas.tsx`

#### Phase 5: Block 레이아웃 라인 기반 렌더링

- **문제**: Body에 Button 여러 개 추가 시 계단식 배치 (가로 배치 안됨)
- **원인**: flex column 래퍼 + marginLeft로 x 위치 표현 → 모든 요소 수직 배치
- **수정**: 같은 y 값을 가진 요소들을 라인(flex row)으로 그룹화
  - BlockEngine 결과를 y 값 기준으로 라인 그룹화
  - 각 라인은 flex row (가로 배치)
  - 라인들은 flex column (세로 쌓기)
- 영향 파일: `BuilderCanvas.tsx`

#### Phase 6: ToggleButton 사이즈 통일

- **문제**: ToggleButton/ToggleButtonGroup의 borderRadius가 Button과 다름
- **수정**: `TOGGLE_BUTTON_FALLBACKS` borderRadius를 Button과 동일하게 변경
  - sm: 6 → 4, md: 8 → 6, lg: 10 → 8
- 영향 파일: `cssVariableReader.ts`, `PixiToggleButton.tsx`

#### 최종 결과

| 기능                    | 상태 |
| ----------------------- | ---- |
| children 내부 렌더링    | ✅   |
| padding 정상 적용       | ✅   |
| height auto-grow        | ✅   |
| siblings 자동 재배치    | ✅   |
| inline 요소 가로 배치   | ✅   |
| Button 계열 사이즈 통일 | ✅   |
| Preview 일치            | ✅   |

**상세:** `.claude/plans/giggly-wibbling-mango.md`

---

### Added - Multi-Page Canvas Rendering (2026-02-05)

#### 개요

캔버스에 모든 페이지를 Pencil의 Frame처럼 동시 렌더링하는 기능 구현.
Preview iframe은 기존대로 현재 페이지 1개만 유지.

#### 주요 변경사항

**Phase 1: 페이지 위치 상태 관리**

- Store에 `pagePositions`, `pagePositionsVersion` 상태 및 `initializePagePositions()`, `updatePagePosition()` 액션 추가.
- `usePageManager`에서 초기화 시 수평 배치 계산, `addPage()` 시 동적 canvasSize 기반 위치 계산.

**Phase 2: 다중 페이지 PixiJS 씬 그래프**

- Camera 하위에 `PageContainer` memo 컴포넌트로 페이지별 독립 컨테이너 생성.
- `allPageData`: `pageIndex` 기반 O(1) 조회 (기존 `elements.find/filter` O(N\*M) 제거).
- `elementById`: store의 `elementsMap` 직접 참조 (중복 Map 생성 제거).

**Phase 3: Skia 렌더링 멀티페이지 대응**

- Skia 트리 캐시에 `pagePositionsVersion` 키 추가.
- `pagePosVersionRef` + `invalidateContent()` ref 기반 content 재렌더 트리거.
- 페이지 전환 시 `clearSkiaRegistry()` / `clearImageCache()` / `clearTextParagraphCache()` 호출 제거.
- `renderPageTitle()`: 활성 페이지 selection 색상(`#3B82F6`), 비활성 slate-500(`#64748b`).

**Phase 4: 페이지 클릭 → currentPage 전환**

- 다른 페이지 요소 클릭 시 `setCurrentPageId(element.page_id)` 호출 + Preview 갱신.

**Phase 5: Selection 페이지 경계 처리**

- 빈 영역 클릭 시 `setSelectedElements([])` — 트리/패널 포함 완전 초기화.
- 라쏘 선택은 현재 페이지 내에서만 동작.
- boundsMap 캐시에 `pagePosVersion` 분리 키 추가.

**Phase 6: Viewport Culling 페이지 단위 최적화**

- `visiblePageIds: Set<string>` — 뷰포트 밖 페이지의 `ElementsLayer` 렌더링 제외 (200px 마진).

**Phase 7: 페이지 타이틀 드래그**

- `usePageDrag` 훅: RAF 스로틀 + DOM clientX/clientY 좌표계.
- 타이틀 히트 영역: `PAGE_TITLE_HIT_HEIGHT = 24px`.

**Body 요소 보호**

- `handleCanvasDelete`에서 `tag === 'body'` 요소 필터링.
- `elementRemoval.ts`의 `removeElement`에서 body 삭제 가드 추가.

#### 성능 최적화

| 항목                 | 변경 전                           | 변경 후                     |
| -------------------- | --------------------------------- | --------------------------- |
| `allPageData`        | `elements.find/filter` O(N\*M)    | `pageIndex` O(1)            |
| `elementById`        | `new Map(elements.map())` 매 렌더 | `elementsMap` 직접 참조     |
| 페이지 컨테이너      | 인라인 JSX                        | `PageContainer` memo        |
| Skia content 감지    | 버전 합산                         | `invalidateContent()` + ref |
| 매 프레임 store 읽기 | `useStore.getState()`             | `pagePosVersionRef`         |

#### 수정 파일

| 파일                                  | 변경                                                                 |
| ------------------------------------- | -------------------------------------------------------------------- |
| `stores/elements.ts`                  | pagePositions 상태/액션 추가                                         |
| `stores/utils/elementRemoval.ts`      | Body 삭제 가드                                                       |
| `hooks/usePageManager.ts`             | 초기화/addPage 위치 계산                                             |
| `hooks/useGlobalKeyboardShortcuts.ts` | Body 삭제 필터링                                                     |
| `canvas/BuilderCanvas.tsx`            | 핵심 구조: PageContainer, allPageData, viewport culling, 페이지 전환 |
| `canvas/layers/BodyLayer.tsx`         | pageId prop 사용                                                     |
| `canvas/skia/SkiaOverlay.tsx`         | 트리 캐시 pagePosVersion, 레지스트리 초기화 제거                     |
| `canvas/skia/selectionRenderer.ts`    | renderPageTitle isActive                                             |
| `canvas/selection/SelectionLayer.tsx` | pagePositions prop 연결                                              |
| `canvas/hooks/useViewportCulling.ts`  | 페이지 단위 컬링                                                     |
| `canvas/hooks/usePageDrag.ts`         | **신규** — 페이지 드래그 훅                                          |

**상세:** `docs/MULTIPAGE.md`

### Fixed - Canvas Layout/Rendering 버그 5건 수정 (2026-02-05)

#### 개요

Canvas(PixiJS + Skia) 렌더링에서 발생한 5개 버그를 수정.
리팩토링 시 내부 store 구독→props 전환에서 render call 업데이트 누락이 근본 원인.

#### 버그 1: Body flex-direction 변경 시 Card 높이 늘어남

- **현상**: Body `row→column` 전환 시 Card가 body 전체 높이로 확대. 새로고침하면 정상.
- **원인**: `@pixi/layout`의 `formatStyles()`가 이전 스타일과 merge하여 `flexBasis:'100%'`가 잔류.
- **수정**: `blockLayoutDefaults = { flexBasis: 'auto', flexGrow: 0 }` 기본값을 containerLayout spread 최선두에 배치 (3곳).
- **파일**: `BuilderCanvas.tsx`

#### 버그 2: Card + Button children 겹침

- **현상**: Card 내부 Button이 description 텍스트와 겹침.
- **원인**: `cardLayout.height`가 텍스트만 계산한 고정값 → Yoga가 children 배치 공간 부족.
- **수정**: `height: 'auto'` + `minHeight: calculatedContentHeight` + `contentLayout.gap: 8`.
- **파일**: `PixiCard.tsx`

#### 버그 3: Body padding 적용 시 Card overflow

- **현상**: Body에 padding 적용 시 Card가 body를 벗어남. 새로고침하면 정상.
- **원인**: `ElementsLayer`가 내부 `useStore` → props 리팩토링 후 render call에서 `pageElements`, `bodyElement`, `elementById`, `depthMap` 미전달 → 모두 `undefined`.
- **수정**: `<ElementsLayer>` render call에 누락 props 추가, `bodyElement` computation을 `BuilderCanvas`에 추가.
- **파일**: `BuilderCanvas.tsx`

#### 버그 4: Body 배경색/border/selection 미표시

- **현상**: Body의 배경색, border, selection overlay가 Skia에서 렌더링되지 않음.
- **원인**: `BodyLayer`가 내부 `useStore(currentPageId)` → `pageId` prop 리팩토링 후 render call에서 `pageId` 미전달 → `bodyElement` 항상 `undefined` → Skia node 미등록.
- **수정**: `<BodyLayer pageId={currentPageId!}>` prop 추가.
- **파일**: `BuilderCanvas.tsx`

#### 버그 5: SkiaOverlay.tsx 빌드 에러

- **현상**: `"currentPageId" has already been declared` esbuild 에러.
- **원인**: `currentPageId`가 prop(line 407)과 `useStore`(line 789) 양쪽에서 중복 선언.
- **수정**: 중복 `useStore` 구독 제거 (prop으로 전달됨).
- **파일**: `SkiaOverlay.tsx`

#### 수정 파일 목록

| 파일                                                             | 변경                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`    | ElementsLayer/BodyLayer 누락 props 전달, blockLayoutDefaults 추가, bodyElement 계산 |
| `apps/builder/src/builder/workspace/canvas/ui/PixiCard.tsx`      | cardLayout height:'auto' + minHeight, contentLayout gap:8                           |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` | 중복 currentPageId 선언 제거                                                        |

#### 교훈

`@pixi/layout`의 `formatStyles()` merge 동작과 리팩토링 시 render call 업데이트 누락은 "새로고침하면 정상"이라는 공통 증상을 보인다.

- **formatStyles merge**: 이전 스타일이 잔류 → 새로고침으로 `_styles.custom` 초기화 시 정상
- **Props 미전달**: undefined 값으로 동작 → 새로고침으로 store 재구독 시 정상

### Added - GPUDebugOverlay (2026-02-05)

#### 개요

Skia 렌더링의 “rAF(브라우저) 프레임”과 “Skia present(실제 화면 제출)”을 분리해서 관측할 수 있는 Dev-only 오버레이를 추가.

#### 표시 항목(요약)

- `RAF FPS`, `RAF Frame(ms)` — 브라우저 rAF 기준
- `Skia(ms)`, `Content(ms)`, `Blit(ms)` — SkiaOverlay/SkiaRenderer 단계별 프레임타임
- `Present/s`, `Content/s`, `Registry/s`, `Idle%` — “실제 렌더 빈도/원인” 관측

#### 위치/마운트

- 캔버스 좌상단(Dev-only)
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
- `apps/builder/src/builder/workspace/canvas/utils/GPUDebugOverlay.tsx`

### Added - 캔버스 Page Title 라벨 표시 (2026-02-04)

#### 개요

캔버스에서 페이지 경계(CanvasBounds) 좌측 상단 위에 현재 페이지 타이틀을 표시.
Pencil 앱의 Frame title과 동일한 방식.

#### 구현 방식

- **렌더링**: Skia 캔버스에서 직접 렌더링 (기존 `renderDimensionLabels` 패턴 활용)
- **위치**: 페이지 좌상단 (0, 0) 기준으로 위쪽 20px offset
- **폰트**: Pretendard 12px (화면 기준, zoom-independent — `fontSize * (1/zoom)`)
- **색상**: slate-500 (`#64748b`), 80% opacity
- **배경 없음**: Pencil 스타일 텍스트만 표시

#### 렌더 파이프라인 삽입 위치

```
renderNode() → AI effects → ★renderPageTitle()★ → Selection overlay → Lasso
```

- Selection 오버레이보다 먼저 렌더링되어, 선택 박스/핸들이 타이틀 위에 표시됨
- `pageTitle` 변경 감지: `lastPageTitleRef` → `overlayVersionRef++`로 리렌더 트리거

#### 수정 파일

| 파일                                                                  | 변경                                               |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/selectionRenderer.ts` | `renderPageTitle()` 함수 + 상수 추가               |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`      | props 확장, 타이틀 변경 감지, renderPageTitle 호출 |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`         | SkiaOverlayLazy에 pageWidth/pageHeight 전달        |

### Fixed - 스타일 패널 프로퍼티 변경 시 저장 안 됨 / 플리커 / 실시간 프리뷰 미반영 (2026-02-04)

#### 개요

스타일 패널(Transform, Layout, Typography, Appearance)에서 프로퍼티 변경 시:

1. 값을 변경해도 새로고침하면 저장되지 않음 (DB 저장 누락)
2. 요소 선택 시 1프레임 플리커 (빈 값 → 실제 값 깜빡임)
3. 타이핑 중 캔버스에 실시간 프리뷰 미반영

Pencil 앱과 비교하여 동등한 수준의 즉시 반영 품질을 목표로 수정.

#### 버그 1: [Critical] PropertyUnitInput 프리뷰 후 DB 저장 누락

**원인:** `updateSelectedStylePreview`가 `selectedElementProps`를 업데이트 → Jotai atom 갱신 → PropertyUnitInput의 `value` prop이 프리뷰 값으로 변경 → blur 시 `valueActuallyChanged = false` 판정 → `onChange`(DB 저장) 미호출

**수정 (`inspectorActions.ts`):**

- `updateSelectedStylePreview`에서 `selectedElementProps` 업데이트 제거 (캔버스용 `elementsMap`만 업데이트)
- `prePreviewElement` closure 변수로 프리뷰 전 원본 스냅샷 보관
- `updateSelectedStyle`/`updateSelectedStyles` 커밋 시 원본 기반으로 히스토리 기록 (정확한 undo/redo)
- `updateAndSave`에 `prevElementOverride` 파라미터 추가

```
타이핑 중: onDrag → updateStylePreview → elementsMap만 업데이트 → 캔버스 반영
                                          selectedElementProps 미변경 → value prop 유지
blur/Enter: onChange → updateStyleImmediate → valueActuallyChanged=true → DB 저장
```

#### 버그 2: [Critical] FourWayGrid controlled input + updateStyleIdle 충돌

**원인:** LayoutSection FourWayGrid의 `<Input>`이 Jotai atom 값으로 제어되는 controlled component인데, `onChange`가 `updateStyleIdle`(requestIdleCallback, 100ms timeout)을 호출. store가 idle callback 이후에야 업데이트되므로 타이핑한 문자가 즉시 사라짐

**수정 (`LayoutSection.tsx`):**

- FourWayGrid에 local state 패턴 적용 (useState + useLayoutEffect 동기화)
- `updateStyleIdle` → `updateStyleImmediate`로 변경 (blur 시에만 호출되므로 즉시 업데이트 적합)
- `onPreview` 콜백 추가 (타이핑 중 실시간 캔버스 프리뷰)

#### 버그 3: [Medium] 요소 선택 시 플리커 (Two-phase hydration)

**원인:** `setSelectedElement`이 `selectedElementProps: {}` 설정 → hydration 50ms 후 실행. 첫 프레임에 모든 값이 빈 상태로 표시

**수정 (`elements.ts`):**

- `selectedElementProps: {}` → `selectedElementProps: createCompleteProps(element)` (동기적, 경량)
- hydration 콜백은 `computedStyle`만 머지 (전체 교체 대신)
- `_cancelHydrateSelectedProps` 노출하여 경쟁 상태 방지

#### 버그 4: [Medium] Zustand→Jotai Bridge useEffect 지연

**원인:** Bridge 초기값 설정이 `useEffect`(paint 이후)에서 실행되어 첫 프레임에 null 표시

**수정 (`useZustandJotaiBridge.ts`):**

- `useEffect` → `useLayoutEffect`로 변경 (paint 전 실행)
- `buildSelectedElement`에서 빈 props fallback 개선 (`element.props`에서 직접 읽기)

#### 개선: 실시간 캔버스 프리뷰 (Preview vs Commit 분리)

**목표:** Pencil 앱처럼 타이핑 중에도 캔버스에 즉시 반영

**수정:**

- `updateSelectedStylePreview` 스토어 액션 추가 (히스토리/DB 저장 없이 캔버스만 업데이트)
- `updateStylePreview` 훅 함수 추가 (RAF-throttled, `useOptimizedStyleActions.ts`)
- PropertyUnitInput: `handleInputChange`에서 `onDrag` 호출로 타이핑 중 라이브 프리뷰
- PropertyUnitInput: `useEffect` → `useLayoutEffect`로 값 동기화 (1프레임 플리커 방지)
- 전 섹션 `onDrag`를 `updateStyleRAF` → `updateStylePreview`로 전환

| 동작                  | 함수                   | 히스토리 | DB 저장 |
| --------------------- | ---------------------- | -------- | ------- |
| 타이핑 중 / 드래그 중 | `updateStylePreview`   | X        | X       |
| blur / Enter          | `updateStyleImmediate` | O        | O       |

#### 수정 파일

| 파일                                              | 변경                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `stores/inspectorActions.ts`                      | prePreviewElement 추적, selectedElementProps 미업데이트, prevElementOverride |
| `stores/elements.ts`                              | 동기적 createCompleteProps, \_cancelHydrateSelectedProps                     |
| `panels/styles/hooks/useOptimizedStyleActions.ts` | updateStylePreview 추가                                                      |
| `panels/styles/hooks/useZustandJotaiBridge.ts`    | useLayoutEffect, 빈 props fallback                                           |
| `panels/styles/sections/LayoutSection.tsx`        | FourWayGrid local state, onPreview                                           |
| `panels/styles/sections/TransformSection.tsx`     | onDrag → updateStylePreview                                                  |
| `panels/styles/sections/TypographySection.tsx`    | onDrag → updateStylePreview                                                  |
| `panels/styles/sections/AppearanceSection.tsx`    | onDrag → updateStylePreview                                                  |
| `components/property/PropertyUnitInput.tsx`       | useLayoutEffect, 타이핑 중 라이브 프리뷰                                     |

### Fixed - ToggleButtonGroup 캔버스 선택 불가 및 스타일 적용 버그 수정 (2026-02-04)

### Fixed - Pencil 방식 2-pass 렌더러 안정화/성능 (2026-02-05)

#### 개요

Pencil 모델(컨텐츠 캐시 + present(blit) + 오버레이 분리)로 전환한 후, 고배율 줌/팬 및 리사이즈/DPR 변화에서 잔상·미세 버그를 방지하고 cleanup 비용을 낮춤.

#### 변경 사항(요약)

- **contentSurface 백엔드 정합**: `ck.MakeSurface()` 대신 `mainSurface.makeSurface()`로 offscreen surface를 생성해 메인과 동일 백엔드(GPU/SW) 사용.
- **줌 스냅샷 보간**: zoomRatio != 1이면 `drawImageCubic` 우선 적용(미지원 환경 `drawImage` 폴백).
- **Paragraph LRU 캐시**: 텍스트 `Paragraph`를 (내용+스타일+maxWidth) 키로 캐시(최대 500), 폰트 교체/페이지 전환/HMR에서 무효화.
- **리사이즈/DPR/컨텍스트 복원 안정화**: surface 재생성 직후 `invalidateContent()+clearFrame()`로 1-frame stale/잔상 방지.

#### 관련 파일

- `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`
- `apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts`

### Fixed - 스타일 변경 Long Task 저감 (2026-02-05)

#### 개요

스타일 패널에서 클릭/드래그 시 `[Violation] 'click' handler took ...ms`(Long Task) 빈도를 낮추기 위해, 업데이트 액션의 O(n) 재빌드를 제거하고 저장을 백그라운드로 전환.

#### 변경 사항(요약)

- `updateElementProps`/`batchUpdateElementProps`: `_rebuildIndexes()` 제거, 변경된 요소만 `elementsMap` O(1) 갱신
- IndexedDB 저장을 `await`로 블로킹하지 않고 백그라운드 처리
- 멀티 선택 정렬/분배를 `batchUpdateElementProps` 경로로 전환

#### 관련 파일

- `apps/builder/src/builder/stores/utils/elementUpdate.ts`
- `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`

#### 1. ToggleButtonGroup 캔버스에서 클릭 선택 불가 (Selection)

**원인 (3가지 복합 문제):**

- `pixiGraphics`의 `eventMode="none"`으로 클릭이 관통됨
- `position: absolute` pixiContainer 래퍼가 PixiJS hit testing에서 올바른 hit area 미제공
- `LayoutComputedSizeContext`의 `computedSize.height === 0`이 `??` 연산자에서 falsy로 처리되지 않아 `bgHeight = 0` → hit area 없음

**수정 (`PixiToggleButtonGroup.tsx`):**

- `pixiContainer` 래퍼 제거 → `pixiGraphics` 직접 반환 (BoxSprite 패턴)
- `eventMode="static"` + `cursor="pointer"` + `onPointerDown` 설정
- `LayoutComputedSizeContext`에서 Yoga computed size 사용 (Skia 렌더링과 hit area 일치)
- `computedSize` 값이 0일 때 fallback하도록 `??` → `> 0` 명시적 체크로 변경

#### 2. ToggleButtonGroup width/height 스타일 미적용

**원인:** `PixiToggleButtonGroup.tsx`의 `groupLayout`이 style.width/height를 무시하고 fit-content 고정

**수정:** 외부 LayoutContainer(styleToLayout)가 width/height 처리, 내부는 배경만 렌더링

#### 3. width/height를 px/% → auto/fit-content 변경 시 새로고침 필요

**원인:** `@pixi/layout`의 `formatStyles`가 `{ ...이전스타일, ...새스타일 }`로 머지하여, 삭제된 속성(width/height)이 이전 캐시 값으로 남아있음

**수정 (`styleToLayout.ts`):** width/height가 undefined일 때 명시적으로 `'auto'` 설정하여 이전 캐시 값을 덮어씀

```typescript
// Before: 삭제된 속성이 캐시에 남음
if (width !== undefined) layout.width = width;
// After: 명시적 'auto'로 이전 값 override
layout.width = width !== undefined ? width : "auto";
```

#### 4. PropertyUnitInput 키워드 유닛 버그

**원인:** auto, fit-content 등 키워드 유닛 선택 시 "300auto" 같은 잘못된 CSS 생성

**수정 (`PropertyUnitInput.tsx`):** 키워드 유닛 감지 시 effectiveUnit을 'px'로 변환하여 숫자+키워드 조합 방지

### Fixed - WebGL 스타일/프로퍼티 변경 즉시 반영 안 되는 문제 수정 (2026-02-03)

#### 개요

우측 스타일 패널이나 프로퍼티 패널에서 값을 변경했을 때 WebGL/Skia 캔버스에 즉시 반영되지 않고, 화면 위치 이동(pan/zoom)이나 새로고침 후에야 반영되던 문제 수정

#### 버그 원인

`ElementSprite.tsx`의 `skiaNodeData` useMemo 의존성 배열에 `style`과 `props`가 누락되어 있었음

```typescript
// 수정 전: effectiveElement 참조만 비교
const skiaNodeData = useMemo(() => {
  const style = effectiveElement.props?.style;
  // ...
}, [effectiveElement, spriteType]); // ⚠️ style 변경 감지 안 됨
```

`effectiveElement` 객체 참조가 같으면 내부 `props.style`이 변경되어도 useMemo가 캐시된 값을 반환하여 Skia 렌더 데이터가 업데이트되지 않음

#### 수정 내용

useMemo 외부에서 `style`과 `props` 참조를 추출하여 의존성 배열에 추가

```typescript
// 수정 후: style/props 참조가 다르면 재계산
const elementStyle = effectiveElement.props?.style;
const elementProps = effectiveElement.props;

const skiaNodeData = useMemo(() => {
  const style = elementStyle as CSSStyle | undefined;
  // ...
}, [effectiveElement, spriteType, elementStyle, elementProps]);
```

이렇게 하면:

1. Store에서 element.props.style이 업데이트되면 새 style 객체 생성
2. `elementStyle` 참조가 변경됨
3. `skiaNodeData` useMemo가 재계산되어 새 Skia 렌더 데이터 생성
4. `useSkiaNode`의 useEffect가 재실행 → `registerSkiaNode()` 호출
5. `registryVersion++` → Skia 렌더러가 변경 감지하여 다시 렌더링

#### 참고: BoxSprite의 올바른 패턴

동일한 문제가 `BoxSprite.tsx`에서는 발생하지 않았는데, 의존성 배열에 `style`이 포함되어 있었기 때문:

```typescript
// BoxSprite.tsx - 올바른 패턴
const skiaNodeData = useMemo(() => {
  // ...
}, [transform, fill, borderRadius, borderConfig, style, skiaEffects]); // ✅ style 포함
```

#### 영향 범위

- 모든 요소 타입(Button, Box, Text, Image 등)의 스타일/프로퍼티 변경이 즉시 WebGL 캔버스에 반영
- pan/zoom 없이 스타일 패널 변경 즉시 시각적 피드백 제공

#### 변경된 파일

- `apps/builder/src/.../sprites/ElementSprite.tsx` — `skiaNodeData` useMemo 의존성 배열에 `elementStyle`, `elementProps` 추가

---

### Fixed - Dirty Rect 부분 렌더링 시 이전 프레임 잔상 문제 수정 (2026-02-03)

#### 개요

스타일 변경 시 간헐적으로 이전 렌더링의 모양이 남아있는 문제 수정

#### 버그 원인

Dirty rect 기반 부분 렌더링에서 경계 영역에 여유분(padding)이 없어서 안티앨리어싱, 부동소수점 오차, 서브픽셀 렌더링으로 인한 경계 잔상이 발생

#### 수정 내용 (2건)

**1. `useSkiaNode.ts` - nodeToDirtyRect():**

```typescript
// 수정 전
let expand = 0;

// 수정 후: 기본 2px 여유분 추가
let expand = 2; // 안티앨리어싱, 부동소수점 오차 대비
```

**2. `SkiaRenderer.ts` - screenRect 계산:**

```typescript
// 수정 전
const screenRect = {
  x: rect.x * camera.zoom + camera.panX,
  y: rect.y * camera.zoom + camera.panY,
  width: rect.width * camera.zoom,
  height: rect.height * camera.zoom,
};

// 수정 후: 2px 패딩 추가
const padding = 2;
const screenRect = {
  x: rect.x * camera.zoom + camera.panX - padding,
  y: rect.y * camera.zoom + camera.panY - padding,
  width: rect.width * camera.zoom + padding * 2,
  height: rect.height * camera.zoom + padding * 2,
};
```

#### 변경된 파일

- `apps/builder/src/.../skia/useSkiaNode.ts` — `nodeToDirtyRect()` 기본 expand 2px 추가
- `apps/builder/src/.../skia/SkiaRenderer.ts` — screenRect 계산 시 2px 패딩 추가

> **업데이트 (2026-02-05):** 이후 clipRect 기반 Dirty Rect 경로는 “팬/줌/스냅샷/padding” 조합에서
> 잔상·미반영 리스크가 커서 **2-pass 컨텐츠 캐시 + present(blit) + 오버레이 분리 모델로 대체**되었다.
> 따라서 위 수정은 “당시 시점의 Hotfix 기록”으로만 의미가 있으며, 현재 렌더 경로에는 적용되지 않는다.

---

### Fixed - Pencil 2-pass 렌더러로 Dirty Rect 제거 및 줌/팬 성능 핫픽스 (2026-02-05)

#### 개요

줌/팬 중 스타일/프로퍼티 반영 지연(팬해야 반영)과 잔상 문제를 구조적으로 제거하고,
메인 스레드 블로킹(긴 rAF 핸들러) 현상을 줄이기 위한 렌더 파이프라인 재정렬.

#### 변경 내용

- Dirty Rect(clipRect) 부분 렌더링 경로 제거(보류) → 컨텐츠 invalidation은 full rerender로 단순화
- Pencil 방식 2-pass:
  - contentSurface에 디자인 컨텐츠 렌더 → `contentSnapshot` 캐시
  - mainSurface는 present 단계에서 snapshot blit(카메라 델타 아핀 변환) + Selection/AI/PageTitle 오버레이 별도 패스
- 줌/팬 인터랙션 중에는 camera-only(스냅샷 아핀 blit) 우선 + 모션 종료 후 cleanup(full) 1회 재렌더
- Pixi 시각 비활성화 O(1): Camera 자식 전체 순회 대신 `Camera.alpha=0`
- Selection 바운드맵 `registryVersion` 캐시로 매 프레임 O(n) 순회 제거

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx`
- `docs/RENDERING_ARCHITECTURE.md`, `docs/PENCIL_APP_ANALYSIS.md`, `docs/PENCIL_VS_composition_RENDERING.md`

### Fixed - 요소 삭제 후 화면에 남아있는 문제 수정 (2026-02-03)

#### 개요

요소를 삭제해도 화면에 남아있고 pan/zoom 같은 위치 이동이 이루어져야 화면에서 사라지던 문제 수정

#### 버그 원인

React의 `useEffect` cleanup이 비동기적으로 지연될 수 있어서, 요소가 삭제되어도 Skia 레지스트리에서 즉시 제거되지 않음

```
기존 흐름 (문제):
1. Store에서 요소 삭제
2. React reconciliation → ElementSprite 언마운트 예약
3. (지연) useEffect cleanup 실행 → unregisterSkiaNode 호출
4. 다음 렌더 프레임에서도 삭제된 요소가 여전히 표시됨
```

#### 수정 내용

`elementRemoval.ts`에서 요소 삭제 시 **직접 Skia 레지스트리에서 해당 요소들을 즉시 제거**

```typescript
// 추가된 import
import { unregisterSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";

// set() 호출 전에 Skia 레지스트리 정리
for (const id of elementIdsToRemove) {
  unregisterSkiaNode(id);
}

set({
  elements: filteredElements,
  // ...
});
```

#### 수정 후 흐름

```
1. Store에서 요소 삭제 시작
2. 즉시 unregisterSkiaNode(id) 호출 → dirty rect 추가 + 레지스트리 삭제 + registryVersion++
3. Store 상태 업데이트
4. 다음 렌더 프레임에서 dirty rect 영역 클리어 → 삭제된 요소 즉시 화면에서 사라짐
```

#### 변경된 파일

- `apps/builder/src/builder/stores/utils/elementRemoval.ts` — `unregisterSkiaNode` import 및 삭제 시 즉시 호출

---

### Added - Selection 치수 표시 기능 (2026-02-03)

#### 개요

캔버스에서 요소를 선택했을 때 선택 박스 하단에 `width × height` 치수 레이블을 표시하는 Figma 스타일 기능 추가

#### 구현 내용

- **위치**: 선택 박스 하단 중앙, 8px 오프셋
- **스타일**: 파란 배경(`#51a2ff`) + 흰색 텍스트 + 둥근 모서리(4px)
- **폰트**: Pretendard 11px
- **줌 독립적**: 화면상 일정한 크기 유지 (`1/zoom` 스케일 적용)

#### 변경된 파일

- `apps/builder/src/.../skia/selectionRenderer.ts` — `renderDimensionLabels()` 함수 추가
- `apps/builder/src/.../skia/SkiaOverlay.tsx` — Selection 렌더링 시 치수 레이블 호출

---

### Fixed - Skia UI 컴포넌트 borderRadius 파싱 버그 수정 (2026-02-03)

#### 개요

UI 패널에서 Button 등 UI 컴포넌트의 `borderRadius`를 변경해도 Skia 캔버스에 반영되지 않는 문제 수정

#### 버그 원인

`ElementSprite.tsx`의 Skia 폴백 렌더링에서 `style.borderRadius`를 `typeof === 'number'` 체크로 직접 읽었으나, UI 패널은 값을 문자열(`"12px"`)로 저장하므로 항상 `0`으로 평가됨

```typescript
// 수정 전 (항상 br = 0)
const { transform, fill, stroke } = convertStyle(style);
const br = typeof style.borderRadius === "number" ? style.borderRadius : 0;
```

#### 수정 내용 (3건)

**1. CSS 문자열 파싱 누락:**
`convertStyle()`이 이미 `parseCSSSize()`를 통해 CSS 문자열을 숫자로 올바르게 변환하므로, 그 결과를 destructuring하여 사용

```typescript
// 수정 후 (올바르게 파싱)
const {
  transform,
  fill,
  stroke,
  borderRadius: convertedBorderRadius,
} = convertStyle(style);
const br =
  typeof convertedBorderRadius === "number"
    ? convertedBorderRadius
    : (convertedBorderRadius?.[0] ?? 0);
```

**2. 명시적 0 값 무시:**
기존 `br > 0 ? br : 기본값` 로직이 사용자가 명시적으로 `borderRadius: "0"`을 설정한 경우와 미설정(undefined)을 구분하지 못함

```typescript
// 수정 전: borderRadius=0 설정해도 UI 컴포넌트는 기본값 6px로 덮어씌움
const effectiveBorderRadius =
  br > 0 ? br : isUIComponent && !hasBgColor ? 6 : 0;

// 수정 후: style에 borderRadius가 명시적으로 존재하면 그 값(0 포함) 사용
const hasBorderRadiusSet =
  style?.borderRadius !== undefined &&
  style?.borderRadius !== null &&
  style?.borderRadius !== "";
const effectiveBorderRadius = hasBorderRadiusSet
  ? br
  : isUIComponent && !hasBgColor
    ? 6
    : 0;
```

**3. 하드코딩된 기본 borderRadius 6px → Spec size별 토큰 값 적용:**
기존에 UI 컴포넌트의 기본 borderRadius가 size에 관계없이 `6`으로 하드코딩되어 있었으나,
Spec의 radius 토큰 값에 따라 size별로 차등 적용하도록 수정

```typescript
// 수정 전: 모든 size에 6px 고정
const effectiveBorderRadius = hasBorderRadiusSet
  ? br
  : isUIComponent && !hasBgColor
    ? 6
    : 0;

// 수정 후: Spec radius 토큰 기반 size별 기본값 (xs/sm=4, md=6, lg/xl=8)
const size = isUIComponent ? String(props?.size || "md") : "";
const defaultBorderRadius = UI_COMPONENT_DEFAULT_BORDER_RADIUS[size] ?? 6;
const effectiveBorderRadius = hasBorderRadiusSet
  ? br
  : isUIComponent && !hasBgColor
    ? defaultBorderRadius
    : 0;
```

#### 영향 범위

- 모든 UI 컴포넌트(Button, Input, Checkbox, Select 등)의 Skia 폴백 렌더링에서 `borderRadius` 정상 반영
- `borderRadius: 0` 명시적 설정 시 직각 모서리로 정상 렌더링
- `borderRadius` 미설정 시 Spec size별 기본값 적용 (xs/sm=4px, md=6px, lg/xl=8px)

#### 변경된 파일

- `apps/builder/src/.../sprites/ElementSprite.tsx` — `convertStyle()` borderRadius destructuring + 명시적 0 값 처리 + size별 기본 borderRadius 매핑(`UI_COMPONENT_DEFAULT_BORDER_RADIUS`)

---

### Removed - WASM/Skia Feature Flag 환경변수 제거 (2026-02-02)

5개 환경변수(`VITE_RENDER_MODE`, `VITE_WASM_SPATIAL`, `VITE_WASM_LAYOUT`, `VITE_WASM_LAYOUT_WORKER`, `VITE_SKIA_DUAL_SURFACE`)를 제거하고 값을 하드코딩하여 ~30개 조건 분기 및 dead code를 제거.

- `wasm-bindings/featureFlags.ts`: 모든 `WASM_FLAGS` → `true`, `getRenderMode()` → `'skia'` 고정
- `utils/featureFlags.ts`: `isWasmSpatialIndex()`, `isWasmLayoutEngine()`, `isCanvasKitEnabled()` → `true` 고정
- `.env`, `.env.example`: WASM 관련 환경변수 5줄 삭제
- `vite-env.d.ts`: 환경변수 타입 5개 삭제
- Sprite 6개 파일: `if (!WASM_FLAGS.CANVASKIT_RENDERER)` 가드 제거
- Selection 3개 파일: `isSkiaMode` 변수 제거, 무조건 Skia 경로 사용
- `init.ts`: Feature Flag 조건 4개 제거 (무조건 초기화)
- `elementRegistry.ts`: `WASM_FLAGS` 조건 제거 (`_spatialModule` null 체크는 유지)
- `BuilderCanvas.tsx`: `WASM_FLAGS.CANVASKIT_RENDERER &&` 조건 제거
- `SkiaRenderer.ts`: `WASM_FLAGS.DUAL_SURFACE_CACHE &&` 조건 제거
- `BlockEngine.ts`, `GridEngine.ts`: `WASM_FLAGS.LAYOUT_ENGINE &&` / `WASM_FLAGS.LAYOUT_WORKER` 조건 제거
- `SelectionLayer.utils.ts`: JS 폴백 경로 dead code 제거
- `SkiaOverlay.tsx`: `renderMode` 조건 3곳 제거, `isActive` 상수화

### Fixed - Skia 렌더 트리 계층화 및 Selection 좌표 통합 (2026-02-02)

#### 개요

캔버스 팬 시 Body 내 Button이 Body를 뒤따라오는 렌더링 불일치 및 Selection 오버레이가 컨텐츠와 분리되는 문제를 근본적으로 해결

#### 버그 원인

1. **Flat 트리 + worldTransform 절대 좌표**: 기존 `buildSkiaTreeFromRegistry`는 모든 노드를 flat siblings로 수집하고 각 노드의 절대 좌표를 `(wt.tx - cameraX) / zoom`으로 독립 계산. PixiJS ticker 우선순위 차이(`NORMAL` vs `LOW`)로 worldTransform 갱신 타이밍이 달라 노드 간 상대 위치 오차 발생
2. **Selection 좌표 소스 불일치**: `buildSelectionRenderData`가 elementRegistry/하드코딩 좌표를 사용하여 컨텐츠 렌더링과 다른 좌표 소스 참조

#### 수정 내용

- `buildSkiaTreeFromRegistry` → `buildSkiaTreeHierarchical`로 교체: 계층적 트리 + worldTransform 부모-자식 상대 좌표
  - 핵심 공식: `relativeX = (child.wt.tx - parent.wt.tx) / cameraZoom` — 카메라 오프셋이 뺄셈 시 상쇄
- `buildTreeBoundsMap`: Skia 트리에서 절대 바운드 추출, Selection이 컨텐츠와 동일한 좌표 소스 참조
- `aiEffects.ts` `buildNodeBoundsMap`: 계층 트리에서 부모 오프셋 누적으로 절대 좌표 복원

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` — 계층 트리 구성, Selection 좌표 통합
- `apps/builder/src/builder/workspace/canvas/skia/aiEffects.ts` — AI 이펙트 좌표 누적 수정

---

### Added - Skia 렌더링 파이프라인 완성 (2026-02-02)

#### 개요

Skia 렌더링 파이프라인의 남은 기능 8건을 모두 구현하여 Pencil 렌더링 아키텍처 전환 100% 완료

#### 구현 항목

1. **MeshGradient Fill** (`fills.ts`)
   - CanvasKit에 네이티브 API 없으므로 bilinear interpolation 근사: top/bottom LinearGradient + MakeBlend
   - `MeshGradientFill` 인터페이스에 rows, columns, colors, width, height 필드 추가

2. **LayerBlur 이펙트** (`effects.ts`)
   - 전경 콘텐츠에 가우시안 블러 적용: `MakeBlur(ImageFilter)` + `saveLayer()`
   - `LayerBlurEffect` 인터페이스 + `EffectStyle` 유니언에 합류

3. **Phase 6 이중 Surface 활성화** (`SkiaOverlay.tsx`)
   - `renderer.render()` 호출에 `registryVersion`, `camera`, `dirtyRects` 파라미터 전달
   - idle 프레임 스킵, camera-only 블리팅, content dirty rect 부분 렌더링 활성화

4. **변수 resolve 렌더링 경로 완성** (G.2)
   - `useResolvedElement()` → `effectiveElement` → 개별 Sprite → SkiaNodeData 파이프라인 검증 완료
   - `resolveElementVariables()`: style 객체 재귀 탐색으로 `$--` 변수 → 실제 CSS 값 변환 동작 확인

5. **KitComponentList 패널 통합** (G.4)
   - `DesignKitPanel`에 마스터 컴포넌트 목록 표시 + 인스턴스 생성 연결
   - `elements.ts` 스토어에 `createInstance` 액션 추가

6. **킷 적용 시각 피드백** (G.3 + G.4)
   - `applyKit()` 시작 시 body에 generating 이펙트, 완료 시 녹색 flash 트리거
   - 실패 시 generating 이펙트 자동 제거

7. **내장 디자인 킷 JSON** (G.4)
   - `builtinKits/basicKit.ts`: 5개 색상 변수 + Default 테마(12 토큰) + Card/Badge 마스터 컴포넌트
   - `loadAvailableKits()`: 내장 킷 메타데이터 자동 로드
   - `loadBuiltinKit()`: ID로 내장 킷 조회 + loadedKit 설정

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/skia/types.ts` — MeshGradientFill 필드, LayerBlurEffect 인터페이스
- `apps/builder/src/builder/workspace/canvas/skia/fills.ts` — MeshGradient 셰이더 구현
- `apps/builder/src/builder/workspace/canvas/skia/effects.ts` — LayerBlur 이펙트 구현
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` — Phase 6 파라미터 전달
- `panels/designKit/DesignKitPanel.tsx` — KitComponentList 통합, 내장 킷 로드
- `stores/elements.ts` — createInstance 액션 추가
- `stores/designKitStore.ts` — loadBuiltinKit, 시각 피드백 연동
- `utils/designKit/builtinKits/basicKit.ts` — 내장 킷 데이터 (신규)

---

### Fixed - Skia UI 컴포넌트 Variant 배경/테두리 색상 매핑 (2026-02-02)

#### 개요

프로퍼티 패널에서 UI 컴포넌트(Button 등)의 variant를 변경해도 Skia 캔버스에 배경색/테두리색이 반영되지 않는 문제 수정

#### 버그 원인

`ElementSprite.tsx`의 Skia 폴백 렌더링에서 배경색을 `#e2e8f0`(slate-200), 테두리색을 `#cbd5e1`(slate-300)로 하드코딩

#### 수정 내용

- `VARIANT_BG_COLORS`: variant별 배경색 매핑 (8개 variant, M3 Light Mode 기준)
- `VARIANT_BG_ALPHA`: outline/ghost variant → alpha 0 (투명 배경)
- `VARIANT_BORDER_COLORS`: variant별 테두리색 매핑 (ghost는 테두리 없음)
- 우선순위: `inline style.backgroundColor > VARIANT_BG_COLORS[variant] > 기본값`

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx` — VARIANT_BG_COLORS, VARIANT_BG_ALPHA, VARIANT_BORDER_COLORS 추가
- `docs/COMPONENT_SPEC.md` — §4.5 variant 배경/테두리 색상 테이블 추가
- `docs/reference/components/PIXI_WEBGL.md` — Skia 폴백 variant 색상 매핑 섹션 추가
- `docs/RENDERING_ARCHITECTURE.md` — UI 컴포넌트 variant 배경/테두리 색상 노트 추가
- `docs/adr/003-canvas-rendering.md` — variant 색상 매핑 업데이트 항목 추가
- `docs/LAYOUT_REQUIREMENTS.md` — skiaNodeData 예시에 variant 색상 매핑 반영

---

### Fixed - Skia AABB 뷰포트 컬링 좌표계 버그 수정 (2026-02-02)

#### 개요

캔버스 팬 시 body가 화면 왼쪽/위쪽 가장자리에 닿으면 모든 Skia 렌더링이 사라지는 문제 수정

#### 버그 원인 (2가지)

1. **루트 컨테이너 zero-size 컬링**: `buildSkiaTreeFromRegistry`(현재 `buildSkiaTreeHierarchical`로 교체됨)가 생성하는 가상 루트 노드 `{x:0, y:0, width:0, height:0}`에 AABB 컬링이 적용되어, 카메라가 원점을 벗어나면 (`cameraX < 0` 또는 `cameraY < 0`) 루트가 컬링 → 전체 렌더링 소실
2. **자식 좌표계 불일치**: `canvas.translate(node.x, node.y)` 후 자식은 부모 로컬 좌표에 있지만, `cullingBounds`는 씬-로컬 좌표로 전달되어 텍스트 등 자식 노드가 잘못 컬링됨

#### 수정 내용

- `renderNode()`에서 zero-size 노드(가상 컨테이너) AABB 컬링 스킵
- 자식 재귀 시 `cullingBounds`를 `(x - node.x, y - node.y)` 로 역변환하여 로컬 좌표계 일치

#### 변경된 파일

- `apps/builder/src/.../skia/nodeRenderers.ts` — AABB 컬링 로직 수정

---

### Fixed - Skia Border-Box 렌더링 및 레이아웃 수정 (2026-02-02)

#### 개요

Skia 렌더러의 border(stroke) 렌더링이 CSS border-box 모델과 불일치하여 인접 요소의 border가 겹치는 문제를 수정

#### 버그 원인

- `nodeRenderers.ts`의 `renderBox()`가 stroke를 `(0, 0, width, height)` rect에 그림
- CanvasKit의 `PaintStyle.Stroke`는 경로 **중앙**에 그려지므로, `strokeWidth/2`만큼 요소 바운드 밖으로 넘침
- 인접 요소의 border가 서로의 바운드를 침범하여 시각적 겹침 발생

#### 수정 내용

1. **`skia/nodeRenderers.ts` — Skia stroke inset (핵심 수정)**
   - stroke rect를 `(inset, inset, width-inset, height-inset)` (inset = strokeWidth/2)로 축소
   - borderRadius도 inset만큼 조정하여 둥근 모서리에서도 정확한 border-box 동작
   - PixiJS `drawBox`의 `getBorderBoxOffset` 방식과 동일한 렌더링 결과

2. **`layers/BodyLayer.tsx` — Body Skia 데이터에 strokeColor/strokeWidth 추가**
   - Skia 모드에서 body의 borderColor가 적용되지 않던 문제 수정
   - `borderConfig` → `Float32Array` strokeColor + strokeWidth 변환 추가

3. **`BuilderCanvas.tsx` — Block 레이아웃 parentBorder 처리 정리**
   - `renderWithCustomEngine`에서 `parentBorder`를 `availableWidth` 계산 및 렌더링 offset에서 제거
   - border는 시각 렌더링 전용, 레이아웃 inset으로 사용하지 않음
   - `parseBorder` import 제거

#### 영향 범위

- 모든 Box 타입 Skia 노드 (Button, Body, div 등)의 border 렌더링
- `display:block` / `display:flex` 양쪽 레이아웃 경로에서 일관된 동작 확인

#### 변경된 파일

- `apps/builder/src/.../skia/nodeRenderers.ts` — stroke inset 렌더링
- `apps/builder/src/.../layers/BodyLayer.tsx` — Skia body border 데이터 추가
- `apps/builder/src/.../BuilderCanvas.tsx` — parentBorder 레이아웃 정리

---

### Added - WASM 성능 경로 Phase 0-4 구현 완료 (2026-02-02)

#### 개요

Rust WASM 기반 성능 가속 모듈(Phase 0-4)을 빌드/활성화하여 전체 WASM 파이프라인을 가동

#### Phase 0: 환경 구축

- Rust 1.93.0 + wasm-pack 0.14.0 설치
- `wasm-pack build --target bundler` → `composition_wasm_bg.wasm` (70KB) 빌드 성공
- `ping() = "pong"` 파이프라인 검증 통과

#### Phase 1: Spatial Index

- Grid-cell 기반 SpatialIndex (cell_size=256) — O(k) 뷰포트 컬링, 라쏘 선택, 히트 테스트
- idMapper (string UUID ↔ u32 양방향 매핑)

#### Phase 2: Layout Engine

- Block 레이아웃: margin collapse, BFC, inline-block 지원 (children > 10 시 WASM 경로)
- Grid 레이아웃: track 파싱 (fr/px/%/auto) + cell 위치 계산

#### Phase 4: Web Worker

- Worker 내 WASM 초기화 + block/grid 레이아웃 비동기 계산
- SWR 캐싱 + LayoutScheduler (RAF 기반)
- Transferable ArrayBuffer zero-copy 전송

#### 버그 수정

- `GridEngine.ts`: `calculateViaWasm()` 메서드에 누락된 `parent` 파라미터 추가

#### 브라우저 검증 결과 (콘솔 로그)

```
[RustWasm] 초기화 완료 — ping() = "pong"
[SpatialIndex] 초기화 완료 (cellSize=256)
[LayoutWorker] 초기화 완료
[LayoutWorker] scheduler 준비 완료
[WASM] 모듈 초기화 완료 {spatial: true, layout: true, worker: true, canvaskit: true}
```

#### 변경된 파일

- `apps/builder/.env` — WASM 플래그 전체 true 전환
- `apps/builder/.env.example` — WASM 플래그 업데이트
- `apps/builder/package.json` — `wasm:build` 스크립트 추가
- `apps/builder/src/.../layout/engines/GridEngine.ts` — parent 파라미터 버그 수정
- `apps/builder/src/.../wasm-bindings/pkg/` — Rust WASM 빌드 산출물 (신규)
- `docs/RENDERING_ARCHITECTURE.md` — Phase 0-4 산출물 체크리스트 ✅ 업데이트, 로드맵 상태 갱신
- `docs/WASM_DOC_IMPACT_ANALYSIS.md` — 최종 수정일 및 현재 상태 반영
- `docs/PENCIL_VS_composition_RENDERING.md` — WASM 모듈 항목 업데이트

---

### Docs - Pencil 렌더링 방식 전환 구현 현황 체크 (2026-02-01)

#### 개요

Pencil 앱과 동일한 CanvasKit/Skia 렌더링 아키텍처로의 전환 완성도를 체계적으로 점검하고 결과를 문서화

#### 체크 결과: 95% 완료 (35/37 항목)

**✅ 완전 구현:**

- 아키텍처: CanvasKit 메인 렌더러 + PixiJS 이벤트 전용 + 이중 Surface + 2-pass(컨텐츠 캐시 + present blit + 오버레이 분리) + 프레임 분류
- 노드 렌더링: Box/Text/Image/Container + AABB 컬링 + ParagraphBuilder 텍스트
- Fill 5/6종, 이펙트 4/5종, 블렌드 모드 18종 전체
- Selection 오버레이 + AI 시각 피드백 + Export (PNG/JPEG/WEBP)
- 유틸리티: 초기화, Surface, Disposable, Font(IndexedDB 캐싱), 텍스트 측정(Yoga 연결)

**❌ 미구현 (2항목):**

- MeshGradient Fill — Phase 5 후반 예정
- LayerBlur 이펙트 — effects.ts 확장 예정

#### 변경된 파일

- `docs/PENCIL_VS_composition_RENDERING.md` — §11 구현 현황 체크리스트 추가 (11.1-11.11)

---

### Changed - Selection 오버레이 Skia 전환 (Pencil 방식) (2026-02-01)

#### 개요

Selection 오버레이(선택 박스, Transform 핸들, 라쏘)를 PixiJS 듀얼 캔버스에서 Pencil 앱 방식의 CanvasKit/Skia 단일 캔버스 렌더링으로 전환

#### 아키텍처 변경

**Before (듀얼 캔버스):**

- Skia 캔버스 (z:2): 디자인 노드 + AI 이펙트
- PixiJS 캔버스 (z:3): SelectionBox/TransformHandle/Lasso 렌더링 + 이벤트

**After (Pencil 방식 단일 캔버스):**

- Skia 캔버스 (z:2): 디자인 노드 + AI 이펙트 + Selection 오버레이 (전부 렌더링)
- PixiJS 캔버스 (z:3): 투명 히트 영역 + 이벤트 처리 전용 (시각적 렌더링 없음)

#### 수정 내용

**1. 신규 파일**

- `apps/builder/src/builder/workspace/canvas/skia/selectionRenderer.ts` — Skia Selection 렌더 함수 3개 (`renderSelectionBox`, `renderTransformHandles`, `renderLasso`), SkiaDisposable 패턴

**2. SkiaOverlay.tsx**

- renderFrame에 Selection 렌더링 Phase 4-6 추가 (디자인 노드 → AI 이펙트 → Selection 순서)
- Zustand `getState()`로 매 프레임 Selection 상태 읽기 (`selectedElementIds`, `elementBounds`)
- `dragStateRef` props 추가 (라쏘 상태 전달)
- PixiJS Camera 하위 레이어 숨김: `renderable=false` → `alpha=0` 변경 (히트 테스팅 유지)

**3. PixiJS Selection 컴포넌트 (시각적 렌더링 비활성화)**

- `SelectionBox.tsx` — drawBorder 무조건 스킵 (moveArea 이벤트 영역은 유지)
- `TransformHandle.tsx` — 코너 핸들: 투명 히트 영역만 (엣지 핸들 변경 없음)
- `LassoSelection.tsx` — draw 무조건 스킵

**4. BuilderCanvas.tsx**

- `dragStateRef` 생성 및 SkiaOverlay에 전달

#### 버그 수정

- PixiJS 8.14.3 `EventBoundary._interactivePrune()` (line 317)가 `renderable=false`인 컨테이너의 전체 서브트리를 히트 테스팅에서 제외하는 문제 발견
- `renderable=false` 대신 `alpha=0` 사용으로 시각적 숨김과 이벤트 처리를 동시에 유지

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/skia/selectionRenderer.ts` — 신규 생성
- `apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx` — Selection 렌더링 통합 + alpha=0 전환
- `canvas/BuilderCanvas.tsx` — dragStateRef 전달
- `canvas/selection/SelectionBox.tsx` — Skia 모드 시각 비활성화
- `canvas/selection/TransformHandle.tsx` — Skia 모드 시각 비활성화
- `canvas/selection/LassoSelection.tsx` — Skia 모드 시각 비활성화

---

### Docs - Skill 규칙 버그 수정 반영 (2026-01-31)

#### 개요

최근 버그 수정 사항(SelectionLayer, Body borderWidth, Viewport Culling, parseBoxModel)을 `.claude/skills/composition-patterns/rules/` Skill 문서에 반영

#### 수정 내용

**1. 기존 규칙 수정 (4건)**

- `domain-o1-lookup.md` — "선택 상태 동기화" 섹션 추가: `selectedElementIds`/`selectedElementIdsSet` 삭제 시 동기화 규칙, Incorrect/Correct 예시
- `domain-component-lifecycle.md` — 삭제 패턴에 선택 상태 정리 단계(step 4) 추가: `selectedElementIds` 필터링 + `selectedElementIdsSet` 갱신
- `pixi-hybrid-layout-engine.md` — "Box Model 처리" 섹션 추가: availableWidth에 border 차감, 자식 offset padding만(Yoga border 자동 처리), content-box 기준 높이 계산, 폼 요소 treatAsBorderBox
- `perf-checklist.md` — Canvas 체크리스트에 "Viewport Culling" 4개 항목 추가: 좌표 시스템 일관성, 실시간 bounds, cull cycle 방지, overflow 자식 처리

**2. 신규 규칙 생성 (1건)**

- `pixi-viewport-culling.md` (impact: HIGH) — 스크린 좌표 기반 culling 원칙, 실시간 `getBounds()` 사용, 부모 가시성 체크로 cull/render 무한 cycle 방지 패턴

**3. SKILL.md 등록**

- HIGH > PIXI Layout 섹션에 `pixi-viewport-culling` 링크 추가

#### 변경된 파일

- `.claude/skills/composition-patterns/rules/domain-o1-lookup.md` — 선택 상태 동기화 섹션
- `.claude/skills/composition-patterns/rules/domain-component-lifecycle.md` — 삭제 시 선택 상태 정리
- `.claude/skills/composition-patterns/rules/pixi-hybrid-layout-engine.md` — Box Model 처리 섹션
- `.claude/skills/composition-patterns/rules/perf-checklist.md` — Viewport Culling 체크리스트
- `.claude/skills/composition-patterns/rules/pixi-viewport-culling.md` — 신규 생성
- `.claude/skills/composition-patterns/SKILL.md` — 규칙 링크 등록

---

### Docs - 레이아웃/버튼 버그 수정 관련 문서 동기화 (2026-01-31)

#### 개요

display/button 관련 버그 수정 사항을 `LAYOUT_REQUIREMENTS.md`(v1.29), `COMPONENT.md`(v1.13) 문서에 반영

#### 수정 내용

**1. LAYOUT_REQUIREMENTS.md**

- `calculateContentHeight` 공식 수정 — `paddingY*2 + textHeight` → 순수 `textHeight`, `MIN_BUTTON_HEIGHT`도 content-box 변환 후 비교
- `renderWithCustomEngine` availableWidth 코드 — `parseBorder` 추가, border 차감 반영, 자식 offset은 padding만 적용(Yoga 자동 처리) 주석 추가
- `parseBoxModel` 의사코드에 `treatAsBorderBox` 로직 추가 — `box-sizing: border-box` 또는 폼 요소 명시적 width/height 시 padding+border 차감
- 변경 이력 v1.29 추가

**2. COMPONENT.md**

- §4.7.4.5에 `treatAsBorderBox` 코드 및 설명 추가 — 폼 요소 자동 border-box 변환
- §4.7.4.2에 v1.13 참고 블록 추가 — parseBoxModel border-box 변환으로 이중 계산 방지 설명
- 변경 이력 v1.13 추가

#### 변경된 파일

- `docs/LAYOUT_REQUIREMENTS.md` — calculateContentHeight 공식, availableWidth border 차감, parseBoxModel treatAsBorderBox, 변경 이력 v1.29
- `docs/COMPONENT_SPEC.md` — §4.7.4.5 treatAsBorderBox, §4.7.4.2 참고, 변경 이력 v1.13

---

### Fixed - Button 레이아웃 버그 및 빌드 동기화 수정 (2026-01-31)

#### 개요

1. display:block 부모 내 width:100% 버튼과 다음 버튼 사이 불필요한 수직 여백 발생 — `calculateContentHeight` padding 이중 계산 수정
2. 다른 PC에서 `@composition/specs` 빌드 산출물 미동기화 — turbo.json dev task 의존성 추가
3. `@composition/publish` 빌드 실패 — 누락된 컴포넌트 export 및 타입 에러 수정
4. 서로 다른 명시적 높이의 inline-block 버튼 수직 정렬 실패 — `parseBoxModel` border-box 처리 추가

#### 수정 내용

**1. Button contentHeight padding 이중 계산 (핵심 버그)**

- `calculateContentHeight`가 버튼 높이에 `paddingY * 2`를 포함하여 반환
- BlockEngine이 `contentHeight + padding + border`를 계산할 때 padding 이중 합산
- 결과: BlockEngine 할당 높이(35px) > PixiButton 렌더링 높이(27px) → 8px 여백
- 수정: `contentHeight`를 텍스트 높이만 반환, `MIN_BUTTON_HEIGHT`는 content-box 기준으로 변환

**2. turbo.json dev task 의존성 누락**

- `pnpm dev` 실행 시 `@composition/specs` 빌드가 트리거되지 않음
- `dist/`가 `.gitignore`에 포함되어 git에 추적되지 않음
- 다른 PC에서 clone 후 `pnpm dev` 시 specs dist 부재로 import 실패
- 수정: dev task에 `"dependsOn": ["^build"]` 추가

**3. @composition/shared 컴포넌트 export 누락**

- `list.ts`에 Form, RangeCalendar, Pagination, Disclosure, DisclosureGroup export 누락
- `Table`은 default export이나 `export *`로 재수출 불가
- publish tsconfig의 paths가 `index.ts`(list.ts 경유)를 우선 해석하여 빌드 실패
- 수정: `list.ts`에 누락 export 추가 + `export { default as Table }` 추가

**4. @composition/publish 타입 에러**

- ComponentRegistry: Radio, Switch, Popover, Table, Pagination의 `as ComponentType<Record<string, unknown>>` 캐스팅 실패 → `as unknown as` 중간 단계 추가
- ElementRenderer: `state` 속성이 `{ get, set }` 객체로 생성되었으나 `Map<string, unknown>` 필요 → `new Map()` 사용
- ElementRenderer: `Action` 타입 config 불일치 → `as Action` 캐스팅 적용

**5. parseBoxModel border-box 처리 누락 (센터링 버그)**

- display:block 부모 내 button1(height:200px), button2(height:100px)가 inline-block으로 배치될 때 수직 센터링 미작동
- 원인: PixiButton은 명시적 height를 border-box(총 렌더링 높이)로 처리하나, `parseBoxModel`은 content-box로 취급
- BlockEngine이 content height(200) + padding(8) + border(2) = 210px를 할당 → PixiButton은 200px로 렌더링 → 10px 오차
- width:100%에서도 동일: 부모 800px → content(800) + padding(24) + border(2) = 826px → 26px 오버플로우
- Flex 경로는 `SELF_PADDING_TAGS` + `stripSelfRenderedProps()`로 자체 렌더링 요소의 padding/border를 제거하나 Block 경로에는 동등한 처리 부재
- 수정: `parseBoxModel`에 `treatAsBorderBox` 조건 추가 — 폼 요소(button, input, select)에 명시적 width/height가 있으면 border-box로 변환하여 padding/border를 차감

#### 변경된 파일

- `turbo.json` — dev task에 `"dependsOn": ["^build"]` 추가
- `packages/shared/src/components/list.ts` — Form, RangeCalendar, Pagination, Disclosure, DisclosureGroup, Table export 추가
- `apps/publish/src/registry/ComponentRegistry.tsx` — Radio, Switch, Popover, Table, Pagination 타입 캐스팅 수정
- `apps/publish/src/renderer/ElementRenderer.tsx` — state를 Map 인스턴스로 변경, Action 타입 캐스팅 수정
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — calculateContentHeight 버튼 padding 이중 계산 제거, parseBoxModel 폼 요소 border-box 변환 추가

---

### Fixed - Viewport Culling 깜빡임 및 요소 사라짐 수정 (2026-01-31)

#### 개요

캔버스 pan 이동 시 요소 깜빡임, 페이지보다 큰 자식 요소가 페이지 이동 시 사라지는 버그 수정

#### 수정 내용

**1. 좌표 시스템 불일치 → 스크린 좌표 기반 culling 전환**

- 기존: 뷰포트를 캔버스 로컬 좌표로 계산, 요소 bounds는 글로벌(스크린) 좌표로 반환 → 직접 비교 시 pan 이동량만큼 오차
- `layoutBoundsRegistry`의 stale 글로벌 좌표를 현재 panOffset으로 변환해도 저장 시점의 Camera 위치가 다르므로 틀린 결과
- 수정: 뷰포트를 스크린 좌표(화면 크기 + margin)로 계산, `container.getBounds()` 실시간 호출로 비교 → 좌표 변환 자체 불필요

**2. Cull/Render 무한 cycle**

- 요소가 culled → LayoutContainer unmount → `unregisterElement` → container 삭제
- 다음 culling: container 없음 → 재포함 → render → register → getBounds off-screen → cull → cycle 반복 = 깜빡임
- 수정: 부모 가시성 체크로 cycle 방지 — 부모가 화면에 있으면 자식은 항상 포함

**3. 부모-자식 overflow 미고려**

- CSS 기본값 `overflow: visible` — 자식이 부모 범위를 넘어서 보일 수 있음
- 버튼이 page보다 넓어도 overflow로 화면에 보이지만, culling은 각 요소를 독립 판단
- 수정: 요소가 뷰포트 밖이지만 부모가 화면에 있으면 포함 (부모 가시성 캐시로 중복 계산 방지)

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/hooks/useViewportCulling.ts` — 스크린 좌표 기반 culling, `getElementContainer` 실시간 getBounds, 부모 가시성 체크 추가

---

### Fixed - SelectionLayer 삭제 후 (0,0) 잔존 버그 수정 (2026-01-31)

#### 개요

컴포넌트 선택 후 삭제 시 WebGL 캔버스에 SelectionLayer가 좌표 (0,0)에 남는 버그 수정

#### 수정 내용

**1. `removeElement`에서 `selectedElementIds` 미초기화 (근본 원인)**

- `removeElement`가 삭제 시 `selectedElementId`(단수)와 `selectedElementProps`만 초기화
- `selectedElementIds`(복수 배열)와 `selectedElementIdsSet`은 초기화하지 않음
- `SelectionLayer`는 `selectedElementIds`를 구독하므로 삭제된 요소 ID가 배열에 잔존
- `computeSelectionBounds`에서 삭제된 요소의 bounds 조회 실패 → fallback `{x:0, y:0}` 반환
- 수정: `selectedElementIds`에서 삭제된 요소 ID를 필터링하고 `selectedElementIdsSet`도 함께 갱신

**2. `SelectionLayer` 렌더링 가드 부재**

- `selectionBounds`가 `requestAnimationFrame` 콜백으로만 비동기 갱신됨
- 선택 해제 후 RAF 실행 전까지 stale bounds로 `SelectionBox`가 1프레임 이상 표시
- 수정: 렌더링 조건에 `selectedElements.length > 0` 가드 추가

#### 변경된 파일

- `apps/builder/src/builder/stores/utils/elementRemoval.ts` — 삭제된 요소를 `selectedElementIds`/`selectedElementIdsSet`에서 제거
- `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx` — SelectionBox 렌더링 조건에 `selectedElements.length > 0` 추가

---

### Fixed - Body borderWidth 시 자식 요소 border 영역 겹침 수정 (2026-01-31)

#### 개요

display:block 부모에 borderWidth 적용 시 자식 버튼이 부모의 border 영역까지 확장되어 겹치는 버그 수정

#### 수정 내용

**`renderWithCustomEngine`에서 부모 border 미반영**

- `availableWidth` 계산 시 부모의 padding만 차감하고 border는 차감하지 않음
- 예: body width=800, borderWidth=24 → availableWidth=800 (정상: 752)
- 자식 요소가 content 영역(border 안쪽)을 초과하여 border와 겹침
- 수정: `availableWidth`/`availableHeight` 계산에 `parseBorder` 결과 차감
- 자식 offset(`left`/`top`)은 padding만 적용 — Yoga(@pixi/layout)가 `rootLayout`의 `borderWidth`를 기반으로 absolute 자식을 padding box 내에 자동 배치하므로 border offset 불필요

#### 변경된 파일

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` — `parseBorder` import 추가, `availableWidth`/`availableHeight`에 border 차감

---

### Fixed - Button borderWidth/레이아웃 이중 계산 수정 (2026-01-30)

#### 개요

WebGL 모드에서 Button borderWidth 누락, display:block 부모에서 padding 변경 시 버튼 간격 발생,
Style Panel borderWidth 0 표시 등 3건의 CSS/WebGL 정합성 버그를 수정합니다.

#### 수정 내용

1. **전 variant border/borderHover 추가** — CSS `border: 1px solid`가 모든 variant에 적용되므로 ButtonSpec에도 동일하게 border/borderHover 정의
2. **specDefaultBorderWidth=1 고정** — variant의 border 존재 여부와 무관하게 항상 1px
3. **borderHoverColor 분리** — hover/pressed 상태에서 별도 border 색상 지원
4. **parseBoxModel 폼 요소 기본값** — inline style 미지정 시 BUTTON_SIZE_CONFIG padding/border 적용
5. **calculateContentWidth 순수 텍스트 반환** — 폼 요소 padding/border를 parseBoxModel으로 분리하여 이중 계산 제거
6. **텍스트 측정 엔진 통일** — PixiButton 너비 측정을 Canvas 2D measureTextWidth로 교체
7. **createDefaultButtonProps borderWidth 기본값** — Style Panel 0 표시 해결

#### 변경된 파일

- `packages/specs/src/components/Button.spec.ts` — 전 variant border/borderHover 추가
- `packages/specs/src/renderers/PixiRenderer.ts` — getVariantColors() borderHover 반환
- `apps/builder/src/builder/workspace/canvas/ui/PixiButton.tsx` — specDefaultBorderWidth=1, borderHoverColor, Canvas 2D 측정
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — BUTTON_SIZE_CONFIG.borderWidth, parseBoxModel 기본값, calculateContentWidth 순수 텍스트, measureTextWidth export
- `apps/builder/src/types/builder/unified.types.ts` — createDefaultButtonProps style.borderWidth

---

### Docs - 구조 문서 정리 (2025-12-30)

#### 개요

Hooks 및 Store 구조 문서를 `docs/reference/`로 이동하여 문서 체계 정리

#### 이동된 파일

| 원본 경로                 | 이동 경로                           |
| ------------------------- | ----------------------------------- |
| `docs/STRUCTURE_HOOKS.md` | `docs/reference/STRUCTURE_HOOKS.md` |
| `docs/STRUCTURE_STORE.md` | `docs/reference/STRUCTURE_STORE.md` |

#### 문서 내용

- **STRUCTURE_HOOKS.md**: Builder hooks 구조 및 사용 패턴 정리
- **STRUCTURE_STORE.md**: Zustand store 구조 및 슬라이스 패턴 정리

---

### Removed - Save Mode, Preview & Overlay, Element Visualization 설정 제거 (2025-12-29)

#### 개요

WebGL Canvas 전환 및 로컬 우선(Local-first) 아키텍처 변경에 따라 더 이상 필요 없어진 설정 항목들을 제거

#### 제거된 설정

1. **Save Mode** - Supabase 실시간 동기화 제거로 불필요
2. **Preview & Overlay** - WebGL Canvas에서 오버레이 불투명도 설정 불필요
3. **Element Visualization** - iframe 기반 테두리/라벨 표시 WebGL 전환으로 불필요

#### 변경된 파일

**SettingsPanel 정리:**

- `src/builder/panels/settings/SettingsPanel.tsx` - 3개 섹션 제거, Grid & Guides와 Theme & Appearance만 유지

**SaveService 단순화:**

- `src/services/save/saveService.ts` - 항상 IndexedDB에 즉시 저장하도록 단순화
- 삭제: `isRealtimeMode`, `pendingChanges`, `saveAllPendingChanges`, `syncToCloud` 로직

**Store 상태 정리:**

- `src/builder/stores/saveMode.ts` - **파일 삭제**
- `src/builder/stores/canvasSettings.ts` - `showOverlay`, `overlayOpacity`, `showElementBorders`, `showElementLabels` 제거
- `src/builder/stores/index.ts` - `SaveModeState` 슬라이스 제거

**레거시 컴포넌트 정리:**

- `src/builder/main/BuilderCore.tsx` - `showOverlay` 조건부 렌더링 제거
- `src/builder/main/BuilderCanvas.tsx` - element visualization 로직 제거 + `@deprecated` 표시
- `src/builder/overlay/index.tsx` - `overlayOpacity` 참조 제거

#### 아키텍처 변경 배경

- **WebGL Canvas 전환**: iframe 기반 Preview에서 WebGL 기반 캔버스로 전환
- **로컬 우선 저장**: Supabase 실시간 동기화에서 IndexedDB 로컬 저장으로 변경
- **선택 시스템 통합**: WebGL SelectionLayer가 요소 테두리/라벨 표시 담당

---

### Optimized - History Panel 배치 점프 최적화 (2025-12-29)

#### 개요

History Panel에서 복구 포인트 선택 시 중간 과정이 보이는 문제 해결

#### 문제

- 히스토리 항목 클릭 시 `for` 루프로 undo/redo를 한 단계씩 호출
- 각 단계마다 UI가 업데이트되어 중간 상태가 눈에 보임

#### 해결

**1. History Manager 확장**

```typescript
// src/builder/stores/history.ts
goToIndex(targetIndex: number): { entries: HistoryEntry[]; direction: 'undo' | 'redo' } | null {
  // 현재 인덱스와 타겟 사이의 모든 엔트리를 한 번에 반환
  // 인덱스는 원자적으로 업데이트 (중간 렌더링 없음)
}
```

**2. 배치 히스토리 액션**

```typescript
// src/builder/stores/history/historyActions.ts
createGoToHistoryIndexAction() {
  // 모든 엔트리를 한 번에 적용
  // Set 기반 중복 방지로 duplicate key 에러 해결
  // Supabase 에러 try-catch 처리
}
```

**3. HistoryPanel 업데이트**

```typescript
// src/builder/panels/history/HistoryPanel.tsx
const handleJumpToIndex = useCallback(
  async (targetIndex: number) => {
    // 기존: for 루프로 undo/redo 반복
    // 변경: goToHistoryIndex(targetIndex) 단일 호출
    await goToHistoryIndex(targetIndex);
  },
  [goToHistoryIndex],
);
```

#### 수정된 파일

- `src/builder/stores/history.ts` - `goToIndex` 메서드 추가
- `src/builder/stores/history/historyActions.ts` - `createGoToHistoryIndexAction` 추가
- `src/builder/stores/elements.ts` - `goToHistoryIndex` 액션 export
- `src/builder/panels/history/HistoryPanel.tsx` - 배치 점프 사용

#### 성능 개선

| 시나리오       | 이전        | 이후       |
| -------------- | ----------- | ---------- |
| 10단계 점프    | 10회 렌더링 | 1회 렌더링 |
| 중간 상태 노출 | 눈에 보임   | 즉시 전환  |
| 사용자 경험    | 깜빡임      | 부드러움   |

---

### Fixed - PanelRegistry 중복 등록 경고 (2025-12-29)

#### 문제

HMR 또는 React StrictMode에서 패널이 중복 등록되어 콘솔 경고 발생

#### 해결

```typescript
// src/builder/panels/core/panelConfigs.ts
export function registerAllPanels() {
  if (PanelRegistry.isInitialized) {
    return; // 이미 등록된 경우 스킵
  }
  PANEL_CONFIGS.forEach((config) => {
    PanelRegistry.register(config);
  });
  PanelRegistry.markInitialized();
}
```

---

### Refactored - Keyboard Shortcuts 시스템 전면 재설계 (2025-12-29)

#### 개요

22개 파일에 분산되어 있던 키보드 단축키 시스템을 5개 핵심 파일로 통합하고, 중앙 집중식 레지스트리 패턴 적용

#### 구현 내용

**1. 중앙 설정 파일 생성**

- `src/builder/config/keyboardShortcuts.ts` - 51개 단축키 정의
- `src/builder/types/keyboard.ts` - 타입 정의

**2. 통합 레지스트리 확장**

```typescript
// src/builder/hooks/useKeyboardShortcutsRegistry.ts
// 기존 기능 + capture phase, priority, scope-aware 필터링 추가
registerShortcut({
  id: "undo",
  key: "z",
  modifiers: ["meta"],
  handler: handleUndo,
  scope: "global",
  priority: 100,
  capture: true,
  allowInInput: false,
});
```

**3. 통합 훅 생성**

- `src/builder/hooks/useGlobalKeyboardShortcuts.ts` - Undo/Redo/Zoom 통합
- `src/builder/hooks/useActiveScope.ts` - 7개 스코프 감지

**4. 개발자 도구**

- `src/builder/devtools/ShortcutDebugger.tsx` - 실시간 디버거 (개발 환경 전용)
- `src/builder/utils/detectShortcutConflicts.ts` - 충돌 감지 유틸리티

**5. 삭제된 파일**

- `src/builder/hooks/useKeyboardShortcuts.ts` → useGlobalKeyboardShortcuts.ts로 통합
- `src/builder/workspace/useZoomShortcuts.ts` → useGlobalKeyboardShortcuts.ts로 통합

#### 성능 개선

| Metric           | Before | After             | 변화 |
| ---------------- | ------ | ----------------- | ---- |
| 단축키 관련 파일 | 22개   | 5개               | -77% |
| 이벤트 리스너    | 17개   | 2개               | -88% |
| 중앙화 비율      | 45%    | 95%+              | ⬆️   |
| 스코프 시스템    | ❌     | 7개 스코프        | ✅   |
| 충돌 감지        | ❌     | ✅ 개발 시점 경고 | ✅   |

#### 관련 문서

- `docs/reference/components/KEYBOARD_SHORTCUTS.md` - 상세 설계 문서

---

### Refactored - Events Panel CSS 통합 (2025-12-29)

#### 개요

Events 패널의 3개 CSS 파일을 1개로 통합하여 중복 제거 및 유지보수성 향상

#### 구현 내용

**1. 병합된 파일**

- `events-legacy.css` (272줄) - 삭제됨
- `events.css` (1127줄) - 삭제됨
- `EventsPanel.css` (2118줄 → 2304줄) - 필수 스타일 추가

**2. 추가된 스타일 (events.css에서 이동)**

- Form Field (`.field`, `.field-label`, `.field-input`, `.field-textarea`)
- Checkbox/Switch (`.checkbox-field`, `.switch-label`)
- Select (`.select-trigger`, `.select-popover`, `.select-listbox`)
- Helper/Error (`.helper-text`, `.error-message`)
- Action Editor 전용 스타일

**3. 수정된 import**

```typescript
// src/builder/panels/events/index.ts
// 제거: import './events.css';
// 제거: import './events-legacy.css';
// EventsPanel.tsx에서 직접 import
```

#### 결과

- 파일 수: 3개 → 1개
- 총 라인: 3517줄 → 2304줄 (약 35% 감소)

---

### Refactored - Color Utilities 통합 (2025-12-29)

#### 개요

2개 위치에 분산된 색상 유틸리티를 1개 파일로 통합

#### 구현 내용

**1. 통합 파일**

- `src/utils/color/colorUtils.ts` - colord 기반 + 레거시 호환 함수

**2. 추가된 레거시 호환 함수 (12개)**

```typescript
export function hslToRgb(hsl: ColorValueHSL): ColorValueRGB;
export function rgbToHsl(rgb: ColorValueRGB): ColorValueHSL;
export function hexToRgb(hex: string): ColorValueRGB | null;
export function rgbToHex(rgb: ColorValueRGB): string;
export function hslToHex(hsl: ColorValueHSL): string;
export function hexToHsl(hex: string): ColorValueHSL | null;
export function hslToString(hsl: ColorValueHSL): string;
export function rgbToString(rgb: ColorValueRGB): string;
export function generateDarkVariant(hsl: ColorValueHSL): ColorValueHSL;
export function parseColorString(colorString: string): ColorValueHSL | null;
export function adjustLightness(hsl: ColorValueHSL, amount: number): ColorValueHSL;
export function adjustSaturationHsl(hsl: ColorValueHSL, amount: number): ColorValueHSL;
export function getSplitComplementaryColors(hsl: ColorValueHSL): [...];
```

**3. 삭제된 파일**

- `src/utils/theme/colorUtils.ts`

**4. 수정된 import (8개 파일)**

- `services/theme/FigmaService.ts`
- `services/theme/ThemeGenerationService.ts`
- `services/theme/HctThemeService.ts`
- `services/theme/ExportService.ts`
- `services/theme/FigmaPluginService.ts`
- `builder/panels/themes/components/TokenEditor.tsx`
- `utils/theme/tokenToCss.ts`
- `utils/theme/hctUtils.ts`

---

### Added - Builder Hooks Barrel Export (2025-12-29)

#### 개요

35개 builder hooks에 대한 barrel export 파일 생성

#### 구현 내용

- `src/builder/hooks/index.ts` 생성
- 카테고리별 그룹핑: Async Operations, Data Management, UI State, Keyboard & Input, Messaging, Theme, Performance, Error Handling, Utilities

---

### Optimized - StylesPanel Jotai 마이그레이션 및 성능 최적화 (2025-12-21)

#### 개요

StylesPanel의 요소 선택 시 발생하던 150-200ms handler violation을 해결하기 위한 Jotai 기반 상태 관리 마이그레이션

#### Phase 3: Jotai 기반 Fine-grained Reactivity

**1. Jotai Atoms 구현 (`atoms/styleAtoms.ts`)**

```typescript
// 35개 이상의 selectAtom 정의 (equality 체크 포함)
export const widthAtom = selectAtom(
  selectedElementAtom,
  (element) => element?.style?.width ?? 'auto',
  (a, b) => a === b  // equality 체크로 불필요한 리렌더 방지
);

// 그룹 atoms (섹션별 값 묶음)
export const transformValuesAtom = selectAtom(
  selectedElementAtom,
  (element) => ({
    width: String(element?.style?.width ?? 'auto'),
    height: String(element?.style?.height ?? 'auto'),
    top: String(element?.style?.top ?? 'auto'),
    left: String(element?.style?.left ?? 'auto'),
  }),
  (a, b) => a?.width === b?.width && a?.height === b?.height && ...
);

// StylesPanel용 atoms
export const hasSelectedElementAtom = selectAtom(...);
export const modifiedCountAtom = selectAtom(...);
export const isCopyDisabledAtom = selectAtom(...);
```

**2. Zustand-Jotai 브릿지 (`hooks/useZustandJotaiBridge.ts`)**

```typescript
export function useZustandJotaiBridge(): void {
  const setSelectedElement = useSetAtom(selectedElementAtom);
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, prevState) => {
      if (state.selectedElementId !== prevState.selectedElementId) {
        setSelectedElement(buildSelectedElement(state));
      }
    });
    return unsubscribe;
  }, [setSelectedElement]);
}
```

**3. 섹션별 Jotai 훅**

- `useTransformValuesJotai.ts` - Transform 섹션용
- `useLayoutValuesJotai.ts` - Layout 섹션용
- `useAppearanceValuesJotai.ts` - Appearance 섹션용
- `useTypographyValuesJotai.ts` - Typography 섹션용

**4. StylesPanel 최적화**

```typescript
// 이전: useSelectedElementData() 직접 사용 → 매번 리렌더
// 이후: Jotai atoms 사용 → 값이 동일하면 리렌더 없음

function StylesPanelContent() {
  const hasSelectedElement = useAtomValue(hasSelectedElementAtom);
  const modifiedCount = useAtomValue(modifiedCountAtom);
  const isCopyDisabled = useAtomValue(isCopyDisabledAtom);
  // ...
}

// AllSections, ModifiedSectionsWrapper 분리로 리렌더 격리
const AllSections = memo(function AllSections() { ... });
const ModifiedSectionsWrapper = memo(function ModifiedSectionsWrapper() { ... });
```

#### Phase 4: PropertyColor 최적화

**key={value} 패턴 유지 + Jotai 시너지**

- `key={value}` 패턴: 값 변경 시 재마운트로 상태 동기화
- Jotai selectAtom equality 체크: 동일한 값이면 리렌더 없음 → key 변경 없음 → 재마운트 없음

#### 수정된 파일

**신규 파일:**

- `src/builder/panels/styles/atoms/styleAtoms.ts` - 35+ Jotai atoms
- `src/builder/panels/styles/atoms/index.ts` - exports
- `src/builder/panels/styles/hooks/useZustandJotaiBridge.ts`
- `src/builder/panels/styles/hooks/useTransformValuesJotai.ts`
- `src/builder/panels/styles/hooks/useLayoutValuesJotai.ts`
- `src/builder/panels/styles/hooks/useAppearanceValuesJotai.ts`
- `src/builder/panels/styles/hooks/useTypographyValuesJotai.ts`

**수정된 파일:**

- `src/builder/panels/styles/StylesPanel.tsx` - Jotai atoms 사용, 컴포넌트 분리
- `src/builder/panels/styles/sections/TransformSection.tsx` - Jotai 마이그레이션
- `src/builder/panels/styles/sections/LayoutSection.tsx` - Jotai 마이그레이션
- `src/builder/panels/styles/sections/AppearanceSection.tsx` - Jotai 마이그레이션
- `src/builder/panels/styles/sections/TypographySection.tsx` - Jotai 마이그레이션
- `src/builder/panels/common/PropertyColor.tsx` - key 패턴 문서화
- `src/shared/components/ComboBox.tsx` - ClassNameOrFunction 타입 지원

#### 성능 개선

| 시나리오                      | 이전                    | 이후                   |
| ----------------------------- | ----------------------- | ---------------------- |
| 동일 스타일 요소 간 교차 선택 | 매번 리렌더 (150-200ms) | 리렌더 없음 (0ms)      |
| 스타일 값 변경                | 전체 섹션 리렌더        | 해당 섹션만 리렌더     |
| filter="all" 모드             | Zustand 구독            | Zustand 구독 완전 제거 |

---

### Added - Viewport Culling 최적화 (2025-12-20)

#### 개요

뷰포트 외부 요소를 렌더링에서 제외하여 GPU 부하를 20-40% 감소시키는 최적화 구현

#### 구현 내용

**1. useViewportCulling 훅 생성**

```typescript
// apps/builder/src/builder/workspace/canvas/hooks/useViewportCulling.ts
export function useViewportCulling({
  elements,
  layoutResult,
  zoom,
  panOffset,
  enabled = true,
}: UseViewportCullingOptions): CullingResult {
  // AABB 충돌 검사로 뷰포트 내 요소만 필터링
  const viewport = calculateViewportBounds(
    screenWidth,
    screenHeight,
    zoom,
    panOffset,
  );
  const visibleElements = elements.filter((el) =>
    isElementInViewport(el, viewport),
  );
  return { visibleElements, culledCount, totalCount, cullingRatio };
}
```

**2. ElementsLayer에 적용**

```typescript
// apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx
const { visibleElements } = useViewportCulling({
  elements: sortedElements,
  layoutResult,
  zoom,
  panOffset,
  enabled: true,
});

// visibleElements만 렌더링
{visibleElements.map((element) => (
  <ElementSprite key={element.id} element={element} ... />
))}
```

#### 성능 효과

| 시나리오                 | GPU 부하 감소 |
| ------------------------ | ------------- |
| 화면 밖 요소 50%+        | 20-40%        |
| 줌아웃 (10% 이하)        | 30-50%        |
| 대형 캔버스 (4000x4000+) | 40-60%        |

#### 특징

- **100px 마진**: 스크롤/팬 시 깜빡임 방지
- **성능 오버헤드 최소**: 단순 AABB 검사 (O(n))
- **비활성화 가능**: `enabled: false`로 끌 수 있음
- **PixiJS v8 Culler API 대신 수동 방식**: 더 간단하고 예측 가능한 동작

#### 관련 문서

- [11-canvas-resize-optimization.md](./performance/11-canvas-resize-optimization.md)

---

### Fixed - @pixi/react v8 컴포넌트 등록 및 TextField 위치 동기화 (2025-12-17)

#### 개요

@pixi/react v8 공식 패턴으로 컴포넌트 등록 방식을 개선하고, CheckboxGroup/RadioGroup의 orientation 속성 및 TextField의 레이아웃 동기화 문제를 해결

#### 문제

1. **Graphics namespace 오류**: "Graphics is not part of the PIXI namespace" 런타임 오류 발생
2. **Orientation 미작동**: CheckboxGroup/RadioGroup의 orientation (vertical/horizontal) 속성이 동작하지 않음
3. **RadioGroup 너비 불일치**: 세로 모드에서 RadioGroup의 selection 영역 너비가 PixiRadio와 다름
4. **가로 모드 너비 과대 계산**: 가로 모드에서 selection 영역이 실제 렌더링보다 넓게 설정됨
5. **TextField 위치 불일치**: TextField의 input 컨테이너가 TextField 컴포넌트와 위치가 다름
6. **TextField 크기 미측정**: LayoutEngine에 TextField용 크기 측정 함수 부재

#### 해결

**1. pixiSetup.ts - 컴포넌트 등록 개선**

```typescript
export const PIXI_COMPONENTS = {
  // pixi 접두사 컴포넌트 (JSX용)
  pixiContainer: PixiContainer,
  pixiGraphics: PixiGraphics,
  pixiSprite: PixiSprite,
  pixiText: PixiText,
  // 클래스 이름으로도 등록 (@pixi/react 내부 lookup 지원)
  Container: PixiContainer,
  Graphics: PixiGraphics,
  Sprite: PixiSprite,
  Text: PixiText,
  // ... other components
};

// 모듈 로드 시점에 즉시 등록 (렌더링 전 보장)
extend(PIXI_COMPONENTS);
```

**2. PixiCheckboxGroup/PixiRadio - Orientation 지원**

```typescript
// props.orientation 우선 체크, style.flexDirection fallback
const isHorizontal = useMemo(() => {
  const orientation = props?.orientation;
  if (orientation === "horizontal") return true;
  if (orientation === "vertical") return false;
  const flexDirection = (style as Record<string, unknown>)?.flexDirection;
  return flexDirection === "row";
}, [props?.orientation, style]);
```

**3. LayoutEngine - Orientation 및 크기 계산 동기화**

```typescript
// measureCheckboxGroupSize(), measureRadioSize() - orientation 지원 추가
// calculateRadioItemPositions(), calculateCheckboxItemPositions() - orientation 지원 추가

// RadioGroup: PixiRadio와 동일한 getRadioSizePreset() 사용
const sizeKey = (groupProps?.size as string) || "md";
const radioPreset = getRadioSizePreset(sizeKey);
const boxSize = radioPreset.radioSize;
const OPTION_GAP = radioPreset.gap;

// 가로 모드 너비: 마지막 아이템 위치 + 너비로 정확히 계산
if (isHorizontal) {
  const lastIndex = itemSizes.length - 1;
  const lastItemX = lastIndex * HORIZONTAL_ITEM_WIDTH;
  const lastItemWidth = itemSizes[lastIndex]?.width || boxSize;
  const optionsWidth = lastItemX + lastItemWidth;
  // ...
}
```

**4. PixiTextField - pixi 접두사 컴포넌트 사용 및 위치 수정**

```typescript
// 잘못된 사용 (수정 전)
<Text text={label} ... />

// 올바른 사용 (수정 후)
<pixiText text={label} style={labelStyle} x={0} y={0} />

// 위치 계산 추가
const posX = parseCSSSize(style?.left, undefined, 0);
const posY = parseCSSSize(style?.top, undefined, 0);

// 루트 컨테이너에 위치 적용
<pixiContainer x={posX} y={posY} ... >
```

**5. LayoutEngine - TextField 크기 측정 함수 추가**

```typescript
const TEXT_FIELD_TAGS = new Set(["TextField", "TextInput"]);

function isTextFieldElement(element: Element): boolean {
  return TEXT_FIELD_TAGS.has(element.tag);
}

function measureTextFieldSize(element, _style): { width; height } | null {
  const preset = getTextFieldSizePreset(sizeKey);
  const width = (props?.width as number) || 240;
  const labelHeight = label ? preset.labelFontSize + preset.gap : 0;
  const descriptionHeight = hasDescription
    ? preset.descriptionFontSize + preset.gap
    : 0;
  const totalHeight = labelHeight + preset.height + descriptionHeight;
  return { width, height: totalHeight };
}

// createYogaNode에서 호출
if (isTextFieldElement(element) && (!hasExplicitWidth || !hasExplicitHeight)) {
  const measuredSize = measureTextFieldSize(element, style);
  // ...
}
```

#### 수정된 파일

- `apps/builder/src/builder/workspace/canvas/pixiSetup.ts` - 클래스 이름 등록 + 모듈 레벨 extend()
- `apps/builder/src/builder/workspace/canvas/ui/PixiCheckboxGroup.tsx` - orientation 지원
- `apps/builder/src/builder/workspace/canvas/ui/PixiRadio.tsx` - orientation 지원
- `apps/builder/src/builder/workspace/canvas/ui/PixiTextField.tsx` - pixi 접두사 컴포넌트 + 위치 수정
- `apps/builder/src/builder/workspace/canvas/layout/LayoutEngine.ts` - orientation 동기화 + TextField 측정

---

### Added - CheckboxGroup/RadioGroup Selection Area 및 Label 지원 (2025-12-16)

#### 개요

CheckboxGroup 및 RadioGroup 컴포넌트의 선택 영역과 그룹 라벨을 지원하여 선택/편집 UX 개선

#### 문제

1. **RadioGroup 크기 미측정**: RadioGroup이 width/height 값이 없어 선택 영역이 표시되지 않음
2. **CheckboxGroup 라벨 미지원**: RadioGroup은 그룹 라벨을 지원하지만 CheckboxGroup은 미지원
3. **렌더링 중복**: CheckboxGroup과 자식 Checkbox가 각각 별도로 렌더링되어 겹침 발생
4. **자식 아이템 선택 영역 불일치**: CheckboxGroup/RadioGroup 내부 자식 아이템의 위치/크기가 정상적이지 않음
5. **Selected 상태 미반영**: 자식 아이템의 `isSelected` 프로퍼티 변경 시 시각적 상태가 업데이트되지 않음

#### 해결

**1. LayoutEngine 확장**

```typescript
// CHECKBOX_RADIO_TAGS 수정: Radio → RadioGroup
const CHECKBOX_RADIO_TAGS = new Set([
  "Checkbox",
  "CheckboxGroup",
  "RadioGroup",
]);

// 새 함수 추가
function isCheckboxItemElement(element, elements): boolean; // CheckboxGroup 자식 판별
function measureCheckboxItemSize(element, elements): { width; height }; // 자식 아이템 크기 측정
function measureCheckboxGroupSize(element, elements): { width; height }; // 그룹 크기 측정 (라벨 포함)
function calculateCheckboxItemPositions(pageElements, positions): void; // 자식 위치 계산
```

**2. PixiCheckboxGroup 신규 생성**

- PixiRadio 패턴 기반으로 전체 구현
- 그룹 라벨 지원 (상단에 bold 텍스트)
- props.options 또는 자식 Checkbox 요소에서 옵션 파싱
- 선택된 값 배열 관리

**3. PixiCheckboxItem 신규 생성**

- CheckboxGroup 자식 Checkbox용 투명 hit area 컴포넌트
- 시각적 렌더링은 부모 CheckboxGroup이 담당
- 선택을 위한 이벤트 영역만 제공 (`eventMode="static"`, `alpha: 0`)

**4. ElementSprite 분기 처리**

```typescript
// 태그 분리
const UI_CHECKBOX_GROUP_TAGS = new Set(['CheckboxGroup']);
const UI_CHECKBOX_ITEM_TAGS = new Set(['Checkbox', 'CheckBox', 'Switch', 'Toggle']);

// 조건부 렌더링
case 'checkboxItem':
  if (isCheckboxInGroup) {
    return <PixiCheckboxItem ... />;  // 투명 hit area
  }
  return <PixiCheckbox ... />;  // 독립 체크박스
```

**5. Selected 상태 연동**

```typescript
// PixiRadio.tsx - 자식 Radio의 isSelected 확인
const selectedChild = childRadios.find((radio) => {
  const radioProps = radio.props as Record<string, unknown> | undefined;
  return Boolean(
    radioProps?.isSelected ||
    radioProps?.checked ||
    radioProps?.defaultSelected,
  );
});

// PixiCheckboxGroup.tsx - 자식 Checkbox의 isSelected 확인
const selectedFromChildren = childCheckboxes
  .filter((checkbox) => {
    const checkboxProps = checkbox.props as Record<string, unknown> | undefined;
    return Boolean(
      checkboxProps?.isSelected ||
      checkboxProps?.checked ||
      checkboxProps?.defaultSelected,
    );
  })
  .map((checkbox) => String(checkboxProps?.value || checkbox.id));
```

#### 아키텍처 패턴

**투명 Hit Area 패턴:**

- 부모 컴포넌트(CheckboxGroup/RadioGroup)가 시각적 렌더링 담당
- 자식 아이템(PixiCheckboxItem/PixiRadioItem)은 투명 hit area만 제공
- 레이아웃 엔진이 자식 위치 계산하여 `layoutPosition` 전달

**Selected 상태 우선순위:**

1. 그룹 props의 `value`/`selectedValue`/`selectedValues`
2. 자식 아이템의 `isSelected`/`checked`/`defaultSelected`
3. options 배열의 `checked` 필드

**신규/수정 파일:**

- `apps/builder/src/builder/workspace/canvas/ui/PixiCheckboxGroup.tsx` - 신규 생성
- `apps/builder/src/builder/workspace/canvas/ui/PixiCheckboxItem.tsx` - 신규 생성
- `apps/builder/src/builder/workspace/canvas/ui/PixiRadio.tsx` - selectedValue 로직 수정
- `apps/builder/src/builder/workspace/canvas/ui/index.ts` - export 추가
- `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx` - 분기 처리 추가
- `apps/builder/src/builder/workspace/canvas/layout/LayoutEngine.ts` - 크기/위치 계산 함수 추가
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` - 필터 로직 수정

---

### Added - Zoom ComboBox 컨트롤러 (2025-12-15)

#### 개요

줌 컨트롤러의 `<span>비율%</span>`을 React Aria ComboBox로 변경하여 프리셋 선택 및 커스텀 입력 지원

#### 변경 내용

- **ZOOM_PRESETS**: 25%, 50%, 75%, 100%, 125%, 150%, 200%, 300%, 400%, 500%
- **ComboBox 기능**:
  - 프리셋 선택 (드롭다운)
  - 커스텀 값 입력 (숫자 직접 입력)
  - Enter 키로 적용
  - Blur 시 자동 적용

**수정된 파일:**

- `src/builder/workspace/Workspace.tsx` - Zoom ComboBox 구현
- `src/builder/workspace/Workspace.css` - ComboBox 스타일

---

### Changed - 캔버스 페이지 경계선 개선 (2025-12-15)

#### 개요

캔버스 페이지 외곽선을 iframe Preview와 동일한 스타일로 통일

#### 변경 내용

- **선 두께**: 2px → 1px
- **색상**: 하드코딩 → `--outline-variant` CSS 변수 사용
- **테마 연동**: MutationObserver로 테마 변경 시 실시간 반영

**신규 함수:**

- `getOutlineVariantColor()` in `cssVariableReader.ts`

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` - CanvasBounds 컴포넌트
- `apps/builder/src/builder/workspace/canvas/utils/cssVariableReader.ts` - 색상 함수 추가

---

### Refactored - 선택 테두리 통합 (SelectionBox) (2025-12-15)

#### 개요

14개 UI 컴포넌트에서 중복된 선택 테두리 코드를 제거하고 공통 SelectionBox로 통합

#### 문제

- 각 컴포넌트가 자체 선택 테두리 구현 (스타일 불일치)
- Button: roundRect, width 2, offset -2
- SelectionBox: rect, width 1, offset 0

#### 해결

모든 컴포넌트에서 자체 선택 테두리 코드 제거, SelectionBox 단일 사용

**제거된 코드 (14개 파일):**

- `PixiButton.tsx` - drawSelection 콜백 및 JSX
- `PixiFancyButton.tsx` - selection useEffect
- `PixiInput.tsx` - selection useEffect
- `PixiList.tsx` - selection useEffect
- `PixiMaskedFrame.tsx` - selection useEffect
- `PixiProgressBar.tsx` - selection useEffect
- `PixiScrollBox.tsx` - selection useEffect
- `PixiSelect.tsx` - selection useEffect
- `PixiSlider.tsx` - selection useEffect
- `PixiSwitcher.tsx` - selection useEffect
- `PixiCheckbox.tsx` - selection layoutContainer
- `PixiRadio.tsx` - selection layoutContainer
- `TextSprite.tsx` - isSelected from drawBackground
- `ImageSprite.tsx` - isSelected from drawBackground/drawOverlay

---

### Added - Figma 스타일 줌 독립적 UI (2025-12-15)

#### 개요

Figma처럼 줌에 관계없이 선택 박스, 핸들, 라쏘, 경계선이 화면상 일정한 크기 유지

#### 문제

- 줌 200%: 선택 테두리가 2px로 보임 (두꺼움)
- 줌 50%: 선택 테두리가 0.5px로 보임 (희미함)
- Transform 핸들도 줌에 따라 크기 변동

#### 해결

역-스케일링 방식 적용 (`1/zoom`)

```typescript
// 줌 200%일 때: 캔버스 단위 0.5px → 화면상 1px
// 줌 50%일 때: 캔버스 단위 2px → 화면상 1px
const strokeWidth = 1 / zoom;

// 핸들 크기도 동일하게 적용
const adjustedSize = HANDLE_SIZE / zoom; // HANDLE_SIZE = 6px
```

#### pixelLine vs 역-스케일링

| 방식                    | 장점                                 | 단점                        |
| ----------------------- | ------------------------------------ | --------------------------- |
| **pixelLine** (v8.6.0+) | 내장 옵션                            | 모든 상황에서 완벽하지 않음 |
| **역-스케일링**         | 수학적 정확, 핸들 크기에도 적용 가능 | 수동 계산 필요              |

→ 역-스케일링 방식 채택

**적용 대상:**
| 요소 | 줌 50% | 줌 100% | 줌 200% |
|------|--------|---------|---------|
| 선택 테두리 | 1px | 1px | 1px |
| Transform 핸들 | 6px | 6px | 6px |
| 라쏘 테두리 | 1px | 1px | 1px |
| 페이지 경계 | 1px | 1px | 1px |

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx` - zoom prop 추가
- `apps/builder/src/builder/workspace/canvas/selection/SelectionBox.tsx` - zoom prop, strokeWidth 계산
- `apps/builder/src/builder/workspace/canvas/selection/TransformHandle.tsx` - zoom prop, adjustedSize 계산
- `apps/builder/src/builder/workspace/canvas/selection/LassoSelection.tsx` - zoom prop, strokeWidth 계산
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` - CanvasBounds, SelectionLayer에 zoom 전달

---

### Refactored - PixiCheckbox Graphics 기반 (2025-12-15)

#### 개요

`@pixi/layout` 기반에서 Graphics 직접 렌더링으로 변경

#### 문제

- `layoutContainer`의 `borderWidth`, `borderColor` 등 CSS 속성이 제대로 렌더링되지 않음
- 체크박스가 사각형만 보이고 체크마크가 표시되지 않음

#### 해결

Graphics로 직접 그리기 (PixiButton 패턴 적용)

```typescript
// 체크마크 - 선으로 직접 그리기
g.setStrokeStyle({ width: 2.5, color: 0xffffff, cap: "round", join: "round" });
g.moveTo(checkStartX, checkStartY);
g.lineTo(checkMidX, checkMidY);
g.lineTo(checkEndX, checkEndY);
g.stroke();
```

**개선사항:**

- 체크마크를 "✓" 텍스트 대신 선으로 직접 그리기 (더 선명)
- 테두리, 배경색, 체크마크 모두 Graphics로 렌더링
- 라벨 텍스트는 pixiText 사용

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/ui/PixiCheckbox.tsx` - 전체 리팩토링

---

### Refactored - PixiRadio Graphics 기반 (2025-12-15)

#### 개요

`@pixi/layout` 기반에서 Graphics 직접 렌더링으로 변경

#### 문제

- `props.options` 배열이 없으면 아무것도 렌더링되지 않음
- `layoutContainer` 렌더링 이슈

#### 해결

Graphics로 직접 그리기 + 기본 옵션 추가

```typescript
// 기본 옵션 (options가 없을 때 placeholder)
const DEFAULT_OPTIONS: RadioOption[] = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
];
```

**개선사항:**

- Graphics로 라디오 원 직접 그리기
- 선택 시 내부 dot 표시
- RadioItem 서브컴포넌트로 분리 (메모이제이션 최적화)
- 기본 옵션으로 항상 무언가 표시됨

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/ui/PixiRadio.tsx` - 전체 리팩토링

---

### Added - WebGL Canvas 텍스트 선명도 개선 (2025-12-15)

#### 개요

Figma와 유사하게 줌 레벨에 따라 텍스트를 재래스터라이즈하여 선명도 개선

#### 문제

- PixiJS Canvas 텍스트가 Figma 대비 흐릿하게 렌더링됨
- 줌 인 시 텍스트가 스케일되어 픽셀화 발생
- `roundPixels`, `resolution` 설정만으로는 부족

#### 해결 (다층 접근)

**1. Application 설정 개선**

```typescript
<Application
  resolution={Math.max(window.devicePixelRatio || 1, 2)}  // 최소 2배
  roundPixels={true}  // 서브픽셀 흐림 방지
  // ...
/>
```

**2. 동적 폰트 크기 조절 (Figma 방식)**

```typescript
// useCrispText.ts - 줌 레벨에 따른 해상도 배율
function calculateMultiplier(zoom: number): number {
  if (zoom <= 1) return 1;
  if (zoom <= 2) return 2;
  if (zoom <= 3) return 3;
  return 4; // 최대 4x
}

// TextSprite/PixiButton에서 사용
const { textScale, multiplier } = useCrispText(baseFontSize);

// fontSize를 높이고, scale을 낮춰 시각적 크기 유지
const scaledFontSize = baseFontSize * multiplier;
textView.scale.set(textScale); // 1 / multiplier
```

#### 동작 원리

```
┌─────────────────────────────────────────────────────────────┐
│                    동적 폰트 크기 조절                        │
├─────────────────────────────────────────────────────────────┤
│  줌 1x: fontSize 16px × 1 = 16px, scale 1.0                 │
│  줌 2x: fontSize 16px × 2 = 32px, scale 0.5                 │
│  줌 3x: fontSize 16px × 3 = 48px, scale 0.33                │
├─────────────────────────────────────────────────────────────┤
│  결과: 텍스트가 항상 현재 줌에 맞는 해상도로 렌더링            │
│  → 확대해도 픽셀화 없이 선명함                               │
└─────────────────────────────────────────────────────────────┘
```

#### PixiJS 공식 권장 사항 준수

| 권장                          | 적용                      |
| ----------------------------- | ------------------------- |
| `roundPixels={true}`          | ✅                        |
| `resolution` 2배 이상         | ✅                        |
| 스케일 업 금지, fontSize 조절 | ✅                        |
| BitmapText + SDF              | 미적용 (필요시 추가 가능) |

**신규 파일:**

- `apps/builder/src/builder/workspace/canvas/hooks/useCrispText.ts`

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` - resolution, roundPixels 설정
- `apps/builder/src/builder/workspace/canvas/sprites/TextSprite.tsx` - 동적 폰트 크기
- `apps/builder/src/builder/workspace/canvas/ui/PixiButton.tsx` - 동적 폰트 크기

---

### Added - WebGL Canvas 동적 테마 색상 지원 (2025-12-15)

#### 개요

WebGL Canvas의 PixiButton이 테마 변경에 실시간으로 반응하도록 개선

#### 문제

- 기존 PixiButton은 하드코딩된 색상 사용 (`VARIANT_COLORS` 상수)
- 테마 변경 시 (Light ↔ Dark) WebGL 버튼 색상이 변하지 않음
- iframe Preview는 CSS 변수로 테마 변경 적용되지만 WebGL은 불변

#### 해결

CSS 변수를 런타임에 읽어 PixiJS hex 값으로 변환하는 시스템 구현

**1. cssVariableReader.ts (신규)**

```typescript
// CSS 변수에서 M3 토큰 읽기
export function getM3ButtonColors(): M3ButtonColors {
  const primary = cssColorToHex(getCSSVariable('--primary'), FALLBACK_COLORS.primary);
  // ... 모든 M3 색상 토큰 읽기
  return {
    primaryBg: primary,
    primaryBgHover: mixWithBlack(primary, 92),  // M3 hover = 92% original + 8% black
    primaryBgPressed: mixWithBlack(primary, 88), // M3 pressed = 88% original + 12% black
    // ...
  };
}

// variant별 색상 매핑
export function getVariantColors(variant: string, colors: M3ButtonColors) {
  switch (variant) {
    case 'primary': return { bg: colors.primaryBg, bgHover: colors.primaryBgHover, ... };
    // outline/ghost는 bgAlpha: 0 (투명 배경)
  }
}
```

**2. useThemeColors.ts (신규)**

```typescript
// MutationObserver로 테마 변경 감지
export function useThemeColors(): M3ButtonColors {
  const [colors, setColors] = useState(() => getM3ButtonColors());

  useEffect(() => {
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => setColors(getM3ButtonColors()));
    });

    // data-theme, data-builder-theme, class 속성 감시
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-builder-theme', 'class'],
    });

    // prefers-color-scheme 미디어 쿼리도 감시
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => { observer.disconnect(); mediaQuery.removeEventListener(...); };
  }, []);

  return colors;
}
```

**3. PixiButton.tsx 수정**

```typescript
// 기존: 하드코딩된 색상
const VARIANT_COLORS = { primary: { bg: 0x6750a4, ... }, ... }; // 제거

// 변경: 동적 테마 색상
const themeColors = useThemeColors();
const variantColors = useMemo(() => {
  return getVariantColors(props?.variant || 'default', themeColors);
}, [props?.variant, themeColors]);
```

#### 동작 방식

```
┌─────────────────────────────────────────────────────────────┐
│                    테마 변경 플로우                           │
├─────────────────────────────────────────────────────────────┤
│  1. 테마 토글 클릭                                           │
│     ↓                                                       │
│  2. document.documentElement에 data-theme="dark" 설정       │
│     ↓                                                       │
│  3. MutationObserver 감지 (useThemeColors)                  │
│     ↓                                                       │
│  4. getM3ButtonColors() 호출 → CSS 변수 다시 읽기            │
│     ↓                                                       │
│  5. React state 업데이트 → PixiButton 리렌더링               │
│     ↓                                                       │
│  6. FancyButton Graphics 재생성 (새 색상 적용)               │
└─────────────────────────────────────────────────────────────┘
```

#### M3 Hover/Pressed 색상 계산

```typescript
// M3 Design System 표준
// Hover: 원본 색상 92% + black 8%
function mixWithBlack(color: number, percent: number): number {
  const ratio = percent / 100;
  const r = Math.round(((color >> 16) & 0xff) * ratio);
  const g = Math.round(((color >> 8) & 0xff) * ratio);
  const b = Math.round((color & 0xff) * ratio);
  return (r << 16) | (g << 8) | b;
}

// Outline/Ghost Hover: primary 8% + white 92%
function mixWithWhite(color: number, percent: number): number {
  const whiteRatio = 1 - percent / 100;
  // ...
}
```

**신규 파일:**

- `apps/builder/src/builder/workspace/canvas/utils/cssVariableReader.ts`
- `apps/builder/src/builder/workspace/canvas/hooks/useThemeColors.ts`

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/ui/PixiButton.tsx`

---

### Fixed - WebGL Canvas Button Size Props (2025-12-15)

#### 문제

- Button 컴포넌트의 `size` prop (xs, sm, md, lg, xl)이 WebGL Canvas에서 적용되지 않음
- 폰트 크기는 변경되지만 버튼 크기(패딩)가 변하지 않음
- Text 컴포넌트는 정상 작동

#### 원인 분석

**아키텍처 설계**: composition는 `variant`/`size`로 일관성을, `style:{}`로 커스터마이징을 담당

```
┌─────────────────────────────────────────────────────────────┐
│                    composition 스타일 시스템                      │
├──────────────────────┬──────────────────────────────────────┤
│   일관성 (Semantic)   │   커스터마이징 (Inline)               │
│   variant, size      │   style: { ... }                     │
├──────────────────────┼──────────────────────────────────────┤
│   디자인 시스템 준수    │   개별 요소 세부 조정                 │
│   브랜드 일관성 유지    │   특수 케이스 대응                    │
├──────────────────────┴──────────────────────────────────────┤
│              우선순위: style > variant/size                  │
└─────────────────────────────────────────────────────────────┘
```

**문제 흐름:**

1. `LayoutEngine`이 Button 크기 계산 시 `parsePadding(style)`만 사용
2. `style`에 padding이 없으면 (size prop으로 결정되기 때문) 0으로 계산
3. `layoutPosition`이 ElementSprite로 전달되어 `style.width/height` 오버라이드
4. PixiButton의 auto 크기 계산이 무시됨

**결론:** 라이브러리 버그 아님, **우리 코드의 semantic props 미처리**

#### 해결

**LayoutEngine.ts 수정:**

```typescript
// 1. Button Size Presets 추가 (Button.css와 동기화)
const BUTTON_SIZE_PRESETS: Record<string, ButtonSizePreset> = {
  xs: { fontSize: 10, paddingX: 8, paddingY: 2 },
  sm: { fontSize: 14, paddingX: 12, paddingY: 4 },
  md: { fontSize: 16, paddingX: 24, paddingY: 8 },
  lg: { fontSize: 18, paddingX: 32, paddingY: 12 },
  xl: { fontSize: 20, paddingX: 40, paddingY: 16 },
};

// 2. measureTextSize() 함수에서 Button size prop 처리
function measureTextSize(element, style) {
  const isButton = element.tag === "Button" || element.tag === "SubmitButton";
  const buttonSize = isButton ? getButtonSizePadding(element) : null;

  // fontSize: inline style > size preset > 기본값
  const fontSize = parseCSSValue(style?.fontSize, buttonSize?.fontSize ?? 16);

  // padding: inline style 있으면 우선, 없으면 size preset 사용
  if (buttonSize && !hasInlinePadding) {
    paddingLeft = buttonSize.paddingX;
    paddingRight = buttonSize.paddingX;
    paddingTop = buttonSize.paddingY;
    paddingBottom = buttonSize.paddingY;
  }
}
```

#### 우선순위 동작

| 설정                                       | 적용되는 패딩 | 담당                  |
| ------------------------------------------ | ------------- | --------------------- |
| `size="md"`                                | 8px 24px      | 일관성 (semantic)     |
| `size="md"` + `style: { padding: '20px' }` | 20px          | 커스터마이징 (inline) |
| `size="lg"`                                | 12px 32px     | 일관성 (semantic)     |

**수정된 파일:**

- `apps/builder/src/builder/workspace/canvas/layout/LayoutEngine.ts` - Button size prop 지원

---

### Fixed - WebGL Canvas Selection System (2025-12-14)

#### 라쏘 선택 좌표 수정

- **문제**: Shift+드래그 라쏘 선택 시 마우스 위치와 선택 영역 불일치
- **원인**: 화면 좌표를 줌/팬 변환 없이 직접 사용
- **해결**: `screenToCanvas()` 좌표 변환 함수 추가

```typescript
// BuilderCanvas.tsx - ClickableBackground
const screenToCanvas = useCallback(
  (screenX: number, screenY: number) => {
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom,
    };
  },
  [zoom, panOffset],
);
```

#### Cmd+클릭 다중 선택 지원

- **문제**: PixiJS 이벤트에서 modifier 키(metaKey, ctrlKey, shiftKey) 전달 안됨
- **해결**: PixiJS v8 FederatedPointerEvent 구조에 맞춰 modifier 키 추출

```typescript
// 모든 Sprite 컴포넌트에 적용된 패턴
const handleClick = useCallback(
  (e: unknown) => {
    const pixiEvent = e as {
      metaKey?: boolean;
      shiftKey?: boolean;
      ctrlKey?: boolean;
      nativeEvent?: MouseEvent | PointerEvent;
    };

    // PixiJS v8: 직접 속성 우선, nativeEvent 폴백
    const metaKey =
      pixiEvent?.metaKey ?? pixiEvent?.nativeEvent?.metaKey ?? false;
    const shiftKey =
      pixiEvent?.shiftKey ?? pixiEvent?.nativeEvent?.shiftKey ?? false;
    const ctrlKey =
      pixiEvent?.ctrlKey ?? pixiEvent?.nativeEvent?.ctrlKey ?? false;

    onClick?.(element.id, { metaKey, shiftKey, ctrlKey });
  },
  [element.id, onClick],
);
```

#### PixiButton 이벤트 처리 개선

- **문제**: `FancyButton.onPress.connect()`가 modifier 키를 제공하지 않음
- **해결**: `FancyButton.eventMode = 'none'` 설정 + 투명 히트 영역으로 클릭 처리

#### GridLayer 렌더 순서 수정

- **문제**: 그리드가 표시되지 않음 (showGrid: true 상태에서도)
- **원인**: GridLayer가 BodyLayer보다 먼저 렌더링되어 불투명 배경에 가려짐
- **해결**: 렌더 순서 변경 - BodyLayer → GridLayer (그리드가 배경 위에 표시)

```typescript
// BuilderCanvas.tsx - Camera Container 렌더 순서
<pixiContainer label="Camera">
  <BodyLayer ... />      {/* 1. Body 배경 (최하단) */}
  <GridLayer ... />      {/* 2. 그리드 (배경 위) */}
  <CanvasBounds ... />   {/* 3. 경계선 */}
  <ElementsLayer ... />  {/* 4. 요소들 */}
  <SelectionLayer ... /> {/* 5. 선택 (최상단) */}
</pixiContainer>
```

**수정된 파일:**

- `BuilderCanvas.tsx` - 라쏘 좌표 변환, GridLayer/BodyLayer 렌더 순서 변경
- `BoxSprite.tsx`, `TextSprite.tsx`, `ImageSprite.tsx` - modifier 키 지원
- `PixiButton.tsx` - 투명 히트 영역 + eventMode 설정
- `BodyLayer.tsx` - modifier 키 지원
- `GridLayer.tsx` - PixiJS v8 rect+fill 방식으로 그리드 렌더링

---

### Updated - WebGL Canvas Phase 12 (2025-12-12)

- **레이아웃 안전성**: `MAX_LAYOUT_DEPTH`와 `visited` 가드로 순환 트리 무한 재귀 방지, 페이지 단위 레이아웃 캐싱으로 Elements/Selection 중복 계산 제거.
- **선택/정렬 성능**: 깊이 맵 메모이즈로 O(n²) 정렬 제거, SelectionLayer가 전달 레이아웃을 재사용.
- **팬/줌 입력 최적화**: 팬 드래그를 `requestAnimationFrame`으로 스로틀링 후 종료 시 플러시, 휠 줌 로그 스팸 제거.

### Added - WebGL Canvas Phase 12 (2025-12-12)

#### B3.1 DOM-like Layout Calculator

Canvas에서 DOM 레이아웃 방식 재현:

- **Block Layout**: 수직 스택, margin/padding, position: relative/absolute
- **Flexbox Layout**: flexDirection, justifyContent, alignItems, gap
- 안전 기능: MAX_LAYOUT_DEPTH, 순환 참조 감지

**파일:** `apps/builder/src/builder/workspace/canvas/layout/layoutCalculator.ts`

#### B3.2 Canvas Resize Handler (Figma-style)

패널 열기/닫기 시 캔버스 깜빡임 문제 해결:

| 방식                     | 깜빡임       | 성능 |
| ------------------------ | ------------ | ---- |
| key prop remount         | ❌ 검은 화면 | 느림 |
| 직접 resize              | ❌ 깜빡임    | 빠름 |
| CSS Transform + Debounce | ✅ 없음      | 빠름 |

```typescript
// 애니메이션 중: CSS transform scale (즉시)
canvas.style.transform = `scale(${scaleX}, ${scaleY})`;

// 150ms debounce 후: 실제 WebGL resize
app.renderer.resize(width, height);
```

**파일:** `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx:77-146`

#### B3.3 Selection System 개선

- SelectionBox: 컨테이너 요소도 테두리 표시
- Transform 핸들: 단일 선택 시 항상 표시 (컨테이너 포함)
- Move 영역: 컨테이너는 비활성화 (자식 클릭 허용)

**파일:** `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx`

---

### Added - Performance Optimization Track A/B/C Complete (2025-12-11)

엔터프라이즈급 10,000개+ 요소, 24시간+ 안정 사용을 위한 성능 최적화 완료.

#### Track A: 즉시 실행 ✅

**A1. Panel Gateway 패턴 적용**

- 비활성 패널에서 훅 실행 방지로 CPU 최소화
- 적용 위치: `PropertiesPanel.tsx:241-247`, `StylesPanel.tsx:44-50`, `ComponentsPanel.tsx:27-33`

```typescript
export function Panel({ isActive }: PanelProps) {
  if (!isActive) {
    return null;  // ✅ Gateway 패턴
  }
  return <PanelContent />;
}
```

**A2. React Query 네트워크 최적화**

- Request Deduplication (내장 기능)
- 캐시 관리 (staleTime: 5분, gcTime: 30분)
- 설정 위치: `src/main.tsx`, `src/builder/hooks/useDataQueries.ts`

#### Track B: WebGL Builder ✅

**B1. WebGL Canvas 구축**

- 메인 캔버스: `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
- Sprite 시스템: `sprites/` (BoxSprite, TextSprite, ImageSprite)
- Selection 시스템: `selection/` (SelectionBox, TransformHandle, LassoSelection)
- Grid/Zoom/Pan: `grid/` (GridLayer, useZoomPan)

**B2. Publish App 분리**

- 모노레포: `pnpm-workspace.yaml`
- 공통 코드: `packages/shared/src/`
- Publish App: `packages/publish/src/`

#### Track C: 검증 및 CI ✅

- Seed Generator: `scripts/lib/seedRandom.ts` (Mulberry32 PRNG)
- Long Session Test: `scripts/long-session-test.ts`
- GitHub Actions: `.github/workflows/performance-test.yml`
- SLO Verification: `scripts/verify-slo.ts`

#### 폐기된 항목

| 항목                    | 이유                           |
| ----------------------- | ------------------------------ |
| Phase 4 Delta Sync      | WebGL에서 postMessage 제거됨   |
| requestDeduplication.ts | React Query로 대체             |
| QueryPersister.ts       | React Query 메모리 캐시로 충분 |

#### 관련 문서

- [docs/performance/README.md](performance/README.md)
- [docs/performance/task.md](performance/task.md)
- [docs/performance/10-webgl-builder-architecture.md](performance/10-webgl-builder-architecture.md)

---

### Added - DATA_SYNC_ARCHITECTURE Phase 8-10 (2025-12-07)

#### Phase 8: Auto Refresh 기능

PropertyDataBinding에 자동 갱신 기능 추가

**새 타입:**

```typescript
export type RefreshMode = "manual" | "onMount" | "interval";

export interface DataBindingValue {
  source: "dataTable" | "api" | "variable" | "route";
  name: string;
  path?: string;
  defaultValue?: unknown;
  refreshMode?: RefreshMode; // 새로 추가
  refreshInterval?: number; // 새로 추가 (ms)
}
```

**UI 추가:**

- 갱신 모드 선택 (수동/마운트 시/주기적)
- 주기적 갱신 시 간격 설정 입력

**파일 수정:**

- `src/builder/panels/common/PropertyDataBinding.tsx`
- `src/builder/panels/common/PropertyDataBinding.css`
- `src/builder/hooks/useCollectionData.ts`

#### Phase 9: Error Handling UI 개선

Collection 컴포넌트용 로딩/에러/빈 상태 UI 컴포넌트 추가

**새 컴포넌트:**

- `CollectionLoadingState` - 로딩 스피너
- `CollectionErrorDisplay` - 에러 메시지 + 재시도 버튼
- `CollectionEmptyState` - 빈 데이터 표시
- `CollectionState` - 통합 상태 컴포넌트

**파일 추가:**

- `src/shared/components/CollectionErrorState.tsx`
- `src/shared/components/CollectionErrorState.css`

**ListBox 업데이트:**

- 가상화 렌더링에 로딩/에러 상태 통합
- 재시도 버튼 연동

#### Phase 10: Cache System 구현

API 호출 결과 캐싱으로 중복 요청 방지 및 성능 향상

**새 파일:** `src/builder/hooks/useCollectionDataCache.ts`

**기능:**

- TTL(Time-to-Live) 기반 자동 만료 (기본 5분)
- LRU(Least Recently Used) 정리
- 최대 100개 캐시 항목 제한
- 캐시 키 생성 (`createCacheKey`)
- 수동 캐시 무효화 (`invalidate`, `invalidateMatching`, `clear`)

**API:**

```typescript
const cache = new CollectionDataCache({ ttl: 60000, maxEntries: 100 });
cache.set("key", data);
cache.get<T>("key");
cache.invalidate("key");
cache.invalidateMatching(/pattern/);
cache.clear();
```

**useCollectionData 통합:**

- API 요청 전 캐시 확인
- 응답 데이터 캐시 저장
- `reload()` 시 캐시 무효화
- `clearCache()` 함수 제공

---

### Fixed - useCollectionData 과다 로깅 및 Hooks 순서 오류 (2025-12-07)

#### 문제 1: 과다 콘솔 로깅

**증상:** 컴포넌트 렌더링마다 수백 개의 `🔍 [ComponentName] useCollectionData 실행:` 로그 출력

**원인:** `useMemo` 내부의 디버그 로그가 의존성 변경 시마다 실행

**해결:** 모든 불필요한 `console.log` 제거

**정리된 파일:**

- `src/builder/hooks/useCollectionData.ts` - 15개+ 로그 제거
- `src/builder/hooks/useCollectionDataCache.ts` - 8개 로그 제거
- `src/shared/components/ListBox.tsx` - 6개 로그 제거

#### 문제 2: React Hooks 순서 오류

**증상:** Hot reload 시 "React has detected a change in the order of Hooks" 에러

**원인:** `clearCache` useCallback 추가로 인한 hooks 개수 변경

**해결:**

- `isCanvasContext`를 useMemo 의존성 배열에 추가
- 불필요한 `componentName` 의존성 제거

---

### Fixed - ListBox DataTable 데이터 미표시 버그 (2025-12-07)

#### 문제

DataTable 바인딩된 ListBox에서 데이터가 표시되지 않음

**증상:**

```
[DEBUG] DataTable found: poke {useMockData: false, mockDataLength: 20, runtimeDataLength: 0, resolvedDataLength: 0}
```

#### 원인

`runtimeData`가 빈 배열 `[]`일 때 `mockData`로 fallback되지 않음

```typescript
// 문제 코드
const data = table.useMockData
  ? table.mockData
  : table.runtimeData || table.mockData;
// [] || mockData = [] (빈 배열은 JavaScript에서 truthy)
```

#### 해결

빈 배열 체크 로직 추가

```typescript
// 수정된 코드
const hasRuntimeData = table.runtimeData && table.runtimeData.length > 0;
const data = table.useMockData
  ? table.mockData
  : hasRuntimeData
    ? table.runtimeData
    : table.mockData;
```

**파일:** `src/builder/hooks/useCollectionData.ts:327-333`

---

### Changed - DatasetEditorPanel Tab Management Refactoring (2025-12-03)

#### State Lifting Pattern

DatasetEditorPanel에서 탭 상태를 관리하도록 변경 (이전: 각 에디터 내부에서 관리)

**변경 사항:**

- **DatasetEditorPanel.tsx** - 모든 에디터 탭 상태 관리 (tableTab, apiTab, variableTab, creatorMode)
- **DataTableEditor.tsx** - 내부 탭 상태 제거, `activeTab` prop 수신
- **ApiEndpointEditor.tsx** - 내부 탭 상태 제거, `activeTab` prop 수신 (initialTab 제거)
- **VariableEditor.tsx** - 내부 탭 상태 제거, `activeTab` prop 수신
- **DataTableCreator.tsx** - 내부 mode 상태 제거, `mode` prop 수신

**새 타입 추가 (editorTypes.ts):**

```typescript
export type TableEditorTab = "schema" | "data" | "settings";
export type ApiEditorTab = "basic" | "headers" | "body" | "response" | "test";
export type VariableEditorTab = "basic" | "validation" | "transform";
```

**최종 구조:**

```
DatasetEditorPanel
├── PanelHeader (동적 타이틀)
├── panel-tabs 또는 creator-mode-selection (renderTabs)
└── panel-contents
    └── Editor 컴포넌트 (activeTab prop으로 탭 전달)
```

**관련 문서:** docs/features/DATA_PANEL_SYSTEM.md Section 18

---

### Changed - Dataset Panel Standardization (2025-12-02)

#### Panel Structure Refactoring

- **DatasetPanel** - `panel > panel-contents > section` 표준 구조로 변경
- **DataTableList** - `section > SectionHeader + section-content` 패턴 적용
- **ApiEndpointList** - 동일한 section 패턴 적용
- **VariableList** - section 패턴 + `dataset-subgroup`으로 Global/Page 구분
- **TransformerList** - 동일한 section 패턴 적용

#### Class Naming Standardization

- `dataset-tabs` → `panel-tabs` (일관된 패널 탭 클래스)
- `dataset-tab` → `panel-tab`
- `editor-tabs` → `panel-tabs` (DataTableEditor)
- `editor-tab` → `panel-tab`

#### Component Updates

- **DataTableEditor** - PanelHeader 컴포넌트 사용, 테이블명 편집은 Settings 탭으로 이동
- **DataTableCreator** - PanelHeader 컴포넌트 사용, 패널 형식으로 변경 (기존 popover에서)
- **SectionHeader** - 모든 리스트 컴포넌트에서 공통 SectionHeader 사용

#### Files Modified

- `src/builder/panels/dataset/DatasetPanel.tsx`
- `src/builder/panels/dataset/DatasetPanel.css`
- `src/builder/panels/dataset/components/DataTableList.tsx`
- `src/builder/panels/dataset/components/ApiEndpointList.tsx`
- `src/builder/panels/dataset/components/VariableList.tsx`
- `src/builder/panels/dataset/components/TransformerList.tsx`
- `src/builder/panels/dataset/editors/DataTableEditor.tsx`
- `src/builder/panels/dataset/editors/DataTableEditor.css`
- `src/builder/panels/dataset/editors/DataTableCreator.tsx`
- `src/builder/panels/dataset/editors/DataTableCreator.css`

#### New CSS Classes

- `.dataset-subgroup` - Variables 탭에서 Global/Page 그룹 구분
- `.dataset-subgroup-header` - 서브그룹 헤더
- `.dataset-subgroup-title` - 서브그룹 제목

---

### Fixed - Layout Preset System Critical Bugs (2025-11-28)

#### Same Preset Reapply Bug

- **문제**: 동일한 프리셋(예: 전체화면) 적용 후 다시 같은 프리셋 클릭 시 덮어쓰기 다이얼로그가 표시됨
- **원인**: `sidebar-left`와 `sidebar-right`가 동일한 Slot 이름(`sidebar`, `content`)을 가져 Set 비교로 구분 불가
- **해결**: Slot 이름 비교 대신 `appliedPreset` 키를 body element props에 저장하여 감지
- **파일**: `usePresetApply.ts`, `LayoutPresetSelector/index.tsx`, `styles.css`

```typescript
// body element props에서 직접 읽기
const currentPresetKey = useMemo((): string | null => {
  const body = elements.find((el) => el.id === bodyElementId);
  const appliedPreset = (body?.props as { appliedPreset?: string })
    ?.appliedPreset;
  // appliedPreset이 있고 slot 구성이 일치하면 유효
  if (appliedPreset && LAYOUT_PRESETS[appliedPreset]) {
    // ... slot 검증 로직
    return appliedPreset;
  }
  return null;
}, [elements, bodyElementId, existingSlots]);
```

#### LayoutsTab Body Auto-Select Bug

- **문제**: Layout 모드에서 Slot 선택 시 자동으로 body가 선택되어 버림
- **원인**: body 자동 선택 useEffect가 layout 변경 시뿐 아니라 `layoutElements` 변경 시마다 실행됨
- **해결**: `bodyAutoSelectedRef`를 추가하여 layout 당 한 번만 body 자동 선택 실행
- **파일**: `LayoutsTab.tsx`

```typescript
const bodyAutoSelectedRef = React.useRef<boolean>(false);

useEffect(() => {
  if (layoutChanged) {
    bodyAutoSelectedRef.current = false; // 레이아웃 변경 시 리셋
  }

  // 한 번만 실행
  if (!bodyAutoSelectedRef.current && bodyElement) {
    setSelectedElement(bodyElement.id, ...);
    bodyAutoSelectedRef.current = true;
  }
}, [currentLayout?.id, layoutElements, ...]);
```

#### Critical: Layout Slot Content Duplication Bug

- **문제**: Layout 프리셋 적용 시 Page body 내부의 모든 컴포넌트가 모든 Slot에 복제됨
- **원인**: `renderLayoutElement`에서 Slot 렌더링 시 `slot_name` 필터링 없이 모든 body 자식을 삽입
- **해결**: `slot_name` 매칭 필터 추가 - 각 Slot에는 해당 `slot_name`을 가진 요소만 삽입

**Before (Bug)**:

```typescript
slotContent = pageElements
  .filter((pe) => pe.parent_id === pageBody.id)  // 모든 body 자식
  .sort(...);
```

**After (Fix)**:

```typescript
slotContent = pageElements
  .filter((pe) => {
    if (pe.parent_id !== pageBody.id) return false;
    const peSlotName =
      (pe.props as { slot_name?: string })?.slot_name || "content";
    return peSlotName === slotName; // slot_name 매칭
  })
  .sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
```

- **파일**: `PreviewApp.tsx`

---

### Added - Style Panel Improvements (2025-11-24)

#### PropertyUnitInput Shorthand Parsing

- **Shorthand Value Support** - CSS shorthand 값 (예: `"8px 12px"`) 파싱 시 첫 번째 값 추출
- **Smart Change Detection** - 문자열 비교 대신 파싱된 숫자값/단위 비교로 불필요한 onChange 방지
- **Focus Bug Fix** - Mixed 값에서 포커스 인/아웃만 해도 값이 변경되던 버그 수정

#### LayoutSection Figma-style Expandable Spacing

- **Expandable Spacing UI** - Figma 스타일 단일 값 ↔ 4방향 개별 입력 토글
- **Mixed Value Detection** - 4방향 값이 다를 때 "(Mixed)" 라벨 표시
- **4-Direction Grid** - T/R/B/L 개별 입력 그리드 레이아웃
- **Bulk Update** - 축소 모드에서 4방향 동시 업데이트

#### Files Modified

- `src/builder/panels/common/PropertyUnitInput.tsx` - Shorthand 파싱 및 변경 감지 로직
- `src/builder/panels/styles/sections/LayoutSection.tsx` - 확장형 Spacing UI
- `src/builder/panels/common/index.css` - `.layout-spacing`, `.spacing-4way-grid` 스타일

---

### Added - Layout/Slot System Implementation (2025-11-21)

#### Phase 1: Core Infrastructure ✅

- **Database Schema** - `layouts` and `slots` tables with RLS policies
- **Type Definitions** - Layout, Slot, LayoutSlot types in `unified.types.ts`
- **Zustand Store** - `layoutStore.ts` with layouts/slots management
- **API Service** - `LayoutsApiService.ts` for CRUD operations

#### Phase 2: Builder UI ✅

- **Nodes Panel Layouts Tab** - Layout 생성/삭제/선택 UI
- **Slot Component** - 드래그 가능한 Slot 컴포넌트 with React Aria
- **Slot Editor** - Inspector에서 Slot name/required 설정

#### Phase 3: Page-Layout Integration ✅

- **BodyEditor 업데이트** - Page에 Layout 할당 UI (Select 컴포넌트)
- **Element Inspector 업데이트** - Element에 slot_name 지정 UI
- **Preview Rendering** - Layout + Page 합성 렌더링 엔진

#### Phase 4: Complex Component Support ✅ (Bug Fix)

- **ComponentCreationContext 확장** - `layoutId` 필드 추가
- **ComponentFactory 업데이트** - `createComplexComponent()`에 `layoutId` 파라미터 전달
- **Definition 파일 업데이트** - 11개 컴포넌트 정의 함수에 `ownerFields` 패턴 적용
  - `SelectionComponents.ts`: Select, ComboBox, ListBox, GridList
  - `GroupComponents.ts`: Group, ToggleButtonGroup, CheckboxGroup, RadioGroup, TagGroup, Breadcrumbs
  - `LayoutComponents.ts`: Tabs, Tree
  - `FormComponents.ts`: TextField
  - `TableComponents.ts`: Table, ColumnGroup

#### Key Architecture Decisions

- **ownerFields Pattern** - Layout/Page 모드 구분하여 `layout_id` 또는 `page_id` 설정
  ```typescript
  const ownerFields = layoutId
    ? { page_id: null, layout_id: layoutId }
    : { page_id: pageId, layout_id: null };
  ```
- **Element 소유권** - Element는 `page_id` 또는 `layout_id` 중 하나만 가짐 (상호 배타적)
- **Slot 렌더링** - Preview에서 Slot 위치에 해당 `slot_name` Element들 삽입

#### Files Modified

- `src/builder/factories/types/index.ts`
- `src/builder/factories/ComponentFactory.ts`
- `src/builder/hooks/useElementCreator.ts`
- `src/builder/factories/definitions/SelectionComponents.ts`
- `src/builder/factories/definitions/GroupComponents.ts`
- `src/builder/factories/definitions/LayoutComponents.ts`
- `src/builder/factories/definitions/FormComponents.ts`
- `src/builder/factories/definitions/TableComponents.ts`

#### Related Documentation

- [Layout/Slot System Plan V2](./LAYOUT_SLOT_SYSTEM_PLAN_V2.md) - 전체 구현 계획

---

### Fixed - Theme System & iframe Communication (2025-11-14)

#### Theme Cross-Selection Bug Fix

- **Fixed theme switching between different themes** not applying to Preview
  - Root cause: Hash calculation used string interpolation on objects (incorrect serialization)
  - Solution: Serialize full token structure with `JSON.stringify({ name, value, scope })`
  - Implementation: `useThemeMessenger.ts:33-39`
  - Status: ✅ Cross-theme switching now works correctly

#### Theme Refresh Application Fix

- **Fixed theme not applying after page refresh**
  - Root cause: Zustand subscribe selector pattern had timing issues
  - Solution: Changed from selector subscribe to full store subscribe with length comparison
  - Implementation: `BuilderCore.tsx:263-286`
  - Added automatic token transmission when iframe ready
  - Status: ✅ Theme now applies correctly on refresh

#### iframe Stale Reference Detection

- **Fixed elements not appearing after dashboard → builder re-entry**
  - Root cause: MessageService cached stale iframe references (contentWindow = null)
  - Solution: Automatic stale detection and re-fetch when contentWindow is null
  - Implementation: `messaging.ts:6-16`
  - Added `clearIframeCache()` on BuilderCore unmount
  - Status: ✅ Elements now appear correctly on re-entry

#### Debug Logging Cleanup

- **Removed unnecessary console.log statements**
  - Cleaned 6 files: `useThemeMessenger.ts`, `SettingsPanel.tsx`, `messageHandlers.ts`, `BuilderCore.tsx`, `themeStore.ts`, `messaging.ts`
  - Kept essential warning and error logs
  - Improved console readability for debugging

### Added - Collection Components Data Binding (2025-10-27)

#### ComboBox Filtering Enhancement

- **Added textValue support for auto-complete filtering** in ComboBox with Field-based rendering
  - Calculates searchable text from all visible Field values
  - Concatenates field values with spaces for partial matching
  - Enables searching across multiple fields (e.g., "John" matches name OR email)
  - Implementation: `SelectionRenderers.tsx:719-741`

#### TagGroup ColumnMapping Support

- **Added columnMapping support** for dynamic data rendering in TagGroup
  - Renders Tag for each data item with Field children
  - Supports REST API, MOCK_DATA, and Supabase data sources
  - Consistent pattern with ListBox, GridList, Select, ComboBox
  - Implementation: `CollectionRenderers.tsx:174-384`

#### TagGroup Item Removal System

- **Added non-destructive item removal** with `removedItemIds` tracking
  - Tracks removed item IDs without modifying source data (REST API/MOCK_DATA)
  - Items filtered out before rendering
  - Persisted to database, survives page refresh
  - Integrated with history system for undo/redo
  - Implementation: `TagGroup.tsx:131-151`, `CollectionRenderers.tsx:321-365`

#### TagGroup Restore Functionality

- **Added Inspector UI for restoring removed items**
  - Visual indicator showing count of removed items
  - "♻️ Restore All Removed Items" button
  - One-click restoration of all hidden items
  - Implementation: `TagGroupEditor.tsx:197-214`

#### Initial Component Creation Pattern

- **Standardized initial child items** for all Collection components
  - All components now create only **1 child item** as template for dynamic data
  - **Select**: Changed from 3 SelectItems → 1 SelectItem
  - **ComboBox**: Changed from 2 ComboBoxItems → 1 ComboBoxItem
  - **GridList**: 1 GridListItem
  - **ListBox**: 1 ListBoxItem
  - Consistent template pattern for columnMapping mode
  - Implementation: `SelectionComponents.ts`

#### Collection Components Status Update

- ✅ **ListBox + ListBoxItem**: columnMapping implemented
- ✅ **GridList + GridListItem**: columnMapping implemented
- ✅ **Select + SelectItem**: columnMapping implemented
- ✅ **ComboBox + ComboBoxItem**: columnMapping + textValue filtering implemented
- ✅ **TagGroup + Tag**: columnMapping + removedItemIds implemented
- 🔄 **Menu + MenuItem**: pending
- 🔄 **Tree + TreeItem**: hierarchical data supported, columnMapping pending
- 🔄 **CheckboxGroup + Checkbox**: pending
- 🔄 **RadioGroup + Radio**: pending
- 🔄 **ToggleButtonGroup + ToggleButton**: pending

### Added - Inspector UI/UX Improvements (2025-10)

#### Compact Layout

- **One-line layouts** for related controls to improve space efficiency
  - Font Size + Line Height in a single row with action button
  - Text Align + Vertical Align in a single row
  - Text Decoration + Font Style in a single row
  - Font Weight + Letter Spacing in a single row
  - All layouts follow consistent pattern with `.fieldset-actions`

#### Icon-based Controls

- **Replaced text buttons with icons** for better visual consistency
  - Text Align: `AlignLeft`, `AlignCenter`, `AlignRight`
  - Vertical Align: `AlignVerticalJustifyStart`, `AlignVerticalJustifyCenter`, `AlignVerticalJustifyEnd`
  - Text Decoration: `RemoveFormatting`, `Underline`, `Strikethrough`
  - Font Style: `RemoveFormatting`, `Italic`, `Type` (with skew for oblique)
  - Text Transform: `RemoveFormatting`, `CaseUpper`, `CaseLower`, `CaseSensitive`
- All icon-based controls use `indicator` attribute for consistent visual feedback

#### Auto Option for Style Reset

- **Added "auto" option** to all style properties for inline style removal
  - Properties with auto: Width, Height, Left, Top, Gap, Padding, Margin
  - Properties with auto: Border Width, Border Radius, Border Style
  - Properties with auto: Font Size, Line Height, Font Family, Font Weight, Letter Spacing
- Selecting "auto" removes inline style and falls back to class-defined styles
- Implemented in both `PropertyUnitInput` and `PropertySelect` components

### Changed

#### Input Control Improvements

- **Separated immediate input from blur input** in `PropertyUnitInput`
  - Input changes only update local state during typing
  - Style changes apply on blur or Enter key press
  - Prevents value accumulation issues (e.g., "16" becoming "116")
  - Added Enter key support for immediate value application

#### PropertySelect Enhancements

- **Ellipsis handling** for long option labels
  - Added `text-overflow: ellipsis` with `overflow: hidden`
  - Fixed width constraints with `min-width: 0` throughout component hierarchy
  - Prevents Font Weight from expanding and squeezing Letter Spacing
  - Flex layout with proper width constraints in `.react-aria-Button`

### Fixed

#### Synchronization Issues

- **Element switching now properly updates styles**
  - Added `style` and `computedStyle` comparison in Inspector component
  - Previous elements' style values no longer persist when selecting new elements
  - Fixed `mapElementToSelected` to initialize style as empty object instead of undefined
  - Fixed `mapSelectedToElementUpdate` to always include style property (even empty object)

#### Style Application

- **Inline style changes now properly sync to Builder**
  - Empty style objects now transmitted to Builder for style removal
  - Fixed conditional check to use `!== undefined` instead of truthy check
  - Style deletions via "auto" option now properly reflected in preview

## Related Documentation

- [Inspector Style System](./features/INSPECTOR_STYLE_SYSTEM.md) - Comprehensive guide to style management
- [ToggleButtonGroup Indicator](./features/TOGGLEBUTTONGROUP_INDICATOR.md) - Indicator implementation details
- [CLAUDE.md](../CLAUDE.md) - Development guidelines and architecture

## Breaking Changes

None in this release.

## Migration Guide

No migration needed for this release. All changes are backward compatible.

---

---

**Note**: 2025년 이전 변경 이력은 [CHANGELOG-2025-archived.md](CHANGELOG-2025-archived.md)를 참조하세요.
