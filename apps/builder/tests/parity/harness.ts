import { CompositionEngineLayout } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";

/**
 * ADR-156 Phase 1 — 엔진 ↔ CSS 차등 하니스 코어 (G1)
 *
 * 두 leg 를 실 Chromium 에서 한 번에 돌려 대조한다:
 *   leg 1 (ground truth) — 실 DOM `getBoundingClientRect` (리셋 후 root-상대 정규화)
 *   leg 2 (engine)       — `buildTreeBatch → computeLayout → getLayoutsBatch`
 *                          (조상 offset 누적 → root-상대, tree_golden.rs::layout_relative 이식)
 *
 * `golden.rs`(CSS 명세 손계산)의 순환 oracle 을 끊는다 — leg 1 이 Chrome 실측이므로
 * 엔진과 독립된 ground truth 다.
 *
 * ## 계약 차이 (breakdown §1-4 — 혼동 시 가짜 실패)
 * - gap: 엔진은 `rowGap`/`columnGap` longhand 만 → 케이스도 longhand 로 작성.
 * - flexGrow/flexShrink: 엔진은 f32 **숫자만** (문자열 = parse error) → number 로 작성.
 * - grid track: 엔진은 배열(`["1fr","1fr"]`), DOM 은 문자열 → domLeg 가 join.
 * - display:none: 노드 `getBoundingClientRect` 가 0-rect 라 root-상대에서 host offset
 *   노출 → 해당 노드 **자신의 좌표는 비교 제외** (diffCase 에서 skip).
 */

// ── 케이스 스키마 (tree_golden.rs batch JSON 과 동일 형태) ──
// post-order, root 마지막. style = TaffyStyle 레코드, children = 인덱스 배열.
export type StyleRecord = Record<string, string | number | string[]>;

export interface CaseNode {
  label: string;
  style: StyleRecord;
  children?: number[];
}

export interface ParityCase {
  name: string;
  availW: number;
  availH: number; // -1 = auto
  nodes: CaseNode[];
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── leg 1: 실 DOM (ground truth) ──
export function domLeg(nodes: CaseNode[], availW: number): Bounds[] {
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
export function engineLeg(
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
export const TOL = 1.0;

/** display:none 노드는 0-rect 라 좌표 비교 제외 (§1-4 함정 ①). */
function isDisplayNone(node: CaseNode): boolean {
  return String(node.style.display ?? "") === "none";
}

export function diffCase(
  nodes: CaseNode[],
  dom: Bounds[],
  eng: Bounds[],
): string[] {
  const bad: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (isDisplayNone(nodes[i])) continue; // 0-rect host offset 오탐 제외
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
