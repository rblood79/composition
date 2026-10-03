---
title: Use Map/Set for O(1) Lookups
impact: MEDIUM
impactDescription: 검색 성능 최적화, 대용량 데이터 처리
tags: [performance, data-structures, optimization]
---

빈번한 검색/존재 확인에는 Array 대신 Map/Set을 사용합니다.

## Incorrect

```tsx
// ❌ Array.find - O(n) 복잡도
const elements: Element[] = [...];

function getElementById(id: string) {
  return elements.find(el => el.id === id);  // 매번 전체 순회
}

function isSelected(id: string) {
  return selectedIds.includes(id);  // O(n)
}

// 반복 호출 시 성능 저하
elements.forEach(el => {
  if (isSelected(el.id)) {  // O(n) × O(n) = O(n²)
    highlight(el);
  }
});
```

## Correct

```tsx
// ✅ Map으로 O(1) 검색
const byId = new Map<string, Element>(elements.map((el) => [el.id, el]));

function getElementById(id: string) {
  return byId.get(id); // O(1)
}

// ✅ Set으로 O(1) 존재 확인
const selectedSet = new Set(selectedIds);

function isSelected(id: string) {
  return selectedSet.has(id); // O(1)
}

// O(n) 으로 개선
elements.forEach((el) => {
  if (selectedSet.has(el.id)) {
    // O(1)
    highlight(el);
  }
});

// ✅ React에서 메모이제이션과 함께
const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
```
