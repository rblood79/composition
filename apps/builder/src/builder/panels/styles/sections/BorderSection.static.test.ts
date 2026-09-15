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
    // 슬라이더는 px 로만 쓴다 — 프리셋 토큰 (var(--radius-xl)) 도 px 로 풀어 쓴다: border 기하
    //   배치 (ADR-219 applyBorderGeometryBatch.toNumber) 는 숫자만 읽어 var() 가 0 으로 저장됐다
    //   (2026-09-15 live 재현 — 「XL · 12」 선택 → borderRadius 0)
    expect(source).toContain('updateStyleImmediate("borderWidth", `${px}px`)');
    expect(source).toContain("const px = resolveCssLengthPx(preset.value);");
    expect(source).toContain(
      "updateStyleImmediate(prop, px !== null ? `${px}px` : preset.value)",
    );
    expect(source).not.toContain("updateStyleImmediate(prop, preset.value)");
    expect(source).not.toContain('units={["reset", "px"]}');
    // 슬라이더 라벨은 legend (상자 위) — inline (상자 안 글자) 은 2026-09-15 사용자 판정으로 제거
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
    // 변 세그먼트 5 (전체 · 좌 · 우 · 상 · 하), 전체 = shorthand, 일부 = longhand 4 배치 한 번
    expect(source).toContain('id: "all", label: "All sides"');
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
