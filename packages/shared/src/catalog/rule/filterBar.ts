import type { ComponentRule } from "../../types/catalog-style.types";

/**
 * ADR-320 Phase 2 — the filter bar's rules (D3). No S2 · design-data component is a filter bar
 * (breakdown §9 Phase 0 「D2 확인」), so the look borrows the nearest S2 parts as they are:
 *
 * - FilterBar: a wrapping row (the gap of S2 `ActionButtonGroup`'s horizontal row — 4 at S, 8
 *   above). The chips' frame and the three ActionButtons are its items.
 * - FilterChip: the S2 `Tag` chip box — its fill · border · text colors, radius and border per
 *   size (`Tag` rule), its height the bar's control height around the buttons (`CHIP_PADDING_Y`)
 *   and the inline padding 2 (the quiet buttons bring their own `edge-to-text`).
 *
 * The buttons are ActionButton instances (their own rule); the chip's field text is a Text (the
 * chip's font). The chips repeat per condition (resolver rows — `runtime/filterBar.ts`).
 */

const FILTER_SIZES = ["S", "M", "L"] as const;

const BAR_BLOCK = {
  S: { gap: 4, fontSize: "{typography.text-xs}" },
  M: { gap: 8, fontSize: "{typography.text-sm}" },
  L: { gap: 8, fontSize: "{typography.text-base}" },
} as const;

const barBox = {
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
};

export const FILTER_BAR_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  sizes: Object.fromEntries(
    FILTER_SIZES.map((size) => [
      size,
      {
        height: 0,
        fontSize: BAR_BLOCK[size].fontSize,
        borderRadius: "{radius.none}",
        gap: BAR_BLOCK[size].gap,
      },
    ]),
  ),
  containerStyles: barBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: barBox,
    composition: { delegation: [] },
  },
};

/**
 * S2 `Tag` per size (the `Tag` rule's radius); the chip's words are its buttons' (one size below —
 * ActionButton XS · S · M), so a chip reads in one size.
 */
const CHIP_BLOCK = {
  S: {
    fontSize: "{typography.text-2xs}",
    lineHeight: "{typography.text-2xs--line-height}",
    borderRadius: "{radius.sm}",
  },
  M: {
    fontSize: "{typography.text-xs}",
    lineHeight: "{typography.text-xs--line-height}",
    borderRadius: "{radius.md}",
  },
  L: {
    fontSize: "{typography.text-sm}",
    lineHeight: "{typography.text-sm--line-height}",
    borderRadius: "{radius.lg}",
  },
} as const;

/**
 * The chip box is the bar's control height (S2 `size.height`) around buttons one size below:
 * (height − button − border × 2) / 2 — S 24 = XS 20, M 32 = S 24, L 40 = M 32 (border 1).
 */
const CHIP_PADDING_Y = { S: 1, M: 3, L: 3 } as const;

const chipBox = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
};

export const FILTER_CHIP_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: {
    default: {
      // S2 `Tag` at rest (the `Tag` rule's default branch).
      paint: {
        backgroundColor: { default: "{color.layer-1}" },
        color: {
          default: "{color.neutral}",
          isDisabled: "{color.disabled-content}",
        },
        borderColor: { default: "{color.border}" },
      },
      textWeight: 400,
    },
  },
  sizes: Object.fromEntries(
    FILTER_SIZES.map((size) => [
      size,
      {
        ...CHIP_BLOCK[size],
        height: 0,
        borderWidth: "{border.width.thin}",
        paddingX: 2,
        paddingY: CHIP_PADDING_Y[size],
        gap: 0,
      },
    ]),
  ),
  containerStyles: chipBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: chipBox,
    composition: { delegation: [] },
  },
};
