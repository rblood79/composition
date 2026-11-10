import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("BorderSection border preset contract", () => {
  it("Width · Radius 는 「값 + ▾ 토큰 preset」 필드 (ADR-298 사용자 결정 3) + 코너 펼침 토글", async () => {
    const source = await readFile(
      resolve(__dirname, "BorderSection.tsx"),
      "utf-8",
    );

    // Width — 종전 슬라이더 + ⋮ 메뉴 (2026-09-15 판정) 를 토큰 칸으로 (사용자 결정 3, 2026-11-01).
    expect(source).toContain("presets={BORDER_WIDTH_PRESET_OPTIONS}");
    expect(source).not.toContain("PropertySlider");
    expect(source).not.toContain("PropertyRowMenu");
    // preset 은 PropertyUnitInput 이 토큰 그대로 commit 한다 (px 로 풀지 않는다 — ADR-298 D4).
    expect(source).not.toContain("resolveCssLengthPx");
    expect(source).toContain("presets={BORDER_RADIUS_PRESET_OPTIONS}");
    expect(source).not.toContain('localize("Border radius presets")');
    // 코너 4방향은 토글 on 또는 비균일일 때만
    expect(source).toContain("const showCorners = cornersOpen || uniformRadius === null;");
    expect(source).toContain("{showCorners && (");
    expect(source).not.toContain('units={["reset", "px"]}');
    expect(source).not.toContain('labelMode="inline"');
  });

  it("ADR-219: 변 세그먼트 · 코너 2×2 — 표시는 helper 유효값, 쓰기는 shorthand/longhand 배치", async () => {
    const source = await readFile(
      resolve(__dirname, "BorderSection.tsx"),
      "utf-8",
    );
    // 표시 원천은 helper (저장 형태 무관) — longhand 를 직접 읽지 않는다
    expect(source).toContain("styleValues.borderGeometry");
    expect(source).not.toMatch(/style\.borderTopLeftRadius/);
    // 개별 변 4 + 행 끝 전체 액션, 전체 = shorthand, 일부 = longhand 4 배치 한 번
    expect(source).not.toContain('id: "all"');
    expect(source).toContain('aria-label={localize("All sides")}');
    expect(source).toContain('selectionMode="multiple"');
    expect(source).toContain("updateStylesImmediate({");
    expect(source).toContain("borderLeftWidth: mask(\"left\")");
    // 미지원 style 5 — 세그먼트 비활성 + 배지
    for (const style of ["double", "groove", "ridge", "inset", "outset"]) {
      expect(source).toContain(`"${style}"`);
    }
    expect(source).toContain('localize("Skia approximation")');
    // 코너 4칸 — 코너 글리프가 라벨인 28 필드 (panel-ui 02 — 대조 B5), 칸 하나는 그 longhand 하나
    for (const prop of [
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
    ]) {
      expect(source).toContain(`prop: "${prop}"`);
    }
    expect(source).toContain('labelMode="icon"');
    expect(source).toContain("icon={CORNER_ICONS[corner]}");
    expect(source).toContain("updateStyleImmediate(prop, value)");
  });

  it("border preset 은 토큰 표에서 파생한다 (ADR-298 D3 — 숫자를 적지 않는다)", async () => {
    const {
      BORDER_RADIUS_PRESET_OPTIONS,
      BORDER_WIDTH_PRESET_OPTIONS,
    } = await import("../../../components/property/propertyUnitPresets");
    expect(BORDER_RADIUS_PRESET_OPTIONS.map((p) => [p.label, p.value])).toEqual([
      ["Reset", ""],
      ["None", "var(--radius-none)"],
      ["XS", "var(--radius-xs)"],
      ["S", "var(--radius-sm)"],
      ["M", "var(--radius-md)"],
      ["L", "var(--radius-lg)"],
      ["XL", "var(--radius-xl)"],
      ["Full", "var(--radius-full)"],
    ]);
    expect(BORDER_WIDTH_PRESET_OPTIONS.map((p) => [p.label, p.value])).toEqual([
      ["Reset", ""],
      ["none", "var(--border-width-none)"],
      ["thin", "var(--border-width-thin)"],
      ["thick", "var(--border-width-thick)"],
    ]);
  });
});
