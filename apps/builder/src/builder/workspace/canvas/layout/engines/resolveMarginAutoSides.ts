/** margin shorthand와 개별 속성의 auto 방향을 CSS 우선순위대로 해석한다. */
export function resolveMarginAutoSides(
  style: Record<string, unknown> | undefined,
): {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
} {
  const result = { top: false, right: false, bottom: false, left: false };
  if (!style) return result;

  // shorthand에서 auto 판별
  if (typeof style.margin === "string") {
    const tokens = style.margin.trim().split(/\s+/);
    const sides = (() => {
      switch (tokens.length) {
        case 1:
          return {
            top: tokens[0],
            right: tokens[0],
            bottom: tokens[0],
            left: tokens[0],
          };
        case 2:
          return {
            top: tokens[0],
            right: tokens[1],
            bottom: tokens[0],
            left: tokens[1],
          };
        case 3:
          return {
            top: tokens[0],
            right: tokens[1],
            bottom: tokens[2],
            left: tokens[1],
          };
        case 4:
          return {
            top: tokens[0],
            right: tokens[1],
            bottom: tokens[2],
            left: tokens[3],
          };
        default:
          return { top: "", right: "", bottom: "", left: "" };
      }
    })();
    result.top = sides.top === "auto";
    result.right = sides.right === "auto";
    result.bottom = sides.bottom === "auto";
    result.left = sides.left === "auto";
  }

  // 개별 속성이 shorthand를 override (CSS 우선순위)
  if (style.marginTop !== undefined) result.top = style.marginTop === "auto";
  if (style.marginRight !== undefined)
    result.right = style.marginRight === "auto";
  if (style.marginBottom !== undefined)
    result.bottom = style.marginBottom === "auto";
  if (style.marginLeft !== undefined) result.left = style.marginLeft === "auto";

  return result;
}
