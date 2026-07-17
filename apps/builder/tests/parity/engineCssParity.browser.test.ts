import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { CompositionEngineLayout } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";

/**
 * ADR-156 Phase 1 — 엔진 ↔ CSS 차등 하니스 (G1)
 *
 * 두 leg 를 실 Chromium 에서 한 번에 돌려 대조한다:
 *   leg 1 (ground truth) — 실 DOM `getBoundingClientRect` (리셋 후 root-상대 정규화)
 *   leg 2 (engine)       — `buildTreeBatch → computeLayout → getLayoutsBatch`
 *                          (조상 offset 누적 → root-상대, tree_golden.rs::layout_relative 이식)
 *
 * `golden.rs`(CSS 명세 손계산)의 순환 oracle 을 끊는다 — leg 1 이 Chrome 실측이므로
 * 엔진과 독립된 ground truth 다.
 */

// ── 케이스 스키마 (tree_golden.rs batch JSON 과 동일 형태) ──
// post-order, root 마지막. style = TaffyStyle 레코드, children = 인덱스 배열.
// grid track 은 엔진이 배열(["1fr","1fr"])을 기대 — DOM leg 에서 문자열로 join.
type StyleRecord = Record<string, string | number | string[]>;

interface CaseNode {
  label: string;
  style: StyleRecord;
  children?: number[];
}

interface ParityCase {
  name: string;
  availW: number;
  availH: number; // -1 = auto
  nodes: CaseNode[];
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── leg 1: 실 DOM (ground truth) ──
function domLeg(nodes: CaseNode[], availW: number): Bounds[] {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:absolute;top:0;left:0;";
  wrapper.style.width = `${availW}px`;

  const els = nodes.map(() => document.createElement("div"));
  nodes.forEach((node, i) => {
    const el = els[i];
    // 리셋: margin/padding/border 0 + box-sizing:border-box (fixture 계약)
    el.style.margin = "0";
    el.style.padding = "0";
    el.style.border = "0";
    el.style.boxSizing = "border-box";
    for (const [k, v] of Object.entries(node.style)) {
      // 엔진 track 배열(["1fr","1fr"]) → CSS 문자열("1fr 1fr")
      const cssVal = Array.isArray(v) ? v.join(" ") : String(v);
      (el.style as unknown as Record<string, string>)[k] = cssVal;
    }
    (node.children ?? []).forEach((ci) => el.appendChild(els[ci]));
  });

  const rootIdx = nodes.length - 1;
  wrapper.appendChild(els[rootIdx]);
  document.body.appendChild(wrapper);

  const rootRect = els[rootIdx].getBoundingClientRect();
  const out = els.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x - rootRect.x,
      y: r.y - rootRect.y,
      w: r.width,
      h: r.height,
    };
  });

  document.body.removeChild(wrapper);
  return out;
}

// ── leg 2: 엔진 (tree_golden.rs::layout_relative 이식) ──
function engineLeg(
  nodes: CaseNode[],
  availW: number,
  availH: number,
): Bounds[] {
  const engine = new CompositionEngineLayout();
  if (!engine.isAvailable()) {
    throw new Error(
      "composition-engine WASM 미준비 — initCompositionEngineWasm 확인",
    );
  }

  const batch = nodes.map((n) => ({
    style: n.style,
    children: n.children ?? [],
  }));
  const handles = engine.buildTreeBatch(JSON.stringify(batch));
  const n = handles.length;
  const rootIdx = n - 1;

  engine.computeLayout(handles[rootIdx], availW, availH);
  const map = engine.getLayoutsBatch(handles);
  // handles 순서 = batch 배열 순서(post-order). 부모 content-box 상대 좌표.
  const res = handles.map((h) => {
    const r = map.get(h);
    if (!r) throw new Error(`getLayoutsBatch: handle ${h} 결과 누락`);
    return r;
  });

  // children 인덱스 → parent 맵 (parse_parents 이식). root = -1.
  const parent = new Array<number>(n).fill(-1);
  nodes.forEach((node, i) => {
    (node.children ?? []).forEach((ci) => {
      parent[ci] = i;
    });
  });

  // 절대 좌표 = 자신 relative + 모든 조상 relative 합.
  const absX = new Array<number>(n);
  const absY = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let ax = res[i].x;
    let ay = res[i].y;
    let p = parent[i];
    while (p !== -1) {
      ax += res[p].x;
      ay += res[p].y;
      p = parent[p];
    }
    absX[i] = ax;
    absY[i] = ay;
  }

  // root-상대 정규화 (Chrome leg 도 root origin 을 뺀 root-상대).
  const rx = absX[n - 1];
  const ry = absY[n - 1];
  return res.map((r, i) => ({
    x: absX[i] - rx,
    y: absY[i] - ry,
    w: r.width,
    h: r.height,
  }));
}

// ── diff: |dom - eng| > TOL 인 (node, field) 나열 ──
const TOL = 1.0;

function diffCase(nodes: CaseNode[], dom: Bounds[], eng: Bounds[]): string[] {
  const bad: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (const f of ["x", "y", "w", "h"] as const) {
      const d = Math.abs(dom[i][f] - eng[i][f]);
      if (d > TOL) {
        bad.push(
          `${nodes[i].label}.${f}: dom=${dom[i][f].toFixed(1)} eng=${eng[i][f].toFixed(1)} (Δ${d.toFixed(1)})`,
        );
      }
    }
  }
  return bad;
}

/** 케이스 1개를 두 leg 로 돌려 발산 목록 반환 (빈 배열 = 정합). */
export function runParityCase(c: ParityCase): string[] {
  const dom = domLeg(c.nodes, c.availW);
  const eng = engineLeg(c.nodes, c.availW, c.availH);
  return diffCase(c.nodes, dom, eng);
}

// ── tree_golden 회귀 기준선 N1~N10 (§2-1, G1) ──
// tree_golden.rs 의 N*_BATCH 를 그대로 이식. 전부 availW=200, availH=-1(auto).
// N1~N5 = Chrome 실측(dualRunLive C-2b). N6~N10 = 손계산 기준선이나, 본 하니스는
// 실 DOM 을 truth 로 쓰므로 손계산이 CSS 와 어긋나면 여기서 드러난다(하니스의 값).
const TREE_GOLDEN: ParityCase[] = [
  {
    name: "N1 flex-in-flex",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n1-a", style: { width: "30px", height: "20px" } },
      { label: "n1-b", style: { width: "40px", height: "20px" } },
      {
        label: "n1-row",
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          width: "200px",
          height: "20px",
        },
        children: [0, 1],
      },
      { label: "n1-c", style: { width: "50px", height: "30px" } },
      {
        label: "n1-root",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "200px",
          height: "auto",
        },
        children: [2, 3],
      },
    ],
  },
  {
    name: "N2 flex-in-grid",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n2-a1", style: { width: "40px", height: "15px" } },
      { label: "n2-a2", style: { width: "40px", height: "25px" } },
      {
        label: "n2-cell-a",
        style: { display: "flex", flexDirection: "column", height: "auto" },
        children: [0, 1],
      },
      { label: "n2-b1", style: { width: "40px", height: "30px" } },
      {
        label: "n2-cell-b",
        style: { display: "flex", flexDirection: "column", height: "auto" },
        children: [3],
      },
      {
        label: "n2-root",
        style: {
          display: "grid",
          gridTemplateColumns: ["1fr", "1fr"],
          width: "200px",
          height: "auto",
        },
        children: [2, 4],
      },
    ],
  },
  {
    name: "N3 grid-in-flex",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n3-g1", style: { height: "40px" } },
      { label: "n3-g2", style: { height: "40px" } },
      {
        label: "n3-grid",
        style: {
          display: "grid",
          gridTemplateColumns: ["1fr", "1fr"],
          gridTemplateRows: ["40px"],
          width: "200px",
          height: "40px",
        },
        children: [0, 1],
      },
      { label: "n3-foot", style: { width: "60px", height: "20px" } },
      {
        label: "n3-root",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "200px",
          height: "auto",
        },
        children: [2, 3],
      },
    ],
  },
  {
    name: "N4 gap flex column",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n4-a", style: { width: "100px", height: "30px" } },
      { label: "n4-b", style: { width: "100px", height: "40px" } },
      { label: "n4-c", style: { width: "100px", height: "20px" } },
      {
        label: "n4-root",
        style: {
          display: "flex",
          flexDirection: "column",
          rowGap: "8px",
          width: "200px",
          height: "auto",
        },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "N5 dimension 혼재 flex row",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n5-fixed", style: { width: "50px", height: "20px" } },
      { label: "n5-auto", style: { width: "70px", height: "20px" } },
      {
        label: "n5-root",
        style: {
          display: "flex",
          flexDirection: "row",
          columnGap: "10px",
          alignItems: "flex-start",
          width: "200px",
          height: "20px",
        },
        children: [0, 1],
      },
    ],
  },
  {
    name: "N6 padded flex row (box-sizing)",
    availW: 200,
    availH: -1,
    nodes: [
      {
        label: "n6-a",
        style: {
          width: "100px",
          height: "20px",
          paddingLeft: "8px",
          paddingRight: "8px",
        },
      },
      { label: "n6-b", style: { width: "50px", height: "20px" } },
      {
        label: "n6-root",
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          width: "300px",
          height: "100px",
          paddingTop: "10px",
          paddingRight: "10px",
          paddingBottom: "10px",
          paddingLeft: "10px",
        },
        children: [0, 1],
      },
    ],
  },
  {
    name: "N7 auto-height column + flexGrow",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n7-tab", style: { width: "200px", height: "29px" } },
      { label: "n7-inner", style: { width: "50px", height: "24px" } },
      {
        label: "n7-panel",
        style: {
          display: "flex",
          flexDirection: "column",
          height: "auto",
          flexGrow: 1,
        },
        children: [1],
      },
      {
        label: "n7-tabs",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "200px",
          height: "auto",
        },
        children: [0, 2],
      },
      {
        label: "n7-root",
        style: { width: "200px", height: "1000px" },
        children: [3],
      },
    ],
  },
  {
    name: "N8 block fit-content",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n8-inner", style: { width: "120px", height: "40px" } },
      {
        label: "n8-fit",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "fit-content",
          height: "auto",
        },
        children: [0],
      },
      {
        label: "n8-root",
        style: { width: "200px", height: "300px" },
        children: [1],
      },
    ],
  },
  {
    name: "N9 display:none 자식",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n9-label", style: { width: "63px", height: "20px" } },
      { label: "n9-input", style: { width: "200px", height: "30px" } },
      {
        label: "n9-hidden",
        style: { display: "none", width: "100px", height: "16px" },
      },
      {
        label: "n9-root",
        style: {
          display: "flex",
          flexDirection: "column",
          rowGap: "6px",
          width: "200px",
          height: "auto",
        },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "N10 flex-start column width:100%",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n10-full", style: { width: "100%", height: "24px" } },
      { label: "n10-bare", style: { height: "10px" } },
      {
        label: "n10-root",
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: "200px",
          height: "auto",
        },
        children: [0, 1],
      },
    ],
  },
];

describe("ADR-156 Phase 1 — 엔진 ↔ CSS 차등 하니스 (G1: tree_golden 재현)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(TREE_GOLDEN)("$name — 엔진↔CSS 정합", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});
