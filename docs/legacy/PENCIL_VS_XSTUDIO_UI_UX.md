# Pencil vs composition Selection 시스템 비교 분석

> 분석일: 2026-02-03 (최종 업데이트: 2026-02-14)
> Pencil: v1.1.10 (Electron + CanvasKit/Skia + PixiJS v8)
> composition: CanvasKit/Skia WASM + PixiJS v8 + Zustand
>
> **⚠️ STALE (2026-07-26)**: 양쪽 모두 이후 PixiJS 를 제거함 — composition 은 ADR-900 (Unified Skia), Pencil(현 **Pen** v1.2.1) 은 자체 WASM 엔진 통합 (PixiJS 렌더러 미가동 실측). "PixiJS Layer 2 오버레이" 서술은 역사 기록으로만 유효. Selection UX 자체 (더블클릭 drill-in / 300ms / 계층 이동) 는 v1.2.1 에서도 유지·보강 확인. 실측 정본: [PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md](../explanation/research/PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md)

---

## 1. Selection 아키텍처 비교

### 1.1 구조 개요

| 항목                 | Pencil                                      | composition                                              |
| -------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **Selection 관리**   | `SelectionManager` 클래스 (`Set<Node>`)     | Zustand store (`selectedElementIds: string[]` + `Set`)   |
| **알림 메커니즘**    | EventEmitter `"selectionChange"`            | Zustand subscribe                                        |
| **선택 모드**        | `selectNode(node, toggle, exclusive)` 3모드 | `addToSelection(id)` + `multiSelectMode`                 |
| **계층적 선택**      | 더블클릭으로 컨테이너 진입, Escape로 복귀   | ✅ 구현 완료 — `editingContextId` + `resolveClickTarget` |
| **호버 상태**        | `hoveredNode` 별도 필드 관리                | ✅ 구현 완료 — `hoveredElementId` + `hoverRenderer.ts`   |
| **더블클릭**         | 300ms threshold 내장                        | ✅ 구현 완료 — 컨테이너 진입 / 텍스트 편집 분기          |
| **Selection 렌더링** | PixiJS 오버레이 (`guidesManager`)           | CanvasKit/Skia (`selectionRenderer.ts`)                  |

### 1.2 렌더링 레이어 분리

```
Pencil:
  Layer 1: Skia → 콘텐츠 (노드, 이펙트)
  Layer 2: PixiJS → 오버레이 (선택 박스, 핸들, 가이드, 스냅 라인)

composition:
  Layer 1 (z:2): Skia → 콘텐츠 + AI + Selection 오버레이 + 호버 하이라이트 (통합 렌더링)
  Layer 2 (z:3): PixiJS → 이벤트 처리 전용 (alpha=0, 히트 테스팅만)
```

> **핵심 차이:** Pencil은 Selection을 PixiJS로 렌더링하지만, composition는 Skia로 통합 렌더링한다. composition 방식이 렌더링 패스를 줄여 성능상 유리.

### 1.3 좌표 변환 시스템

**Pencil (3단계):**

```
Screen (Canvas) → camera.toWorld(screenX, screenY) → World (Scene)
World (Scene)   → parent.worldMatrix.invert()      → Local (Node)

toWorld: (camera.left + screenX/zoom, camera.top + screenY/zoom)
toScreen: ((worldX - camera.left) * zoom, (worldY - camera.top) * zoom)
```

**composition (2단계):**

```
Screen → (relativeX - panX) / zoom → Scene-Local
Scene  → buildTreeBoundsMap()      → 요소별 절대 좌표
```

---

## 2. composition 현재 구현 상태

### 2.1 파일 구조

```
apps/builder/src/builder/workspace/canvas/selection/
├── index.ts                      # 모듈 export
├── types.ts                      # 타입 정의 (핸들, 드래그, 바운딩 박스)
├── SelectionLayer.tsx            # 최상위 Selection 통합 레이어
├── SelectionBox.tsx              # 선택 박스 + 핸들 (imperative 업데이트)
├── TransformHandle.tsx           # 리사이즈 핸들 (8방향)
├── LassoSelection.tsx            # 라쏘 선택 시각화
├── LassoSelection.utils.ts       # 라쏘 바운딩 박스 계산
├── SelectionLayer.utils.ts       # 라쏘 요소 검색 (WASM SpatialIndex)
└── useDragInteraction.ts         # 드래그 인터랙션 훅 (이동/리사이즈/라쏘)

apps/builder/src/builder/workspace/canvas/skia/
├── selectionRenderer.ts          # CanvasKit/Skia 기반 Selection 시각 렌더링
└── hoverRenderer.ts              # 호버 하이라이트 Skia 렌더러

apps/builder/src/builder/workspace/canvas/hooks/
└── useElementHoverInteraction.ts # 호버 인터랙션 훅 (RAF 스로틀)

apps/builder/src/stores/
├── selection.ts                  # Selection Zustand store (editingContextId 포함)
└── utils/
    ├── hierarchicalSelection.ts  # resolveClickTarget, resolveEditingContextForTreeSelection
    ├── elementAlignment.ts       # 정렬 유틸리티 (미통합)
    └── elementDistribution.ts    # 배치 유틸리티 (미통합)
```

### 2.2 구현 완료 기능

| 기능                    | 구현 파일                                           | 설명                                                               |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| **단일 선택**           | `SelectionLayer.tsx`                                | 요소 클릭 → `addToSelection(id)`                                   |
| **다중 선택**           | `selection.ts`                                      | Shift + 클릭, `multiSelectMode`                                    |
| **라쏘 선택**           | `useDragInteraction.ts`, `LassoSelection.tsx`       | Shift + 드래그, WASM SpatialIndex 쿼리                             |
| **선택 해제**           | `SelectionLayer.tsx`                                | 빈 영역 클릭 → `clearSelection()`                                  |
| **요소 이동**           | `useDragInteraction.ts`                             | 선택 요소 드래그, delta 기반                                       |
| **요소 리사이즈**       | `useDragInteraction.ts`                             | 8방향 핸들 (코너 4 + 엣지 4), 최소 10px 보장                       |
| **핸들 표시**           | `TransformHandle.tsx`                               | 코너: 6x6 흰색 + 파란 테두리, 엣지: 투명 히트 영역                 |
| **Skia 렌더링**         | `selectionRenderer.ts`                              | Selection Box + 핸들 + 라쏘를 CanvasKit으로 렌더링                 |
| **바운딩 박스**         | `types.ts`                                          | `calculateCombinedBounds()` — 다중 선택 합집합                     |
| **Imperative 업데이트** | `SelectionBox.tsx`                                  | `updatePosition(delta)` — React 리렌더 없이 PixiJS 직접 조작       |
| **계층적 선택**         | `selection.ts`, `hierarchicalSelection.ts`          | `editingContextId` 기반 깊이 레벨 선택, 더블클릭 진입, Escape 복귀 |
| **호버 하이라이트**     | `useElementHoverInteraction.ts`, `hoverRenderer.ts` | 현재 깊이 레벨 요소에 반투명 테두리 (blue-500, alpha 0.5)          |
| **더블클릭 동작**       | `SelectionLayer.tsx`                                | 컨테이너: `enterEditingContext`, 텍스트: `startEdit`               |
| **Body 선택**           | `SelectionLayer.tsx`, `selectionRenderer.ts`        | 빈 영역/배경 클릭으로 body 선택, pageFrames 기반 bounds 폴백       |

### 2.3 부분 구현 기능

| 기능                    | 현황                                    | 남은 작업                             |
| ----------------------- | --------------------------------------- | ------------------------------------- |
| **정렬 (Alignment)**    | `elementAlignment.ts` 유틸 함수 존재    | 툴바 UI + 단축키 연결 + 히스토리 기록 |
| **배치 (Distribution)** | `elementDistribution.ts` 유틸 함수 존재 | 툴바 UI + 단축키 연결 + 히스토리 기록 |
| **그리드 스냅**         | `canvasSettings.ts`에 `snapToGrid` 설정 | 드래그 중 좌표 보정 로직 추가         |
| **그리드 표시**         | `showGrid` 설정 + Skia GridLayer 렌더링 | 이미 구현됨                           |

### 2.4 미구현 기능

| 기능                          | 설명                                                  |
| ----------------------------- | ----------------------------------------------------- |
| **복제 (Duplicate)**          | Ctrl+D, 요소 deep copy + 새 ID + 오프셋 배치          |
| **클립보드 (Cut/Copy/Paste)** | 요소 직렬화/역직렬화, 계층 보존, Ctrl+C/V/X           |
| **Z-Order 변경**              | Bring Forward / Send Backward / Front / Back          |
| **스냅 가이드**               | 근처 요소와 정렬 선 표시 (축별 최소 거리, 5px 임계값) |
| **회전 (Rotation)**           | 중심점 기준 극좌표 변환, 회전 핸들                    |
| **그룹/언그룹**               | 다중 선택 → 그룹 노드 생성, 계층 구조 변경            |
| **좌표/크기 패널**            | Inspector에서 x, y, width, height 직접 입력           |

---

## 3. 기능별 상세 비교

### 3.1 Selection 상태 관리

**Pencil:**

```typescript
class SelectionManager {
  selectedNodes: Set<Node>;
  hoveredNode: Node | null;
  lastClickTime: number; // 더블클릭 감지 (300ms)
  lastClickTargetId: string | null;

  selectNode(node, toggle = false, exclusive = false);
  deselectNode(node, notify);
  clearSelection(notify);
  setSelection(nodeSet); // Set 비교로 불필요한 이벤트 방지
  getSingleSelectedNode();
  isInTheSelectionTree(node); // 부모가 선택되었는지 확인
  hasSelectedChildren(parent);
}
```

**composition:**

```typescript
// Zustand store (selection.ts)
interface SelectionState {
  selectedElementIds: string[];
  selectedElementIdsSet: Set<string>; // O(1) 검색용
  multiSelectMode: boolean;
  selectionBounds: BoundingBox | null;
  editingContextId: string | null;    // 계층적 선택 — 현재 진입한 컨테이너 ID
  hoveredElementId: string | null;    // 호버 하이라이트 대상

  addToSelection(id): void;          // multiSelectMode 분기
  removeFromSelection(id): void;
  clearSelection(): void;
  setMultiSelectMode(enabled): void;
  selectAll(elements[]): void;
  selectByParent(parentId, elements[]): void;
  enterEditingContext(id): void;      // 더블클릭 → 컨테이너 진입
  exitEditingContext(): void;         // Escape → 한 단계 위로
  setHoveredElementId(id): void;     // 호버 상태 업데이트
}
```

### 3.2 계층적 선택 모델 (Pencil/Figma 스타일) — 구현 완료

composition는 Pencil/Figma와 동일한 계층적 선택 모델을 구현하였다.

| 동작                      | Pencil                          | composition                                                              | 일치 여부 |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------ | --------- |
| **클릭**                  | 현재 깊이 레벨 요소만 선택      | `resolveClickTarget(editingContextId)` → 현재 깊이 요소 반환             | ✅ 일치   |
| **더블클릭 (컨테이너)**   | 컨테이너 내부로 진입            | `enterEditingContext(id)` → `editingContextId` 업데이트                  | ✅ 일치   |
| **더블클릭 (텍스트)**     | 텍스트 편집 모드 진입           | `startEdit` 유지 (기존 동작)                                             | ✅ 일치   |
| **Escape**                | 한 단계 위로 복귀               | `exitEditingContext()` → 부모로 이동, 최상위면 선택 해제                 | ✅ 일치   |
| **레이어 트리 직접 선택** | 깊은 요소 직접 선택 가능        | `resolveEditingContextForTreeSelection` → editingContext 자동 조정       | ✅ 일치   |
| **호버 하이라이트**       | 현재 깊이 요소에 테두리 표시    | `hoverRenderer.ts` (blue-500, alpha 0.5) + 컨테이너 경계 점선 (gray-400) | ✅ 일치   |
| **Body 선택**             | 캔버스 빈 영역 클릭 → body 선택 | `handleElementClick` body 특수 처리 + pageFrames bounds 폴백             | ✅ 일치   |

**핵심 구현 파일:**

```
resolveClickTarget(clickedId, editingContextId, elementsMap)
  → editingContextId가 null이면 최상위 자식만 선택 대상
  → editingContextId가 있으면 해당 컨테이너의 직접 자식만 선택 대상
  → 클릭된 요소의 조상을 거슬러 올라가 현재 깊이 레벨 요소를 반환

resolveEditingContextForTreeSelection(targetId, elementsMap)
  → 레이어 트리에서 깊은 요소 선택 시
  → 해당 요소의 부모를 editingContextId로 자동 설정
```

### 3.3 Hit Testing

**Pencil:**

```typescript
findNodeAtPosition(screenX, screenY, ignoreHidden, excludeSet, root)
  → camera.toWorld(screenX, screenY)
  → 루트부터 역순(Z-order top-to-bottom) 순회
  → containsPointInBoundingBox(worldX, worldY)
  → 재귀적 자식 탐색

findFrameForPosition(screenX, screenY, root, excludeSet)
  → 하향식 탐색
  → canAcceptChildren() 검증
  → 드래그 앤 드롭 대상 컨테이너 탐색
```

**composition:**

- PixiJS `EventBoundary` 히트 테스팅 (alpha=0 요소도 히트 가능)
- `resolveClickTarget()` — 히트된 요소를 `editingContextId` 기반으로 현재 깊이 레벨로 해석
- WASM `SpatialIndex.queryRect()` (라쏘 선택 시)
- `getElementBoundsSimple(id)` (elementRegistry 기반)

### 3.4 드래그 파이프라인

**Pencil:**

```
pointerDown → findNodeAtPosition() → 히트 테스트
  → dragStartNodeParents Map 저장
  → Screen → World → Local 좌표 변환
  → scenegraph.beginUpdate() → 트랜잭션 시작
  → node position 업데이트
  → snapManager.snapBounds() → 정렬선 스냅
  → commitBlock() → undo 스택 기록
```

**composition:**

```
pointerDown → PixiJS EventBoundary 히트 테스트
  → resolveClickTarget(editingContextId) → 현재 깊이 레벨 요소 결정
  → useDragInteraction: dragStateRef 업데이트
  → RAF 스로틀 (프레임당 1회)
  → selectionBoxRef.updatePosition(delta) — imperative PixiJS 조작
  → pointerUp → onMoveEnd(elementId, delta)
  → updateElementProps() → Zustand + 히스토리 기록
```

### 3.5 Transform Handle 시스템

**Pencil:**

- 핸들 타입: left/right/top/bottom + 코너 + 회전 핸들
- 회전: `rotateSelectedNodes(delta, center, originalRotations, originalPositions)`
  - 중심점 기준 극좌표 변환: `dx' = dx*cos(θ) - dy*sin(θ)`
- 정렬: `alignSelectedNodes("left"|"center"|"right"|"top"|"middle"|"bottom")`

**composition:**

- 핸들 8방향: 코너 4개 (시각 표시) + 엣지 4개 (투명 히트 영역)
- `calculateResizedBounds()`: 각 핸들별 리사이즈 계산 (최소 10px)
- 회전: 타입에 `'rotate'` 정의되어 있으나 미구현
- 정렬: `elementAlignment.ts` 유틸만 존재, UI 미연결

### 3.6 스냅 시스템

**Pencil:**

```typescript
class SnapManager {
  snapBounds(bounds, selectedNodes, renderSnappedPoints);
  snapPoint(point, selectedNodes, renderSnappedPoints);

  // 알고리즘:
  // 1. 선택 노드의 5개 스냅 포인트 (좌상, 우상, 중심, 좌하, 우하)
  // 2. 컨테이너 내 다른 노드들과 비교
  // 3. 축별(X, Y) 최소 거리 계산
  // 4. 5px 임계값 이내 스냅
  // 5. Skia 캔버스에 스냅 라인/포인트 렌더링
}
```

**composition:**

- `canvasSettings.ts`에 `snapToGrid` 설정만 존재
- 실제 스냅 로직, 스냅 가이드 렌더링 모두 미구현

### 3.7 클립보드 시스템

**Pencil:**

```typescript
handleCopy(event):
  → 선택 노드 직렬화
  → clipboard data 설정:
     - "application/x-ha": 내부 포맷
     - "text/plain": 노드 ID 목록
     - "application/x-lexical-editor": IDE 연동

handlePaste(event):
  → _createNodesFromClipboardData()
  → 카메라 중심에 배치
  → 새 선택으로 설정 + undo 기록

handleCut(event):
  → handleCopy() + removeSelectedNodes()
```

**composition:**

- 전체 미구현

### 3.8 트랜잭션 패턴

**Pencil (Update Block):**

```typescript
const update = scenegraph.beginUpdate();
update.update(node, { x, y, width, height });
update.deleteNode(node);
update.addNode(node, parent);
scenegraph.commitBlock(update, { undo: true });
// 또는 scenegraph.rollbackBlock(update);
```

**composition (Zustand + HistoryManager):**

```typescript
// 히스토리 자동 기록 (상태 변경 전 recordChange 호출)
updateElementProps(id, props);
// 또는 수동
useStore.getState().recordHistory();
```

---

## 4. 성능 최적화 비교

### 4.1 composition 적용 최적화

| 최적화                  | 구현                                                     | 효과                                    |
| ----------------------- | -------------------------------------------------------- | --------------------------------------- |
| **Imperative 업데이트** | `SelectionBox.updatePosition()`                          | 드래그 중 React 리렌더 제거             |
| **RAF 스로틀링**        | `useDragInteraction.ts`, `useElementHoverInteraction.ts` | 프레임당 1회만 상태 업데이트            |
| **dragStateRef**        | `useDragInteraction.ts`                                  | ref로 즉시 업데이트, state는 필요 시만  |
| **선택 구독 최적화**    | `SelectionLayer.tsx`                                     | elementsMap 전체 구독 제거, 선택 요소만 |
| **O(1) 검색**           | `selectedElementIdsSet`                                  | Set 기반 선택 여부 확인                 |
| **Skia 통합 렌더링**    | `selectionRenderer.ts`, `hoverRenderer.ts`               | 별도 PixiJS 렌더 패스 불필요            |
| **WASM SpatialIndex**   | `SelectionLayer.utils.ts`                                | 라쏘: O(k) 영역 쿼리                    |
| **childrenMap 활용**    | `SelectionLayer.tsx`                                     | O(n) → O(selected) 검색 개선            |
| **호버 RAF 스로틀**     | `useElementHoverInteraction.ts`                          | pointermove 이벤트 프레임당 1회 처리    |

### 4.2 Pencil 적용 최적화

| 최적화                   | 구현                    | composition 대비              |
| ------------------------ | ----------------------- | ----------------------------- |
| **elementsMap 인덱싱**   | O(1) 노드 검색          | ✅ 동일 수준                  |
| **RAF 배치 처리**        | 선택 변경 프레임 배치   | ✅ 동일 수준                  |
| **오프스크린 캐싱**      | contentCanvas 줌별 캐시 | ✅ composition도 이중 Surface |
| **contentRenderPadding** | 512px 버퍼              | 미구현 (Phase 5 대기)         |

---

## 5. 미구현 기능 우선순위 분석

### 5.1 평가 기준

| 기준                   | 가중치 | 설명                                         |
| ---------------------- | ------ | -------------------------------------------- |
| **사용자 체감**        | 40%    | 일반 사용자가 즉시 느끼는 편의성 개선        |
| **구현 난이도**        | 30%    | 코드 복잡도, 의존성, 기존 인프라 활용 가능성 |
| **기반 준비도**        | 20%    | 유틸 함수, 타입 정의, 아키텍처 호환성        |
| **Pencil 참조 가능성** | 10%    | Pencil 소스에서 직접 참고할 수 있는 정도     |

### 5.2 Tier 1 — 즉시 구현 권장 (사용성 체감 큼, 난이도 낮음)

#### 1. 복제 (Duplicate) — Ctrl+D

| 항목               | 내용                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| **난이도**         | 낮음                                                                                       |
| **사용자 체감**    | 매우 높음                                                                                  |
| **기반 준비도**    | 높음 — `elementsMap`, `addElement()`, 히스토리 시스템 완성                                 |
| **구현 범위**      | 선택 요소 deep copy → 새 ID 생성 → +10px 오프셋 배치 → 히스토리 기록 → 새 요소 선택        |
| **예상 수정 파일** | `stores/utils/elementDuplicate.ts` (신규), `useKeyboardShortcuts` (단축키), `selection.ts` |
| **Pencil 참조**    | `duplicateSelectedNodes()` — 오프셋 배치 + 같은 부모 배치 로직                             |

#### 2. 클립보드 (Cut/Copy/Paste) — Ctrl+C/V/X

| 항목               | 내용                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **난이도**         | 낮음~중간                                                                                                            |
| **사용자 체감**    | 매우 높음                                                                                                            |
| **기반 준비도**    | 중간 — 직렬화/역직렬화 로직 필요                                                                                     |
| **구현 범위**      | Copy: 선택 요소 JSON 직렬화 → Clipboard API. Paste: 역직렬화 → 새 ID → 뷰포트 중앙 배치 → 히스토리. Cut: Copy + 삭제 |
| **예상 수정 파일** | `stores/utils/elementClipboard.ts` (신규), `useKeyboardShortcuts`, `selection.ts`                                    |
| **Pencil 참조**    | `handleCopy/Paste/Cut` — 내부 포맷 + text/plain 이중 직렬화                                                          |
| **의존성**         | 복제(#1)와 로직 공유 (deep copy + 새 ID 생성)                                                                        |

#### 3. Z-Order 변경 — Ctrl+]/[

| 항목               | 내용                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **난이도**         | 낮음                                                                                                |
| **사용자 체감**    | 높음                                                                                                |
| **기반 준비도**    | 높음 — `childrenMap` 인덱스, 히스토리 시스템                                                        |
| **구현 범위**      | `children` 배열 인덱스 변경 (bringForward/sendBackward/bringToFront/sendToBack) + 히스토리 + 단축키 |
| **예상 수정 파일** | `stores/utils/elementZOrder.ts` (신규), `useKeyboardShortcuts`                                      |
| **Pencil 참조**    | 직접 참조 불필요 — 배열 인덱스 조작만으로 구현                                                      |

#### ~~4. 호버 하이라이트~~ — ✅ 구현 완료

> **구현 완료 (2026-02-14):** `useElementHoverInteraction` 훅 (pointermove + RAF 스로틀) + `hoverRenderer.ts` Skia 렌더러 (blue-500, alpha 0.5). 진입한 컨테이너 경계 점선 표시 (gray-400). 선택된 요소는 호버 제외, 드래그 중 호버 비활성화.

### 5.3 Tier 2 — 핵심 편집 기능 (기반 코드 존재, 통합 필요)

#### 5. 정렬 (Alignment) — 6방향

| 항목               | 내용                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| **난이도**         | 중간                                                                                   |
| **사용자 체감**    | 높음                                                                                   |
| **기반 준비도**    | 높음 — `elementAlignment.ts` 유틸 완성, UI만 추가                                      |
| **구현 범위**      | 툴바 정렬 버튼 6개 (left/center/right/top/middle/bottom) + 단축키 + 히스토리 일괄 기록 |
| **예상 수정 파일** | `elementAlignment.ts` (통합), 툴바 컴포넌트 (신규), `useKeyboardShortcuts`             |
| **Pencil 참조**    | `alignSelectedNodes(direction)` — bounding box 기반 정렬                               |

#### 6. 배치 (Distribution) — 수평/수직

| 항목               | 내용                                                   |
| ------------------ | ------------------------------------------------------ |
| **난이도**         | 중간                                                   |
| **사용자 체감**    | 보통                                                   |
| **기반 준비도**    | 높음 — `elementDistribution.ts` 유틸 완성, UI만 추가   |
| **구현 범위**      | 정렬(#5)과 동시 구현, 수평/수직 균등 배치              |
| **예상 수정 파일** | `elementDistribution.ts` (통합), 정렬 툴바에 함께 배치 |
| **의존성**         | 정렬(#5)과 동일 UI 컴포넌트 공유                       |

#### 7. 그리드 스냅

| 항목               | 내용                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| **난이도**         | 낮음~중간                                                                                                |
| **사용자 체감**    | 보통                                                                                                     |
| **기반 준비도**    | 중간 — `snapToGrid` 설정 존재, 스냅 로직만 추가                                                          |
| **구현 범위**      | `useDragInteraction`의 move/resize에서 좌표를 그리드 크기에 스냅 (`Math.round(x / gridSize) * gridSize`) |
| **예상 수정 파일** | `useDragInteraction.ts`, `canvasSettings.ts`                                                             |

#### ~~8. 더블클릭 편집~~ — ✅ 구현 완료

> **구현 완료 (2026-02-14):** 계층적 선택 모델의 일부로 구현. 컨테이너 더블클릭 → `enterEditingContext(id)` (자식 선택 모드 진입). 텍스트 요소 더블클릭 → 기존 `startEdit` (인라인 편집 모드). Escape → `exitEditingContext()` (한 단계 위로 복귀).

### 5.4 Tier 3 — 고급 기능 (복잡도 높음)

#### 9. 스냅 가이드 (Smart Guides)

| 항목               | 내용                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **난이도**         | 중간~높음                                                                                           |
| **사용자 체감**    | 매우 높음                                                                                           |
| **기반 준비도**    | 낮음 — 전체 새로 구현                                                                               |
| **구현 범위**      | 드래그 중: 인접 요소 5포인트 스냅 포인트 계산 → 축별 최소 거리 → 5px 임계값 스냅 → Skia 라인 렌더링 |
| **예상 수정 파일** | `snapGuideManager.ts` (신규), `selectionRenderer.ts`, `useDragInteraction.ts`, `SkiaOverlay.tsx`    |
| **Pencil 참조**    | `SnapManager` 클래스 — `snapBounds()`, `snapPointsForBounds()`, 축별 최소 거리 알고리즘             |
| **성능 고려**      | 매 프레임 인접 요소 비교 필요. SpatialIndex 활용으로 O(k) 쿼리 가능                                 |

#### 10. 그룹/언그룹

| 항목               | 내용                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| **난이도**         | 중간~높음                                                                                                       |
| **사용자 체감**    | 높음                                                                                                            |
| **기반 준비도**    | 중간 — 계층적 선택 모델이 이미 구현되어 기반 준비도 향상                                                        |
| **구현 범위**      | `group` 요소 타입 추가 → 다중 선택 → 그룹 생성 (Ctrl+G) → 계층 구조 변경 → 히스토리 → 그룹 더블클릭 = 내부 선택 |
| **예상 수정 파일** | 데이터 모델, `elementsMap`, `childrenMap`, `SelectionLayer`, `useKeyboardShortcuts`                             |
| **의존성**         | ✅ 더블클릭/계층적 선택(구현 완료) 패턴 활용 가능                                                               |

#### 11. 회전 (Rotation)

| 항목               | 내용                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| **난이도**         | 높음                                                                                                           |
| **사용자 체감**    | 보통                                                                                                           |
| **기반 준비도**    | 최소 — `types.ts`에 `'rotate'` 타입만 정의                                                                     |
| **구현 범위**      | 회전 핸들 UI + 중심점 극좌표 변환 (`cos/sin`) + Skia 렌더링 시 `canvas.rotate()` 적용 + AABB 재계산 + 히스토리 |
| **예상 수정 파일** | `TransformHandle.tsx`, `useDragInteraction.ts`, `nodeRenderers.ts`, `types.ts`, `selectionRenderer.ts`         |
| **Pencil 참조**    | `rotateSelectedNodes()` — 극좌표 변환 공식: `dx' = dx*cos(θ) - dy*sin(θ)`                                      |
| **복잡도**         | 렌더링/히트 테스팅/바운딩 박스 모두 회전 변환 적용 필요                                                        |

---

## 6. 구현 로드맵

### 6.1 추천 구현 순서 (업데이트)

```
✅ 완료 — 계층적 선택 + 호버 + 더블클릭 + Body 선택
├── 계층적 선택 모델 (Pencil/Figma 스타일)
├── 호버 하이라이트 (기존 Tier 1 #4)
├── 더블클릭 편집 (기존 Tier 2 #8)
└── Body 요소 선택
    ↓
Phase A — 기본 편의 기능 (Tier 1 잔여)
├── 1. 복제 (Ctrl+D)
├── 2. 클립보드 (Ctrl+C/V/X)        ← 복제와 로직 공유
└── 3. Z-Order (Ctrl+]/[)
    ↓
Phase B — Figma 수준 편집 (Tier 2 잔여)
├── 5. 정렬 (6방향)
├── 6. 배치 (수평/수직)              ← 정렬과 동시 구현
└── 7. 그리드 스냅
    ↓
Phase C — 프로 수준 도구 (Tier 3)
├── 9. 스냅 가이드 (Smart Guides)
├── 10. 그룹/언그룹 (Ctrl+G)        ← 계층적 선택 기반 활용
└── 11. 회전
```

### 6.2 Phase별 예상 효과

| Phase                          | 완료 시 수준                         | Pencil 기능 커버율 |
| ------------------------------ | ------------------------------------ | ------------------ |
| ~~현재~~                       | ~~기본 선택/이동/리사이즈~~          | ~~45%~~            |
| **현재 (계층적 선택 구현 후)** | **Pencil/Figma 수준 선택 모델 완성** | **~55%**           |
| **Phase A**                    | 노코드 빌더 기본 편의 기능 완성      | ~70%               |
| **Phase B**                    | Figma 수준 편집 경험                 | ~85%               |
| **Phase C**                    | 프로 수준 편집 도구                  | ~95%               |

### 6.3 의존성 그래프

```
✅ 계층적 선택 ──→ 그룹(10)       (editingContext 패턴 재활용)
✅ 더블클릭 ──→ 그룹(10)           (내부 선택 모드 활용)
복제(1) ──→ 클립보드(2)            (deep copy 로직 공유)
정렬(5) ──→ 배치(6)                (동일 UI 컴포넌트)
스냅 가이드(9)는 독립적             (SpatialIndex 활용)
회전(11)은 독립적                   (변환 수학 자체 완결)
```

---

## 7. Pencil 고유 패턴 (composition 도입 검토)

### 7.1 Update Block 트랜잭션 패턴

```typescript
// Pencil: 여러 변경을 하나의 트랜잭션으로 묶어 atomic undo/redo
const update = scenegraph.beginUpdate();
update.update(node1, { x: 10 });
update.update(node2, { x: 20 });
scenegraph.commitBlock(update, { undo: true });
```

> **composition 현황:** 히스토리는 개별 `recordChange()` 기반. 다중 요소 일괄 변경(정렬 등)에서 여러 변경을 하나의 undo 단위로 묶는 기능이 필요할 수 있음.

### ~~7.2 계층 검사 메서드~~ — 부분 구현

```typescript
// Pencil: 부모가 이미 선택된 경우 자식 선택 방지
isInTheSelectionTree(node);
hasSelectedChildren(parent);
```

> **composition 현황:** `editingContextId` 기반 계층적 선택으로 유사한 기능을 달성. `resolveClickTarget`이 현재 깊이 레벨만 반환하므로 부모/자식 선택 충돌이 자연스럽게 방지됨. 다만 `isInTheSelectionTree`, `hasSelectedChildren` 같은 명시적 검사 메서드는 아직 없음 — 그룹(#10) 구현 시 필요할 수 있음.

### 7.3 프레임 드롭 대상 탐색

```typescript
// Pencil: 드래그 중 놓을 수 있는 컨테이너 탐색
findFrameForPosition(screenX, screenY, root, excludeSet);
```

> **composition 현황:** 미구현. 요소 재배치(부모 변경) 기능 구현 시 필요.

---

## 8. 결론

composition의 Selection 시스템은 **기반 아키텍처가 견고**하고 **성능 최적화가 잘 되어 있으며**, 계층적 선택 모델 구현으로 **Pencil/Figma 수준의 선택 경험**을 달성하였다.

**구현 완료된 핵심 기능:**

- 계층적 선택 (더블클릭 진입, Escape 복귀, editingContext 기반)
- 호버 하이라이트 (현재 깊이 레벨, Skia 렌더링)
- Body 요소 선택 (pageFrames 기반 bounds 폴백)
- 레이어 트리 직접 선택과 editingContext 자동 조정

**남은 과제:** 편집 편의 기능(복제, 클립보드, 정렬, 스냅)이 아직 미구현이며, **Phase A (Tier 1 잔여) 3개 항목**만 구현해도 노코드 빌더로서 기본적인 편집 편의성을 확보할 수 있다. 계층적 선택 구현으로 그룹/언그룹(#10)의 기반이 마련되어 Phase C 진입 장벽이 낮아졌다.

Pencil 소스 코드의 `SnapManager`, 클립보드 직렬화 패턴은 남은 기능 구현 시 직접적으로 참고할 수 있는 좋은 레퍼런스이다.

---

**관련 문서:**

- [ADR-003: Canvas Rendering](../adr/completed/003-canvas-rendering.md) — 캔버스 아키텍처
- [CANVAS_INTERACTIONS.md](../reference/components/CANVAS_INTERACTIONS.md) — 줌/팬 인터랙션

**최종 업데이트:** 2026-02-14
