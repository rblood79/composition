---
title: Input Validation at Boundaries
impact: CRITICAL
impactDescription: 미검증 입력 = 보안 취약점, 런타임 크래시
tags: [validation, security, boundary]
---

시스템 경계에서 모든 외부 입력을 검증합니다.

## 경계 정의

```
외부 입력 경계:
1. PostMessage (Preview ↔ Builder)
2. API 응답 (Supabase, External API)
3. URL 파라미터 (라우팅)
4. 사용자 입력 (폼, 에디터)
5. 로컬 스토리지 / IndexedDB
```

## Incorrect

```typescript
// ❌ PostMessage 무검증
window.addEventListener("message", (event) => {
  const { type, data } = event.data; // 검증 없이 사용
  handleMessage(type, data);
});

// ❌ API 응답 무검증
const { data } = await supabase.from("elements").select("*");
setElements(data); // null/undefined 가능성

// ❌ URL 파라미터 무검증
const pageId = useParams().pageId;
loadPage(pageId); // 유효하지 않은 ID 가능

// ❌ 사용자 입력 무검증
const handleInput = (value: string) => {
  element.props.width = parseInt(value); // NaN 가능성
};
```

## Correct

```typescript
import { z } from 'zod';

// ✅ PostMessage 검증 (Zod 스키마)
const messageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SELECT_ELEMENT'),
    elementId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('UPDATE_PROPS'),
    elementId: z.string().uuid(),
    props: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('COMPUTED_STYLES'),
    elementId: z.string().uuid(),
    styles: z.record(z.string()),
  }),
]);

window.addEventListener('message', (event) => {
  // Origin 검증 (postmessage-origin-verify 규칙)
  if (!isAllowedOrigin(event.origin)) return;

  // 스키마 검증
  const result = messageSchema.safeParse(event.data);
  if (!result.success) {
    console.warn('Invalid message:', result.error);
    return;
  }

  handleMessage(result.data);
});

// ✅ API 응답 검증
const elementSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  parent_id: z.string().uuid().nullable(),
  props: z.record(z.unknown()),
});

const fetchElements = async (pageId: string) => {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('page_id', pageId);

  if (error) throw new Error(error.message);
  if (!data) return [];

  // 각 요소 검증
  return data.map(el => elementSchema.parse(el));
};

// ✅ URL 파라미터 검증
const pageIdSchema = z.string().uuid();

const PageRoute = () => {
  const { pageId } = useParams();

  const validPageId = useMemo(() => {
    const result = pageIdSchema.safeParse(pageId);
    return result.success ? result.data : null;
  }, [pageId]);

  if (!validPageId) return <NotFoundPage />;
  return <PageEditor pageId={validPageId} />;
};

// ✅ 숫자 입력 검증
const numericInputSchema = z.coerce.number().min(0).max(10000);

const handleWidthChange = (value: string) => {
  const result = numericInputSchema.safeParse(value);
  if (!result.success) {
    showError('유효한 숫자를 입력하세요');
    return;
  }
  updateElementProps(elementId, { width: result.data });
};
```

## 검증 레이어 구조

```typescript
// 1. 경계 레이어: 원시 입력 검증
const rawInput = receiveFromExternal();
const validated = schema.parse(rawInput);

// 2. 도메인 레이어: 비즈니스 규칙 검증
if (!canHaveChildren(parentElement.type)) {
  throw new DomainError("Leaf elements cannot have children");
}

// 3. 저장 레이어: 무결성 검증
const sanitized = sanitizeElement(element);
await db.elements.insert(sanitized);
```

## 참조 파일

- `apps/builder/src/preview/messaging/messageHandler.ts` - 메시지 검증
- `apps/builder/src/utils/dom/iframeMessenger.ts` - Origin 검증
- `apps/builder/src/types/builder/unified.types.ts` - 타입 정의
