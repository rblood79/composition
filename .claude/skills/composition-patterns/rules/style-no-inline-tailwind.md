---
title: No Inline Tailwind
impact: CRITICAL
impactDescription: 코드 일관성, 유지보수성, 번들 최적화
tags: [style, tailwind, css]
---

.tsx 파일에서 inline Tailwind 클래스 사용을 금지합니다.
semantic classes + @layer + CSS 토큰 변수를 사용하세요.

> **Note**: Tailwind v4에서는 `@apply` 사용이 금지됩니다.

## Incorrect

```tsx
// ❌ inline Tailwind 클래스 직접 사용
<Button className="bg-blue-500 px-4 py-2 rounded-lg hover:bg-blue-600 text-white font-medium">
  Submit
</Button>

<div className="flex flex-col gap-4 p-6 bg-gray-100 rounded-xl shadow-md">
  <span className="text-lg font-bold text-gray-800">Title</span>
</div>
```

```css
/* ❌ @apply 사용 금지 (Tailwind v4) */
.react-aria-Button {
  @apply font-medium rounded-lg;
}
```

## Correct

```tsx
// ✅ semantic class + data 속성 — 값은 catalog rule 이 생성한 CSS 가 선택자로 읽는다
// (tailwind-variants · tv() 는 이 프로젝트 의존성이 아니다)
import { Button } from "react-aria-components";

<Button className="react-aria-Button" data-variant="primary" data-size="md">
  Submit
</Button>;
```

```css
/* ✅ @layer + CSS 토큰 변수 사용 */
@layer components {
  .react-aria-Button {
    font-weight: var(--font-weight-medium);
    border-radius: var(--radius-lg);
    transition:
      color 150ms,
      background-color 150ms;
  }

  .react-aria-Button.primary {
    padding: var(--spacing-2) var(--spacing-4);
    background-color: var(--color-blue-500);
    color: var(--color-white);

    &:hover {
      background-color: var(--color-blue-600);
    }
  }
}
```
