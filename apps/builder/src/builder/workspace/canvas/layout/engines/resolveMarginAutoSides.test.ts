import { describe, expect, it } from "vitest";
import { resolveMarginAutoSides } from "./resolveMarginAutoSides";

describe("resolveMarginAutoSides", () => {
  it.each([
    ["auto", [true, true, true, true]],
    ["0 auto", [false, true, false, true]],
    ["auto 0 12px", [true, false, false, false]],
    ["1px auto auto 0", [false, true, true, false]],
    ["0 0 0 0 auto", [false, false, false, false]],
  ])("shorthand %s의 네 방향을 해석한다", (margin, expected) => {
    const sides = resolveMarginAutoSides({ margin });
    expect([sides.top, sides.right, sides.bottom, sides.left]).toEqual(
      expected,
    );
  });

  it("개별 속성은 shorthand auto를 켜거나 해제하고 undefined는 덮지 않는다", () => {
    expect(
      resolveMarginAutoSides({
        margin: "auto 0",
        marginTop: 0,
        marginRight: "auto",
        marginBottom: undefined,
        marginLeft: "12px",
      }),
    ).toEqual({ top: false, right: true, bottom: true, left: false });
    expect(resolveMarginAutoSides(undefined)).toEqual({
      top: false,
      right: false,
      bottom: false,
      left: false,
    });
  });
});
