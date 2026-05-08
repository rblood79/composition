---
title: Canonical Format And Order Rules
impact: CRITICAL
impactDescription: canonical children[]/ref format 경계가 깨지면 순서 drift, instance 잔존, refresh 손실이 발생
tags: [domain, canonical, order, component]
---

Composition Builder의 저장/편집 SSOT는 canonical `CompositionDocument`입니다.
legacy `Element[]`는 Builder 호환 mirror이며, direct cutover 이후 신규
runtime 판단은 canonical format을 먼저 확인합니다.

## Canonical Format SSOT

- Document root는 `CompositionDocument.children`.
- Node discriminator는 `type`입니다. legacy `tag`를 새 코드의 Element 필드로
  추가하지 않습니다.
- Component payload는 `CanonicalNode.props`가 SSOT입니다.
- `events` / `dataBinding`은 canonical core props가 아니라
  `x-composition` extension입니다.
- metadata는 adapter/debug/round-trip 전용입니다. runtime consumer가 metadata를
  props source로 읽지 않습니다.

## Origin / Instance Format

- origin: 원본 노드에 `reusable: true`.
- instance: `type: "ref"` + `ref: <origin id>`.
- instance root override: `RefNode.props`.
- instance child/slot override: `RefNode.descendants`.
- legacy `componentRole`, `masterId`, `overrides`, `componentName`은 adapter
  mirror입니다. 신규 판단은 `reusable`, `type:"ref"`, `ref`,
  `descendants`, `name`을 우선합니다.

## Order SSOT

- Runtime order read/write는 parent `children[]` index가 primary입니다.
- `Element.order_num`은 제거되었습니다. 신규 Element 생성, IndexedDB `elements`
  store, history payload, drag/drop payload에 이 필드를 추가하지 않습니다.
- page/layout 정렬도 document root `CompositionDocument.children[]` source
  order가 primary입니다. `pages.order_num`, `layouts.order_num`,
  page/layout `metadata.order_num`을 runtime order source로 읽거나 쓰지
  않습니다. Supabase physical schema compatibility가 필요한 경우에만
  adapter boundary에서 source order로 파생합니다.
- `order_num` 검색 hit가 0이어야 한다고 해석하지 않습니다. 허용되는 잔존
  hit는 Supabase compatibility type, call-time derived project sync field,
  IndexedDB stale cleanup guard, metadata strip guard, legacy fixture,
  Table/collection component data model뿐입니다.
- 일반 props update는 기존 canonical 위치를 보존해야 합니다. Element 배열의
  source 순서나 stale metadata 차이만 보고 기존 node를 제거 후 append하면 수정한
  요소가 마지막으로 이동합니다.
- 명시적 reorder/move만 canonical `children[]` splice로 반영합니다.

## Write APIs

- 단일/cross-parent move: `moveElementCanonicalPrimary(...)`.
- shared public surface: `moveNode(...)`, `moveDescendantChild(...)`,
  `getNodeChildren(...)`.
- `reorderElements()`, `batchUpdateElementOrders()`, `updateElementOrder()`,
  `getDerivedOrderNum()`은 제거된 legacy API입니다. 새 경로에서 재도입하지 않습니다.

## Page / Reusable Derived Behaviors

- Page 전환 + element 선택은 target element를 canonical snapshot에서도 조회해야
  합니다. cross-page origin/instance navigation이 page body selection으로
  덮이면 안 됩니다.
- origin이 삭제되거나 origin이 있는 page가 삭제될 때, 다른 page의 instances는
  ref로 남기지 않고 materialized Standard element로 detach해야 합니다.
- 이때 origin이 legacy `elementsMap`에 없고 canonical document에만 있어도
  canonical snapshot을 포함해 영향 instance를 계산합니다.

## Verification

- props update가 sibling order를 바꾸지 않는 테스트를 추가합니다.
- explicit reorder/move는 `children[]` 순서, `childrenMap` source order, IndexedDB
  canonical document 저장을 함께 검증합니다.
- origin/instance 변경은 same-page와 cross-page, legacy mirror와 canonical-only
  snapshot 케이스를 모두 고정합니다.

## 참조 파일

- `packages/shared/src/types/composition-document.types.ts`
- `packages/shared/src/types/composition-document-actions.types.ts`
- `apps/builder/src/adapters/canonical/canonicalMutations.ts`
- `apps/builder/src/adapters/canonical/exportLegacyDocument.ts`
- `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts`
- `apps/builder/src/builder/panels/properties/ComponentSemanticsSection.tsx`
- `apps/builder/src/builder/stores/elements.ts`
