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

// 2026-10-05 감사 LOW — 함수 인자 안의 괄호 (drop-shadow(… rgb(…))) 를 끊지 않는다.
describe("filterValue — 중첩 괄호", () => {
  it("drop-shadow 의 rgb() 를 보존한 채 blur 만 바꾼다", () => {
    const filter = "drop-shadow(0 0 4px rgb(0 0 0 / 0.5)) blur(2px)";
    expect(parseFilterBlurPx(filter)).toBe(2);
    expect(setFilterBlurPx(filter, 6)).toBe(
      "blur(6px) drop-shadow(0 0 4px rgb(0 0 0 / 0.5))",
    );
    expect(setFilterBlurPx(filter, null)).toBe(
      "drop-shadow(0 0 4px rgb(0 0 0 / 0.5))",
    );
  });
});
