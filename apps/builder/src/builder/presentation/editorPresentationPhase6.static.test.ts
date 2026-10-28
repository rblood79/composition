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
    const section = await source("../panels/styles/sections/FillSection.tsx");

    for (const text of [hook, row, section]) {
      expect(text).not.toContain("updateSelectedFillsPreview");
      expect(text).not.toContain("updateFillPreviewThrottled");
      expect(text).not.toContain("onUpdatePreview");
    }
    expect(hook).not.toContain("pendingUpdateRef");
    expect(hook).not.toContain("requestAnimationFrame");
    // 연속 콜백은 첫 레이어의 presentation override (`popover`, FillSection 소유) 가 없으면
    //   no-op — secondary row 가 canonical updater 를 raw input 에 다시 묶지 않는다.
    expect(row).toContain(
      "popover?.onColorChange ?? ignoreContinuousColorChange",
    );
    expect(row).toContain(
      "popover?.onOpacityChange ?? ignoreContinuousOpacityChange",
    );
    expect(row).toContain("popover?.onUpdate ?? ignoreContinuousFillUpdate");
    // 모든 레이어의 연속 콜백은 host 미리보기 (문서·기록 무변경).
    expect(section).toContain(
      "index === 0 ? firstRowPopover : layerPopovers.get(fill.id)",
    );
    expect(section).toMatch(
      /new Map<string, FillLayerRowPopoverOverrides>\(\s*fills\.map/,
    );
  });

  it("가상 fill 은 놓을 때 한 번만 실제 fill 로 승격한다", async () => {
    const section = await source("../panels/styles/sections/FillSection.tsx");
    const previewStart = section.indexOf("const handleColorChange =");
    const terminalStart = section.indexOf("const handleColorChangeEnd =");
    const nextStart = section.indexOf("const handleFillUpdate =");
    expect(previewStart).toBeGreaterThan(-1);
    expect(terminalStart).toBeGreaterThan(previewStart);
    expect(nextStart).toBeGreaterThan(terminalStart);
    expect(section.slice(previewStart, terminalStart)).not.toContain(
      "ensureColorFill(color)",
    );
    expect(section.slice(terminalStart, nextStart)).toContain(
      "ensureColorFill(color)",
    );
  });

  it("Styles host 에 옛 presentation 채널이 돌아오지 않는다", async () => {
    const host = await source("../panels/styles/stylesHostContext.ts");
    expect(host).not.toContain("presentation?:");
    expect(host).not.toContain("StylesPresentationBridge");
  });

  it("공용 color property 는 livePreview 일 때만 드래그를 미리보기로 넘긴다", async () => {
    const propertyColor = await source(
      "../components/property/PropertyColor.components.tsx",
    );

    // `livePreview` 는 Styles host 미리보기 (문서·기록 무변경) 로만 간다.
    expect(propertyColor).toContain("if (!livePreview) return;");
  });
});
