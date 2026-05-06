# ADR-918 Breakdown: children 배열 순서 기반 ordering SSOT 전환

## Scope

이 문서는 Builder/Skia/Preview가 사용하는 structural node order를 Pencil-compatible
parent `children[]` 배열 index로 수렴시키는 실행 계획이다. 최근 page order hotfix를
page 전용 보정으로 끝내지 않고, frame/group/body/component origin/ref instance/slot
descendants까지 같은 ordering contract로 확장한다.

## Scope Matrix

| Surface                               | 포함 여부   | 최종 order source                                    | 비고                                                            |
| ------------------------------------- | ----------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| root page/frame/slide order           | In          | `CompositionDocument.children` index                 | PageTree, export render model, Home identity 분리               |
| page body/frame body children         | In          | parent `children[]` index                            | body는 order 0 fallback이 아니라 explicit child identity로 판정 |
| frame/group/layout container children | In          | parent `children[]` index                            | LayerTree, layout, Skia render input 공유                       |
| reusable component origin children    | In          | origin/master node `children[]` index                | origin/instance mismatch 방지                                   |
| component ref instance descendants    | In          | `RefNode.descendants[descendantPath].children` index | normal descendants override와 slot fill 분리                    |
| slot fill insertion order             | In          | `descendants[slotPath].children` append/move order   | 같은 `ref` 중복 삽입 허용                                       |
| drag/drop reorder                     | In          | target parent `children[]` splice index              | same-container/cross-container 모두 포함                        |
| legacy `Element.order_num`            | Boundary    | `children[]` index에서 파생                          | import/export/DB/API/test fixture compatibility only            |
| `childrenMap`                         | Projection  | canonical child order에서 파생                       | O(1) lookup shape는 유지 가능                                   |
| Table row/column data order           | Conditional | 기존 data model                                      | structural node child로 materialize되는 경우만 포함             |
| collection `items` order              | Conditional | existing collection data SSOT                        | 별도 ADR 후보. structural child order와 혼합 금지               |
| CSS `z-index` / paint stacking        | Out         | explicit style property                              | tree order와 별도 속성                                          |

## Current Baseline

현재 repo에는 다음 ordering 경계가 혼재한다.

- legacy `Element.order_num`: `packages/shared/src/types/element.types.ts`,
  `packages/shared/src/types/renderer.types.ts`, DB/API service, export/import fixture.
- canonical page shell metadata mirror: canonical mutation/adapter/page-frame binding 경로에서
  tactical `order_num` metadata를 주입한다.
- `childrenMap`: shared renderers, Builder layout engine, Skia renderer input, AI/editor tools가
  parent lookup 구조로 사용한다.
- LayerTree/PageTree: 현재 일부 경로는 `order_num` sort 또는 `orderNum` UI field를 사용한다.
- drag/drop: legacy parent/order update와 canvas insertion index 계산이 결합되어 있다.
- slot/component: `descendants[slotPath].children` order와 legacy element projection order가
  동시에 영향을 준다.

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
4. Phase 6 grep gate allowlist를 먼저 작성한다.

### 확인 명령

```bash
rg -n "order_num|childrenMap|orderNum|findInsertionIndex|deferredDropChildIndex|sort\\(" apps packages docs/adr docs/pencil-copy
rg -n "metadata.*order_num|order_num.*metadata" apps packages
```

### 산출물

- bucket별 file/function inventory.
- Phase별 migration target 목록.
- Phase 6 allowlist 초안.

## Phase 1: Canonical Order Helper 도입

### 작업

1. canonical document mutation/read helper를 만든다.
   - `getCanonicalChildren(document, parentId)`
   - `insertCanonicalChild(document, parentId, child, index)`
   - `moveCanonicalChild(document, childId, targetParentId, index)`
   - `removeCanonicalChild(document, childId)`
   - `deriveLegacyOrderNum(parentChildren, childId)`
2. helper는 top-level `CompositionDocument.children`, nested `FrameNode.children`,
   `RefNode.descendants[slotPath].children`를 같은 ordering primitive로 다룬다.
3. helper가 id/path 기반 child identity를 보존하고 duplicate `ref` slot fill을 child id로
   구분하는지 test한다.
4. `order_num` mirror 생성은 helper 밖 runtime에서 직접 계산하지 않도록 adapter boundary
   helper로 격리한다.

### 금지

- canonical node metadata의 `order_num`을 새 runtime order decision에 사용하지 않는다.
- child index 계산을 surface별 `.sort((a, b) => order_num...)`로 재도입하지 않는다.
- slot fill append를 same `ref` 존재 여부로 replace하지 않는다.

## Phase 2: Page/Root Order Cutover

### 작업

1. `CompositionDocument.children` 순서가 PageTree/root slide list의 source가 되도록 전환한다.
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

## Phase 3: LayerTree / Layout / Skia Read Path Cutover

### 작업

1. `childrenMap`은 canonical child order에서 파생되는 projection으로만 유지한다.
2. LayerTree tree item order는 parent `children[]` index를 그대로 사용한다.
3. Skia render input은 child order를 forward render order로 전달하고, hit-test는 reverse order를
   사용한다.
4. layout engine의 child order fallback이 `order_num`이 아니라 projection order를 사용하도록
   정리한다.
5. synthetic merge/collection child projection이 structural child order를 변경하지 않는지 확인한다.

### 검증

- 겹친 sibling에서 뒤쪽 child가 hit-test 우선권을 가진다.
- LayerTree reorder 후 Skia paint order와 hit-test order가 일치한다.
- full-tree layout이 child index order를 보존한다.

## Phase 4: Drag/Drop Reorder Write Path Cutover

### 작업

1. drag session은 dragged node의 original parent와 original child index를 저장한다.
2. same-container reorder는 insertion index를 계산해 transient `children[]` reorder를 적용할 수
   있지만, undo history는 pointerup/drop에서 하나의 user action으로 commit한다.
3. cross-container/layout drop은 target parent와 child index를 deferred state로 들고 있다가
   exit/drop 시 `moveCanonicalChild`로 적용한다.
4. legacy `parent_id`/`order_num` write는 adapter projection 또는 derived mirror로만 발생한다.

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

### 검증

- component origin/instance를 만든 뒤 refresh해도 origin children이 유지된다.
- instance LayerTree가 ref 하나만 보이는 상태로 퇴행하지 않고 resolved/override child를 표시한다.
- slot에 같은 recommended component를 두 번 삽입하면 두 child가 같은 순서로 보존된다.
- detach 후 resolved children order가 유지된다.

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

| 영역                  | 예상 파일/모듈                                                              | 변경 방향                                                    |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| canonical type/helper | `packages/shared/src/types/*`, `apps/builder/src/adapters/canonical/*`      | child order helper와 legacy mirror boundary 정리             |
| export/import         | `packages/shared/src/utils/export.utils.ts`, canonical/pencil adapters      | `children[]` index에서 `order_num` 파생                      |
| page tree             | `apps/builder/src/builder/panels/nodes/tree/PageTree/*`, `PagesSection.tsx` | PageTree order source를 root children index로 전환           |
| layer tree            | `apps/builder/src/builder/panels/nodes/tree/LayerTree/*`                    | canonical child order projection                             |
| stores/indexer        | `apps/builder/src/builder/stores/**`, `elementIndexer.ts`                   | `childrenMap`을 ordered projection으로 유지                  |
| canvas/Skia           | `apps/builder/src/builder/workspace/canvas/**`                              | render/hit-test/layout order source 통일                     |
| drag/drop             | `useDragBridge.ts`, `useCanvasDragDropHelpers.ts`, reorder helpers          | parent/index splice write path                               |
| component/slot        | `FramesTab`, `LayoutPresetSelector`, slot/layout adapters                   | descendants slot child append/move contract                  |
| shared renderers      | `packages/shared/src/renderers/**`                                          | `childrenMap` order 소비만 허용, local `order_num` sort 제거 |
| collection data       | `migrateCollectionItems.ts`, Table/List data models                         | structural vs data order bucket 분리                         |

## Verification Plan

### Unit / Static

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts \
  src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.test.tsx \
  src/adapters/canonical/__tests__/canonicalMutations.test.ts

pnpm -F @composition/shared exec vitest run \
  src/utils/__tests__/exportCanonicalProject.test.ts

pnpm run codex:typecheck
```

### Browser Flow

1. Page 3개 추가 → 추가 순서 유지 → Home만 삭제 불가 → refresh 후 동일.
2. page body에 frame 적용 → refresh → LayerTree body/slot 표시 및 Skia hatch marker 유지.
3. LayerTree에서 sibling reorder → Skia render/hit-test 순서 일치 → refresh 후 유지.
4. frame/group 내부 child reorder → layout order와 LayerTree order 일치.
5. component origin 생성 → instance 삽입 → refresh → origin/instance child 표시 유지.
6. slot fill에 같은 component 2회 삽입 → 두 child가 append order로 유지.
7. drag/drop same-container/cross-container reorder → undo 1회로 원복.

### Completion Checklist

- [ ] G0 inventory와 allowlist 작성.
- [ ] G1 canonical order helper + unit test 통과.
- [ ] G2 page/root order cutover 완료.
- [ ] G3 LayerTree/layout/Skia read path cutover 완료.
- [ ] G4 drag/drop write path cutover 완료.
- [ ] G5 component origin/instance/slot descendants cutover 완료.
- [ ] G6 non-adapter runtime `order_num` ordering decision 제거 또는 allowlist 격리.
- [ ] browser flow 7개 통과.
- [ ] `docs/CHANGELOG.md`에 사용자-가시 ordering model 변경 기록.
