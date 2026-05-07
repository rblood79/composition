# ADR-118 Breakdown: children 배열 순서 기반 ordering SSOT 전환

## Scope

이 문서는 Builder/Skia/Preview/Publish가 사용하는 structural node order를
Pencil-compatible parent `children[]` 배열 index로 수렴시키는 실행 계획이다. 최근 page
order hotfix를 page 전용 보정으로 끝내지 않고, frame/group/body/component
origin/ref instance/slot descendants까지 같은 ordering contract로 확장한다.

## Scope Matrix

| Surface                               | 포함 여부   | 최종 order source                                    | 비고                                                            |
| ------------------------------------- | ----------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| root page/frame/slide order           | In          | page-like presentation root index                    | reusable catalog root는 page order에서 제외                     |
| page body/frame body children         | In          | parent `children[]` index                            | body는 order 0 fallback이 아니라 explicit child identity로 판정 |
| frame/group/layout container children | In          | parent `children[]` index                            | LayerTree, layout, Skia render input 공유                       |
| reusable component origin children    | In          | origin/master node `children[]` index                | origin/instance mismatch 방지                                   |
| component ref instance descendants    | In          | `RefNode.descendants[descendantPath].children` index | normal descendants override와 slot fill 분리                    |
| slot fill insertion order             | In          | `descendants[slotPath].children` append/move order   | 같은 `ref` 중복 삽입 허용                                       |
| drag/drop reorder                     | In          | target parent `children[]` splice index              | same-container/cross-container 모두 포함                        |
| Preview iframe render order           | In          | ordered legacy projection from `children[]`          | iframe `childrenMap`/fallback render order 포함                 |
| Publish page/render order             | In          | ordered legacy projection from `children[]`          | PageNav/ElementRenderer 포함                                    |
| legacy `Element.order_num`            | Boundary    | `children[]` index에서 파생                          | import/export/DB/API/test fixture compatibility only            |
| `childrenMap`                         | Projection  | canonical child order에서 파생                       | O(1) lookup shape는 유지 가능                                   |
| Table row/column data order           | Conditional | 기존 data model                                      | structural node child로 materialize되는 경우만 포함             |
| collection `items` order              | Conditional | existing collection data SSOT                        | 별도 ADR 후보. structural child order와 혼합 금지               |
| CSS `z-index` / paint stacking        | Out         | explicit style property                              | effective order는 z-index + child index tie-breaker             |

## Current Baseline

현재 repo에는 다음 ordering 경계가 혼재한다.

- legacy `Element.order_num`: `packages/shared/src/types/element.types.ts`,
  `packages/shared/src/types/renderer.types.ts`, DB/API service, export/import fixture.
- canonical page shell metadata mirror: canonical mutation/adapter/page-frame binding 경로에서
  tactical `order_num` metadata를 주입한다.
- `childrenMap`: shared renderers, Builder layout engine, Skia renderer input, AI/editor tools가
  parent lookup 구조로 사용한다.
- LayerTree/PageTree: 현재 일부 경로는 `order_num` sort 또는 `orderNum` UI field를 사용한다.
- Preview/Publish: iframe Preview와 Publish runtime이 legacy `order_num` sort로 page/render
  tree를 만든다.
- drag/drop: legacy parent/order update와 canvas insertion index 계산이 결합되어 있다.
- slot/component: `descendants[slotPath].children` order와 legacy element projection order가
  동시에 영향을 준다.

## Local Main Delta After Initial Plan

ADR 작성 이후 local main에는 order 관련 선행 패치가 일부 들어왔다. 아래 항목은 Phase
완료가 아니라, 기존 계획의 baseline을 갱신하는 partial implementation이다.

| 영역                        | 현재 반영                                                                                                                                                                                                                                                                                                   | 남은 판단                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| canonical upsert            | `upsertChild`가 기존 child를 같은 배열 index에서 replace하고 신규 child만 append한다. `replaceNodeById`는 nested `children`과 `RefNode.descendants[*].children`까지 위치 보존 replace를 수행한다. Phase 1에서 shared read/insert/move/remove/descendant helper와 canonical store action surface를 추가했다. | 남은 판단은 helper 자체가 아니라 remaining caller cutover와 bridge 제거/축소다.                                                                                                          |
| canonical sibling bridge    | 2026-05-07 patch에서 `mergeElementsCanonicalPrimary` 후 같은 parent의 전체 sibling batch를 canonical `children[]`/`RefNode.descendants[*].children` 순서로 재고정한다. props-only batch는 previous canonical position guard로 제외한다.                                                                     | Implemented closure 기준 structural runtime 의존은 제거했다. adapter/legacy compatibility boundary의 defensive mirror guard로만 allowlist에 남긴다.                                      |
| legacy export mirror        | `exportLegacyDocument`가 root/nested/descendant `children` 순회 index를 legacy `order_num`으로 파생한다.                                                                                                                                                                                                    | DB/API/import/test fixture bucket과 함께 Phase 6 allowlist에 고정해야 한다.                                                                                                              |
| shared export runtime model | `deriveProjectRenderModelFromDocument`의 runtime element projection과 page order projection은 canonical child 순회 index를 legacy `order_num` mirror 로 파생한다.                                                                                                                                           | Page/root read path는 Phase 2에서 닫혔다. LayerTree/Skia/Preview/Publish structural read path는 Phase 3에서 닫혔고, Phase 6 allowlist gate도 통과했다.                                   |
| component origin round-trip | `reusable: true`를 `componentRole: "master"` mirror로 export하고, page-owned origin을 root reusable catalog로 끌어올리지 않는다.                                                                                                                                                                            | Phase 5에서 origin/instance materialization source order를 고정했다.                                                                                                                     |
| component ref resolution    | canonical `ref`/legacy `masterId` instance를 origin-shaped runtime element로 resolve하고, descendants mode B/C synthetic child를 materialize한다.                                                                                                                                                           | Phase 3 두 번째 slice에서 resolver childrenMap fallback 이 source order를 보존하도록 전환했다. synthetic `order_num` mirror 자체는 Phase 5/6 격리 대상이다.                              |
| copy/paste ref instance     | reusable origin copy/paste는 origin subtree deep-copy 대신 canonical `ref` instance를 생성한다.                                                                                                                                                                                                             | placement mirror payload는 structural-only update 경로에서 canonical order intent로 흡수하고, stored mirror는 export 결과로 파생한다.                                                    |
| LayerTree/frame projection  | canonical source와 page-frame projection merge가 보강되어 frame-bound page body/slot/live page child가 더 잘 보인다. LayerTree DnD는 projected synthetic ref child를 drag source/drop target에서 차단한다.                                                                                                  | Phase 3 첫 slice에서 `useLayerTreeData`와 `buildTreeFromElements` generic path 의 `order_num` sort를 제거했다. descendant child move UX는 Phase 5 helper 이후 재검토한다.                |
| selection/hit-test          | page-frame hidden slot child 선택과 overlapping frame body 선택이 보강됐다.                                                                                                                                                                                                                                 | Phase 3 두 번째 slice에서 hit-test/context-menu target 이 descendant 우선, sibling `z-index` + source child index 우선, depth/area fallback 계약을 사용한다.                             |
| Nodes panel frame tree UI   | Frames 탭의 Frames/Layers child rendering 이 Pages 탭과 같은 `TreeBase` / `VirtualizedTree`, `section` / `section-content`, `frame-tree` 단일 class 기준으로 정리됐다.                                                                                                                                      | UI tree primitive parity baseline. structural ordering source 전환은 Phase 3/6에서 별도 검증해야 한다.                                                                                   |
| drag/drop/write path        | Skia canvas drag/drop pointerup/drop final commit은 `moveElementCanonicalPrimary`를 통해 active canonical parent `children[]`를 먼저 splice하고 legacy mirror를 export한다. `batchUpdateElementOrders`/`moveElementToContainer` direct call은 이 경로에서 제거했다.                                         | Structural-only batch update는 `applyElementOrderCanonicalPrimary`로 canonical move helper를 먼저 통과하고, legacy order batch는 mirror repair로만 남긴다.                               |
| group/ungroup/history write | group/ungroup, undo/redo history reorder, loader hydration 경로가 `parent_id`/`order_num`을 직접 읽고 쓴다.                                                                                                                                                                                                 | `updateElement`/`batchUpdateElements` structural-only path가 canonical order intent를 먼저 반영한다. loader hydration의 `order_num` sort는 legacy IndexedDB import boundary allowlist다. |

### 중요 정리

- 선행 패치는 ADR-118의 Decision을 바꾸지 않는다. 오히려 대안 A의 일부 전제가 이미
  코드에 들어간 상태다.
- `shouldPreserveExistingCanonicalPosition`은 "같은 legacy ownership/order 입력으로 props만
  바뀌는 update"의 위치 보존 guard다. reorder API가 아니므로 Phase 1/4의
  `moveCanonicalChild`/descendant move helper 요구는 유지한다.
- `applyCanonicalSiblingOrder` 계열은 현재 legacy write path 회귀를 막는 transitional bridge다.
  incoming batch가 같은 parent의 exportable sibling 전체를 덮고 실제 position change가 있을
  때만 canonical child order를 재고정한다. Phase 4 첫 write-path slice 이후 Skia drag/drop final
  commit은 direct canonical splice write를 사용하므로 이 bridge는 remaining legacy write
  compatibility debt로 재분류하고, Phase 6에서 제거/축소한다.
- synthetic ref child DnD 차단은 projected child를 persistence target으로 쓰는 오류를
  막는다. instance descendants/slot child reorder UX는 `moveDescendantChild` helper와
  stable descendant path contract가 준비된 뒤 허용 여부를 결정한다.
- 현재 `order_num` sort가 남은 경로는 adapter/import/export, IndexedDB load boundary,
  Table/collection data, legacy helper 자체, test/fixture mirror assertion allowlist로 닫았다.

## Phase 0: Inventory + Bucket Classification

### 작업

1. `order_num`, `childrenMap`, sibling `.sort(...)`, reorder/update helper, drag insertion index
   call site를 전수 조사한다.
2. 각 call site를 다음 bucket으로 분류한다.
   - `adapter-boundary`: legacy import/export/DB/API mirror 생성 또는 소비.
   - `structural-runtime`: Builder/Skia/LayerTree/layout/selection의 실제 order 결정.
   - `collection-data`: `items`, Table columns/rows, non-structural data record order.
   - `fixture-test`: legacy fixture 또는 test helper.
   - `delete-after-cutover`: Phase 6에서 제거할 임시 fallback.
3. current tactical page hotfix가 어떤 bucket에 속하는지 명시한다.
4. 2026-05-06/07 local main 선행 패치를 별도 `partial-implemented` column으로 표시한다.
   특히 `canonicalMutations.ts`, `exportLegacyDocument.ts`, `useLayerTreeData.ts`,
   `selectionHitTest.ts`, `hierarchicalSelection.ts`,
   `packages/shared/src/utils/export.utils.ts`,
   `apps/builder/src/builder/stores/elements.ts`, `treeUtils.ts`,
   `LayerTree/validation.ts`, Preview/Publish order sort call site를 같은 표에서 비교한다.
5. Phase 6 grep gate allowlist를 먼저 작성한다.

### 확인 명령

```bash
rg -n "order_num|childrenMap|orderNum|findInsertionIndex|deferredDropChildIndex|sort\\(" apps packages docs/adr docs/pencil-copy
rg -n "metadata.*order_num|order_num.*metadata" apps packages
```

### 산출물

- bucket별 file/function inventory.
- Phase별 migration target 목록.
- Phase 6 allowlist 초안.
- local main 선행 패치 목록과 각 항목의 Phase 귀속표.

### 2026-05-07 착수 산출물

- Phase 0 inventory는
  [118-children-array-order-inventory.md](118-children-array-order-inventory.md)에
  분리했다.
- `applyCanonicalSiblingOrder` 계열은 `delete-after-cutover` compatibility bridge로
  분류했다. Phase 4 첫 write-path slice 이후 Skia drag/drop primary path에서는 벗어났고,
  remaining legacy write compatibility guard로만 유지한다.

## Phase 1: Canonical Order Helper 도입

### 작업

1. canonical document mutation/read helper를 만든다.
   - local main의 `upsertChild`, `replaceNodeById`, `removeNodeById` 선행 구현을
     내부 helper 후보로 평가하되, 파일-local 함수에 머무르지 않게 public/internal
     API 경계를 정한다.
   - 기존 `CanonicalDocumentActions.insertNode`, `removeNode`, `updateDescendant`는
     이미 canonical store public mutation surface다. ADR-118 helper는 이를 대체할지,
     확장할지, 내부 구현으로 감쌀지 먼저 결정하고 중복 public API를 만들지 않는다.
   - 기존 actions가 직접 표현하지 못하는 gap은 same-parent/cross-parent move, sibling
     reorder, descendant children insert/move, derived `order_num` mirror 계산이다.
   - local main의 `collectChildrenArrayIndex`, `applyCanonicalSiblingOrder`,
     `applyCanonicalSiblingOrderToRefDescendants`는 transitional bridge로 분류하고,
     explicit helper로 흡수할 수 있는 traversal/path logic과 Phase 6에서 제거할
     legacy-batch reconciliation logic을 분리한다.
   - `getCanonicalChildren(document, parentId)`
   - `insertCanonicalChild(document, parentId, child, index)`
   - `moveCanonicalChild(document, childId, targetParentId, index)`
   - `removeCanonicalChild(document, childId)`
   - `appendDescendantChild(document, refPath, descendantPath, child)`
   - `moveDescendantChild(document, refPath, descendantPath, childId, index)`
   - `deriveLegacyOrderNum(parentChildren, childId)`
2. helper는 top-level `CompositionDocument.children`, nested `FrameNode.children`,
   `RefNode.descendants[slotPath].children`를 같은 ordering primitive로 다룬다.
3. helper가 id/path 기반 child identity를 보존하고 duplicate `ref` slot fill을 child id로
   구분하는지 test한다.
4. `order_num` mirror 생성은 helper 밖 runtime에서 직접 계산하지 않도록 adapter boundary
   helper로 격리한다.
5. 기존 위치 보존 guard(`shouldPreserveExistingCanonicalPosition`)는 props/update
   replace 용도로만 유지한다. 이 guard를 reorder로 오해하지 않도록 explicit move helper의
   테스트를 별도로 둔다.
6. `packages/shared/src/types/composition-document-actions.types.ts`와
   `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts`에 기존
   `insertNode`/`removeNode`/`updateDescendant`와 새 move/reorder/descendant children
   helper의 관계를 명시한다.
7. canonical sibling bridge가 담당하던 "legacy order batch → canonical child order repair"는
   Phase 4 전까지 compatibility layer로만 유지하고, 새 public/internal helper의 primary
   contract로 채택하지 않는다.

### 2026-05-07 착수 구현

- `packages/shared/src/utils/compositionDocumentOrder.ts`에 canonical `children[]` 기반
  read/insert/move/remove, descendant children append/move, derived legacy order mirror helper를
  추가했다.
- `packages/shared/src/types/composition-document-actions.types.ts`와
  `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts`는 기존
  `insertNode`/`removeNode`/`updateDescendant` surface를 유지하면서, 빠져 있던
  `getNodeChildren`/`moveNode`/`appendDescendantChild`/`moveDescendantChild`/
  `getDerivedOrderNum`만 확장했다.
- Store 구현은 shared helper를 호출하므로 Phase 4 drag/drop write path가 같은 helper로
  연결됐다. `applyCanonicalSiblingOrder` bridge는 아직 remaining legacy write path용 Phase 6
  debt다.

### 금지

- canonical node metadata의 `order_num`을 새 runtime order decision에 사용하지 않는다.
- child index 계산을 surface별 `.sort((a, b) => order_num...)`로 재도입하지 않는다.
- slot fill append를 same `ref` 존재 여부로 replace하지 않는다.

## Phase 2: Page/Root Order Cutover

### 작업

1. `CompositionDocument.children` 안에서 page-like presentation root를 reusable catalog root와
   분리하고, page-like root의 배열 index가 PageTree/root slide list의 source가 되도록
   전환한다.
2. Home/non-deletable page 판정은 slug `/`, root identity, explicit home marker 중 하나로
   고정하고 order position과 분리한다.
3. page 생성은 root `children[]` 뒤에 append하고, legacy export 시에만 index를 `order_num`으로
   파생한다.
4. tactical page metadata `order_num` fallback은 adapter/import boundary 또는 Phase 6 allowlist로
   이동한다.

### 검증

- page를 3개 연속 추가하면 UI order가 추가 순서를 따른다.
- Home은 첫 번째 visual row가 아니어도 삭제 불가 identity가 유지된다.
- refresh 후 PageTree/LayerTree/Skia render order가 동일하다.

### 2026-05-07 구현

- `packages/shared/src/utils/export.utils.ts`의
  `deriveProjectRenderModelFromDocument`가 page metadata `order_num`으로 정렬하지 않고,
  `CompositionDocument.children`의 page-like root 순서를 그대로 사용한다. legacy
  `Page.order_num`은 page-like index에서 파생되는 mirror 값으로만 남겼다.
- `apps/builder/src/builder/panels/nodes/tree/PageTree/usePageTreeData.ts`의 PageTree
  projection은 incoming canonical page order를 보존하고, Home/non-deletable 판정은 slug `/`
  identity로 유지한다.
- Pages tree drag/drop update는 transient `order_num` batch를 받은 뒤 page 배열을 canonical
  preorder로 재배열하고, active `CompositionDocument.children`의 page slot 순서도 같은
  preorder로 갱신한다. reusable catalog root는 page order slot에서 제외해 원위치를 보존한다.
- Browser refresh hydrate의 초기 page 선택은 `order_num === 0`이 아니라 slug `/` Home
  identity를 우선 사용한다.
- Canvas page position 초기화는 legacy `order_num` 정렬 대신 render model에서 전달된 canonical
  page 순서를 그대로 사용한다.

### 2026-05-07 검증

```bash
pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts src/utils/__tests__/compositionDocumentOrder.test.ts
pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeDnd.test.ts
pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/pagesLayoutInvalidation.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts
pnpm run codex:typecheck
```

잔여: LayerTree/Skia/Preview/Publish read path 정렬은 아직 Phase 3 범위다.

## Phase 3: LayerTree / Layout / Skia / Preview / Publish Read Path Cutover

### 작업

1. `childrenMap`은 canonical child order에서 파생되는 projection으로만 유지한다.
2. LayerTree tree item order는 parent `children[]` index를 그대로 사용한다.
3. Skia render input은 child order를 forward render order로 전달한다. 명시적 `z-index`가
   있으면 `z-index` 오름차순 + child index tie-breaker를 effective order로 만들고, hit-test는
   같은 effective order를 역순으로 사용한다.
4. Preview iframe의 `childrenMap`, fallback render, `layoutResolver`가 canonical-derived
   projection order를 사용하도록 전환한다.
5. Publish `PageNav`와 `ElementRenderer`가 canonical-derived projection order를 사용하도록
   전환한다.
6. layout engine의 child order fallback이 `order_num`이 아니라 projection order를 사용하도록
   정리한다.
7. synthetic merge/collection child projection이 structural child order를 변경하지 않는지 확인한다.
8. local main의 frame-bound LayerTree projection 보강은 유지하되, `useLayerTreeData`의
   page-owned element sort와 `buildTreeFromElements`의 generic sort를 canonical-derived
   projection order로 전환한다.
9. `pickTopmostHitElementId`의 depth/area heuristic은 page-frame hidden slot selection
   보강으로 남길 수 있는지, 아니면 effective order pipeline 안의 tie-breaker로 흡수해야
   하는지 결정한다.

### 검증

- 겹친 sibling에서 뒤쪽 child가 hit-test 우선권을 가진다.
- `z-index`가 없는 LayerTree reorder 후 Skia paint order와 hit-test order가 child index 기준으로
  일치한다.
- `z-index`가 있는 sibling은 render/hit-test 모두 `z-index` + child index tie-breaker를 동일하게
  적용한다.
- full-tree layout이 child index order를 보존한다.
- Preview와 Publish에서 같은 document order가 표시된다.
- page-frame hidden slot child 선택은 유지하면서, sibling stacking priority는 render order와
  같은 effective order를 사용한다.

### 2026-05-07 첫 slice 구현

- `apps/builder/src/builder/utils/treeUtils.ts`의 generic LayerTree tree builder가 root/nested
  children을 다시 `order_num`으로 정렬하지 않고 caller가 전달한 canonical source order를
  보존한다. Table bucket 정렬과 legacy compatibility helper는 Phase 6 allowlist로 남겼다.
- `apps/builder/src/builder/stores/elements.ts`의 `pageElementsSnapshot`과
  `apps/builder/src/builder/stores/utils/elementIndexer.ts`의 `getPageElements`/`getRootElements`
  read path가 index/source insertion order를 보존한다.
- `apps/builder/src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.ts`의 frame-bound page
  projection도 page-owned elements를 `order_num`으로 재정렬하지 않는다.
- `apps/builder/src/preview/App.tsx`와 `apps/builder/src/preview/utils/layoutResolver.ts`의
  generic childrenMap/fallback render/layout slot projection이 입력 순서를 보존한다.
- `apps/publish/src/components/PageNav.tsx`와 `apps/publish/src/renderer/ElementRenderer.tsx`가
  page/element child를 `order_num`으로 재정렬하지 않고 render model 입력 순서를 사용한다.

### 2026-05-07 첫 slice 검증

```bash
pnpm -F @composition/builder exec vitest run src/builder/utils/treeUtils.test.ts src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx src/preview/previewFrameMirror.static.test.ts
pnpm -F @composition/publish type-check
```

### 2026-05-07 두 번째 slice 구현

- `apps/builder/src/builder/workspace/canvas/renderers/rendererInput.ts`가 page snapshot
  source order로 Skia renderer `childrenMap`을 만들고, resolved page-frame projection을 legacy
  `order_num`으로 다시 정렬하지 않는다.
- `apps/builder/src/adapters/canonical/canonicalRefResolution.ts`의 canonical ref descendant
  materialization fallback 이 input/source order를 보존해 instance 내부 child가 refresh 후
  `order_num` 순서로 뒤집히지 않는다.
- `apps/builder/src/builder/workspace/canvas/selection/selectionHitTest.ts`와 중앙 pointer/context-menu
  target resolution 이 interactive `childrenMap`을 받아 descendant 우선, sibling `z-index` 우선,
  같은 `z-index`에서는 source child index 우선인 effective hit order를 사용한다. depth/area는
  structural order로 구분할 수 없는 fallback 으로만 남긴다.
- `apps/builder/src/builder/workspace/canvas/selection/dropTargetResolver.ts`와
  `useCanvasDragDropHelpers.ts`의 drop target/insertion read path 가 childrenMap/source order를
  보존한다. legacy `order_num` update payload는 Phase 4 write-path cutover 전 mirror batch로만 남긴다.
- `layoutCache`, `resolvePageWithFrame`, Breadcrumb/ToggleButtonGroup Skia/layout child context 가
  caller-provided projection order를 보존하도록 전환했다.

### 2026-05-07 두 번째 slice 검증

```bash
pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/selection/selectionHitTest.test.ts src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts src/builder/utils/canonicalRefResolution.test.ts src/builder/workspace/canvas/selection/dropTargetResolver.test.ts src/builder/workspace/canvas/interaction/canvasContextMenu.test.ts src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.static.test.ts src/builder/workspace/canvas/scene/layoutCache.static.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts
pnpm run codex:typecheck
```

잔여: Table/collection-specific bucket allowlist, CSS `order` presentation 예외 문서화,
drag/drop final commit 과 direct write 경로 격리는 Phase 4 범위로 남긴다.

## Phase 4: Drag/Drop Reorder Write Path Cutover

### 작업

1. drag session은 dragged node의 original parent와 original child index를 저장한다.
2. same-container reorder는 insertion index를 계산해 transient `children[]` reorder를 적용할 수
   있지만, undo history는 pointerup/drop에서 하나의 user action으로 commit한다.
3. cross-container/layout drop은 target parent와 child index를 deferred state로 들고 있다가
   exit/drop 시 `moveCanonicalChild`로 적용한다.
4. legacy `parent_id`/`order_num` write는 adapter projection 또는 derived mirror로만 발생한다.
5. `batchUpdateElementOrders`, `moveElementToContainer`, `reorderElements`는 final canonical
   write API의 caller 또는 legacy mirror update로 격리한다. 현재 구현처럼 `order_num`을
   primary write target으로 두지 않는다.
   - 2026-05-07 canonical sibling bridge는 이 격리가 끝날 때까지 refresh/export drift를 막는
     guard로만 유지한다.
   - G4 완료 시 drag/drop write path는 bridge가 없어도 canonical `children[]` splice 결과를
     직접 보존해야 한다.
6. `PropertiesPanel` group/ungroup, history undo/redo reorder, loader hydration,
   copy/paste placement처럼 direct `parent_id`/`order_num` read/write가 있는 경로를
   Phase 4 inventory에 포함하고, final canonical write API 또는 Phase 6 allowlist로
   명시 분류한다.

### 2026-05-07 첫 번째 write-path slice

- `apps/builder/src/adapters/canonical/canonicalMutations.ts`에
  `moveElementCanonicalPrimary(elementId, targetParentId, insertionIndex)`를 추가했다.
  이 helper는 shared `moveCanonicalChild`로 active canonical document의 parent
  `children[]`를 먼저 splice하고, 그 결과를 legacy mirror로 export해 Builder store에
  반영한다.
- `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts`의 pointerup/drop
  final commit 경로는 더 이상 `state.moveElementToContainer()`나
  `state.batchUpdateElementOrders()`를 직접 호출하지 않는다. drop target의
  `containerId + insertionIndex`를 canonical move helper에 전달하고, IndexedDB persist
  payload는 canonical export 후의 mirror row에서 파생한다.
- same-parent reorder와 cross-page reparent regression test를
  `apps/builder/src/adapters/canonical/__tests__/canonicalMutations.test.ts`에 추가해
  parent `children[]`, exported `order_num`, descendant `page_id` mirror가 함께 움직이는
  계약을 고정했다.
- legacy fallback action인 `moveElementToContainer`는 아직 store API로 남아 있지만,
  source `childrenMap` 순서를 보존하도록 보강했다. 이는 Phase 4 잔여 경로와 기존 test
  compatibility를 위한 fallback이며, Skia drag/drop final commit의 primary write path가
  아니다.
- completion slice에서 `reorderElements` 기반 validation/history/creation/removal 경로,
  `PropertiesPanel` group/ungroup, loader hydration reorder, copy/paste placement 의
  direct `parent_id`/`order_num` mirror payload를 canonical-primary structural update 또는
  명시 allowlist bucket으로 재분류했다.

### 2026-05-07 첫 번째 write-path slice 검증

```bash
pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/canonicalMutations.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/stores/__tests__/elementMove.test.ts src/builder/workspace/canvas/selection/dropTargetResolver.test.ts
```

### 2026-05-07 completion slice

- `apps/builder/src/adapters/canonical/canonicalMutations.ts`에
  `applyElementOrderCanonicalPrimary(elements)`를 추가했다. legacy batch payload의
  `parent_id`/`order_num`은 transient structural intent로만 해석하고, active canonical
  document의 parent `children[]`를 `moveCanonicalChild`로 먼저 splice한 뒤
  `exportLegacyDocument` mirror를 store에 반영한다.
- `apps/builder/src/builder/stores/utils/elementUpdate.ts`는 구조 전용
  `parent_id`/`order_num`/`page_id` batch를 canonical-primary order helper로 라우팅한다.
  props update는 기존 merge path를 유지해 위치 보존 guard와 분리한다.
- `reorderElements`/`batchUpdateElementOrders`는 source `childrenMap`/canonical projection
  order를 기준으로 legacy mirror 번호만 재계산한다. stale `order_num`이나 editable
  text/label 값으로 source order를 재정렬하지 않는다.
- `PageTree` DnD는 update 배열 rank/source order로 canonical page preorder를 materialize하고,
  `order_num` sort를 structural page order primary key로 쓰지 않는다.
- group/ungroup/history/copy-paste placement가 `updateElement`/`batchUpdateElements`로
  구조 변경을 전달하는 경우 canonical-primary structural update path를 먼저 통과한다.

### 검증

- 같은 container 내 reorder가 refresh 후 유지된다.
- 다른 frame/container로 이동해도 parent `children[]`와 LayerTree가 일치한다.
- drag 중 transient reorder가 history entry를 과도하게 생성하지 않는다.

## Phase 5: Component Origin / Instance / Slot Cutover

### 작업

1. reusable origin/master children order는 origin node `children[]`를 source로 한다.
2. ref instance render는 origin children을 resolve하되, overridden descendants와 slot fill
   children order를 instance `descendants`에서 합성한다.
3. slot fill add는 `descendants[slotPath].children.push(newChild)` 또는 explicit insert index로
   처리한다.
4. 같은 `ref` component를 같은 slot에 여러 번 삽입해도 각 child id를 독립 instance로 보존한다.
5. origin edit, instance override, detach가 child order를 서로 오염시키지 않는지 확인한다.
6. local main의 `reusable: true` origin persistence/round-trip 선행 패치를 Phase 5 baseline으로
   인정하고, page-owned origin이 root reusable catalog로 이동하지 않는 회귀 테스트를 유지한다.
7. LayerTree가 synthetic ref child DnD를 차단한 현재 상태를 baseline으로 둔다. ref
   descendant/slot child 자체 reorder를 허용하려면 `moveDescendantChild`가 persisted
   descendant override에 쓰는 경로를 먼저 통과시킨다.

### 검증

- component origin/instance를 만든 뒤 refresh해도 origin children이 유지된다.
- instance LayerTree가 ref 하나만 보이는 상태로 퇴행하지 않고 resolved/override child를 표시한다.
- slot에 같은 recommended component를 두 번 삽입하면 두 child가 같은 순서로 보존된다.
- detach 후 resolved children order가 유지된다.
- Create component 후 refresh해도 origin이 `reusable: true`/`componentRole: "master"`로
  유지되고 원래 parent `children[]` 위치를 잃지 않는다.

### 2026-05-07 completion slice

- `apps/builder/src/builder/stores/utils/instanceActions.ts`의 origin child materialization은
  `childrenMap`/canonical source order를 그대로 사용한다. stale `order_num`이 origin child
  순서를 뒤집지 않도록 regression test를 추가했다.
- `canonicalRefResolution`/ref instance materialization은 origin children과 descendant
  override/slot fill child를 child id 단위 source order로 유지한다. synthetic mirror
  `order_num`은 export/runtime compatibility field로만 파생한다.
- property editors와 shared form/render path에서 structural child list를 local
  `order_num` sort로 재정렬하던 경로를 제거했다. Table/collection data order는 Phase 6
  allowlist의 별도 data bucket으로 유지한다.

## Phase 6: Legacy Mirror Quarantine + Grep Gate

### 작업

1. `order_num`을 사용하는 runtime order decision을 제거하거나 allowlist로 격리한다.
2. allowed bucket:
   - legacy DB/API service compatibility.
   - export/import payload generation.
   - legacy fixture migration.
   - collection data order로 분류된 별도 model.
   - tests that assert boundary mirror behavior.
3. disallowed bucket:
   - LayerTree/PageTree primary sort.
   - Skia render/hit-test order.
   - layout child order.
   - drag/drop canonical write.
   - component/slot descendants order.
4. transitional bridge bucket:
   - `applyCanonicalSiblingOrder` 계열은 Phase 4 완료 전까지만 legacy write compatibility
     bridge로 허용한다.
   - Phase 6 완료 시점에는 제거하거나 adapter-boundary helper로 축소해야 하며,
     structural runtime write path가 이 bridge 없이는 순서를 보존하지 못하면 gate 실패다.

### Grep Gate

```bash
rg -n "order_num|orderNum" apps/builder/src packages/shared/src packages/specs/src
rg -n "\\.sort\\([^\\n]*(order_num|orderNum)" apps/builder/src packages/shared/src
```

통과 기준:

- structural runtime order decision에서 `order_num` primary sort가 0건.
- remaining hits는 Phase 0 allowlist bucket에 매핑된다.
- docs/changelog/test comments가 actual gate result와 일치한다.

### 2026-05-07 Gate Result

```bash
rg -n "\\.sort\\([^\\n]*(order_num|orderNum)|order_num\\) -|orderNum\\) -|order_num \\?\\? 0\\) -|order_num \\|\\| 0\\) -|sortElementsByOrderThenSource|compareElementsByOrderThenSource" apps/builder/src packages/shared/src packages/specs/src -g '!**/__tests__/**' -g '!**/*.test.ts' -g '!**/*.test.tsx'
```

Remaining allowlist:

- `apps/builder/src/adapters/canonical/**`: legacy import/export, upsert ordering,
  transitional bridge, and structural intent adapter boundary.
- `apps/builder/src/builder/stores/elementLoader.ts`: IndexedDB legacy element hydrate
  boundary. Runtime page snapshots preserve source order after hydrate.
- `apps/builder/src/builder/utils/elementOrdering.ts`: legacy mirror helper itself.
- `apps/builder/src/builder/utils/treeUtils.ts`: Table structural bucket and legacy
  `sortByOrderNum` compatibility helper. Generic LayerTree path preserves caller source order.
- `packages/shared/src/utils/migrateCollectionItems.ts`: collection data migration order.
- `apps/builder/src/builder/utils/HierarchyManager.ts`: legacy order-number repair helper,
  not runtime tree/render order.

Disallowed runtime hits removed:

- PageTree sibling order sort by `order_num`.
- LayerTree/Skia render input/hit-test/layout child sort by `order_num`.
- Preview/Publish generic child render sort by `order_num`.
- component origin/ref materialization sort by `order_num`.
- structural batch write that persists `order_num` before canonical child splice.

## File Impact Map

| 영역                  | 예상 파일/모듈                                                                                                                           | 변경 방향                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| canonical type/helper | `packages/shared/src/types/*`, `apps/builder/src/adapters/canonical/*`                                                                   | child order helper와 legacy mirror boundary 정리                                                                       |
| canonical actions     | `packages/shared/src/types/composition-document-actions.types.ts`, `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts` | 기존 `insertNode`/`removeNode`/`updateDescendant`와 신규 move/reorder 및 descendants children write contract 관계 정리 |
| export/import         | `packages/shared/src/utils/export.utils.ts`, canonical/pencil adapters                                                                   | `children[]` index에서 `order_num` 파생                                                                                |
| page tree             | `apps/builder/src/builder/panels/nodes/tree/PageTree/*`, `PagesSection.tsx`                                                              | PageTree order source를 root children index로 전환                                                                     |
| layer tree            | `apps/builder/src/builder/panels/nodes/tree/LayerTree/*`                                                                                 | canonical child order projection                                                                                       |
| stores/indexer        | `apps/builder/src/builder/stores/elements.ts`, `apps/builder/src/builder/stores/index.ts`                                                | `childrenMap`을 ordered projection으로 유지                                                                            |
| canvas/Skia           | `apps/builder/src/builder/workspace/canvas/**`                                                                                           | render/hit-test/layout order source 통일                                                                               |
| preview runtime       | `apps/builder/src/preview/App.tsx`, `apps/builder/src/preview/utils/layoutResolver.ts`                                                   | iframe render tree order source 통일                                                                                   |
| publish runtime       | `apps/publish/src/components/PageNav.tsx`, `apps/publish/src/renderer/ElementRenderer.tsx`                                               | published page/render order source 통일                                                                                |
| drag/drop/write       | `useDragBridge.ts`, `useCanvasDragDropHelpers.ts`, `PropertiesPanel.tsx`, `historyActions.ts`, `elementLoader.ts`, reorder helpers       | parent/index splice write path + legacy write quarantine                                                               |
| component/slot        | `canonicalRefResolution.ts`, `canonicalElementsView.ts`, `multiElementCopy.ts`, `instanceActions.ts`, slot/layout adapters               | descendants slot child append/move contract                                                                            |
| shared renderers      | `packages/shared/src/renderers/**`                                                                                                       | `childrenMap` order 소비만 허용, local `order_num` sort 제거                                                           |
| collection data       | `migrateCollectionItems.ts`, Table/List data models                                                                                      | structural vs data order bucket 분리                                                                                   |

### Local Main Partial Files

| 파일                                                                             | 현재 역할                                                                                                                                                                                                                                                                                                                 | ADR-118 처리                                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/adapters/canonical/canonicalMutations.ts`                      | 위치 보존 upsert/replace/remove, reusable origin placement 일부 구현. 2026-05-07 sibling-order bridge가 legacy order batch 후 canonical `children[]`/descendant children order를 재고정한다. Phase 4에서 `moveElementCanonicalPrimary`와 `applyElementOrderCanonicalPrimary`가 explicit canonical move helper로 추가됐다. | Phase 4 완료 + Phase 6 compatibility bridge allowlist + Phase 5 baseline                                                      |
| `apps/builder/src/adapters/canonical/canonicalRefResolution.ts`                  | canonical `ref`/legacy `masterId` resolve, descendants synthetic child materialization                                                                                                                                                                                                                                    | Phase 3/5에서 childrenMap fallback/source order 보존. synthetic descendant mirror는 export/runtime compatibility field        |
| `apps/builder/src/builder/utils/canonicalRefResolution.ts`                       | builder-facing re-export facade                                                                                                                                                                                                                                                                                           | Phase 3/5 test/import boundary                                                                                                |
| `apps/builder/src/adapters/canonical/exportLegacyDocument.ts`                    | `children[]` index에서 legacy `order_num` export                                                                                                                                                                                                                                                                          | Phase 1/6 adapter boundary allowlist                                                                                          |
| `packages/shared/src/utils/export.utils.ts`                                      | runtime element projection 은 `children[]` index로 `order_num` 파생, page order 는 metadata/readPageOrder sort 사용                                                                                                                                                                                                       | Phase 1/2/3/6 교차 target. element projection 과 page order 를 분리 분류                                                      |
| `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts`             | canonical tree DFS 로 legacy `Element[]`와 selected ref view를 파생                                                                                                                                                                                                                                                       | Phase 3/5 source-order projection boundary                                                                                    |
| `apps/builder/src/builder/stores/index.ts`                                       | selected element data가 canonical/ref-resolved view를 fallback으로 사용                                                                                                                                                                                                                                                   | Phase 3 inspector/properties read baseline                                                                                    |
| `apps/builder/src/builder/stores/utils/instanceActions.ts`                       | component origin 전환 후 canonical document sync/persist                                                                                                                                                                                                                                                                  | Phase 5 source-order materialization 완료. instance creation order는 canonical append/source order primary                    |
| `apps/builder/src/builder/utils/multiElementCopy.ts`                             | reusable origin paste를 canonical `ref` instance 생성으로 전환                                                                                                                                                                                                                                                            | Phase 5 UX baseline. paste placement/order mirror payload는 structural update path 또는 compatibility boundary로 분류         |
| `apps/builder/src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.ts`       | canonical/page-frame source merge와 frame-bound projection 보강                                                                                                                                                                                                                                                           | Phase 3 first slice에서 page-owned projection `order_num` sort 제거                                                           |
| `apps/builder/src/builder/panels/nodes/tree/LayerTree/validation.ts`             | synthetic ref child를 drag source/drop target에서 차단해 projected instance child가 persistence target으로 쓰이지 않게 한다                                                                                                                                                                                               | Phase 5 baseline. descendant/slot child reorder UX는 `moveDescendantChild` 이후 재검토                                        |
| `apps/builder/src/builder/utils/treeUtils.ts`                                    | generic Element tree와 Table/collection bucket tree helper                                                                                                                                                                                                                                                                | Generic path 는 Phase 3 first slice에서 source order 전환. Table bucket helper 는 Phase 6 allowlist                           |
| `apps/builder/src/builder/workspace/canvas/selection/selectionHitTest.ts`        | depth/area 기반 hit target 보강 + source/effective hit order tie-breaker                                                                                                                                                                                                                                                  | Phase 3 second slice에서 `z-index` + childrenMap index 우선 계약 반영                                                         |
| `apps/builder/src/builder/stores/elements.ts` / `stores/utils/elementReorder.ts` | Skia drag/drop primary write에서는 직접 호출하지 않지만, validation/history/creation/removal/fallback 경로에는 `reorderElements`와 legacy mirror write가 남아 있다. `moveElementToContainer` fallback은 source `childrenMap` 순서 보존만 보강됐다.                                                                        | `reorderElements`/`batchUpdateElementOrders`는 legacy mirror repair로 격리. structural update는 canonical-primary helper 경유 |
| `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`                 | group/ungroup 이 `parent_id`/`order_num`을 store와 Supabase에 직접 write                                                                                                                                                                                                                                                  | `updateElement` structural-only path를 통해 canonical-primary helper 경유                                                     |
| `apps/builder/src/builder/stores/history/historyActions.ts`                      | undo/redo/go-to-history 이후 `reorderElements`로 legacy order 재정렬                                                                                                                                                                                                                                                      | legacy mirror repair allowlist                                                                                                |
| `apps/builder/src/builder/stores/elementLoader.ts`                               | IndexedDB/Supabase hydrate와 page snapshot이 `order_num` 정렬을 사용                                                                                                                                                                                                                                                      | IndexedDB legacy hydrate boundary allowlist. post-hydrate page snapshot은 source order 보존                                   |
| `apps/builder/src/builder/panels/nodes/FramesTab/*` / `NodesPanel.css`           | Frames tab tree primitive/section/class parity 완료                                                                                                                                                                                                                                                                       | Phase 3 UI baseline. ordering source cutover 자체는 별도 target                                                               |

## Verification Plan

### Unit / Static

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts \
  src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx \
  src/builder/panels/nodes/tree/LayerTree/validation.test.ts \
  src/adapters/canonical/__tests__/canonicalMutations.test.ts \
  src/builder/utils/canonicalRefResolution.test.ts \
  src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts \
  src/builder/stores/utils/__tests__/elementCanonicalMutation.test.ts \
  src/builder/stores/utils/__tests__/instanceActions.test.ts \
  src/builder/stores/index.test.tsx \
  src/builder/utils/multiElementCopy.test.ts \
  src/builder/utils/hierarchicalSelection.test.ts \
  src/builder/workspace/canvas/selection/selectionHitTest.test.ts

pnpm -F @composition/shared exec vitest run \
  src/utils/__tests__/exportCanonicalProject.test.ts

pnpm run codex:typecheck
```

### Browser Flow

1. Page 3개 추가 → 추가 순서 유지 → Home만 삭제 불가 → refresh 후 동일.
2. page body에 frame 적용 → refresh → LayerTree body/slot 표시 및 Skia hatch marker 유지.
3. LayerTree에서 sibling reorder → Skia render/hit-test 순서 일치 → refresh 후 유지.
4. 같은 sibling에 `z-index`를 적용 → Skia render/hit-test effective order 일치.
5. Preview iframe과 Publish runtime에서 같은 page/render order 유지.
6. frame/group 내부 child reorder → layout order와 LayerTree order 일치.
7. component origin 생성 → copy/paste ref instance 삽입 → selected Properties/ref descendants 표시
   유지 → refresh 후 origin/instance child 표시 유지.
8. slot fill에 같은 component 2회 삽입 → 두 child가 append order로 유지.
9. drag/drop same-container/cross-container reorder → undo 1회로 원복.

### Completion Checklist

- [x] G0 inventory와 allowlist 작성.
- [x] G1 canonical order helper + unit test 통과.
- [x] 2026-05-07 canonical sibling bridge를 Phase 1 helper 후보와 Phase 4/6
      제거/흡수 대상으로 분류.
- [x] local main partial 선행 패치를 Phase 1/2/3/4/5/6 baseline으로 분류하고, 완료
      gate와 미완 gate를 분리.
- [x] order 착수 전 frame/component projection 및 Nodes panel Frames tree parity 선행 안정화
      상태를 문서에 반영.
- [x] G2 page/root order cutover 완료.
- [x] G3 LayerTree/layout/Skia/Preview/Publish read path cutover 완료.
- [x] G4 drag/drop/write path cutover 완료. Skia drag/drop final commit,
      structural-only batch update, PageTree DnD reorder, legacy mirror repair 경로가
      canonical child index/source order와 분리됐다.
- [x] G5 component origin/instance/slot descendants cutover 완료.
- [x] G6 non-adapter runtime `order_num` ordering decision 제거 또는 allowlist 격리.
- [x] browser smoke 통과. Seeded local IndexedDB canonical document에서 refresh 후 page
      source order, derived page mirror order, Body child order, Skia canvas render를 확인했다.
- [x] `docs/CHANGELOG.md`에 사용자-가시 ordering model 변경 기록.
