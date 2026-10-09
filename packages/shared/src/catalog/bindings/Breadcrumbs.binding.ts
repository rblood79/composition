/**
 * ADR-142 family ④(collections) — Breadcrumbs primitive 의 `PrimitiveBinding`.
 *
 * DOM = `CATALOG_DELEGATED_DOM.breadcrumbs` (delegatedDom.tsx): composition `Breadcrumbs` 안에 Breadcrumb
 * 자식 노드만 그린다 (각 조각은 `breadcrumb` 항목 — RAC `Breadcrumb`). 항목은 origin template 의 Breadcrumb
 * 자식 노드다 (reusableOriginLibrary.ts).
 *
 * **Tag/Tab 과 차이**: 중간 컨테이너 없음(Breadcrumbs→Breadcrumb 1단 직접) → propagation 불요.
 */

import type { PrimitiveBinding } from "../types";

export const breadcrumbsBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "breadcrumbs",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // separator (문자) 는 2026-09-29 제거 — 구분자는 조각의 편집 가능한 Icon 자식 (사용자 결정).
      // showRoot/isMultiline 은 2026-09-10 제거 — RSP v3 개념이나 DOM·Skia 어느 쪽도 읽지 않는
      //   미구현 surface 였다. 채택하려면 collapse/multiline 렌더를 두 leg 에 같이 구현한 뒤 되살린다.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
