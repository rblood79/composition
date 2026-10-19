import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import { diff, domLeg, EPS, engineLeg, type Node } from "./treeOracle";

/**
 * Intrinsic measure sentinels kept out of ordinary lengths — Chromium re-audit 2026-10-19
 * (§7-7 C-NEW-1 · C-NEW-2 · C-NEW-8 · F10). Each case builds the same tree in the DOM and in the
 * engine and compares border-box rects (relative to the root) of the labelled nodes.
 */
const ib = (label: string, w: number, h: number): Node => ({
  label,
  css: `display:inline-block;width:${w}px;height:${h}px;vertical-align:top;`,
  style: { display: "inline-block", width: `${w}px`, height: `${h}px` },
});

describe("측정 센티넬 — Chrome oracle", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  it("C-NEW-1 — max-content 측정에서 inline-block 이 한 줄", () => {
    const root: Node = {
      label: "row",
      css: "display:flex;width:400px;align-items:flex-start;font-size:0;",
      style: { display: "flex", width: "400px", alignItems: "flex-start" },
      children: [
        {
          label: "block",
          css: "display:block;font-size:0;line-height:0;",
          style: { display: "block" },
          children: [ib("a", 50, 20), ib("b", 50, 20), ib("c", 50, 20)],
        },
      ],
    };
    expect(diff(root, ["block", "a", "b", "c"])).toEqual([]);
  });

  it("C-NEW-2 — `width:100%` 컨테이너는 측정에서 키워드가 아니다", () => {
    const cell = (label: string): Node => ({
      label,
      css: "display:block;font-size:0;line-height:0;",
      style: { display: "block" },
      children: [ib(`${label}-1`, 30, 20), ib(`${label}-2`, 30, 20)],
    });
    const root: Node = {
      label: "row",
      css: "display:flex;width:400px;align-items:flex-start;",
      style: { display: "flex", width: "400px", alignItems: "flex-start" },
      children: [
        {
          label: "block",
          css: "display:block;",
          style: { display: "block" },
          children: [
            {
              label: "inner",
              css: "display:flex;width:100%;",
              style: { display: "flex", width: "100%" },
              children: [cell("p"), cell("q")],
            },
          ],
        },
      ],
    };
    expect(diff(root, ["block", "inner", "p", "q"])).toEqual([]);
  });

  it("C-NEW-8 — inline-block 텍스트 leaf 의 shrink-to-fit 폭", () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta";
    const root: Node = {
      label: "box",
      css: "display:block;width:100px;",
      style: { display: "block", width: "100px" },
      children: [
        {
          label: "leaf",
          css: "display:inline-block;",
          style: { display: "inline-block" },
          text,
        },
      ],
    };
    // Height is the TS re-wrap's (`rewrap`) — compare the width the engine gives it.
    const dom = domLeg(root).get("leaf")!;
    const eng = engineLeg(root).get("leaf")!;
    expect(Math.abs(dom.w - eng.w)).toBeLessThan(EPS);
  });

  it("F10 — 풀 수 없는 `%` min-height 는 0 (automatic minimum 아님)", () => {
    const root: Node = {
      label: "page",
      css: "display:block;width:200px;",
      style: { display: "block", width: "200px" },
      children: [
        {
          label: "col",
          css: "display:flex;flex-direction:column;max-height:100px;",
          style: {
            display: "flex",
            flexDirection: "column",
            maxHeight: "100px",
          },
          children: [
            {
              label: "item",
              css: "display:block;min-height:50%;",
              style: { display: "block", minHeight: "50%" },
              children: [
                {
                  label: "tall",
                  css: "display:block;height:300px;",
                  style: { display: "block", height: "300px" },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(diff(root, ["col", "item"])).toEqual([]);
  });
});
