import { describe, expect, it } from "vitest";
import { PAGE_STACK_GAP, resolvePageLayoutBounds } from "./pageLayoutConstants";

describe("page layout width constants", () => {
  it("uses the current page gap as the default", () => {
    expect(PAGE_STACK_GAP).toBe(80);
  });

  it("adds visible panels, shell gaps, and edge Page Gaps to browser width", () => {
    const metrics = { leftWidth: 240, rightWidth: 320, gap: 4 };
    const bounds = resolvePageLayoutBounds(1200, 1, 80, metrics);

    expect(bounds.browserWidth).toBe(1928);
    expect(bounds.leftInset).toBe(324);
    expect(bounds.rightInset).toBe(404);
    expect(bounds.availableWidth).toBe(1200);
  });

  it("converts panel extents to world coordinates at the current zoom", () => {
    const bounds = resolvePageLayoutBounds(1200, 0.5, 80, {
      leftWidth: 240,
      rightWidth: 320,
      gap: 4,
    });

    expect(bounds.browserWidth).toBe(3696);
    expect(bounds.leftInset).toBe(568);
    expect(bounds.rightInset).toBe(728);
    expect(bounds.availableWidth).toBe(2400);
  });

  it("does not reserve edge Page Gaps when a panel side is absent", () => {
    const bounds = resolvePageLayoutBounds(1200, 1, 80, {
      leftWidth: 240,
      rightWidth: 0,
      gap: 4,
    });

    expect(bounds.browserWidth).toBe(1524);
    expect(bounds.leftInset).toBe(324);
    expect(bounds.rightInset).toBe(0);
    expect(bounds.availableWidth).toBe(1200);
  });
});
