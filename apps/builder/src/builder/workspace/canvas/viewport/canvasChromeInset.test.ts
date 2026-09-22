// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readCanvasRailInset } from "./canvasChromeInset";

function railDoc(
  rails: Array<{ side: "left" | "right"; left: number; width: number }>,
) {
  const nodes = new Map<string, Element>();
  for (const rail of rails) {
    const el = document.createElement("div");
    el.className = "panel-toggle-rail";
    el.dataset.side = rail.side;
    el.getBoundingClientRect = () =>
      ({
        left: rail.left,
        right: rail.left + rail.width,
        width: rail.width,
        top: 0,
        bottom: 0,
        height: 0,
        x: rail.left,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    nodes.set(`.panel-toggle-rail[data-side="${rail.side}"]`, el);
  }
  return { querySelector: (sel: string) => nodes.get(sel) ?? null };
}

describe("readCanvasRailInset", () => {
  it("좌우 레일의 바깥 여백까지 더한다 (실측 4+40 × 2 = 88)", () => {
    const doc = railDoc([
      { side: "left", left: 4, width: 40 },
      { side: "right", left: 1396, width: 40 },
    ]);
    expect(readCanvasRailInset(doc, 1440)).toBe(88);
  });

  it("레일이 없으면 0 — 전폭을 그대로 쓴다", () => {
    expect(readCanvasRailInset(railDoc([]), 1440)).toBe(0);
  });

  it("한쪽만 있으면 그쪽만 뺀다", () => {
    expect(
      readCanvasRailInset(
        railDoc([{ side: "left", left: 4, width: 40 }]),
        1440,
      ),
    ).toBe(44);
  });

  it("폭 0 (숨김) 레일은 세지 않는다", () => {
    const doc = railDoc([
      { side: "left", left: 0, width: 0 },
      { side: "right", left: 1396, width: 40 },
    ]);
    expect(readCanvasRailInset(doc, 1440)).toBe(44);
  });

  it("document 가 없으면 0 (SSR · 테스트)", () => {
    expect(readCanvasRailInset(undefined, 1440)).toBe(0);
  });
});
