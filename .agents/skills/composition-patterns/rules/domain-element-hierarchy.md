---
title: Element Hierarchy Rules
impact: CRITICAL
impactDescription: 잘못된 계층 구조 = 렌더링 오류, 데이터 손실
tags: [domain, element, hierarchy]
---

Element 계층 구조 규칙을 정의합니다.

## Canonical 우선 경계

direct cutover 이후 runtime 저장/순서 SSOT는 canonical
`CompositionDocument.children[]`입니다. `Element.parent_id`는 mirror 구조 필드로
남지만, `Element.order_num`은 제거됐습니다.

- 신규 Element 예시는 `type` 필드를 사용합니다. legacy `tag` 필드를 새
  저장/상태 코드에 추가하지 않습니다.
- 명시적 이동/재정렬은 canonical `children[]` splice로 먼저 반영합니다.
- 단순 props 수정은 canonical sibling 위치를 보존해야 하며, source order drift만
  보고 remove+append 처리하지 않습니다.

## 계층 구조

```
Page/Layout (최상위)
└── Body (자동 생성, 루트 컨테이너)
    └── Frame/Container
        └── Component (Button, TextField, etc.)
            └── Leaf (Text, Image - 자식 불가)
```

## Incorrect

```typescript
// ❌ Page에 직접 컴포넌트 배치 (Body 무시)
const element: Element = {
  id: "button-1",
  type: "Button",
  parent_id: null, // 루트에 직접 배치
  page_id: "page-1",
};

// ❌ Leaf 요소에 자식 추가
const textElement: Element = {
  id: "text-1",
  type: "Text",
  parent_id: "some-parent",
};
const childOfText: Element = {
  id: "child-1",
  parent_id: "text-1", // Text는 자식을 가질 수 없음
};

// ❌ page_id와 layout_id 동시 설정
const element: Element = {
  page_id: "page-1",
  layout_id: "layout-1", // 상호 배타적
};
```

## Correct

```typescript
// ✅ Body를 통한 올바른 계층 구조
import { findBodyByContext } from "@/builder/stores/utils/elementHelpers";

const bodyElement = findBodyByContext(elements, pageId, layoutId);

const element: Element = {
  id: ElementUtils.generateId(),
  type: "Button",
  parent_id: bodyElement?.id ?? null, // Body 아래에 배치
  page_id: pageId,
  layout_id: null, // page_id와 상호 배타적
};

// ✅ 명시적 이동만 canonical children[] splice
moveElementCanonicalPrimary(element.id, bodyElement.id, insertionIndex);

// ✅ Leaf 요소는 항상 말단
const LEAF_TAGS = ["Text", "Image", "Icon", "Separator"];

function canHaveChildren(type: string): boolean {
  return !LEAF_TAGS.includes(type);
}

// ✅ page_id XOR layout_id
interface Element {
  page_id?: string | null; // Page 컨텍스트
  layout_id?: string | null; // Layout 컨텍스트 (상호 배타적)
  slot_name?: string | null; // Layout 슬롯 (page_id 있을 때만)
}
```

## 참조 파일

- `apps/builder/src/types/builder/unified.types.ts` - Element 타입 정의
- `packages/shared/src/types/composition-document.types.ts` - canonical `children[]`, `type`, `ref` format
- `apps/builder/src/adapters/canonical/canonicalMutations.ts` - canonical primary write/move
- `apps/builder/src/builder/stores/utils/elementHelpers.ts` - findBodyByContext
