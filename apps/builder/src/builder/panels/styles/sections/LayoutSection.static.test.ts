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
  it("renders the Gap input with the spacing token presets and the direction's gap glyph", async () => {
    // legend 「Gap」 + ▾ 토큰 preset (XS · 4 …) — 2026-09-15 사용자 판정 (px 단위 하나뿐인 메뉴는 쓸모 없다).
    // 칸 안 앞 표시는 숫자 칸 공통 (Figma 방식, 사용자 결정 2026-11-10 — 종전 「아이콘 없음」 을 뒤집음):
    //   주축이 세로면 GapVertical, 그 밖은 GapHorizontal.
    const source = await readFile(
      resolve(__dirname, "LayoutSection.tsx"),
      "utf-8",
    );

    const gap = source.slice(source.indexOf('label="Gap"'));
    const field = gap.slice(0, gap.indexOf("/>"));
    expect(field).toContain('units={["px"]}');
    expect(field).toContain("presets={SPACING_PRESET_OPTIONS}");
    expect(field).not.toContain("unitSuffix");
    expect(field).toContain(
      'icon={flexDirectionKeys[0] === "column" ? GapVertical : GapHorizontal}',
    );
  });
});
