# ADR-037: Workspace Scene Runtime 재구성 — Scene Snapshot, Invalidation Matrix, Interaction Model 분리

## Status

Implemented (2026-03-13) — Phase 0~6 구현 완료

## Date

2026-03-13

## Decision Makers

composition Team

## Related ADRs

- [ADR-003](003-canvas-rendering.md): PixiJS Canvas Rendering
- [ADR-008](008-layout-engine.md): 캔버스 레이아웃 엔진 전환
- [ADR-009](009-full-tree-wasm-layout.md): Figma-Class Rendering & Layout
- [ADR-012](012-rendering-layout-pipeline-hardening.md): 렌더링/레이아웃 파이프라인 하드닝
- [ADR-035](035-workspace-canvas-refactor.md): Workspace Canvas Runtime 리팩토링
- [ADR-037 Phase 0](037-phase-0-baseline.md): Behavioral Baseline & Performance Budget

---

## Context

`apps/builder/src/builder/workspace`는 `ADR-035`를 통해 1차 구조 정리를 거쳤지만,
핵심 런타임은 여전히 아래 문제를 남기고 있다.

### 문제 1. 상위 엔트리에서 파생 계산과 입력 오케스트레이션이 과도하게 결합됨

현재 [BuilderCanvas.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx)는 다음 책임을 동시에 가진다.

- store 구독 조합
- page/frame 파생 데이터 계산
- drag/resize/lasso orchestration
- 중앙 pointer router
- Pixi Application 초기화
- Skia overlay 연결
- overlay/text edit/debug 표시

이 구조는 작은 상태 변경이 상위 컴포넌트 재평가로 번지기 쉽고,
핫패스 로직을 국소적으로 개선하기 어렵다.

### 문제 2. Scene 파생 데이터가 React 렌더 시점에 재계산됨

[ElementsLayer.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/components/ElementsLayer.tsx),
legacy page data memo 경로,
[SelectionLayer.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx)에서는
각각 다음 계산이 분산되어 있다.

- `pageChildrenMap`
- `depthMap`
- `sortedElements`
- `visiblePageIds`
- `fullTreeLayoutMap`
- selection bounds

이 계산들은 실제로는 하나의 scene graph에서 파생되는 값이지만,
컴포넌트별 `useMemo`에 흩어져 있어 invalidation 기준이 제각각이다.

### 문제 3. Interaction 모델과 Selection 모델의 단일 원천이 없음

현재 선택 박스 바운드는 최소 두 경로에서 계산된다.

- [BuilderCanvas.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx)의 `computeSelectionBoundsForHitTest`
- [SelectionLayer.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx)의 `computeSelectionBounds`

또한 pointerdown, drag session, handle hit test, body hit test가
[useCentralCanvasPointerHandlers.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts)에
결합되어 있어 입력 정책 변경 시 회귀 위험이 높다.

### 문제 4. Skia 렌더 루프가 사실상 두 번째 상태 시스템이 됨

[SkiaOverlay.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx)는
ticker 내부에서 `useStore.getState()`를 반복 호출하고,
`overlayVersionRef`를 수동으로 증가시키며,
[skiaFramePipeline.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/skia/skiaFramePipeline.ts)도
프레임마다 store를 직접 다시 읽는다.

결과:

- renderer 입력 계약이 불명확하다.
- 어떤 상태 변화가 overlay/content rebuild를 유발하는지 추적이 어렵다.
- React 밖에서 별도 상태 머신이 성장하고 있다.

### 문제 5. canvasSync가 핫패스 상태와 진단 상태를 함께 담음

[canvasSync.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/canvasSync.ts)는
viewport mirror, lifecycle flag, GPU metrics를 함께 관리한다.

결과:

- viewport 구독자와 metrics 구독자의 관심사가 섞인다.
- 디버그 메트릭 갱신이 핫패스 상태 모델과 같은 storage를 공유한다.

### 문제 6. 컬링과 레이아웃이 여전히 페이지 전체 단위로 재평가되는 구간이 남아 있음

[useViewportCulling.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/hooks/useViewportCulling.ts)는
fallback 경로에서 O(N) `getBounds()` 필터링을 수행하며,
`ElementsLayer`는 페이지 단위 full-tree layout 결과를 다시 만들 수 있다.

대형 문서에서는 incremental layout/subtree cache/group culling이 필요하다.

### Hard Constraints

1. 기존 편집 UX를 깨지 않는다.
2. 저장 포맷, element schema, page schema는 변경하지 않는다.
3. compare mode, text edit, workflow overlay, multi-page는 유지한다.
4. Pixi 입력 + Skia 렌더 조합은 즉시 폐기하지 않는다.
5. 단계별 롤백 가능해야 한다.
6. Phase별 성능 gate를 통과하지 못하면 merge하지 않는다.

---

## Alternatives Considered

### 대안 A. 현 구조 유지 + hot function 미세 최적화

- 설명: `useMemo`, 캐시, selector 최적화만 추가한다.
- 위험: 기술(L) / 성능(M) / 유지보수(H) / 마이그레이션(L)

장점:

- 빠르게 일부 수치를 개선할 수 있다.
- 구현 리스크가 작다.

단점:

- scene graph 부재와 입력 모델 분산을 해결하지 못한다.
- 같은 계산이 다른 계층에서 반복되는 구조는 유지된다.
- 다음 기능 추가 시 다시 같은 병목이 발생한다.

### 대안 B. Pixi 또는 Skia 단일 엔진으로 즉시 전환

- 설명: 입력/렌더러를 하나의 엔진으로 통합 재구축한다.
- 위험: 기술(H) / 성능(H) / 유지보수(M) / 마이그레이션(H)

장점:

- 이상적인 단일 파이프라인을 설계할 수 있다.

단점:

- 현 시점의 회귀 위험이 지나치게 크다.
- `ADR-035`의 동작 보존 원칙과 충돌한다.
- 완료까지 긴 시간 동안 기능 개발이 멈춘다.

### 대안 C. Scene Snapshot 중심 후속 구조 재설계

- 설명: 기존 렌더러 조합은 유지하되, 렌더러 앞단에 versioned scene snapshot 계층을 도입한다.
- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(M)

장점:

- 입력, scene 파생 계산, 렌더러 소비 경계를 명확히 할 수 있다.
- incremental layout/culling 최적화의 발판이 된다.
- Pixi/Skia를 동시에 유지하면서도 중복 계산을 줄일 수 있다.

단점:

- 과도기에는 legacy 계산 경로와 new snapshot 경로가 공존한다.
- phase 설계와 gate 관리가 필요하다.

### Risk Threshold Check

- 대안 A는 유지보수 위험이 HIGH이므로 임시 처방에 가깝다.
- 대안 B는 현재 제약에서 허용 가능한 위험 한도를 넘는다.
- 대안 C는 단계적 전환과 gate 기반 검증이 가능하다.

---

## Decision

**대안 C**를 채택한다.

즉, `workspace` 후속 리팩토링은 `ADR-035`의 “구조 분해”를 넘어서,
아래 다섯 축을 가진 **Scene Runtime Architecture**로 재구성한다.

1. `SceneSnapshot` 도입
2. `Invalidation Matrix` 명문화
3. `SelectionModel` / `PointerSession` 분리
4. renderer 입력 계약 단일화
5. `canvasSync` 관심사 분리

이번 ADR은 새 엔진을 도입하는 문서가 아니라,
기존 Pixi/Skia 조합 앞단의 상태/파생/입력 구조를 정리하는 설계 문서다.

---

## Target Architecture

### 1. Workspace Shell

책임:

- breakpoint → page size
- compare mode layout
- shell overlay 배치
- runtime mount/unmount

비책임:

- scene 파생 계산
- pointer session 상태 머신
- renderer invalidation 판단

### 2. Runtime Bootstrap

위치 제안:

- `workspace/canvas/runtime/`

책임:

- Pixi app lifecycle
- CanvasKit/WASM/font/image/theme bootstrap
- surface/context loss 관리

### 3. Scene Runtime

위치 제안:

- `workspace/canvas/scene/`

핵심 구조:

- `SceneSnapshot`
- `SceneIndex`
- `LayoutCache`
- `CullingCache`
- `SelectionSnapshot`

`SceneSnapshot`은 렌더러가 소비하는 단일 입력 계약이다.

예상 필드:

- `sceneVersion`
- `layoutVersion`
- `viewportVersion`
- `overlayVersion`
- `pageFrames`
- `visiblePageIds`
- `layoutMap`
- `treeBoundsMap`
- `selectionBounds`
- `workflowDerived`

원칙:

- React 렌더 중 ad-hoc 계산 금지
- 파생 데이터는 snapshot builder가 소유
- renderer는 snapshot을 읽기만 한다

### 4. Interaction Runtime

위치 제안:

- `workspace/canvas/interaction/`

핵심 구조:

- `PointerRouter`
- `PointerSession`
- `SelectionModel`
- `DragSession`
- `ResizeSession`
- `LassoSession`

원칙:

- pointer 이벤트 해석과 selection mutation을 분리한다.
- selection bounds는 `SelectionModel`이 단일 소스로 제공한다.
- hit test와 drag start 정책을 hook 단위 effect에 분산시키지 않는다.

### 5. Renderer Adapters

위치 제안:

- `workspace/canvas/renderers/pixi/`
- `workspace/canvas/renderers/skia/`

원칙:

- Pixi와 Skia는 둘 다 `SceneSnapshot`을 소비한다.
- renderer 내부에서 store 직접 조회 금지
- renderer는 invalidation packet과 snapshot version만 읽는다

### 6. Diagnostics

위치 제안:

- `workspace/canvas/diagnostics/`

책임:

- FPS/frame/build metrics
- invalidation trace
- debug overlay
- perf budget assertion

---

## Core Design Decisions

### Decision 1. SceneSnapshot을 도입한다

현재 `useMemo`와 `getState()`에 흩어진 파생 계산을
`buildSceneSnapshot()` 계층으로 수렴한다.

목표:

- page/frame/layout/tree/selection/workflow 파생값의 단일화
- content/overlay rebuild 기준 명확화
- renderer 입력 안정화

### Decision 2. Invalidation Matrix를 명시적으로 정의한다

기존의 `layoutVersion`, `registryVersion`, `overlayVersion`,
`pagePositionsVersion`을 그대로 두더라도,
각 version이 어떤 산출물에 영향을 주는지 표로 명시한다.

예시:

| 변경 원인                 | layoutMap | treeBounds | selection | workflow | content render | overlay render |
| ------------------------- | --------- | ---------- | --------- | -------- | -------------- | -------------- |
| element style 변경        | 재계산    | 재계산     | 재계산    | 경우별   | yes            | yes            |
| viewport pan/zoom         | no        | no         | no        | no       | no             | yes            |
| page position 변경        | no        | 재계산     | 재계산    | yes      | yes            | yes            |
| 선택 변경                 | no        | no         | 재계산    | no       | no             | yes            |
| workflow toggle/hover     | no        | no         | no        | 재계산   | no             | yes            |
| theme/font/image resource | 경우별    | 경우별     | no        | no       | yes            | yes            |

### Decision 3. SelectionModel을 도입한다

Selection 바운드 계산, selection handle hit test, body hit test를
하나의 모델에 모은다.

이 모델은 다음을 제공한다.

- `getSelectionBounds()`
- `hitTestHandle()`
- `hitTestSelectionBounds()`
- `resolveBodySelectionAtPoint()`

효과:

- SelectionLayer와 BuilderCanvas의 중복 계산 제거
- pointerdown 처리 경로 단순화
- 추후 multi-select, group selection 확장 용이

### Decision 4. PointerSession 기반 입력 상태 머신으로 전환한다

현재 `pointerdown + requestAnimationFrame + window pointermove/up` 조합을
session 객체로 캡슐화한다.

session 상태:

- `idle`
- `pending-select`
- `moving`
- `resizing`
- `lasso`
- `editing-blocked`

효과:

- 더블클릭, 텍스트 편집, 멀티셀렉트 modifier 처리의 우발적 결합 감소
- drag threshold, snap-to-grid, reorder drop target 정책 분리

### Decision 5. canvasSync를 세 개의 store로 나눈다

분리 대상:

- `viewportSyncStore`
- `canvasLifecycleStore`
- `canvasMetricsStore`

효과:

- 핫패스 구독과 디버그 메트릭 갱신 분리
- viewport authoritative/mirror 관계 명확화

### Decision 6. 컬링을 page → group → element 3단계로 재구성한다

현재 요소 단위 컬링만으로는 대형 문서에서 비용이 커진다.

새 구조:

1. page frame culling
2. layout group / subtree culling
3. element-level final culling

이 구조는 `ADR-012`의 dirty subtree 및 persistent tree 최적화와 자연스럽게 연결된다.

---

## Proposed Directory Shape

```text
apps/builder/src/builder/workspace/
  Workspace.tsx
  canvas/
    runtime/
      useCanvasRuntimeBootstrap.ts
      useCanvasSurfaceLifecycle.ts
      resourceBootstrap.ts
    scene/
      buildSceneSnapshot.ts
      sceneSnapshotTypes.ts
      sceneIndex.ts
      layoutCache.ts
      cullingCache.ts
      invalidationMatrix.ts
    interaction/
      pointerRouter.ts
      pointerSession.ts
      selectionModel.ts
      dragSession.ts
      resizeSession.ts
      lassoSession.ts
    renderers/
      pixi/
      skia/
    stores/
      viewportSync.ts
      canvasLifecycle.ts
      canvasMetrics.ts
    diagnostics/
      invalidationTrace.ts
      perfBudget.ts
```

---

## Implementation Status

2026-03-13 기준으로 `ADR-037`의 Phase 0~6은 모두 구현 완료되었다.

- `SceneSnapshot`/`SceneIndex`/`visiblePageIds` 파생 경로를 `scene/` 계층으로 이관
- `SelectionModel`/`PointerSession` 도입으로 selection bounds, hit test, pointer session 분리
- renderer 입력을 `rendererInput`/`invalidationPacket`으로 단일화하고 Skia 직접 store 조회 제거
- `layoutCache`/`cullingCache`/`subtreeInvalidation`으로 page dirty skip, top-level group culling, dirty subtree scope 연결
- `canvasSync`를 `viewportSyncStore`/`canvasLifecycleStore`/`canvasMetricsStore`로 분리
- legacy helper와 compatibility usage를 정리해 workspace 내부의 split store 전환 완료

본 문서의 Migration Plan은 설계 시점 기준 계획이었으며, 아래 항목은 모두 실행된 이력으로 간주한다.

---

## Migration Plan

### Phase 0. Baseline & Budget

- `ADR-037 Phase 0` 문서 작성
- 현행 시나리오 기준 성능 예산 수립
- `ADR-035` 수치와 비교 가능한 체크리스트 확보
- 완료 (2026-03-13)

### Phase 1. SceneSnapshot Foundation

- `buildSceneSnapshot()` 도입
- `pageFrames`, `visiblePageIds`, `selectionBounds`를 snapshot으로 이동
- `BuilderCanvas`는 snapshot builder 호출만 담당
- 완료 (2026-03-13)

### Phase 2. SelectionModel / PointerSession

- selection 관련 계산 단일화
- 중앙 pointerdown effect를 session 기반 router로 치환
- drag/resize/lasso ownership 분리
- 완료 (2026-03-13)

### Phase 3. Renderer Input Contract

- `SkiaOverlay`와 `ElementsLayer`가 store 직접 접근하지 않고 snapshot만 읽도록 전환
- renderer invalidation packet 정의
- 완료 (2026-03-13)

### Phase 4. Incremental Layout & Multi-Level Culling

- layout dirty subtree 계산 강화
- page/group/element 3단계 컬링 도입
- `ElementsLayer` full page recompute 범위 축소
- 완료 (2026-03-13)

### Phase 5. canvasSync Split

- viewport/lifecycle/metrics store 분리
- deprecated mirror setter 제거
- 완료 (2026-03-13)

### Phase 6. Legacy Path Cleanup

- 중복 selection bounds 계산 제거
- `useStore.getState()` ticker 직접 조회 경로 제거
- legacy helper 정리
- 완료 (2026-03-13)

---

## Gates

### G0. Behavioral Equivalence

아래 기능이 기존과 동일해야 한다.

- zoom/pan/fit/fill
- selection/lasso/resize
- text edit overlay
- workflow overlay
- compare mode
- multi-page page drag

### G1. Render Budget

대형 페이지 기준:

- 평균 FPS baseline 대비 5% 이상 악화 금지
- `contentRenderTimeMs` baseline 대비 10% 이상 악화 금지
- `skiaTreeBuildTimeMs` baseline 대비 10% 이상 악화 금지

### G2. Store Boundary

- renderer에서 app store 직접 조회 금지
- interaction session 외부에서 selection bounds 중복 계산 금지

### G3. Rollbackability

- phase당 1커밋 원칙
- phase별 feature flag 또는 명확한 이전 경로 유지

---

## Consequences

### Positive

- scene 파생 데이터의 단일 원천 확보
- renderer 입력 계약이 명확해짐
- interaction/selection 버그 추적 용이
- incremental layout/culling 최적화 기반 확보
- 대형 문서에서 구조적 성능 향상 가능

### Negative

- 초기 도입 비용이 있다.
- phase 전환 중 snapshot 경로와 legacy 경로가 공존할 수 있다.
- 일부 hook/컴포넌트 이름과 위치가 크게 바뀐다.

### Neutral

- Pixi + Skia 이중 구조는 당분간 유지한다.
- store schema와 저장 포맷은 유지한다.

---

## Out of Scope

- 저장 포맷/DB schema 변경
- 완전한 단일 엔진 전환
- React 외 별도 프로세스/worker로 전체 렌더러 이전
- 리치 텍스트 편집 고도화
- workflow 기능 자체의 UX 확장

---

## Open Questions

1. `SceneSnapshot` builder를 React hook으로 둘지, 순수 서비스 + adapter hook으로 둘지 결정 필요
2. `ElementsLayer`의 layout ownership을 snapshot builder가 전부 가져갈지, page renderer 단위 일부 계산을 남길지 결정 필요
3. SpatialIndex fast path를 selection hit test와 culling 양쪽에서 공용화할지 여부 검토 필요
4. Skia command stream 경로와 tree 경로를 언제 하나의 source로 수렴할지 후속 ADR 또는 Phase 4에서 판단 필요
