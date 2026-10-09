import type { PrimitiveBinding } from "../types";

/**
 * Body — 페이지 루트 컨테이너 leaf (`<body>` → generic `<div>`).
 *
 * **ADR-912 container shell 3 catalog 등록 (Body/Section/Nav, 2026-06-04)**:
 *   Canvas 시각은 rule(`COMPONENT_RULES_TABLE.body`, fill `{color.base}`) 의 generic box 다 —
 *   자식이 있으면 배경(box)만 그린다.
 *
 * **DOM contract (2026-09-18)**: INTERNAL_RENDERERS 미등록 → domBinding.tsx `ruleDom` 의 generic
 *   `div` fallback 을 쓴다. lowercase canonical type 은 `isBodyType` 으로 `react-aria-Body` class 가 되고,
 *   loaded generated CSS가 display/font/width/overflow 및 조건부 viewport min-height를 담당한다.
 *   기존 canonical 문서의 infrastructure class/기본 inline style은 DOM 투영에서 정규화한다.
 *
 * D1: composition `<body>` 페이지 루트 (internal source, generic `div` fallback).
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
