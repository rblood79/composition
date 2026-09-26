import { describe, expect, it } from "vitest";
import {
  readPageFrameSize,
  resolveNeutralPageFrameSize,
  resolvePageFrameSize,
} from "./pageFrameSize";

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
    expect(
      resolvePageFrameSize({ width: 1200, height: "50%" }, 1920, 1080),
    ).toEqual({
      width: 1200,
      height: 540,
    });
    expect(
      resolvePageFrameSize({ width: "100%", height: "auto" }, 1920, 1080),
    ).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(
      resolvePageFrameSize(
        { width: "calc(100% - 20px)", height: "0px" },
        1920,
        1080,
      ),
    ).toEqual({
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
      [
        "body-1",
        {
          type: "body",
          props: { style: { height: "1600px", overflow: "auto" } },
        },
      ],
      ["x", { type: "Text" }],
    ]);
    expect(
      readPageFrameSize("p1", elementsByPage, elementsMap, 1920, 1080),
    ).toEqual({
      width: 1920,
      height: 1600,
    });
    expect(
      readPageFrameSize("p2", elementsByPage, elementsMap, 1920, 1080),
    ).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(
      readPageFrameSize("p3", elementsByPage, elementsMap, 390, 844),
    ).toEqual({
      width: 390,
      height: 844,
    });
  });
});

describe("resolveNeutralPageFrameSize — ADR-231 Components 페이지는 breakpoint 뷰포트를 읽지 않는다", () => {
  it("저작 크기 없음 → 폭 1920 (desktop 상수) · 높이 = max(1080, 발행 높이)", () => {
    expect(resolveNeutralPageFrameSize(undefined, undefined)).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(resolveNeutralPageFrameSize({ overflow: "auto" }, 3000)).toEqual({
      width: 1920,
      height: 3000,
    });
    expect(resolveNeutralPageFrameSize({}, 500)).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("저작 width/height 가 있으면 그 값이 발행 높이보다 우선 (리뷰 m3 — 저작값 보존)", () => {
    expect(resolveNeutralPageFrameSize({ height: "1080px" }, 3000)).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(
      resolveNeutralPageFrameSize({ width: 1200, height: 2400 }, 3000),
    ).toEqual({
      width: 1200,
      height: 2400,
    });
  });

  it("readPageFrameSize 에 neutral 옵션을 주면 breakpoint 인자 (390×844) 를 무시한다", () => {
    const elementsByPage = new Map([["pc", new Set(["body-c"])]]);
    const elementsMap = new Map([
      [
        "body-c",
        {
          type: "body",
          props: { style: { overflow: "auto", display: "flex" } },
        },
      ],
    ]);
    expect(
      readPageFrameSize("pc", elementsByPage, elementsMap, 390, 844, {
        neutral: true,
        publishedContentHeight: 2600,
      }),
    ).toEqual({ width: 1920, height: 2600 });
    expect(
      readPageFrameSize("pc", elementsByPage, elementsMap, 390, 844, {
        neutral: true,
      }),
    ).toEqual({ width: 1920, height: 1080 });
    // neutral 이 아니면 종전 그대로
    expect(
      readPageFrameSize("pc", elementsByPage, elementsMap, 390, 844),
    ).toEqual({
      width: 390,
      height: 844,
    });
  });
});
