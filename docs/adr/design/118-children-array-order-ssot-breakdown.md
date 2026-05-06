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

| 영역                        | 현재 반영                                                                                                                                                                                         | 남은 판단                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| canonical upsert            | `upsertChild`가 기존 child를 같은 배열 index에서 replace하고 신규 child만 append한다. `replaceNodeById`는 nested `children`과 `RefNode.descendants[*].children`까지 위치 보존 replace를 수행한다. | 공개 helper/API로 승격하고, explicit insert/move/remove는 아직 별도 구현해야 한다.                                  |
| legacy export mirror        | `exportLegacyDocument`가 root/nested/descendant `children` 순회 index를 legacy `order_num`으로 파생한다.                                                                                          | DB/API/import/test fixture bucket과 함께 Phase 6 allowlist에 고정해야 한다.                                         |
| shared export runtime model | `deriveProjectRenderModelFromDocument`의 runtime element projection은 child index를 `order_num`으로 파생한다.                                                                                     | page order는 아직 metadata/readPageOrder sort가 남아 있으므로 Phase 2/3/6에서 별도 분류해야 한다.                   |
| component origin round-trip | `reusable: true`를 `componentRole: "master"` mirror로 export하고, page-owned origin을 root reusable catalog로 끌어올리지 않는다.                                                                  | origin/instance/slot 전체 child order cutover는 Phase 5에서 별도 gate로 닫아야 한다.                                |
| component ref resolution    | canonical `ref`/legacy `masterId` instance를 origin-shaped runtime element로 resolve하고, descendants mode B/C synthetic child를 materialize한다.                                                   | resolver는 아직 `childrenMap`을 `order_num`으로 정렬하고 synthetic `order_num` bridge를 만들므로 Phase 3/5 미완이다. |
| copy/paste ref instance     | reusable origin copy/paste는 origin subtree deep-copy 대신 canonical `ref` instance를 생성한다.                                                                                                     | paste 위치/order는 legacy `parent_id`/`order_num` mirror에 남아 있으므로 Phase 4/6에서 재분류해야 한다.              |
| LayerTree/frame projection  | canonical source와 page-frame projection merge가 보강되어 frame-bound page body/slot/live page child가 더 잘 보인다.                                                                              | `useLayerTreeData`와 `buildTreeFromElements`는 여전히 `order_num` sort를 사용하므로 G3 미완이다.                    |
| selection/hit-test          | page-frame hidden slot child 선택과 overlapping frame body 선택이 보강됐다.                                                                                                                       | depth/area 우선 heuristic이 최종 `z-index` + `children[]` effective order와 충돌하지 않는지 G3에서 재검증해야 한다. |
| Nodes panel frame tree UI   | Frames 탭의 Frames/Layers child rendering 이 Pages 탭과 같은 `TreeBase` / `VirtualizedTree`, `section` / `section-content`, `frame-tree` 단일 class 기준으로 정리됐다.                            | UI tree primitive parity baseline. structural ordering source 전환은 Phase 3/6에서 별도 검증해야 한다.              |
| drag/drop/write path        | drag/drop 자체의 canonical child move 선행 패치는 없다. `batchUpdateElementOrders`/`moveElementToContainer`/`reorderElements`는 legacy `order_num` write 중심이다.                                  | Phase 4에서 target parent `children[]` splice write path로 전환해야 한다.                                           |
| group/ungroup/history write | group/ungroup, undo/redo history reorder, loader hydration 경로가 `parent_id`/`order_num`을 직접 읽고 쓴다.                                                                                       | Phase 4 inventory와 Phase 6 allowlist에서 drag/drop write path와 함께 격리해야 한다.                                |

### 중요 정리

- 선행 패치는 ADR-118의 Decision을 바꾸지 않는다. 오히려 대안 A의 일부 전제가 이미
  코드에 들어간 상태다.
- `shouldPreserveExistingCanonicalPosition`은 "같은 legacy ownership/order 입력으로 props만
  바뀌는 update"의 위치 보존 guard다. reorder API가 아니므로 Phase 1/4의
  `moveCanonicalChild`/descendant move helper 요구는 유지한다.
- 현재 `order_num` sort가 남은 runtime path는 Phase 0 inventory에서 `delete-after-cutover`
  또는 temporary `structural-runtime` bucket으로 명시하고, Phase 6에서 0 또는 allowlist로
  닫는다.

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
4. 2026-05-06 local main 선행 패치를 별도 `partial-implemented` column으로 표시한다.
   특히 `canonicalMutations.ts`, `exportLegacyDocument.ts`, `useLayerTreeData.ts`,
   `selectionHitTest.ts`, `hierarchicalSelection.ts`,
   `packages/shared/src/utils/export.utils.ts`,
   `apps/builder/src/builder/stores/elements.ts`, `treeUtils.ts`,
   Preview/Publish order sort call site를 같은 표에서 비교한다.
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

## Phase 1: Canonical Order Helper 도입

### 작업

1. canonical document mutation/read helper를 만든다.
   - local main의 `upsertChild`, `replaceNodeById`, `removeNodeById` 선행 구현을
     내부 helper 후보로 평가하되, 파일-local 함수에 머무르지 않게 public/internal
     API 경계를 정한다.
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
   `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts`에 move/reorder와
   descendants children insert/move contract를 명시한다.

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
6. `PropertiesPanel` group/ungroup, history undo/redo reorder, loader hydration,
   copy/paste placement처럼 direct `parent_id`/`order_num` read/write가 있는 경로를
   Phase 4 inventory에 포함하고, final canonical write API 또는 Phase 6 allowlist로
   명시 분류한다.

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

### 검증

- component origin/instance를 만든 뒤 refresh해도 origin children이 유지된다.
- instance LayerTree가 ref 하나만 보이는 상태로 퇴행하지 않고 resolved/override child를 표시한다.
- slot에 같은 recommended component를 두 번 삽입하면 두 child가 같은 순서로 보존된다.
- detach 후 resolved children order가 유지된다.
- Create component 후 refresh해도 origin이 `reusable: true`/`componentRole: "master"`로
  유지되고 원래 parent `children[]` 위치를 잃지 않는다.

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

### Grep Gate

```bash
rg -n "order_num|orderNum" apps/builder/src packages/shared/src packages/specs/src
rg -n "\\.sort\\([^\\n]*(order_num|orderNum)" apps/builder/src packages/shared/src
```

통과 기준:

- structural runtime order decision에서 `order_num` primary sort가 0건.
- remaining hits는 Phase 0 allowlist bucket에 매핑된다.
- docs/changelog/test comments가 actual gate result와 일치한다.

## File Impact Map

| 영역                  | 예상 파일/모듈                                                                                                                           | 변경 방향                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| canonical type/helper | `packages/shared/src/types/*`, `apps/builder/src/adapters/canonical/*`                                                                   | child order helper와 legacy mirror boundary 정리             |
| canonical actions     | `packages/shared/src/types/composition-document-actions.types.ts`, `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts` | move/reorder 및 descendants children write contract 추가     |
| export/import         | `packages/shared/src/utils/export.utils.ts`, canonical/pencil adapters                                                                   | `children[]` index에서 `order_num` 파생                      |
| page tree             | `apps/builder/src/builder/panels/nodes/tree/PageTree/*`, `PagesSection.tsx`                                                              | PageTree order source를 root children index로 전환           |
| layer tree            | `apps/builder/src/builder/panels/nodes/tree/LayerTree/*`                                                                                 | canonical child order projection                             |
| stores/indexer        | `apps/builder/src/builder/stores/elements.ts`, `apps/builder/src/builder/stores/index.ts`                                                | `childrenMap`을 ordered projection으로 유지                  |
| canvas/Skia           | `apps/builder/src/builder/workspace/canvas/**`                                                                                           | render/hit-test/layout order source 통일                     |
| preview runtime       | `apps/builder/src/preview/App.tsx`, `apps/builder/src/preview/utils/layoutResolver.ts`                                                   | iframe render tree order source 통일                         |
| publish runtime       | `apps/publish/src/components/PageNav.tsx`, `apps/publish/src/renderer/ElementRenderer.tsx`                                               | published page/render order source 통일                      |
| drag/drop/write       | `useDragBridge.ts`, `useCanvasDragDropHelpers.ts`, `PropertiesPanel.tsx`, `historyActions.ts`, `elementLoader.ts`, reorder helpers       | parent/index splice write path + legacy write quarantine     |
| component/slot        | `canonicalRefResolution.ts`, `canonicalElementsView.ts`, `multiElementCopy.ts`, `instanceActions.ts`, slot/layout adapters               | descendants slot child append/move contract                  |
| shared renderers      | `packages/shared/src/renderers/**`                                                                                                       | `childrenMap` order 소비만 허용, local `order_num` sort 제거 |
| collection data       | `migrateCollectionItems.ts`, Table/List data models                                                                                      | structural vs data order bucket 분리                         |

### Local Main Partial Files

| 파일                                                                       | 현재 역할                                                                                                           | ADR-118 처리                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/builder/src/adapters/canonical/canonicalMutations.ts`                | 위치 보존 upsert/replace/remove, reusable origin placement 일부 구현                                                | Phase 1 helper 후보 + Phase 5 baseline. explicit move helper는 추가 필요 |
| `apps/builder/src/adapters/canonical/canonicalRefResolution.ts`            | canonical `ref`/legacy `masterId` resolve, descendants synthetic child materialization                              | Phase 3/5 partial. `order_num` 기반 childrenMap bridge는 제거 필요        |
| `apps/builder/src/builder/utils/canonicalRefResolution.ts`                 | builder-facing re-export facade                                                                                     | Phase 3/5 test/import boundary                                           |
| `apps/builder/src/adapters/canonical/exportLegacyDocument.ts`              | `children[]` index에서 legacy `order_num` export                                                                    | Phase 1/6 adapter boundary allowlist                                     |
| `packages/shared/src/utils/export.utils.ts`                                | runtime element projection 은 `children[]` index로 `order_num` 파생, page order 는 metadata/readPageOrder sort 사용 | Phase 1/2/3/6 교차 target. element projection 과 page order 를 분리 분류 |
| `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts`       | canonical tree DFS 로 legacy `Element[]`와 selected ref view를 파생                                                 | Phase 3/5 partial. selected/ref view와 render order parity 검증 필요      |
| `apps/builder/src/builder/stores/index.ts`                                 | selected element data가 canonical/ref-resolved view를 fallback으로 사용                                             | Phase 3 inspector/properties read baseline                               |
| `apps/builder/src/builder/stores/utils/instanceActions.ts`                 | component origin 전환 후 canonical document sync/persist                                                            | Phase 5 baseline. instance creation order write는 Phase 4/6에서 재분류   |
| `apps/builder/src/builder/utils/multiElementCopy.ts`                       | reusable origin paste를 canonical `ref` instance 생성으로 전환                                                     | Phase 5 UX baseline. paste placement/order는 Phase 4/6에서 재분류        |
| `apps/builder/src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.ts` | canonical/page-frame source merge와 frame-bound projection 보강                                                     | Phase 3 partial. `order_num` sort 제거 필요                              |
| `apps/builder/src/builder/utils/treeUtils.ts`                              | generic Element tree가 `order_num` sort 사용                                                                        | Phase 3 cutover target                                                   |
| `apps/builder/src/builder/workspace/canvas/selection/selectionHitTest.ts`  | depth/area 기반 hit target 보강                                                                                     | Phase 3 effective order 재검증 target                                    |
| `apps/builder/src/builder/stores/elements.ts` / `stores/utils/elementReorder.ts` | order write/reparent가 legacy `order_num` 중심                                                                      | Phase 4 cutover target                                                   |
| `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`           | group/ungroup 이 `parent_id`/`order_num`을 store와 Supabase에 직접 write                                            | Phase 4 cutover target                                                   |
| `apps/builder/src/builder/stores/history/historyActions.ts`                | undo/redo/go-to-history 이후 `reorderElements`로 legacy order 재정렬                                                | Phase 4/6 quarantine target                                              |
| `apps/builder/src/builder/stores/elementLoader.ts`                         | IndexedDB/Supabase hydrate와 page snapshot이 `order_num` 정렬을 사용                                               | Phase 6 legacy boundary allowlist 후보                                   |
| `apps/builder/src/builder/panels/nodes/FramesTab/*` / `NodesPanel.css`     | Frames tab tree primitive/section/class parity 완료                                                                 | Phase 3 UI baseline. ordering source cutover 자체는 별도 target          |

## Verification Plan

### Unit / Static

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts \
  src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx \
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

- [ ] G0 inventory와 allowlist 작성.
- [ ] G1 canonical order helper + unit test 통과.
- [ ] local main partial 선행 패치를 Phase 1/2/3/4/5/6 baseline으로 분류하고, 완료
      gate와 미완 gate를 분리.
- [x] order 착수 전 frame/component projection 및 Nodes panel Frames tree parity 선행 안정화
      상태를 문서에 반영.
- [ ] G2 page/root order cutover 완료.
- [ ] G3 LayerTree/layout/Skia/Preview/Publish read path cutover 완료.
- [ ] G4 drag/drop write path cutover 완료.
- [ ] G5 component origin/instance/slot descendants cutover 완료.
- [ ] G6 non-adapter runtime `order_num` ordering decision 제거 또는 allowlist 격리.
- [ ] browser flow 9개 통과.
- [ ] `docs/CHANGELOG.md`에 사용자-가시 ordering model 변경 기록.
