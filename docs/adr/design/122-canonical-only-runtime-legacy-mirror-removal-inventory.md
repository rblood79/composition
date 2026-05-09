# ADR-122 Phase 0 Inventory — Canonical-only Runtime Legacy Mirror Removal

2026-05-08 current tree 기준 inventory freeze 문서다. 이 문서는
[ADR-122](../completed/122-canonical-only-runtime-legacy-mirror-removal.md)의 G0 bucket
판정과 각 bucket의 target phase를 고정한다.

## Measurement

Seed command:

```bash
rg -n "exportLegacyDocument\\(|canonicalDocumentToElements\\(|UPDATE_ELEMENTS|UPDATE_CANONICAL_DOCUMENT|useStore\\.getState\\(\\)\\.elementsMap|state\\.elementsMap|childrenMap|setElements\\(" \
  apps/builder/src packages/shared/src apps/publish/src \
  -g '*.ts' -g '*.tsx'
```

Current raw count:

```text
462
```

Current execution snapshot:

```text
phase: Implemented archive complete
implementation progress: 100%
formal gate closure: 100%
latest closed slice: ADR-113/116 grep gate recovery + store helper canonical-before-cache closure + exact G6 builder/shared verification
main closure commit: d72b85441
next open contract: none for ADR-122; cloud/Supabase physical schema removal remains outside this ADR
```

Top raw buckets:

```text
apps/builder/src/builder/stores/utils/__tests__/instanceActions.test.ts:33
apps/builder/src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts:23
apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts:14
apps/builder/src/builder/stores/elements.ts:12
apps/builder/src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts:12
apps/builder/src/builder/stores/__tests__/inspectorFills.test.ts:12
apps/builder/src/adapters/canonical/__tests__/legacyExtensionRoundtrip.test.ts:12
apps/builder/src/builder/stores/__tests__/pageActivation.test.ts:11
apps/builder/src/builder/stores/__tests__/elementMove.test.ts:11
apps/builder/src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts:11
apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts:10
apps/builder/src/builder/workspace/canvas/renderers/rendererInput.ts:10
```

## Bucket Rules

| Bucket                        | Meaning                                                                                                     | Owner     | Target phase |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | --------- | ------------ |
| `runtime-forbidden`           | Builder mutation/read/render/selection/drag/drop active path가 mutable legacy mirror를 source로 읽거나 쓴다 | Builder   | Phase 1-3    |
| `transition-derived-readonly` | canonical store에서 파생한 read-only cache/snapshot이다. owner와 제거 phase가 있어야 한다                   | Builder   | Phase 2-4    |
| `boundary-allowed`            | cloud/export/import/publish/legacy compatibility adapter boundary다                                         | Adapter   | Phase 4      |
| `test-doc`                    | tests, fixtures, docs, static gates. runtime source가 아니다                                                | Test/Docs | Phase 5      |

## Classified Inventory

| Surface / glob                                                                                                                                                   | Bucket                        | Current status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Target |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `apps/builder/src/adapters/canonical/canonicalMutations.ts`                                                                                                      | `runtime-forbidden`           | Phase 1 slice에서 wrapper 내부 `actions.setElements(exportLegacyDocument(doc))` write-back 제거 완료                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | G1     |
| `apps/builder/src/builder/main/BuilderCore.tsx`, `apps/builder/src/builder/panels/nodes/PagesSection.tsx`, `frameLayoutCascade.ts` canonical→legacy cache bridge | `transition-derived-readonly` | page-shell reverse bridge, page delete bridge, mutation registration snapshot 입력은 active canonical document direct traversal 기반으로 정렬하고 bootstrap fallback은 store `elements[]`를 사용. `BuilderCore` registration/page-shell bridge fallback은 `getCanonicalOrBootstrapBuilderElements()` helper로 격리하고, page-shell bridge 전용 snapshot은 새 page body shell을 보존하면서 삭제된 page/origin snapshot을 되살리지 않는 `getPageShellBridgeElements()`로 분리했다. `PagesSection` page-delete bridge는 direct canonical traversal을 우선하고 fallback 필요 시 삭제 후 최신 store snapshot만 사용. frame delete removed-id collection도 canonical-derived/store bootstrap source를 사용. `canonicalLegacyStoreCacheBridge`와 store `recoverElementsSnapshot` action surface는 제거 완료 | G2/G4  |
| `apps/builder/src/builder/main/BuilderCore.tsx` Preview publish subscription                                                                                     | `runtime-forbidden`           | Phase 3 slice에서 active `UPDATE_ELEMENTS` publish 제거 완료                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | G3     |
| `apps/builder/src/builder/hooks/useIframeMessenger.ts`                                                                                                           | `runtime-forbidden`           | Phase 3 slice에서 canonical document 변경 effect를 active sync로 고정. `UPDATE_ELEMENTS`는 legacy bootstrap/compat outbound path로만 남기고, Preview inbound `UPDATE_ELEMENTS` recovery가 Builder legacy store cache를 갱신하던 역방향 branch는 제거. Selection echo와 preview-generated column/field dedupe는 active canonical document traversal 우선이며 store `elementsMap` subscription/direct read 제거. active canonical document가 있으면 missing element/id를 legacy cache에서 되살리지 않고, `UPDATE_ELEMENTS` bootstrap은 canonical document 부재 시에만 legacy snapshot을 읽는다. Runtime Compare Mode store flag도 WebGL-only 차단 조건에 포함해 Skia/WebGL canvas 상태와 무관하게 Compare Mode canonical document sync가 실행된다                                                      | G3/G4  |
| `apps/builder/src/builder/hooks/useDeltaMessenger.ts`, `canvasDeltaMessenger.ts`                                                                                 | `transition-derived-readonly` | deprecated delta stats count는 canonical elements length를 우선 사용하고 store `elements.length`는 bootstrap fallback으로만 사용. store `elementsMap.size` subscription 제거. full `UPDATE_ELEMENTS` fallback과 unused `CanvasDeltaMessenger.sendFullElements` 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | G3/G4  |
| `apps/builder/src/services/messaging.ts`, `apps/builder/src/utils/dom/iframeMessenger.ts`, `apps/builder/src/builder/hooks/useMessageCoalescing.ts`              | `runtime-forbidden`           | unused full element snapshot messaging facade인 `updateElements` helpers와 dead `useMessageCoalescing` hook 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | G4     |
| `apps/builder/src/builder/utils/performanceMonitor.ts`                                                                                                           | `transition-derived-readonly` | monitoring element count/store memory estimate는 active canonical document traversal count를 우선 사용하고 store `elements.length`는 bootstrap fallback으로만 사용. store `elementsMap.size` count 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | G4     |
| `apps/builder/src/builder/panels/monitor/hooks/useComponentMemory.ts`                                                                                            | `transition-derived-readonly` | component memory analysis는 active canonical elements에서 element/child lookup map을 파생하고 store `elements`는 canonical 비활성 bootstrap fallback으로만 구독. store `elementsMap`/`childrenMap` subscription 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | G4     |
| `apps/builder/src/preview/App.tsx`, `apps/builder/src/preview/messaging/messageHandler.ts`, `apps/builder/src/preview/types/index.ts`                            | `boundary-allowed`            | Preview는 `UPDATE_CANONICAL_DOCUMENT` primary 수신, `UPDATE_ELEMENTS`는 compatibility message type으로 잔존. `App` render guard는 legacy preview `elements[]`가 비어 있어도 canonical document가 있으면 `renderElementsTree()`를 실행해 canonical-only Preview를 빈 화면으로 오판하지 않는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | G3/G4  |
| `apps/builder/src/builder/stores/index.ts::useSelectedElementData`                                                                                               | `runtime-forbidden`           | Phase 2 slice에서 active canonical document 존재 시 legacy `elementsMap` fallback 제거. legacy-bootstrap fallback도 store `elements[]`에서 selected/ref lookup을 수행하고 selected ref override props fallback은 active canonical document direct traversal 사용. legacy mode selected/ref override props lookup은 이미 읽은 selected element를 재사용해 같은 id를 store `elements[]`에서 다시 찾지 않음                                                                                                                                                                                                                                                                                                                                                                                             | G2     |
| `apps/builder/src/builder/stores/index.ts`, `apps/builder/src/builder/stores/elements.ts` exported lookup/current-page selectors                                 | `transition-derived-readonly` | unified store exported `useElements`/`useElementById`/`useChildElements`/`useCurrentPageElements`/`useCurrentPageElementCount` selectors는 canonical-first source를 사용하고 store `elements`/`pageElementsSnapshot`은 canonical 비활성 bootstrap fallback으로만 사용. standalone `elements.ts`의 미사용 중복 lookup/current-page hook surface 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                  | G2/G4  |
| `apps/builder/src/builder/stores/elementLoader.ts`                                                                                                               | `transition-derived-readonly` | lazy-loading disabled/already-loaded/loading-wait read path와 page activation invariant lookup은 active canonical document에서 파생한 element source를 우선 사용한다. legacy store `elements[]`는 canonical document 부재 시 bootstrap fallback으로만 남기고 DB `pages/elements/layouts` read는 재도입하지 않는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | G2/G4  |
| `apps/builder/src/builder/stores/inspectorActions.ts`                                                                                                            | `runtime-forbidden`           | selected/style/fill commit·preview lookup은 active canonical document traversal을 우선 사용한다. active canonical document가 있으면 mutable legacy fallback과 병합하지 않고, fallback iterable은 canonical document 부재 시에만 소비한다. direct `elementsMap` lookup/patch는 static gate로 차단                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | G2/G4  |
| `apps/builder/src/builder/panels/properties/**`, `panels/styles/**`                                                                                              | `runtime-forbidden`           | `StylesPanel`/style hooks/generic/child/items/simple/specialized/Table editors, 단일 element editor, ElementSlot/ListBoxProperty/Slider specialized read, Component/Frame slot section read, LayoutPresetSelector/usePresetApply, PropertiesPanel 본체 direct read는 canonical read 우선으로 전환. `useCanonicalPropertyRead` fallback도 store `elements[]`에서 map을 파생. `useResetStyles` reset action은 canonical document traversal을 직접 사용하고 active canonical document가 있으면 missing selected element를 legacy cache에서 되살리지 않음. `useTransformAuxiliary` per-hook direct selected map read 제거                                                                                                                                                                                | G2     |
| `apps/builder/src/builder/hooks/useSyncChildProp.ts`, `useSyncGrandchildProp.ts`                                                                                 | `runtime-forbidden`           | SliderEditor가 canonical property maps로 child sync를 직접 수행하도록 전환하면서 두 unused/legacy hooks와 barrel export 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | G2     |
| `apps/builder/src/builder/hooks/useCollectionItemManager.ts`                                                                                                     | `transition-derived-readonly` | collection item manager children read는 active canonical elements를 우선 사용하고 store `elements`는 bootstrap fallback으로만 사용. direct store `childrenMap` read 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | G2/G4  |
| `apps/builder/src/builder/overlay/index.tsx`, `builder/components/property/PropertyCustomId.tsx`                                                                 | `runtime-forbidden`           | Selection overlay body 판정과 customId validation은 active `canonicalElementSnapshot` helper 대신 canonical-derived element source를 사용하고 direct `elementsMap` lookup 제거. canonical elements가 있으면 store `elements`는 empty bootstrap fallback으로만 구독                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | G2     |
| `apps/builder/src/services/ai/tools/**`                                                                                                                          | `runtime-forbidden`           | AI tool read path는 `getAiToolReadModel()` 내부에서 active canonical document를 직접 traversal하고 direct `elementsMap`/`childrenMap` read 금지                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | G2     |
| `apps/builder/src/builder/panels/nodes/tree/**`, `LayersSection.tsx`, `FramesTab.tsx`                                                                            | `runtime-forbidden`           | LayerTree/LayersSection stale map override 차단 완료. `useTreeExpandState`는 caller-provided frame/tree elements에서 parent lookup map을 파생하며 FramesTab refresh test는 canonical descendants 존재 시 mirror merge 없이 canonical view를 사용하는 계약으로 정렬했다. FramesTab hydration fallback과 LayerTree resolution fallback은 store `elements`에서 read-only map을 파생하되, active canonical elements가 있으면 store `elements` 구독은 empty bootstrap fallback으로 고정한다. 남은 tree index/helper는 canonical-derived view helper이며 mutable legacy mirror source가 아니다                                                                                                                                                                                                             | G2     |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`, `workspace/canvas/scene/canonicalSceneModel.ts`                                                   | `transition-derived-readonly` | active canonical document가 있으면 page/frame mode 모두 `buildCanonicalSceneModel(activeCanonicalDocument)`에서 만든 read-only tree, `elementsMap`, `childrenMap`, `pageIndex`, `frameElementScopes`를 Skia input으로 사용. direct `useCanonicalElements()` hook boundary를 제거하고 store fallback map은 store `elements[]`에서만 파생하되 active canonical document가 있으면 store `elements` subscription은 empty bootstrap fallback으로 고정. scene model 내부도 `canonicalElementSnapshot` helper 대신 canonical document traversal을 직접 사용. `SceneStructureSnapshot.source`로 canonical/legacy-bootstrap provenance를 태그                                                                                                                                                                 | G3     |
| `apps/builder/src/builder/stores/canvasStore.ts::useCanvasElements/useCanvasSelectedElement`                                                                     | `transition-derived-readonly` | canvas current page elements와 selected element lookup은 active canonical elements 우선. `pageElementsSnapshot`/store `elements`는 canonical 비활성 bootstrap fallback으로만 사용하고 direct store `elementsMap` selected lookup 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | G3/G4  |
| `apps/builder/src/builder/workspace/overlay/useTextEdit.ts`                                                                                                      | `runtime-forbidden`           | live text edit는 canonical document traversal로 edit element를 찾고 canonical mutation wrapper를 우선 통과한다. active canonical document가 있으면 missing element를 legacy cache에서 되살리지 않고, wrapper unchanged 시에도 active canonical document 존재 시 legacy patch를 생략한다. legacy store patch는 canonical hydration 전 bootstrap fallback으로만 남기고 direct `elementsMap` get/patch는 static gate로 차단                                                                                                                                                                                                                                                                                                                                                                             | G2/G3  |
| `apps/builder/src/builder/workspace/canvas/skia/**`, `renderers/rendererInput.ts`, legacy `sceneGraph/*`/`sprites/useResolvedElement.ts`                         | `runtime-forbidden`           | Skia render/hover/scroll input과 StoreRenderBridge sync는 canonical-derived maps를 우선 사용. Hover/scroll map provider를 필수화해 stale store map fallback 제거. 미사용 legacy `sceneGraph/*`/`sprites/useResolvedElement.ts` surface 제거. layout engine의 map-shaped input contract는 canonical-derived internal render contract로 유지되며 mutable legacy mirror source가 아니다                                                                                                                                                                                                                                                                                                                                                                                                                 | G3     |
| `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts`, selection/drop target helpers                                                                | `runtime-forbidden`           | `useDragBridge`, `useCanvasDragDropHelpers`, `useCanvasElementSelectionHandlers`, central pointer handler, canvas detach context menu는 canonical-derived/input maps 우선. `useCanvasElementSelectionHandlers` provider를 필수화해 stale store map fallback 제거. drop target resolver/drag bridge context는 read-only `elementsById`/`childrenByParent` 계약으로 전환                                                                                                                                                                                                                                                                                                                                                                                                                               | G2/G3  |
| `apps/builder/src/builder/stores/elements.ts`, `stores/utils/elementCreation.ts`, `elementUpdate.ts`, `elementRemoval.ts`                                        | `runtime-forbidden`           | closure audit에서 add/update/remove store helper가 derived store cache를 먼저 쓰고 canonical document를 뒤따라 맞추는 순서가 남아 있음을 확인했다. `elementCreation`, `elementUpdate`, `elementRemoval`은 이제 canonical mutation wrapper를 먼저 호출하고 `elements`/`elementsMap`/`childrenMap` store cache를 그 다음 갱신한다. store cache는 canonical 비활성 bootstrap 또는 UI-derived cache로만 남긴다. `elementCreation` parent context lookup은 direct `RefNode.descendants` access 대신 `canonicalElementsView` helper boundary를 사용해 ADR-113 descendants quarantine gate를 다시 통과한다                                                                                                                                                                                                  | G1/G2  |
| `apps/builder/src/builder/stores/history/historyActions.ts`, `stores/history/canonicalHistoryEvents.ts`, `stores/utils/historyHelpers.ts`                        | `transition-derived-readonly` | undo/redo/goToHistoryIndex는 active canonical document traversal을 source로 사용하고, serialized `data.diff`/`data.diffs` event payload를 snapshot payload보다 먼저 적용한다. canonical document sync를 index rebuild보다 먼저 수행해 active canonical document와 store `elementsMap`의 diff 결과를 일치시킨다. cloud compatibility upsert map도 active canonical document direct traversal을 우선 사용한다. add/remove/group/ungroup 신규 entry는 canonical `insert`/`remove`/`move` node event sequence를 기록하며 legacy element snapshots를 쓰지 않는다. Closure audit에서 `canonicalHistoryEvents` direct `descendants`/`layout_id` access를 제거하고 `canonicalElementsView`/`frameMirror` helper boundary로 이동했다                                                                          | G2/G4  |
| `apps/builder/src/adapters/canonical/frameLayoutCascade.ts`, `pageFrameBinding.ts`                                                                               | `transition-derived-readonly` | Phase 1 slice에서 mutation write-back 제거. `pageFrameBinding` page body 보존 입력은 active canonical document direct traversal + legacy 보강으로 축소. `frameLayoutCascade` unused duplicate helper와 `exportLegacyDocument(doc)` projection 제거. 남은 helper는 adapter boundary 내부 보존용이며 Builder runtime mutable mirror source가 아니다                                                                                                                                                                                                                                                                                                                                                                                                                                                    | G1/G4  |
| `apps/builder/src/builder/stores/canonical/canonicalElementSnapshot.ts`                                                                                          | `runtime-forbidden`           | active current-document snapshot helper file 제거 완료. frame element loader, LayoutPreset slot replace, drag/drop history payload, BuilderCore/cache bridge, pageFrameBinding, useIframeMessenger, inspector, history, elements, selection/overlay/property consumers는 `visitCanonicalDocumentElements` 또는 canonical property/read model traversal로 전환                                                                                                                                                                                                                                                                                                                                                                                                                                        | G4     |
| `apps/builder/src/adapters/canonical/exportLegacyDocument.ts`, `legacyToCanonical*`, `canonicalRefResolution`                                                    | `boundary-allowed`            | compatibility conversion/roundtrip boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | G4     |
| `apps/builder/src/adapters/canonical/shadowWriteDiff.ts`                                                                                                         | `test-doc`                    | Dormant ADR-116 shadow-write evaluator. Canonical document를 직접 legacy export하는 convenience wrapper는 제거했고, 명시 legacy snapshot diff evaluator/logger만 유지                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | G5     |
| `apps/builder/src/utils/projectSync.ts`, shared export/import utils                                                                                              | `boundary-allowed`            | Supabase/export/import/publish compatibility projection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | G4     |
| `packages/shared/src/renderers/**`, `renderer.types.ts`                                                                                                          | `transition-derived-readonly` | shared `RenderContext`를 `ReadonlyMap` 기반 `elementsById`/`childrenByParent` read model로 전환. Preview는 canonical-resolved tree에서 이 context를 주입. TagGroup legacy remove path의 parent `UPDATE_ELEMENTS` snapshot 송신 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | G3/G4  |
| `apps/publish/src/**`                                                                                                                                            | `boundary-allowed`            | external publish/runtime compatibility path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | G4     |
| `**/__tests__/**`, `*.static.test.ts`, docs                                                                                                                      | `test-doc`                    | stale `order_num`, strict grep, static string 계약 정렬 대상                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | G5     |

## Gate Evidence

Phase 1 mutation mirror removal slice:

```bash
rg -n "actions\\.setElements\\(|setElements\\(exportLegacyDocument|exportLegacyDocument\\(doc\\)" \
  apps/builder/src/adapters/canonical/canonicalMutations.ts
```

Result: 0 hits.

Targeted tests:

```bash
pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__
pnpm -F @composition/shared exec vitest run src/utils
pnpm -F @composition/builder exec vitest run \
  src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts \
  src/builder/main/BuilderCore.static.test.ts
pnpm -F @composition/builder exec vitest run \
  src/builder/panels/nodes/LayersSection.test.ts \
  src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/hooks/useDragBridge.test.ts \
  src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.test.ts \
  src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.static.test.ts
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts \
  src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.static.test.ts
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts \
  src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts \
  src/builder/workspace/canvas/skia/SkiaCanvas.static.test.ts
pnpm -F @composition/shared exec vitest run src/renderers
pnpm -F @composition/builder exec vitest run src/builder/main/BuilderCore.static.test.ts
pnpm -F @composition/builder exec vitest run src/services/ai/tools/canonicalToolReadModel.static.test.ts
pnpm -F @composition/builder exec vitest run src/builder/components/property/PropertyCustomId.test.tsx
pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/PagesSection.test.tsx
pnpm -F @composition/builder exec vitest run \
  src/builder/panels/properties/generic/genericEditorCanonical.static.test.ts \
  src/builder/panels/styles/hooks/styleReadCanonical.static.test.ts \
  src/builder/panels/styles/hooks/useResetStyles.test.tsx \
  src/builder/panels/styles/hooks/useTransformAuxiliary.test.tsx
pnpm -F @composition/builder exec vitest run \
  src/builder/main/BuilderCore.static.test.ts \
  src/builder/main/canonicalLegacyStoreCacheBridge.static.test.ts
pnpm run codex:typecheck
```

Observed results:

- builder canonical adapter suite: 19 files / 217 tests PASS.
- shared utils suite: 5 files / 54 tests PASS.
- Preview active-channel static slice: 2 files / 10 tests PASS.
- LayerTree/LayersSection canonical map slice: 2 files / 12 tests PASS.
- DragBridge canonical map slice: 2 files / 8 tests PASS.
- Canvas auxiliary drag/drop helper slice: 2 files / 4 tests PASS.
- Canvas selection handler canonical map slice: 2 files / 6 tests PASS.
- Skia hover + StoreRenderBridge canonical map slice: 3 files / 21 tests PASS.
- Canvas context menu canonical map slice: covered by BuilderCanvas projection
  static test and canvasContextMenu unit test.
- StylesPanel canonical selected data slice: static test PASS.
- Style hooks canonical read slice: 4 files / 15 tests PASS.
- Style context consolidation slice: 4 files / 34 tests PASS.
- Generic property editor canonical read slice: 1 file / 2 tests PASS.
- Simple/specialized property editor canonical read hook slice: 2 files / 3 tests PASS.
- TableEditor canonical read slice: same static hook/editor test PASS.
- Single-read property editor canonical slice: 4 files / 6 tests PASS.
- ElementSlot/ListBoxProperty/Slider specialized read slice: 1 file / 3 tests PASS.
- Component/Frame slot section canonical read slice: 3 files / 29 tests PASS.
- LayoutPresetSelector/usePresetApply canonical read slice: 1 file / 4 tests PASS.
- PropertiesPanel canonical read slice: covered by property/editor targeted
  batch, 5 files / 36 tests PASS.
- Central pointer handler fallback slice: 1 file / 2 tests PASS.
- Drop target resolver/drag bridge read-model slice: 3 files / 21 tests PASS.
- Shared renderer read-model context slice: 4 files / 37 tests PASS.
- BuilderCore direct traversal bridge slice: 1 file / 4 tests PASS.
- PagesSection page-delete bridge direct traversal slice: 1 file / 5 tests PASS.
- History direct traversal compatibility sync slice: 1 file / 1 test PASS.
- Selection hierarchy direct traversal lookup slice: 1 file / 1 test PASS.
- Element removal target collection slice: 2 files / 4 tests PASS.
- Instance action lookup/children slice: 2 files / 23 tests PASS.
- Element update pre-read/dirty traversal slice: 3 files / 21 tests PASS.
- Elements items/Menu action lookup slice: 1 file / 8 tests PASS; raw seed remains
  485 because this was a direct `get().elementsMap` cleanup outside the raw seed
  pattern.
- Elements page activation/hydration lookup slice: 1 file / 9 tests PASS; raw seed
  485 -> 482. `lazyLoadPageElements` selection fixture now seeds canonical document
  source and asserts legacy `getByPage` is not called. Follow-up uses active
  canonical document traversal fallback.
- Elements merge/replace + selection props fallback slice: 4 files / 56 tests PASS;
  raw seed 482 -> 480. `mergeElements`/`replaceElementId` pre-read and
  set/select/multi-select props fallback no longer read store maps directly and now use
  active canonical document traversal fallback.
- Elements page shell/remove/move fallback slice: 3 files / 14 tests PASS; raw seed
  480 -> 478. Page shell append, page removal, and cross-container move derive
  read indexes from `elements[]`; move fallback also updates target sibling
  `order_num` from insertion order.
- Inspector actions style/fill preview slice: 2 files / 11 tests PASS; raw seed
  478 -> 476. Follow-up direct traversal static slice 1 file / 1 test PASS.
  selected lookup, preview element replacement, and dirty subtree traversal derive from
  `elements[]` plus active canonical document traversal fallback.
- Element creation/instance/TableHeader lookup slice: 6 files / 53 tests PASS; raw
  seed 476 -> 474. customId generation, instance origin/reset paths, and table row
  discovery derive local lookup/children indexes from `elements[]`.
- Preview/messaging boundary cleanup slice: useIframeMessenger/usePageManager static
  tests 2 files / 17 tests PASS, shared collection renderer contract 1 file / 1 test
  PASS, messaging facade contract 1 file / 1 test PASS, export SSOT grep gate 1 file /
  2 tests PASS, type-check PASS; raw seed 474 -> 463.
- Generic/style follow-up canonical read slice: 4 files / 36 tests PASS.
- Skia scene source marker slice: 3 files / 14 tests PASS.
- Skia scene pageIndex canonical-derived slice: 3 files / 14 tests PASS.
- Skia/direct traversal slice: 6 files / 35 tests PASS;
  raw seed 463 -> 462.
- Canvas selection handler required-map slice: 2 files / 7 tests PASS.
- Skia hover required-map slice: 2 files / 15 tests PASS.
- Skia scroll provider slice: 2 files / 4 tests PASS.
- Legacy canvas surface cleanup slice: 5 files / 57 tests PASS.
- PageFrameBinding direct traversal input slice: 2 files / 7 tests PASS.
- FramesTab/useTreeExpandState canonical input slice: 2 files / 15 tests PASS.
- FramesTab hydration fallback derived-map slice: 2 files / 20 tests PASS.
- FrameLayoutCascade unused legacy projection cleanup slice: 2 files / 10 tests PASS.
- ShadowWriteDiff stale canonical export wrapper cleanup slice: 1 file / 21 tests PASS.
- Canonical element snapshot projection boundary slice: 5 files / 18 tests PASS.
- useIframeMessenger direct traversal selection/dedupe slice: 1 file / 8 tests PASS.
- Text edit + reset style direct traversal slice: 2 files / 5 tests PASS.
- Delta messenger canonical count slice: 1 file / 1 test PASS.
- Performance monitor direct traversal count slice: 1 file / 1 test PASS.
- SliderEditor child sync legacy hook cleanup slice: 1 file / 3 tests PASS.
- AI tool + PropertyCustomId direct traversal slice: 2 files / 9 tests PASS.
- Overlay body lookup direct traversal slice: type-check covered.
- Canonical legacy cache bridge initial quarantine slice: 2 files / 5 tests PASS;
  follow-up removal slice: 4 files / 21 tests PASS.
- ElementLoader/inspectorActions/useTextEdit follow-up static slice: 3 files / 3 tests
  PASS. PagesSection follow-up page-delete bridge fallback slice: 1 file / 5 tests
  PASS. useIframeMessenger canonical follow-up slice: 1 file / 8 tests PASS. raw seed
  remains 462. useResetStyles follow-up style read/reset tests: 2 files / 22 tests
  PASS. useSelectedElementData follow-up test: 1 file / 7 tests PASS. direct legacy
  `state.elements` grep 70 -> 56. BuilderCore fallback helper follow-up: 1 file / 4
  tests PASS. Mutation source canonical-first slice: 5 files / 28 tests PASS. Store
  source canonical-first slice: 5 files / 29 tests PASS. Canonical legacy cache bridge
  removal slice: 4 files / 21 tests PASS. History diff/event undo-redo slice:
  2 files / 3 tests PASS. Direct fallback cleanup slice: 15 files / 39 tests PASS.
  direct legacy `state.elements` grep 70 -> 0.
- Canonical full-replace prune follow-up: canonicalMutations test 1 file / 23 tests
  PASS, History diff/static tests 2 files / 3 tests PASS, type-check PASS, seeded
  Builder browser smoke PASS. `setElementsCanonicalPrimary()` no longer leaves an
  omitted page-owned runtime sibling in `db.documents`; redo/reload after deleting
  `button-2` keeps store/document ids at `page-1`, `button-1`.
- History canonical node event follow-up: history/creation/removal/helper tests
  5 files / 28 tests PASS, `elementCreationCanonical.test.ts` 1 file / 17 tests
  PASS after RED confirmation for `legacy-page -> body` add history, realistic
  Builder browser smoke PASS for add undo/redo, remove undo/redo, reload
  persistence, and local mirror objectStore absence.
- type-check: 3 packages PASS.

## Runtime-forbidden Closure Audit

1. Properties/Style editor family direct selected/map reads have been converted to canonical selected/context/property data first. Style hooks production files now have 0 direct `s.elementsMap`/`state.elementsMap` hits, and `inspectorActions` style/fill resolved-read lookup now uses active canonical document traversal without feeding mutable `elementsMap` or mutable legacy fallback into canonical-active reads. Remaining hits are test-doc strings and canonical ref tree `childrenMap` contract references.
2. LayerTree/LayersSection stale map override and `useTreeExpandState` store map dependency are removed. FramesTab still keeps canonical/legacy-bootstrap fallback code around frame element loading, but canonical frame descendants are consumed without mirror merge.
3. Skia render/hover/scroll input and `StoreRenderBridge` sync use canonical-derived read-only tree, `SceneStructureSnapshot.source` now tags canonical vs legacy-bootstrap provenance, scene snapshot `pageIndex` is canonical-derived when the active canonical document exists, `BuilderCanvas` now consumes a document-backed canonical scene model, the scene model uses direct canonical document traversal instead of `canonicalElementSnapshot`, and unused legacy `sceneGraph/*`/`sprites/useResolvedElement.ts` surfaces are removed.
4. Drop target resolver/drag bridge/selection handler context has been narrowed to canonical-derived read-only input maps. The layout engine still accepts `elementsMap`/`childrenMap` as an internal derived render contract, but the maps now come from canonical scene input when an active document exists; removing that internal layout contract is a separate renderer refactor, not a G6 mutable legacy mirror blocker.
5. Builder page-shell reverse bridge, PagesSection page-delete bridge, page frame binding body preservation, monitor component memory analysis, and performance monitor counts now use direct canonical traversal/read models instead of active snapshot helpers. `PagesSection` fallback is limited to the latest post-delete store snapshot when no canonical document is available. `frameLayoutCascade` no longer keeps the unused reusable frame duplicate path through `exportLegacyDocument(doc)`. `canonicalLegacyStoreCacheBridge` and store `recoverElementsSnapshot` action surface are removed; production grep for the bridge/recovery subscriber is 0.
6. Dormant `shadowWriteDiff` no longer owns canonical-to-legacy export; it only compares legacy snapshots explicitly supplied by compatibility boundaries.
7. Direct document-to-elements projections in frame loading, preset slot replacement, and drag/drop history payload now use `visitCanonicalDocumentElements` directly; the document-input `getCanonicalElementsSnapshotFromDocument` export has 0 production hits. History diff/event payload replay is canonical-first, full-replace canonical sync prunes omitted runtime siblings before persistence, and add/remove/group/ungroup history payloads now replay canonical node events without legacy element snapshots for new entries.
8. `useIframeMessenger` no longer subscribes to store `elementsMap` for selection echo, and preview-generated column/field dedupe no longer reads store `elementsMap` directly. Selection/dedupe do not resurrect missing ids from legacy cache when a canonical document is active. Bootstrap fallback still reads store `elements` only when no active canonical document exists.
9. SliderEditor no longer depends on the legacy `useSyncChildProp`/`useSyncGrandchildProp` hooks; child sync uses canonical property maps directly.
10. Preview inbound `UPDATE_ELEMENTS` no longer recovers Builder legacy cache, and unused full-snapshot messaging/coalescing facades have been removed. Remaining `UPDATE_ELEMENTS` production hits are Preview compatibility receive types and `useIframeMessenger` legacy bootstrap outbound path.
11. Add/update/remove store helpers no longer mutate the derived `elements` cache before canonical sync. `elementCreation`, `elementUpdate`, and `elementRemoval` build their canonical mutation payload first, call the canonical wrapper, then update the derived store cache for UI/index compatibility.
