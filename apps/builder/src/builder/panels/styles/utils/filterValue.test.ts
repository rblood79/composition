import { describe, expect, it } from "vitest";
import { parseFilterBlurPx, setFilterBlurPx } from "./filterValue";

describe("filterValue — blur 한 종, 나머지 함수 보존", () => {
  it("parse", () => {
    expect(parseFilterBlurPx(undefined)).toBeNull();
    expect(parseFilterBlurPx("none")).toBeNull();
    expect(parseFilterBlurPx("blur(4px)")).toBe(4);
    expect(parseFilterBlurPx("brightness(1.2) blur(2.5px)")).toBe(2.5);
    expect(parseFilterBlurPx("brightness(1.2)")).toBeNull();
  });

  it("set / remove", () => {
    expect(setFilterBlurPx(undefined, 4)).toBe("blur(4px)");
    expect(setFilterBlurPx("blur(4px)", 8)).toBe("blur(8px)");
    expect(setFilterBlurPx("brightness(1.2) blur(4px)", 6)).toBe(
      "blur(6px) brightness(1.2)",
    );
    expect(setFilterBlurPx("brightness(1.2) blur(4px)", null)).toBe(
      "brightness(1.2)",
    );
    // 마지막 함수 제거 → "" (inline 키 삭제, "none" 아님)
    expect(setFilterBlurPx("blur(4px)", null)).toBe("");
    expect(setFilterBlurPx("none", 3)).toBe("blur(3px)");
  });
});
