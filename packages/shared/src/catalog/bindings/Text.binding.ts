import type { PrimitiveBinding } from "../types";

/**
 * Text — TEXT_LEAF 순수 텍스트 leaf (`<span>` — RAC `Text`, S2 `Text` 와 같은 요소. 2026-11-18 정정).
 *
 * **ADR-912 위험군 해소 (선행-3/4 deletion-risk → catalog 등록, 2026-06-04)**: Text 는
 *   catalog 미등록 상태에서 spec.render.shapes 가 Skia 시각 + 텍스트 측정 height 의 이중
 *   유일 source 였다(deletion-risk). catalog 등록으로 시각·측정을 모두 rule(`COMPONENT_RULES_TABLE.Text`,
 *   fontSize+lineHeight 완비) + buildCatalogShapes generic 으로 이전하여 spec 의존을 끊는다.
 *
 * **source = internal**: RAC 에 standalone `Text` controller 없음(slot 컴포넌트) → internal.
 *   DOM 은 전용 DomBinding `text` (`domBinding.runtime.ts`) — 연결된 slot 이면 RAC `Text`, 끊긴 slot 이면
 *   일반 `span`, 둘 다 `react-aria-Text` className + data-size + generated CSS.
 *
 * **Skia = box+text generic**: skiaPrimitive 없음 → buildCatalogShapes(transparent bg + text).
 *   height=0 순수 텍스트라 lineHeight 가 측정 본질 → buildCatalogShapes lineHeight push 보강
 *   (2026-06-04)으로 catalog 측정 경로의 fontSize*1.5 fallback drift 해소.
 *
 * D1: RAC `Text` `<span>` (internal source — 전용 DomBinding).
 * D2: children/size 편집 surface.
 * D3: 시각(텍스트 색/크기/lineHeight)은 theme rule(COMPONENT_RULES_TABLE.Text).
 */
export const textBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "text",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};
