import type { PrimitiveBinding } from "../types";

/**
 * IllustratedMessage — 빈 상태(empty state) 표시 leaf (일러스트 placeholder + Heading + Description).
 *
 * **ADR-912 진로 1번 IllustratedMessage proof slice (internal leaf catalog 등록, 2026-06-06)**:
 *   heading/description 은 자식 노드가 아니라 props 다. placeholder roundRect + heading text +
 *   description text 3 shape 는 buildCatalogShapes box+text(단일 box+단일 text)로 표현 불가.
 *
 *   **Skia**: `skiaPrimitive: "illustrated_message"` escape(skiaPrimitives.ts, append 모드)가 placeholder+
 *   heading+description 자체 생성. rule fill transparent base box 위에 합성.
 *
 *   **DOM**: source.renderer="illustrated" → INTERNAL_RENDERERS["illustrated"](IllustratedMessage.tsx
 *   React 컴포넌트). heading/description 이 props 라 `ruleDom` 의 fallback 으로는 안 그려진다(자식
 *   children 0) → INTERNAL_RENDERERS 어댑터 필수.
 *
 * D1: composition `<div role="status">` (internal source, INTERNAL_RENDERERS 어댑터).
 * D2: heading + description + variant(default) + size(sm/md/lg) 편집.
 * D3: 시각(placeholder dim + text 색)은 Skia escape + DOM 인라인 style 시각 대칭.
 *     theme rule(COMPONENT_RULES_TABLE.IllustratedMessage)이 fontSize/text 색 base.
 */
export const illustratedMessageBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "illustrated",
  },
  staticAttrs: {
    role: "status",
  },
  props: {
    accepts: {
      heading: {
        kind: "string",
        label: "Heading",
        section: "content",
      },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
    // ADR-151 후속 (2026-07-17): size 는 DOM 컴포넌트의 metric 계산 semantic input —
    //   data-attr 가 아니라 React prop 으로 통과 (StatusLight/Avatar 선례 동형). 미통과 시
    //   IllustratedMessage.tsx 가 md 고정으로 렌더되어 Skia escape(sm/lg 반응)와 비대칭.
    propPassthrough: ["size"],
  },
  skiaPrimitive: "illustrated_message",
};
