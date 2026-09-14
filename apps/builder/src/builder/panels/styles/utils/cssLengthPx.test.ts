import { describe, expect, it } from "vitest";
import { resolveCssLengthPx } from "./cssLengthPx";

describe("resolveCssLengthPx", () => {
  it("px · 단위 없는 숫자 · shorthand 첫 값", () => {
    expect(resolveCssLengthPx("8px")).toBe(8);
    expect(resolveCssLengthPx("3")).toBe(3);
    expect(resolveCssLengthPx("4px 8px")).toBe(4);
    expect(resolveCssLengthPx("0.5px")).toBe(0.5);
  });

  it("rem 은 루트 font-size 로 환산", () => {
    document.documentElement.style.fontSize = "16px";
    expect(resolveCssLengthPx("0.5rem")).toBe(8);
  });

  it("var() 토큰은 문서 루트 computed value 로 푼다 — 정의가 없으면 null", () => {
    expect(resolveCssLengthPx("var(--radius-undefined-token)")).toBeNull();
    document.documentElement.style.setProperty("--radius-probe", "6px");
    expect(resolveCssLengthPx("var(--radius-probe)")).toBe(6);
  });

  it("키워드 · 빈 값은 null", () => {
    expect(resolveCssLengthPx("auto")).toBeNull();
    expect(resolveCssLengthPx("")).toBeNull();
    expect(resolveCssLengthPx(undefined)).toBeNull();
  });
});
