---
title: Input Validation at Boundaries
impact: CRITICAL
impactDescription: 미검증 입력 = 보안 취약점, 런타임 크래시
tags: [validation, security, boundary]
---

시스템 경계에서 모든 외부 입력을 검증합니다.

> **실코드 기준**: composition 의 경계 검증은 **origin 검증 + 타입 가드** 가 기본입니다. zod 는 theme 타입(`types/theme/index.ts`)에 한정 사용 중이며, 신규 경계에 선택적으로 도입할 수 있습니다 (필수 아님). Supabase 는 **auth 전용** (ADR-128) — DB 요소 fetch 경계는 존재하지 않고, 요소/문서 영속 경계는 IndexedDB canonical document 입니다.

## 경계 정의

```
외부 입력 경계:
1. PostMessage (Preview ↔ Builder)
2. URL 파라미터 (라우팅)
3. 사용자 입력 (폼, 에디터)
4. 로컬 스토리지 / IndexedDB (canonical document hydrate)
```

## Incorrect

```typescript
// ❌ PostMessage 무검증
window.addEventListener("message", (event) => {
  const { type, data } = event.data; // origin/shape 검증 없이 사용
  handleMessage(type, data);
});

// ❌ URL 파라미터 무검증
const pageId = useParams().pageId;
loadPage(pageId); // 유효하지 않은 ID 가능

// ❌ 사용자 입력 무검증
const handleInput = (value: string) => {
  element.props.width = parseInt(value); // NaN 가능성
};
```

## Correct

### PostMessage — origin 검증 + shape 가드 (실코드)

```typescript
// ✅ Preview 측 (preview/messaging/messageHandler.ts handle())
handle(event: MessageEvent): void {
  // 1. Origin 검증 (production에서만 — dev 는 동일 origin iframe)
  if (import.meta.env.PROD) {
    if (event.origin !== window.location.origin) {
      console.warn("[Preview] Message from untrusted origin:", event.origin);
      return;
    }
  }

  // 2. Shape 가드 — type discriminant 없는 메시지 거부
  const data = event.data as BuilderToPreviewMessage;
  if (!data || typeof data !== "object" || !data.type) {
    return;
  }

  // 3. type 별 discriminated switch 로 분기
  switch (data.type) {
    case "UPDATE_CANONICAL_DOCUMENT": /* ... */ break;
    // ...
  }
}

// ✅ Builder 측 (utils/dom/iframeMessenger.ts)
// allowedOrigins 목록 기반 isAllowedOrigin() 검증 후에만 처리
if (!this.isAllowedOrigin(event.origin)) {
  console.warn(`Blocked message from unauthorized origin: ${event.origin}`);
  return;
}
```

### URL 파라미터 / 사용자 입력 — 타입 가드

```typescript
// ✅ URL 파라미터 검증 (타입 가드)
const PageRoute = () => {
  const { pageId } = useParams();

  const validPageId = useMemo(
    () => (typeof pageId === 'string' && pageId.length > 0 ? pageId : null),
    [pageId],
  );

  if (!validPageId) return <NotFoundPage />;
  return <PageEditor pageId={validPageId} />;
};

// ✅ 숫자 입력 검증
const handleWidthChange = (value: string) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    showError('유효한 숫자를 입력하세요');
    return;
  }
  updateElementProps(elementId, { width: num });
};
```

### 저장/hydrate 경계 — sanitize

```typescript
// ✅ IndexedDB/legacy 데이터 hydrate 시 sanitize
// (adapters/canonical/legacyElementSanitizer.ts — sanitizeElement)
const sanitized = sanitizeElement(element);
```

## 검증 레이어 구조

```typescript
// 1. 경계 레이어: origin + shape 검증 (위 PostMessage 패턴)
// 2. 도메인 레이어: 비즈니스 규칙 검증
if (!canHaveChildren(parentElement.type)) {
  throw new DomainError("Leaf elements cannot have children");
}
// 3. 저장 레이어: 무결성 검증 (sanitizeElement 후 persist)
```

## zod 도입 기준 (선택)

- 현행 사용처: `apps/builder/src/types/theme/index.ts` (theme 스키마)
- 복잡한 discriminated union 경계(신규 외부 API 등)를 추가할 때 선택적 도입 가능 — 기존 postMessage 경계를 zod 로 일괄 전환할 의무는 없음

## 참조 파일

- `apps/builder/src/preview/messaging/messageHandler.ts` - 메시지 origin/shape 검증
- `apps/builder/src/utils/dom/iframeMessenger.ts` - `isAllowedOrigin()` origin 검증
- `apps/builder/src/adapters/canonical/legacyElementSanitizer.ts` - `sanitizeElement()` hydrate sanitize
- `apps/builder/src/types/builder/unified.types.ts` - 타입 정의
