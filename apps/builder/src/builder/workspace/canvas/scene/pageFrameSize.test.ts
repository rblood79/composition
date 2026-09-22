import { describe, expect, it } from "vitest";
import { readPageFrameSize, resolvePageFrameSize } from "./pageFrameSize";

describe("resolvePageFrameSize — 페이지 frame 은 body 저작 크기를 따른다", () => {
  it("style 없음 → breakpoint 크기", () => {
    expect(resolvePageFrameSize(undefined, 1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("px · 숫자 · % 를 읽고, auto/calc 는 breakpoint 로", () => {
    expect(resolvePageFrameSize({ height: "1600px" }, 1920, 1080)).toEqual({
      width: 1920,
      height: 1600,
    });
    expect(resolvePageFrameSize({ width: 1200, height: "50%" }, 1920, 1080)).toEqual({
      width: 1200,
      height: 540,
    });
    expect(resolvePageFrameSize({ width: "100%", height: "auto" }, 1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(resolvePageFrameSize({ width: "calc(100% - 20px)", height: "0px" }, 1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
    });
  });
});

describe("readPageFrameSize — store 모양 (pageIndex + elementsMap) 에서 body 를 찾는다", () => {
  it("body 의 style.height 1600px → 1920×1600 · body 없는 페이지는 breakpoint", () => {
    const elementsByPage = new Map([
      ["p1", new Set(["btn", "body-1"])],
      ["p2", new Set(["x"])],
    ]);
    const elementsMap = new Map([
      ["btn", { type: "Button", props: { style: { height: "9999px" } } }],
      ["body-1", { type: "body", props: { style: { height: "1600px", overflow: "auto" } } }],
      ["x", { type: "Text" }],
    ]);
    expect(readPageFrameSize("p1", elementsByPage, elementsMap, 1920, 1080)).toEqual({
      width: 1920,
      height: 1600,
    });
    expect(readPageFrameSize("p2", elementsByPage, elementsMap, 1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(readPageFrameSize("p3", elementsByPage, elementsMap, 390, 844)).toEqual({
      width: 390,
      height: 844,
    });
  });
});
