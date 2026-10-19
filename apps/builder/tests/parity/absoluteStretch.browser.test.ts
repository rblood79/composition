import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import { diff, type Node } from "./treeOracle";

/**
 * A box stretched by both insets lays its in-flow children out in the stretched size (Blink
 * `out_of_flow_layout_part.cc` — Chromium re-audit 2026-10-19 §7-7 B-NEW-1).
 */
const cb = (children: Node[]): Node => ({
  label: "cb",
  css: "position:relative;width:200px;height:100px;",
  style: {
    display: "block",
    position: "relative",
    width: "200px",
    height: "100px",
  },
  children,
});

describe("늘어난 absolute 상자의 in-flow 자식 — Chrome oracle", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  it("left · right 로 늘어난 폭 안의 `width:100%`", () => {
    const root = cb([
      {
        label: "abs",
        css: "position:absolute;left:10px;right:10px;top:0;",
        style: {
          display: "block",
          position: "absolute",
          insetLeft: "10px",
          insetRight: "10px",
          insetTop: "0px",
        },
        children: [
          {
            label: "kid",
            css: "width:100%;height:10px;",
            style: { display: "block", width: "100%", height: "10px" },
          },
        ],
      },
    ]);
    expect(diff(root, ["abs", "kid"])).toEqual([]);
  });

  it("top · bottom 으로 늘어난 높이 안의 column center", () => {
    const root = cb([
      {
        label: "abs",
        css: "position:absolute;top:0;bottom:0;width:50px;display:flex;flex-direction:column;justify-content:center;",
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "absolute",
          insetTop: "0px",
          insetBottom: "0px",
          width: "50px",
        },
        children: [
          {
            label: "kid",
            css: "height:20px;",
            style: { display: "block", height: "20px" },
          },
        ],
      },
    ]);
    expect(diff(root, ["abs", "kid"])).toEqual([]);
  });
});
