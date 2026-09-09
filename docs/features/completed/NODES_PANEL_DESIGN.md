# Nodes Panel Tree Base Design (Panel System First)

> **경로 대조 (2026-09-09)**: 아래 본문이 인용하는 코드 경로 중 7개는 현재 저장소에 없다.
> 문서가 기술하는 기능 자체는 남아 있으나 파일 위치·이름이 이후 구조 변경으로 달라졌다.
> 구조가 바뀐 자리는 이렇게 대응한다 — `builder/inspector/**` → `builder/panels/**`, `builder/panels/data/**` → `builder/panels/datatable/**`, `builder/panels/nodes/**` · `builder/nodes/**` → `builder/panels/navigator/**`. 나머지는 삭제됐다.
>
> <details><summary>존재하지 않는 경로 7개</summary>
>
> - `src/builder/config/featureFlags.ts`
> - `src/builder/hooks/useSidebarTabs.ts`
> - `src/builder/panels/nodes/tree/TreeBase/useFocusManagement.ts`
> - `src/builder/panels/nodes/tree/TreeBase/useTreeVirtual.ts`
> - `src/builder/sidebar/VirtualizedLayerTree.tsx`
> - `src/builder/sidebar/treeHelpers.ts`
> - `src/builder/stores/history/historyManager.ts`
>
> </details>


> 작성일: 2025-12-25
> 상태: **전체 완료** (Phase 1-3 모두 완료)
> 기준 버전: react-aria-components v1.14
> 최종 검토: 2025-12-26
> 문서 버전: 1.8

본 문서는 패널 시스템 기준으로 NodesPanel의 Page/Layer 트리를
react-aria Tree 기반의 공통 베이스로 통합하기 위한 설계서다.

---

## 배경/문제

- 좌측 UI가 Sidebar 기반이며, 패널 시스템과 기능이 중복되어 유지보수 리스크가 큼.
- Page/Layer 트리 렌더링이 커스텀 구조와 혼재되어 구조적 완성도가 떨어짐.
- Tree 컴포넌트를 도입했지만 도메인 규칙(DnD, 가상 자식, selection)이 분산됨.

---

## 목표

1. 패널 시스템을 단일 진입점으로 확정 (단일 오너십)
2. react-aria Tree 기반의 공통 Tree 베이스 구축
3. PageTree/LayerTree를 동일한 상태 모델과 DnD 계약으로 통합
4. Sidebar는 임시 어댑터 역할만 수행 (최종 제거 가능)

---

## 비범위

- WebGL 캔버스 자체 구현 변경
- 신규 기능/UX 추가 (동등성 유지 우선)

---

## 대상 구조

```
src/builder/panels/nodes/           # ✅ 통합 완료 (2025-12-26)
  NodesPanel.tsx                    # 메인 패널 (단일 진입점)
  NodesPanel.css                    # 패널 스타일
  NodesPanelTabs.tsx                # Pages/Layouts 탭 전환
  PagesSection.tsx                  # Pages 섹션 컴포넌트
  LayersSection.tsx                 # Layers 섹션 컴포넌트
  LayoutsTab/                       # Layouts 탭
    index.ts
    LayoutsTab.tsx
  tree/
    helpers.ts                      # ✅ treeHelpers 통합 완료
    hooks/
      index.ts
      useFocusManagement.ts         # ✅ 포커스 관리 훅
      useTreeVirtual.ts             # ✅ 가상화 훅
    TreeBase/                       # ✅ 공통 Tree 베이스
      index.ts
      TreeBase.tsx
      TreeBaseItem.tsx
      VirtualizedTree.tsx
      types.ts
      styles.css
    LayerTree/                      # ✅ 구현 완료
      index.ts
      LayerTree.tsx
      LayerTreeItemContent.tsx
      types.ts
      useLayerTreeData.ts
      useLayerTreeDnd.ts
      validation.ts
    PageTree/                       # ✅ 구현 완료
      index.ts
      PageTree.tsx
      PageTree.css
      PageTreeItemContent.tsx
      types.ts
      usePageTreeData.ts
      usePageTreeDnd.ts
      validation.ts
```

> ⚠️ **삭제된 레거시 폴더**:
> - `src/builder/sidebar/` - 완전 제거 (2025-12-26)
> - `src/builder/nodes/` - panels/nodes/로 통합 후 제거 (2025-12-26)

---

## 공통 타입 정의

### LayerTreeNode (현재 구현)

> 파일: `apps/builder/src/builder/panels/navigator/tree/LayerTree/types.ts`

```tsx
export type VirtualChildType =
  | "toggle"
  | "checkbox"
  | "radio"
  | "listbox"
  | "gridlist"
  | "select"
  | "combobox"
  | "tree";

export interface LayerTreeNode {
  id: string;
  name: string;                        // 표시 라벨
  tag: string;                         // HTML/컴포넌트 태그
  parentId: string | null;
  orderNum: number;
  depth: number;
  hasChildren: boolean;
  isLeaf: boolean;
  children?: LayerTreeNode[];
  element: Element;                    // 원본 Element 참조

  // Virtual Child (props 기반 가상 자식)
  virtualChildType?: VirtualChildType;
  virtualChildIndex?: number;
  virtualChildData?: unknown;
}
```

### Virtual Child 개념

> ※ "가상화(virtualization)"와 무관. UI 컴포넌트의 props 기반 자식을 트리에 표시하기 위한 개념.

**Virtual Child란?**
- 실제 Element가 아닌, 부모 Element의 `props.children`에서 파생된 가상 노드
- 예: `CheckboxGroup`의 개별 체크박스, `RadioGroup`의 개별 라디오 버튼
- 트리에서 선택 가능하지만, 드래그/드롭 대상에서 제외

**지원 컴포넌트:**
| 컴포넌트 | VirtualChildType | 자식 소스 |
|----------|------------------|-----------|
| ToggleButtonGroup | `toggle` | `props.children` (ButtonItem[]) |
| CheckboxGroup | `checkbox` | `props.children` (CheckboxItem[]) |
| RadioGroup | `radio` | `props.children` (RadioItem[]) |
| ListBox | `listbox` | `props.children` (ListItem[]) |
| GridList | `gridlist` | `props.children` (ListItem[]) |
| Select | `select` | `props.children` (ListItem[]) |
| ComboBox | `combobox` | `props.children` (ListItem[]) |
| Tree | `tree` | `props.children` (TreeItem[]) |

**Virtual Child ID 형식:**
```
{parentId}::{type}:{index}
예: "elem-123::checkbox:0", "elem-123::checkbox:1"
```

---

## 공통 상태 모델

```tsx
interface TreeState {
  expandedKeys: Set<Key>;
  selectedKeys: Set<Key>;         // 실제 노드 + virtual child 포함
}
```

### Selection 계약

| 속성 | LayerTree (현재) | PageTree (예정) |
|------|------------------|-----------------|
| `selectionMode` | `"single"` | `"single"` |
| `disallowEmptySelection` | 미사용 | `true` (예정) |
| `"all"` 처리 | `if (keys === "all") return` | 동일 |

> react-aria Selection에서 `"all"` 값은 무시하고 early return

### focusedKey 갱신 규칙

> ⚠️ **현재 미구현** - 향후 TreeBase 공통화 시 추가 예정

| 상황 | focusedKey 처리 |
|------|-----------------|
| DnD 성공 | 이동된 노드로 포커스 이동 |
| DnD 실패/취소 | 원래 focusedKey 복구 |
| 노드 삭제 | 다음 형제 → 이전 형제 → 부모 순으로 이동 |
| 노드 추가 | 새 노드로 포커스 이동 |

정책:
- virtual child도 selectedKeys에 포함 가능 (선택 시 부모의 특정 자식 선택)
- expandedKeys는 외부 제어 가능 (패널 시스템 주도)

---

## 공통 DnD 규약

### 공통 규칙 (모든 트리 적용)

| 규칙 | 설명 |
|------|------|
| 자기 자신 drop 금지 | `source.id === target.id` |
| 자손 노드 drop 금지 | target이 source의 descendant인 경우 |
| virtual child drop 제외 | `virtualChildType`이 있으면 드래그/드롭 불가 |
| DropPosition | `'before' \| 'after' \| 'on'` |

### DnD Validation 규칙 (LayerTree 현재 구현)

> 파일: `apps/builder/src/builder/panels/navigator/tree/LayerTree/validation.ts`

| 규칙 | reason | 설명 |
|------|--------|------|
| 노드 없음 | `invalid-node` | getItem 실패 시 |
| 자기 자신 | `self-drop` | `draggedId === targetId` |
| 자손 drop | `descendant-drop` | target이 dragged의 자손 |
| Virtual Child | `virtual-child` | 드래그/드롭 대상에서 제외 |
| body 이동 금지 | `body-immutable` | `tag === "body"` |
| 루트 레벨 금지 | `root-level-denied` | `depth === 0 && dropPosition !== "on"` |
| 컨텍스트 불일치 | `context-mismatch` | `page_id` 또는 `layout_id` 다름 |

```tsx
// validation.ts 핵심 로직
export function isValidDrop(
  draggedId: string,
  targetId: string,
  dropPosition: "before" | "after" | "on",
  tree: TreeDataLike
): { valid: boolean; reason?: string } {
  // 1. 노드 존재 확인
  if (!draggedNode || !targetNode) return { valid: false, reason: "invalid-node" };

  // 2. 자기 자신 drop 금지
  if (draggedId === targetId) return { valid: false, reason: "self-drop" };

  // 3. 자손으로 drop 금지
  if (isDescendant(draggedId, targetId, tree)) return { valid: false, reason: "descendant-drop" };

  // 4. virtual child 제외
  if (draggedNode.virtualChildType || targetNode.virtualChildType)
    return { valid: false, reason: "virtual-child" };

  // 5. body 이동 금지
  if (draggedNode.tag === "body") return { valid: false, reason: "body-immutable" };

  // 6. 루트 레벨(depth=0)에 before/after 금지
  if (targetNode.depth === 0 && dropPosition !== "on")
    return { valid: false, reason: "root-level-denied" };

  // 7. page_id/layout_id 일치 확인
  if (draggedElement.page_id !== targetElement.page_id ||
      draggedElement.layout_id !== targetElement.layout_id)
    return { valid: false, reason: "context-mismatch" };

  return { valid: true };
}
```

### DnD 업데이트 로직 (현재 구현)

> 파일: `apps/builder/src/builder/panels/navigator/tree/LayerTree/useLayerTreeDnd.ts`

```tsx
export function calculateMoveUpdates({
  tree,
  movedKeys,
  targetKey,
  dropPosition,
}: {
  tree: TreeDataLike;
  movedKeys: Set<Key>;
  targetKey: Key;
  dropPosition: "before" | "after" | "on";
}): Array<{ id: string; parentId?: string | null; orderNum?: number }> {

  // 1. 새 부모 결정
  const newParentId = dropPosition === "on"
    ? targetNode.id
    : targetNode.parentId ?? null;

  // 2. 영향받는 부모들 수집 (이동 전 부모들 + 새 부모)
  const affectedParents = new Set([...oldParentIds, newParentId]);

  // 3. 각 부모별로 자식 재정렬
  affectedParents.forEach((parentId) => {
    const siblings = collectSiblings(tree, parentId);
    const filtered = siblings.filter((s) => !movedIds.includes(s.id));

    // 새 부모인 경우 이동된 노드를 삽입 위치에 추가
    const finalListIds = parentId === newParentId
      ? insertAt(filtered.map(s => s.id), movedIds, computeInsertIndex(...))
      : filtered.map(s => s.id);

    // orderNum 재할당
    finalListIds.forEach((id, index) => {
      updates.push({
        id,
        ...(isMoved && { parentId: newParentId }),
        orderNum: index,
      });
    });
  });

  return updates;
}
```

**핵심 헬퍼 함수:**
- `collectSiblings(tree, parentId)`: 같은 부모를 가진 형제 노드 수집
- `computeInsertIndex(siblings, targetKey, dropPosition)`: 삽입 위치 계산
- `insertAt(list, items, index)`: 특정 위치에 아이템 삽입

### 공통 에러/UX 표준

| 상황 | 처리 |
|------|------|
| invalid drop 감지 | DropIndicator에 `--hidden` 클래스 추가 |
| invalid drop 시도 | `onMove`에서 early return (무시) |
| drag 종료 (invalid) | 아무 동작 없음 (현재 구현) |

### DnD API (v1.14 기준)

| 메서드 | 시그니처 | 용도 |
|--------|----------|------|
| `moveBefore` | `tree.moveBefore(targetKey, keys)` | 대상 항목 이전으로 이동 |
| `moveAfter` | `tree.moveAfter(targetKey, keys)` | 대상 항목 이후으로 이동 |
| `move` | `tree.move(key, parentKey, index)` | 특정 부모의 인덱스로 이동 |
| `onMove` | `useDragAndDrop({ onMove })` | 모든 이동 처리 (권장) |

> **권장**: `onReorder` 대신 `onMove`만 사용 (계층 간 이동 지원)

### 에러 복구 전략

**현재 구현 (Fire-and-Forget + Undo 지원):**

> 파일: `apps/builder/src/builder/stores/utils/elementUpdate.ts:326-413`

```tsx
// batchUpdateElements 현재 흐름
async (updates: BatchElementUpdate[]) => {
  // 1. 메모리 상태 즉시 반영 (Optimistic)
  set({ elements: updatedElements });

  // 2. 히스토리 저장 (prevStates 포함) → Undo 가능
  historyManager.addEntry({
    type: "batch",
    data: { batchUpdates: prevStates.map(...) }
  });

  // 3. IndexedDB 저장
  try {
    await db.elements.update(...);
  } catch (error) {
    console.warn("⚠️ 배치 저장 중 오류 (메모리는 정상):", error);
    // 현재: 경고만 출력
  }
}
```

**향후 구현 (Toast + Undo 버튼):**

```tsx
} catch (error) {
  console.warn("⚠️ 배치 저장 중 오류:", error);
  toast.error("저장에 실패했습니다.", {
    action: {
      label: "되돌리기",
      onClick: () => get().undo()
    },
    duration: 5000
  });
}
```

**전략 비교:**

| 방식 | 현재 | 향후 |
|------|------|------|
| 메모리 반영 | ✅ 즉시 | 유지 |
| DB 실패 처리 | console.warn | Toast + Undo 버튼 |
| 복구 방법 | 수동 Ctrl+Z | 버튼 클릭 or Ctrl+Z |

> IndexedDB는 로컬 저장소로 실패 확률 극히 낮음. 자동 Rollback보다 사용자 제어권 유지 선택.

---

### DnD Undo/Redo 계약

> 파일: `src/builder/stores/history/historyManager.ts`

**현재 지원 (historyManager 기반):**

| 액션 타입 | 지원 | 저장 데이터 |
|-----------|------|-------------|
| `props` | ✅ | `{ prevProps, newProps }` |
| `batch` | ✅ | `{ batchUpdates: [{ elementId, prevProps, newProps }] }` |
| `add` | ✅ | `{ element }` |
| `remove` | ✅ | `{ element, children }` |

**DnD 이동 시 히스토리 엔트리:**

```tsx
// batchUpdateElements가 자동으로 저장
historyManager.addEntry({
  type: "batch",
  elementId: movedElementId,
  data: {
    batchUpdates: [
      {
        elementId: "elem-1",
        prevProps: { parent_id: "old-parent", order_num: 2 },
        newProps: { parent_id: "new-parent", order_num: 0 }
      },
      // 영향받은 형제들의 orderNum 변경도 포함
      { elementId: "elem-2", prevProps: { order_num: 0 }, newProps: { order_num: 1 } },
      { elementId: "elem-3", prevProps: { order_num: 1 }, newProps: { order_num: 2 } },
    ]
  }
});
```

**Undo/Redo 동작:**

| 액션 | 키보드 | 동작 |
|------|--------|------|
| Undo | `Ctrl/Cmd + Z` | 이동 전 위치로 복구 (parent_id, order_num 모두) |
| Redo | `Ctrl/Cmd + Shift + Z` | 이동 재적용 |

**제약 사항:**
- 히스토리 스택 크기: 50개 (초과 시 오래된 항목 제거)
- 페이지 전환 시: 히스토리 유지 (페이지별 분리 없음)
- 새로고침 시: 히스토리 초기화 (메모리 기반)

---

## LayerTree 규칙 (현재 구현)

| 항목 | 규칙 | 파일 위치 |
|------|------|-----------|
| drag source | 실제 element 노드만 (virtual child 제외) | `LayerTree.tsx:58-69` |
| **body 노드** | 드래그 금지, drop target(on) 허용 | `validation.ts:33-35` |
| **루트 레벨** | before/after drop 금지 (on만 허용) | `validation.ts:37-39` |
| 컨텍스트 체크 | page_id/layout_id 일치 필수 | `validation.ts:41-48` |
| 업데이트 API | `batchUpdateElements(elementId, { parent_id, order_num })` | `useLayerTreeData.ts:40-54` |

---

## Phase 2: PageTree 상세 설계

### 파일 구조

```
src/builder/panels/nodes/tree/PageTree/
  index.ts                    # export
  PageTree.tsx                # 메인 컴포넌트
  PageTreeItem.tsx            # 개별 페이지 노드 렌더링
  types.ts                    # PageTreeNode 타입 정의
  usePageTreeData.ts          # 페이지 데이터 → 트리 변환
  usePageTreeDnd.ts           # DnD 로직 (calculateMoveUpdates)
  validation.ts               # isValidPageDrop
```

### PageTreeNode 타입 정의

> 파일: `apps/builder/src/builder/panels/navigator/tree/PageTree/types.ts`

```tsx
import type { Key } from 'react-stately';
import type { Page } from '../../../../../types/builder/unified.types';

export interface PageTreeNode {
  id: string;
  name: string;                    // title || "Untitled"
  slug: string | null;
  parentId: string | null;
  orderNum: number;
  depth: number;
  hasChildren: boolean;
  isLeaf: boolean;
  children?: PageTreeNode[];
  page: Page;                      // 원본 Page 참조

  // 제약 조건
  isRoot: boolean;                 // Home 페이지 여부
  isDraggable: boolean;            // !isRoot
  isDroppable: boolean;            // 항상 true (페이지는 virtual child 없음)
}

export interface PageTreeProps {
  pages: Page[];
  selectedPageId: string | null;
  expandedKeys?: Set<Key>;
  onExpandedChange?: (keys: Set<Key>) => void;
  onPageSelect: (page: Page) => void;
  onPageDelete: (page: Page) => Promise<void>;
  onPageSettings: (page: Page) => void;
}
```

### usePageTreeData 훅 설계

> 파일: `apps/builder/src/builder/panels/navigator/tree/PageTree/usePageTreeData.ts`

```tsx
import { useMemo, useCallback } from 'react';
import { useTreeData } from 'react-stately';
import type { Page } from '../../../../../types/builder/unified.types';
import type { PageTreeNode } from './types';
import { useStore } from '../../../../stores';
import { useToast } from '../../../../hooks/useToast';

export function usePageTreeData(pages: Page[]) {
  // 1. 페이지 → 트리 노드 변환
  const treeNodes = useMemo(
    () => convertToPageTreeNodes(pages),
    [pages]
  );

  // 2. react-stately useTreeData
  const tree = useTreeData<PageTreeNode>({
    initialItems: treeNodes,
    getKey: (item) => item.id,
    getChildren: (item) => item.children ?? [],
  });

  const setPages = useStore((state) => state.setPages);
  const currentPages = useStore((state) => state.pages);
  const { showToast } = useToast();

  // 3. Store 동기화 (Optimistic Update)
  const syncToStore = useCallback(
    async (updates: Array<{ id: string; parentId?: string | null; orderNum?: number }>) => {
      if (updates.length === 0) return;

      // 메모리 상태 즉시 반영
      const updatedPages = currentPages.map(page => {
        const update = updates.find(u => u.id === page.id);
        if (!update) return page;
        return {
          ...page,
          ...(update.parentId !== undefined && { parent_id: update.parentId }),
          ...(update.orderNum !== undefined && { order_num: update.orderNum }),
        };
      });
      setPages(updatedPages);

      // TODO: IndexedDB/Supabase 저장 구현 시 아래 코드 활성화
      // try {
      //   await db.pages.bulkPut(updates);
      // } catch (error) {
      //   console.warn('⚠️ 페이지 저장 실패:', error);
      //   showToast('error', '저장에 실패했습니다. Ctrl+Z로 되돌릴 수 있습니다.');
      // }
    },
    [currentPages, setPages, showToast]
  );

  return { tree, treeNodes, syncToStore };
}

function convertToPageTreeNodes(
  pages: Page[],
  parentId: string | null = null,
  depth = 0
): PageTreeNode[] {
  return pages
    .filter(p => (p.parent_id ?? null) === parentId)
    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
    .map(page => {
      const children = convertToPageTreeNodes(pages, page.id, depth + 1);
      const isRoot = page.parent_id === null && (page.order_num ?? 0) === 0;

      return {
        id: page.id,
        name: page.title || 'Untitled',
        slug: page.slug ?? null,
        parentId: page.parent_id ?? null,
        orderNum: page.order_num ?? 0,
        depth,
        hasChildren: children.length > 0,
        isLeaf: children.length === 0,
        children,
        page,
        isRoot,
        isDraggable: !isRoot,
        isDroppable: true,
      };
    });
}
```

### PageTree DnD Validation

> 파일: `apps/builder/src/builder/panels/navigator/tree/PageTree/validation.ts`

```tsx
import type { Key } from 'react-stately';
import type { PageTreeNode } from './types';

type TreeDataLike = {
  getItem: (key: Key | string) => { value: PageTreeNode } | null | undefined;
};

export function isValidPageDrop(
  draggedId: string,
  targetId: string,
  dropPosition: 'before' | 'after' | 'on',
  tree: TreeDataLike
): { valid: boolean; reason?: string } {
  const draggedNode = tree.getItem(draggedId)?.value;
  const targetNode = tree.getItem(targetId)?.value;

  // 1. 노드 존재 확인
  if (!draggedNode || !targetNode) {
    return { valid: false, reason: 'invalid-node' };
  }

  // 2. 자기 자신 drop 금지
  if (draggedId === targetId) {
    return { valid: false, reason: 'self-drop' };
  }

  // 3. 자손으로 drop 금지
  if (isDescendant(draggedId, targetId, tree)) {
    return { valid: false, reason: 'descendant-drop' };
  }

  // 4. Home(root) 페이지 드래그 금지
  if (draggedNode.isRoot) {
    return { valid: false, reason: 'home-immutable' };
  }

  // 5. 루트 레벨(depth=0)에 before/after 금지 (Home 앞/뒤 배치 금지)
  if (targetNode.depth === 0 && dropPosition !== 'on') {
    return { valid: false, reason: 'root-level-denied' };
  }

  return { valid: true };
}

function isDescendant(
  ancestorId: string,
  descendantId: string,
  tree: TreeDataLike
): boolean {
  let current = tree.getItem(descendantId);
  while (current) {
    if (current.value.parentId === ancestorId) return true;
    current = current.value.parentId
      ? tree.getItem(current.value.parentId)
      : null;
  }
  return false;
}
```

### PageTree DnD Validation 규칙

| 규칙 | reason | 설명 |
|------|--------|------|
| 노드 없음 | `invalid-node` | getItem 실패 시 |
| 자기 자신 | `self-drop` | `draggedId === targetId` |
| 자손 drop | `descendant-drop` | target이 dragged의 자손 |
| Home 이동 금지 | `home-immutable` | `isRoot === true` |
| 루트 레벨 금지 | `root-level-denied` | `depth === 0 && dropPosition !== "on"` |

### PageTree 컴포넌트

> 파일: `apps/builder/src/builder/panels/navigator/tree/PageTree/PageTree.tsx`

```tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { DropIndicator, Tree, useDragAndDrop } from 'react-aria-components';
import type { Key } from 'react-stately';
import type { PageTreeNode, PageTreeProps } from './types';
import { usePageTreeData } from './usePageTreeData';
import { calculatePageMoveUpdates } from './usePageTreeDnd';
import { isValidPageDrop } from './validation';
import { PageTreeItem } from './PageTreeItem';

export function PageTree({
  pages,
  selectedPageId,
  expandedKeys,
  onExpandedChange,
  onPageSelect,
  onPageDelete,
  onPageSettings,
}: PageTreeProps) {
  const { tree, treeNodes, syncToStore } = usePageTreeData(pages);
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<Set<Key>>(new Set());
  const lastDraggedKeysRef = useRef<Set<Key> | null>(null);

  const treeData = {
    items: treeNodes,
    getItem: (key: Key | string) => tree.getItem(key),
  };

  const resolvedExpandedKeys = expandedKeys ?? internalExpandedKeys;

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => {
      lastDraggedKeysRef.current = keys;
      return [...keys].flatMap((key) => {
        const node = treeData.getItem(key)?.value;
        if (!node || node.isRoot) return []; // Home 드래그 금지
        return [{
          'application/x-page-tree-item': JSON.stringify({ id: key }),
          'text/plain': node.name || '',
        }];
      });
    },
    acceptedDragTypes: ['application/x-page-tree-item'],
    onMove(e) {
      const { keys, target } = e;
      if (!target || target.type !== 'item') return;

      for (const key of keys) {
        const { valid } = isValidPageDrop(
          String(key),
          String(target.key),
          target.dropPosition,
          treeData
        );
        if (!valid) return;
      }

      const updates = calculatePageMoveUpdates({
        tree: treeData,
        movedKeys: keys,
        targetKey: target.key,
        dropPosition: target.dropPosition,
      });
      syncToStore(updates);
    },
    renderDropIndicator(target) {
      // LayerTree와 동일한 패턴
      if (target.type !== 'item') {
        return <DropIndicator target={target} className="page-drop-indicator--hidden" />;
      }

      let isInvalid = false;
      const draggedKeys = lastDraggedKeysRef.current;
      if (draggedKeys) {
        for (const key of draggedKeys) {
          const { valid } = isValidPageDrop(
            String(key),
            String(target.key),
            target.dropPosition,
            treeData
          );
          if (!valid) {
            isInvalid = true;
            break;
          }
        }
      }

      return (
        <DropIndicator
          target={target}
          className={`page-drop-indicator${isInvalid ? ' page-drop-indicator--hidden' : ''}`}
        />
      );
    },
  });

  return (
    <Tree
      aria-label="Pages"
      items={treeNodes}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={selectedPageId ? new Set([selectedPageId]) : new Set()}
      expandedKeys={resolvedExpandedKeys}
      onExpandedChange={(keys) => {
        if (keys === 'all') return;
        const next = new Set(keys);
        if (!expandedKeys) setInternalExpandedKeys(next);
        onExpandedChange?.(next);
      }}
      onSelectionChange={(keys) => {
        if (keys === 'all') return;
        const key = [...keys][0] as string;
        const node = treeData.getItem(key)?.value;
        if (node) onPageSelect(node.page);
      }}
      dragAndDropHooks={dragAndDropHooks}
    >
      {(node) => (
        <PageTreeItem
          key={node.id}
          node={node}
          onDelete={onPageDelete}
          onSettings={onPageSettings}
        />
      )}
    </Tree>
  );
}
```

### 입력/데이터 모델
- 입력: `UnifiedPage[]` (id, title, slug, parent_id, order_num)
- 선택: `selectedPageId` (단일 선택, `disallowEmptySelection: true`)
- 확장: `expandedKeys` (외부 제어 가능)

### 표시 규칙
- 기본 라벨: `page.title || "Untitled"`
- slug 배지 표시: `slug` 존재 시 `page-url-badge` 클래스 사용
- Home 페이지: 삭제 버튼 비노출, 드래그 불가 표시
- Tree 아이템 액션: Settings(옵션), Delete(비-root만)

---

## Phase 2: TreeBase 공통화 설계

### 공통 로직 추출 목록

LayerTree/PageTree에서 추출할 공통 로직:

| 로직 | LayerTree | PageTree | TreeBase |
|------|-----------|----------|----------|
| Tree 렌더링 | ✅ | ✅ | 추출 |
| expandedKeys 관리 | ✅ | ✅ | 추출 |
| selectedKeys 관리 | ✅ | ✅ | 추출 |
| useDragAndDrop 설정 | ✅ | ✅ | 추출 |
| DropIndicator 렌더링 | ✅ | ✅ | 추출 |
| "all" 처리 | ✅ | ✅ | 추출 |
| Validation | 도메인별 | 도메인별 | prop 위임 |
| 노드 변환 | 도메인별 | 도메인별 | prop 위임 |
| Store 동기화 | 도메인별 | 도메인별 | prop 위임 |

### TreeBase vs 도메인 코드 경계

```
┌─────────────────────────────────────────────────────────────┐
│                        TreeBase                              │
├─────────────────────────────────────────────────────────────┤
│ • react-aria Tree 렌더링                                     │
│ • expandedKeys / selectedKeys 상태 관리                      │
│ • useDragAndDrop 훅 설정 (getItems, onMove, renderDropIndicator) │
│ • DropIndicator 공통 렌더링 (invalid 시 hidden)              │
│ • 키보드 네비게이션 (react-aria 기본)                         │
│ • a11y (chevron button, aria-label)                         │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   LayerTree     │ │    PageTree     │ │   Future Tree   │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ • LayerTreeNode │ │ • PageTreeNode  │ │ • CustomNode    │
│ • validation.ts │ │ • validation.ts │ │ • validation.ts │
│ • useLayerTree  │ │ • usePageTree   │ │ • useCustomTree │
│   Data.ts       │ │   Data.ts       │ │   Data.ts       │
│ • VirtualChild  │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 파일 구조

```
src/builder/panels/nodes/tree/
  TreeBase/
    index.ts
    TreeBase.tsx              # 공통 Tree 컴포넌트
    TreeBaseItem.tsx          # 공통 TreeItem 래퍼
    types.ts                  # BaseTreeNode, TreeBaseProps
    useTreeBase.ts            # 공통 상태 관리 훅
    useTreeBaseDnd.ts         # 공통 DnD 훅
    styles.css                # 공통 스타일
```

### TreeBase API

```tsx
import type { Key } from 'react-stately';

// ============================================
// 공통 타입
// ============================================

export type DropPosition = 'before' | 'after' | 'on';

export interface BaseTreeNode {
  id: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  children?: BaseTreeNode[];
}

export type MovePayload<TNode extends BaseTreeNode> = {
  keys: Set<Key>;
  target: {
    key: Key;
    node: TNode;
    dropPosition: DropPosition;
  };
  updates: Array<{ id: string; parentId?: string | null; orderNum?: number }>;
};

export type TreeAction = 'settings' | 'delete' | 'duplicate' | 'rename';

// ============================================
// TreeBase Props
// ============================================

export interface TreeBaseProps<TNode extends BaseTreeNode> {
  // 필수
  items: TNode[];
  getKey: (node: TNode) => Key;
  getChildren: (node: TNode) => TNode[];
  renderItem: (node: TNode, state: TreeItemState) => React.ReactNode;

  // 상태 (Controlled)
  selectedKeys?: Set<Key>;
  expandedKeys?: Set<Key>;
  disabledKeys?: Set<Key>;

  // Selection 설정
  selectionMode?: 'single' | 'multiple';
  disallowEmptySelection?: boolean;

  // 콜백
  onSelectionChange?: (keys: Set<Key>) => void;
  onExpandedChange?: (keys: Set<Key>) => void;
  onAction?: (key: Key, action: TreeAction) => void;

  // DnD (optional)
  dnd?: {
    /** 드래그 가능 여부 */
    canDrag: (node: TNode) => boolean;
    /** Drop 유효성 검사 */
    isValidDrop: (
      draggedKey: Key,
      targetKey: Key,
      position: DropPosition
    ) => boolean;
    /** 이동 완료 콜백 */
    onMove: (payload: MovePayload<TNode>) => void;
    /** Drag MIME 타입 */
    dragType?: string;
  };

  // 가상화 (optional)
  virtual?: {
    enabled: boolean;
    estimateSize: number;
    overscan: number;
  };

  // 로딩 (optional)
  loading?: {
    isLoading: boolean;
    skeleton?: React.ReactNode;
  };

  // 접근성
  'aria-label': string;
}

export interface TreeItemState {
  isSelected: boolean;
  isExpanded: boolean;
  isDisabled: boolean;
  isFocused: boolean;
}
```

### TreeBase 컴포넌트 구현

```tsx
// apps/builder/src/builder/panels/navigator/tree/TreeBase/TreeBase.tsx

import React, { useState, useRef, useCallback } from 'react';
import { Tree, DropIndicator, useDragAndDrop } from 'react-aria-components';
import type { Key } from 'react-stately';
import type { TreeBaseProps, BaseTreeNode, DropPosition } from './types';
import { TreeBaseItem } from './TreeBaseItem';

export function TreeBase<TNode extends BaseTreeNode>({
  items,
  getKey,
  getChildren,
  renderItem,
  selectedKeys,
  expandedKeys,
  disabledKeys,
  selectionMode = 'single',
  disallowEmptySelection = false,
  onSelectionChange,
  onExpandedChange,
  onAction,
  dnd,
  virtual,
  loading,
  'aria-label': ariaLabel,
}: TreeBaseProps<TNode>) {
  // 내부 상태 (Uncontrolled 모드용)
  const [internalExpanded, setInternalExpanded] = useState<Set<Key>>(new Set());
  const lastDraggedKeysRef = useRef<Set<Key> | null>(null);

  const resolvedExpanded = expandedKeys ?? internalExpanded;

  // Selection 핸들러 ("all" 무시)
  const handleSelectionChange = useCallback(
    (keys: 'all' | Set<Key>) => {
      if (keys === 'all') return;
      onSelectionChange?.(keys);
    },
    [onSelectionChange]
  );

  // Expanded 핸들러 ("all" 무시)
  const handleExpandedChange = useCallback(
    (keys: 'all' | Set<Key>) => {
      if (keys === 'all') return;
      const next = new Set(keys);
      if (!expandedKeys) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [expandedKeys, onExpandedChange]
  );

  // DnD 설정
  const dragAndDropHooks = dnd
    ? useDragAndDrop({
        getItems: (keys) => {
          lastDraggedKeysRef.current = keys;
          return [...keys].flatMap((key) => {
            const node = findNode(items, key, getKey);
            if (!node || !dnd.canDrag(node)) return [];
            return [{
              [dnd.dragType ?? 'application/x-tree-item']: JSON.stringify({ id: key }),
              'text/plain': String(key),
            }];
          });
        },
        acceptedDragTypes: [dnd.dragType ?? 'application/x-tree-item'],
        onMove(e) {
          const { keys, target } = e;
          if (!target || target.type !== 'item') return;

          for (const key of keys) {
            if (!dnd.isValidDrop(key, target.key, target.dropPosition)) {
              return;
            }
          }

          const updates = calculateMoveUpdates(items, keys, target, getKey, getChildren);
          const targetNode = findNode(items, target.key, getKey);
          if (targetNode) {
            dnd.onMove({
              keys,
              target: { key: target.key, node: targetNode, dropPosition: target.dropPosition },
              updates,
            });
          }
        },
        renderDropIndicator(target) {
          if (target.type !== 'item') {
            return <DropIndicator target={target} className="tree-drop-indicator--hidden" />;
          }

          let isInvalid = false;
          const draggedKeys = lastDraggedKeysRef.current;
          if (draggedKeys) {
            for (const key of draggedKeys) {
              if (!dnd.isValidDrop(key, target.key, target.dropPosition)) {
                isInvalid = true;
                break;
              }
            }
          }

          return (
            <DropIndicator
              target={target}
              className={`tree-drop-indicator${isInvalid ? ' tree-drop-indicator--hidden' : ''}`}
            />
          );
        },
      }).dragAndDropHooks
    : undefined;

  // 로딩 상태
  if (loading?.isLoading) {
    return loading.skeleton ?? <div className="tree-loading">Loading...</div>;
  }

  return (
    <Tree
      aria-label={ariaLabel}
      items={items}
      selectionMode={selectionMode}
      disallowEmptySelection={disallowEmptySelection}
      selectedKeys={selectedKeys}
      expandedKeys={resolvedExpanded}
      disabledKeys={disabledKeys}
      onSelectionChange={handleSelectionChange}
      onExpandedChange={handleExpandedChange}
      dragAndDropHooks={dragAndDropHooks}
    >
      {(node) => (
        <TreeBaseItem
          key={getKey(node)}
          node={node}
          getKey={getKey}
          getChildren={getChildren}
          renderItem={renderItem}
          onAction={onAction}
        />
      )}
    </Tree>
  );
}

// 헬퍼 함수
function findNode<TNode extends BaseTreeNode>(
  items: TNode[],
  key: Key,
  getKey: (node: TNode) => Key
): TNode | undefined {
  for (const item of items) {
    if (getKey(item) === key) return item;
    if (item.children) {
      const found = findNode(item.children as TNode[], key, getKey);
      if (found) return found;
    }
  }
  return undefined;
}
```

### 마이그레이션 계획

**Step 1: TreeBase 생성** (신규 파일)
```
1. TreeBase/types.ts 생성
2. TreeBase/TreeBase.tsx 생성
3. TreeBase/TreeBaseItem.tsx 생성
4. TreeBase/styles.css 생성
```

**Step 2: LayerTree 마이그레이션**
```
1. LayerTree에서 TreeBase import
2. LayerTree를 TreeBase 래퍼로 변경
3. LayerTree 전용 로직만 유지:
   - LayerTreeNode 타입
   - validation.ts
   - useLayerTreeData.ts
   - VirtualChildItem
```

**Step 3: PageTree 마이그레이션**
```
1. PageTree에서 TreeBase import
2. PageTree를 TreeBase 래퍼로 변경
3. PageTree 전용 로직만 유지:
   - PageTreeNode 타입
   - validation.ts
   - usePageTreeData.ts
```

### 마이그레이션 후 LayerTree 예시

```tsx
// 마이그레이션 후 LayerTree.tsx
import { TreeBase } from '../TreeBase';
import type { LayerTreeNode } from './types';
import { useLayerTreeData } from './useLayerTreeData';
import { isValidDrop } from './validation';
import { LayerTreeItemContent } from './LayerTreeItemContent';

export function LayerTree({ elements, selectedElementId, ... }: LayerTreeProps) {
  const { tree, treeNodes, syncToStore } = useLayerTreeData(elements);

  return (
    <TreeBase<LayerTreeNode>
      aria-label="Layers"
      items={treeNodes}
      getKey={(node) => node.id}
      getChildren={(node) => node.children ?? []}
      renderItem={(node, state) => (
        <LayerTreeItemContent node={node} state={state} ... />
      )}
      selectedKeys={selectedElementId ? new Set([selectedElementId]) : new Set()}
      onSelectionChange={(keys) => { ... }}
      dnd={{
        canDrag: (node) => !node.virtualChildType && node.tag !== 'body',
        isValidDrop: (draggedKey, targetKey, position) =>
          isValidDrop(String(draggedKey), String(targetKey), position, tree).valid,
        onMove: (payload) => syncToStore(payload.updates),
        dragType: 'application/x-layer-tree-item',
      }}
    />
  );
}
```

### 스타일 계약

```css
/* apps/builder/src/builder/panels/navigator/tree/TreeBase/styles.css */

/* 공통 트리 스타일 */
.tree-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
}

.tree-item--selected {
  background: var(--color-selection);
}

.tree-item--disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* 들여쓰기 */
.tree-item-indent {
  width: calc(var(--depth, 0) * 16px);
  flex-shrink: 0;
}

/* Drop Indicator */
.tree-drop-indicator {
  height: 2px;
  background: var(--color-accent);
}

.tree-drop-indicator--hidden {
  display: none;
}

/* 로딩 */
.tree-loading {
  padding: 16px;
  text-align: center;
  color: var(--color-text-muted);
}
```

---

## Phase 3: focusedKey 관리 상세 설계

### 배경

현재 LayerTree는 react-aria Tree의 기본 포커스 관리를 사용하지만,
DnD/삭제/추가 등 상태 변경 이벤트 후 포커스 복구 로직이 없음.
TreeBase 공통화 시 일관된 포커스 관리가 필요.

### useFocusManagement 훅 설계

> 파일: `src/builder/panels/nodes/tree/TreeBase/useFocusManagement.ts`

```tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import type { Key } from 'react-stately';

export interface FocusManagementOptions<TNode> {
  /** 현재 트리 아이템 (평탄화된 배열) */
  flatItems: TNode[];
  /** 아이템에서 key 추출 */
  getKey: (item: TNode) => Key;
  /** 아이템에서 parentId 추출 */
  getParentId: (item: TNode) => string | null;
  /** 외부 focusedKey (controlled) */
  focusedKey?: Key | null;
  /** focusedKey 변경 콜백 */
  onFocusedKeyChange?: (key: Key | null) => void;
}

export interface FocusManagementResult {
  /** 현재 포커스된 key */
  focusedKey: Key | null;
  /** 포커스 설정 */
  setFocusedKey: (key: Key | null) => void;
  /** DnD 완료 후 포커스 처리 */
  handleDndComplete: (movedKeys: Set<Key>) => void;
  /** 삭제 후 포커스 처리 */
  handleDelete: (deletedKey: Key) => void;
  /** 추가 후 포커스 처리 */
  handleAdd: (newKey: Key) => void;
  /** 포커스 복구 (실패 시) */
  restoreFocus: () => void;
}

export function useFocusManagement<TNode>({
  flatItems,
  getKey,
  getParentId,
  focusedKey: externalFocusedKey,
  onFocusedKeyChange,
}: FocusManagementOptions<TNode>): FocusManagementResult {
  // 내부 상태 (uncontrolled 모드)
  const [internalFocusedKey, setInternalFocusedKey] = useState<Key | null>(null);
  const previousFocusRef = useRef<Key | null>(null);

  // controlled vs uncontrolled
  const focusedKey = externalFocusedKey ?? internalFocusedKey;

  const setFocusedKey = useCallback(
    (key: Key | null) => {
      previousFocusRef.current = focusedKey;
      if (onFocusedKeyChange) {
        onFocusedKeyChange(key);
      } else {
        setInternalFocusedKey(key);
      }
    },
    [focusedKey, onFocusedKeyChange]
  );

  // DnD 완료 후: 이동된 첫 번째 노드로 포커스
  const handleDndComplete = useCallback(
    (movedKeys: Set<Key>) => {
      if (movedKeys.size > 0) {
        const firstKey = [...movedKeys][0];
        setFocusedKey(firstKey);
      }
    },
    [setFocusedKey]
  );

  // 삭제 후: 다음 형제 → 이전 형제 → 부모 순으로 포커스
  const handleDelete = useCallback(
    (deletedKey: Key) => {
      // 인덱스 맵 생성 (O(n) 한 번만)
      const indexMap = new Map<Key, number>();
      flatItems.forEach((item, idx) => indexMap.set(getKey(item), idx));

      const deletedIndex = indexMap.get(deletedKey);
      if (deletedIndex === undefined) return;

      const deletedItem = flatItems[deletedIndex];
      const parentId = getParentId(deletedItem);

      // 같은 부모를 가진 형제들 (인덱스 포함)
      const siblings: Array<{ item: TNode; index: number }> = [];
      flatItems.forEach((item, idx) => {
        if (getParentId(item) === parentId && getKey(item) !== deletedKey) {
          siblings.push({ item, index: idx });
        }
      });

      // 다음 형제 찾기 (삭제된 노드 이후 첫 번째)
      const nextSibling = siblings.find((s) => s.index > deletedIndex);
      if (nextSibling) {
        setFocusedKey(getKey(nextSibling.item));
        return;
      }

      // 이전 형제 찾기 (삭제된 노드 이전 마지막)
      const prevSiblings = siblings.filter((s) => s.index < deletedIndex);
      if (prevSiblings.length > 0) {
        const prevSibling = prevSiblings[prevSiblings.length - 1];
        setFocusedKey(getKey(prevSibling.item));
        return;
      }

      // 부모로 이동
      if (parentId) {
        const parent = flatItems.find(
          (item) => String(getKey(item)) === parentId
        );
        if (parent) {
          setFocusedKey(getKey(parent));
          return;
        }
      }

      // 없으면 null
      setFocusedKey(null);
    },
    [flatItems, getKey, getParentId, setFocusedKey]
  );

  // 추가 후: 새 노드로 포커스
  const handleAdd = useCallback(
    (newKey: Key) => {
      setFocusedKey(newKey);
    },
    [setFocusedKey]
  );

  // 포커스 복구 (DnD 실패/취소 시)
  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current !== null) {
      setFocusedKey(previousFocusRef.current);
    }
  }, [setFocusedKey]);

  return {
    focusedKey,
    setFocusedKey,
    handleDndComplete,
    handleDelete,
    handleAdd,
    restoreFocus,
  };
}
```

### 포커스 이동 규칙

| 상황 | 포커스 대상 | 우선순위 |
|------|-------------|----------|
| DnD 성공 | 이동된 첫 번째 노드 | - |
| DnD 실패/취소 | 원래 focusedKey 복구 | - |
| 노드 삭제 | 1. 다음 형제 → 2. 이전 형제 → 3. 부모 | 순차 |
| 노드 추가 | 새 노드 | - |
| 확장/축소 | 현재 focusedKey 유지 | - |

### TreeBase 통합

```tsx
// TreeBase.tsx에 추가
import { useFocusManagement } from './useFocusManagement';

export function TreeBase<TNode extends BaseTreeNode>({
  // ... 기존 props
  focusedKey: externalFocusedKey,
  onFocusedKeyChange,
}: TreeBaseProps<TNode>) {
  // 평탄화된 아이템 목록 생성
  const flatItems = useMemo(() => flattenTree(items, getChildren), [items, getChildren]);

  const {
    focusedKey,
    handleDndComplete,
    handleDelete,
    handleAdd,
    restoreFocus,
  } = useFocusManagement({
    flatItems,
    getKey,
    getParentId: (node) => node.parentId,
    focusedKey: externalFocusedKey,
    onFocusedKeyChange,
  });

  // DnD 성공 시 포커스 처리
  const handleMove = useCallback((payload: MovePayload<TNode>) => {
    dnd?.onMove(payload);
    handleDndComplete(payload.keys);
  }, [dnd, handleDndComplete]);

  // Action 핸들러에서 삭제 시 포커스 처리
  const handleAction = useCallback((key: Key, action: TreeAction) => {
    if (action === 'delete') {
      handleDelete(key);
    }
    onAction?.(key, action);
  }, [onAction, handleDelete]);

  // ...
}
```

### 테스트 시나리오

| 테스트 | 기대 결과 |
|--------|-----------|
| 노드 A를 B 아래로 이동 | A에 포커스 |
| 노드 A 삭제 (다음 형제 B 존재) | B에 포커스 |
| 마지막 형제 삭제 | 이전 형제에 포커스 |
| 유일한 자식 삭제 | 부모에 포커스 |
| 새 노드 추가 | 새 노드에 포커스 |
| DnD 취소 (ESC) | 원래 포커스 유지 |

---

## Phase 3: 가상화 통합 상세 설계

### 배경

> ⚠️ react-aria Virtualizer는 Tree 미지원. `@tanstack/react-virtual` 사용 권장.

100개 이상의 노드에서 렌더링 성능 저하 방지를 위한 가상화 전략.

### 가상화 임계값

| 노드 수 | 가상화 | 근거 |
|---------|--------|------|
| 0-99 | ❌ 비활성화 | 오버헤드 > 이득 |
| 100+ | ✅ 활성화 | 렌더링 비용 절감 |

### useTreeVirtual 훅 설계

> 파일: `src/builder/panels/nodes/tree/TreeBase/useTreeVirtual.ts`

```tsx
import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Key } from 'react-stately';

export interface TreeVirtualOptions<TNode> {
  /** 평탄화된 트리 아이템 */
  flatItems: TNode[];
  /** 가상화 활성화 여부 */
  enabled: boolean;
  /** 아이템 예상 높이 (px) */
  estimateSize?: number;
  /** 오버스캔 개수 */
  overscan?: number;
  /** key 추출 */
  getKey: (item: TNode) => Key;
  /** 부모 ID 추출 (타입 안전) */
  getParentId: (item: TNode) => string | null;
  /** 확장된 키 (가시 아이템 필터링용) */
  expandedKeys: Set<Key>;
}

export interface TreeVirtualResult<TNode> {
  /** 스크롤 컨테이너 ref */
  containerRef: React.RefObject<HTMLDivElement>;
  /** 현재 렌더링할 가상 아이템들 */
  virtualItems: Array<{
    index: number;
    start: number;
    size: number;
    item: TNode;
    key: Key;
  }>;
  /** 전체 높이 (스크롤 영역) */
  totalSize: number;
  /** 특정 key로 스크롤 */
  scrollToKey: (key: Key) => void;
  /** 가상화 활성화 여부 */
  isVirtualized: boolean;
}

export function useTreeVirtual<TNode>({
  flatItems,
  enabled,
  estimateSize = 32,
  overscan = 5,
  getKey,
  getParentId,
  expandedKeys,
}: TreeVirtualOptions<TNode>): TreeVirtualResult<TNode> {
  const containerRef = useRef<HTMLDivElement>(null);

  // 가시 아이템만 필터링 (부모가 확장된 경우에만 표시)
  const visibleItems = useMemo(() => {
    if (!enabled) return flatItems;

    return flatItems.filter((item) => {
      // 루트 레벨은 항상 표시
      const parentId = getParentId(item);
      if (!parentId) return true;

      // 모든 조상이 확장되어 있어야 표시
      let currentParentId: string | null = parentId;
      while (currentParentId) {
        if (!expandedKeys.has(currentParentId)) return false;
        const parent = flatItems.find(
          (i) => String(getKey(i)) === currentParentId
        );
        currentParentId = parent ? getParentId(parent) : null;
      }
      return true;
    });
  }, [flatItems, enabled, expandedKeys, getKey, getParentId]);

  // @tanstack/react-virtual 설정
  const virtualizer = useVirtualizer({
    count: enabled ? visibleItems.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => String(getKey(visibleItems[index])),
  });

  // 가상 아이템 매핑
  const virtualItems = useMemo(() => {
    if (!enabled) {
      return visibleItems.map((item, index) => ({
        index,
        start: index * estimateSize,
        size: estimateSize,
        item,
        key: getKey(item),
      }));
    }

    return virtualizer.getVirtualItems().map((vItem) => ({
      index: vItem.index,
      start: vItem.start,
      size: vItem.size,
      item: visibleItems[vItem.index],
      key: getKey(visibleItems[vItem.index]),
    }));
  }, [enabled, visibleItems, virtualizer, getKey, estimateSize]);

  // 특정 key로 스크롤
  const scrollToKey = (key: Key) => {
    const index = visibleItems.findIndex((item) => getKey(item) === key);
    if (index >= 0 && enabled) {
      virtualizer.scrollToIndex(index, { align: 'center' });
    }
  };

  return {
    containerRef,
    virtualItems,
    totalSize: enabled ? virtualizer.getTotalSize() : visibleItems.length * estimateSize,
    scrollToKey,
    isVirtualized: enabled && visibleItems.length >= 100,
  };
}
```

### TreeBase 가상화 통합

```tsx
// TreeBase.tsx 가상화 지원

import { useTreeVirtual } from './useTreeVirtual';

export function TreeBase<TNode extends BaseTreeNode>({
  items,
  virtual,
  // ...
}: TreeBaseProps<TNode>) {
  const flatItems = useMemo(() => flattenTree(items, getChildren), [items, getChildren]);

  const {
    containerRef,
    virtualItems,
    totalSize,
    scrollToKey,
    isVirtualized,
  } = useTreeVirtual({
    flatItems,
    enabled: virtual?.enabled ?? flatItems.length >= 100,
    estimateSize: virtual?.estimateSize ?? 32,
    overscan: virtual?.overscan ?? 5,
    getKey,
    getParentId: (node) => node.parentId,
    expandedKeys: resolvedExpanded,
  });

  // 가상화 활성화 시 렌더링 최적화
  if (isVirtualized) {
    return (
      <div
        ref={containerRef}
        className="tree-virtual-container"
        style={{ height: '100%', overflow: 'auto' }}
      >
        <div
          className="tree-virtual-content"
          style={{ height: totalSize, position: 'relative' }}
        >
          {virtualItems.map((vItem) => (
            <div
              key={String(vItem.key)}
              style={{
                position: 'absolute',
                top: vItem.start,
                width: '100%',
                height: vItem.size,
              }}
            >
              {renderItem(vItem.item, getItemState(vItem.key))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 비가상화 모드: 기존 react-aria Tree 사용
  return (
    <Tree
      aria-label={ariaLabel}
      items={items}
      // ...
    />
  );
}
```

### 가상화 + DnD 통합

| 고려사항 | 해결 방법 |
|----------|-----------|
| Drop Indicator 위치 | `position: absolute`로 overlay 렌더링 |
| 스크롤 중 드래그 | `virtualizer.scrollToIndex`로 자동 스크롤 |
| 화면 밖 노드 드롭 | 타겟 key 기반 계산, DOM 의존성 제거 |
| Drag Preview | 원본 아이템 복제, 가상화와 무관 |

### Drop Indicator (가상화 모드)

```tsx
// 가상화 모드에서 DropIndicator는 overlay로 렌더링
function VirtualDropIndicator({
  targetKey,
  position,
  virtualItems,
}: {
  targetKey: Key;
  position: 'before' | 'after' | 'on';
  virtualItems: VirtualItem[];
}) {
  const targetItem = virtualItems.find((v) => v.key === targetKey);
  if (!targetItem) return null;

  const top =
    position === 'before'
      ? targetItem.start
      : position === 'after'
      ? targetItem.start + targetItem.size
      : targetItem.start + targetItem.size / 2;

  return (
    <div
      className="tree-drop-indicator tree-drop-indicator--virtual"
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        height: position === 'on' ? targetItem.size : 2,
      }}
    />
  );
}
```

### 스타일 추가

```css
/* apps/builder/src/builder/panels/navigator/tree/TreeBase/styles.css */

/* 가상화 컨테이너 */
.tree-virtual-container {
  height: 100%;
  overflow: auto;
  contain: strict;
}

.tree-virtual-content {
  position: relative;
  width: 100%;
}

/* 가상화 모드 Drop Indicator */
.tree-drop-indicator--virtual {
  pointer-events: none;
  z-index: 10;
  background: var(--color-accent);
}
```

### 성능 기준

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| 초기 렌더링 | < 100ms | React DevTools Profiler |
| 스크롤 FPS | > 55 FPS | Chrome Performance |
| 메모리 사용 | < 50MB (1000 노드) | Chrome Memory |

---

## Phase 3: Sidebar 제거 계획

### 현재 상태

```
src/builder/sidebar/
  Sidebar.tsx                    # 메인 사이드바 컴포넌트
  SidebarContent.tsx             # 탭 컨텐츠 (Pages/Layers)
  VirtualizedLayerTree.tsx       # 레거시 레이어 트리
  PageList.tsx                   # 레거시 페이지 리스트
  treeHelpers.ts                 # 트리 유틸리티
  styles.css
```

### 제거 전 확인 체크리스트

| 확인 항목 | 상태 | 담당 |
|-----------|------|------|
| PageTree가 PageList 기능 완전 대체 | ⏳ | Phase 2 완료 후 |
| LayerTree가 VirtualizedLayerTree 기능 완전 대체 | ✅ | 완료 |
| treeHelpers를 panels/nodes/tree/helpers.ts로 이관 | ⏳ | Phase 2 |
| NodesPanel이 유일한 진입점으로 작동 | ⏳ | 검증 필요 |
| 모든 키보드 단축키 동작 | ⏳ | 검증 필요 |
| DnD 기능 동등성 | ✅ | 완료 |
| 가상화 성능 동등성 | ⏳ | Phase 3 가상화 후 |

### 기능 동등성 비교표

| 기능 | Sidebar | NodesPanel | 상태 |
|------|---------|------------|------|
| 페이지 목록 표시 | PageList | PageTree | ⏳ |
| 페이지 선택 | ✅ | ✅ | ⏳ |
| 페이지 추가 | ✅ | ✅ | ⏳ |
| 페이지 삭제 | ✅ | ✅ | ⏳ |
| 페이지 순서 변경 | ❌ | ✅ DnD | ⏳ |
| 레이어 트리 표시 | VirtualizedLayerTree | LayerTree | ✅ |
| 레이어 선택 | ✅ | ✅ | ✅ |
| 레이어 DnD | ✅ | ✅ | ✅ |
| 레이어 삭제 | ✅ | ✅ | ✅ |
| Virtual Child 선택 | ✅ | ✅ | ✅ |
| 가상화 (100+ 노드) | ✅ | ⏳ | Phase 3 |
| 키보드 네비게이션 | 부분 | ✅ react-aria | ✅ |
| 접근성 | 부분 | ✅ react-aria | ✅ |

### 단계별 제거 순서

**Step 1: 의존성 분리 (Phase 2 완료 후)**
```
1. treeHelpers.ts → panels/nodes/tree/helpers.ts 이동
2. Sidebar에서 새 helpers 경로 import 수정
3. 기존 import 경로 alias 유지 (deprecation warning)
```

**Step 2: 기능 플래그 도입**
```tsx
// src/builder/config/featureFlags.ts
export const FEATURE_FLAGS = {
  USE_NODES_PANEL: true,  // true면 NodesPanel 사용, false면 Sidebar
} as const;

// App.tsx 또는 Layout.tsx
{FEATURE_FLAGS.USE_NODES_PANEL ? (
  <NodesPanel />
) : (
  <Sidebar />
)}
```

**Step 3: 점진적 전환**
```
Week 1: 내부 테스트 (USE_NODES_PANEL: true)
Week 2: 버그 수정 및 안정화
Week 3: Sidebar 코드 제거
```

**Step 4: 최종 제거**
```
1. featureFlags에서 USE_NODES_PANEL 제거
2. src/builder/sidebar/ 디렉토리 삭제
3. 관련 import 정리
4. 불필요한 스타일 제거
```

### 제거 시 주의사항

| 주의사항 | 대응 방안 |
|----------|-----------|
| 외부 참조 | grep으로 모든 import 확인 |
| 테스트 파일 | Sidebar 관련 테스트 삭제/수정 |
| 스토리북 | Sidebar 스토리 제거 |
| 문서 | README, 가이드 업데이트 |

### Rollback 계획

문제 발생 시:
```tsx
// featureFlags.ts
export const FEATURE_FLAGS = {
  USE_NODES_PANEL: false,  // Sidebar로 롤백
};
```

Sidebar 코드 제거 후에는 git revert로 복구.

---

## 접근성 규칙 (react-aria)

### 필수 규칙
- 확장 가능한 노드는 `Button slot="chevron"` 필수
- aria-label 형식: `${Expand|Collapse} ${label}` (상태 반영)
- TreeItem role/keyboard 규칙 준수 (react-aria 기본)

### 키보드 네비게이션
- `ArrowUp/Down`: 이전/다음 항목 포커스
- `ArrowLeft`: 축소 또는 부모로 이동
- `ArrowRight`: 확장 또는 첫 번째 자식으로 이동
- `Enter/Space`: 선택
- `Home/End`: 첫/마지막 항목으로 이동

---

## treeHelpers 이관

- `src/builder/sidebar/treeHelpers.ts` -> `apps/builder/src/builder/panels/navigator/tree/helpers.ts`
- 현재 `useLayerTreeData.ts`에서 `childrenAs` 등 일부 함수 사용 중
- Sidebar/VirtualizedLayerTree는 임시로 새 helpers를 참조하도록 수정
- 최종적으로 Sidebar 제거 시 helpers는 단일 위치만 유지

---

## 마이그레이션 순서

> 순서는 의존성 기반이며, 동일 단계는 병렬 진행 가능

### Phase 1: 기반 구축 ✅
1. ✅ LayerTree 구조 이동 (`panels/nodes/tree/LayerTree/`)
2. ✅ LayerTree DnD 구현 (react-aria useDragAndDrop + onMove)
3. ✅ DnD Validation 구현 (7가지 규칙)
4. ✅ Move 계산 로직 구현 (calculateMoveUpdates)

### Phase 2: 트리 통합 ✅
5. ✅ PageTree를 동일 패턴으로 신규 구현
6. ✅ TreeBase 공통화 (LayerTree/PageTree 공통 로직 추출)
   - VirtualizedTree 포함

### Phase 3: 정리 및 제거 ✅
7. ✅ Toast + Undo 버튼 에러 복구 구현
8. ✅ focusedKey 관리 추가 (useFocusManagement 훅)
9. ✅ 가상화 통합 (@tanstack/react-virtual, useTreeVirtual 훅)
10. ✅ Sidebar 제거 완료 (2025-12-26)
11. ✅ nodes 폴더 통합 (panels/nodes/로 이동, 2025-12-26)

---

## 구현 현황 (2025-12-26)

### ✅ 완료

| 항목 | 위치 | 비고 |
|------|------|------|
| LayerTree 컴포넌트 | `tree/LayerTree/LayerTree.tsx` | react-aria Tree + useDragAndDrop |
| LayerTreeItemContent | `tree/LayerTree/LayerTreeItemContent.tsx` | 개별 노드 렌더링 + Virtual Child |
| DnD Validation | `tree/LayerTree/validation.ts` | isValidDrop (7가지 규칙) |
| Move 계산 로직 | `tree/LayerTree/useLayerTreeDnd.ts` | calculateMoveUpdates |
| Tree 데이터 구조 | `tree/LayerTree/useLayerTreeData.ts` | 트리 노드 변환 + syncToStore |
| 타입 정의 | `tree/LayerTree/types.ts` | LayerTreeNode, VirtualChildType |
| PageTree 컴포넌트 | `tree/PageTree/PageTree.tsx` | react-aria Tree + useDragAndDrop |
| PageTreeItemContent | `tree/PageTree/PageTreeItemContent.tsx` | 페이지 노드 렌더링 |
| PageTree Validation | `tree/PageTree/validation.ts` | isValidPageDrop |
| TreeBase 공통화 | `tree/TreeBase/` | 공통 Tree 렌더러 + VirtualizedTree |
| useFocusManagement | `tree/hooks/useFocusManagement.ts` | DnD/삭제/추가 후 포커스 관리 |
| useTreeVirtual | `tree/hooks/useTreeVirtual.ts` | @tanstack/react-virtual 기반 가상화 |
| helpers 통합 | `tree/helpers.ts` | treeHelpers 이관 완료 |
| **Sidebar 제거** | - | `src/builder/sidebar/` 완전 삭제 |
| **nodes 폴더 통합** | - | `src/builder/nodes/` → `panels/nodes/` 이동 |

### 삭제된 레거시 파일

| 파일/폴더 | 삭제일 | 비고 |
|-----------|--------|------|
| `src/builder/sidebar/` | 2025-12-26 | index.tsx, SidebarNav.tsx 포함 |
| `src/builder/sidebar/components/` | 2025-12-26 | 미사용 레거시 컴포넌트 |
| `src/builder/sidebar/treeHelpers.ts` | 2025-12-26 | `panels/nodes/tree/helpers.ts`로 이관 |
| `src/builder/sidebar/VirtualizedLayerTree.tsx` | 2025-12-26 | LayerTree로 통합 |
| `src/builder/nodes/` | 2025-12-26 | `panels/nodes/`로 통합 |
| `src/builder/hooks/useSidebarTabs.ts` | 2025-12-26 | Sidebar 전용 훅 제거 |

---

## 완료 기준

- 패널 시스템 NodesPanel만 진입점으로 남음
- Page/Layer 모두 동일 Tree 베이스 사용
- selection/expanded/DnD 규약이 단일화됨
- Sidebar 제거 시에도 기능 동등성 유지

---

## 검증 체크리스트

### ✅ 구현 완료 (LayerTree)

| 테스트 | 설명 | 상태 |
|--------|------|------|
| self-drop 금지 | 자기 자신으로 drop 시 무시 | ✅ |
| descendant-drop 금지 | 자손으로 drop 시 indicator 숨김 | ✅ |
| virtual-child drop 금지 | virtual child로 drop 시 무시 | ✅ |
| body 드래그 금지 | body 노드 드래그 시도 시 무반응 | ✅ |
| root-level drop 금지 | depth=0에 before/after drop 시 무시 | ✅ |
| context-mismatch 금지 | page_id/layout_id 다르면 무시 | ✅ |
| orderNum 재정렬 | 이동 후 형제들 orderNum 순차 재할당 | ✅ |

### ✅ Undo/Redo 지원 (historyManager 기반)

| 테스트 | 설명 | 상태 |
|--------|------|------|
| DnD Undo | 이동 후 Ctrl+Z로 원래 위치 복구 | ✅ 지원 |
| DnD Redo | Undo 후 Ctrl+Shift+Z로 재이동 | ✅ 지원 |
| batch 히스토리 | 영향받은 모든 형제 orderNum 복구 | ✅ 지원 |

### ✅ 추가 구현 완료

| 테스트 | 설명 | 상태 | 파일 위치 |
|--------|------|------|-----------|
| DnD 후 selection 유지 | 이동 완료 후 이동된 노드가 선택 상태 유지 | ✅ | react-aria 기본 동작 |
| DnD 후 focus 이동 | 이동된 노드로 focusedKey 갱신 | ✅ | `useFocusManagement.ts` |
| Home 드래그 금지 | PageTree에서 Home 페이지 드래그 금지 | ✅ | `PageTree/validation.ts` |
| 가상화 100+ 노드 | 100개 이상 노드에서 가상화 자동 활성화 | ✅ | `useTreeVirtual.ts` |
| 가상화 DnD 통합 | 가상화 모드에서 DnD 정상 동작 | ✅ | `VirtualizedTree.tsx` |

### ⏳ 향후 개선 사항

| 항목 | 설명 | 우선순위 |
|------|------|----------|
| Toast + Undo 버튼 | DB 실패 시 되돌리기 버튼 표시 | 낮음 (현재 console.warn) |

---

## 오픈 이슈

### 미결 - 우선순위 높음
- **Toast + Undo 버튼 구현**
  - 현재: console.warn만 출력
  - 계획: DB 실패 시 Toast 알림 + "되돌리기" 버튼 표시
  - 근거: historyManager 기반 Undo 이미 지원, UI 안내만 추가 필요

### 미결 - 우선순위 중간
- **WebGL 동기화 지연 정책**
  - 현재: 미정
  - 제안: **즉시 동기화** (debounce 없음)
  - 근거: DnD 완료 시점에 단일 이벤트 발생, 빈번한 호출 아님

- **다중 선택 드래그 UX**
  - 현재: `selectionMode="single"`로 단일 선택만 지원
  - 향후: `selectionMode="multiple"` 지원 시 UX 정책 필요

### 미결 - 우선순위 낮음
- **로딩 상태 표시**
  - 트리 데이터 fetch 중 스켈레톤 vs 스피너 결정 필요
  - 제안: 3개 아이템 스켈레톤 (높이 28px × 3)

---

## 참고 자료

> **기준**: react-aria-components v1.14 (2025년 12월)

- [React Aria Tree](https://react-spectrum.adobe.com/react-aria/Tree.html) - Tree 컴포넌트 및 DnD 통합
- [React Aria DnD](https://react-spectrum.adobe.com/react-aria/dnd.html) - useDragAndDrop, onMove/onReorder
- [useTreeData – React Stately](https://react-spectrum.adobe.com/react-stately/useTreeData.html) - moveBefore/moveAfter/move 메서드
- [@tanstack/react-virtual](https://tanstack.com/virtual/latest) - Tree 가상화 권장 라이브러리

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-25 | 초안 작성 |
| 1.1 | 2025-12-26 | TreeBase API 보완 (disabledKeys, onAction, loading) |
| 1.2 | 2025-12-26 | 구조 개선: DnD 규칙 통합, 공통 타입 정의, Selection/Focus 계약 추가 |
| 1.3 | 2025-12-26 | **실제 구현 정합성 반영**: VirtualChild 개념 수정, DnD 규칙 7개로 확장, 미구현 항목 명시 |
| 1.4 | 2025-12-26 | **에러 복구 + Undo/Redo 계약 추가**: Toast+Undo 버튼 전략, historyManager 기반 DnD Undo 명세 |
| 1.5 | 2025-12-26 | **Phase 2-3 상세 설계 완성**: PageTree 상세 설계, TreeBase 공통화 설계, focusedKey 관리 훅, 가상화 통합 (@tanstack/react-virtual), Sidebar 제거 계획 |
| 1.6 | 2025-12-26 | **코드 정합성 검증 및 수정**: UnifiedPage→Page 타입명, useStore API 정합성, useToast 훅 연동, useFocusManagement O(n²)→O(n) 최적화, useTreeVirtual 타입 안전성 개선 |

### 해결된 이슈
- ~~PageTree에서 root page reorder 제약 여부~~ → Home 드래그 금지로 결정
- ~~SyntheticChild 개념 혼란~~ → VirtualChild로 명칭 통일, UI 컴포넌트 자식 개념으로 정리
- ~~Optimistic Rollback 필요 여부~~ → Toast+Undo 버튼 전략 채택 (자동 rollback 대신 사용자 제어권 유지)
- ~~Phase 2-3 상세 설계 부족~~ → PageTree, TreeBase, focusedKey, 가상화, Sidebar 제거 상세 설계 완성
- ~~UnifiedPage 타입 불일치~~ → `Page` 타입으로 통일 (unified.types.ts 정합성)
- ~~usePageStore/pagesAdapter 미존재~~ → `useStore` + `setPages` 패턴으로 수정
- ~~toast 라이브러리 미설치~~ → 기존 `useToast` 훅 사용으로 수정
- ~~useFocusManagement O(n²) 성능~~ → indexMap 기반 O(n) 로직으로 최적화
- ~~useTreeVirtual 타입 안전성~~ → `getParentId` 함수 옵션 추가로 타입 안전 보장
