---
name: canonical-visitor-emits-element-not-panelnode
description: visitCanonicalDocumentElements visitor 는 PanelNode 가 아니라 Element(types/builder/unified.types) 를 emit — properties-panel read hook 의 PanelNode 와 혼동 금지 (false positive 방지)
metadata:
  type: feedback
---

properties-panel 신규 섹션 리뷰 시, canonical document 를 순회해 page elements 를 모으는 코드의 타입을 검증할 때 주의.

**사실**:

- `useCanonicalPropertyElement(elementId)` 등 `panels/properties/hooks/useCanonicalPropertyRead.ts` read hook 은 `PanelNode | undefined` 를 반환.
- 반면 `stores/canonical/canonicalElementsView.ts::visitCanonicalDocumentElements(doc, visitor)` 의 visitor 콜백은 `(element: Element, node: CanonicalNode)` 시그니처 — 여기서 `Element` 는 `apps/builder/src/builder/types/builder/unified.types` 의 `Element` (canonicalElementsView.ts:25 와 동일 import). `PanelNode` 아님.
- 따라서 visitor 로 모은 배열은 `Element[]` 로 타입하는 것이 정답. `as PanelNode` 캐스트는 오히려 부정확.

**Why**: ButtonChildSection (Button Add Icon affordance, 2026-06-26) 리뷰에서, plan 초안은 visitor 결과를 `PanelNode[]` 로 캐스트했으나 실제 구현(commit 04bac7556)이 `Element[]` 로 정정. 둘 다 `id/type/deleted/page_id/parent_id` 필드를 갖지만 emit 타입은 `Element` 가 정본. 리뷰어가 "PanelNode read hook 을 쓰는 컴포넌트인데 왜 Element 로 push 하나" 를 결함으로 오판하지 않도록.

**How to apply**: properties-panel 섹션이 (1) 선택 element read = `useCanonicalProperty*` → PanelNode, (2) page elements 수집 = `visitCanonicalDocumentElements` → Element 인 **두 타입이 공존**하는 것은 정상. `handleAddElement(..., filtered, ...)` 같은 useElementCreator 호출은 `Element[]` 를 기대하므로 visitor 경로(Element) 가 맞다. 캐스트 제거 commit 을 "타입 약화" 로 지적하지 말 것.
