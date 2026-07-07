---
title: Layout Resolution Pattern
impact: HIGH
impactDescription: 잘못된 레이아웃 합성 = 페이지 렌더링 오류, ID 공간 오염
tags: [domain, layout, page, projection]
---

Page 와 재사용 레이아웃(Frame) 의 합성 규칙을 정의합니다.

> **정본**: `.claude/rules/canvas-rendering.md` §9 Render-Space Interaction Boundary (ADR-135/136). 본 문서는 구현 위치 지도.

## 체계 개요 (구 시스템과의 차이)

구 `resolveLayoutForPage` / `preview/utils/layoutResolver.ts` 기반 Layout-vs-Page 이원화 체계는 **소멸**했습니다. 현행 합성은 두 층으로 나뉩니다:

1. **데이터 층 (ADR-111 frameset)** — Layout 은 별도 테이블/필드(`layout_id`, `slot_name`)가 아니라 canonical `FrameNode` (`reusable: true`) 로 표현. Page 는 layout shell 을 `type: "ref"` 노드로 참조하고, slot 별 내용은 `descendants[path].children` 으로 보존 (`types/builder/layout.types.ts` 헤더의 흡수 매핑 참조)
2. **렌더 층 (ADR-135 page-frame projection)** — canonical document 로부터 render model 을 파생(projection)하며, projected ID 공간과 canonical ID 공간을 분리

## 구현 위치 지도

| 역할                               | 파일 / 심볼                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| canonical schema (`FrameNode`)     | `packages/shared/src/types/composition-document.types.ts`                                                                                    |
| projection 파생 (Skia 그리기 전용) | `packages/shared/src/utils/export.utils.ts` — `deriveProjectRenderModelFromDocument()`                                                       |
| projected ID 규약                  | `apps/builder/src/builder/projection/renderProjectionIds.ts` — `PAGE_FRAME_PROJECTION_INFIX` (`"::page-frame::"`)                            |
| mirror hydrate (canonical-only)    | `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts` — `canonicalDocumentToElements()`                                       |
| drag/drop → canonical move 대상    | `apps/builder/src/builder/workspace/canvas/interaction/resolveCanonicalMutationTarget.ts` — `resolveCanonicalMoveTarget()`                   |
| canonical move mutation            | `apps/builder/src/adapters/canonical/canonicalMutations.ts` — `moveElementToCanonicalTarget()`                                               |
| drag bridge (소비자)               | `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts`                                                                           |
| page-frame binding (선택 계약)     | `apps/builder/src/adapters/canonical/pageFrameBinding.ts` — `applyPageFrameBindingFromSelection` / `applyPageFrameBindingExplicit` (ADR-137) |
| frame 삭제/cascade                 | `apps/builder/src/adapters/canonical/frameLayoutCascade.ts`                                                                                  |
| legacy Layout/Slot 변환 adapter    | `apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts` (`type="Slot"` element → slot 메타, `layout_id` → ref)                         |
| Body 해석 (page/layout 컨텍스트)   | `apps/builder/src/utils/element/elementUtils.ts` — `ElementUtils.findBodyByContext(elements, pageId, layoutId, doc)`                         |

## 핵심 규칙 (정본 §9 요약)

- **ID 공간 분리**: hit-test/그리기 authoritative source 는 `renderNodesMap` / `interactionNodesMap`. `sceneNodesMap` 은 diagnostic 전용 — render fallback 금지
- **projected ID 비영속**: `"::page-frame::"` projected ID 는 canonical document / IndexedDB / history payload 에 저장 금지
- **canonical move target 단일 진입점**: projected Slot 으로의 drag/drop 은 `resolveCanonicalMoveTarget` → `moveElementToCanonicalTarget`. projected render ID 를 mutation 의 `containerId`/target 으로 직접 전달 금지
- **bootstrap canonical-only**: store mirror hydrate 는 canonical traversal 만 (`canonicalDocumentToElements()` 등). `deriveProjectRenderModelFromDocument()` elements 는 Skia 그리기 전용 — mirror hydrate source 로 사용 금지
- **Slot roundtrip 무손실**: Frame apply/remove/apply 반복 후 `descendants[path].children` 순서 보존

## Incorrect

```typescript
// ❌ 구 심볼 참조 — resolveLayoutForPage / layoutResolver.ts 는 소멸
import { resolveLayoutForPage } from "@/preview/utils/layoutResolver";

// ❌ projected ID 를 canonical mutation target 으로 전달
moveElementToCanonicalTarget(elementId, {
  containerId: "page1::page-frame::header", // projected ID — 금지
});

// ❌ projection 결과를 mirror hydrate source 로 사용
const elements = deriveProjectRenderModelFromDocument(doc, projectId).elements;
hydrateStoreMirror(elements); // Skia 그리기 전용 — 금지
```

## Correct

```typescript
// ✅ drag/drop → canonical 대상 해석 → canonical mutation (실코드: useDragBridge.ts)
const canonicalTarget = resolveCanonicalMoveTarget({ ... });
const moved = canonicalTarget
  ? moveElementToCanonicalTarget(elementId, canonicalTarget)
  : false;

// ✅ mirror hydrate 는 canonical traversal
const elements = canonicalDocumentToElements(doc);

// ✅ Body 해석 — layout 모드는 canonical doc 으로 frame node id 매칭
const bodyId = ElementUtils.findBodyByContext(elements, pageId, layoutId, doc);
```

## 참조 ADR

- `docs/adr/completed/111-layout-frameset-pencil-redesign.md` - frameset 데이터 층
- `docs/adr/completed/135-page-frame-projection-interaction-boundary.md` - projection/interaction 경계
- `docs/adr/completed/903-ref-descendants-slot-composition-format-migration-plan.md` - Layout/Slot → canonical 흡수
