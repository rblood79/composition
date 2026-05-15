# ADR-135 Design Breakdown — Page-Frame Projection Interaction Boundary

> 본문: [135-page-frame-projection-interaction-boundary.md](../completed/135-page-frame-projection-interaction-boundary.md). Phase 1-6 implemented 상태 — refresh/bootstrap/lazy-load mirror projection leak까지 closure.

## Execution Snapshot — 2026-05-14

| Gate | 상태 | Evidence                                                                                                                                                                                                                                                                         |
| ---- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | PASS | `rendererInput.ts` / `BuilderCanvas.tsx` interaction read model을 render-space map으로 전환. `BuilderCanvas.projection.static.test.ts`와 `createSkiaRendererInput.test.ts`가 scene map 회귀를 차단.                                                                              |
| G2   | PASS | `CanvasSceneNode.projection`, `resolvePageWithFrame.ts` metadata, `resolveCanvasInteractionTarget.ts` land. projected Slot은 `slot-guard`, page-owned child는 canonical `select` target으로 정규화. projected Slot chrome hit는 Page/body fallback selection을 유지.             |
| G3   | PASS | `resolveCanonicalMutationTarget.ts`, `CanonicalMoveTarget`, `moveElementToCanonicalTarget()`, `moveCanonicalChildToDescendants()` land. projected ID canonical mutation target negative fixture PASS.                                                                            |
| G4   | PASS | `pageFrameBinding.ts` descendant-path roundtrip 보존, `frameElementScope.ts` props-less Slot inclusion, `canonicalElementsView.ts` `documentVersion` invalidation, `frameActions.ts` index rebuild, drag 후 frame unapply ownership 보존, page-shell bridge topology guard land. |
| G5   | PASS | targeted Vitest 16 files / 62 tests PASS, `pnpm run codex:typecheck` PASS, `git diff --check` PASS, `pnpm run codex:preflight` PASS. canonical atomicity, page activation regression, bootstrap/lazy-load canonical-only fixture 포함.                                           |
| G6   | PASS | authenticated browser smoke에서 refresh 전후 runtime `elementsMap` synthetic 0, IndexedDB `documents` synthetic 0, console/page/http error 0 확인. 이전 fixture smoke의 ownership/Slot persistence PASS와 결합해 최종 승격.                                                      |

R8-R12 closure decision: 모두 ADR-135 execution 안에서 처리했다. R8은 frame mutation index rebuild fixture, R9는 props-less Slot inclusion + `documentVersion` invalidation, R10은 `updateElement` stale snapshot 제거, R11은 layout-bound page creation duplicate activation 제거, R12는 bootstrap/lazy-load canonical-only hydrate로 닫는다.

## 0. Scope

### In scope

- Skia render tree와 interaction hit-test read model의 ID 공간 정렬
- projected render node metadata 도입
- selection/context menu target resolver
- drag/drop canonical mutation target resolver
- Page Frame apply/remove Slot descendants roundtrip 보존
- synthetic render ID canonical persistence 유입 차단
- Frame mutation 후 canonical-derived `elementsMap` / `childrenMap` / frame scope view 수렴 보장
- props 없는 Slot host와 `documentVersion` 기반 frame scope invalidation 보장
- ADR-135 증상을 재발시킬 수 있는 canonical update stale snapshot / page activation 중복 호출 회귀 방지
- refresh/bootstrap 및 lazy-load store mirror가 render projection ID를 수용하지 않는 canonical-only hydrate 보장
- targeted unit/static test + browser smoke 설계

### Out of scope

- Preview/Publish renderer 변경
- public export format 변경
- 기존 IndexedDB runtime migration 작성
- Frame authoring UX 전체 재설계
- Pencil adapter schema 변경
- AI 도구나 Events/Data 패널 변경

## 1. Current Failure Model

### 1.1 render-space와 interaction-space split-brain

현재 경로:

1. `resolvePageWithFrame.ts`가 Frame 적용 Page의 render projection을 만든다.
2. `rendererInput.ts`가 `pageSnapshots.pageElements`를 `renderNodesMap`에 합성한다.
3. `SkiaCanvas.tsx` / `renderCommands.ts`가 `renderNodesMap` 기준으로 그리고 `boundsMap`을 SpatialIndex에 넣는다.
4. `hitTestPoint()`는 render bounds ID를 반환한다.
5. `BuilderCanvas.tsx`는 interaction lookup에 `sceneNodesMap`을 넣는다.
6. `selectionHitTest.ts`는 candidate가 map에 없으면 버린다.

결과:

- `page-1::page-frame::slot-content` 같은 projected Slot ID가 hit-test candidate로 나오면 scene map에서 누락될 수 있다.
- child 자체를 hit하면 선택되고, projected ancestor/Slot을 hit하면 선택 실패하는 식으로 간헐성이 발생한다.

### 1.2 pageFrameBinding apply/remove lossy roundtrip

현재 경로:

1. bound page는 `RefNode.descendants[path].children`으로 Slot fill을 표현한다.
2. unapply 시 `getChildrenFromDescendants()`가 모든 descendant override children을 direct children으로 평탄화한다.
3. reapply 시 direct children을 `descendants.content.children`에 넣는다.

결과:

- `header`, `footer`, custom Slot path가 `content`로 섞인다.
- default Slot child hide/restore와 page-owned fill이 엇갈릴 수 있다.

### 1.3 drag/drop projected target persistence risk

현재 경로:

1. `useDragBridge`가 interaction read model로 drop target을 계산한다.
2. `finalTarget.containerId`를 `moveElementCanonicalPrimary(elementId, containerId, insertionIndex)`로 전달한다.
3. `moveElementCanonicalPrimary`는 `moveCanonicalChild`에 parent ID를 그대로 넘긴다.

interaction read model을 render-space로 바꾸면 projected Slot ID가 `containerId`가 될 수 있다. 이 ID는 canonical node가 아니므로 no-op, 잘못된 insert, history 불일치 중 하나로 이어질 수 있다.

### 1.4 adjacent stale mirror and scope invalidation risks

현재 경로:

1. 일부 Frame mutation 경로는 canonical document를 갱신한 뒤 legacy page mirror만 `setPages()`로 갱신한다.
2. `setPages()`는 page list와 layout invalidation만 수행하고 `elementsMap` / `childrenMap`을 rebuild하지 않는다.
3. frame scope derive는 현재 doc reference 중심으로 memoize되고, Slot inclusion은 일부 경로에서 `node.props` 존재 여부에 의존한다.
4. `updateElement` canonical sync는 set callback 밖에서 만든 stale `updatedElement` snapshot을 먼저 canonical에 반영할 수 있다.
5. `usePageManager.initializeProject()`와 `elementLoader`가 `deriveProjectRenderModelFromDocument().elements`를 store mirror hydrate source로 쓰면, refresh 후 `elementsMap`에 `page::page-frame::slot` ID가 섞일 수 있다.

결과:

- ADR-135의 render/canonical ID split-brain을 고쳐도 stale mirror 또는 stale frame scope가 같은 사용자 증상(selection skip, Slot visibility miss)을 재현할 수 있다.
- props 없는 Slot host가 scope에서 빠지면 `collectHydratedFrameElements()` 필터에서 Slot 자체가 사라질 수 있다.
- overlapping update가 canonical document와 derived mirror를 서로 다른 element snapshot으로 갱신할 수 있다.
- canonical document와 IndexedDB는 정상인데 runtime `elementsMap`만 projected render ID로 오염되어 refresh 후 selection/drop target 해석이 다시 split-brain 상태가 될 수 있다.

## 2. Target Architecture

### 2.1 ID-space vocabulary

| 용어                 | 의미                                              | 저장 가능 여부 | 예                                                       |
| -------------------- | ------------------------------------------------- | -------------- | -------------------------------------------------------- |
| canonical node ID    | `CompositionDocument`에 존재하는 안정 node ID     | 가능           | `button-1`, `page-1`, `frame-body`                       |
| descendant path      | `RefNode.descendants`의 override path             | 가능           | `frame-body/slot-header`                                 |
| render projection ID | Page/Frame binding에서 파생한 Skia render-only ID | 금지           | `page-1::page-frame::slot-content`                       |
| selectable target ID | selection state에 들어갈 수 있는 canonical ID     | 가능           | `button-1`                                               |
| mutation target      | canonical mutation entry가 받는 typed target      | 가능           | `{ kind: "ref-descendants", refNodeId, descendantPath }` |

### 2.2 SkiaRendererInput contract

수정 파일:

- `apps/builder/src/builder/workspace/canvas/renderers/rendererInput.ts`
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx`

목표 shape:

```ts
export interface SkiaRendererInput {
  renderNodesMap: Map<string, CanvasSceneNode>;
  childrenMap: Map<string, CanvasSceneNode[]>;
  interactionNodesMap: Map<string, CanvasSceneNode>;
  interactionChildrenMap: Map<string, CanvasSceneNode[]>;
  sceneNodesMap: Map<string, CanvasSceneNode>;
  sceneChildrenByParent: Map<string, CanvasSceneNode[]>;
}
```

규칙:

- Skia draw, hover, scroll, SpatialIndex, selection hit-test는 `renderNodesMap`/`childrenMap` 또는 alias인 `interactionNodesMap`/`interactionChildrenMap`을 사용한다.
- Layer tree / scene inspection / diagnostics는 `sceneNodesMap`을 사용할 수 있다.
- `BuilderCanvas`에서 interaction ref 이름은 `interaction*`으로 바꾼다. `scene*` 이름을 interaction path에 쓰지 않는다.

### 2.3 Projection metadata

수정 파일:

- `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`
- `apps/builder/src/builder/workspace/canvas/scene/resolvePageWithFrame.ts`

추가 타입:

```ts
export type CanvasProjectionMetadata =
  | {
      kind: "page-frame-element";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string | null;
      canonicalParentId: string | null;
      slotName?: string;
      descendantPath?: string;
    }
  | {
      kind: "page-slot-fill";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string;
      canonicalParentId: string | null;
      slotName: string;
      descendantPath: string;
    };
```

`CanvasSceneNode`:

```ts
projection?: CanvasProjectionMetadata;
```

규칙:

- projected frame Slot에는 `kind: "page-frame-element"`와 `slotName`, `descendantPath`를 붙인다.
- page-owned element가 projected Slot 아래로 render reparent될 때는 `kind: "page-slot-fill"`을 붙인다.
- metadata는 Builder runtime object에만 존재한다. canonical document export/import에는 포함하지 않는다.

### 2.4 Interaction target resolver

새 파일:

- `apps/builder/src/builder/workspace/canvas/interaction/resolveCanvasInteractionTarget.ts`
- `apps/builder/src/builder/workspace/canvas/interaction/__tests__/resolveCanvasInteractionTarget.test.ts`

API:

```ts
export type CanvasInteractionTarget =
  | {
      kind: "select";
      elementId: string;
      pageId: string | null;
    }
  | {
      kind: "slot-guard";
      renderSlotId: string;
      pageId: string;
      slotName: string;
      descendantPath: string;
    }
  | { kind: "none" };

export function resolveCanvasInteractionTarget(input: {
  candidateIds: readonly string[];
  elementsMap: ReadonlyMap<string, CanvasSceneNode>;
  childrenMap: ReadonlyMap<string, readonly CanvasSceneNode[]>;
}): CanvasInteractionTarget;
```

규칙:

- page-owned concrete element hit → `select`.
- projected Slot hit → `slot-guard`.
- body-only hit 또는 missing candidate → `none` 또는 기존 page/body fallback으로 위임.
- `select.elementId`에는 `::page-frame::`가 포함되면 안 된다.

### 2.5 Canonical mutation target resolver

새 파일:

- `apps/builder/src/builder/workspace/canvas/interaction/resolveCanonicalMutationTarget.ts`
- `apps/builder/src/builder/workspace/canvas/interaction/__tests__/resolveCanonicalMutationTarget.test.ts`

수정 파일:

- `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts`
- `apps/builder/src/adapters/canonical/canonicalMutations.ts`
- `packages/shared/src/utils/compositionDocumentOrder.ts`

API:

```ts
export type CanonicalMoveTarget =
  | {
      kind: "node-children";
      parentId: string | null;
      insertionIndex: number;
    }
  | {
      kind: "ref-descendants";
      refNodeId: string;
      descendantPath: string;
      insertionIndex: number;
    };

export function resolveCanonicalMoveTarget(input: {
  renderTargetId: string;
  insertionIndex: number;
  elementsMap: ReadonlyMap<string, CanvasSceneNode>;
}): CanonicalMoveTarget | null;
```

mutation wrapper:

```ts
export function moveElementToCanonicalTarget(
  elementId: string,
  target: CanonicalMoveTarget,
): CanonicalMutationResult;
```

shared utility additions:

```ts
export function moveCanonicalChildToDescendants(
  document: CompositionDocument,
  childId: string,
  refNodeId: string,
  descendantPath: string,
  index: number,
): CanonicalDocumentOrderResult;
```

Dev assert:

- `elementId`, `parentId`, `refNodeId`에 `::page-frame::`가 포함되면 throw 또는 dev warning + no-op.
- history event payload에도 projected ID가 포함되면 test에서 실패한다.

### 2.6 Page Frame binding roundtrip preservation

수정 파일:

- `apps/builder/src/adapters/canonical/pageFrameBinding.ts`
- `apps/builder/src/adapters/canonical/frameMirror.ts`
- `apps/builder/src/adapters/canonical/slotMirror.ts`

새 helper 후보:

- `apps/builder/src/adapters/canonical/pageFrameSlotRoundtrip.ts`
- `apps/builder/src/adapters/canonical/__tests__/pageFrameBinding.roundtrip.test.ts`

정책:

1. unapply 시 `RefNode.descendants`를 단순 flatten하지 않는다.
2. descendant path별 children을 direct page children으로 옮길 때 child metadata/props에 slot mirror를 보존한다.
3. reapply 시 direct children의 slot mirror를 기준으로 frame Slot registry를 조회한다.
4. Slot source identity가 있으면 identity 우선, 없으면 slot name fallback.
5. unmatched slot은 fallback content로 보내되 warning을 남기고 test fixture로 고정한다.

### 2.7 Frame scope and mirror convergence guards

수정 파일:

- `apps/builder/src/adapters/canonical/frameElementScope.ts`
- `apps/builder/src/adapters/canonical/frameElementLoader.ts`
- `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts`
- `apps/builder/src/builder/stores/utils/frameActions.ts`
- `apps/builder/src/adapters/canonical/frameLayoutCascade.ts`
- `apps/builder/src/builder/stores/utils/elementUpdate.ts`
- `apps/builder/src/builder/hooks/usePageManager.ts`

정책:

1. Slot host inclusion은 `node.props` truthiness에 의존하지 않는다. Slot identity, reusable frame role, descendants/ref metadata를 기준으로 scope에 포함한다.
2. frame scope derive는 doc object reference만 dependency로 삼지 않는다. `documentVersion` 또는 canonical traversal helper의 versioned cache를 통해 invalidation한다.
3. Frame apply/remove/delete 뒤 canonical-derived legacy mirror가 필요한 consumer에는 같은 mutation boundary에서 rebuilt `elementsMap` / `childrenMap`을 제공한다.
4. canonical update는 set callback 밖에서 만든 stale element snapshot을 authoritative source로 쓰지 않는다. latest element + latest canonical document를 같은 boundary에서 읽고 쓴다.
5. page creation activation은 한 page append당 1회만 발생한다. layout-bound page 생성도 `appendPageShell` activation과 외부 `activatePage`를 중복 호출하지 않는다.

## 3. Phase Plan

### Phase 0 — baseline and failing fixtures

목적:

- 현재 split-brain을 test로 고정한다.
- 기존 코드 변경 없이 failing test를 먼저 만든다.

파일:

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts`
- `apps/builder/src/builder/workspace/canvas/interaction/__tests__/resolveCanvasInteractionTarget.test.ts`
- `apps/builder/src/adapters/canonical/__tests__/pageFrameBinding.roundtrip.test.ts`
- `apps/builder/src/adapters/canonical/__tests__/frameElementScope.test.ts`
- `apps/builder/src/builder/stores/utils/__tests__/frameActions.indexSync.test.ts`
- `apps/builder/src/builder/stores/utils/__tests__/elementUpdate.atomicity.test.ts`
- `apps/builder/src/builder/hooks/__tests__/usePageManager.pageCreation.test.tsx`

검증:

- static test: interaction path가 `sceneNodesMap`을 사용하면 FAIL.
- unit fixture: projected Slot hit가 기존 selection lookup에서 누락되는 현상 재현.
- roundtrip fixture: `header/content/footer` descendants가 remove/apply 후 `content`로 합쳐지는 현상 재현.
- scope fixture: props 없는 Slot host가 frame scope / hydrated frame elements에서 누락되는 현상 재현.
- mirror fixture: Frame apply/remove/delete 뒤 active canonical document와 `elementsMap` / `childrenMap`이 diverge하는 현상 재현.
- atomicity fixture: 같은 element에 연속 update가 들어올 때 canonical document가 stale pre-callback snapshot으로 앞선 patch를 잃는 현상 재현.
- page creation fixture: layout-bound page 생성 시 activation이 2회 발생하는 현상 재현.

Gate:

- 실패하는 테스트가 정확히 원인 증상을 잡아야 Phase 1 진입.
- R8-R11 closure path 결정 lock-in: 2026-05-14 execution land에서 네 위험 모두 ADR-135 실행 내 fix로 처리했다. R8은 frame mutation index rebuild fixture, R9는 props-less Slot inclusion + `documentVersion` invalidation, R10은 `updateElement` stale snapshot 제거, R11은 page activation 중복 호출 제거로 닫는다.

### Phase 1 — interaction read model render-space alignment (G1)

목적:

- 선택 불가의 직접 원인인 render/hit lookup ID mismatch를 닫는다.

파일:

- `rendererInput.ts`
- `BuilderCanvas.tsx`
- `SkiaCanvas.tsx`
- `BuilderCanvas.projection.static.test.ts`
- `createSkiaRendererInput.test.ts`

작업:

1. `SkiaRendererInput`에 `interactionNodesMap` / `interactionChildrenMap` 추가.
2. 기본값은 resolved render tree의 `renderNodesMap` / `childrenMap`.
3. `BuilderCanvas` interactive refs를 `interaction*` 필드로 전환.
4. context menu, pointer handlers, drag bridge에 전달되는 resolver 이름 갱신.
5. scene inspection path는 `scene*` 필드를 계속 사용.

Gate G1:

- static test가 `sceneNodesMap` interaction 재사용을 차단.
- `createSkiaRendererInput` fixture에서 projected Slot ID가 interaction map에 존재.

### Phase 2 — projection metadata + selection target resolver (G2)

목적:

- render-space candidate를 selection-safe target으로 변환한다.

파일:

- `canvasSceneNode.ts`
- `resolvePageWithFrame.ts`
- `frameElementScope.ts`
- `canonicalElementsView.ts`
- `resolveCanvasInteractionTarget.ts`
- `useCentralCanvasPointerHandlers.ts`
- `BuilderCanvas.tsx`
- `selectionHitTest.ts`

작업:

1. `CanvasProjectionMetadata` 타입 추가.
2. `resolvePageWithFrame`에서 projected frame element와 page slot fill element에 metadata 부여.
3. `resolveCanvasInteractionTarget` 도입.
4. pointerdown/contextmenu selection 전에 resolver를 호출.
5. `selectedElementIds`에는 canonical/selectable ID만 저장.
6. projected Slot hit는 `slot-guard`로 반환하여 helper guard 표시 경로에 연결.
7. props 없는 projected Slot host도 interaction/scope candidate로 남는지 fixture로 고정.
8. frame scope derive가 `documentVersion` 변경을 반영하는지 test로 고정.

Gate G2:

- projected Slot hit → slot guard target.
- page-owned child hit → canonical child selected.
- `selectedElementIds` synthetic ID 0건.

### Phase 3 — drag/drop canonical mutation target resolver (G3)

목적:

- projected Slot으로 drop해도 synthetic render ID가 canonical mutation에 들어가지 않게 한다.

파일:

- `resolveCanonicalMutationTarget.ts`
- `useDragBridge.ts`
- `canonicalMutations.ts`
- `packages/shared/src/utils/compositionDocumentOrder.ts`
- `dropTargetResolver.ts`

작업:

1. `CanonicalMoveTarget` union 추가.
2. `resolveDropTarget`의 `containerId`를 render target으로 취급하고 mutation 직전 canonical target으로 변환.
3. `moveElementToCanonicalTarget` wrapper 추가.
4. `moveCanonicalChildToDescendants` shared utility 추가.
5. projected Slot target이면 `ref-descendants`로 commit.
6. node children target이면 기존 `moveCanonicalChild` 경로 사용.
7. dev assert로 `::page-frame::` target 유입 차단.

Gate G3:

- drag/drop 후 active document에 `::page-frame::` substring 0건.
- projected Slot drop이 `RefNode.descendants[slotPath].children`에 반영.
- same-parent reorder 기존 fixture PASS.

### Phase 4 — pageFrameBinding lossless roundtrip (G4)

목적:

- apply/remove 반복으로 Slot contents가 사라지거나 `content`로 평탄화되는 문제를 닫는다.

파일:

- `pageFrameBinding.ts`
- `pageFrameSlotRoundtrip.ts`
- `slotMirror.ts`
- `frameMirror.ts`
- `frameElementScope.ts`
- `frameLayoutCascade.ts`
- `frameActions.ts`
- `pageFrameBinding.roundtrip.test.ts`

작업:

1. `getChildrenFromDescendants()` 대체 helper 작성.
2. descendant path → slot name/source identity를 보존하는 direct child mirror 부여.
3. reapply 시 direct child mirror → descendant path grouping.
4. frame Slot registry builder 추가.
5. unmatched slot fallback policy 구현.
6. existing content-only case는 현행 동작 유지.
7. props 없는 Slot host inclusion을 명시적으로 보장.
8. Frame apply/remove/delete 후 canonical-derived mirror/index를 rebuild하거나, 해당 consumer가 versioned canonical view를 직접 보도록 정렬.

Gate G4:

- `header/content/footer/custom` 4-slot roundtrip PASS.
- Slot order 보존.
- props 없는 Slot host visibility PASS.
- Frame mutation 후 `elementsMap` / `childrenMap` 정합 PASS.
- content-only legacy fixture PASS.

### Phase 5 — regression gates and static audits (G5)

목적:

- 회귀를 자동으로 막는다.

파일:

- `BuilderCanvas.projection.static.test.ts`
- `skiaFramePipeline.static.test.ts`
- `canonicalMutations.projectedIdGuard.test.ts`
- `pageFrameBinding.roundtrip.test.ts`
- `resolveCanvasInteractionTarget.test.ts`
- `resolveCanonicalMutationTarget.test.ts`
- `frameElementScope.test.ts`
- `frameActions.indexSync.test.ts`
- `elementUpdate.atomicity.test.ts`
- `usePageManager.pageCreation.test.tsx`

Grep/static gate:

```bash
rg "::page-frame::" apps/builder/src packages/shared/src
```

허용:

- projection ID 생성/parse helper
- resolver tests
- dev assert tests

금지:

- canonical mutation target write
- history payload write
- IndexedDB document persistence adapter write

Additional regression gates:

- `frameElementScope`는 `node.props` truthiness만으로 Slot inclusion을 결정하지 않는다.
- frame mutation path는 canonical document update 후 stale `elementsMap` / `childrenMap`을 그대로 노출하지 않는다.
- `updateElement` canonical sync는 set callback 밖 stale `updatedElement`를 authoritative write source로 사용하지 않는다.
- layout-bound page creation은 `activatePage`를 중복 호출하지 않는다.
- 기존 canonical mutation suite (`elementCanonicalMutation.test.ts`, `elementCreationCanonical.test.ts`, `canonicalMutations.test.ts` 등)가 mirror sync / atomicity 변경 후에도 PASS — Phase 4/5 변경이 기존 mutation contract을 깨지 않는다.

Gate G5:

- targeted Vitest PASS.
- negative fixture에서 projected ID canonical mutation 시도 FAIL 확인.
- props-less Slot scope, mirror sync, canonical atomicity, page activation regression PASS.
- type-check PASS.

### Phase 6 — browser smoke and refresh hydration (G6)

목적:

- 사용자 증상 경로를 실제 Builder에서 검증한다.

Smoke 시나리오:

1. Frames 탭에서 Frame 생성.
2. `header/content/footer` Slot 추가.
3. Page에 Frame 적용.
4. 각 Slot에 page-owned element 배치.
5. 각 element 선택 가능 확인.
6. Frame 적용 Page의 projected Slot chrome 영역을 클릭해도 Page/body fallback selection이 유지되는지 확인.
7. Slot guard 표시 확인.
8. element를 Slot 간 이동.
9. Frame 적용 해제 → 재적용. 이때 drag했던 element가 이전 Page가 아니라 Frame 적용 해제한 Page에 남아있는지 확인.
10. Frame 적용 Page의 projected Slot 영역이 drop target으로 잡히는지 확인.
11. 브라우저 새로고침.
12. Skia 화면, Layer tree, IndexedDB `documents`의 descendants path 비교.
13. Dev snapshot에서 canonical document와 `elementsMap` / `childrenMap`의 frame-bound children 정합 확인.
14. props 없는 Slot fixture가 refresh 전후 모두 Skia와 frame scope에 남아있는지 확인.

Gate G6:

- selection PASS.
- Frame 적용 Page body/page fallback selection PASS.
- Slot visibility PASS.
- drag/drop PASS.
- projected Slot drop target PASS.
- drag 후 frame unapply page ownership PASS.
- refresh hydration PASS.
- console/page/http error 0.
- document JSON에 `::page-frame::` 0건.
- canonical document와 derived mirror/index divergence 0건.
- page creation activation 중복 호출 0건.

## 4. Test Matrix

| 증상                           | 테스트                                                                              | 통과 조건                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| element 선택 안 됨             | `resolveCanvasInteractionTarget.test.ts`                                            | projected Slot/child hit가 selection-safe target으로 변환                                   |
| helper guard 안 뜸             | `resolveCanvasInteractionTarget.test.ts`                                            | projected Slot hit가 `slot-guard` 반환                                                      |
| Slot 사라짐                    | `pageFrameBinding.roundtrip.test.ts`                                                | apply/remove/apply 후 descendant paths 보존                                                 |
| props 없는 Slot host 사라짐    | `frameElementScope.test.ts`                                                         | Slot host inclusion이 `node.props` 존재 여부에 의존하지 않음                                |
| drag/drop 후 refresh 깨짐      | `resolveCanonicalMutationTarget.test.ts` + browser smoke                            | canonical document에 synthetic ID 0건                                                       |
| map split-brain 재발           | `BuilderCanvas.projection.static.test.ts`                                           | interaction path의 `sceneNodesMap` 사용 차단                                                |
| render path 회귀               | `createSkiaRendererInput.test.ts`                                                   | projected Slot ID가 render/interaction map에 존재                                           |
| frame mutation 후 stale mirror | `frameActions.indexSync.test.ts`                                                    | canonical document와 `elementsMap` / `childrenMap`이 같은 frame-bound tree를 노출           |
| canonical update patch loss    | `elementUpdate.atomicity.test.ts`                                                   | 연속 update 후 canonical document와 legacy mirror가 같은 latest element snapshot 보유       |
| page activation race           | `usePageManager.pageCreation.test.tsx`                                              | layout-bound page 생성 시 activation 1회                                                    |
| refresh 후 mirror synthetic    | `usePageManager.canonical.test.ts` + `elementLoader.static.test.ts` + browser smoke | bootstrap/lazy-load hydrate source가 canonical traversal이고 `elementsMap` synthetic ID 0건 |

## 5. Implementation Guardrails

- `CanvasSceneNode.projection`은 runtime-only다. canonical node props/metadata에 저장하지 않는다.
- `::page-frame::` substring guard는 mutation boundary와 persistence test에 둔다.
- pointer move hot path는 `CompositionDocument` traversal을 하지 않는다.
- `pageFrameBinding` roundtrip helper는 `RefNode.descendants` boundary 파일에 격리한다.
- `usePageManager.initializeProject()`와 `elementLoader`는 store mirror hydrate source로 `canonicalDocumentToElements()`만 사용한다. `deriveProjectRenderModelFromDocument().elements`는 render/read model 전용이다.
- fallback Slot policy는 silent fallback 금지. unmatched fallback은 dev warning + fixture로 고정한다.
- Slot host scope inclusion은 `props` 유무와 독립적이어야 한다.
- canonical-derived hook/cache는 doc reference만으로 invalidation하지 않는다. `documentVersion` 또는 동등한 mutation counter를 함께 사용한다.
- Frame mutation 뒤 legacy mirror를 유지해야 하는 동안에는 canonical mutation과 index rebuild 순서를 같은 boundary에 둔다.
- canonical write path는 stale pre-callback element snapshot을 authoritative source로 쓰지 않는다.
- 기존 dirty project data migration은 작성하지 않는다. 발견 시 dev audit helper로 repair하고 fixture만 갱신한다.

## 6. Verification Commands

Targeted tests:

```bash
pnpm -F @composition/builder test -- src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts
pnpm -F @composition/builder test -- src/builder/workspace/canvas/skia/skiaFramePipeline.static.test.ts
pnpm -F @composition/builder test -- src/builder/workspace/canvas/interaction/__tests__/resolveCanvasInteractionTarget.test.ts
pnpm -F @composition/builder test -- src/builder/workspace/canvas/interaction/__tests__/resolveCanonicalMutationTarget.test.ts
pnpm -F @composition/builder test -- src/adapters/canonical/__tests__/canonicalMutations.projectedIdGuard.test.ts
pnpm -F @composition/builder test -- src/adapters/canonical/__tests__/pageFrameBinding.roundtrip.test.ts
pnpm -F @composition/builder test -- src/adapters/canonical/__tests__/frameElementScope.test.ts
pnpm -F @composition/builder test -- src/builder/stores/utils/__tests__/frameActions.indexSync.test.ts
pnpm -F @composition/builder test -- src/builder/stores/utils/__tests__/elementUpdate.atomicity.test.ts
pnpm -F @composition/builder test -- src/builder/hooks/__tests__/usePageManager.pageCreation.test.tsx
pnpm -F @composition/builder test -- src/builder/workspace/canvas/renderers/__tests__/createSkiaRendererInput.test.ts
```

Type and preflight:

```bash
pnpm run codex:typecheck
pnpm run codex:preflight
```

Browser verification:

```bash
pnpm -F @composition/builder dev --host 127.0.0.1
```

Then run authenticated browser smoke for Phase 6 scenario.

## 7. Completion Criteria

ADR-135 can move from In Progress to Implemented only when:

- G1-G6 all pass.
- targeted tests and type-check pass.
- browser smoke confirms selection/slot visibility/drag/drop/refresh hydration.
- `documents` JSON and history payload contain 0 projected render IDs.
- frame scope, canonical document, and derived mirror/index convergence tests pass.
- known adjacent races R8-R12 are fixed in this ADR execution or explicitly split into a follow-up ADR before Implemented promotion.
- README and `docs/CHANGELOG.md` record implementation completion in the same commit or immediately following commit.
