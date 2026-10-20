import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("LayoutSection direction icon contract", () => {
  it("uses layout direction arrows for the row and column controls", async () => {
    const source = await readFile(
      resolve(__dirname, "LayoutSection.tsx"),
      "utf-8",
    );

    expect(source).toContain("LayoutArrowRight");
    expect(source).toContain("LayoutArrowDown");
    expect(source).not.toContain("StretchVertical");
    expect(source).not.toContain("StretchHorizontal");
  });
});

describe("LayoutSection Gap input contract", () => {
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
