---
title: Element Hierarchy Rules
impact: CRITICAL
impactDescription: 잘못된 계층 구조 = 렌더링 오류, 데이터 손실
tags: [domain, element, hierarchy]
---

Element 계층 구조 규칙을 정의합니다.

## 계층 구조

```
Page (canonical document)
└── body (자동 생성, 루트 컨테이너 — type: "body")
    └── Frame/Container
        └── Component (Button, TextField, etc.)
            └── Leaf (Text, Image - 자식 불가)
```

- Element 식별자 필드는 `type` (ADR-113 — `tag` 아님)
- 형제 간 순서는 canonical document `children` 배열 위치가 SSOT (ADR-118) — `order_num` 필드/재정렬 파이프라인 소멸
- 구 Layout/Slot 이원화(`layout_id` / `slot_name` 필드)는 canonical `FrameNode` + `reusable: true` + ref 참조로 흡수됨 (ADR-903/ADR-111 — `types/builder/layout.types.ts` 헤더 참조)

## Incorrect

```typescript
// ❌ Page에 직접 컴포넌트 배치 (body 무시)
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

// ❌ projected render ID 를 부모로 사용 (ADR-135)
const element: Element = {
  parent_id: "page1::page-frame::slot1", // "::page-frame::" projected ID 영속 금지
};
```

## Correct

```typescript
// ✅ body를 통한 올바른 계층 구조
import { ElementUtils } from '@/utils/element/elementUtils';

// layout 모드에서는 canonical document 로 frame node id 매칭 (4번째 인자 doc)
const bodyId = ElementUtils.findBodyByContext(elements, pageId, layoutId, doc);

const element: Element = {
  id: ElementUtils.generateId(),
  type: 'Button',
  parent_id: bodyId ?? null,  // body 아래에 배치
  page_id: pageId,
};

// ✅ 이동/재배치 — canonical mutation 단일 진입점 (순서 = children 배열 위치)
import { moveElementToCanonicalTarget } from '@/adapters/canonical/canonicalMutations';

const canonicalTarget = resolveCanonicalMoveTarget({ ... });
// → workspace/canvas/interaction/resolveCanonicalMutationTarget.ts
if (canonicalTarget) {
  moveElementToCanonicalTarget(elementId, canonicalTarget);
}

// ✅ Leaf 요소는 항상 말단
const LEAF_TYPES = ['Text', 'Image', 'Icon', 'Separator'];

function canHaveChildren(type: string): boolean {
  return !LEAF_TYPES.includes(type);
}
```

## Layout 합성 컨텍스트 (ADR-111/135)

- Layout(재사용 셸)은 별도 `layout_id` 필드가 아니라 canonical `FrameNode` (`reusable: true`) 로 표현
- Page 는 layout shell 을 `type: "ref"` 로 참조, slot 내용은 `descendants[path].children` 으로 보존
- 화면 합성/hit-test 경계 규칙: `.claude/rules/canvas-rendering.md` §9 + `domain-layout-resolution.md` 참조

## 참조 파일

- `apps/builder/src/types/builder/unified.types.ts` - Element 타입 정의 (`type` 필드, ADR-126 legacy projection)
- `apps/builder/src/utils/element/elementUtils.ts` - `ElementUtils.findBodyByContext` (`type === "body"` 매칭)
- `apps/builder/src/adapters/canonical/canonicalMutations.ts` - `moveElementToCanonicalTarget` (이동/재배치)
- `apps/builder/src/builder/workspace/canvas/interaction/resolveCanonicalMutationTarget.ts` - `resolveCanonicalMoveTarget`
- `packages/shared/src/types/composition-document.types.ts` - canonical schema (`FrameNode`)
