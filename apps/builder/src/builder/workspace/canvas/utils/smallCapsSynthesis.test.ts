import { describe, expect, it } from "vitest";
import {
  applyFontVariantCaps,
  isSyntheticSmallCaps,
  normalizeFontVariantCaps,
  SMALL_CAPS_SCALE,
  splitSmallCapsRuns,
} from "./smallCapsSynthesis";

describe("smallCapsSynthesis — font-variant-caps 합성 (2026-09-20)", () => {
  it("배율은 Blink 합성값 0.7", () => {
    expect(SMALL_CAPS_SCALE).toBe(0.7);
  });

  it("normalizeFontVariantCaps — caps 값만 통과, 그 외 normal", () => {
    expect(normalizeFontVariantCaps("small-caps")).toBe("small-caps");
    expect(normalizeFontVariantCaps(" All-Small-Caps ")).toBe("all-small-caps");
    expect(normalizeFontVariantCaps("tabular-nums")).toBe("normal");
    expect(normalizeFontVariantCaps(undefined)).toBe("normal");
  });

  it("isSyntheticSmallCaps — unicase · titling-caps 는 Chrome 도 합성하지 않는다", () => {
    expect(isSyntheticSmallCaps("small-caps")).toBe(true);
    expect(isSyntheticSmallCaps("all-petite-caps")).toBe(true);
    expect(isSyntheticSmallCaps("unicase")).toBe(false);
    expect(isSyntheticSmallCaps("normal")).toBe(false);
  });

  it("small-caps — 소문자 run 만 대문자 · small (공백 · 숫자 · 한글 · 대문자는 본문)", () => {
    expect(splitSmallCapsRuns("Bye 12 가나 bye", "small-caps")).toEqual([
      { text: "B", small: false },
      { text: "YE", small: true },
      { text: " 12 가나 ", small: false },
      { text: "BYE", small: true },
    ]);
  });

  it("all-small-caps — `\\n` 만 빼고 전부 축소 (Chrome 실측: 숫자·한글 포함)", () => {
    expect(splitSmallCapsRuns("ab\n12 가", "all-small-caps")).toEqual([
      { text: "AB", small: true },
      { text: "\n", small: false },
      { text: "12 가", small: true },
    ]);
  });

  it("applyFontVariantCaps — 지원 ctx 에만, 값이 같으면 다시 쓰지 않는다", () => {
    let writes = 0;
    // getter/setter 객체 리터럴의 `this` 는 `{}` 로 추론돼 `_v` 접근이 TS2339 — 상태를 밖에 둔다.
    const state = { v: "normal" };
    const ctx = {
      get fontVariantCaps() {
        return state.v;
      },
      set fontVariantCaps(v: string) {
        writes++;
        state.v = v;
      },
    } as unknown as CanvasRenderingContext2D;
    applyFontVariantCaps(ctx, "small-caps");
    applyFontVariantCaps(ctx, "small-caps");
    expect(state.v).toBe("small-caps");
    expect(writes).toBe(1);
    applyFontVariantCaps({} as CanvasRenderingContext2D, "small-caps"); // 미지원 → no-op
  });
});
