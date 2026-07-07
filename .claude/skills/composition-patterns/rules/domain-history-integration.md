---
title: History Integration Pattern
impact: CRITICAL
impactDescription: 히스토리 미기록 = Undo/Redo 불가, 사용자 데이터 손실
tags: [domain, history, undo-redo]
---

상태 변경 전 반드시 히스토리를 기록합니다.

## 히스토리 아키텍처 (ADR-124 canonical-only history schema)

```typescript
// apps/builder/src/builder/stores/history.ts (요약)
// Hot Cache (메모리) + Cold Storage (IndexedDB, 세션 복구)

export interface HistoryEntry {
  id: string;
  type: "add" | "update" | "remove" | "move" | "batch" | "group" | "ungroup";
  elementId: string;
  elementIds?: string[]; // 다중 요소 작업용
  data: {
    /** ADR-124 primary — canonical event sequence (undo/redo apply 우선 경로) */
    canonicalEvents?: CanonicalHistoryNodeEvent[];
    /** diff 기반 저장 — size 추정용 유지, undo/redo 는 canonicalEvents 우선 */
    diff?: SerializableElementDiff;
    // element / prevElement / prevProps / elements / batchUpdates 등
    // legacy snapshot 필드는 @deprecated (ADR-124 Phase 4) — fallback 경로만 사용
  };
  timestamp: number;
}
```

- 기록 API: `historyManager.addEntry()` / `addDiffEntry()` / `addBatchDiffEntry()` — Command 클래스 패턴 아님
- 신규 mutation 은 `data.canonicalEvents` (예: `buildCanonicalInsertEvents` / `buildCanonicalRemoveEvents`, `stores/history/canonicalHistoryEvents.ts`) 를 payload 로 기록

## Incorrect

```typescript
// ❌ 히스토리 없이 상태 변경
const updateElement = (elementId: string, props: Props) => {
  set({
    elements: state.elements.map((el) =>
      el.id === elementId ? { ...el, props: { ...el.props, ...props } } : el,
    ),
  });
  // 히스토리 기록 누락!
};

// ❌ 상태 변경 후 히스토리 기록 (순서 오류)
set({ elements: newElements });
historyManager.addEntry({ ... }); // 이미 변경된 후 기록
```

## Correct

```typescript
import { historyManager } from "@/builder/stores/history";

// ✅ 히스토리 기록 → 상태 변경 순서 (diff 기반)
const updateElementProps = (elementId: string, props: Props) => {
  const element = getElementById(get().elementsMap, elementId);
  if (!element) return;

  // 1. 변경 전 히스토리 기록
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

// ✅ 요소 추가 시 — canonical event payload (실코드: stores/utils/elementCreation.ts)
const addElement = (element: Element) => {
  mergeCreatedElementsIntoCanonicalDocument([element]); // canonical 1차 갱신

  historyManager.addEntry({
    type: "add",
    elementId: element.id,
    data: { canonicalEvents: buildCanonicalInsertEvents([element]) },
  });

  set((prev) => ({ elements: [...prev.elements, element] }));
  get()._rebuildIndexes();
};

// ✅ 배치 작업 시
historyManager.addBatchDiffEntry(prevElements, nextElements);
```

## Child Composition Pattern batch 히스토리

Property Editor에서 부모 Element와 자식 Element를 동시에 업데이트할 때, 두 변경사항을 **단일 batch 히스토리 엔트리**로 기록해야 합니다. 별도 엔트리로 기록하면 Undo 시 부모와 자식이 따로 원복되어 불일치 상태가 발생합니다.

### `updateSelectedPropertiesWithChildren` 동작 원리

`inspectorActions.ts`의 `updateSelectedPropertiesWithChildren`은 `batchUpdateElementProps`를 통해 부모+자식을 단일 `set()` 호출로 처리합니다.

```typescript
// inspectorActions.ts (요약)
updateSelectedPropertiesWithChildren: (properties, childUpdates) => {
  // 1. 진행 중인 hydration 취소 (race condition 방지)
  get()._cancelHydrateSelectedProps();

  // 2. 부모 + 자식 업데이트를 단일 batch로 구성
  const batch: BatchPropsUpdate[] = [
    { elementId: element.id, props: sanitizeInspectorProps(properties) },
    ...childUpdates, // BatchPropsUpdate[]
  ];

  // 3. 단일 set() + batch 히스토리 엔트리 + IndexedDB 저장
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

### Incorrect

```typescript
// ❌ 부모와 자식을 별도 호출로 업데이트
// 히스토리 엔트리 2개 생성 → Undo 2회 필요
onUpdate({ label: value }); // 히스토리 엔트리 1
updateChildProp("Label", "children", value); // 히스토리 엔트리 2
```

### Correct

```typescript
// ✅ childUpdates 를 직접 구성해 updateSelectedPropertiesWithChildren 호출
// (구 useSyncChildProp / useSyncGrandchildProp 훅은 소멸 — 직접 사용)
// 단일 batch 히스토리 엔트리 → Undo 1회로 전체 원복
const handleLabelChange = useCallback(
  (value: string) => {
    const updatedProps = { ...currentProps, label: value };
    const childUpdates: BatchPropsUpdate[] = [
      { elementId: labelChildId, props: { children: value } },
    ];
    useStore
      .getState()
      .updateSelectedPropertiesWithChildren(updatedProps, childUpdates);
  },
  [currentProps, labelChildId],
);
```

## Undo/Redo 구현 (ADR-124 — canonical events 우선)

`historyActions.ts` 의 Undo/Redo 는 2-단 구조입니다:

```typescript
// historyActions.ts (요약)
// 1. canonical event 경로 (primary): entry.data.canonicalEvents 가 있으면
//    canonical document 에 직접 적용하고 elements 를 derive
const canonicalEventElements = applyCanonicalHistoryEventsToActiveDocument(
  entry.data.canonicalEvents,
  "undo", // 또는 "redo"
);
const appliedCanonicalEvents = canonicalEventElements !== null;

if (canonicalEventElements) {
  updatedElements = canonicalEventElements;
  // 선택 상태 재해석 (resolveSelectionAfterCanonicalEvents)
} else {
  // 2. legacy snapshot fallback: entry.type 별 switch
  switch (entry.type) {
    case "add":
      /* 추가된 요소 제거 (역작업) */ break;
    case "update":
      /* diff 또는 prevElement 로 복원 */ break;
    case "remove":
      /* 제거된 요소 복원 */ break;
    case "batch":
      /* batch 포함 요소 일괄 복원 */ break;
  }
}

// legacy fallback 경로만 canonical 후행 동기화 필요
if (!appliedCanonicalEvents) {
  syncHistoryElementsToCanonical(updatedElements);
  // ⚠️ set 1차 → canonical 2차 잔존 패턴 — ADR-122 §Residual.
  //    정본: .claude/rules/state-management.md §잔존 영역 (신규 코드에서 모방 금지)
}
```

## 배치 삭제 히스토리 패턴

`removeElements(ids[])` 배치 삭제 시 **단일 히스토리 entry**로 기록합니다.
payload 는 canonical remove event sequence — canonical mutation **전에** 구성해 삭제 전 node 위치를 보존합니다 (실코드: `elementRemoval.ts` `executeRemoval`).

```typescript
// ✅ 배치 삭제 히스토리 — 단일 entry (canonicalEvents)
historyManager.addEntry({
  type: "remove",
  elementId: rootElements[0].id,
  data: {
    canonicalEvents: buildCanonicalRemoveEvents(/* 삭제 대상 전체 */),
  },
});
// → Undo 1회로 모든 요소 동시 복원

// ❌ 순차 삭제 히스토리 — N개 entry
// → Undo N회 필요 (하나씩 복원)
```

## 참조 파일

- `apps/builder/src/builder/stores/history.ts` - HistoryManager (`addEntry` / `addDiffEntry` / `addBatchDiffEntry`)
- `apps/builder/src/builder/stores/history/historyActions.ts` - Undo/Redo 액션 (canonical events 우선 + legacy fallback)
- `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts` - `buildCanonicalInsertEvents` / `buildCanonicalRemoveEvents` / `applyCanonicalHistoryEventsToActiveDocument`
- `apps/builder/src/builder/stores/utils/elementUpdate.ts` - 히스토리 통합 예시
- `apps/builder/src/builder/stores/utils/elementRemoval.ts` - 삭제 히스토리 (단일/배치)
- `apps/builder/src/builder/stores/inspectorActions.ts` - `updateSelectedPropertiesWithChildren`
