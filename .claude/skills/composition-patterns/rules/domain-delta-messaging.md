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
const removeElement = (elementId: string, childElementIds?: string[]) => {
  set({ elements: elements.filter((el) => !idsToRemove.includes(el.id)) });

  deltaMessenger.sendElementRemoved(elementId, childElementIds);
  // 메시지: { type: 'DELTA_ELEMENT_REMOVED', elementId, childElementIds }
};

// 참고: 요소 이동(부모/순서 변경)은 delta 채널이 아니라 canonical mutation
// (moveElementToCanonicalTarget) → UPDATE_CANONICAL_DOCUMENT 전체 동기화 경유
```

## Delta 메시지 타입

```typescript
// Builder → Preview (실코드: builder/utils/canvasDeltaMessenger.ts)
export interface DeltaElementAddedMessage {
  type: "DELTA_ELEMENT_ADDED";
  element: Element;
  childElements?: Element[];
}

export interface DeltaElementUpdatedMessage {
  type: "DELTA_ELEMENT_UPDATED";
  elementId: string;
  propsChanges: Record<string, unknown>; // 변경된 props만
  fills?: unknown[];
  parentId?: string | null;
}

export interface DeltaElementRemovedMessage {
  type: "DELTA_ELEMENT_REMOVED";
  elementId: string;
  childElementIds?: string[];
}

export interface DeltaBatchUpdateMessage {
  type: "DELTA_BATCH_UPDATE";
  updates: Array<{
    elementId: string;
    propsChanges?: Record<string, unknown>;
    fills?: unknown[];
    parentId?: string | null;
  }>;
}
```

Delta 메시지는 위 4종(`ADDED` / `UPDATED` / `REMOVED` / `BATCH_UPDATE`)입니다. MOVED delta 는 존재하지 않으며, 이동(부모/순서 변경)은 canonical document 전체 동기화가 반영합니다.

## 전체 동기화 채널 — UPDATE_CANONICAL_DOCUMENT (단일)

Builder → Preview 전체 동기화의 active channel 은 `UPDATE_CANONICAL_DOCUMENT` **단일**입니다 (ADR-125 Phase 3 — 구 `UpdateElementsMessage` bulk 수신은 제거됨). `UPDATE_ELEMENTS` 에 신규 의존 금지.

```typescript
// ✅ 실코드: useIframeMessenger.ts sendCanonicalDocumentToIframe
const message = {
  type: "UPDATE_CANONICAL_DOCUMENT" as const,
  document, // CompositionDocument | null — canonical document 전체
};
iframe.contentWindow.postMessage(message, window.location.origin);

// preview/messaging/messageHandler.ts
export interface UpdateCanonicalDocumentMessage {
  type: "UPDATE_CANONICAL_DOCUMENT";
  document: CompositionDocument | null;
}
```

canonical document 변경 감지 → `useIframeMessenger` effect 가 자동 전송하므로, mutation 코드에서 전체 동기화를 수동 호출하지 않습니다.

## 참조 파일

- `apps/builder/src/builder/utils/canvasDeltaMessenger.ts` - Delta 메신저
- `apps/builder/src/builder/hooks/useIframeMessenger.ts` - 전체 동기화 (`UPDATE_CANONICAL_DOCUMENT`)
- `apps/builder/src/preview/messaging/messageHandler.ts` - 메시지 타입
- `apps/builder/src/utils/dom/iframeMessenger.ts` - iframe 통신
