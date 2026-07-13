# ADR-049: Pencil 패턴 기반 Canvas Drag & Drop 정합성

## Status

**Accepted** — Phase A~D 구현 완료 + 후속 버그 수정 7건 (2026-04-01)

## Prerequisites

- [ADR-043](043-selection-drag-alignment.md) Phase 0~4 완료 — **이미 충족** (같은 부모 내 reorder, drop indicator, Escape 취소)
- [ADR-048](048-declarative-props-propagation.md) — 선언적 props 전파 엔진 (참조만, 직접 의존 아님)

## Related ADRs

- [ADR-043](043-selection-drag-alignment.md): Selection Drag Alignment — 본 ADR의 선행 인프라
- [ADR-040](040-visible-page-delta-runtime.md): Delta Runtime — elementsMap/childrenMap O(1) 인덱스

## Context

### 문제 발견 경위

WebGL 캔버스에서 요소 드래그&드롭 시 Pencil 앱 대비 3가지 핵심 기능이 부재/미완성:

1. **드롭 대상**: 같은 부모 내 reorder만 가능 — 다른 컨테이너로 reparent 불가
2. **드롭 위치 가이드**: 기본적인 파선 + 아웃라인만 존재 — 정밀한 삽입 위치 시각화 미흡
3. **부드러운 애니메이션**: 형제 요소가 즉시 snap — Pencil의 부드러운 전환 없음

### Pencil 레퍼런스 분석

Pencil에서는 드래그 중 다음 패턴을 사용한다:

```
1. drag start → 선택 요소가 "떠오름" (반투명, 마우스 따라 이동)
2. vacate → 원래 자리의 gap이 유지됨 (형제들은 아직 이동 안 함)
3. insertion → 마우스가 형제 사이로 이동하면 gap이 교체됨 (형제 애니메이션)
4. deferred commit → 실제 store mutation은 drop 시점에만 발생
5. cross-container → 다른 컨테이너로 reparenting 지원
```

- 드래그 중 store는 변경하지 않음 — 시각적 오프셋만 적용
- 형제 요소는 lerp 보간으로 ~133ms에 걸쳐 이동
- 항상 정확히 1개의 gap이 존재하며, 커서 이동에 따라 gap이 교체
- drop 시점에만 단일 commit (history entry 1개)

### composition 기존 상태 (수정 전)

| 영역                  | 방식                                          | 문제                                           |
| --------------------- | --------------------------------------------- | ---------------------------------------------- |
| **드래그 중 reorder** | `batchUpdateElementOrders()` 즉시 호출        | ADR-043 deferred commit 설계와 모순, 형제 snap |
| **형제 애니메이션**   | 없음 (`computeSiblingOffsets()` 미사용)       | 즉시 store mutation → 레이아웃 재계산 → snap   |
| **드롭 대상**         | 드래그 요소의 parent만 탐색                   | cross-container 불가                           |
| **드롭 인디케이터**   | 파선 삽입 라인 + 컨테이너 아웃라인            | 반투명 배경 없음, 끝점 원 없음                 |
| **좌표계**            | `getElementBoundsSimple` (PixiJS global 좌표) | zoom/pan 포함 → 씬 좌표와 불일치               |
| **dead zone**         | Y축만 체크                                    | 가로 컨테이너에서 영원히 갇힘                  |

### 이미 구현된 인프라 (미연결 상태)

ADR-043 구현 시 deferred-drop 패턴용 인프라가 이미 만들어졌으나 한 번도 연결되지 않았다:

| 함수                      | 파일                  | 상태                          |
| ------------------------- | --------------------- | ----------------------------- |
| `setDragVisualOffset()`   | nodeRendererTree.ts   | export됨, 호출처 없음         |
| `setDragSiblingOffsets()` | nodeRendererTree.ts   | export됨, 호출처 없음         |
| `getDragVisualOffset()`   | nodeRendererTree.ts   | renderCommands.ts에서 사용 ✅ |
| `_getSiblingOffset()`     | nodeRendererTree.ts   | private, 렌더링에서 미사용    |
| `computeSiblingOffsets()` | dropTargetResolver.ts | export됨, 호출처 없음         |

### 근본 원인

드래그 **중에** `batchUpdateElementOrders()`로 즉시 store mutation 수행 + `dropIndicatorSnapshotRef` 브릿지 미생성으로 형제 오프셋 애니메이션 파이프라인 전체가 비활성.

## Decision

**ADR-043의 deferred-commit 설계를 완성하고, Pencil과 동일한 시각적 경험을 구현한다.**

### 핵심 원칙

```
드래그 중: 시각적 오프셋만 (store 변경 금지)
  → setDragVisualOffset: 드래그 요소 위치 (globalThis)
  → setDragSiblingOffsets: 형제 vacate/insertion 오프셋 (globalThis)
  → dragAnimator: lerp 보간 (~133ms @60fps)
  → dropIndicator: Skia 오버레이 렌더링

드롭 시: 단일 커밋
  → computeReorderFromDropTarget (same-parent)
  → moveElementToContainer (cross-container)
  → 단일 history entry
  → DB persist (백그라운드)
```

## Design

### 1. Deferred Commit 아키텍처 (Phase A)

#### 역할 분담: 시각적 오프셋 vs Store 커밋

- **시각적 오프셋 경로** (드래그 중): `setDragVisualOffset` + `setDragSiblingOffsets` → renderCommands.ts에서 `canvas.translate()` 적용. Store 변경 없음.
- **Store 커밋 경로** (드롭 시): `computeReorderFromDropTarget` → `batchUpdateElementOrders` 또는 `moveElementToContainer`. 단일 history entry.

#### 좌표계 규칙 (CRITICAL)

드래그 좌표 비교에 사용하는 bounds source:

| Source                                            | 좌표계                                            | 용도                                       |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| `getSceneBounds()` (renderCommands boundsMap)     | **씬 좌표** (zoom/pan 미포함, 페이지 오프셋 포함) | drop target resolver, dead zone ✅         |
| `getElementBoundsSimple()` (layoutBoundsRegistry) | **PixiJS global 좌표** (zoom/pan 포함)            | selection overlay 전용 ❌ drag에 사용 금지 |
| `screenToViewportPoint()` (커서 위치)             | **씬 좌표**                                       | 드래그 포인터 ✅                           |

**금지**: `getElementBoundsSimple`을 드래그/드롭 좌표 비교에 사용 — PixiJS Camera의 zoom/scale 변환이 포함되어 씬 좌표와 불일치.

#### Dead Zone 규칙 (가로/세로 컨테이너)

```typescript
// 첫 번째 resolve 전에는 방향을 모르므로 dead zone 스킵
const prevTarget = lastResolvedDropTargetRef.current;
if (prevTarget) {
  // prevTarget.isHorizontal로 올바른 축 결정
  const isHz = prevTarget.isHorizontal;
  // ...dead zone 체크
}
// prevTarget이 null이면 dead zone 없이 즉시 resolve
```

- `isHorizontal ?? false` 패턴 사용 금지 — 가로 컨테이너 첫 드래그 시 Y축 고정으로 resolve 불가
- 반드시 `prevTarget` 존재 여부를 먼저 확인한 후 dead zone 적용

#### SelectionLayer onDragUpdate 흐름

```
1. setDragVisualOffset(draggedId, delta.x, delta.y)
2. dead zone 체크 (prevTarget이 있을 때만)
3. resolveDropTarget(scenePoint, draggedId, store, hitTestFn)
4. computeSiblingOffsets(resolved, draggedId, store) → offsets
5. updateAnimationTargets(offsets)  // dragAnimator
6. dropIndicatorSnapshotRef.current = snapshot
7. lastResolvedDropTargetRef.current = resolved
```

#### SelectionLayer onMoveEnd 흐름

```
1. 최종 target/snapshot 읽기 (clear 전)
2. clearAllAnimations() + setDragVisualOffset(null) + setDragSiblingOffsets(null)
3. Store 커밋:
   - isReparent → moveElementToContainer()
   - !isAdjacentInsertion → computeReorderFromDropTarget() → batchUpdateElementOrders()
4. history + DB persist
```

### 2. Vacate + Insertion 오프셋 알고리즘

```typescript
// computeSiblingOffsets (dropTargetResolver.ts)
// 형제 배열: 드래그 요소 제외
for (let i = 0; i < siblings.length; i++) {
  const oi = sortedChildren.findIndex((c) => c.id === siblings[i].id); // 원래 인덱스

  // vacate: 원래 위치 이후 형제 → gap close (-dragSize)
  const closeGap = oi > origIdx ? -dragSize : 0;

  // insertion: 삽입 위치 이후 형제 → make space (+dragSize)
  const makeSpace = i >= insertionIndex ? dragSize : 0;

  // 합산: gap이 원래 위치에서 삽입 위치로 "교체"
  const total = closeGap + makeSpace;
  if (total !== 0) {
    offsets.set(sibling.id, {
      dx: isHorizontal ? total : 0,
      dy: isHorizontal ? 0 : total,
    });
  }
}
```

**동작 예시** — [A, B*, C, D, E] (B 드래그, C와 D 사이로 이동):

| 형제 | vacate (oi>1) | insertion (i>=2) | 합산  | 효과                  |
| ---- | :-----------: | :--------------: | :---: | --------------------- |
| A    |       0       |        0         |   0   | 고정                  |
| C    |     -size     |        0         | -size | 왼쪽 이동 (gap close) |
| D    |     -size     |      +size       |   0   | 고정                  |
| E    |     -size     |      +size       |   0   | 고정                  |

결과: `[A] [C←] [gap] [D] [E]` — B\*가 gap 위치에 floating

### 3. Spring Interpolation 시스템 (Phase B)

**파일**: `dragAnimator.ts`

```typescript
const LERP_FACTOR = 0.15; // 프레임당 15% → ~8프레임(~133ms @60fps)
const SNAP_THRESHOLD = 0.5; // 0.5px 이하면 즉시 snap

// 모듈 스코프 상태 (React state 아님, 리렌더링 없음)
const animatedOffsets = new Map<string, AnimatedOffset>();
```

| 함수                              | 호출자                          | 역할                                |
| --------------------------------- | ------------------------------- | ----------------------------------- |
| `updateAnimationTargets(targets)` | SelectionLayer.onDragUpdate     | 목표 오프셋 설정                    |
| `tickAnimations(): boolean`       | SkiaOverlay RAF                 | 매 프레임 lerp 보간, `true`=진행 중 |
| `getInterpolatedOffsets(): Map`   | SkiaOverlay RAF                 | 현재 보간 값 반환                   |
| `clearAllAnimations()`            | SelectionLayer.onMoveEnd/Cancel | 즉시 초기화                         |

#### SkiaOverlay RAF 연동

```typescript
// SkiaOverlay.tsx RAF 루프
const dropIndicator = dropIndicatorSnapshotRef?.current ?? null;
if (dropIndicator) {
  const stillAnimating = tickAnimations();
  const interpolated = getInterpolatedOffsets();
  setDragSiblingOffsets(interpolated.size > 0 ? interpolated : null);
  if (stillAnimating) notifyLayoutChange(); // 다음 프레임 요청
}
```

### 4. renderCommands.ts 오프셋 적용 (Phase A)

```typescript
// ELEMENT_BEGIN 처리
const dragOff = getDragVisualOffset();
const hasDragOffset = dragOff !== null && cmd.elementId === dragOff.elementId;
const sibOff = !hasDragOffset ? getSiblingOffset(cmd.elementId) : undefined;
const dox = hasDragOffset ? dragOff.dx : (sibOff?.dx ?? 0);
const doy = hasDragOffset ? dragOff.dy : (sibOff?.dy ?? 0);

canvas.translate(cmd.x + dox, cmd.y + doy);

// 드래그 요소 반투명 (alpha 0.5)
if (hasDragOffset) {
  const alphaPaint = new ck.Paint();
  alphaPaint.setAlphaf(0.5);
  canvas.saveLayer(alphaPaint);
  alphaPaint.delete();
}
```

### 5. Drop Indicator 개선 (Phase C)

| 항목          | Before               | After                      |
| ------------- | -------------------- | -------------------------- |
| 컨테이너 배경 | 없음                 | 반투명 fill (alpha 0.06)   |
| 아웃라인 두께 | 3/zoom               | 2/zoom                     |
| 아웃라인 색상 | blue-500 (alpha 1.0) | blue-500 (alpha 0.8)       |
| 삽입 라인     | 파선 (dash 8/zoom)   | 실선 (2/zoom)              |
| 라인 끝점     | 없음                 | 양끝 원형 노드 (3/zoom)    |
| 라인 캡       | 기본                 | `StrokeCap.Round`          |
| 드래그 요소   | 불투명               | 50% 투명 (saveLayer alpha) |
| reparent 모드 | 없음                 | green-500 색상 구분        |

### 6. Cross-Container Reparenting (Phase D)

#### DropTarget 타입 확장

```typescript
export interface DropTarget {
  containerId: string;
  insertionIndex: number;
  isAdjacentInsertion: boolean;
  isHorizontal: boolean;
  containerBounds: ElementBounds;
  siblingBounds: ElementBounds[];
  isReparent: boolean; // 신규
  originalParentId?: string; // reparent 시 원래 부모
}
```

#### resolveDropTarget 확장 — 3단계 우선순위

```typescript
export function resolveDropTarget(scenePoint, draggedElementId, store, hitTestFn?) {
  // 1. 같은 부모 내 reorder (기존 로직)
  const sameParentResult = ...;

  // 2. cursorOutsideParent 판단 (현재 부모 bounds 밖인지)
  const cursorOutsideParent = ...;

  // 3. hitTestFn으로 cross-container 후보 탐색
  if (crossResult) {
    // 커서가 부모 밖이거나 same-parent가 인접 삽입이면 cross 우선
    if (cursorOutsideParent || sameParentResult.isAdjacentInsertion) return crossResult;
  }

  // 4. 조부모 fallback — 커서가 부모 밖인데 cross도 없으면 (그룹에서 꺼내기)
  //    body 같은 root 컨테이너는 hitTest에서 제외되므로 직접 조부모 탐색
  if (cursorOutsideParent && parent.parent_id) {
    return reparentToGrandparent(scenePoint, parent.parent_id, ...);
  }

  return sameParentResult;
}
```

**그룹에서 꺼내기 (조부모 fallback)**:

- `resolveCrossContainerDrop`은 body/root를 제외 → 최상위 컨테이너로의 reparent 불가
- 커서가 현재 부모 밖 + crossResult 없음 → 조부모(그룹의 부모)에서 `findInsertionIndex`로 삽입 위치 계산
- 이를 통해 그룹 → body, 그룹 → 상위 Card 등 모든 "꺼내기" 동작 지원

#### 순환 방지 (CRITICAL)

```typescript
function isDescendantOf(elementId, ancestorId, elementsMap): boolean {
  let currentId = elementId;
  while (currentId) {
    if (currentId === ancestorId) return true;
    currentId = elementsMap.get(currentId)?.parent_id;
  }
  return false;
}
```

#### Store moveElementToContainer

```typescript
moveElementToContainer: (elementId, newParentId, insertionIndex) => {
  // 1. element.parent_id 변경
  // 2. 원래 부모 자식들 order_num 재계산 (빈 자리 채움)
  // 3. 새 부모 자식들 order_num 재계산 (삽입 위치 반영)
  // 4. 단일 set() + _rebuildIndexes()
  // 5. layoutVersion + 1
};
```

### 7. dropIndicatorSnapshotRef 브릿지 (CRITICAL)

SelectionLayer ↔ SkiaOverlay 간 드래그 상태 공유:

```typescript
// BuilderCanvas.tsx
const dropIndicatorSnapshotRef = useRef<DropIndicatorSnapshot | null>(null);

// 양쪽에 전달
<SelectionLayer dropIndicatorSnapshotRef={dropIndicatorSnapshotRef} />
<SkiaOverlayLazy dropIndicatorSnapshotRef={dropIndicatorSnapshotRef} />
```

- **누락 시**: `tickAnimations()` 실행 안 됨 → 형제 gap 애니메이션 전체 비활성
- React state가 아닌 **MutableRef**로 공유 — RAF에서 직접 읽어 React 리렌더링 없이 동기화

## 수정 파일 목록

### 신규 파일

| 파일                                                             | 용도                    |
| ---------------------------------------------------------------- | ----------------------- |
| `apps/builder/src/builder/workspace/canvas/skia/dragAnimator.ts` | Spring lerp 보간 시스템 |

### 수정 파일

| 파일                              | 변경 내용                                                                                | Phase        |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ------------ |
| `selection/SelectionLayer.tsx`    | deferred commit, dead zone 양축, `getSceneBounds`, selection box 숨김, dragSize 전달     | A, Bugfix    |
| `selection/dropTargetResolver.ts` | `getSceneBounds`, cross-container, 조부모 fallback, `findInsertionIndex` 추출, 순환 방지 | A, D, Bugfix |
| `selection/SelectionBox.tsx`      | `setVisible(visible)` imperative handle 추가                                             | Bugfix       |
| `skia/nodeRendererTree.ts`        | `_getSiblingOffset` → `getSiblingOffset` export                                          | A            |
| `skia/renderCommands.ts`          | 형제 시각적 오프셋 적용, 드래그 요소 반투명 saveLayer                                    | A            |
| `skia/dropIndicatorRenderer.ts`   | 반투명 배경, 실선+끝점 원, reparent 색상, dragSize 기반 삽입 라인 보정                   | C, D, Bugfix |
| `skia/SkiaOverlay.tsx`            | RAF dragAnimator tick, `dropIndicatorState` 전달 (null 하드코딩 제거)                    | B, Bugfix    |
| `skia/skiaOverlayBuilder.ts`      | 드래그 중 selection box/handles 렌더링 스킵                                              | Bugfix       |
| `stores/elements.ts`              | `moveElementToContainer` 액션 추가                                                       | D            |
| `BuilderCanvas.tsx`               | `dropIndicatorSnapshotRef` 생성 + SelectionLayer/SkiaOverlay 전달                        | Bugfix       |

### 제거 대상

| 대상                                                | 위치               |
| --------------------------------------------------- | ------------------ |
| `reorderCooldownRef`                                | SelectionLayer.tsx |
| `dropTargetRef` (좀비 ref — 선언/리셋만, 읽기 없음) | SelectionLayer.tsx |
| `batchUpdateElementOrders` 호출 (onDragUpdate 내)   | SelectionLayer.tsx |

## 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                     드래그 중 (Store 변경 없음)                    │
│                                                                 │
│  pointer move                                                   │
│      │                                                          │
│      ▼                                                          │
│  screenToViewportPoint (씬 좌표)                                  │
│      │                                                          │
│      ├──► setDragVisualOffset (globalThis)                      │
│      │                                                          │
│      ├──► resolveDropTarget (getSceneBounds 기반)                │
│      │       ├─ same-parent reorder                             │
│      │       ├─ cross-container (hitTestPoint WASM)             │
│      │       └─ 조부모 fallback (커서가 부모 밖 + cross 없음)    │
│      │                                                          │
│      ├──► computeSiblingOffsets (vacate + insertion)             │
│      │       │                                                  │
│      │       ▼                                                  │
│      │   updateAnimationTargets (dragAnimator)                  │
│      │       │                                                  │
│      │       ▼ (RAF)                                            │
│      │   tickAnimations → lerp 보간                              │
│      │       │                                                  │
│      │       ▼                                                  │
│      │   setDragSiblingOffsets (globalThis)                      │
│      │                                                          │
│      └──► dropIndicatorSnapshotRef (SkiaOverlay 공유)            │
│                                                                 │
│  renderCommands.ts:                                             │
│      getDragVisualOffset → 드래그 요소 translate + alpha 0.5     │
│      getSiblingOffset → 형제 요소 translate (gap 애니메이션)      │
│      dropIndicatorRenderer → 삽입 라인 + 컨테이너 하이라이트     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     드롭 시 (단일 Store 커밋)                     │
│                                                                 │
│  pointer up                                                     │
│      │                                                          │
│      ▼                                                          │
│  1. finalTarget = lastResolvedDropTargetRef                     │
│  2. clearAllAnimations + setDragVisualOffset(null)              │
│     + setDragSiblingOffsets(null)                               │
│  3. Store 커밋:                                                  │
│     ├─ isReparent → moveElementToContainer()                    │
│     └─ reorder → batchUpdateElementOrders()                     │
│  4. historyManager.addBatchDiffEntry()                          │
│  5. DB persist (queueMicrotask)                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 성능 고려

| 영역                    | 비용          | 근거                                                       |
| ----------------------- | ------------- | ---------------------------------------------------------- |
| 시각적 오프셋           | O(1)          | globalThis 변수 직접 읽기, React state 아님 → 리렌더링 0회 |
| dragAnimator            | < 0.1ms/frame | Map.forEach 1회, 요소 ~10개 이하                           |
| renderCommands          | 무시 가능     | 기존 ELEMENT_BEGIN에 조건 1개 추가                         |
| cross-container hitTest | O(log n)      | 기존 WASM SpatialIndex 재사용                              |
| notifyLayoutChange      | 조건부        | 애니메이션 진행 중에만 호출, 종료 시 자동 정지             |

## Fail-safe 원칙

### 드래그 중 안전

1. **시각적 오프셋은 store를 변경하지 않음** — 렌더링 시점의 translate만
2. **Escape 키**: clearAllAnimations + setDragVisualOffset(null) + setDragSiblingOffsets(null) → 즉시 원복
3. **pointerup 누락**: window 레벨 이벤트이므로 캔버스 밖에서도 감지
4. **컴포넌트 언마운트**: useEffect cleanup에서 clearAllAnimations 호출

### Cross-container 안전

1. **순환 방지**: `isDescendantOf` 체크 — 자손 컨테이너 드롭 차단
2. **body/page root**: hitTest에서 body 제외 유지, 대신 조부모 fallback으로 body로의 reparent 지원
3. **reparent 실패 시**: moveElementToContainer가 예외 throw → onMoveEnd에서 catch, 시각적 오프셋만 클리어
4. **3단계 우선순위**: same-parent → cross-container (hitTest) → 조부모 fallback (cursorOutsideParent)

## 발견 및 수정된 버그

### Bug 1: dropIndicatorSnapshotRef 브릿지 누락

- **증상**: 형제 gap 애니메이션 전체 미작동, 드롭 시 즉시 교체만 발생
- **원인**: BuilderCanvas.tsx에서 ref 미생성 → SelectionLayer/SkiaOverlay 간 통신 불가
- **수정**: BuilderCanvas에서 `useRef<DropIndicatorSnapshot | null>(null)` 생성 + 양쪽 전달

### Bug 2: 좌표계 불일치 (getElementBoundsSimple vs getSceneBounds)

- **증상**: 렌더링된 위치와 다른 곳에서 드래그 반응
- **원인**: `getElementBoundsSimple` = PixiJS `getBounds()` = Camera zoom/pan 포함 화면 좌표. 커서는 `screenToViewportPoint` = zoom/pan 제거된 씬 좌표
- **수정**: dropTargetResolver + SelectionLayer dead zone에서 `getSceneBounds` (renderCommands boundsMap) 사용

### Bug 3: 가로 컨테이너 dead zone 고정

- **증상**: 세로 배치는 동작하지만 가로(row) 컨테이너에서 gap 애니메이션 미작동
- **원인**: `isHz = lastResolvedDropTargetRef.current?.isHorizontal ?? false` — 첫 resolve 전 항상 `false` → Y축 검사 → 수평 드래그 시 dead zone 탈출 불가
- **수정**: `prevTarget`이 null이면 dead zone 스킵하여 첫 resolve 보장

### Bug 4: dropIndicatorState null 하드코딩

- **증상**: 삽입 라인/컨테이너 하이라이트가 드래그 중 표시 안 됨
- **원인**: SkiaOverlay의 `buildFrameRenderPlan` 호출에서 `dropIndicatorState: null` 하드코딩
- **수정**: `dropIndicatorSnapshotRef?.current`를 그대로 전달

### Bug 5: 삽입 라인이 형제에 밀착 (animated gap 미반영)

- **증상**: 가이드 라인이 gap 중앙이 아닌 형제 요소에 바로 붙어서 표시
- **원인**: `childBounds`가 원본 layout 위치 → animated 오프셋 미반영 → `linePos`가 gap 없이 계산
- **수정**: `DropIndicatorSnapshot`에 `dragSize` 추가, 렌더러에서 `linePos`를 `dragSize/2`만큼 보정

### Bug 6: 드래그 중 selection box 잔존

- **증상**: 드래그 시작 시 선택 박스(파란 테두리 + 핸들)가 계속 표시
- **원인**: Selection box는 Skia 오버레이에서 렌더링 — PixiJS visible 토글은 무관
- **수정**: `skiaOverlayBuilder.ts`에서 `dropIndicatorState`가 있으면 selection 렌더링 스킵

### Bug 7: 그룹에서 꺼내기 불가 (조부모 reparent)

- **증상**: 그룹 간 이동은 가능하지만 그룹 밖으로 요소를 꺼낼 수 없음
- **원인**: (1) cross-container가 body/root를 제외 → 최상위 컨테이너로 reparent 불가. (2) 커서가 부모 밖이어도 same-parent 결과가 존재하면 cross를 무시
- **수정**: (1) `cursorOutsideParent` 조건 추가 — 커서가 부모 밖이면 cross 우선. (2) cross도 없으면 조부모 fallback — `parent.parent_id`로 직접 reparent 결과 생성

## 커밋 이력

| 커밋       | 설명                                       |
| ---------- | ------------------------------------------ |
| `815e9ebe` | Phase A: True Deferred Commit              |
| `01bde849` | Phase C: Drop Indicator Visual Improvement |
| `20c9ce66` | Phase B: Spring Interpolation              |
| `ac0ca43b` | Phase D: Cross-Container Reparenting       |
| `5da118ea` | Bugfix: dropIndicatorSnapshotRef 브릿지    |
| `c1ae6f76` | Bugfix: getSceneBounds 좌표계 전환         |
| `458cde7e` | Bugfix: dead zone 가로 컨테이너 수정       |
