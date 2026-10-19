import { EngineLayout } from "@/builder/workspace/canvas/wasm-bindings/engine";

/**
 * A small DOM ↔ engine oracle for layout trees (Chromium re-audit 2026-10-19 cases): the same tree
 * is built in the DOM (CSS) and in the engine (`NodeStyle` JSON), and border-box rects of labelled
 * nodes (relative to the root) are compared. Text leaves take the DOM's min/max-content as the
 * engine's measured scalars (the TS measure's role).
 */
export const EPS = 0.5;

export interface Node {
  label: string;
  /** CSS for the DOM leg. */
  css: string;
  /** The engine's style (`NodeStyle` JSON keys). */
  style: Record<string, unknown>;
  children?: Node[];
  /** Text content (DOM) — the engine leaf takes measured scalars instead. */
  text?: string;
}

export type Rect = { x: number; y: number; w: number; h: number };

export function domLeg(root: Node): Map<string, Rect> {
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

export function engineLeg(
  root: Node,
  wrap?: Map<string, number>,
): Map<string, Rect> {
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

export function diff(root: Node, check: string[], wrap?: Map<string, number>) {
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
