import { describe, expect, it } from "vitest";
import { resolveRemeasureStyle } from "../sizeProperties";

/**
 * ADR-027 후속 5 — Step 4.5 재측정은 자기 확정 폭 (actualWidth) 에서 잰다. `%` 폭을 그대로 넘기면
 * enrich 가 (1차와 같은 식으로) 자기 폭에 비율을 또 곱한다: 50% Text 171 → 85.5 → 줄 수 증가.
 */
describe("resolveRemeasureStyle", () => {
  it("% 폭은 확정 폭 px 로 바꿔 잰다", () => {
    expect(
      resolveRemeasureStyle({ width: "50%", padding: "4px" }, 171),
    ).toEqual({ width: 171, padding: "4px" });
  });
  it("확정 폭과 같은 px 선언은 재사용하고 다른 폭 선언은 측정용으로만 치환한다", () => {
    const px = { width: "300px" };
    expect(resolveRemeasureStyle(px, 300)).toBe(px);
    expect(resolveRemeasureStyle(px, 100)).toEqual({ width: 100 });
    expect(px.width).toBe("300px");
    expect(resolveRemeasureStyle({}, 200)).toEqual({
      width: 200,
    });
    expect(resolveRemeasureStyle({ width: "min-content" }, 200)).toEqual({
      width: 200,
    });
  });
});
