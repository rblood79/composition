import { beforeAll, describe, expect, it } from "vitest";

import { EngineLayout } from "@/builder/workspace/canvas/wasm-bindings/engine";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

/**
 * Intrinsic measure sentinels kept out of ordinary lengths — Chromium re-audit 2026-10-19
 * (§7-7 C-NEW-1 · C-NEW-2 · C-NEW-8 · F10). Each case builds the same tree in the DOM and in the
 * engine and compares border-box rects (relative to the root) of the labelled nodes.
 */
const EPS = 0.5;

interface Node {
  label: string;
  /** CSS for the DOM leg. */
  css: string;
  /** The engine's style (`NodeStyle` JSON keys). */
  style: Record<string, unknown>;
  children?: Node[];
  /** Text content (DOM) — the engine leaf takes measured scalars instead. */
  text?: string;
}

type Rect = { x: number; y: number; w: number; h: number };

function domLeg(root: Node): Map<string, Rect> {
  const elements = new Map<string, HTMLElement>();
  const build = (node: Node): HTMLElement => {
    const el = document.createElement("div");
    el.style.cssText = `box-sizing:border-box;margin:0;padding:0;border:0;font:16px/20px sans-serif;${node.css}`;
    if (node.text) el.textContent = node.text;
    for (const child of node.children ?? []) el.appendChild(build(child));
    elements.set(node.label, el);
    return el;
  };
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:absolute;top:0;left:0;width:1000px;";
  wrapper.appendChild(build(root));
  document.body.appendChild(wrapper);
  const base = elements.get(root.label)!.getBoundingClientRect();
  const out = new Map<string, Rect>();
  for (const [label, el] of elements) {
    const r = el.getBoundingClientRect();
    out.set(label, {
      x: r.x - base.x,
      y: r.y - base.y,
      w: r.width,
      h: r.height,
    });
  }
  document.body.removeChild(wrapper);
  return out;
}

/** A text leaf's min/max-content and line height from the DOM (the TS measure's role). */
function textScalars(text: string) {
  const probe = (width: string) => {
    const el = document.createElement("div");
    el.style.cssText = `position:absolute;font:16px/20px sans-serif;width:${width};`;
    el.textContent = text;
    document.body.appendChild(el);
    const w = el.getBoundingClientRect().width;
    document.body.removeChild(el);
    return w;
  };
  return { min: probe("min-content"), max: probe("max-content") };
}

function engineLeg(root: Node, wrap?: Map<string, number>): Map<string, Rect> {
  const engine = new EngineLayout();
  if (!engine.isAvailable()) throw new Error("engine WASM 미준비");
  const flat: { style: Record<string, unknown>; children: number[] }[] = [];
  const labels: string[] = [];
  const visit = (node: Node): number => {
    const children = (node.children ?? []).map(visit);
    const style = { ...node.style };
    if (node.text) {
      const { min, max } = textScalars(node.text);
      Object.assign(style, {
        contentMinWidth: min,
        contentMaxWidth: max,
        contentHeight: wrap?.get(node.label) ?? 20,
      });
    }
    flat.push({ style, children });
    labels.push(node.label);
    return flat.length - 1;
  };
  visit(root);
  const handles = engine.buildTreeBatch(JSON.stringify(flat));
  engine.computeLayout(handles[handles.length - 1], 1000, -1);
  const layouts = engine.getLayoutsBatch(handles);
  const parent = new Map<number, number>();
  flat.forEach((n, i) => n.children.forEach((c) => parent.set(c, i)));
  const abs = (i: number): { x: number; y: number } => {
    const l = layouts.get(handles[i])!;
    const p = parent.get(i);
    if (p === undefined) return { x: 0, y: 0 };
    const pp = abs(p);
    return { x: pp.x + l.x, y: pp.y + l.y };
  };
  const out = new Map<string, Rect>();
  labels.forEach((label, i) => {
    const l = layouts.get(handles[i])!;
    const a = abs(i);
    out.set(label, { x: a.x, y: a.y, w: l.width, h: l.height });
  });
  return out;
}

function diff(root: Node, check: string[], wrap?: Map<string, number>) {
  const dom = domLeg(root);
  const eng = engineLeg(root, wrap);
  const bad: string[] = [];
  for (const label of check)
    for (const key of ["x", "y", "w", "h"] as const) {
      const d = dom.get(label)![key];
      const e = eng.get(label)![key];
      if (Math.abs(d - e) > EPS)
        bad.push(`${label}.${key}: dom=${d.toFixed(1)} eng=${e.toFixed(1)}`);
    }
  return bad;
}

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
