import { describe, expect, it } from "vitest";
import {
  headerClipPath,
  headerTransform,
  isRectInViewport,
  pageHeaderScreenRect,
  pageOccluderScreenRect,
  resolveHeaderVisibleRect,
  subtractRectKeepLargest,
  PAGE_HEADER_GAP,
  PAGE_HEADER_HEIGHT,
} from "./pageHeaderGeometry";

const frame = { id: "p", x: 100, y: 200, width: 390, height: 844 };

describe("pageHeaderScreenRect — 화면 px 고정 높이, 폭만 zoom", () => {
  it("zoom 1: top = pageY + panY − 29, width = page width", () => {
    const rect = pageHeaderScreenRect(frame, frame, {
      zoom: 1,
      panX: 10,
      panY: 20,
    });
    expect(rect).toEqual({ left: 110, top: 184, width: 390, height: 28 });
    expect(PAGE_HEADER_HEIGHT + PAGE_HEADER_GAP).toBe(36);
  });

  it("zoom 2: 위치·폭은 2배, 높이는 28 그대로", () => {
    const rect = pageHeaderScreenRect(frame, frame, {
      zoom: 2,
      panX: 0,
      panY: 0,
    });
    expect(rect).toEqual({ left: 200, top: 364, width: 780, height: 28 });
  });

  it("drag 델타가 반영된 position 을 받는다 (프레임 원본은 안 바뀐다)", () => {
    const rect = pageHeaderScreenRect({ x: frame.x + 50, y: frame.y }, frame, {
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    expect(rect.left).toBe(150);
  });
});

describe("pageOccluderScreenRect — body ∪ 헤더 한 rect", () => {
  it("헤더 상단부터 body 하단까지", () => {
    const rect = pageOccluderScreenRect(frame, frame, {
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    expect(rect).toEqual({ left: 100, top: 164, width: 390, height: 880 });
  });
});

describe("subtractRectKeepLargest / resolveHeaderVisibleRect", () => {
  const header = { left: 0, top: 0, width: 400, height: 28 };

  it("겹치지 않으면 그대로", () => {
    expect(
      subtractRectKeepLargest(header, {
        left: 500,
        top: 0,
        width: 100,
        height: 100,
      }),
    ).toBe(header);
  });

  it("왼쪽을 가리면 오른쪽 구간이 남는다", () => {
    expect(
      subtractRectKeepLargest(header, {
        left: -100,
        top: -50,
        width: 250,
        height: 200,
      }),
    ).toEqual({ left: 150, top: 0, width: 250, height: 28 });
  });

  it("오른쪽을 가리면 왼쪽 구간이 남는다", () => {
    expect(
      subtractRectKeepLargest(header, {
        left: 300,
        top: -50,
        width: 300,
        height: 200,
      }),
    ).toEqual({ left: 0, top: 0, width: 300, height: 28 });
  });

  it("양쪽을 가리면 (3 겹침 순차 ∩) 가운데 구간이 남는다", () => {
    const remaining = resolveHeaderVisibleRect(header, [
      { left: -100, top: -50, width: 200, height: 200 },
      { left: 300, top: -50, width: 300, height: 200 },
    ]);
    expect(remaining).toEqual({ left: 100, top: 0, width: 200, height: 28 });
  });

  it("전부 가리면 null", () => {
    expect(
      resolveHeaderVisibleRect(header, [
        { left: -10, top: -10, width: 500, height: 100 },
      ]),
    ).toBeNull();
  });

  it("가운데만 가리면 (inset 하나로 못 표현) 더 넓은 쪽을 남긴다", () => {
    expect(
      subtractRectKeepLargest(header, {
        left: 100,
        top: -50,
        width: 50,
        height: 200,
      }),
    ).toEqual({ left: 150, top: 0, width: 250, height: 28 });
  });

  it("아래쪽만 걸치면 위 띠가 남는다 (세로 부분 겹침)", () => {
    expect(
      subtractRectKeepLargest(header, {
        left: -10,
        top: 20,
        width: 500,
        height: 100,
      }),
    ).toEqual({ left: 0, top: 0, width: 400, height: 20 });
  });
});

describe("headerClipPath / transform / viewport", () => {
  const header = { left: 100, top: 50, width: 400, height: 28 };

  it("잘린 곳이 없으면 빈 문자열 (clip 해제)", () => {
    expect(headerClipPath(header, header)).toBe("");
  });

  it("남는 구간을 헤더 로컬 inset 으로", () => {
    expect(
      headerClipPath(header, { left: 250, top: 50, width: 250, height: 28 }),
    ).toBe("inset(0px 0px 0px 150px)");
    expect(
      headerClipPath(header, { left: 100, top: 50, width: 300, height: 20 }),
    ).toBe("inset(0px 100px 8px 0px)");
  });

  it("transform 은 음수 좌표도 그대로 쓴다 (clamp 금지)", () => {
    expect(
      headerTransform({ left: -12.5, top: -29, width: 10, height: 28 }),
    ).toBe("translate3d(-12.50px, -29px, 0)");
  });

  it("뷰포트 교차 판정 — 0×0 컨테이너는 호출자가 컬링을 끈다", () => {
    const viewport = { width: 1000, height: 800 };
    expect(isRectInViewport(header, viewport)).toBe(true);
    expect(isRectInViewport({ ...header, left: 1000 }, viewport)).toBe(false);
    expect(isRectInViewport({ ...header, top: -28 }, viewport)).toBe(false);
    expect(isRectInViewport({ ...header, top: -27 }, viewport)).toBe(true);
  });
});
