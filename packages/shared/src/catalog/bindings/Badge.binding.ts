/**
 * ADR-142 family ①(primitives/actions) — Badge leaf primitive 의 `PrimitiveBinding`.
 *
 * Badge 는 RAC controller 가 없는 composition 내부 leaf — `<span data-variant data-size
 * data-fill-style>text</span>`(Badge.tsx:78-93). 실측상 **조립이 아닌 styled box+text leaf**
 * (Badge.spec archetype:"simple", roundRect+text — Button 과 동일 모델). inventory §3 의
 * "composed/reusable" 분류 근거('Skeleton 합성')는 isLoading 조건부 대체일 뿐 조립 아님 →
 * 실측 우선(precision)으로 leaf 처리. Icon 에 이은 두 번째 `internal` source.
 *
 * D1: composition 내부 `<span>` (RAC primitive 아님 — internal source).
 * D2: children/variant/fillStyle(bold·subtle·outline)/size/isDot/isPulsing 편집 surface.
 * D3: 시각(배경/텍스트)은 theme/tokens data-* rules. Skia 는 buildCatalogShapes box+text.
 *
 * **propPassthrough (2026-07-14, Icon 전수 감사 동행)**: `Badge.tsx:78-93` 은 `{...props}` **뒤에**
 * 자기 `data-variant` / `data-size` / `data-fill-style` 를 다시 쓴다. passthrough 가 없으면 React
 * prop 이 `undefined` → default(`variant:"accent"` / `size:"sm"` / `fillStyle:undefined`) 가
 * **toRacProps 가 넣어준 data-* 를 덮어써** CSS 가 영원히 default 매칭이다(fillStyle 은 아예 속성
 * 소실). StatusLight 선례와 동일 root-cause — internal leaf 의 semantic prop 을 data-attr 라우팅이
 * 차단하는 구조.
 */

import type { PrimitiveBinding } from "../types";

export const badgeBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "badge",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "accent",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "sm",
      },
      // visual-enum → data-fill-style (Badge fillStyle: bold/subtle/outline)
      fillStyle: {
        kind: "fillStyle",
        label: "Fill Style",
        section: "appearance",
        default: "bold",
        options: [
          { value: "bold", label: "Bold" },
          { value: "subtle", label: "Subtle" },
          { value: "outline", label: "Outline" },
        ],
      },
      isDot: { kind: "boolean", label: "Dot Badge", section: "state" },
      isPulsing: { kind: "boolean", label: "Pulsing", section: "state" },
      // design-data 감사 §2-F (2026-08-21): D3 states.disabled(opacity 0.38)는 준비돼
      //   있었으나 binding 미노출 결손. DOM = Badge.tsx data-disabled emit → generated
      //   `[data-disabled]` CSS / Skia = buildSpecNodeData componentState generic.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
    // Badge.tsx 가 {...props} 뒤에 자기 data-variant/data-size/data-fill-style 를 재작성 →
    //   React prop 으로도 통과시켜야 default 덮어쓰기를 막는다 (data-* 도 함께 emit).
    propPassthrough: ["variant", "size", "fillStyle"],
  },
  // isDot 모드는 비-DOM-trivial 원(circle) → skiaPrimitive "dot"(isDot 아니면 box+text fallback).
  skiaPrimitive: "dot",
};
