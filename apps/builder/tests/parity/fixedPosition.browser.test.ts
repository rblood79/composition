import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { EngineLayout } from "@/builder/workspace/canvas/wasm-bindings/engine";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import { EPS, type Node, type Rect } from "./treeOracle";

/**
 * ADR-275 Phase 7 (G4 · 사용자 결정 6) — `position: fixed` against Chrome: the page is the body of a
 * 390 × 844 iframe (the Preview viewport), the engine's page root sits under a container root with
 * `setViewport(390, 844)` (the Canvas page frame). Rects are border boxes from the page origin at
 * scroll 0 — the viewport is the page's top screen even when the page is taller.
 */
const VIEWPORT = { w: 390, h: 844 };

let frame: HTMLIFrameElement | undefined;
afterEach(() => {
  frame?.remove();
  frame = undefined;
});

function domLeg(page: Node): Map<string, Rect> {
  frame = document.createElement("iframe");
  frame.style.cssText = `position:absolute;left:0;top:0;border:0;width:${VIEWPORT.w}px;height:${VIEWPORT.h}px;`;
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.body.style.cssText = "margin:0;";
  const elements = new Map<string, HTMLElement>();
  const build = (node: Node): HTMLElement => {
    const el = doc.createElement("div");
    el.style.cssText = `box-sizing:border-box;margin:0;padding:0;border:0 solid;font:16px/20px sans-serif;${node.css}`;
    for (const child of node.children ?? []) el.appendChild(build(child));
    elements.set(node.label, el);
    return el;
  };
  doc.body.appendChild(build(page));
  const base = elements.get(page.label)!.getBoundingClientRect();
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
  return out;
}

function engineLeg(page: Node): Map<string, Rect> {
  const engine = new EngineLayout();
  engine.setViewport(VIEWPORT.w, VIEWPORT.h);
  const flat: { style: Record<string, unknown>; children: number[] }[] = [];
  const labels: string[] = [];
  const visit = (node: Node): number => {
    const children = (node.children ?? []).map(visit);
    flat.push({ style: node.style, children });
    labels.push(node.label);
    return flat.length - 1;
  };
  const pageIndex = visit(page);
  // The page container (`catalog:root`): the page root is its child.
  flat.push({
    style: { display: "flex", alignItems: "flex-start", width: "1000px" },
    children: [pageIndex],
  });
  const handles = engine.buildTreeBatch(JSON.stringify(flat));
  engine.computeLayout(handles[handles.length - 1], 1000, -1);
  const layouts = engine.getLayoutsBatch(handles);
  const parent = new Map<number, number>();
  flat.forEach((n, i) => n.children.forEach((c) => parent.set(c, i)));
  const abs = (i: number): { x: number; y: number } => {
    if (i === pageIndex) return { x: 0, y: 0 };
    const l = layouts.get(handles[i])!;
    const p = abs(parent.get(i)!);
    return { x: p.x + l.x, y: p.y + l.y };
  };
  const out = new Map<string, Rect>();
  labels.forEach((label, i) => {
    const l = layouts.get(handles[i])!;
    out.set(label, { ...abs(i), w: l.width, h: l.height });
  });
  return out;
}

function diff(page: Node, check: string[]): string[] {
  const dom = domLeg(page);
  const eng = engineLeg(page);
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

/** A node from CSS declarations (`left` → `insetLeft`, `padding-top` → `paddingTop`). */
function node(
  label: string,
  decls: Record<string, string>,
  children?: Node[],
): Node {
  const css = Object.entries(decls)
    .map(
      ([key, value]) =>
        `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value};`,
    )
    .join("");
  const style: Record<string, unknown> = { display: "block" };
  for (const [key, value] of Object.entries(decls)) {
    const name = ["left", "right", "top", "bottom"].includes(key)
      ? `inset${key[0].toUpperCase()}${key.slice(1)}`
      : key === "borderWidth"
        ? undefined
        : key;
    if (key === "borderWidth")
      for (const side of ["Top", "Right", "Bottom", "Left"])
        style[`border${side}`] = value;
    else if (name) style[name] = value;
  }
  return { label, css, style, ...(children ? { children } : {}) };
}

const page = (children: Node[], height = "844px") =>
  node(
    "page",
    {
      width: "390px",
      height,
      paddingTop: "10px",
      paddingLeft: "10px",
      borderWidth: "4px",
    },
    children,
  );
const section = (children: Node[], extra: Record<string, string> = {}) =>
  node(
    "section",
    {
      position: "relative",
      marginTop: "100px",
      paddingTop: "20px",
      paddingLeft: "20px",
      borderWidth: "3px",
      height: "300px",
      ...extra,
    },
    children,
  );
const content = (w: number, h: number) =>
  node("content", { width: `${w}px`, height: `${h}px` });

describe("ADR-275 fixed — Chrome oracle (viewport 390 × 844)", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  it("top bar Left + Right 0 inside a padded, bordered, offset section", () => {
    const fixed = node("fixed", {
      position: "fixed",
      left: "0px",
      right: "0px",
      top: "0px",
      height: "50px",
    });
    expect(diff(page([section([fixed])]), ["section", "fixed"])).toEqual([]);
  });

  it("bottom 10% · width 50% — on a page taller than the viewport", () => {
    const fixed = node("fixed", {
      position: "fixed",
      left: "10%",
      bottom: "10%",
      width: "50%",
      height: "60px",
    });
    expect(diff(page([section([fixed])], "2000px"), ["fixed"])).toEqual([]);
  });

  it("Center (unsafe center) · Hug at Right · Top", () => {
    const center = node("fixed", {
      position: "fixed",
      left: "0px",
      right: "0px",
      top: "0px",
      bottom: "0px",
      width: "100px",
      height: "50px",
      justifySelf: "unsafe center",
      alignSelf: "unsafe center",
    });
    const hug = node(
      "hug",
      { position: "fixed", right: "20px", top: "20px", padding: "8px" },
      [content(60, 20)],
    );
    hug.style = {
      ...hug.style,
      paddingTop: "8px",
      paddingRight: "8px",
      paddingBottom: "8px",
      paddingLeft: "8px",
    };
    expect(
      diff(page([section([center, hug])]), ["fixed", "hug", "content"]),
    ).toEqual([]);
  });

  it("no insets = its place in the flow (static position)", () => {
    const fixed = node("fixed", {
      position: "fixed",
      width: "40px",
      height: "40px",
    });
    expect(
      diff(page([section([content(100, 100), fixed])]), ["fixed"]),
    ).toEqual([]);
  });

  it("inside an absolute box and a scroll container", () => {
    const fixed = node("fixed", {
      position: "fixed",
      right: "0px",
      bottom: "0px",
      width: "80px",
      height: "30px",
    });
    const scroller = node(
      "scroller",
      { position: "relative", overflow: "auto", height: "100px" },
      [
        node(
          "abs",
          {
            position: "absolute",
            left: "30px",
            top: "40px",
            width: "100px",
            height: "100px",
          },
          [fixed],
        ),
      ],
    );
    expect(diff(page([section([scroller])]), ["abs", "fixed"])).toEqual([]);
  });
});
