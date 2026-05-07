---
title: Async Pipeline Pattern
impact: CRITICAL
impactDescription: 파이프라인 순서 오류 = UI 불일치, 데이터 유실
tags: [domain, async, pipeline]
---

요소 변경 시 비동기 파이프라인 순서를 준수합니다.

## 파이프라인 순서

```
1. Memory Update (즉시) → UI 반응
2. Index Rebuild (즉시) → 검색 가능
3. Layout Version Bump (즉시, 조건부) → fullTreeLayoutMap 재계산 트리거
4. History Record (즉시) → Undo 가능
5. IndexedDB Persist (백그라운드) → 영구 저장
6. Preview Sync (백그라운드) → iframe 동기화
```

> **Step 3 조건**: `LAYOUT_AFFECTING_PROPS`(`style`, `size`, `label`, `children`, `text`, `placeholder`, `orientation`, `items`) 중 하나 이상 변경 시 `layoutVersion + 1`. 비-레이아웃 변경(color, opacity 등)은 스킵.

## Incorrect

```typescript
// ❌ DB 저장 완료까지 대기 (UI 블로킹)
const addElement = async (element: Element) => {
  const db = await getDB();
  await db.elements.insert(element);  // 블로킹!
  set({ elements: [...elements, element] });
};

// ❌ 인덱스 재구성 누락
set({ elements: newElements });
// _rebuildIndexes() 호출 안 함 → elementsMap 불일치

// ❌ Preview 동기화를 동기적으로 처리
const updateElement = (id, props) => {
  set({ ... });
  messenger.sendElementUpdated(id, props);  // 동기 처리
  await waitForPreviewAck();  // 불필요한 대기
};
```

## Correct

```typescript
// ✅ 올바른 파이프라인 순서
export const createAddElementAction =
  (set, get) => async (element: Element) => {
    const state = get();

    // 1. Memory Update (즉시) - UI 즉시 반응
    set({ elements: [...state.elements, element] });

    // 2. Index Rebuild (즉시) - O(1) 검색 보장
    get()._rebuildIndexes();

    // 3. History Record (즉시) - Undo 즉시 가능
    historyManager.addEntry({
      type: "add",
      elementId: element.id,
      data: { element: structuredClone(element) },
    });

    // 4. IndexedDB Persist (백그라운드) - 비블로킹
    setTimeout(async () => {
      const db = await getDB();
      await db.elements.insert(sanitizeElement(element));
    }, 0);

    // 5. Preview Sync (백그라운드) - WebGL 모드가 아닐 때만
    if (!isWebGLCanvas()) {
      setTimeout(() => {
        deltaMessenger.sendElementAdded(element);
      }, 0);
    }
  };

// ✅ 배치 작업도 동일 패턴
export const batchUpdateElements = (updates: Update[]) => {
  // 1-3: 동기 작업 (즉시)
  set({ elements: applyUpdates(elements, updates) });
  get()._rebuildIndexes();
  historyManager.addBatchEntry(updates);

  // 4-5: 비동기 작업 (백그라운드)
  queueMicrotask(async () => {
    await persistUpdates(updates);
    syncToPreview(updates);
  });
};
```

## 주의사항

```typescript
// ✅ structuredClone으로 히스토리용 복사 (참조 분리)
historyManager.addEntry({
  data: { element: structuredClone(element) }, // 깊은 복사
});

// ✅ sanitizeElement로 DB 저장 전 정리
await db.elements.insert(sanitizeElement(element));
```

## 배치 삭제 파이프라인 (removeElements)

다중 요소 동시 삭제 시 `removeElements(ids[])`를 사용합니다.
순차 `for...await removeElement(id)` 호출은 **금지** — 각 호출마다 set() → 렌더 발생으로 요소가 하나씩 사라짐.

```typescript
// ✅ 배치 삭제 — 단일 파이프라인 실행
await removeElements(deletableIds);
// → collectElementsToRemove() × N → 병합 → executeRemoval() 1회
//   1. IndexedDB deleteMany (1회)
//   2. History addEntry (1건)
//   3. Skia unregisterSkiaNode (즉시)
//   4. set() (1회, 원자적)
//   5. postMessage (1회)

// ❌ 순차 삭제 — N번 파이프라인 실행
for (const id of ids) {
  await removeElement(id);
}
```

## Order / canonical move 파이프라인

canonical cutover 이후 runtime order는 parent `children[]` index가 SSOT입니다.
`Element.order_num`과 legacy reorder APIs는 제거됐습니다. 비동기 콜백에서는
최신 state를 읽어 canonical move intent만 적용합니다.

```typescript
// ✅ 비동기 콜백에서 항상 get()으로 최신 state 참조
queueMicrotask(() => {
  const { currentPageId } = get();
  if (currentPageId) {
    moveElementCanonicalPrimary(elementId, parentId, insertionIndex);
  }
});

// ❌ 외부에서 캡처한 stale 상태 사용 — 비동기 실행 시 이미 변경됨
const { elements } = get();
setTimeout(() => {
  // captured elements로 canonical order를 재계산하지 않는다
}, 100);

// ❌ props update에서 stale Element source order를 canonical children[] reorder intent로 해석
```

## layoutVersion 계약 (ADR-012 P4)

`fullTreeLayoutMap` useMemo는 `layoutVersion` 카운터에 의존합니다. 레이아웃 영향 변경 시 반드시 카운터를 증가시켜야 합니다.

```typescript
// ✅ Store 내부: set() 내에서 layoutVersion 증가
set((state) => ({
  elements: newElements,
  layoutVersion: state.layoutVersion + 1,
}));

// ✅ Store 외부(텍스트 측정기 교체, 폰트 로딩 등): invalidateLayout() 호출
useStore.getState().invalidateLayout();

// ✅ inspectorActions: LAYOUT_AFFECTING_PROPS 체크 후 조건부 증가
const LAYOUT_AFFECTING_PROPS = new Set([
  "style",
  "size",
  "label",
  "children",
  "text",
  "placeholder",
  "orientation",
  "items",
]);
const hasLayoutChange = Object.keys(propsUpdate).some((key) =>
  LAYOUT_AFFECTING_PROPS.has(key),
);
if (hasLayoutChange)
  set((state) => ({ layoutVersion: state.layoutVersion + 1 }));

// ❌ layoutVersion 미증가 → fullTreeLayoutMap 재계산 스킵 → 크기 고정
set({ elements: newElements }); // layoutVersion 변경 없음!
```

## 참조 파일

- `apps/builder/src/builder/stores/utils/elementCreation.ts` - 추가 파이프라인
- `apps/builder/src/builder/stores/utils/elementUpdate.ts` - 업데이트 파이프라인
- `apps/builder/src/builder/stores/utils/elementRemoval.ts` - 삭제 파이프라인 (단일/배치)
- `apps/builder/src/adapters/canonical/canonicalMutations.ts` - canonical `children[]` move/reorder
- `apps/builder/src/builder/stores/inspectorActions.ts` - 프로퍼티 업데이트 + layoutVersion 증가
- `apps/builder/src/builder/utils/canvasDeltaMessenger.ts` - Delta 동기화
