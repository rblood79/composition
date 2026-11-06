/** S2 SegmentedControl's selected surface: shared authored part and generated selector. */
export const SEGMENTED_GROUP_CONTAINER = {
  display: "flex",
  gap: "4px",
  width: "fit-content",
  height: "fit-content",
  borderRadius: "8px",
} as const;
export const SEGMENTED_ITEM_CONTAINER = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  width: "fit-content",
  height: "fit-content",
  flexShrink: "0",
  whiteSpace: "nowrap",
} as const;
export const SEGMENTED_INDICATOR_BOX = {
  position: "absolute",
  insetLeft: "0px",
  insetTop: "0px",
} as const;
export const SEGMENTED_INDICATOR_VISUAL = {
  width: "100%",
  height: "100%",
  fill: "var(--bg)",
  borderWidth: 2,
  borderColor: "var(--fg)",
  radius: 10,
} as const;
