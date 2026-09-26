import { describe, expect, it } from "vitest";
import {
  applyEngineSizeProperties,
  isAutoOrIntrinsicSize,
  sizeMayDependOnContent,
  toEngineDimension,
} from "../sizeProperties";

describe("크기 선언의 엔진 전달 계약", () => {
  it.each([
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
  ])("%s는 0·상대 단위·백분율·intrinsic을 보존한다", (key) => {
    for (const [input, expected] of [
      [0, 0],
      ["2rem", 32],
      ["50%", "50%"],
      ["min-content", "min-content"],
      ["max-content", "max-content"],
      ["fit-content", "fit-content"],
    ]) {
      const result: Record<string, unknown> = {};
      applyEngineSizeProperties(result, { [key]: input }, { rootFontSize: 16 });
      expect(result).toEqual({ [key]: expected });
      expect(toEngineDimension(expected as string | number)).toBe(
        typeof expected === "number" ? `${expected}px` : expected,
      );
    }
  });

  it("auto는 생략하고 숫자 0은 고정 크기로 유지한다", () => {
    const result: Record<string, unknown> = {};
    applyEngineSizeProperties(result, { width: 0, height: "auto" }, {});
    expect(result).toEqual({ width: 0 });
    expect(isAutoOrIntrinsicSize(0)).toBe(false);
  });

  it("고정 크기여도 해당 축에 intrinsic 제약이 있으면 내용 변경을 재측정한다", () => {
    const style = { width: 100, height: 20, minHeight: "min-content" };
    expect(sizeMayDependOnContent(style, "width")).toBe(false);
    expect(sizeMayDependOnContent(style, "height")).toBe(true);
    expect(
      sizeMayDependOnContent({ ...style, maxWidth: "fit-content" }, "width"),
    ).toBe(true);
  });
});
