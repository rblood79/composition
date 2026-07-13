# Workspace Scene Runtime Breakdown

## Purpose

이 문서는 [ADR-037](../completed/037-workspace-scene-runtime-rearchitecture.md)을
실행 가능한 작업 단위로 분해한 상세 플랜이다.

목표는 다음과 같다.

- `ADR-035` 이후 남아 있는 scene/interaction/renderer 경계 문제를 해소
- `SceneSnapshot` 중심 구조로 점진 전환
- phase별 파일 변경 경계, 검증 기준, 롤백 기준 명확화

2026-03-13 기준으로 본 문서의 Phase 0~6은 모두 구현 완료되었다.

---

## Success Criteria

ADR-037이 완료되면 아래 조건을 만족해야 한다.

1. `BuilderCanvas`는 상위 orchestration만 담당한다.
2. scene 파생 데이터는 `SceneSnapshot`에서 공급된다.
3. selection bounds 계산 경로가 1개다.
4. pointer session이 `drag/resize/lasso` 상태를 단일 모델로 관리한다.
5. Skia/Pixi renderer는 store를 직접 읽지 않는다.
6. `canvasSync`는 viewport/lifecycle/metrics로 분리된다.

---

## Execution Strategy

### 의존 관계

```text
Phase 0
  ├─→ Phase 1 (SceneSnapshot Foundation)
  ├─→ Phase 2 (SelectionModel / PointerSession)
  ├─→ Phase 3 (Renderer Input Contract)
  │         └─→ Phase 4 (Incremental Layout / Multi-Level Culling)
  └─→ Phase 5 (canvasSync Split)
                     └─→ Phase 6 (Legacy Cleanup)
```

### 실행 원칙

1. Phase당 1커밋 원칙
2. 기존 동작 보존 우선, 동작 변경 금지
3. extract-only와 logic change를 섞지 않음
4. 각 phase는 `ADR-037 Phase 0`의 checklist를 통과해야 함
5. renderer direct store access는 새 코드에서 금지

---

## Phase별 현황

| Phase | 설명                               | 위험 | 예상 효과                    | 핵심 산출물                           | 상태              |
| :---: | ---------------------------------- | :--: | ---------------------------- | ------------------------------------- | ----------------- |
|   0   | Baseline & Budget                  |  L   | 회귀 감지 기반 확보          | baseline 문서, metrics budget         | 완료 (2026-03-13) |
|   1   | SceneSnapshot Foundation           |  M   | scene 파생 데이터 수렴       | `buildSceneSnapshot`, snapshot types  | 완료 (2026-03-13) |
|   2   | SelectionModel / PointerSession    |  M   | 입력 경계 명확화, 중복 제거  | `selectionModel`, `pointerSession`    | 완료 (2026-03-13) |
|   3   | Renderer Input Contract            |  M   | Skia/Pixi 입력 단일화        | snapshot adapter, invalidation packet | 완료 (2026-03-13) |
|   4   | Incremental Layout / Multi-Culling |  H   | 대형 문서 성능 향상          | subtree cache, group culling          | 완료 (2026-03-13) |
|   5   | canvasSync Split                   |  M   | 핫패스 상태와 metrics 분리   | 3개 store 분리                        | 완료 (2026-03-13) |
|   6   | Legacy Cleanup                     |  M   | old/new 경로 제거, 구조 수렴 | legacy helper 제거, import 정리       | 완료 (2026-03-13) |

---

## Phase 1. SceneSnapshot Foundation

### 목표

- `BuilderCanvas`에서 흩어진 scene 파생 계산을 snapshot으로 수렴

### 신규 파일

```text
apps/builder/src/builder/workspace/canvas/scene/
  sceneSnapshotTypes.ts
  buildSceneSnapshot.ts
  buildSceneIndex.ts
  buildSelectionSnapshot.ts
  buildVisiblePageSet.ts
  index.ts
```

### 최초 이관 대상

- `pageFrames`
- `visiblePageIds`
- `allPageData`
- `selectionBounds`의 읽기 모델

### 유지할 legacy 경로

- full tree layout 계산 자체
- existing `ElementsLayer` 렌더 path
- existing `SelectionLayer` 표시 path

### 검증 포인트

- UI 동작 동일
- `BuilderCanvas` 내부 `useMemo` 수 감소
- snapshot이 `pageFrames`/`visiblePageIds` 공급

---

## Phase 2. SelectionModel / PointerSession

### 목표

- selection bounds, handle hit test, body hit test, drag session을 단일화

### 신규 파일

```text
apps/builder/src/builder/workspace/canvas/interaction/
  selectionModel.ts
  pointerSession.ts
  pointerRouter.ts
  dragSession.ts
  resizeSession.ts
  lassoSession.ts
  index.ts
```

### 이관 대상

- `computeSelectionBoundsForHitTest`
- `SelectionLayer` 내부 bounds 계산
- `useCentralCanvasPointerHandlers`
- drag start/end 상태 전이

### 임시 허용

- actual mutation은 기존 store action 사용
- resize/drag apply 로직은 기존 helper 재사용

### 검증 포인트

- selection bounds 계산 경로 1개
- pointerdown effect 복잡도 감소
- drag/resize/lasso session 명시화

---

## Phase 3. Renderer Input Contract

### 목표

- renderer가 snapshot과 invalidation packet만 소비하게 전환

### 신규 파일

```text
apps/builder/src/builder/workspace/canvas/renderers/
  rendererInput.ts
  invalidationPacket.ts
```

### 이관 대상

- `SkiaOverlay` 내부 `useStore.getState()` 직접 읽기 경로
- frame build 입력 조합
- overlay/content invalidation 판단 표준화

### 검증 포인트

- renderer direct store access 제거
- `overlayVersionRef` 증가 이유가 packet으로 추적 가능

---

## Phase 4. Incremental Layout / Multi-Level Culling

### 목표

- page 전체 재계산 빈도를 줄이고 대형 문서 처리 비용을 낮춤

### 신규 파일

```text
apps/builder/src/builder/workspace/canvas/scene/
  layoutCache.ts
  cullingCache.ts
  subtreeInvalidation.ts
```

### 구현 축

1. page culling
2. group/subtree culling
3. element final culling
4. dirty subtree 기반 레이아웃 patch

### 검증 포인트

- `getBounds()` fallback 의존도 감소
- page recompute 빈도 감소
- large multi-page 시 FPS 방어

---

## Phase 5. canvasSync Split

### 목표

- viewport/lifecycle/metrics를 분리하여 구독 경계 정리

### 신규 파일

```text
apps/builder/src/builder/workspace/canvas/stores/
  viewportSync.ts
  canvasLifecycle.ts
  canvasMetrics.ts
  index.ts
```

### 기존 파일 처리

- `canvasSync.ts`는 deprecate 후 adapter 또는 barrel로 축소

### 검증 포인트

- metrics 업데이트가 viewport 구독자를 깨우지 않음
- authoritative viewport 경로 명확

---

## Phase 6. Legacy Cleanup

### 목표

- old/new 공존 구간 제거

### 제거 후보

- duplicated selection bounds helper
- legacy page data memo
- renderer 내부 fallback store reads
- `canvasSync.ts` compatibility layer

### 검증 포인트

- import graph 단순화
- target architecture와 실제 구조 일치

---

## File Mapping

| 현재 파일                                                                                                                                              | 문제                                  | ADR-037 이후 주 소유자                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------- |
| [BuilderCanvas.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx)                                         | 엔트리 + 파생 계산 + interaction 혼합 | shell/orchestrator                     |
| legacy page data memo 경로                                                                                                                             | page data 파생이 hook 내부에 고정됨   | `scene/buildSceneSnapshot.ts`          |
| [SelectionLayer.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx)                             | selection bounds 계산과 view가 결합됨 | `interaction/selectionModel.ts` + view |
| [useCentralCanvasPointerHandlers.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts) | 거대 effect 기반 입력 처리            | `interaction/pointerRouter.ts`         |
| [SkiaOverlay.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx)                                        | ticker 내부 store 직접 접근           | renderer adapter + snapshot input      |
| [canvasSync.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/canvasSync.ts)                                                 | 핫패스 상태와 metrics 혼합            | `stores/*` 3분할                       |

---

## Recommended Commit Order

1. `docs: add ADR-037 execution breakdown`
2. `refactor: add scene snapshot types and builder`
3. `refactor: route page frame and visible page data through scene snapshot`
4. `refactor: introduce selection model and pointer session`
5. `refactor: move renderer inputs to snapshot adapters`
6. `refactor: split canvas sync stores`
7. `refactor: remove legacy workspace runtime paths`

---

## Test / Verification Matrix

| 영역            | 테스트 방식                                | 필수 여부 |
| --------------- | ------------------------------------------ | --------- |
| Scene snapshot  | unit test for derived data builder         | 필수      |
| Selection model | unit test for bounds + handle/body hit     | 필수      |
| Pointer session | unit test for state transition             | 필수      |
| Builder canvas  | manual verification checklist              | 필수      |
| Renderer input  | dev debug trace + manual visual regression | 필수      |
| Store split     | type-check + selector impact review        | 필수      |

---

## Non-Goals

이번 breakdown은 아래를 포함하지 않는다.

- 새 저장 포맷 도입
- 완전한 renderer 교체
- worker 기반 전체 렌더 파이프라인 재구축
- 텍스트 편집 기능 확장
