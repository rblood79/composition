/** RAC Sheet 예제의 장식 handle. CSS와 Canvas가 같은 치수·색을 소비한다. */
export const SHEET_HANDLE = {
  length: 80,
  thickness: 6,
  inset: 12,
  radius: 6,
  color: "var(--border)",
} as const;

const handleStyles: Record<string, Record<string, string>> = {
  "& > .sheet-handle": {
    position: "absolute",
    "z-index": "2",
    "border-radius": `${SHEET_HANDLE.radius}px`,
    background: SHEET_HANDLE.color,
    "pointer-events": "none",
  },
  ...Object.fromEntries(
    ["bottom", "vertical", "top", "left", "horizontal", "right"].map(
      (direction) => {
        const vertical = ["bottom", "vertical", "top"].includes(direction);
        const edge = vertical
          ? direction === "top"
            ? "bottom"
            : "top"
          : direction === "right"
            ? "left"
            : "right";
        return [
          `&[data-swipe-direction='${direction}'] > .sheet-handle`,
          {
            [edge]: `${SHEET_HANDLE.inset}px`,
            [vertical ? "left" : "top"]: "50%",
            transform: vertical ? "translateX(-50%)" : "translateY(-50%)",
            width: `${vertical ? SHEET_HANDLE.length : SHEET_HANDLE.thickness}px`,
            height: `${vertical ? SHEET_HANDLE.thickness : SHEET_HANDLE.length}px`,
          },
        ];
      },
    ),
  ),
  "&[data-has-descendants] > .sheet-handle": { opacity: "0" },
};
export const SHEET_HANDLE_SELECTORS = Object.fromEntries(
  Object.entries(handleStyles).map(([selector, styles]) => [
    selector,
    { styles },
  ]),
);

export function catalogSheetHandleRect(
  direction: string,
  width: number,
  height: number,
) {
  const vertical = ["bottom", "vertical", "top"].includes(direction);
  return {
    x: vertical
      ? (width - SHEET_HANDLE.length) / 2
      : direction === "right"
        ? SHEET_HANDLE.inset
        : width - SHEET_HANDLE.inset - SHEET_HANDLE.thickness,
    y: vertical
      ? direction === "top"
        ? height - SHEET_HANDLE.inset - SHEET_HANDLE.thickness
        : SHEET_HANDLE.inset
      : (height - SHEET_HANDLE.length) / 2,
    width: vertical ? SHEET_HANDLE.length : SHEET_HANDLE.thickness,
    height: vertical ? SHEET_HANDLE.thickness : SHEET_HANDLE.length,
  };
}
