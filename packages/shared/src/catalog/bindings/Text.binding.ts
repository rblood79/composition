import { TEXT_ELEMENT_TYPE_PROP } from "../document/textElementType";
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
 * D1: RAC `Text` — `elementType` 이 요소를 고른다 (기본 `<span>`, internal source — 전용 DomBinding).
 * D2: children 편집 surface — `size` 는 owner context 전용 (S2 `Text` 에 없는 prop, 2026-11-24).
 *   `elementType` (HTML tag — span · p · h1~h6) 은 RAC `Text` 의 prop (S2 에 없음, 사용자 결정 2026-11-25 —
 *   제목은 컴포넌트를 늘리지 않고 Text 의 tag 로, `textElementType.ts`).
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
      // (2026-11-24 — S2 `Text` has no `size`: an owner's context sets it, the author writes a font
      //  size in Styles. No default — without one the words take the parent's font.)
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        editorHidden: true,
      },
      // 사용자 결정 2026-11-25 — the HTML element the Text is (RAC `Text` `elementType`,
      //   `textElementType.ts`): a heading is a Text with an `h1`~`h6` tag.
      elementType: TEXT_ELEMENT_TYPE_PROP,
    },
    toRacProps: "default",
  },
};
