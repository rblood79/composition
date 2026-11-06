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
const selectGroupBox = {
  display: "flex",
  flexWrap: "wrap",
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
      borderWidth: 2,
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
          },
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
              "flex-direction": "row",
              gap: "10px",
              "justify-content": "flex-start",
            },
          },
        },
      },
      rootSelectors: {
        '&[data-orientation="vertical"] [slot="description"]': {
          styles: { display: "none" },
        },
        '&[data-orientation="horizontal"] [slot="label"]': {
          styles: { "text-align": "start", "font-weight": "700" },
        },
        '&[data-disabled] [slot="selection"]': { styles: { display: "none" } },
      },
    },
  },
};
