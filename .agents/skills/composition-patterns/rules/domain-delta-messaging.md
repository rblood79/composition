---
title: Delta Messaging Pattern
impact: HIGH
impactDescription: 전체 동기화 = 성능 저하, 대규모 프로젝트 불가
tags: [domain, messaging, optimization]
---

Builder↔Preview 간 변경분(Delta)만 전송합니다.

## Delta vs Full Sync

```
Full Sync: 전체 요소 트리 전송 (O(n))
Delta Sync: 변경된 요소만 전송 (O(1))

100개 요소 중 1개 변경 시:
- Full: 100개 전송 → 느림
- Delta: 1개 전송 → 빠름
```

## Incorrect

```typescript
// ❌ 매번 전체 요소 전송
const updateElement = (elementId: string, props: Props) => {
  set({ elements: updatedElements });

  messenger.send({
    type: "UPDATE_ELEMENTS",
    elements: get().elements, // 전체 전송
  });
};

// ❌ 불필요한 전체 동기화
const onElementChange = () => {
  messenger.send({
    type: "SYNC_ALL",
    elements: getAllElements(),
  });
};
```

## Correct

```typescript
import { CanvasDeltaMessenger } from "@/builder/utils/canvasDeltaMessenger";

const deltaMessenger = new CanvasDeltaMessenger(iframe);

// ✅ 요소 추가 시 - 추가된 것만 전송
const addElement = (element: Element, children?: Element[]) => {
  set({ elements: [...elements, element, ...(children ?? [])] });

  deltaMessenger.sendElementAdded(element, children);
  // 메시지: { type: 'DELTA_ELEMENT_ADDED', element, childElements }
};

// ✅ 요소 수정 시 - 변경된 props만 전송
const updateElementProps = (
  elementId: string,
  propsChanges: Partial<Props>,
) => {
  set({ elements: applyPropsChanges(elements, elementId, propsChanges) });

  deltaMessenger.sendElementUpdated(elementId, propsChanges);
  // 메시지: { type: 'DELTA_ELEMENT_UPDATED', elementId, propsChanges }
};

// ✅ 요소 삭제 시 - 삭제된 ID만 전송
const removeElement = (elementId: string, childIds?: string[]) => {
  set({ elements: elements.filter((el) => !idsToRemove.includes(el.id)) });

  deltaMessenger.sendElementRemoved(elementId, childIds);
  // 메시지: { type: 'DELTA_ELEMENT_REMOVED', elementId, childIds }
};

// ✅ 요소 이동 시
const moveElement = (elementId: string, newParentId: string) => {
  deltaMessenger.sendElementMoved(elementId, newParentId);
  // 메시지: { type: 'DELTA_ELEMENT_MOVED', elementId, parentId }
};
```

## Delta 메시지 타입

```typescript
// Builder → Preview
interface DeltaElementAddedMessage {
  type: "DELTA_ELEMENT_ADDED";
  element: Element;
  childElements?: Element[];
}

interface DeltaElementUpdatedMessage {
  type: "DELTA_ELEMENT_UPDATED";
  elementId: string;
  propsChanges: Record<string, unknown>; // 변경된 props만
  parentId?: string | null;
}

interface DeltaElementRemovedMessage {
  type: "DELTA_ELEMENT_REMOVED";
  elementId: string;
  childIds?: string[];
}

interface DeltaElementMovedMessage {
  type: "DELTA_ELEMENT_MOVED";
  elementId: string;
  parentId: string | null;
}
```

## 전체 동기화가 필요한 경우

```typescript
// 페이지 전환 시에만 전체 동기화
const switchPage = (pageId: string) => {
  const pageElements = getPageElements(pageId);

  messenger.send({
    type: "UPDATE_ELEMENTS", // 전체 동기화
    elements: pageElements,
    pageInfo: { pageId, layoutId },
  });
};
```

## 참조 파일

- `apps/builder/src/builder/utils/canvasDeltaMessenger.ts` - Delta 메신저
- `apps/builder/src/preview/messaging/messageHandler.ts` - 메시지 타입
- `apps/builder/src/utils/dom/iframeMessenger.ts` - iframe 통신
