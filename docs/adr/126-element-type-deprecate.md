# ADR-126: Element 타입 Deprecate — canonical-native consumer 전환 및 boundary 격리

## Status

Accepted — 2026-05-10

현재 판정 (2026-05-11): 설계 자체는 목적에 맞다. ADR-122 residual 순서인
runtime source 제거 → derived view 축소 → compatibility/boundary quarantine 과
정합하며, 즉시 타입 삭제 대신 consumer별 canonical-native 전환 + deprecated
`Element` import gate 로 닫는 방향이 rollback/호환성 리스크를 가장 낮춘다.
단, ADR 완료 판정은 아니다. Phase 6 code gate(deprecation marker + 신규 import
lint 차단)는 land 됐지만, authenticated browser smoke, final grep audit, preflight 가
아직 남아 있으므로 Status 는 `Accepted` 로 유지하고 `completed/` archive 는 하지 않는다.

진행 로그:

- 2026-05-10 Phase 0 (inventory freeze) — base 3 ADR (ADR-123/124/125) Implemented 도달 후 Phase 1 prerequisite G0 PASS, Element 타입 production 1766 line / canonicalDocumentToElements 4 caller / useCanonicalElements ~10 production caller / store-cache direct read bucket 0 hit freeze. 단, `elementsMap`/`childrenMap` store state 타입 전환은 Phase 3 잔여로 유지 ([126-inventory.md](design/126-inventory.md))
- 2026-05-10 Phase 1 (canonical-native model 검증) — ADR-123 cloud boundary grep gate 5/5 PASS / ADR-124 history canonical event primary read 확증 / ADR-125 render input scene model 단일 source 확증 / Element 타입 import production 37 file (boundary 18 + derived-view 1 + hot-path 18) + annotation 161 file 카테고리 매핑 / canonical-native API hot path 커버 가능 판정 / FPS baseline 측정 (canvas 2612x1880 idle median 120.5 / p10 107.5 / p99 137 ≥ 60fps gate) / type-check FULL TURBO PASS ([126-phase1-validation.md](design/126-phase1-validation.md))
- 2026-05-10 Phase 2 진입 시도 → agent type alias rename 우회 검출 (`Element → LegacyElement` 형식 PASS, ADR HC.1 성능 / HC production 0건 의미적 PASS 미충족) → worktree 폐기 (main 영향 0). framing 재freeze: design breakdown §5 의 "우선 전환 대상 file" sub-list (7 file) 와 G2 grep gate 전체 scope 추정 ~28 file vs ADR-127 발의 시 실측 70 file (실측/추정 = 2.5배) 괴리 인지. Phase 2 를 directory 단위 5 sub-group (2-A Skia / 2-B layout / 2-C renderer input / 2-D panels / 2-E preview) 으로 재분할 + 진정 reverse 패턴 4 요건 (함수 시그니처 / caller cascade / lookup pattern / type alias rename 금지) + sub-group 별 G2-A~G2-E 검증 의무 명시 (caller cascade evidence + targeted vitest + type-check, grep gate 단독 PASS 금지). breakdown §5/§10/§11 update — Phase 2 직접 land 진입은 별도 세션. 메모리 인용: `feedback-adr-essence-priority-over-formal-pass`, `feedback-agent-completion-failure-pattern`, `feedback-vitest-no-tests-misleading`
- 2026-05-10 ADR-127 Implemented 후 Phase 2 prerequisite 확정 — canonical traversal helper 6개 + `CanonicalSceneModel.nodes/nodesMap/childrenByParent` canonical-native export + `canonicalSceneModelLegacy.ts` transition boundary land. Phase 2 진입 조건은 G1 PASS + ADR-127 Implemented. dependency baseline = ADR-122/123/124/125/127 모두 Implemented.
- 2026-05-10 Phase 2-A (Skia/scene core) land — `CanvasSceneNode` / `CanvasSceneGraph` projection을 추가해 `CanonicalSceneModel` 이 `sceneNodes` / `sceneNodesMap` / `sceneChildrenByParent` / canonical-derived `pageIndex` 를 직접 expose. `canonicalSceneModel.ts` 내부 `canonicalDocumentToElements()` 호출 제거. `SkiaCanvas` / `StoreRenderBridge` / command stream 이 `rendererInput.elementsMap` / `childrenMap` 대신 canonical scene maps 를 소비하도록 caller cascade 동반 전환. G2-A 보조 grep: `workspace/canvas/skia/**` + `workspace/canvas/scene/**` production `Element` import/raw hit 0, Skia production `rendererInput.elementsMap|childrenMap` hit 0, `(Legacy|Old|Deprecated)Element` hit 0. 검증: `pnpm -F @composition/builder type-check` PASS, targeted Vitest `src/builder/workspace/canvas/skia src/builder/workspace/canvas/scene src/builder/workspace/canvas/renderers` 18 files / 152 tests PASS, `git diff --check` PASS, browser smoke `/builder/adr-126-phase2a-smoke` canvas 1440x952 nonblank + console/page error 0 + rAF median 120.5fps (p10 112.4 / p99 135.1). 당시 잔여 `BuilderCanvas` legacy fallback / `rendererInput.ts` render-tree fallback 은 2026-05-10 canvas renderer input/bootstrap follow-up 에서 제거.
- 2026-05-10 Phase 2-C (renderer input + ref resolution core) land — `canonicalRefResolution.ts` 를 `Element` import 전용 helper 에서 `CanonicalRefResolvableNode` generic resolver 로 전환해 `Element`/`CanvasSceneNode` 양쪽이 같은 resolver를 타입 안전하게 통과. `resolvers/canonical/storeBridge.ts` 의 per-instance shared-cache resolver 도 `Element` import 없이 generic render node 를 반환하도록 전환. `createSkiaRendererInput()` 은 주입된 canonical scene graph 를 `resolveCanonicalRefTree<CanvasSceneNode>()` 로 직접 resolve 하고, legacy scene fallback 은 canonical scene graph 미주입 시에만 사용. G2-C core grep: `canonicalRefResolution.ts` + `storeBridge.ts` `Element` raw/type hit 0. 검증: builder type-check PASS, targeted Vitest `renderers + canonicalRefResolution + resolvers/canonical` 9 files / 113 tests PASS, `git diff --check` PASS. 당시 잔여 `rendererInput.ts` render-tree fallback `Element` shape 는 2026-05-10 follow-up 에서 제거.
- 2026-05-10 Phase 2-B (layout contract core) land — `CanvasLayoutNode` layout 전용 최소 contract 를 도입하고 `workspace/canvas/layout/**` production 을 Builder store `Element` import 에서 분리. `layoutCache.ts` 와 `useLayoutPublisher.ts` 도 `CanvasLayoutNode` 기반 layout input 을 소비하도록 전환. `PixiPageRendererInput` / `buildPixiPageRendererInput` / `buildFrameRendererInput` production 명칭을 `LayoutPublisherInput` / `buildPageLayoutPublisherInput` / `buildFrameLayoutPublisherInput` 으로 정정. G2-B core grep: `layout/**` + `scene/layoutCache.ts` + `hooks/useLayoutPublisher.ts` production `Element` raw/type hit 0, Pixi layout input legacy symbol hit 0. 검증: builder type-check PASS, targeted Vitest `layout + scene/layoutCache + renderers` 10 files / 63 tests PASS. 당시 잔여 `rendererInput.ts` render-tree fallback / `BuilderCanvas` legacy store read 는 2026-05-10 follow-up 에서 제거.
- 2026-05-10 Phase 2-E (preview boundary core) land — `preview/App.tsx` 의 canonical ref resolution 과 frame mirror checks 를 `PreviewElement` generic path 로 전환해 store `Element` cast/import 를 제거. `preview/utils/layoutResolver.ts` 는 preview-local result types 와 `PreviewElement` 로 분리. `services/messaging.ts` 는 `MessagingElement` / `MessageProps` contract 로 iframe message payload 를 store 타입 import 없이 표현. `utils/urlGenerator.ts` 는 `UrlPage` / `UrlLayout` contract 로 전환해 preview router 의 builder `Page` import 를 제거. G2-E core grep: `preview/**` + `services/messaging.ts` + `utils/urlGenerator.ts` production `Element` raw/type import + `UPDATE_ELEMENTS` hit 0. 검증: builder type-check PASS, targeted Vitest `previewFrameMirror.static + frameElementLoader` 2 files / 9 tests PASS. 잔여: panels preset apply/write payload caller 는 후속 panels/write payload slice 또는 Phase 5에서 정리.
- 2026-05-10 Phase 2-D (panels + interaction read-model core) land — `PanelNode` / `CanvasInteractionNode` 최소 contract 를 도입하고 `useCanonicalPropertyRead`, `LayersSection`, `LayerTree` data/types/content, Component semantics/slot/fill sections 를 store `Element` import 없이 읽도록 전환. Selection hit-test, context menu, selected bounds, drag bridge, hover, scroll interaction 은 `CanvasSceneNode` 기반 scene maps 를 소비한다. frame body interaction helper 호환을 위해 `CanvasSceneNode.layout_id` transition alias 를 보강했다. G2-D core grep: 해당 panels read path + canvas interaction hooks/selection production store `Element` import hit 0. 검증: builder type-check PASS, targeted Vitest 11 files / 82 tests PASS. 당시 잔여 `rendererInput.ts` render-tree fallback / `BuilderCanvas` legacy projection 은 2026-05-10 follow-up 에서 제거.
- 2026-05-10 Phase 2-D follow-up (frame panels read/load) land — `frameElementLoader.ts` 의 store `Element` import/cast 와 `loadFrameElements()` 의 기존 store 타입 반환을 `FrameElementNode` structural contract 로 전환.
  `FramesTab` / `FrameElementTree` 는 `PanelNode` 기반 frame tree read/delete/click props 를 소비하도록 정리. G2-D frame slice grep: `frameElementLoader.ts` + `FramesTab` + `FrameElementTree` production store `Element` import hit 0. 검증: builder type-check PASS, targeted Vitest `FramesTab + frameElementLoader` 5 files / 45 tests PASS.
  `LayoutPresetSelector/usePresetApply` 는 아래 preset apply follow-up에서 정리.
  generated editor payload 는 아래 follow-up들에서 정리. 당시 canvas 잔여는 2026-05-10 renderer input/bootstrap follow-up 에서 제거.
- 2026-05-10 Phase 2-D follow-up (preset apply read/write payload) land — `LayoutPresetSelector/usePresetApply.ts` 의 store `Element` import/cast 를 제거하고 `PresetElementNode` / `PresetSlotElement` structural contract 로 기존 slot 탐지, canonical replace filter, slot create payload 를 분리. static test 도 local structural fixture 로 전환하고 production `Element` raw/type/import grep 0건을 고정. 검증: builder type-check PASS, targeted Vitest `usePresetApply.static.test.ts` 1 file / 4 tests PASS.
  generated child editors + tabs actions 는 아래 follow-up에서 정리. 당시 canvas 잔여는 2026-05-10 renderer input/bootstrap follow-up 에서 제거.
- 2026-05-10 Phase 2-D follow-up (generated child editors + tabs actions) land — 신규 `propertyEditorNode.ts` 의 `PropertyEditorElementPayload` / `PropertyEditorChildNode` structural contract 로 `ListBoxItemEditor`, `TagEditor`, `TreeItemEditor`, `tabsItemActions`, `TabsEditor` 의 child add payload 와 TabPanel lookup 을 store `Element` import 및 `useStore.getState().elements` direct read 에서 분리. `ListBoxItemEditor` / `TagEditor` customId 생성은 `useCanonicalPropertyElements()` 를 소비. 검증: builder type-check PASS, targeted Vitest `canonicalPropertyEditors.static.test.ts` 1 file / 5 tests PASS.
  `ChildItemManager` / `useCollectionItemManager` 는 아래 follow-up에서 정리.
  table generated editor payload 도 아래 follow-up에서 정리. 당시 canvas 잔여는 2026-05-10 renderer input/bootstrap follow-up 에서 제거.
- 2026-05-10 Phase 2-D follow-up (collection child manager payload) land — `useCollectionItemManager.ts` 는 `CollectionItemNode` structural contract 로 canonical/store fallback children 과 Supabase insert payload를 분리하고 store `Element` import/cast 를 제거. `ChildItemManager.tsx` 는 `ChildItemPayload` 와 `useCanonicalPropertyElements()` 기반 customId 생성으로 add payload 와 direct `useStore.getState().elements` read 를 제거. 검증: builder type-check PASS, targeted Vitest `useCollectionItemManager.static + genericEditorCanonical.static` 2 files / 4 tests PASS.
  table generated editor payload 는 아래 follow-up에서 정리. 당시 canvas 잔여는 2026-05-10 renderer input/bootstrap follow-up 에서 제거.
- 2026-05-10 Phase 2-D follow-up (table generated editor payload) land — `TableEditor.tsx` / `TableHeaderEditor.tsx` 의 row/column/cell/group create payload 를 `TableEditorElementPayload` / `TableHeaderElementPayload` structural contract 로 전환하고 store `Element` import 및 `: Element[]` payload 를 제거. `TableHeaderEditor` 의 column/cell lookup 과 customId 생성은 canonical property elements 를 소비. 검증: builder type-check PASS, targeted Vitest `canonicalPropertyEditors.static.test.ts` 1 file / 6 tests PASS.
  당시 canvas 잔여는 2026-05-10 renderer input/bootstrap follow-up 에서 제거.
- 2026-05-10 Phase 2-D follow-up (drop target resolver read model) land — `dropTargetResolver.ts` 의 store `Element` import를 제거하고 `DropTargetNode` structural contract 로 drag/drop target read model, children map, projection helper, reorder helper를 전환. `dropTargetResolver.test.ts` 도 local `DropTargetNode` fixture 로 전환. 검증: builder type-check PASS, targeted Vitest `dropTargetResolver.test.ts` 1 file / 13 tests PASS.
  당시 canvas 잔여는 2026-05-10 renderer input/bootstrap follow-up 에서 제거.
- 2026-05-10 Phase 2 follow-up (canvas renderer input/bootstrap projection) land — `rendererInput.ts` 의 `SkiaRendererInput.elements/elementsMap/childrenMap` 과 page-resolved render tree 를 `CanvasSceneNode` contract 로 전환하고, canonical scene graph 미주입 fallback 을 제거해 caller 가 항상 `sceneNodes` / `sceneNodesMap` / `sceneChildrenByParent` 를 주입하도록 정리. `BuilderCanvas.tsx` 는 `getSceneModel*Legacy` fallback 과 store `Element` import 를 제거하고, 초기 bootstrap 에 필요한 legacy store → `CanvasSceneGraph` 변환만 `canonicalSceneModelLegacy.ts` boundary 로 격리. 검증: builder type-check PASS, targeted Vitest `createSkiaRendererInput + BuilderCanvas projection + SkiaCanvas static + useScrollWheelInteraction static` 4 files / 10 tests PASS.
  잔여: Phase 3 store-cache 타입 전환, Phase 4 history/inspector/drag-drop/AI/messaging 잔여 consumer, Phase 5 derived-view 제거와 transition alias 정리, Phase 6 final audit.
- 2026-05-10 Phase 3 scope cleanup — 현재 코드 재측정 결과 `useStore.getState().elementsMap|childrenMap` production direct read 는 adapter 주석을 제외하면 0건이지만, `stores/**` 전체 grep gate 는 `elements.ts` store state 뿐 아니라 `inspectorActions.ts`, `elementLoader.ts`, `historyHelpers.ts`, `elementCreation.ts`, `elementUpdate.ts`, `elementIndexer.ts`, grouping/alignment/distribution utility 까지 함께 잡아 Phase 4 영역과 섞인다. Phase 3 을 `elementsMap`/`childrenMap` **store state/cache contract** 정렬로 좁히고, mutation/action/history/inspector/loader/utility map consumer 전환은 Phase 4 소유로 재분리했다. 문서 정리만 수행하며 runtime behavior 변경 없음.
- 2026-05-10 Phase 3 store cache state contract slice land — `ElementsState.elementsMap` / `childrenMap` 과 `buildIndexes()` cache 생성부를 `StoreElementCacheSnapshot` / `StoreElementCacheMap` / `StoreChildrenCacheMap` deprecated snapshot contract 로 전환했다. `elements.storeCache.static.test.ts` 로 state field 와 `buildIndexes()` 가 raw `Map<string, Element>` / `Map<string, Element[]>` contract 로 회귀하지 않도록 고정. 검증: builder type-check PASS, targeted Vitest `elements.storeCache.static.test.ts` 1 file / 1 test PASS. 잔여: `elements.ts` 내부 page removal local mutation map 과 store utility/action/history/inspector/loader map consumer 는 Phase 4 소유.
- 2026-05-11 Phase 4 utility read-model slice land — `layoutInvalidation.ts`, `elementAlignment.ts`, `elementDistribution.ts`, `elementHelpers.ts` 의 store utility map input 을 full `Element` map 에서 structural/readonly contract 로 전환. alignment/distribution 은 `AlignableElementNode` / `DistributableElementNode`, subtree invalidation 은 `LayoutInvalidationNode`, lookup helper 는 generic readonly map contract 를 사용한다. 검증: builder type-check PASS, targeted Vitest `layoutInvalidation.test.ts + elementAlignmentDistribution.static.test.ts` 2 files / 3 tests PASS. 잔여: `elementCreation`/`elementRemoval`/`elementUpdate`/`elementIndexer`/`historyHelpers`/`historyActions`/`inspectorActions`/`elementLoader` 와 `canonicalSceneModelLegacy` bootstrap boundary.
- 2026-05-11 Phase 4 grouping read-model slice land — `elementGrouping.ts` 의 `createGroupFromSelection()` / `ungroupElement()` input 을 raw `Map<string, Element>` 에서 generic `ReadonlyMap<string, TElement>` contract 로 전환했다. group 생성/해제 output 은 기존 history/add/update 경계 호환을 위해 `Element` payload 로 유지. 검증: builder type-check PASS, targeted Vitest `elementGrouping.static.test.ts` 1 file / 1 test PASS.
- 2026-05-11 Phase 4 element creation lookup slice land — `elementCreation.ts` 의 ref master/customId generation lookup helper 를 generic readonly map contract 로 전환하고 `buildCreationElementMap()` 을 `Map<string, TElement>` 로 좁혔다. 생성 payload와 canonical insert event는 기존 `Element` contract 유지. 검증: builder type-check PASS, targeted Vitest `elementCreation.storeCache.static.test.ts` 1 file / 1 test PASS.
- 2026-05-11 Phase 4 element indexer contract slice land — `elementIndexer.ts` 의 page/component/variable index helper map input 과 `ComponentIndex.masterComponents` 를 generic readonly map contract 로 전환했다. `PageElementIndex` / `VariableUsageIndex` 구조와 runtime index semantics 는 변경 없음. 검증: builder type-check PASS, targeted Vitest `elementIndexer.storeCache.static.test.ts` 1 file / 1 test PASS.
- 2026-05-11 Phase 4 element loader cache contract slice land — `elementLoader.ts` 의 minimal state `elementsMap` contract 를 raw `Map<string, Element>` 에서 Phase 3 `StoreElementCacheMap` 으로 전환했다. lazy load/unload runtime behavior 변경 없음. 검증: builder type-check PASS, targeted Vitest `elementLoader.static.test.ts` 1 file / 1 test PASS.
- 2026-05-11 Phase 4 history helper read-model slice land — `historyHelpers.ts` 의 batch/instance/group undo lookup map input 을 generic readonly map contract 로 전환했다. group/ungroup/multi-delete/paste/history event payload `Element` boundary 는 유지. 검증: builder type-check PASS, targeted Vitest `historyHelpers.storeCache.static.test.ts + historyHelpers.test.ts` 2 files / 3 tests PASS.
- 2026-05-11 Phase 4 element update cache contract slice land — `elementUpdate.ts` 의 lookup/children map helper 와 batch rebuild local map 을 `ElementUpdateLookup` / `ElementUpdateChildrenByParent` alias 로 전환하고 descendant dirty tracking input 을 readonly `{ id }` contract 로 좁혔다. canonical mutation/history/persistence semantics 변경 없음. 검증: builder type-check PASS, targeted Vitest `elementUpdate.static.test.ts` 1 file / 3 tests PASS.
- 2026-05-11 Phase 4 element removal cache contract slice land — `elementRemoval.ts` 의 removal target lookup, children map, post-removal cache rebuild, multi-remove de-dup map 을 `ElementRemovalLookup` / `ElementRemovalChildrenByParent` alias 로 전환했다. canonical remove event/history/persistence semantics 변경 없음. 검증: builder type-check PASS, targeted Vitest `elementRemoval.static.test.ts` 1 file / 3 tests PASS.
- 2026-05-11 Phase 4 history actions compatibility map slice land — `historyActions.ts` 의 cloud compatibility upsert lookup map 을 `HistoryCompatibilityElementMap` alias 로 전환했다. canonical history event/diff application semantics 변경 없음. 검증: builder type-check PASS, targeted Vitest `historyActions.static.test.ts` 1 file / 1 test PASS.
- 2026-05-11 Phase 4 elements page removal local map slice land — `elements.ts` 의 `removePageLocal` page removal/de-dup maps 를 `PageRemovalElementMap` / `PageRemovalElementsByPreviousId` alias 로 전환했다. page shell removal 및 auto-detach semantics 변경 없음. 검증: builder type-check PASS, targeted Vitest `elements.storeCache.static.test.ts` 1 file / 1 test PASS.
- 2026-05-11 Phase 4 inspector actions cache contract slice land — `inspectorActions.ts` 의 inspector lookup/children map helpers 와 required state map contract 를 `InspectorElementMap` / `InspectorChildrenMap` alias 로 전환했다. selected props/style/fill write-through 및 canonical merge semantics 변경 없음. 검증: builder type-check PASS, targeted Vitest `inspectorActions.static.test.ts` 1 file / 1 test PASS.
- 2026-05-11 Phase 4 legacy scene boundary map alias slice land — `canonicalSceneModelLegacy.ts` 의 legacy Element map return contract 를 `LegacyElementMap` / `LegacyChildrenByParentMap` boundary alias 로 전환했다. bootstrap fallback boundary semantics 변경 없음. 검증: builder type-check PASS, targeted Vitest `canonicalSceneModelLegacy.static.test.ts` 1 file / 1 test PASS.
- 2026-05-11 Phase 5 property derived-view caller slice land — `useCanonicalPropertyRead.ts` / `useCollectionItemManager.ts` 는 `useCanonicalElements()` 대신 active canonical document traversal 을 직접 사용하고, `PropertyCustomId` / `usePresetApply` 는 property read helper 를 재사용하도록 정리했다. `idValidation` 은 `Element[]` 대신 customId validation 최소 contract 로 전환. direct `useCanonicalElements()` production caller 는 12 → 8로 감소. 검증: builder type-check PASS, targeted Vitest 4 files / 8 tests PASS.
- 2026-05-11 Phase 5 nodes derived-view caller slice land — `useCanonicalPanelElements()` 를 추가해 Layers/Frames/LayerTree read path 가 `useCanonicalElements()` 대신 active canonical document traversal 을 사용하도록 전환했다. direct `useCanonicalElements()` production caller 는 8 → 5로 감소. 검증: builder type-check PASS, targeted Vitest 4 files / 21 tests PASS.
- 2026-05-11 Phase 5 runtime derived-view hook caller slice land — `stores/index.ts`, `canvasStore.ts`, `useDeltaMessenger.ts`, `useComponentMemory.ts` 가 `useCanonicalElements()` / `useCanonicalSelectedElement()` 대신 active canonical document traversal 을 사용하도록 전환했다. non-boundary `useCanonicalElements()` / `useCanonicalSelectedElement()` production caller 는 0건. 검증: builder type-check PASS, targeted Vitest 5 files / 12 tests PASS.
- 2026-05-11 Phase 5 derived-view cleanup slice land — `canonicalHistoryEvents.ts` 가 `canonicalDocumentToElements(nextDoc)` 대신 `visitCanonicalDocumentElements()` 로 history result snapshot 을 직접 수집하도록 전환했다. production `useCanonicalElements()` / `useCanonicalSelectedElement()` export 와 hook test 를 제거하고, `canonicalSceneModelLegacy.ts` 의 `canonicalDocumentToElements` transition re-export 도 제거했다. production `canonicalDocumentToElements(` grep 은 boundary 정의 1건만 남고 non-boundary caller 는 0건. 검증: builder type-check PASS, targeted Vitest 6 files / 24 tests PASS.
- 2026-05-11 Phase 6 deprecation marker slice land — `unified.types.ts` 의 `Element` 인터페이스에 `@deprecated ADR-126 Phase 6` JSDoc 을 추가해 신규 runtime code 는 canonical `CompositionDocument` / `CanonicalNode` 또는 structural contract 를 사용하도록 명시했다. 타입 삭제는 별도 cleanup ADR 범위로 유지. 검증: builder type-check PASS.
- 2026-05-11 Phase 6 deprecation lint gate slice land — `eslint-local-rules` 에 `local/no-deprecated-element-import` 를 추가하고 builder ESLint config 에 error gate 로 연결했다. 현재 compatibility/boundary baseline 파일은 allowlist 로 고정하고, 새 production 파일의 `Element` import 는 lint error 로 차단한다. 검증: ADR-126 isolated lint gate PASS, stdin negative fixture FAIL 확인.
- 2026-05-11 Phase 6 closure 판정 정리 — 설계/구현 방향은 유지하되, 완료 승격은 보류한다. headless Playwright 로 `/builder/adr-126-final-smoke` 진입 시 `/signin` 으로 redirect 되어 create/edit/delete/undo/redo/reorder/origin-instance/refresh smoke 를 실행하지 못했다. 또한 기존 broad `Element[]|: Element` grep 은 `PreviewElement`, DOM `Element`, compatibility store/action 타입, comment 를 포함해 570줄을 잡아 final pass/fail 단독 기준으로 부적합하므로, final audit 은 scoped derived-view grep + local deprecated import lint gate + authenticated browser smoke + preflight 조합으로 판정한다.

**PREREQUISITE (진입 불가 조건)**:

- Phase 1 이상: ADR-123, ADR-124, ADR-125 세 ADR 모두 `Implemented` 상태여야 한다. 세 ADR 중 하나라도 `Accepted` 이하이면 이 ADR은 `Proposed` 상태를 유지하고 Phase 0(inventory freeze)만 선행 수행할 수 있다.
- Phase 2 이상: Phase 1 G1 PASS 이후 ADR-127 (`Canonical-native traversal helper + scene model 재설계`) 이 `Implemented` 상태여야 한다. ADR-127 미완 상태에서는 helper/API/scene model prerequisite가 없으므로 Phase 2 consumer 전환을 시작하지 않는다.

## Context

### SSOT 체인 도메인 판정

이 ADR은 D2(Props/API) 내부 데이터 모델에 해당한다. `Element` 인터페이스는 Builder runtime의 internal data shape이며, D1(DOM/접근성)이나 D3(시각 스타일)과 무관하다. Spec 관여 없음.

### 배경 — ADR-122 soft constraint 이행

ADR-122 (Canonical-only runtime 전환)는 `Implemented` 완결 시점에 아래 soft constraint를 명시했다:

> "한 번에 `Element` 타입을 삭제하지 않고, runtime source 제거 → derived view 축소 → compatibility boundary quarantine 순서로 진행한다."

ADR-122 G6 closure 기준으로 Builder runtime hot path에서 mutable legacy mirror를 source로 쓰는 코드는 제거됐다. 그러나 `Element` 인터페이스 자체와 이를 소비하는 파생 view(`canonicalDocumentToElements`, `useCanonicalElements`), store cache(`elementsMap`, `childrenMap`), 그리고 각종 consumer 코드가 production에 잔존한다. ADR-122 residual policy 원문:

> "`UPDATE_ELEMENTS` Preview compatibility receive type, publish/cloud/export/import boundary, and canonical-derived renderer maps remain allowed by bucket."

즉 ADR-122는 "runtime source를 제거"했을 뿐, "Element 타입 자체를 제거"하지는 않았다. 이 ADR은 그 next step이다.

### 의존 ADR 체인

| ADR         | 역할                                                                                                                                                                 | 상태                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| ADR-116     | `CompositionDocument` storage SSOT 승격                                                                                                                              | Implemented              |
| ADR-118/119 | `children[]` order SSOT, `order_num` 제거                                                                                                                            | Implemented              |
| ADR-120/121 | IndexedDB legacy surface cleanup                                                                                                                                     | Implemented              |
| ADR-122     | runtime mutable legacy mirror 제거                                                                                                                                   | Implemented              |
| **ADR-123** | Cloud document-level row schema 단일화 (Supabase pages/elements row + cloud API surface 정리)                                                                        | **PREREQUISITE**         |
| **ADR-124** | Canonical-only history entry schema (legacy snapshot field 제거 + `composition-history` DB v1→v2 migration)                                                          | **PREREQUISITE**         |
| **ADR-125** | Render input canonical-native contract (layout engine map shape input 제거 + Preview `UPDATE_ELEMENTS` receive 제거 + element move `order_num` closure ADR-122 HC.5) | **PREREQUISITE**         |
| **ADR-127** | Canonical-native traversal helper + scene model 재설계 (`getChildren`/`getNodeMap`/`childrenByParent`, `CanonicalSceneModel.nodes`)                                  | **PHASE 2 PREREQUISITE** |
| **ADR-126** | Element 타입 boundary 격리 및 production 제거                                                                                                                        | 이 ADR                   |

**base/응용 분류**: ADR-126은 ADR-123/124/125의 **응용 ADR**이며, Phase 2부터는 ADR-127을 추가 prerequisite로 둔다. base 세 ADR 이 cloud transport / history persistence / render input contract 의 legacy `Element` 의존을 각각 제거하고, ADR-127 이 canonical-native traversal helper 와 scene model export shape 를 준비하면, ADR-126은 그 위에서 잔존 `Element` 타입 consumer 를 canonical-native model 로 전환하고 타입 자체를 boundary allowlist 로 격리한다. 역방향(ADR-126이 먼저) 진입 불가 — prerequisite 가 닫히기 전에는 `Element` 타입 의존 consumer 가 아직 존재하므로 production 0건 달성 불가능.

### 현재 Element 타입 사용 규모 (2026-05-10 기준 seed)

| 분류                    | 대상                                                                                                              | 추정 라인 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| derived view 정의       | `canonicalElementsView.ts` (`canonicalDocumentToElements`, `useCanonicalElements`, `useCanonicalSelectedElement`) | ~400      |
| history consumer        | `historyActions.ts`, `canonicalHistoryEvents.ts`                                                                  | ~100      |
| store cache 타입        | `elements.ts`, `unified.types.ts` store state 인터페이스                                                          | ~80       |
| hot path consumer       | `instanceActions.ts`, `canonicalRefResolution.ts`, Skia/scene/inspector/preview 등                                | ~400      |
| utility / helper        | `elementUtils.ts`, `elementHelpers.ts`, `legacyElementSanitizer.ts`                                               | ~200      |
| boundary (cloud/export) | `projectSync.ts`, `export.utils.ts`, `exportLegacyDocument.ts`                                                    | ~150      |

전체 추정: production `Element[]` 타입 참조 ~1,300+ 라인 (test/docs 제외).

### Hard Constraints

1. **60fps 유지**: canonical-native traversal이 render hot path에 추가 deep-traversal을 유발하지 않아야 한다.
2. **type-check 0 error**: 전환 중 타입 오류가 build를 막아서는 안 된다. Phase별 intermediate boundary alias 허용.
3. **test suite PASS**: 각 Phase gate마다 targeted Vitest PASS. 전체 suite 회귀 0.
4. **render parity 0**: Builder↔Preview 시각 결과 동일성 유지. Skia/CSS symmetric consumer 동일 결과.
5. **boundary 유지**: `exportLegacyDocument()`, `UPDATE_ELEMENTS` compat receive, cloud/export/import adapter는 Phase 6 이후에도 잔존 허용. production 0건 목표는 hot path consumer만 해당.

### Soft Constraints

- Phase별 점진 전환. 전체 consumer를 한 번에 변경하지 않는다.
- `Element` 타입은 Phase 6 이후 `@deprecated` JSDoc으로 마킹 후 boundary allowlist 파일로 이동. 타입 삭제는 이 ADR scope 밖 (별도 cleanup ADR).
- ADR-123/124/125 Implemented 이전에는 Phase 0만 수행한다. ADR-127 Implemented 이전에는 Phase 2 이상을 수행하지 않는다.

## Alternatives Considered

### 대안 A: Element 타입을 파생 view로 영구 유지

- 설명: mutable source write-back은 ADR-122에서 이미 제거됐으므로, 나머지 `Element[]` 파생 view(`canonicalDocumentToElements` 결과)를 runtime에서 계속 읽게 한다. 새 consumer는 canonical-native를 선호하지만 기존 consumer는 강제 전환하지 않는다.
- 근거: 전환 비용이 매우 적고, 기존 consumer가 안정적으로 동작한다.
- 위험:
  - 기술: M — canonical-native model과 Element 파생 view가 계속 coexist → identity mismatch 위험 잠재.
  - 성능: H — `canonicalDocumentToElements()` projection이 render/selection hot path에서 반복 호출될 수 있다. ADR-122 target state 요건("render 직전 full projection 금지")이 지켜지지 않는 경우가 잔존.
  - 유지보수: H — ADR-116/122 SSOT 선언에도 불구하고 runtime model이 여전히 `Element[]` 중심 → 신규 기여자가 어느 path를 사용할지 혼란. canonical-only 판정 기준 부재.
  - 마이그레이션: M — 나중에 consumer별 전환이 다시 필요하다. 비용 후불.

### 대안 B: Element 타입 즉시 전수 제거

- 설명: ADR-126 landing과 동시에 `Element` 인터페이스 및 모든 파생 view를 삭제하고, 모든 consumer를 canonical-native로 전환한다.
- 근거: 최종 상태에 단번에 도달. 중간 상태 부재.
- 위험:
  - 기술: H — ADR-123/124/125 없이 consumer가 의존할 canonical-native model이 아직 없음. 순서 역전 시 build break.
  - 성능: M — 잘못 설계된 canonical-native selector가 render마다 deep traversal 수행 가능.
  - 유지보수: M — 완료 후 단순하지만 cutover 중 rollback이 어렵다.
  - 마이그레이션: H — ~1,300 라인을 동시 변경 → 단일 PR이 거대해지고 review/rollback이 사실상 불가능.

### 대안 C: consumer 별 점진 canonical-native 전환 + Element 타입 boundary allowlist 격리 (권장)

- 설명: ADR-123/124/125 Implemented 및 ADR-127 Implemented 후, hot path consumer를 Phase별로 canonical-native로 전환한다. `Element` 타입은 boundary allowlist 파일(cloud/export/import adapter)로 격리하고 hot path에서 production 0건을 달성한다. 타입 삭제는 별도 cleanup ADR.
- 근거:
  - ADR-122 soft constraint 이행 순서(runtime source 제거 → derived view 축소 → boundary quarantine)와 정합.
  - Phase별 gate로 rollback 지점 확보.
  - 기존 boundary adapter(Supabase, export, import)는 건드리지 않으므로 cloud 호환성 위험 최소.
- 위험:
  - 기술: H — 소비자 전환 규모가 크고 ADR-123/124/125/127 prerequisite 준비가 필요하다.
  - 성능: M — canonical-native selector/resolver 설계에 따라 성능이 결정되지만 gate로 통제 가능.
  - 유지보수: H — Phase 기간 동안 Element + canonical-native 두 모델이 공존 → 일시적 복잡도 증가.
  - 마이그레이션: M — 점진이므로 Phase별 rollback 가능.

### 대안 D: canonical-native node alias로 Element 점진 deprecate (type alias 경로)

- 설명: `Element`를 `CanonicalElement` 같은 canonical-native type의 type alias로 선언하고, 내부 필드를 canonical model로 점진 miggate. `Element` 식별자 자체는 유지하되 그 shape를 canonical로 교체.
- 근거: consumer 코드 변경 최소화. import 이름 변경 불필요.
- 위험:
  - 기술: H — canonical model shape와 `Element` shape의 필드 불일치(`parent_id` vs tree 기반, `page_id`, `deleted` 등)가 커 type alias 1:1 매핑이 사실상 불가. wrapper shim 필요.
  - 성능: M — shim 레이어 오버헤드 잠재.
  - 유지보수: M — type alias와 실제 shape의 괴리가 커지면 타입 안전성 약화.
  - 마이그레이션: H — 외부에서 `Element`를 사용하는 boundary adapter가 canonical shape를 받으면 cloud/export 계약이 깨진다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | H    | H        | M            |     2      |
| B    | H    | M    | M        | H            |     2      |
| C    | H    | M    | H        | M            |     2      |
| D    | H    | M    | M        | H            |     2      |

루프 판정: 모든 대안에 HIGH가 2개 이상이다. 이 문제는 ADR-122 soft constraint가 예고한 것처럼 복잡도가 내재적이다. 따라서 HIGH 위험이 가장 적은 대안을 선택하는 대신 **위험 수용 근거**와 **Gate 제어**를 강화한다.

- **대안 A 기각**: 성능 H(projection 반복)와 유지보수 H(canonical-only 판정 기준 부재)가 ADR-116/122 SSOT 약속을 무력화한다.
- **대안 B 기각**: 기술 H(prerequisite 미완 시 순서 역전) + 마이그레이션 H(단일 거대 변경)은 rollback 불가 위험이 너무 크다.
- **대안 C 채택**: 세 대안 중 마이그레이션 위험이 M으로 가장 낮고, Phase gate로 기술/유지보수 HIGH를 분할 통제 가능. ADR-123/124/125 prerequisite 및 ADR-127 Phase 2 prerequisite를 gate로 묶어 순서 강제.
- **대안 D 기각**: 기술 H(shape 불일치로 type alias 불가) + 마이그레이션 H(cloud contract 파괴)가 boundary adapter를 위협한다.

## Decision

**대안 C: consumer 별 점진 canonical-native 전환 + Element 타입 boundary allowlist 격리**를 선택한다.

**위험 수용 근거**:

- 기술 H (소비자 전환 규모): ADR-123/124/125의 canonical-native model/resolver/store가 구축된 후에야 Phase 1 진입을 허용하는 Gate G0을 통해 순서를 강제한다. Phase 2 consumer 전환은 ADR-127의 traversal helper + canonical-native scene model prerequisite가 구축된 뒤에만 허용한다. prerequisite 미완 시 이 ADR은 Phase 0 또는 Phase 1에서 정지한다.
- 유지보수 H (두 모델 공존 기간): Phase 1~5 동안 `Element`는 점진 deprecate 상태로 마킹되며, 각 Phase gate에서 consumer 감소를 수치로 검증한다. 공존 기간의 상한을 base ADR들의 Implemented 이후 90일로 설정한다.

**base ADR prerequisite 본문 명시 위치**: Status 섹션 첫 문단 + Context §의존 ADR 체인 테이블.

> 구현 상세: [126-element-type-deprecate-breakdown.md](design/126-element-type-deprecate-breakdown.md)

## Risks

| ID  | 위험                                                                                            | 심각도 | 대응                                                                                           |
| --- | ----------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------- |
| R1  | ADR-123/124/125 prerequisite 미완 상태에서 Phase 1 진입 또는 ADR-127 미완 상태에서 Phase 2 진입 |  HIGH  | G0 gate가 Phase 1 prerequisite status를 검증. ADR-127 미완 시 Phase 2에서 hard stop            |
| R2  | canonical-native selector가 render 매 frame마다 deep traversal 수행 → 60fps 하락                |  HIGH  | Phase 1 gate에서 selector 설계 검토 및 FPS 측정 필수. 문제 시 Phase 1 rollback                 |
| R3  | 전환 중 Element + canonical-native 두 모델 공존으로 consumer 혼란                               |  HIGH  | Phase별 `@deprecated` JSDoc 마킹 + `local/no-deprecated-element-import` gate 로 신규 추가 차단 |
| R4  | boundary adapter(cloud/export/import)가 canonical-native shape를 받아 계약 파괴                 |  MED   | boundary allowlist 파일 분리 (G4 gate). allowlist 외 `Element[]` 생성은 CI grep gate로 차단    |
| R5  | history/undo에서 Element diff 기반 logic이 canonical patch를 놓쳐 undo 회귀                     |  MED   | Phase 4 gate에서 canonical history event contract 검증 + undo/redo targeted Vitest             |
| R6  | test suite의 `Element[]` fixture가 canonical-native 전환 후 silent inflation (0 test 통과)      |  MED   | 각 Phase Vitest에서 expected vs actual count 비교. `canonicalElementsView.test.ts` 명시 포함   |

## Gates

| Gate                            | 시점         | 통과 조건                                                                                                                                                                                                                                                                                         | 실패 시 대안                                                                  |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| G0: prerequisite lock           | Phase 0 종료 | ADR-123, ADR-124, ADR-125 모두 `Implemented`. inventory bucket 분류 완료 (derived view / store cache / hot path consumer / boundary)                                                                                                                                                              | Phase 1 진입 금지. prerequisite ADR 완결 후 재진입                            |
| G1: canonical-native model 검증 | Phase 1 종료 | canonical-native node/path/alias model이 `Element` 없이 Skia/layout/Preview hot path를 커버. type-check 0 error                                                                                                                                                                                   | Phase 1 rollback, model 재설계                                                |
| G2: hot path consumer 전환      | Phase 2 종료 | ADR-127 Implemented. Skia/layout/Preview/Properties/LayerTree에서 `Element` 타입 import 0건 (boundary/test 제외). 60fps 실측 PASS. **deprecation lint gate**: `Element` 타입에 `@deprecated` 마킹 + `local/no-deprecated-element-import` 활성화 후 신규 production import 시 lint error 발생 검증 | consumer별 temporary read-only adapter로 격리 후 재시도                       |
| G3: store cache 전환            | Phase 3 종료 | `elements.ts` 의 `elementsMap`/`childrenMap` store state/cache contract 에서 `Element` key/value 타입 참조 0건 또는 canonical-derived readonly/deprecated snapshot 으로 전환됨. `inspectorActions`/`elementLoader`/history/utility map consumer 는 Phase 4 gate 소유로 제외한다.                  | ADR-125 결과물과 재정렬                                                       |
| G4: boundary allowlist 격리     | Phase 4 종료 | `exportLegacyDocument()` + `Element[]` 생성이 허용 경로(projectSync/cloud/export/import/publish) 외 production 0건. CI grep gate PASS                                                                                                                                                             | allowlist 보강 후 재시도                                                      |
| G5: derived view 제거           | Phase 5 종료 | `canonicalDocumentToElements()`, `useCanonicalElements()`, `useCanonicalSelectedElement()` 호출이 non-boundary production 0건                                                                                                                                                                     | derived view → canonical-native 재전환                                        |
| G6: final verification          | Phase 6 종료 | type-check 0 error, targeted Vitest PASS, 60fps 실측 PASS, authenticated browser smoke (create/edit/delete/undo/redo/reorder/origin-instance/refresh) 회귀 0, scoped derived-view grep 0건, local deprecated import lint gate PASS, preflight PASS. Broad `Element[]                              | : Element` grep 은 false positive가 많아 단독 pass/fail 기준으로 쓰지 않는다. | 실패 bucket을 residual 기록 후 phase 재실행 |

## Consequences

### Positive

- Builder runtime이 완전한 canonical-native model로 구동된다. ADR-116/122 SSOT 약속이 타입 레벨까지 닫힘.
- `Element` 파생 view의 반복 projection이 hot path에서 사라져 mutation/selection/render 경로가 단순화된다.
- 신규 기여자가 어느 model을 쓸지 선택할 필요가 없다. canonical-native 단일 경로.
- 향후 Supabase physical schema drop ADR이 이 ADR 완결 이후 범위를 좁혀 착수 가능해진다.

### Negative

- Phase 1~5 동안 Element + canonical-native 두 모델 공존 → 일시적 코드베이스 복잡도 증가.
- ADR-123/124/125 prerequisite 완결까지 Phase 1 이상 진입할 수 없고, ADR-127 prerequisite 완결까지 Phase 2 이상 진입할 수 없다.
- boundary adapter(cloud/export/import)는 `Element[]` 생성 경로를 계속 유지해야 하므로 boundary 내부 복잡도는 줄지 않는다.
- `Element` 타입 완전 삭제는 이 ADR scope 밖. 별도 cleanup ADR이 필요하다.

## 반복 패턴 선차단 체크리스트 (adr-writing.md §"반복 패턴 선차단" 4 항목 selfcheck)

- [x] **HIGH+ 위험 코드 경로 3곳 이상 구체 인용**: HIGH 2개 (R1 기술 / R2 유지보수). 코드 경로 인용 — `Element` 타입 grep ~1,300 line hit (production), `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts:234` (`canonicalDocumentToElements` 정의) + `:352` (`useCanonicalElements`) + `:390` (`useCanonicalSelectedElement`) + `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts:227` (history undo result), `useCanonicalElements()` production 14 line hit (call site ~12), store cache `elementsMap`/`childrenMap` 전체. R3 (신규 `Element` 추가) → G2 deprecation lint gate (`@deprecated` + `eslint-plugin-deprecation`).
- [x] **Spec/Generator 확장 ADR 여부**: 본 ADR 은 type deprecate, Spec/Generator 확장 아님. N/A.
- [x] **BC 훼손 수식화**: 외부 cloud/export/import boundary 호환성 = 100% 유지 (`Element[]` 생성 경로 boundary allowlist 잔존). 내부 production consumer = 100% canonical-native 전환 (boundary 외 `Element` import 0건 lint gate). 사용자 영향: 0 (render parity / behavior 변경 없음, type-level deprecate 만).
- [x] **HIGH+ Phase 분리 가능 여부 검토**: HIGH 2 누적이지만 base 3 prerequisite (ADR-123/124/125) 와 Phase 2 prerequisite ADR-127 분리로 위험 누적 시점 차단. Phase 0 (G0 prerequisite lock) → Phase 1 (canonical-native model 검증) → Phase 2-5 (consumer 별 점진 전환) 분할로 단일 phase HIGH 누적 회피. ADR-127은 Phase 2 진입 직전 helper/API/scene model prerequisite로 별도 발의 및 Implemented 완료. 본 ADR은 그 위의 consumer 전환 응용 ADR 로 유지한다.
