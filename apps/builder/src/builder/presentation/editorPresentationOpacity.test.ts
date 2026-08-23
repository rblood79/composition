import { describe, expect, it } from "vitest";
import { parsePresentationOpacity } from "./editorPresentationOpacity";

describe("parsePresentationOpacity", () => {
  it("unitless 0..1 number/string만 허용한다", () => {
    expect(parsePresentationOpacity(0)).toBe(0);
    expect(parsePresentationOpacity("0.5")).toBe(0.5);
    expect(parsePresentationOpacity("1")).toBe(1);
  });

  it("CSS length/percentage와 범위 밖 값은 거부한다", () => {
    expect(parsePresentationOpacity("0.5px")).toBeNull();
    expect(parsePresentationOpacity("50%")).toBeNull();
    expect(parsePresentationOpacity(-0.1)).toBeNull();
    expect(parsePresentationOpacity(1.1)).toBeNull();
  });
});
