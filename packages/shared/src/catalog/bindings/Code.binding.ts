import type { PrimitiveBinding } from "../types";

/**
 * Code — 인라인 코드 텍스트 leaf (`<code>`, monospace + 배경 box).
 *
 * **ADR-912 위험군 해소 (선행-4 deletion-risk → catalog 등록, 2026-06-04)**: [[Text]] 와
 *   달리 height>0 box형 + fontFamily mono. spec.render.shapes 가 Skia 시각 + 측정 유일 source
 *   였다. catalog 등록으로 rule(`COMPONENT_RULES_TABLE.Code`, fontSize+lineHeight+textWeight:400
 *   +**fontFamily mono**) + buildCatalogShapes generic 으로 이전.
 *
 * **fontFamily generic 보강 필수 (2026-06-04)**: buildCatalogShapes 가 fontFamily 를 sans 고정
 *   했으나 `visual.fontFamily`(rule) 읽도록 보강 → Code mono 가 catalog 경로로 정확 재현
 *   (textWeight 보강과 동형 패턴). ComponentRuleVariant.fontFamily / ComponentVisualRule.fontFamily
 *   필드 추가 + resolveSkiaVisualRule 투영.
 *
 * **source = internal**: RAC standalone Code 없음 → internal. DOM generic fallthrough
 *   (`react-aria-Code` + getElementForTag→`<code>`). Skia = box+text generic(mono).
 *
 * D1: composition `<code>` (internal source, generic DOM).
 * D2: children/size 편집 surface.
 * D3: 시각(배경/텍스트/mono/weight 400)은 theme rule(COMPONENT_RULES_TABLE.Code).
 */
export const codeBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "code",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "sm",
      },
    },
    toRacProps: "default",
  },
};
