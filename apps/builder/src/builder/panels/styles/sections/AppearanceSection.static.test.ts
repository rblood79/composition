import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("AppearanceSection border preset contract", () => {
  it("uses separate width and radius preset lists", async () => {
    const source = await readFile(
      resolve(__dirname, "AppearanceSection.tsx"),
      "utf-8",
    );

    expect(source).toContain("BORDER_WIDTH_PRESET_OPTIONS");
    expect(source).toContain("BORDER_RADIUS_PRESET_OPTIONS");
    expect(source).toContain('presetAriaLabel="Border Width Preset"');
    expect(source).toContain('presetAriaLabel="Border Radius Preset"');
    expect(source).not.toContain('units={["reset", "px"]}');
  });

  it("keeps radius presets on the shared radius token scale", async () => {
    const source = await readFile(
      resolve(__dirname, "../../../components/property/propertyUnitPresets.ts"),
      "utf-8",
    );

    expect(source).toContain('value: "var(--radius-xs)"');
    expect(source).toContain('value: "var(--radius-sm)"');
    expect(source).toContain('value: "var(--radius-md)"');
    expect(source).toContain('value: "var(--radius-lg)"');
    expect(source).toContain('value: "var(--radius-xl)"');
    expect(source).toContain('{ id: "xs", label: "XS", value: "1px" }');
    expect(source).toContain('{ id: "xl", label: "XL", value: "12px" }');
  });
});
