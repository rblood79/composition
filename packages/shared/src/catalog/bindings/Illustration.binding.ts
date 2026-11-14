import type { PrimitiveBinding } from "../types";

/**
 * Illustration — the svg picture of an IllustratedMessage (S2 `Illustration` —
 * `@react-spectrum/s2/src/Icon.tsx` `createIllustration`, an Icon-family svg sized S 48 · M 96 ·
 * L 160). The IllustratedMessage sets its size (S · M → M, L → L — its `IllustrationContext`); the
 * author picks the glyph.
 *
 * **DOM**: `domBinding.tsx` `illustration` draws it as the Icon glyph (Lucide svg). **Canvas**: the
 * `icon_font` primitive, sized by the rule's `iconSize` (`compositionRoot.ts` glyph bindings).
 *
 * D1: composition (an svg — no RAC part). D2: iconName + size (S2 `size`) + strokeWidth (the
 * Icon's — composition, default 1). D3: rule
 * `COMPONENT_RULES_TABLE.Illustration` — sizes.iconSize + colors.text (S2 `--iconPrimary` neutral).
 */
export const illustrationBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "illustration" },
  props: {
    accepts: {
      iconName: {
        kind: "icon",
        label: "Illustration",
        section: "content",
        default: "image",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // (2026-11-14, 사용자 「Illustration 의 stroke-width: 1」) The picture's line — the Icon's prop,
      //   its default half the Icon's (a 96 px picture at the Icon's 2 draws an 8 px line).
      strokeWidth: {
        kind: "number",
        label: "Stroke Width",
        section: "appearance",
        default: 1,
        min: 0.5,
        max: 4,
        step: 0.5,
      },
    },
    toRacProps: "default",
  },
  // Lucide glyph (icon_font) primitive — Icon.binding 동형.
  skiaPrimitive: "icon_font",
};
