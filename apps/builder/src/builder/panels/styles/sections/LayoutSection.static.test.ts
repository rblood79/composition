import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Padding · Margin 은 SpacingSection (박스 모델 BoxModelEditor 하나 — 8-필드 폴백은 2026-09-15 제거) 으로 옮겨졌다
describe("SpacingSection spacing input commit contract", () => {
  it("does not connect box-model typing to a live preview callback", async () => {
    const source =
      (await readFile(resolve(__dirname, "SpacingSection.tsx"), "utf-8")) +
      (await readFile(
        resolve(__dirname, "../components/BoxModelEditor.tsx"),
        "utf-8",
      ));

    expect(source).not.toContain("onPreview?:");
    expect(source).not.toContain("handlePaddingPreview");
    expect(source).not.toContain("handleMarginPreview");
    expect(source).not.toContain("onPreview={handlePaddingPreview}");
    expect(source).not.toContain("onPreview={handleMarginPreview}");
  });

  it("guards the Enter commit from being repeated by the following blur", async () => {
    const source = await readFile(
      resolve(__dirname, "../components/BoxModelEditor.tsx"),
      "utf-8",
    );

    expect(source).toContain("justSavedViaEnterRef");
    expect(source).toContain("if (justSavedViaEnterRef.current)");
  });

  it("renders the Gap input as a unit-suffix field (px only, no token presets, no icon)", async () => {
    // panel-ui 01 「8 PX」 — 대조 B4: 토큰 preset ▾ · 아이콘 prefix 대신 단위 suffix (stepper 는 09-15 전부 제거)
    const source = await readFile(
      resolve(__dirname, "LayoutSection.tsx"),
      "utf-8",
    );

    expect(source).not.toContain("SPACING_PRESET_OPTIONS");
    const gap = source.slice(source.indexOf('label="Gap"'));
    const field = gap.slice(0, gap.indexOf("/>"));
    expect(field).toContain('units={["px"]}');
    expect(field).toContain("unitSuffix");
    expect(field).not.toContain("icon=");
  });
});
