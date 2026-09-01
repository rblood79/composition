import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("LayoutSection spacing input commit contract", () => {
  it("does not connect FourWayGrid typing to a live preview callback", async () => {
    const source = await readFile(
      resolve(__dirname, "LayoutSection.tsx"),
      "utf-8",
    );

    expect(source).not.toContain("onPreview?:");
    expect(source).not.toContain("handlePaddingPreview");
    expect(source).not.toContain("handleMarginPreview");
    expect(source).not.toContain("onPreview={handlePaddingPreview}");
    expect(source).not.toContain("onPreview={handleMarginPreview}");
  });

  it("guards the Enter commit from being repeated by the following blur", async () => {
    const source = await readFile(
      resolve(__dirname, "LayoutSection.tsx"),
      "utf-8",
    );

    expect(source).toContain("justSavedViaEnterRef");
    expect(source).toContain("if (justSavedViaEnterRef.current)");
  });

  it("uses the shared spacing token preset list for collapsed spacing inputs", async () => {
    const source = await readFile(
      resolve(__dirname, "LayoutSection.tsx"),
      "utf-8",
    );
    const presetsSource = await readFile(
      resolve(__dirname, "../../../components/property/propertyUnitPresets.ts"),
      "utf-8",
    );

    expect(source).toContain(
      'import { SPACING_PRESET_OPTIONS } from "../../../components/property/propertyUnitPresets"',
    );
    expect(source.match(/presets=\{SPACING_PRESET_OPTIONS\}/g)).toHaveLength(3);
    expect(presetsSource).toContain('value: "var(--spacing-xs)"');
    expect(presetsSource).toContain('value: "var(--spacing-xl)"');
  });
});
