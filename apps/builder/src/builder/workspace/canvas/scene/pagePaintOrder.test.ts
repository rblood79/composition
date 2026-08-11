// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildPagePaintRank, orderPagesForPaint } from "./pagePaintOrder";

const pages = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];

describe("orderPagesForPaint", () => {
  it("활성 페이지를 마지막(페인트 최상단)으로 이동하고 나머지는 문서 순서 유지", () => {
    expect(orderPagesForPaint(pages, "p2").map((p) => p.id)).toEqual([
      "p1",
      "p3",
      "p2",
    ]);
  });

  it("활성 페이지가 없으면 문서 순서 그대로", () => {
    expect(orderPagesForPaint(pages, null).map((p) => p.id)).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
  });

  it("활성 페이지가 목록에 없으면 문서 순서 그대로", () => {
    expect(orderPagesForPaint(pages, "missing").map((p) => p.id)).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const input = [...pages];
    orderPagesForPaint(input, "p1");
    expect(input.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("buildPagePaintRank", () => {
  it("활성 페이지가 최고 rank (위에 그려짐)", () => {
    const rank = buildPagePaintRank(pages, "p1");
    expect(rank.get("p1")).toBe(2);
    expect(rank.get("p2")).toBe(0);
    expect(rank.get("p3")).toBe(1);
  });

  it("활성 페이지 없으면 문서 순서 rank", () => {
    const rank = buildPagePaintRank(pages, null);
    expect(rank.get("p1")).toBe(0);
    expect(rank.get("p3")).toBe(2);
  });
});
