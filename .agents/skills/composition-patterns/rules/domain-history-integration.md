---
title: History Integration Pattern
impact: CRITICAL
impactDescription: 히스토리 미기록 = Undo/Redo 불가, 사용자 데이터 손실
tags: [domain, history, undo-redo]
---

상태 변경 전 반드시 히스토리를 기록합니다.

## 히스토리 아키텍처

```typescript
// Hot Cache (메모리) - 최근 50개, 즉시 Undo/Redo
// Cold Storage (IndexedDB) - 전체 히스토리, 세션 복구

interface HistoryEntry {
  id: string;
  type: "add" | "update" | "remove" | "move" | "batch";
  elementId: string;
  data: {
    element?: Element; // add/remove용
    prevElement?: Element; // update용 (이전 상태)
    diff?: SerializableElementDiff; // diff 기반 (메모리 80% 절약)
  };
  timestamp: number;
}
```

## Incorrect

```typescript
// ❌ 히스토리 없이 상태 변경
const updateElement = (elementId: string, props: Props) => {
  set({
    elements: state.elements.map(el =>
      el.id === elementId ? { ...el, props: { ...el.props, ...props } } : el
    )
  });
  // 히스토리 기록 누락!
};

// ❌ 상태 변경 후 히스토리 기록 (순서 오류)
set({ elements: newElements });
historyManager.addEntry({ ... });  // 이미 변경된 후 기록
```

## Correct

```typescript
import { historyManager } from "@/builder/stores/history";

// ✅ 히스토리 기록 → 상태 변경 순서
const updateElementProps = (elementId: string, props: Props) => {
  const element = getElementById(get().elementsMap, elementId);
  if (!element) return;

  // 1. 변경 전 히스토리 기록 (diff 기반)
  historyManager.addDiffEntry(
    "update",
    structuredClone(element), // 이전 상태
    { ...element, props: { ...element.props, ...props } }, // 새 상태
  );

  // 2. 상태 변경
  set({
    elements: state.elements.map((el) =>
      el.id === elementId ? { ...el, props: { ...el.props, ...props } } : el,
    ),
  });

  // 3. 인덱스 재구성
  get()._rebuildIndexes();
};

// ✅ 요소 추가 시
const addElement = (element: Element) => {
  historyManager.addEntry({
    type: "add",
    elementId: element.id,
    data: { element: structuredClone(element) },
  });

  set({ elements: [...state.elements, element] });
  get()._rebuildIndexes();
};

// ✅ 배치 작업 시
const batchUpdate = (updates: ElementUpdate[]) => {
  const prevElements = updates.map((u) =>
    structuredClone(getElementById(elementsMap, u.id)),
  );

  historyManager.addBatchDiffEntry(prevElements, newElements);

  set({ elements: applyUpdates(elements, updates) });
};
```

## Child Composition Pattern batch 히스토리

Property Editor에서 부모 Element와 자식 Element를 동시에 업데이트할 때, 두 변경사항을 **단일 batch 히스토리 엔트리**로 기록해야 합니다. 별도 엔트리로 기록하면 Undo 시 부모와 자식이 따로 원복되어 불일치 상태가 발생합니다.

### `updateSelectedPropertiesWithChildren` 동작 원리

`inspectorActions.ts`의 `updateSelectedPropertiesWithChildren`은 `batchUpdateElementProps`를 통해 부모+자식을 단일 `set()` 호출로 처리합니다.

```typescript
// inspectorActions.ts
updateSelectedPropertiesWithChildren: (properties, childUpdates) => {
  // 1. 진행 중인 hydration 취소 (race condition 방지)
  get()._cancelHydrateSelectedProps();

  // 2. 부모 + 자식 업데이트를 단일 batch로 구성
  const batch = [
    { elementId: element.id, props: properties },
    ...childUpdates,  // BatchPropsUpdate[]
  ];

  // 3. 단일 set() + batch 히스토리 엔트리 + IndexedDB 기록
  get().batchUpdateElementProps(batch);
},
```

### `_cancelHydrateSelectedProps` 호출이 필수인 이유

Properties Panel은 선택된 Element의 props를 비동기로 로드(`_hydrateSelectedProps`)합니다.
`updateSelectedPropertiesWithChildren` 호출 시점에 hydration이 진행 중이면, 완료 후 로드된 구 데이터가 방금 업데이트한 값을 덮어씁니다.
`_cancelHydrateSelectedProps()`를 먼저 호출하여 이 race condition을 방지합니다.

```typescript
// ✅ hydration 취소 → 업데이트 → 히스토리 기록 순서 보장
get()._cancelHydrateSelectedProps();
get().batchUpdateElementProps(batch);

// ❌ hydration 미취소 — 비동기 hydration 완료 시 업데이트 값 덮어쓰기
get().batchUpdateElementProps(batch);
// → 수백 ms 후 hydration 완료 → batch 업데이트 결과 손실
```

### batch 히스토리 Undo/Redo

`batchUpdateElementProps`가 기록하는 `type: 'batch'` 히스토리 엔트리는 `historyActions.ts`에서 완전히 처리됩니다.

```typescript
// historyActions.ts — batch 엔트리 Undo
case 'batch':
  // batch에 포함된 모든 Element를 이전 상태로 한 번에 복원
  // 부모 Element와 자식 Element가 동시에 원복 → 일관성 유지
  restoreBatchElements(entry.data.prevElements);
  break;
```

**결과**: Undo 1회로 부모 prop 변경 + 자식 prop 변경이 동시에 원복됩니다.

### Incorrect

```typescript
// ❌ 구 패턴 — 부모와 자식을 별도 호출로 업데이트
// 히스토리 엔트리 2개 생성 → Undo 2회 필요
onUpdate({ label: value }); // 히스토리 엔트리 1
syncChildProp("Label", "children", value); // 히스토리 엔트리 2
```

### Correct

```typescript
// ✅ useSyncChildProp 훅 + updateSelectedPropertiesWithChildren
// 단일 batch 히스토리 엔트리 → Undo 1회로 전체 원복
const { buildChildUpdates } = useSyncChildProp(elementId);

const handleLabelChange = useCallback(
  (value: string) => {
    const updatedProps = { ...currentProps, label: value };
    const childUpdates = buildChildUpdates([
      { childTag: "Label", propKey: "children", value },
    ]);
    useStore
      .getState()
      .updateSelectedPropertiesWithChildren(updatedProps, childUpdates);
  },
  [currentProps, buildChildUpdates],
);
```

## Undo/Redo 구현

```typescript
// historyActions.ts
export const createUndoAction = (set, get) => async () => {
  const entry = historyManager.undo();
  if (!entry) return;

  switch (entry.type) {
    case "add":
      // 추가된 요소 제거
      removeElementFromState(entry.elementId);
      break;
    case "update":
      // 이전 상태로 복원
      restoreElementState(entry.data.prevElement);
      break;
    case "remove":
      // 제거된 요소 복원
      addElementToState(entry.data.element);
      break;
    case "batch":
      // batch에 포함된 모든 Element를 이전 상태로 복원
      restoreBatchElements(entry.data.prevElements);
      break;
  }
};
```

## 배치 삭제 히스토리 패턴

`removeElements(ids[])` 배치 삭제 시 **단일 `remove` 히스토리 entry**로 기록합니다.
첫 번째 루트 요소를 `elementId` + `element`로, 나머지 모든 요소(다른 루트 + 자식)를 `childElements`로 저장합니다.
기존 `"remove"` 타입의 Undo/Redo 핸들러와 완전히 호환됩니다.

```typescript
// ✅ 배치 삭제 히스토리 — 단일 entry
historyManager.addEntry({
  type: "remove",
  elementId: rootElements[0].id,
  data: {
    element: rootElements[0],
    childElements: allElements.filter((el) => el.id !== rootElements[0].id),
  },
});
// → Undo 1회로 모든 요소 동시 복원

// ❌ 순차 삭제 히스토리 — N개 entry
// → Undo N회 필요 (하나씩 복원)
```

## Undo/Redo 후 order 복원

Undo/Redo에서 sibling order를 복원해야 하면 history entry에 canonical/source
snapshot을 저장하고 parent `children[]` splice로 복원합니다. `Element.order_num`,
`reorderElements()`, `batchUpdateElementOrders()`는 제거됐으므로 재도입하지
않습니다. props update나 hydration에서 Element metadata를 sibling reorder intent로
해석하지 않습니다.

```typescript
// ✅ snapshot 기반 batch history
historyManager.addEntry({
  type: "batch",
  elementId: "drag-reorder",
  elementIds,
  data: { prevElements, elements: nextElements },
});

// ❌ removed legacy APIs
// updateElementOrder(...)
// batchUpdateElementOrders(...)
// reorderElements(...)
```

## 참조 파일

- `apps/builder/src/builder/stores/history.ts` - HistoryManager
- `apps/builder/src/builder/stores/history/historyActions.ts` - Undo/Redo 액션
- `apps/builder/src/adapters/canonical/canonicalMutations.ts` - canonical `children[]` order write
- `apps/builder/src/builder/stores/utils/elementUpdate.ts` - 히스토리 통합 예시
- `apps/builder/src/builder/stores/utils/elementRemoval.ts` - 삭제 히스토리 (단일/배치)
- `apps/builder/src/builder/stores/inspectorActions.ts` - `updateSelectedPropertiesWithChildren`
- `apps/builder/src/builder/hooks/useSyncChildProp.ts` - 직계 자식 prop 동기화 훅
- `apps/builder/src/builder/hooks/useSyncGrandchildProp.ts` - 손자 prop 동기화 훅
