---
title: Send After PREVIEW_READY
impact: HIGH
impactDescription: 메시지 유실 방지, 안정적 통신, 초기화 동기화
tags: [postmessage, iframe, communication]
---

Preview iframe 이 `PREVIEW_READY` 를 보내기 전에는 catalog 메시지를 보내지 않습니다.

## Incorrect

```tsx
// ❌ iframe 로드 전 즉시 전송 — 유실
previewFrame.current?.contentWindow?.postMessage(
  { type: "CATALOG_SNAPSHOT", payload },
  origin,
);
```

## Correct

경로는 하나입니다 — 별도 버퍼 클래스를 만들지 않습니다.

- `apps/builder/src/builder/workspace/canvas/catalog/CatalogPreviewFrame.tsx` 가 `PREVIEW_READY` 를 받은 뒤 `attachPreview` 로 현재 snapshot (`CATALOG_SNAPSHOT`) 을 보내고, 이후 변경은 `catalogRuntime/previewChannel.ts` 가 `CATALOG_DELTA` 로 보냅니다.
- ready 전에 생긴 변경은 따로 쌓지 않습니다 — ready 시점의 snapshot 이 그 변경을 이미 담고 있습니다.
- iframe 이 교체되면 (Compare Mode 토글 등) 새 iframe 의 `PREVIEW_READY` 를 다시 기다립니다.
