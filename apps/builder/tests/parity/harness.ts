import { CompositionEngineLayout } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";
import {
  calculateFullTreeLayout,
  resetPersistentTree,
} from "@/builder/workspace/canvas/layout/engines/fullTreeLayout";
import { setStrictLayoutInput } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import type { CanvasLayoutNode } from "@/types/builder/unified.types";

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
// post-order, root 마지막. style = EngineStyle 레코드, children = 인덱스 배열.
export type StyleRecord = Record<string, string | number | string[]>;

export interface CaseNode {
  label: string;
  style: StyleRecord;
  children?: number[];
  /** 텍스트 콘텐츠 (ADR-165) — DOM leg 은 textContent, pipeline leg 은 props.children 로 전달. */
  text?: string;
  /** pipeline leg 의 element type (기본 "box") — 텍스트 leaf 케이스는 "Text" 등 TEXT_LEAF_TAGS. */
  elementType?: string;
  /**
   * pipeline leg 전용 추가 props (ADR-923 r13m2) — DOM 은 그리지 않는 prop (`label` 등) 을
   * 요소에 실어 텍스트 원천 우선순위를 검증한다. DOM leg 은 무시 (Preview 도 그리지 않는다).
   */
  props?: Record<string, unknown>;
  /**
   * pipeline leg 이 `text` 를 실을 prop 키 (ADR-923 r14m2) — 기본 `children` (inspector/factory
   * writer). `"text"` 는 Pencil import writer (`collectPencilProps` 가 pencil text 노드의 `text`
   * 필드를 그대로 canonical props 에 쓴다). DOM leg 은 어느 쪽이든 textContent.
   */
  textPropKey?: "children" | "text";
  /**
   * DOM leg 전용 intrinsic 원자 (ADR-165 engine-leg 케이스) — inline-block 폭 px 목록.
   * 컨테이너 fontSize:0 으로 공백 폭을 0 으로 만들어 min-content = max(원자),
   * max-content = Σ원자 가 **정확 정수**가 되게 한다. 엔진 leg 는 대응 스칼라를
   * style.contentMinWidth/contentMaxWidth 로 직접 받는다 (engine 소비 격리 검증).
   */
  domAtoms?: number[];
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
      // contentMin/MaxWidth (ADR-165 측정 스칼라) 는 CSS 속성이 아니라 무시됨(무해).
      const cssVal = Array.isArray(v) ? v.join(" ") : String(v);
      (el.style as unknown as Record<string, string>)[k] = cssVal;
    }
    if (node.text !== undefined) el.textContent = node.text;
    if (node.domAtoms) {
      el.style.fontSize = "0px"; // 공백 폭 0 → max-content = Σ원자 (정확 정수)
      node.domAtoms.forEach((w, ai) => {
        if (ai > 0) el.appendChild(document.createTextNode(" "));
        const atom = document.createElement("span");
        atom.style.cssText = `display:inline-block;width:${w}px;height:10px;`;
        el.appendChild(atom);
      });
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
  // strict 입력은 여기서 켜지 않는다 — 케이스의 `style` 은 두 leg 이 공유하는
  // **DOM ∪ 엔진 키의 합집합**이다 (`borderTopStyle` 은 DOM leg 이 테두리를 그리는 데
  // 필요하고, `left`/`top` 은 CSS 이름). 엔진이 안 읽는 것이 정상이라 여기서 strict 를
  // 켜면 케이스 77건이 가짜로 실패한다. strict 가 의미 있는 곳은 production 파이프라인이
  // 만든 payload — `pipelineLeg` 다.

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

// ── leg 3: 빌더 실 파이프라인 (Layer 2 — ADR-156 §Residual R5) ──
// engineLeg 는 엔진을 **직접** 호출(buildTreeBatch→computeLayout)하므로 빌더의 JS 선계산
// 층(`enrichWithIntrinsicSize`/`calculateContentHeight` 주입 → `calculateFullTreeLayout` 이
// auto-height 컨테이너에서 그 주입을 제거하고 엔진 결과 재사용) 발산을 미검출한다. 이 leg 는
// `calculateFullTreeLayout`(빌더 canvas 가 소비하는 실 진입점)을 그대로 돌려 **엔진 결과가
// Skia 좌표까지 온전히 도달하는지**를 CSS ground truth 와 대조한다.
//
// 노드 type 은 특수 분기(catalog/spec) 없는 generic block 컨테이너 `box`. fixture style 은
// EngineStyle 레코드(camelCase, "30px"/"block") = React.CSSProperties 호환.
let pipelineCaseSeq = 0;
export function pipelineLeg(
  nodes: CaseNode[],
  availW: number,
  availH: number,
): Bounds[] {
  const n = nodes.length;
  const rootIdx = n - 1;
  const ids = nodes.map((_, i) => `p${i}`);
  // 케이스마다 unique page_id → persistentTrees 키 충돌(상태 누수) 방지.
  const pageId = `parity-pipeline-${pipelineCaseSeq++}`;

  const elementsMap = new Map<string, CanvasLayoutNode>();
  const childrenMap = new Map<string, string[]>();
  nodes.forEach((node, i) => {
    const style: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.style)) {
      style[k] = Array.isArray(v) ? v.join(" ") : v;
    }
    const childIds = (node.children ?? []).map((ci) => ids[ci]);
    childrenMap.set(ids[i], childIds);
    elementsMap.set(ids[i], {
      id: ids[i],
      type: node.elementType ?? "box",
      page_id: i === rootIdx ? pageId : null,
      props: {
        ...(node.props ?? {}),
        ...(node.text !== undefined
          ? { [node.textPropKey ?? "children"]: node.text }
          : {}),
        style,
      },
    } as unknown as CanvasLayoutNode);
  });

  const getChild = (id: string): CanvasLayoutNode[] =>
    (childrenMap.get(id) ?? []).map((cid) => elementsMap.get(cid)!);

  resetPersistentTree(pageId);
  // strict 입력 — 이 leg 의 payload 는 production 파이프라인
  // (`enrichWithIntrinsicSize` → `applyCommonEngineStyle` → `buildNodeStyle`) 이 만든다.
  // 파이프라인이 실어 보냈는데 엔진 `NodeStyle` 에 없어 조용히 버려지는 키가 있으면
  // rect 불일치(= 엔진 결함처럼 보이는 것)가 아니라 그 자리에서 실패시킨다 —
  // 1차 sweep 오탐 132/288 의 원인이 정확히 그 무음 드롭이었다.
  setStrictLayoutInput(true);
  let map;
  try {
    map = calculateFullTreeLayout(
      ids[rootIdx],
      elementsMap,
      childrenMap,
      availW,
      availH,
      getChild,
    );
  } finally {
    setStrictLayoutInput(false);
  }
  resetPersistentTree(pageId);
  if (!map) {
    throw new Error(
      "calculateFullTreeLayout null — composition-engine WASM 미준비 확인",
    );
  }

  // ComputedLayout.x/y = 부모 상대 → 조상 합산으로 절대(engineLeg 동형).
  const parent = new Array<number>(n).fill(-1);
  nodes.forEach((node, i) => {
    (node.children ?? []).forEach((ci) => {
      parent[ci] = i;
    });
  });
  const local = ids.map((id) => {
    const r = map.get(id);
    if (!r) throw new Error(`calculateFullTreeLayout: ${id} 결과 누락`);
    return r;
  });
  const absX = new Array<number>(n);
  const absY = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let ax = local[i].x;
    let ay = local[i].y;
    let p = parent[i];
    while (p !== -1) {
      ax += local[p].x;
      ay += local[p].y;
      p = parent[p];
    }
    absX[i] = ax;
    absY[i] = ay;
  }
  const rx = absX[rootIdx];
  const ry = absY[rootIdx];
  return local.map((r, i) => ({
    x: absX[i] - rx,
    y: absY[i] - ry,
    w: r.width,
    h: r.height,
  }));
}

/**
 * 케이스 1개를 CSS(leg1) ↔ 빌더 파이프라인(leg3) 으로 돌려 발산 목록 반환.
 * 빈 배열 = 엔진 결과가 JS 선계산 마스킹 없이 Skia 좌표까지 정합 도달.
 */
export function runPipelineParityCase(c: ParityCase): string[] {
  const dom = domLeg(c.nodes, c.availW);
  const pipe = pipelineLeg(c.nodes, c.availW, c.availH);
  return diffCase(c.nodes, dom, pipe);
}
