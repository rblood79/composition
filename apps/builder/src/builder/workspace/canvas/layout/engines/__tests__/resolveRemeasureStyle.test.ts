import { describe, expect, it } from "vitest";
import { resolveRemeasureStyle } from "../fullTreeLayout";

/**
 * ADR-027 후속 5 — Step 4.5 재측정은 자기 확정 폭 (actualWidth) 에서 잰다. `%` 폭을 그대로 넘기면
 * enrich 가 (1차와 같은 식으로) 자기 폭에 비율을 또 곱한다: 50% Text 171 → 85.5 → 줄 수 증가.
 */
describe("resolveRemeasureStyle", () => {
  it("% 폭은 확정 폭 px 로 바꿔 잰다", () => {
    expect(
      resolveRemeasureStyle(
        { width: "50%", padding: "4px" },
        undefined,
        "50%",
        171,
      ),
    ).toEqual({ width: 171, padding: "4px" });
  });
  it("px 폭은 그대로, implicit 주입 폭은 store 에 폭이 없을 때만 (종전)", () => {
    const px = { width: "300px" };
    expect(resolveRemeasureStyle(px, "200px", "300px", 300)).toBe(px);
    expect(resolveRemeasureStyle({}, "200px", undefined, 200)).toEqual({
      width: "200px",
    });
    const none = {};
    expect(resolveRemeasureStyle(none, undefined, undefined, 200)).toBe(none);
  });
});
