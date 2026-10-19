import { beforeAll, describe, expect, it } from "vitest";

import { EngineLayout } from "@/builder/workspace/canvas/wasm-bindings/engine";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

/**
 * Border widths snap to device pixels — Blink `StyleBuilderConverter::ClampLineWidth`
 * (style_builder_converter.cc:1970): 0 < w < 1 device px → 1, else floor. The engine snaps at the
 * ratio it is given (`setDevicePixelRatio`); the DOM leg is this browser at its own ratio.
 *
 * Tolerance 0.01 — the shared parity `TOL` (1px) would pass every case here (2026-10-19: a 0.5px
 * hairline is 1px at DPR 1, so ListBox headers were 27 on the Canvas and 28 in the Preview).
 */
const EPS = 0.01;
const WIDTHS = ["0.5px", "0.3px", "1px", "1.5px", "2.7px"];

interface Measured {
  height: number;
  childX: number;
  childY: number;
}

function domLeg(border: string): Measured {
  const box = document.createElement("div");
  box.style.cssText = `position:absolute;top:0;left:0;width:200px;box-sizing:border-box;padding:4px;border:${border} solid black;`;
  const child = document.createElement("div");
  child.style.cssText = "height:10px;";
  box.appendChild(child);
  document.body.appendChild(box);
  const outer = box.getBoundingClientRect();
  const inner = child.getBoundingClientRect();
  document.body.removeChild(box);
  return {
    height: outer.height,
    childX: inner.x - outer.x,
    childY: inner.y - outer.y,
  };
}

function engineLeg(border: string, dpr: number | undefined): Measured {
  const engine = new EngineLayout();
  if (!engine.isAvailable()) throw new Error("engine WASM 미준비");
  if (dpr !== undefined) engine.setDevicePixelRatio(dpr);
  const edges = Object.fromEntries(
    ["Top", "Right", "Bottom", "Left"].flatMap((side) => [
      [`border${side}`, border],
      [`padding${side}`, "4px"],
    ]),
  );
  const handles = engine.buildTreeBatch(
    JSON.stringify([
      { style: { display: "block", height: "10px" }, children: [] },
      { style: { display: "block", width: "200px", ...edges }, children: [0] },
    ]),
  );
  engine.computeLayout(handles[1], 200, -1);
  const layouts = engine.getLayoutsBatch(handles);
  const box = layouts.get(handles[1])!;
  const child = layouts.get(handles[0])!;
  return { height: box.height, childX: child.x, childY: child.y };
}

describe("border 폭 device pixel snap — Chrome oracle", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });
  for (const border of WIDTHS)
    it(`border ${border} @ DPR ${window.devicePixelRatio}`, () => {
      const dom = domLeg(border);
      const eng = engineLeg(border, window.devicePixelRatio);
      for (const key of ["height", "childX", "childY"] as const)
        expect(
          Math.abs(dom[key] - eng[key]),
          `${key}: dom=${dom[key]} eng=${eng[key]}`,
        ).toBeLessThan(EPS);
    });
  it("대조군 — snap 기준이 없으면 hairline 이 Chrome 과 갈린다 (DPR 1)", () => {
    if (window.devicePixelRatio !== 1) return;
    expect(domLeg("0.5px").height - engineLeg("0.5px", undefined).height).toBe(
      1,
    );
  });
});
