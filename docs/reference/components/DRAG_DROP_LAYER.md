# Drag & Drop 레이어 트리 최신 구현 문서

> **작성일**: 2025-12-27  
> **최종 확인**: 2026-09-04
> **상태**: 최신 구현 기준  
> **대상 범위**: LayerTree(react-aria), VirtualizedTree 전환, Canvas 재정렬
> **초기 설계 문서**: `docs/implementation/DRAG_DROP_LAYER_TREE_PLAN.md`

---

## 개요

이 문서는 레이어 트리 DnD 및 WebGL 캔버스 재정렬의 **현재 구현 상태**를 정리합니다.
초기 설계는 보관 문서로 분리되어 있습니다.

---

## LayerTree 구현 상태

### 파일 구조

```
apps/builder/src/builder/panels/navigator/tree/LayerTree/
├── LayerTree.tsx
├── LayerTreeItemContent.tsx
├── useLayerTreeData.ts
├── useLayerTreeDnd.ts
├── validation.ts
├── types.ts
└── index.ts
```

### 라우팅/사용 위치

- `apps/builder/src/builder/panels/navigator/LayersSection.tsx`가 `LayerTree`를 렌더링
- `LayerTree.tsx`에서 투영된 `treeNodes` 개수 기준으로 전환
  - `treeNodes.length >= 300` → `VirtualizedTree`
  - 그 외 → `TreeBase`

### 상태 동기화

- `expandedKeys` / `onExpandedChange`를 외부에서 주입 가능
- 키보드 확장 이벤트도 store의 expand 상태로 브리지됨
- `onSelectionChange`는 Tree 내부 상태가 아닌 `treeNodes` 기반 노드 맵으로 선택 처리

---

## Tree DnD (LayerTree)

### 핵심 흐름

- `useDragAndDrop({ onMove })` 사용
- 이동 계산: `apps/builder/src/builder/panels/navigator/tree/LayerTree/useLayerTreeDnd.ts`
  - canonical parent와 `insertionIndex` 계산
  - `moveElementToContainer`가 canonical `children[]`을 이동하고 history·derived index·IndexedDB를 동기화

### 드롭 유효성

- `apps/builder/src/builder/panels/navigator/tree/LayerTree/validation.ts`
- 기본 규칙:
  - 자기 자신, 하위 노드로 드롭 금지
  - 가상 자식 노드 간 드롭 금지
  - `body`는 이동 불가
  - 루트 레벨은 on-drop만 허용
  - page/layout 컨텍스트 불일치 금지

---

## 가상 자식(Virtual Child) 규칙

`useLayerTreeData.ts`에서 요소의 props.children 기반으로 가상 노드를 생성합니다.

| 컴포넌트          | 가상 자식 타입 |
| ----------------- | -------------- |
| ToggleButtonGroup | toggle         |
| CheckboxGroup     | checkbox       |
| RadioGroup        | radio          |
| ListBox           | listbox        |
| GridList          | gridlist       |
| Select            | select         |
| ComboBox          | combobox       |
| Tree              | tree           |

가상 자식은 선택 전용이며 DnD/삭제는 비활성입니다.

---

## Canvas 재정렬

### 동작 개요

- **선택된 요소를 캔버스에서 드래그**하면 재정렬 수행
- `position: absolute/fixed`는 **좌표 이동**으로 처리
- 그 외 요소는 **order_num/parent_id 재정렬**로 처리

### 구현 위치

- `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts`

### 핵심 로직

1. **드래그 시작 시 포인터 좌표 저장**
   - SelectionBox/TransformHandle에서 실제 포인터 좌표 전달
   - 화면 좌표 → 캔버스 좌표 변환 후 저장
2. **드래그 중 포인터 좌표 추적**
   - `window.pointermove`로 추적
   - pan/zoom 반영하여 캔버스 좌표로 변환
3. **드롭 타겟 계산**
   - 레이아웃 bounds 내 포함되는 요소 중 **가장 깊은 요소** 선택
   - 부모 `flexDirection`에 따라 before/after 판단
   - 중앙 영역은 on-drop(자식 삽입)
4. **업데이트**
   - `moveElementToCanonicalTarget`/`moveElementsToCanonicalTarget`으로 canonical `children[]` 이동
   - absolute/fixed 좌표 patch는 `batchUpdateElementProps`로 별도 반영

### 제한 사항

- 드롭 인디케이터 UI 없음
- 컨테이너 선택 시 move area 비활성(자식 클릭 보호)로 인해 드래그 시작 불가
- drop 기준은 레이아웃 bounds 기반이며, 겹침/오버랩이 큰 경우 의도와 다를 수 있음

---

## 관련 파일

- Tree UI: `apps/builder/src/builder/panels/navigator/tree/LayerTree/LayerTree.tsx`
- DnD 계산: `apps/builder/src/builder/panels/navigator/tree/LayerTree/useLayerTreeDnd.ts`
- Canvas 재정렬: `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts`
- Selection 시작 좌표 전달:
  - `apps/builder/src/builder/workspace/canvas/selection/SelectionBox.tsx`
  - `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx`
  - `apps/builder/src/builder/workspace/canvas/selection/TransformHandle.tsx`

---

## 향후 개선 포인트

1. 캔버스 드롭 인디케이터 시각화 추가
2. 컨테이너 선택 시에도 재정렬 드래그 시작 허용 옵션
3. before/after 임계값 조정(현재 25%)
4. 드롭 대상이 유효하지 않을 때 UX 피드백 제공
