import { describe, expect, it } from "vitest";
import {
  PAGE_STACK_GAP,
  resolvePageLayoutAvailableWidth,
  resolvePageLayoutBrowserWidth,
} from "./pageLayoutConstants";

describe("page layout width constants", () => {
  it("uses the current page gap as the default", () => {
    expect(PAGE_STACK_GAP).toBe(80);
  });

  it("includes visible left/right panel widths and side gaps", () => {
    const metrics = { leftWidth: 240, rightWidth: 320, gap: 4 };

    expect(resolvePageLayoutBrowserWidth(1200, metrics)).toBe(1768);
    expect(resolvePageLayoutAvailableWidth(1200, 0.5, metrics)).toBe(3536);
  });

  it("does not add a gap for a missing panel side", () => {
    expect(
      resolvePageLayoutBrowserWidth(1200, {
        leftWidth: 240,
        rightWidth: 0,
        gap: 4,
      }),
    ).toBe(1444);
  });
});
