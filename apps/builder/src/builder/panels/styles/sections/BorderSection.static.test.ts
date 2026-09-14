import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("BorderSection border preset contract", () => {
  it("width · radius 프리셋은 각자의 목록을 28 열 메뉴로 연다 (슬라이더 행)", async () => {
    const source = await readFile(
      resolve(__dirname, "BorderSection.tsx"),
      "utf-8",
    );

    expect(source).toContain("BORDER_WIDTH_PRESET_OPTIONS");
    expect(source).toContain("BORDER_RADIUS_PRESET_OPTIONS");
    expect(source).toContain('localize("Border width presets")');
    expect(source).toContain('localize("Border radius presets")');
    // 슬라이더는 px 로만 쓴다 — 프리셋 토큰은 메뉴가 그대로 기록
    expect(source).toContain('updateStyleImmediate("borderWidth", `${px}px`)');
    expect(source).toContain('updateStyleImmediate(prop, preset.value)');
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
