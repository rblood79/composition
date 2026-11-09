import type { ComponentRule } from "../../types/catalog-style.types";

const clearPaint = {
  backgroundColor: { default: "{color.transparent}" },
  color: { default: "{color.neutral}" },
};
const actionBarBox = {
  display: "flex",
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
          // S2 `selectBoxStyles` horizontal: a grid — the illustration in the first column across the
          // rows, a 10px gutter, the label over the description (a 2px row between) in the last, each
          // centred in its row (`labelText` · `descriptionText` `alignSelf: center`). S2's rows are
          // `min-content 2 min-content`; the 48 illustration (`minSize: 48`) spanning them makes the
          // browser give each text row (48 − 2) / 2 = 23 — written here as the rows' floor, which the
          // Canvas engine does not derive from a spanning item.
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
              "grid-template-rows": "minmax(23px, auto) 2px minmax(23px, auto)",
              gap: "0px",
              "justify-content": "flex-start",
            },
            nested: [
              {
                selector: '> [slot="illustration"]',
                styles: {
                  "grid-column": "1",
                  "grid-row": "1 / 4",
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
                  "grid-row": "3",
                  "align-self": "center",
                  "text-align": "start",
                },
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
