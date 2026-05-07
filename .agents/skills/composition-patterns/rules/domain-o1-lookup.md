---
title: O(1) Lookup Pattern
impact: CRITICAL
impactDescription: O(n) 검색 = 성능 저하, 대규모 데이터 처리 실패
tags: [domain, performance, indexing]
---

Element 조회 시 O(1) 인덱스 기반 검색을 사용합니다.

## Store 인덱스 구조

```typescript
interface ElementsState {
  elements: Element[]; // 원본 배열 (순서 보존)
  elementsMap: Map<string, Element>; // O(1) ID 검색
  childrenMap: Map<string, Element[]>; // O(1) 부모→자식 검색
  pageIndex: PageElementIndex; // O(1) 페이지별 검색
}
```

## Incorrect

```typescript
// ❌ 배열 순회 (O(n))
const element = elements.find((el) => el.id === elementId);

// ❌ 자식 검색에 filter 사용 (O(n))
const children = elements.filter((el) => el.parent_id === parentId);

// ❌ 페이지 요소 검색에 filter 사용 (O(n))
const pageElements = elements.filter((el) => el.page_id === pageId);

// ❌ 중첩 순회 (O(n²))
elements.forEach((el) => {
  const parent = elements.find((p) => p.id === el.parent_id);
});
```

## Correct

```typescript
// ✅ Map 기반 O(1) 검색
import {
  getElementById,
  getChildElements,
} from "@/builder/stores/utils/elementHelpers";

// ID로 요소 검색 - O(1)
const element = getElementById(elementsMap, elementId);
// 또는 직접 Map 접근
const element = elementsMap.get(elementId);

// 자식 요소 검색 - O(1)
const children = getChildElements(childrenMap, parentId);
// 또는 직접 Map 접근
const children = childrenMap.get(parentId) ?? [];

// 페이지 요소 검색 - O(1)
import { getPageElementsFromIndex } from "@/builder/stores/utils/elementIndexer";

const pageElementIds = pageIndex.elementsByPage.get(pageId);
const pageElements = pageElementIds
  ? Array.from(pageElementIds).map((id) => elementsMap.get(id)!)
  : [];

// ✅ 컴포넌트에서 사용
const element = useStore((state) => state.elementsMap.get(elementId));
const children = useStore((state) => state.childrenMap.get(parentId) ?? []);
```

## 인덱스 재구성

```typescript
// 요소 변경 후 인덱스 재구성 필수
set({ elements: newElements });
get()._rebuildIndexes(); // elementsMap, childrenMap, pageIndex 갱신

// ✅ updateElementOrder — legacy mirror 정규화 경계에서만 사용
updateElementOrder(elementId, newOrderNum);

// ✅ batchUpdateElementOrders — 단일 set() + _rebuildIndexes()
// N개 요소의 legacy order_num mirror를 한번에 업데이트 (N×set() 방지)
batchUpdateElementOrders([
  { id: "el-1", order_num: 0 },
  { id: "el-2", order_num: 1 },
]);
```

canonical cutover 경로에서 runtime order read/write는 parent `children[]`
index가 SSOT입니다. `order_num`은 export/compat mirror이므로, props update나
hydration 경로가 stale `order_num`만 보고 sibling 위치를 바꾸지 않게 합니다.

## 선택 상태 동기화

Store에는 선택 관련 상태가 3개 존재하며, **요소 삭제 시 모두 갱신** 필수:

```typescript
interface SelectionState {
  selectedElementId: string | null; // 단수 (속성 패널용)
  selectedElementIds: string[]; // 복수 배열 (다중 선택)
  selectedElementIdsSet: Set<string>; // O(1) 포함 여부 검사
}
```

### Incorrect

```typescript
// ❌ selectedElementId만 초기화 → selectedElementIds에 삭제된 ID 잔존
set({
  selectedElementId: null,
  selectedElementProps: {},
});
// SelectionLayer가 selectedElementIds를 구독 → stale ID로 bounds 조회 실패 → (0,0)에 SelectionBox 잔존
```

### Correct

```typescript
// ✅ 삭제 시 3개 상태 모두 갱신
const removeSet = new Set(elementIdsToRemove);
const filteredSelectedIds = currentState.selectedElementIds.filter(
  (id: string) => !removeSet.has(id),
);

set({
  selectedElementId: null,
  selectedElementProps: {},
  selectedElementIds: filteredSelectedIds,
  selectedElementIdsSet: new Set(filteredSelectedIds),
});
```

## 참조 파일

- `apps/builder/src/builder/stores/elements.ts` - 인덱스 정의
- `apps/builder/src/builder/stores/utils/elementHelpers.ts` - O(1) 헬퍼
- `apps/builder/src/builder/stores/utils/elementIndexer.ts` - 페이지 인덱스
- `apps/builder/src/adapters/canonical/canonicalMutations.ts` - canonical `children[]` order write
