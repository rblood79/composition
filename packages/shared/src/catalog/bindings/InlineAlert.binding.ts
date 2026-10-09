import type { PrimitiveBinding } from "../types";

/**
 * InlineAlert — 인라인 알림 box 컨테이너 leaf (Spectrum 2 InlineAlert).
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.InlineAlert`, 5 variant fill + border) 이 bg roundRect +
 *   border **shell 만** 그린다. 제목 · 설명은 Heading · Description 원본의 instance 인 자식 노드가
 *   그린다 (ADR-254 — InlineAlert 는 size 를 전달).
 *
 * **DOM**: `INTERNAL_RENDERERS` 에 `inlinealert` 가 없어 `ruleDom` 의 fallback
 *   `div.react-aria-InlineAlert` (+ `data-size` / `data-variant`) 로 그린다 → generated
 *   InlineAlert.css selector 가 매칭된다.
 *
 * **staticAttrs (role 보강)**: fallback 상자는 RAC 가 아닌 단순 styled div 라 role 부여처가 없다.
 *   `ruleDom` 이 staticAttrs 의 role="alert"/aria-live="polite" 를 싣는다 — 스크린리더 alert 접근성 보존.
 *
 * D1: composition `<div role="alert">` (internal source, `ruleDom` fallback + staticAttrs).
 * D2: variant(5종 neutral/info/positive/notice/negative) + size(sm/md/lg) 편집.
 * D3: 시각(variant 별 배경/테두리/패딩)은 theme rule(COMPONENT_RULES_TABLE.InlineAlert).
 */
export const inlineAlertBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "inlinealert",
  },
  staticAttrs: {
    role: "alert",
    "aria-live": "polite",
  },
  props: {
    accepts: {
      // kind:"variant"/"size" 는 options 미보유(types.ts) — 값 집합은 theme rule 동적 제공.
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "info",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // S2 1.8.0 fillStyle (2026-10-10): S2 border · subtleFill · boldFill — house 값은
      //   outline · subtle · bold (라벨이 S2 이름). 기본 outline = S2 자체 기본 'border'.
      //   칠은 rule variants 의 fill 3축 (componentRulesTable.ts InlineAlert), bold 의
      //   제목 · 설명 글자색은 파생 color (`presence.ts` catalogInlineAlertBoldText).
      fillStyle: {
        kind: "fillStyle",
        label: "Fill Style",
        section: "appearance",
        default: "outline",
        options: [
          { value: "outline", label: "Border" },
          { value: "subtle", label: "Subtle Fill" },
          { value: "bold", label: "Bold Fill" },
        ],
      },
    },
    toRacProps: "default",
  },
};
