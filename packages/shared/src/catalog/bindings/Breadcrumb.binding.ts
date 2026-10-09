import type { PrimitiveBinding } from "../types";

/**
 * Breadcrumb — Breadcrumbs 의 단일 경로 조각 (origin template: label Link + 구분자 Icon 자식).
 *
 * **ADR-912 projection 3 cutover (2026-06-15, Pattern B + replace escape)**: Canvas 시각은
 *   rule(`COMPONENT_RULES_TABLE.Breadcrumb`: variants.default base fill + colors.text/textHover +
 *   sizes.{fontSize/height/borderRadius}) + `breadcrumb_crumb` skiaPrimitive(replace).
 *   - 자식이 있는 조각은 자식 노드가 그린다 — escape 는 `_hasChildren` 이면 빈 배열(투명 컨테이너).
 *   - 자식 없는 조각만 escape 가 label + 구분자를 label 폭만큼 우측 누적으로 그린다(`_isLast` 데이터
 *     분기). 컴포넌트 식별 분기 0(ADR-142 §3).
 *
 * **DOM = `CATALOG_DELEGATED_DOM.breadcrumb` (ADR-256 Phase 5a)**: RAC `Breadcrumb` 안에 자식 노드를
 *   순서대로 그린다. Breadcrumbs 밖(Components page 샘플)이면 RAC collection 이 필요해 box 없는
 *   `Breadcrumbs` host 로 감싼다.
 *
 * D1: RAC `<Breadcrumbs>`/`<Breadcrumb>`/`<Link>` + ARIA(role=listitem, aria-current). RAC D1/ARIA 권위 보존.
 * D2: children(label) + href + size 편집 surface.
 * D3: 시각(라벨 색/크기/굵기 + separator)은 theme rule + breadcrumb_crumb escape.
 */
export const breadcrumbBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "breadcrumb",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
      href: { kind: "string", label: "Href", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "breadcrumb_crumb",
};
