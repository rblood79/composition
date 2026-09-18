import type { PrimitiveBinding } from "../types";

/**
 * Body — 페이지 루트 컨테이너 leaf (`<body>` → generic `<div>`).
 *
 * **ADR-912 container shell 3 catalog 등록 (Body/Section/Nav, 2026-06-04)**:
 *   Body 는 catalog 미등록 상태에서 spec.render.shapes(Body.spec.ts:74-140) 가 Skia 시각
 *   source 였다(미등록 → buildSpecNodeData:1195 usesGeneric=false → spec fallback). catalog
 *   등록으로 시각을 rule(`COMPONENT_RULES_TABLE.body`, fill `{color.base}`) + buildCatalogShapes
 *   generic box 로 이전하여 spec 의존을 끊는다. Body 는 SHELL_ONLY_CONTAINER_TAGS 멤버(lowercase
 *   "body", buildSpecNodeData:170) 라 _hasChildren=true 항상 주입 → buildCatalogShapes 가 box(bg)
 *   만 반환(L168 early return) → spec.render.shapes 의 "자식 있으면 bg 만"(Body.spec.ts:124) 과
 *   시각 대칭.
 *
 * **DOM contract (2026-09-18)**: INTERNAL_RENDERERS 미등록 → generic fallback 경로를 사용한다.
 *   renderer가 lowercase canonical type을 case-correct `react-aria-Body` class로 투영하고,
 *   loaded generated CSS가 display/font/width/overflow 및 조건부 viewport min-height를 담당한다.
 *   기존 canonical 문서의 infrastructure class/기본 inline style은 DOM 투영에서 정규화한다.
 *
 * D1: composition `<body>` 페이지 루트 (internal source, generic DOM via KNOWN_HTML body→div).
 *     Preview/Publish의 nested body div와 실제 document.body 동기화가 같은 class resolver를 쓴다.
 * D2: children(페이지 콘텐츠)만 — 페이지 루트는 최소 surface.
 * D3: 시각(배경 `{color.base}`)은 theme rule(COMPONENT_RULES_TABLE.body).
 */
export const bodyBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "body",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
