---
title: Component Lifecycle Pattern
impact: HIGH
impactDescription: 잘못된 생명주기 = 요소 누락, 고아 요소 발생
tags: [domain, component, lifecycle]
---

컴포넌트 생성/수정/삭제의 생명주기를 정의합니다.

> **정본**: mutation 순서는 `.claude/rules/state-management.md` §Canonical sync 호출 순서 (canonical merge → set → `_rebuildIndexes` → persist).

## 생명주기 단계

```
생성: Definition → Element → Canonical Merge → History → Store(set) → Index → DB(persist) → Preview(자동)
수정: Validate → History → Canonical/Store → Index → DB → Preview
삭제: Cascade Check → History(canonicalEvents) → Canonical → Store(set) → DB → Preview
```

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
  type: string; // Element 식별자 필드는 type (ADR-113 — tag 아님)
  parent: Omit<Element, "id" | "created_at" | "updated_at">;
  children: ChildDefinition[]; // ← 1레벨 자식 배열
}
```

- `id`, `created_at`, `updated_at`, `parent_id`는 생성 시 자동 할당되므로 Definition에서 제외
- `children` 필드가 optional이므로 리프 노드(Label, Image 등)는 `children`을 생략
- 자식 순서는 배열 위치가 SSOT (ADR-118) — 별도 순번 필드 없음

### createElementsFromDefinition 재귀 생성 패턴

내부 `processChildren()` 함수가 중첩 `children`을 재귀적으로 순회하며 Element 객체를 생성합니다.

```typescript
// apps/builder/src/builder/factories/utils/elementCreation.ts (요약)
export function createElementsFromDefinition(
  definition: ComponentDefinition,
  context?: ElementCreationContext, // pageId / layoutId / doc
): { parent: Element; children: Element[] } {
  const parent: Element = withFrameElementMirrorId(
    {
      ...definition.parent,
      id: ElementUtils.generateId(),
      customId: generateCustomId(
        getCustomIdType(definition.parent),
        currentElements,
      ),
      page_id: resolvedPageId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    layoutId,
  );

  const allChildren: Element[] = [];

  // 재귀 함수: 중첩 children을 평탄화하여 allChildren에 추가
  function processChildren(
    childDefs: ChildDefinition[],
    parentId: string,
  ): void {
    childDefs.forEach((childDef) => {
      const { children: nestedChildren, ...elementDef } = childDef;
      const child: Element = withFrameElementMirrorId(
        {
          ...elementDef,
          id: ElementUtils.generateId(),
          customId: generateCustomId(/* type 기반 */),
          parent_id: parentId, // ← 재귀 호출 시 부모 ID가 바뀜
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        layoutId,
      );
      allChildren.push(child);

      // 중첩 children 재귀 처리
      if (nestedChildren && nestedChildren.length > 0) {
        processChildren(nestedChildren, child.id); // ← child가 다음 레벨의 부모
      }
    });
  }

  processChildren(definition.children, parent.id);
  return { parent, children: allChildren }; // ← 모든 레벨의 자식이 평탄화된 배열
}
```

**핵심 포인트**:

- `processChildren()`은 `ChildDefinition[]`의 `children` 필드를 분리(destructure)한 후, 남은 필드로 Element를 생성
- 재귀 호출 시 `parentId`를 현재 생성된 child의 ID로 전달하여 올바른 부모-자식 관계 형성
- 최종 반환값은 **평탄화된** 배열 (`allChildren`)로, 모든 레벨의 자식이 포함됨

### Tabs 3-level 계층 생성 예시

Tabs 는 중첩 구조의 대표적 사례입니다 (실코드: `factories/definitions/LayoutComponents.ts`).

```
Tabs → TabList + TabPanels → TabPanel x2
```

```typescript
// apps/builder/src/builder/factories/definitions/LayoutComponents.ts (요약)
return {
  type: "Tabs",
  parent: {
    type: "Tabs",
    props: {
      items, // Tab 시각은 items 기반 self-render (ADR-066 items SSOT)
      defaultSelectedKey: item1Id,
      orientation: "horizontal",
      style: { width: "100%" },
    },
    parent_id: parentId,
  },
  children: [
    // Level 2-A: TabList (리프 — children 없음, items self-render)
    { type: "TabList", props: {} },
    // Level 2-B: TabPanels (중간 컨테이너 — children으로 TabPanel 포함)
    {
      type: "TabPanels",
      props: {},
      children: [
        // ← 재귀 중첩: Level 3
        { type: "TabPanel", props: { itemId: item1Id } },
        { type: "TabPanel", props: { itemId: item2Id } },
      ],
    },
  ],
};
```

`createElementsFromDefinition()`이 이 Definition을 처리하면:

1. **Tabs** (parent) 생성
2. `processChildren(children, tabs.id)` 호출
   - **TabList** 생성 (`parent_id: tabs.id`)
   - **TabPanels** 생성 (`parent_id: tabs.id`)
   - TabPanels에 `children`이 있으므로 `processChildren(nestedChildren, tabPanels.id)` 재귀 호출
     - **TabPanel 1** 생성 (`parent_id: tabPanels.id`)
     - **TabPanel 2** 생성 (`parent_id: tabPanels.id`)
3. 반환: `{ parent: Tabs, children: [TabList, TabPanels, TabPanel1, TabPanel2] }`

> 참고: TagGroup 은 과거 3-level (TagList → Tag×N) 중첩 사례였으나, ADR-097 이후 Tag 자식 element 생성을 중단하고 `items` 기반 chip self-render 로 전환됨 (`factories/definitions/GroupComponents.ts`).

### 복합 컴포넌트 생성 전체 흐름 (canonical-first)

```typescript
// ✅ 복합 컴포넌트 생성 (실코드: stores/utils/elementCreation.ts createAddComplexElementAction)
// 1. Factory에서 Definition 생성 → createElementsFromDefinition 으로 Element 객체화
const { parent, children } = createElementsFromDefinition(
  result.definition,
  context,
);
const allElements = [parent, ...children];

// 2. Canonical document 1차 갱신 (wrapper → mergeElementsCanonicalPrimary)
mergeCreatedElementsIntoCanonicalDocument(allElements);

// 3. History 기록 (canonical event payload — ADR-124)
historyManager.addEntry({
  type: "add",
  elementId: parent.id,
  data: { canonicalEvents: buildCanonicalInsertEvents(allElements) },
});

// 4. derived store 갱신 + 인덱스 재구축
set((prev) => ({
  elements: [...prev.elements, ...allElements],
  layoutVersion: prev.layoutVersion + 1,
}));
get()._rebuildIndexes();

// 5. Preview 동기화는 useIframeMessenger effect 자동 (UPDATE_CANONICAL_DOCUMENT)
// 6. IndexedDB canonical document 저장 (백그라운드)
await persistActiveCanonicalDocument(db);
```

```typescript
// ✅ 단순 요소 생성
const createElement = (type: string, parentId: string) => {
  const element: Element = {
    id: ElementUtils.generateId(),
    customId: generateCustomId(type, elements),
    type,
    parent_id: parentId, // 형제 내 순서는 canonical children 배열 위치 (ADR-118)
    page_id: currentPageId,
    props: getDefaultProps(type),
    created_at: new Date().toISOString(),
  };

  return addElement(element); // createAddElementAction — canonical-first 파이프라인
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

  // History(diff) → Store → Index → DB → Preview
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
};

// ✅ 부모 변경 (이동) — canonical mutation 단일 진입점
// 순서/부모 변경은 projected render ID 가 아닌 canonical target 으로만 수행 (ADR-135)
const canonicalTarget = resolveCanonicalMoveTarget({ ... });
// → apps/builder/src/builder/workspace/canvas/interaction/resolveCanonicalMutationTarget.ts
if (canonicalTarget) {
  moveElementToCanonicalTarget(elementId, canonicalTarget);
  // → apps/builder/src/adapters/canonical/canonicalMutations.ts
}
```

## 3. 삭제 (Delete)

삭제는 3개 레이어로 구성됩니다:

1. **collectElementsToRemove()** — 단일 요소의 연관 요소 수집 (자식 재귀, Table Column/Cell, Tab/Panel 연결)
2. **executeRemoval()** — 공통 실행 (History canonicalEvents + canonical 반영 + 원자적 set() + persist + postMessage)
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
      const result = collectElementsToRemove(id, sourceElements);
      // 결과를 병합 (중복 자동 제거)
    }

    // 2. executeRemoval — 단일 실행
    await executeRemoval(set, get, rootElements, allUniqueElements);
  };
```

### collectElementsToRemove 헬퍼

단일 elementId로부터 삭제해야 할 모든 연관 요소를 수집합니다:

```typescript
function collectElementsToRemove(elementId, elements) {
  // 1. 자식 요소 재귀 수집
  // 2. Table Column 삭제 → 연관 Cell 수집 (element.type === "Column")
  // 3. Table Cell 삭제 → 대응 Column 수집 (element.type === "Cell")
  // 4. Tab/Panel → 연결된 Panel/Tab 수집
  // 5. 중복 제거
  return { rootElement, allElements };
}
```

### executeRemoval 공통 실행

```typescript
async function executeRemoval(set, get, rootElements, allUniqueElements) {
  // 1. History payload 구성 — canonical mutation 전에 구성해 삭제 전 node 위치 보존
  //    data: { canonicalEvents: buildCanonicalRemoveEvents(...) }

  // 2. Skia 레지스트리 즉시 정리 (React useEffect cleanup 지연 우회)
  for (const id of elementIdsToRemove) unregisterSkiaNode(id);

  // 3. canonical document 삭제 반영 (syncRemovedElementsToCanonical)
  // 4. historyManager.addEntry(historyEntry)

  // 5. 원자적 상태 업데이트 — 단일 set()
  set({
    elements,
    elementsMap,
    childrenMap,
    pageIndex,
    // + 선택 상태 정리
  });

  // 6. IndexedDB canonical document 저장 (persistActiveCanonicalDocument)
  // 7. postMessage (Preview 동기화)
}
```

## 요소 순서 — children 배열 SSOT (ADR-118)

order_num 재정렬 파이프라인(`reorderElements` / `elementReorder.ts` / `calculateNextOrderNum`)은 **소멸**했습니다. 형제 간 순서는 canonical document `children` 배열 위치가 단일 SSOT 이며, 순서 변경은 `moveElementToCanonicalTarget` (canonical mutation) 경유로만 수행합니다.

## 참조 파일

- `apps/builder/src/builder/factories/ComponentFactory.ts` - 컴포넌트 팩토리
- `apps/builder/src/builder/factories/types/index.ts` - ChildDefinition, ComponentDefinition 타입
- `apps/builder/src/builder/factories/utils/elementCreation.ts` - 재귀 생성 유틸리티
- `apps/builder/src/builder/factories/definitions/LayoutComponents.ts` - Tabs 중첩 정의
- `apps/builder/src/builder/stores/utils/elementCreation.ts` - Store 액션 (canonical-first)
- `apps/builder/src/builder/stores/utils/elementRemoval.ts` - 삭제 액션 (collectElementsToRemove, executeRemoval, removeElement, removeElements)
- `apps/builder/src/adapters/canonical/canonicalMutations.ts` - `moveElementToCanonicalTarget` (이동/재배치)
- `apps/builder/src/builder/hooks/useGlobalKeyboardShortcuts.ts` - 키보드 Delete → removeElements 배치 호출
