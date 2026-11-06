import { describe, expect, it } from "vitest";
import { getIconData, LUCIDE_ICON_NAMES, ICON_NAMES } from "../lucideIcons";

describe("Lucide generated icon registry", () => {
  it("keeps the generated icon data and layout direction icons", () => {
    expect(LUCIDE_ICON_NAMES.length).toBeGreaterThan(1_800);
    expect(LUCIDE_ICON_NAMES).toContain("layout-arrow-right");
    expect(LUCIDE_ICON_NAMES).toContain("layout-arrow-down");
    expect(getIconData("layout-arrow-right")?.paths).toContain("M3 18h18");
    expect(getIconData("layout-arrow-down")?.paths).toContain("M18 3v18");
  });
  it("offers Spectrum glyphs in editor search without replacing Lucide asterisk", () => {
    expect(ICON_NAMES).toEqual(
      expect.arrayContaining([
        "s2-asterisk",
        "s2-cross",
        "s2-search",
        "asterisk",
      ]),
    );
    expect(getIconData("s2-asterisk")?.filled).toBe(true);
    expect(getIconData("asterisk")?.filled).not.toBe(true);
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });
});
