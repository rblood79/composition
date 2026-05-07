---
title: Component Lifecycle Pattern
impact: HIGH
impactDescription: 잘못된 생명주기 = 요소 누락, 고아 요소 발생
tags: [domain, component, lifecycle]
---

컴포넌트 생성/수정/삭제의 생명주기를 정의합니다.

## 생명주기 단계

```
생성: Definition → Element → Store → Index → History → DB → Preview
수정: Validate → History → Store → Index → DB → Preview
삭제: Cascade Check → History → Store → Index → DB → Preview
```

canonical cutover 이후에는 Store 단계에서 canonical document write가 먼저
일어나고, legacy `Element[]`는 `exportLegacyDocument()` mirror로 재파생됩니다.
순서는 canonical parent `children[]` index가 SSOT입니다. `Element.order_num`은
제거됐으므로 생성/수정/삭제/history/DB payload에 추가하지 않습니다.

## 1. 생성 (Create)

### ChildDefinition 재귀 타입

`ChildDefinition`은 `children?: ChildDefinition[]` optional 필드를 포함하는 재귀 타입으로, 무한 깊이의 중첩 컴포넌트 계층을 정의할 수 있습니다.

```typescript
// apps/builder/src/builder/factories/types/index.ts
export type ChildDefinition = Omit<
  Element,
  "id" | "created_at" | "updated_at" | "parent_id"
> & {
  children?: ChildDefinition[]; // ← 재귀: 자식도 같은 타입
};

export interface ComponentDefinition {
  type: string;
  parent: Omit<Element, "id" | "created_at" | "updated_at">;
  children: ChildDefinition[]; // ← 1레벨 자식 배열
}
```

- `id`, `created_at`, `updated_at`, `parent_id`는 생성 시 자동 할당되므로 Definition에서 제외
- `children` 필드가 optional이므로 리프 노드(Tag, Label 등)는 `children`을 생략

### createElementsFromDefinition 재귀 생성 패턴

내부 `processChildren()` 함수가 중첩 `children`을 재귀적으로 순회하며 Element 객체를 생성합니다.

```typescript
import { ComponentFactory } from '@/builder/factories/ComponentFactory';
import { createElementsFromDefinition } from '@/builder/factories/utils/elementCreation';

// apps/builder/src/builder/factories/utils/elementCreation.ts
export function createElementsFromDefinition(
  definition: ComponentDefinition
): { parent: Element; children: Element[] } {
  const parent: Element = { ...definition.parent, id: generateId(), ... };

  const allChildren: Element[] = [];

  // 재귀 함수: 중첩 children을 평탄화하여 allChildren에 추가
  function processChildren(childDefs: ChildDefinition[], parentId: string): void {
    childDefs.forEach((childDef) => {
      const { children: nestedChildren, ...elementDef } = childDef;
      const child: Element = {
        ...elementDef,
        id: generateId(),
        customId: generateCustomId(elementDef.type, allElementsSoFar),
        parent_id: parentId,       // ← 재귀 호출 시 부모 ID가 바뀜
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      allChildren.push(child);

      // 중첩 children 재귀 처리
      if (nestedChildren && nestedChildren.length > 0) {
        processChildren(nestedChildren, child.id);  // ← child가 다음 레벨의 부모
      }
    });
  }

  processChildren(definition.children, parent.id);
  return { parent, children: allChildren };  // ← 모든 레벨의 자식이 평탄화된 배열
}
```

**핵심 포인트**:

- `processChildren()`은 `ChildDefinition[]`의 `children` 필드를 분리(destructure)한 후, 남은 필드로 Element를 생성
- 재귀 호출 시 `parentId`를 현재 생성된 child의 ID로 전달하여 올바른 부모-자식 관계 형성
- 최종 반환값은 **평탄화된** 배열 (`allChildren`)로, 모든 레벨의 자식이 포함됨

### TagGroup 3-level 계층 생성 예시

TagGroup은 3레벨 중첩 구조의 대표적 사례입니다.

```
TagGroup (column) → Label("Tag Group") + TagList (row wrap) → Tag x2
```

```typescript
// apps/builder/src/builder/factories/definitions/GroupComponents.ts
export function createTagGroupDefinition(context): ComponentDefinition {
  return {
    type: "TagGroup",
    parent: {
      type: "TagGroup",
      props: {
        label: "Tag Group",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 2,
          width: "fit-content",
        },
      },
      parent_id: parentId,
    },
    children: [
      // Level 2-A: Label (리프 노드 - children 없음)
      {
        type: "Label",
        props: {
          children: "Tag Group",
          style: { fontSize: 12, fontWeight: 500 },
        },
      },
      // Level 2-B: TagList (중간 컨테이너 - children으로 Tag 포함)
      {
        type: "TagList",
        props: {
          style: {
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4,
          },
        },
        children: [
          // ← 재귀 중첩: Level 3
          {
            type: "Tag",
            props: { children: "Tag 1" },
          },
          {
            type: "Tag",
            props: { children: "Tag 2" },
          },
        ],
      },
    ],
  };
}
```

`createElementsFromDefinition()`이 이 Definition을 처리하면:

1. **TagGroup** (parent) 생성
2. `processChildren(children, tagGroup.id)` 호출
   - **Label** 생성 (`parent_id: tagGroup.id`)
   - **TagList** 생성 (`parent_id: tagGroup.id`)
   - TagList에 `children`이 있으므로 `processChildren(nestedChildren, tagList.id)` 재귀 호출
     - **Tag 1** 생성 (`parent_id: tagList.id`)
     - **Tag 2** 생성 (`parent_id: tagList.id`)
3. 반환: `{ parent: TagGroup, children: [Label, TagList, Tag1, Tag2] }`

### 복합 컴포넌트 생성 전체 흐름

```typescript
// ✅ 복합 컴포넌트 생성 (Tabs, Table, TagGroup 등)
const createComponent = async (
  type: string,
  parentId: string,
  pageId: string,
) => {
  // 1. Factory에서 Definition 생성
  const result = await ComponentFactory.createComplexComponent(
    type,
    parentElement,
    pageId,
    elements,
    layoutId,
  );

  // 2. Element 객체 생성 (ID, customId, timestamps)
  const { parent, children } = createElementsFromDefinition(result.definition);

  // 3. Store 업데이트
  set({ elements: [...elements, parent, ...children] });
  get()._rebuildIndexes();

  // 4. History 기록
  historyManager.addEntry({
    type: "add",
    elementId: parent.id,
    data: { element: parent, children },
  });

  // 5. DB 저장 (백그라운드)
  await persistElements([parent, ...children]);

  // 6. Preview 동기화
  deltaMessenger.sendElementAdded(parent, children);

  return parent;
};

// ✅ 단순 요소 생성
const createElement = (type: string, parentId: string) => {
  const element: Element = {
    id: ElementUtils.generateId(),
    customId: generateCustomId(type, elements),
    type,
    parent_id: parentId,
    page_id: currentPageId,
    props: getDefaultProps(type),
    created_at: new Date().toISOString(),
  };

  return addElement(element);
};
```

## 2. 수정 (Update)

```typescript
// ✅ Props 수정
const updateElementProps = (elementId: string, props: Partial<Props>) => {
  const element = getElementById(elementsMap, elementId);
  if (!element) return;

  // 변경 여부 확인 (불필요한 업데이트 방지)
  if (!hasShallowPatchChanges(element.props, props)) return;

  // History → Store → Index → DB → Preview
  historyManager.addDiffEntry("update", element, {
    ...element,
    props: { ...element.props, ...props },
  });

  set({
    elements: elements.map((el) =>
      el.id === elementId ? { ...el, props: { ...el.props, ...props } } : el,
    ),
  });
  get()._rebuildIndexes();

  persistElementUpdate(elementId, props);
  deltaMessenger.sendElementUpdated(elementId, props);
};

// ✅ 부모 변경 (이동)
const moveElement = (
  elementId: string,
  newParentId: string,
  insertionIndex: number,
) => {
  const element = getElementById(elementsMap, elementId);

  historyManager.addEntry({
    type: "move",
    elementId,
    data: {
      prevParentId: element.parent_id,
      newParentId,
      insertionIndex,
    },
  });

  // 재배치 로직...
};
```

## 3. 삭제 (Delete)

삭제는 3개 레이어로 구성됩니다:

1. **collectElementsToRemove()** — 단일 요소의 연관 요소 수집 (자식, Table Column/Cell, Tab/Panel)
2. **executeRemoval()** — 공통 실행 (DB + History + Skia + 원자적 set() + postMessage + 재정렬)
3. **createRemoveElementAction / createRemoveElementsAction** — 단일/배치 진입점

```typescript
// ✅ 단일 요소 삭제
await removeElement(elementId);

// ✅ 배치 삭제 (다중 요소 동시 제거) — 단일 set()으로 원자적 처리
// 키보드 Delete 키 등 여러 요소를 한번에 삭제할 때 사용
await removeElements([id1, id2, id3]);

// ❌ 순차 삭제 — 각 호출마다 set() → 렌더 발생 → 요소가 하나씩 사라짐
for (const id of ids) {
  await removeElement(id);
}
```

### 배치 삭제 아키텍처 (removeElements)

```typescript
// elementRemoval.ts — 배치 삭제 흐름
export const createRemoveElementsAction =
  (set, get) => async (elementIds: string[]) => {
    // 1. 각 요소에 대해 연관 요소 수집 (자식, Table/Tab 연관)
    for (const id of elementIds) {
      const result = collectElementsToRemove(id, elements, elementsMap);
      // 결과를 allElementsMap에 병합 (중복 자동 제거)
    }

    // 2. executeRemoval — 단일 실행
    await executeRemoval(set, get, rootElements, allUniqueElements);
    // → DB 1회 + History 1건 + Skia 정리 + 단일 set() + postMessage
  };
```

### collectElementsToRemove 헬퍼

단일 elementId로부터 삭제해야 할 모든 연관 요소를 수집합니다:

```typescript
function collectElementsToRemove(elementId, elements, elementsMap) {
  // 1. 자식 요소 재귀 수집
  // 2. Table Column → 연관 Cell 수집
  // 3. Table Cell → 연관 Column + 다른 Cell 수집
  // 4. Tab/Panel → 연결된 Panel/Tab 수집 (tabId 기반)
  // 5. 중복 제거
  return { rootElement, allElements };
}
```

### executeRemoval 공통 실행

```typescript
async function executeRemoval(set, get, rootElements, allUniqueElements) {
  // 1. IndexedDB 배치 삭제
  await db.elements.deleteMany(elementIdsToRemove);

  // 2. History 기록 (첫 루트를 대표, 나머지는 childElements)
  historyManager.addEntry({
    type: "remove",
    elementId: rootElements[0].id,
    data: { element: rootElements[0], childElements: rest },
  });

  // 3. Skia 레지스트리 즉시 정리 (React useEffect cleanup 지연 우회)
  for (const id of elementIdsToRemove) unregisterSkiaNode(id);

  // 4. 원자적 상태 업데이트 — 단일 set()
  set({
    elements,
    elementsMap,
    childrenMap,
    pageIndex,
    componentIndex,
    variableUsageIndex,
    // + 선택 상태 정리 + editingContext 리셋
  });

  // 5. postMessage (Preview 동기화)
  // 6. explicit reorder는 canonical children[] move API만 사용
}
```

## Order / Reorder 경계

runtime order는 canonical `children[]` index가 SSOT입니다. 삭제/Undo/Redo 후
order 복원이 필요하면 canonical/source snapshot을 저장하고
`moveElementCanonicalPrimary(...)` 또는 canonical document action으로 복원합니다.
제거된 legacy order API를 재도입하지 않습니다.

```typescript
moveElementCanonicalPrimary(elementId, parentId, insertionIndex);

// ❌ removed legacy APIs:
// updateElementOrder(...)
// batchUpdateElementOrders(...)
// reorderElements(...)
```

## 참조 파일

- `apps/builder/src/builder/factories/ComponentFactory.ts` - 컴포넌트 팩토리
- `apps/builder/src/builder/factories/types/index.ts` - ChildDefinition, ComponentDefinition 타입
- `apps/builder/src/builder/factories/utils/elementCreation.ts` - 재귀 생성 유틸리티
- `apps/builder/src/builder/factories/definitions/GroupComponents.ts` - TagGroup 3-level 정의
- `apps/builder/src/builder/stores/utils/elementCreation.ts` - Store 액션
- `apps/builder/src/builder/stores/utils/elementRemoval.ts` - 삭제 액션 (collectElementsToRemove, executeRemoval, removeElement, removeElements)
- `apps/builder/src/adapters/canonical/canonicalMutations.ts` - canonical primary merge/set/move
- `apps/builder/src/adapters/canonical/exportLegacyDocument.ts` - legacy Element[] mirror export
- `apps/builder/src/builder/hooks/useGlobalKeyboardShortcuts.ts` - 키보드 Delete → removeElements 배치 호출
