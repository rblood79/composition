import { describe, expect, it } from "vitest";
import { isBodyType } from "../predicates";

describe("isBodyType", () => {
  it("canonical 소문자 body 와 export 런타임 모델의 Body 둘 다 body 다", () => {
    expect(isBodyType("body")).toBe(true);
    expect(isBodyType("Body")).toBe(true);
    expect(isBodyType("BODY")).toBe(true);
  });

  it("다른 타입 · 빈 값은 body 가 아니다", () => {
    expect(isBodyType("frame")).toBe(false);
    expect(isBodyType("bodyText")).toBe(false);
    expect(isBodyType("")).toBe(false);
    expect(isBodyType(null)).toBe(false);
    expect(isBodyType(undefined)).toBe(false);
  });
});
