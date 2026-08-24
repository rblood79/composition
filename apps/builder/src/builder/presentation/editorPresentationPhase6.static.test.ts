import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function source(path: string): Promise<string> {
  return readFile(resolve(__dirname, path), "utf8");
}

describe("ADR-187 Phase 6 legacy cleanup guards", () => {
  it("ColorPicker는 runtime 외부 frame scheduler를 소유하지 않는다", async () => {
    const picker = await source(
      "../panels/styles/components/ColorPickerPanel.tsx",
    );

    expect(picker).not.toContain("requestAnimationFrame");
    expect(picker).not.toContain("cancelAnimationFrame");
    expect(picker).not.toContain("recordEditorPresentationControlRaf");
  });

  it("fill hook와 store에는 legacy preview write/대기 ref가 없다", async () => {
    const hook = await source("../panels/styles/hooks/useFillActions.ts");
    const row = await source("../panels/styles/components/FillLayerRow.tsx");
    const store = await source("../stores/inspectorActions.ts");
    const section = await source("../panels/styles/sections/FillSection.tsx");

    for (const text of [hook, row, store, section]) {
      expect(text).not.toContain("updateSelectedFillsPreview");
      expect(text).not.toContain("updateFillPreviewThrottled");
      expect(text).not.toContain("onUpdatePreview");
    }
    expect(hook).not.toContain("pendingUpdateRef");
    expect(hook).not.toContain("requestAnimationFrame");
    expect(row).toContain("onColorChange={ignoreContinuousColorChange}");
    expect(row).toContain("onOpacityChange={ignoreContinuousOpacityChange}");
    expect(row).toContain("onUpdate={ignoreContinuousFillUpdate}");
  });

  it("미지원 fill은 commit-only 경계를 유지한다", async () => {
    const section = await source("../panels/styles/sections/FillSection.tsx");
    expect(section).toContain(
      "Unsupported fill targets remain commit-only by design.",
    );
    expect(section).toContain(
      "Unsupported gradient/mesh targets remain commit-only by design.",
    );
    expect(section).toContain(
      "Unsupported paint targets remain commit-only by design.",
    );

    const previewStart = section.indexOf("const handleColorChange =");
    const terminalStart = section.indexOf("const handleColorChangeEnd =");
    const cancelStart = section.indexOf(
      "const handleColorPresentationCancel =",
    );
    expect(previewStart).toBeGreaterThan(-1);
    expect(terminalStart).toBeGreaterThan(previewStart);
    expect(cancelStart).toBeGreaterThan(terminalStart);
    expect(section.slice(previewStart, terminalStart)).not.toContain(
      "ensureColorFill(color)",
    );
    expect(section.slice(terminalStart, cancelStart)).toContain(
      "ensureColorFill(color)",
    );
  });

  it("presentation owner가 없는 공용 color property는 commit-only다", async () => {
    const propertyColor = await source(
      "../components/property/PropertyColor.tsx",
    );

    expect(propertyColor).toContain(
      "if (!presentationOwnsFrameScheduling) return;",
    );
  });
});
