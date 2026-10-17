import { beforeAll, describe, expect, it } from "vitest";

import { resolveStickyOffset } from "@/builder/workspace/canvas/layout/stickyResolver";
import { EngineLayout } from "@/builder/workspace/canvas/wasm-bindings/engine";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import type { StickyConstraints } from "../../../../packages/shared/src/catalog/runtime/engineTypes";
import { type CaseNode, type StyleRecord, TOL } from "./harness";

/**
 * ADR-267 G1 — `position: sticky` 의 Chrome 차등 oracle (ADR-156 형식).
 *
 * leg 1 (ground truth): 실 DOM 을 스크롤한 뒤 `getBoundingClientRect` (root 상대).
 * leg 2 (Canvas 경로): 엔진 정적 배치 − 조상 scroll container 의 스크롤 + 엔진 constraints
 *   (`getStickyConstraints`) 에 `resolveStickyOffset` (renderCommands 가 쓰는 같은 함수) 을 적용한
 *   delta — sticky 조상의 delta 는 자손에게도 더한다.
 *
 * DOM 은 `top`/`left` 를, 엔진은 `insetTop`/`insetLeft` 를 읽으므로 둘 다 싣는다. 스크롤은
 * `overflow: auto` 상자만 한다 (Canvas 는 `hidden` 을 스크롤하지 않는다 — Chrome 도 사용자가
 * 스크롤할 수 없다).
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;

type Inset = Partial<Record<"top" | "right" | "bottom" | "left", number>>;
const sticky = (inset: Inset): StyleRecord => {
  const out: StyleRecord = { position: "sticky" };
  for (const [side, value] of Object.entries(inset)) {
    out[side] = `${value}px`;
    out[`inset${side[0].toUpperCase()}${side.slice(1)}`] = `${value}px`;
  }
  return out;
};

interface StickyCase {
  name: string;
  availW: number;
  /** post-order, root last. */
  nodes: CaseNode[];
  /** label → scroll position of an `overflow: auto` box. */
  scroll: Record<string, { top?: number; left?: number }>;
  /** Labels whose rects are compared. */
  check: string[];
}

interface Rect {
  x: number;
  y: number;
}

function domLeg(c: StickyCase): Map<string, Rect> {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:absolute;top:0;left:0;";
  wrapper.style.width = `${c.availW}px`;
  const els = c.nodes.map(() => document.createElement("div"));
  c.nodes.forEach((node, i) => {
    const el = els[i];
    el.style.margin = "0";
    el.style.padding = "0";
    el.style.border = "0";
    el.style.boxSizing = "border-box";
    for (const [k, v] of Object.entries(node.style))
      (el.style as unknown as Record<string, string>)[k] = String(v);
    (node.children ?? []).forEach((ci) => el.appendChild(els[ci]));
  });
  wrapper.appendChild(els[els.length - 1]);
  document.body.appendChild(wrapper);
  c.nodes.forEach((node, i) => {
    const scroll = c.scroll[node.label];
    if (!scroll) return;
    els[i].scrollTop = scroll.top ?? 0;
    els[i].scrollLeft = scroll.left ?? 0;
  });
  const root = els[els.length - 1].getBoundingClientRect();
  const out = new Map<string, Rect>();
  c.nodes.forEach((node, i) => {
    const r = els[i].getBoundingClientRect();
    out.set(node.label, { x: r.x - root.x, y: r.y - root.y });
  });
  document.body.removeChild(wrapper);
  return out;
}

function engineLeg(c: StickyCase): Map<string, Rect> {
  const engine = new EngineLayout();
  if (!engine.isAvailable()) throw new Error("engine WASM 미준비");
  const handles = engine.buildTreeBatch(
    JSON.stringify(
      c.nodes.map((n) => ({ style: n.style, children: n.children ?? [] })),
    ),
  );
  const n = handles.length;
  engine.computeLayout(handles[n - 1], c.availW, -1);
  const layouts = engine.getLayoutsBatch(handles);
  const parent = new Array<number>(n).fill(-1);
  c.nodes.forEach((node, i) =>
    (node.children ?? []).forEach((ci) => {
      parent[ci] = i;
    }),
  );
  const indexOf = new Map(handles.map((h, i) => [h, i]));
  const scrollOf = (i: number) => c.scroll[c.nodes[i].label];
  const delta = handles.map((h) => {
    const constraints: StickyConstraints | null =
      engine.getStickyConstraints(h);
    if (!constraints) return { dx: 0, dy: 0 };
    const owner =
      constraints.owner === null ? undefined : indexOf.get(constraints.owner);
    const scroll = owner === undefined ? undefined : scrollOf(owner);
    return resolveStickyOffset(constraints, {
      scrollTop: scroll?.top ?? 0,
      scrollLeft: scroll?.left ?? 0,
    });
  });
  const out = new Map<string, Rect>();
  const abs = (i: number): Rect => {
    const own = layouts.get(handles[i])!;
    let x = own.x + delta[i].dx;
    let y = own.y + delta[i].dy;
    for (let p = parent[i]; p !== -1; p = parent[p]) {
      const layout = layouts.get(handles[p])!;
      const scroll = scrollOf(p);
      x += layout.x + delta[p].dx - (scroll?.left ?? 0);
      y += layout.y + delta[p].dy - (scroll?.top ?? 0);
    }
    return { x, y };
  };
  const root = abs(n - 1);
  c.nodes.forEach((node, i) => {
    const r = abs(i);
    out.set(node.label, { x: r.x - root.x, y: r.y - root.y });
  });
  return out;
}

function diff(c: StickyCase): string[] {
  const dom = domLeg(c);
  const eng = engineLeg(c);
  const bad: string[] = [];
  for (const label of c.check)
    for (const f of ["x", "y"] as const) {
      const d = Math.abs(dom.get(label)![f] - eng.get(label)![f]);
      if (d > TOL)
        bad.push(
          `${label}.${f}: dom=${dom.get(label)![f].toFixed(1)} eng=${eng.get(label)![f].toFixed(1)}`,
        );
    }
  return bad;
}

/** Post-order nodes from a nested spec (children before the parent, root last). */
interface Spec {
  label: string;
  style: StyleRecord;
  children?: Spec[];
}
function flatten(spec: Spec): CaseNode[] {
  const out: CaseNode[] = [];
  const visit = (s: Spec): number => {
    const children = (s.children ?? []).map(visit);
    out.push(box(s.label, s.style, children));
    return out.length - 1;
  };
  visit(spec);
  return out;
}
/** `overflow` for the DOM, `overflowX` · `overflowY` for the engine (`styleOf` sends both axes). */
const overflow = (value: string): StyleRecord => ({
  overflow: value,
  overflowX: value,
  overflowY: value,
});
const scroller = (style: StyleRecord, children: Spec[]): Spec => ({
  label: "scroller",
  style: { ...overflow("auto"), height: "200px", ...style },
  children,
});
const page = (children: Spec[]): Spec => ({
  label: "root",
  style: { width: "300px" },
  children,
});
const sectionSpec = (
  prefix: string,
  header: StyleRecord,
  fill: number,
  style: StyleRecord = {},
): Spec => ({
  label: prefix,
  style,
  children: [
    { label: `${prefix}-header`, style: { height: "20px", ...header } },
    { label: `${prefix}-fill`, style: { height: `${fill}px` } },
  ],
});

const CASES: StickyCase[] = [
  {
    name: "스크롤 0 — 정적 위치",
    availW: 300,
    nodes: flatten(
      page([
        scroller({}, [
          sectionSpec("s1", sticky({ top: 0 }), 300),
          sectionSpec("s2", sticky({ top: 0 }), 300),
        ]),
      ]),
    ),
    scroll: {},
    check: ["s1-header", "s2-header"],
  },
  {
    name: "중간 — 첫 섹션 헤더가 scrollport 위에 붙음",
    availW: 300,
    nodes: flatten(
      page([
        scroller({}, [
          sectionSpec("s1", sticky({ top: 0 }), 300),
          sectionSpec("s2", sticky({ top: 0 }), 300),
        ]),
      ]),
    ),
    scroll: { scroller: { top: 100 } },
    check: ["s1-header", "s2-header", "s1-fill"],
  },
  {
    name: "끝 — 섹션 (containing block) 하단에 걸려 밀려 올라감",
    availW: 300,
    nodes: flatten(
      page([
        scroller({}, [
          sectionSpec("s1", sticky({ top: 0 }), 300),
          sectionSpec("s2", sticky({ top: 0 }), 300),
        ]),
      ]),
    ),
    scroll: { scroller: { top: 310 } },
    check: ["s1-header", "s2-header"],
  },
  {
    name: "padding-bottom 컨테이너 — 헤더가 scroll container 의 padding 안으로 가지 않음",
    availW: 300,
    nodes: flatten(
      page([
        scroller({ paddingBottom: "40px" }, [
          {
            label: "header",
            style: { height: "20px", ...sticky({ top: 150 }) },
          },
          { label: "fill", style: { height: "100px" } },
        ]),
      ]),
    ),
    scroll: {},
    check: ["header"],
  },
  {
    name: "margin 있는 sticky — 섹션 하단에서 margin 만큼 일찍 멈춤",
    availW: 300,
    nodes: flatten(
      page([
        scroller({}, [
          sectionSpec(
            "s1",
            { ...sticky({ top: 0 }), marginBottom: "10px" },
            300,
          ),
          sectionSpec("s2", sticky({ top: 0 }), 300),
        ]),
      ]),
    ),
    scroll: { scroller: { top: 305 } },
    check: ["s1-header"],
  },
  {
    name: "inset 없음 (Header rule) — 붙지 않고 내용과 함께 흐름",
    availW: 300,
    nodes: flatten(
      page([
        scroller({}, [
          sectionSpec("s1", sticky({}), 300),
          sectionSpec("s2", sticky({}), 300),
        ]),
      ]),
    ),
    scroll: { scroller: { top: 100 } },
    check: ["s1-header", "s2-header"],
  },
  {
    name: "양쪽 inset 공간 부족 — bottom 이 줄고 top 이 이김",
    availW: 300,
    nodes: flatten(
      page([
        scroller({}, [
          sectionSpec("s1", sticky({ top: 150, bottom: 150 }), 500),
        ]),
      ]),
    ),
    scroll: { scroller: { top: 50 } },
    check: ["s1-header"],
  },
  {
    name: "bottom inset — scrollport 아래에 붙음",
    availW: 300,
    nodes: flatten(
      page([
        scroller({}, [
          { label: "fill", style: { height: "400px" } },
          {
            label: "footer",
            style: { height: "20px", ...sticky({ bottom: 0 }) },
          },
        ]),
      ]),
    ),
    scroll: { scroller: { top: 60 } },
    check: ["footer"],
  },
  {
    name: "auto > hidden 경계 — owner 는 hidden section, 바깥과 함께 흐름",
    availW: 300,
    nodes: flatten(
      page([
        scroller({}, [
          sectionSpec("s1", sticky({ top: 0 }), 300, overflow("hidden")),
          { label: "after", style: { height: "300px" } },
        ]),
      ]),
    ),
    scroll: { scroller: { top: 100 } },
    check: ["s1-header"],
  },
  {
    name: "auto > clip 경계 — clip 은 scroll container 가 아니라 owner 는 바깥 auto",
    availW: 300,
    nodes: flatten(
      page([
        scroller({}, [
          sectionSpec("s1", sticky({ top: 0 }), 300, overflow("clip")),
          { label: "after", style: { height: "300px" } },
        ]),
      ]),
    ),
    scroll: { scroller: { top: 100 } },
    check: ["s1-header"],
  },
  {
    name: "overflow auto · 높이 없음 — 스크롤이 없어 붙지 않음 (R2)",
    availW: 300,
    nodes: flatten(
      page([
        {
          label: "scroller",
          style: overflow("auto"),
          children: [
            { label: "pad", style: { height: "40px" } },
            sectionSpec("s1", sticky({ top: 0 }), 100),
          ],
        },
      ]),
    ),
    scroll: {},
    check: ["s1-header"],
  },
  {
    name: "자손 — 붙은 헤더의 자식도 같은 delta",
    availW: 300,
    nodes: flatten(
      page([
        scroller({ paddingTop: "8px" }, [
          {
            label: "s1",
            style: {},
            children: [
              {
                label: "s1-header",
                style: { height: "20px", ...sticky({ top: 0 }) },
                children: [
                  {
                    label: "s1-label",
                    style: { height: "10px", marginTop: "4px" },
                  },
                ],
              },
              { label: "s1-fill", style: { height: "300px" } },
            ],
          },
          { label: "after", style: { height: "300px" } },
        ]),
      ]),
    ),
    scroll: { scroller: { top: 120 } },
    check: ["s1-header", "s1-label"],
  },
  {
    name: "가로 — left inset",
    availW: 300,
    nodes: flatten(
      page([
        scroller({ display: "flex", height: "50px" }, [
          {
            label: "lead",
            style: { width: "60px", flexShrink: 0, ...sticky({ left: 0 }) },
          },
          { label: "wide", style: { width: "600px", flexShrink: 0 } },
        ]),
      ]),
    ),
    scroll: { scroller: { left: 90 } },
    check: ["lead"],
  },
];

describe("ADR-267 G1 — sticky Chrome 차등 oracle", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });
  for (const c of CASES)
    it(c.name, () => {
      expect(diff(c)).toEqual([]);
    });
});
