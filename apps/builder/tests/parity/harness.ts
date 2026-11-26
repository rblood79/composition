import { EngineLayout } from "@/builder/workspace/canvas/wasm-bindings/engine";

/**
 * ADR-156 Phase 1 — 엔진 ↔ CSS 차등 하니스 코어 (G1)
 *
 * (옛 leg 3 — 빌더 TS 파이프라인 `calculateFullTreeLayout` — 은 2026-10-05 fullTreeLayout 삭제와
 * 함께 제거됐다. production 경로 대조는 `adr248Catalog*` 테스트가 catalog root 로 한다.)
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
  /**
   * 텍스트 콘텐츠 (ADR-165) — DOM leg 의 textContent. engine leg 는 텍스트를 재지 않으므로 대응
   * 스칼라를 style (`contentMinWidth` 등) 로 직접 받는다.
   */
  text?: string;
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
  const engine = new EngineLayout();
  if (!engine.isAvailable()) {
    throw new Error("engine WASM 미준비 — initEngineWasm 확인");
  }
  // strict 입력은 켜지 않는다 — 케이스의 `style` 은 두 leg 이 공유하는 **DOM ∪ 엔진 키의
  // 합집합**이다 (`borderTopStyle` 은 DOM leg 이 테두리를 그리는 데 필요하고, `left`/`top` 은
  // CSS 이름). 엔진이 안 읽는 것이 정상이라 strict 를 켜면 케이스 77건이 가짜로 실패한다.

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

// ── 격자 sweep + 발산을 종류로 묶은 보고 (2026-11-27) ──
//
// 격자는 수백 ~ 수천 조합을 돌려 발산이 한 번에 수백 건 나온다 (ADR-170 도입 때 727). 앞 20 건을
// 나열하면 한 원인이 목록을 채워 다른 원인이 가려진다. 그래서 발산 케이스마다 지문을 만든다 —
// 어긋난 (노드.축) 과 그 노드에서 엔진이 내린 판정의 종류 (trace, ADR-183). 같은 지문의 케이스는
// 대개 한 원인이라 보고는 지문별 건수 + 예 하나다.

export interface Failure {
  name: string;
  bad: string[];
  case: ParityCase;
  /** 노드 index 마다 TOL 을 넘게 어긋난 축 (sweep 이 쓴 leg 기준). */
  axes: ("x" | "y" | "w" | "h")[][];
}

function divergentAxes(
  nodes: CaseNode[],
  dom: Bounds[],
  eng: Bounds[],
): ("x" | "y" | "w" | "h")[][] {
  return nodes.map((node, i) =>
    isDisplayNone(node)
      ? []
      : (["x", "y", "w", "h"] as const).filter(
          (f) => Math.abs(dom[i][f] - eng[i][f]) > TOL,
        ),
  );
}

/** 케이스 전부를 두 leg 로 돌려 발산한 케이스만 돌려준다. `leg` 는 engine leg 대체용. */
export function sweep(
  cases: readonly ParityCase[],
  leg: (c: ParityCase) => Bounds[] = (c) =>
    engineLeg(c.nodes, c.availW, c.availH),
): Failure[] {
  const out: Failure[] = [];
  for (const c of cases) {
    const dom = domLeg(c.nodes, c.availW);
    const eng = leg(c);
    const bad = diffCase(c.nodes, dom, eng);
    if (bad.length) {
      out.push({
        name: c.name,
        bad,
        case: c,
        axes: divergentAxes(c.nodes, dom, eng),
      });
    }
  }
  return out;
}

/** 격자 잠금 키 — 발산 케이스 이름의 정렬 목록 (`*.known.ts` 와 정확 일치 비교). */
export function keysOf(failures: readonly Failure[]): string[] {
  return failures.map((f) => f.name).sort();
}

type TraceEvent = NonNullable<
  ReturnType<EngineLayout["getLayoutTrace"]>
>["events"][number];

/**
 * 판정 하나의 범주 — 숫자 (from · to · floor · tracks …) 는 케이스마다 달라 같은 원인을 갈라
 * 놓으므로 버리고 enum 값만 남긴다. 측정 패스의 판정은 본 배치와 구분한다 (`trace.rs` R5).
 */
function traceCategory(e: TraceEvent): string {
  const parts: string[] = [e.type];
  for (const key of ["axis", "bound", "source", "stage"] as const) {
    const value = (e as Record<string, unknown>)[key];
    if (typeof value === "string") parts.push(value);
  }
  return `${parts.join(":")}${e.measure_pass ? "@measure" : ""}`;
}

/**
 * 노드별 엔진 판정 범주. 발산한 케이스에서만 부른다 — trace 를 켠 엔진으로 같은 케이스를 한 번 더
 * 푼다 (trace 는 관찰만 하고 배치를 바꾸지 않는다). 증분 skip 은 첫 배치에서 모든 노드가
 * `NoPrev` 라 원인을 가르지 못해 뺀다.
 */
function traceCategories(c: ParityCase): string[][] {
  const engine = new EngineLayout();
  try {
    if (!engine.enableLayoutTrace(true)) return c.nodes.map(() => []);
    const handles = engine.buildTreeBatch(
      JSON.stringify(
        c.nodes.map((n) => ({ style: n.style, children: n.children ?? [] })),
      ),
    );
    engine.computeLayout(handles[handles.length - 1], c.availW, c.availH);
    return handles.map((h) => {
      const events = engine.getLayoutTrace(h)?.events ?? [];
      return [
        ...new Set(
          events.filter((e) => e.type !== "IncrementalSkip").map(traceCategory),
        ),
      ].sort();
    });
  } finally {
    engine.dispose();
  }
}

/**
 * 발산 케이스의 지문 — 어긋난 노드마다 `label.축[판정 범주]` 를 정렬해 잇는다. 같은 노드의 축은
 * 한 묶음으로 (`box.w,h[...]`).
 */
export function fingerprintOf(failure: Failure): string {
  const traces = traceCategories(failure.case);
  const parts: string[] = [];
  failure.axes.forEach((axes, i) => {
    if (axes.length === 0) return;
    const label = failure.case.nodes[i].label;
    parts.push(`${label}.${axes.join(",")}[${traces[i].join(" ")}]`);
  });
  return parts.sort().join(" + ");
}

/** 지문별 묶음 — 건수 내림차순, 같은 건수는 지문 순. */
export function groupFailures(
  failures: readonly Failure[],
): { fingerprint: string; failures: Failure[] }[] {
  const groups = new Map<string, Failure[]>();
  for (const failure of failures) {
    const key = fingerprintOf(failure);
    const list = groups.get(key);
    if (list) list.push(failure);
    else groups.set(key, [failure]);
  }
  return [...groups]
    .map(([fingerprint, list]) => ({ fingerprint, failures: list }))
    .sort(
      (a, b) =>
        b.failures.length - a.failures.length ||
        a.fingerprint.localeCompare(b.fingerprint),
    );
}

/** 격자 단언의 실패 문구 — 발산 건수 · 종류 수 + 종류마다 건수 · 지문 · 예 하나. */
export function describeFailures(
  failures: readonly Failure[],
  total: number,
  maxKinds = 20,
): string {
  if (failures.length === 0) return `발산 0/${total}`;
  const groups = groupFailures(failures);
  const lines = [`발산 ${failures.length}/${total} · 종류 ${groups.length}`];
  for (const group of groups.slice(0, maxKinds)) {
    const example = group.failures[0];
    lines.push(`[${group.failures.length}] ${group.fingerprint}`);
    lines.push(`    예: ${example.name}`);
    for (const line of example.bad) lines.push(`      ${line}`);
  }
  if (groups.length > maxKinds) {
    lines.push(`… 종류 ${groups.length - maxKinds} 개 더`);
  }
  return lines.join("\n");
}
