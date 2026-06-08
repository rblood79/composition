/**
 * ADR-142 family ④(collections) — Breadcrumbs primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`Breadcrumbs.tsx`)가 useResolvedCollectionItems(dataBinding/items →
 * crumb rows)로 채우고 RAC Breadcrumbs + Breadcrumb/Link 합성(internal source, delegating
 * renderBreadcrumbs). Skia generic 발효 — appendBreadcrumbRowProjection 이 Breadcrumbs.props.items
 * 를 직접 읽어 crumb projection 노드 전개(ADR-912 영역 B (A)).
 *
 * **Tag/Tab 과 차이**: 중간 컨테이너 없음(Breadcrumbs→Breadcrumb 1단 직접) → propagation 불요.
 *   crumb 시각은 generic box+text 아니라 Breadcrumb.spec.render.shapes 유지(separator/isLast 로직).
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
      // ADR-912 영역 B (A): 정적 items[] SSOT(StoredBreadcrumbItem) pass-through.
      //   TagGroup 선례 동일 — cutover DOM 경로(toRacProps)는 accepts 선언 prop 만 통과시키므로
      //   items 미선언 시 props.items 가 drop → renderBreadcrumbs 가 items=undefined 로 받아
      //   fallback crumb 렌더. kind:"binding"(Inspector no-op, toRacProps 통과 전용).
      //   Skia 경로는 appendBreadcrumbRowProjection 이 canonical props.items 를 직접 읽어 무관.
      items: { kind: "binding", label: "Items", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      separator: {
        kind: "string",
        label: "Separator",
        section: "appearance",
      },
      showRoot: { kind: "boolean", label: "Show Root", section: "appearance" },
      isMultiline: {
        kind: "boolean",
        label: "Multiline",
        section: "appearance",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
