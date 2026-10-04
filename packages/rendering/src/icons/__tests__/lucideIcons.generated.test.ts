import { describe, expect, it } from "vitest";
import { getIconData, LUCIDE_ICON_NAMES } from "../lucideIcons";

describe("Lucide generated icon registry", () => {
  it("keeps the v1.46 icon data and layout direction icons", () => {
    expect(LUCIDE_ICON_NAMES.length).toBeGreaterThan(1_800);
    expect(LUCIDE_ICON_NAMES).toContain("layout-arrow-right");
    expect(LUCIDE_ICON_NAMES).toContain("layout-arrow-down");
    expect(getIconData("layout-arrow-right")?.paths).toContain("M3 18h18");
    expect(getIconData("layout-arrow-down")?.paths).toContain("M18 3v18");
  });
});
