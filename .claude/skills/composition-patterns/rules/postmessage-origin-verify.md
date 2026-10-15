---
title: Always Verify PostMessage Origin
impact: CRITICAL
impactDescription: XSS 방지, 보안, iframe 통신 안전성
tags: [security, postmessage, iframe]
---

postMessage 수신 시 `event.source` 와 `event.origin` 을 함께 검증합니다. Builder 와 Preview iframe 은 same-origin 이라
허용 목록 배열이나 별도 env 변수를 두지 않습니다 — 기준은 자기 origin 하나와 기대하는 source 하나입니다.

## Incorrect

```tsx
// ❌ origin 검증 없음
window.addEventListener("message", (event) => {
  const { type, payload } = event.data;
  handleMessage(type, payload);
});

// ❌ 부분 문자열 검사 — 우회 가능
window.addEventListener("message", (event) => {
  if (event.origin.includes("mysite.com")) handleMessage(event.data);
});

// ❌ 허용 origin 배열 · 가상의 env 변수 신설 — 실제 경계와 다른 두 번째 정본
```

## Correct

실제 두 수신 지점을 그대로 따릅니다 (상세: [validation-input-boundary.md](validation-input-boundary.md) §Preview 메시지):

- Builder 수신 — `apps/builder/src/builder/workspace/canvas/catalog/CatalogPreviewFrame.tsx`:
  `event.source !== frame.contentWindow || event.origin !== origin` 이면 버린다.
- Preview 수신 — `apps/builder/src/preview/catalog/catalogPreviewApp.ts`:
  `event.origin !== window.location.origin || event.source !== window.parent` 이면 버린다. 개발 모드도 같다.
- 통과한 메시지의 payload 는 `CatalogPreviewSession.receive(event.data)` 가 판정한다 — `type` 문자열 존재나 cast 만으로 유효하다고 보지 않는다.
- 전송 (`previewChannel.ts`) 도 `targetOrigin` 을 정확히 넘긴다. `"*"` 금지.
