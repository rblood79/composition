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

  it("renders the Gap input with the spacing token presets (px only, no icon)", async () => {
    // legend 「Gap」 + ▾ 토큰 preset (XS · 4 …) — 2026-09-15 사용자 판정 (px 단위 하나뿐인 메뉴는 쓸모 없다)
    const source = await readFile(
      resolve(__dirname, "LayoutSection.tsx"),
      "utf-8",
    );

    const gap = source.slice(source.indexOf('label="Gap"'));
    const field = gap.slice(0, gap.indexOf("/>"));
    expect(field).toContain('units={["px"]}');
    expect(field).toContain("presets={SPACING_PRESET_OPTIONS}");
    expect(field).not.toContain("unitSuffix");
    expect(field).not.toContain("icon=");
  });
});
