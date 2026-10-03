---
title: O(1) Lookup Pattern
impact: CRITICAL
impactDescription: O(n) 검색 = 성능 저하, 대규모 데이터 처리 실패
tags: [domain, performance, indexing]
---

요소 조회는 graph · record 의 Map 인덱스로 합니다. 명령과 패널은 문서를 스캔하지 않습니다.

> 옛 `ElementsState { elements, elementsMap, childrenMap, pageIndex }` · `_rebuildIndexes` · `getElementById` / `getPageElementsFromIndex` 와 선택 3종 (`selectedElementId` / `selectedElementIds` / `selectedElementIdsSet`) 은 ADR-248 Phase 4 (2026-10-03) 에서 삭제됐습니다. `useStore` · `elementsMap` · `childrenMap` 를 새로 만들지 않습니다 ([state-management.md §1](../../../rules/state-management.md)).

## 인덱스 구조

**문서 — `CatalogGraph`** (`packages/shared/src/catalog/document/graph.ts`): entry table 과 내부 Map 인덱스 (`ownerByChild` · `ownerIndex` · `definitionIndex` · `refIndex` · `collectionIndex` · `htmlIdIndex` …) 를 commit 때 **증분 갱신**합니다. 수동 재구성 단계가 없습니다. entry 는 frozen 사본입니다.

| 읽기                           | API                                         |
| ------------------------------ | ------------------------------------------- |
| id → entry                     | `graph.getEntry(id)`                        |
| 자식                           | `NodeEntry.children` (id 배열) → `getEntry` |
| 부모 (소유자)                  | `graph.ownerOf(id)`                         |
| 참조자 (변수 · interaction 등) | `graph.referrersOf(id)`                     |
| 정의의 instance                | `graph.instancesOf(definitionId)`           |
| collection 바인딩 노드         | `graph.bindingsOf(collectionId)`            |
| HTML id                        | `graph.nodesWithHtmlId(htmlId)`             |
| 공개 인덱스 스냅샷             | `GraphIndexes`                              |

**해석된 record — composition root** (`catalogRuntime/compositionRoot.ts`): `canvasInputs` / `domInputs` / `layoutInputs` 는 같은 `Map<identity, CatalogConsumerNode>` (`parentId` · `children` 포함) 입니다. Canvas · overlay 의 부모 · 자식 탐색은 이 Map 으로 합니다.

**패널 · UI 구독** (`catalogRuntime/react.tsx`):

- `useCatalogSession(select)` — 선택 · 페이지 · hover 등 session field 하나
- `useCatalogRows(parent)` — Layers 행 (`readModel.pageRows` / `childRows`)
- `useCatalogPropSource(target, key)` — prop 값과 출처
- `runtime.subscribeEntryField` / `subscribeResolvedField` — field 단위 구독. step 전체 구독 (`subscribeSteps`) 은 집계가 필요한 곳만

## 선택

선택은 `CatalogSessionState.selection: CatalogSelectionItem[]` (`{ target, identity }`) 하나입니다 (`catalogRuntime/session.ts`). step 마다 `reconcile()` 이 더 이상 보이지 않는 항목을 걸러내므로, 삭제 뒤 선택을 수동으로 정리하지 않습니다.

## Incorrect

```typescript
// ❌ 문서 · record 를 배열로 스캔
const node = [...graph.entries()].find((entry) => entry.id === id);
const children = [...root.canvasInputs.values()].filter(
  (r) => r.parentId === id,
);

// ❌ 렌더마다 step 전체를 구독해 다시 계산
runtime.subscribeSteps(() => setRows(computeAllRows()));
```

## Correct

```typescript
// ✅ O(1)
const entry = graph.getEntry(id);
const record = root.canvasInputs.get(identity);
const children = record?.children.map((childId) =>
  root.canvasInputs.get(childId),
);

// ✅ field 단위 구독
const selection = useCatalogSession((state) => state.selection);
```

## 참조 파일

- `packages/shared/src/catalog/document/graph.ts` — `CatalogGraph` 인덱스 · 읽기 API
- `apps/builder/src/builder/catalogRuntime/compositionRoot.ts` — record Map
- `apps/builder/src/builder/catalogRuntime/react.tsx` · `readModel.ts` · `session.ts` · `controller.ts`
