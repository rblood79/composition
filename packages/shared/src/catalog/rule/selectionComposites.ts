import type { ComponentRule } from "../../types/catalog-style.types";

const clearPaint = {
  backgroundColor: { default: "{color.transparent}" },
  color: { default: "{color.neutral}" },
};
const actionBarBox = {
  display: "flex",
  // S2 shows its second DOM box (clear · count) first with `order`; the engine has no `order`, so
  // the row runs reversed — same picture, same DOM (actions first) as S2 (2026-11-18).
  flexDirection: "row-reverse",
  alignItems: "center",
  width: "100%",
  height: "fit-content",
  maxWidth: "960px",
  boxShadow: "{shadow.md}",
};
// S2 `SelectBoxGroup.tsx` `gridStyles`: a grid of equal columns, centred — `repeat(auto-fit,
// minmax(min, min(width, 100%)))` per orientation (the columns below; `min(…, 100%)` is the track's
// `max` when the group is narrower than one column, which the grid's own width already caps).
const selectGroupBox = {
  display: "grid",
  justifyContent: "center",
  width: "100%",
  height: "fit-content",
};
const selectBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  borderStyle: "solid",
};
export const ACTION_BAR_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: {
    default: {
      paint: {
        backgroundColor: {
          default: "{color.layer-2}",
          isEmphasized: "{color.neutral}",
        },
        color: {
          default: "{color.neutral}",
          isEmphasized: "{color.on-neutral}",
        },
      },
    },
  },
  sizes: {
    M: {
      paddingX: 8,
      paddingY: 12,
      gap: 16,
      borderRadius: "{radius.lg}",
      fontSize: "{typography.text-sm}",
      lineHeight: "{typography.text-sm--line-height}",
    },
  },
  containerStyles: actionBarBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: actionBarBox,
    stateStyles: {
      "--neutral-content": { isEmphasized: "{color.on-neutral}" },
      "--neutral-content-hover": { isEmphasized: "{color.on-neutral}" },
      "--disabled-content": {
        isEmphasized: "color-mix(in srgb, var(--on-neutral) 21%, transparent)",
      },
    },
    composition: { delegation: [] },
  },
};
export const SELECT_BOX_GROUP_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: clearPaint } },
  sizes: { M: { gap: 24 } },
  containerStyles: selectGroupBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: selectGroupBox,
    composition: {
      delegation: [],
      containerVariants: {
        orientation: {
          vertical: {
            styles: {
              "grid-template-columns": "repeat(auto-fit, minmax(144px, 170px))",
            },
          },
          horizontal: {
            styles: {
              "grid-template-columns": "repeat(auto-fit, minmax(188px, 368px))",
            },
          },
        },
      },
      rootSelectors: {
        '&[data-selection-mode="single"] [slot="selection"]': {
          styles: { display: "none" },
        },
      },
    },
  },
};
export const SELECT_BOX_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: {
    default: {
      paint: {
        backgroundColor: {
          default: "{color.layer-2}",
          isDisabled: "{color.disabled}",
        },
        color: { default: "{color.neutral}", isDisabled: "{color.disabled}" },
        borderColor: {
          default: "{color.transparent}",
          isSelected: "{color.neutral}",
          isDisabled: "{color.transparent}",
        },
      },
    },
  },
  sizes: {
    M: {
      gap: 8,
      borderRadius: "{radius.lg}",
      borderWidth: "{border.width.thick}", // (theme axis — ADR-227)
      fontSize: "{typography.text-sm}",
      lineHeight: "{typography.text-sm--line-height}",
      fontWeight: 400,
    },
  },
  containerStyles: selectBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: selectBox,
    stateStyles: {
      boxShadow: {
        default: "{shadow.sm}",
        isHovered: "{shadow.md}",
        isSelected: "{shadow.md}",
        isDisabled: "none",
      },
      outline: { isFocusVisible: "2px solid var(--focus-ring)" },
      outlineOffset: { isFocusVisible: "2px" },
    },
    composition: {
      rootPaint: "variant",
      delegation: [],
      containerVariants: {
        orientation: {
          vertical: {
            styles: {
              width: "170px",
              height: "170px",
              "min-width": "144px",
              "min-height": "144px",
              "max-width": "170px",
              "max-height": "170px",
              padding: "24px",
              "flex-direction": "column",
              "justify-content": "center",
            },
            nested: [
              {
                selector: '> [slot="label"]',
                styles: { "text-align": "center" },
              },
            ],
          },
          // S2 `selectBoxStyles` horizontal (`SelectBoxGroup.tsx:164-185`): a grid — the areas
          // `illustration . label` · `illustration . description` over the tracks
          // `min-content 2 min-content` (`gridAutoRows: 1fr`), a 10px gutter. The areas are two rows,
          // so the 48 illustration spans the first two tracks — the label's row is 46 and the
          // description sits centred on the 2px row (Chromium, 2026-11-25). The `:has` blocks below are
          // S2's: label only — one area row; no illustration — tracks `min-content`, the description
          // in an implicit `1fr` row. The Canvas reads them by the parts the box shows
          // (`catalogSelectBoxContentLayout`).
          horizontal: {
            styles: {
              width: "368px",
              height: "auto",
              "min-width": "188px",
              "min-height": "80px",
              "max-width": "480px",
              "max-height": "240px",
              "padding-top": "16px",
              "padding-bottom": "16px",
              "padding-left": "32px",
              "padding-right": "24px",
              display: "grid",
              "grid-template-columns": "min-content 10px minmax(0, 1fr)",
              "grid-template-rows": "min-content 2px min-content",
              "grid-auto-rows": "1fr",
              gap: "0px",
              "justify-content": "flex-start",
            },
            nested: [
              {
                selector: '> [slot="illustration"]',
                styles: {
                  "grid-column": "1",
                  "grid-row": "1 / 3",
                  "align-self": "center",
                  "justify-self": "center",
                },
              },
              {
                selector: '> [slot="label"]',
                styles: {
                  "grid-column": "3",
                  "grid-row": "1",
                  "align-self": "center",
                  "justify-self": "start",
                  "text-align": "start",
                  "font-weight": "700",
                },
              },
              {
                selector: '> [slot="description"]',
                styles: {
                  "grid-column": "3",
                  "grid-row": "2",
                  "align-self": "center",
                  "text-align": "start",
                },
              },
              {
                selector:
                  '&:has([slot="label"]):not(:has([slot="description"])) > [slot="illustration"]',
                styles: { "grid-row": "1 / 2" },
              },
              {
                selector: '&:not(:has([slot="illustration"]))',
                styles: { "grid-template-rows": "min-content" },
              },
            ],
          },
        },
      },
      rootSelectors: {
        // S2: the label and description inherit the item's `font: ui` (not the Text rule's size).
        "& > .react-aria-Text.react-aria-Text": {
          styles: { "font-size": "inherit", "line-height": "inherit" },
        },
        '&[data-orientation="vertical"] [slot="description"]': {
          styles: { display: "none" },
        },
        '&[data-disabled] [slot="selection"]': { styles: { display: "none" } },
      },
    },
  },
};
