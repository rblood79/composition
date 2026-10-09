import type { PrimitiveBinding } from "../types";

/**
 * SelectIcon — field-trigger 계열의 아이콘 sub-part (chevron/stepper/search/clear glyph).
 *
 * **ADR-912 R1 (Select family rebuild, 2026-06-12)**: 기존 ComboBoxTrigger/SearchIcon/
 *   SearchClearButton synthetic alias 를 factory retype 으로 본 type 에 합류. Lucide glyph 는
 *   box+text 가 아닌 비-DOM-trivial primitive → Skia 는 `skiaPrimitive: "icon_font"` draw
 *   module(Icon.binding 동형, replace 모드)이 단일 shape 로 그림. 크기는 rule sizes.iconSize,
 *   색은 rule colors.text({color.neutral-subdued}).
 *
 * **DOM**: `domBinding.tsx` 의 `selecticon` 이 glyph 로 그린다 (기본 `chevron-down`). 기본 origin
 *   template 은 이 type 을 쓰지 않는다 (type 등록은 `componentCatalog.ts` 에 남아 있다).
 *
 * D1: composition — DOM 은 `domBinding.tsx` `selecticon` glyph.
 * D2: iconName + size 편집 surface (field control Group 안에서는 trigger owner 의 iconName 을
 *     받는다 — `presence.ts` `fieldSubpartProps`).
 * D3: 시각은 rule sizes.iconSize + colors.text — icon_font glyph 단일.
 */
export const selectIconBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "selecticon" },
  props: {
    accepts: {
      iconName: {
        kind: "icon",
        label: "Icon",
        section: "content",
        default: "chevron-down",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
  },
  // Lucide glyph(icon_font) primitive — box+text 가 아님 (Icon.binding 동형).
  skiaPrimitive: "icon_font",
};
