/**
 * ADR-306 Phase 5 — 흐름 배치 (sankey · chord). ztd-charts 0.5.0 (`3c4376c`, MIT — `src/layout/sankey.ts`
 * `sankeyLayout` · `sankeyLinkPath` · `src/layout/chord.ts` `chordLayout` · `ribbonPath`) 의 식을 옮겼다.
 *
 * - sankey: 노드 값 = max(들어옴 합, 나감 합). 열 = 시작 노드에서 가장 긴 경로 (justify — 나가는 연결이
 *   없는 노드는 마지막 열). 순환을 만드는 되돌아가는 연결은 열 계산에서 빼고 (`back`) 진단한다 — ztd 는
 *   조용히 뺀다 (breakdown §7.1 「순환 입력은 진단」).
 * - 크기 의존 배치 (열 x · 이완 · 겹침 해소) 는 plot 크기 · `nodeWidth` · `nodePadding` 으로 다시 계산한다
 *   (breakdown §4.2 — 이전 좌표를 비율로 늘려 쓰지 않는다).
 */
import { r2 } from "../../scales";

export interface FlowLinkIn {
  source: string;
  target: string;
  value: number;
  row: number;
}

export interface SankeyNode {
  id: string;
  index: number;
  depth: number;
  layer: number;
  value: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  inLinks: SankeyLink[];
  outLinks: SankeyLink[];
}

export interface SankeyLink {
  index: number;
  source: SankeyNode;
  target: SankeyNode;
  value: number;
  width: number;
  /** 출발 · 도착 띠의 가운데 y. */
  y0: number;
  y1: number;
  rows: number[];
}

export interface SankeyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** 순환을 만들어 열 계산에서 뺀 연결 수. */
  back: number;
  /** 값이 0 이하 · 자기 자신으로 가는 연결 (그리지 않는다). */
  dropped: number;
}

/** 크기 독립 단계 — 노드 · 연결 · 값 · 열 (같은 출발 · 도착의 행은 한 연결로 합친다). */
export function sankeyGraph(linksIn: readonly FlowLinkIn[]): SankeyGraph {
  const byId = new Map<string, SankeyNode>();
  const nodes: SankeyNode[] = [];
  const ensure = (id: string) => {
    let n = byId.get(id);
    if (!n) {
      n = {
        id,
        index: nodes.length,
        depth: 0,
        layer: 0,
        value: 0,
        x0: 0,
        x1: 0,
        y0: 0,
        y1: 0,
        inLinks: [],
        outLinks: [],
      };
      byId.set(id, n);
      nodes.push(n);
    }
    return n;
  };
  const links: SankeyLink[] = [];
  const byPair = new Map<string, SankeyLink>();
  let dropped = 0;
  for (const l of linksIn) {
    if (!(l.value > 0) || l.source === l.target) {
      dropped++;
      continue;
    }
    const key = `${l.source}\u0001${l.target}`;
    const same = byPair.get(key);
    if (same) {
      same.value += l.value;
      same.rows.push(l.row);
      continue;
    }
    const s = ensure(l.source);
    const t = ensure(l.target);
    const link: SankeyLink = {
      index: links.length,
      source: s,
      target: t,
      value: l.value,
      width: 0,
      y0: 0,
      y1: 0,
      rows: [l.row],
    };
    byPair.set(key, link);
    links.push(link);
    s.outLinks.push(link);
    t.inLinks.push(link);
  }
  for (const n of nodes)
    n.value = Math.max(
      n.inLinks.reduce((a, l) => a + l.value, 0),
      n.outLinks.reduce((a, l) => a + l.value, 0),
    );
  // 되돌아가는 연결 — 깊이 우선 탐색 한 번 (빼지 않으면 순환 안의 깊이가 노드 수까지 부푼다).
  let frontier = nodes.filter((n) => !n.inLinks.length);
  if (!frontier.length) frontier = nodes.slice(0, 1);
  const state = new Map<SankeyNode, 1 | 2>();
  const back = new Set<SankeyLink>();
  const visit = (start: SankeyNode): void => {
    // 반복형 (재귀 깊이가 노드 수를 따라가지 않게).
    const stack: { n: SankeyNode; k: number }[] = [{ n: start, k: 0 }];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const l = top.n.outLinks[top.k++];
      if (!l) {
        state.set(top.n, 2);
        stack.pop();
        continue;
      }
      const s = state.get(l.target);
      if (s === 1) back.add(l);
      else if (!s) {
        state.set(l.target, 1);
        stack.push({ n: l.target, k: 0 });
      }
    }
  };
  for (const n of [...frontier, ...nodes]) if (!state.has(n)) visit(n);
  const depthOf = new Map<SankeyNode, number>();
  frontier.forEach((n) => depthOf.set(n, 0));
  let changed = true;
  let guard = 0;
  while (changed && guard++ < nodes.length + 1) {
    changed = false;
    for (const l of links) {
      if (back.has(l)) continue;
      const d = (depthOf.get(l.source) ?? 0) + 1;
      if (d > (depthOf.get(l.target) ?? -1) && d <= nodes.length) {
        depthOf.set(l.target, d);
        changed = true;
      }
    }
  }
  let maxDepth = 0;
  for (const n of nodes) {
    n.depth = depthOf.get(n) ?? 0;
    maxDepth = Math.max(maxDepth, n.depth);
  }
  for (const n of nodes) n.layer = !n.outLinks.length ? maxDepth : n.depth;
  return { nodes, links, back: back.size, dropped };
}

export interface SankeyBox {
  x0: number;
  y0: number;
  width: number;
  height: number;
  nodeWidth: number;
  nodePadding: number;
  iterations?: number;
}

/** 크기 의존 단계 — 열 x · 노드 높이 · 이완 · 겹침 해소 · 연결 띠 자리. 그래프를 제자리에서 고친다. */
export function sankeyPlace(graph: SankeyGraph, box: SankeyBox): void {
  const { nodes, links } = graph;
  const { x0, y0, width, height, nodeWidth } = box;
  const iterations = box.iterations ?? 24;
  const nLayers = nodes.reduce((m, n) => Math.max(m, n.layer), 0) + 1;
  const kx = nLayers > 1 ? (width - nodeWidth) / (nLayers - 1) : 0;
  for (const n of nodes) {
    n.x0 = x0 + n.layer * kx;
    n.x1 = n.x0 + nodeWidth;
  }
  const columns: SankeyNode[][] = Array.from({ length: nLayers }, () => []);
  nodes.forEach((n) => columns[n.layer].push(n));
  const maxCount = columns.reduce((m, c) => Math.max(m, c.length), 1);
  const py = Math.min(box.nodePadding, (height / maxCount) * 0.6);
  let ky = Infinity;
  for (const c of columns) {
    if (!c.length) continue;
    const sum = c.reduce((a, n) => a + n.value, 0);
    ky = Math.min(ky, (height - (c.length - 1) * py) / Math.max(1e-9, sum));
  }
  if (!Number.isFinite(ky) || ky < 0) ky = 0;
  for (const col of columns) {
    let y = y0;
    for (const n of col) {
      n.y0 = y;
      n.y1 = y + n.value * ky;
      y = n.y1 + py;
    }
  }
  for (const l of links) l.width = l.value * ky;

  const center = (n: SankeyNode) => (n.y0 + n.y1) / 2;
  const resolve = (col: SankeyNode[]) => {
    col.sort((a, b) => a.y0 - b.y0);
    let y = y0;
    for (const n of col) {
      const dy = y - n.y0;
      if (dy > 0) {
        n.y0 += dy;
        n.y1 += dy;
      }
      y = n.y1 + py;
    }
    const over = y - py - (y0 + height);
    if (over > 0) {
      let yy = y0 + height;
      for (let i = col.length - 1; i >= 0; i--) {
        const n = col[i];
        const dy = n.y1 - yy;
        if (dy > 0) {
          n.y0 -= dy;
          n.y1 -= dy;
        }
        yy = n.y0 - py;
      }
    }
  };
  for (let it = 0; it < iterations; it++) {
    const a = Math.pow(0.99, it);
    for (let c = columns.length - 2; c >= 0; c--) {
      for (const n of columns[c]) {
        if (!n.outLinks.length) continue;
        let w = 0;
        let s = 0;
        for (const l of n.outLinks) {
          s += center(l.target) * l.value;
          w += l.value;
        }
        const dy = (s / w - center(n)) * a;
        n.y0 += dy;
        n.y1 += dy;
      }
      resolve(columns[c]);
    }
    for (let c = 1; c < columns.length; c++) {
      for (const n of columns[c]) {
        if (!n.inLinks.length) continue;
        let w = 0;
        let s = 0;
        for (const l of n.inLinks) {
          s += center(l.source) * l.value;
          w += l.value;
        }
        const dy = (s / w - center(n)) * a;
        n.y0 += dy;
        n.y1 += dy;
      }
      resolve(columns[c]);
    }
  }
  for (const n of nodes) {
    const outs = [...n.outLinks].sort((a, b) => a.target.y0 - b.target.y0);
    const ins = [...n.inLinks].sort((a, b) => a.source.y0 - b.source.y0);
    const outTotal = outs.reduce((a, l) => a + l.width, 0);
    const inTotal = ins.reduce((a, l) => a + l.width, 0);
    let y = n.y0 + Math.max(0, (n.y1 - n.y0 - outTotal) / 2);
    for (const l of outs) {
      l.y0 = y + l.width / 2;
      y += l.width;
    }
    y = n.y0 + Math.max(0, (n.y1 - n.y0 - inTotal) / 2);
    for (const l of ins) {
      l.y1 = y + l.width / 2;
      y += l.width;
    }
  }
}

/** 연결 띠 path (가로 베지어). */
export function sankeyLinkPath(l: SankeyLink): string {
  const xs = l.source.x1;
  const xt = l.target.x0;
  const mx = (xs + xt) / 2;
  const h = l.width / 2;
  return (
    `M${r2(xs)},${r2(l.y0 - h)}C${r2(mx)},${r2(l.y0 - h)} ${r2(mx)},${r2(l.y1 - h)} ${r2(xt)},${r2(l.y1 - h)}` +
    `L${r2(xt)},${r2(l.y1 + h)}C${r2(mx)},${r2(l.y1 + h)} ${r2(mx)},${r2(l.y0 + h)} ${r2(xs)},${r2(l.y0 + h)}Z`
  );
}

export interface ChordGroup {
  index: number;
  a0: number;
  a1: number;
  value: number;
}
export interface ChordEnd {
  index: number;
  sub: number;
  a0: number;
  a1: number;
  value: number;
}
export interface Chord {
  source: ChordEnd;
  target: ChordEnd;
}

const TAU = Math.PI * 2;

/**
 * 마디 각도 = 주고받은 합 (보낸 값 + 받은 값, 자기 자신은 한 번) 비례 — 받기만 하는 마디도 호가 생긴다.
 * `padAngle` 은 라디안 (마디 수가 많으면 반 바퀴 / 마디 수로 줄인다).
 */
export function chordLayout(
  matrix: readonly (readonly number[])[],
  padAngle: number,
): { groups: ChordGroup[]; chords: Chord[] } {
  const n = matrix.length;
  const at = (i: number, j: number) => Math.max(0, matrix[i]?.[j] || 0);
  const pair = (i: number, j: number) => at(i, j) + (i === j ? 0 : at(j, i));
  const size = Array.from({ length: n }, (_, i) => {
    let s = 0;
    for (let j = 0; j < n; j++) s += pair(i, j);
    return s;
  });
  const total = size.reduce((a, b) => a + b, 0);
  const pad = Math.min(padAngle, n ? (TAU * 0.5) / n : 0);
  const k = total > 0 ? Math.max(0, TAU - pad * n) / total : 0;
  const groups: ChordGroup[] = [];
  const sub: ChordEnd[][] = Array.from({ length: n }, () => []);
  let x = 0;
  for (let i = 0; i < n; i++) {
    const g0 = x;
    for (let j = 0; j < n; j++) {
      const s0 = x;
      x += pair(i, j) * k;
      sub[i][j] = { index: i, sub: j, a0: s0, a1: x, value: at(i, j) };
    }
    groups.push({ index: i, a0: g0, a1: x, value: size[i] });
    x += pad;
  }
  const chords: Chord[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) {
      const a = sub[i][j];
      const b = sub[j][i];
      if (a.value <= 0 && b.value <= 0) continue;
      chords.push(
        a.value >= b.value
          ? { source: a, target: b }
          : { source: b, target: a },
      );
    }
  return { groups, chords };
}

/** 12 시 = 0 · 시계 방향 라디안의 점. */
export function polarXY(
  cx: number,
  cy: number,
  r: number,
  a: number,
): [number, number] {
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/** 리본 — 두 호를 가운데를 지나는 2 차 곡선으로 잇는다. */
export function ribbonPath(
  cx: number,
  cy: number,
  r: number,
  s0: number,
  s1: number,
  t0: number,
  t1: number,
): string {
  const p = (a: number) => polarXY(cx, cy, r, a);
  const [sx0, sy0] = p(s0);
  const [sx1, sy1] = p(s1);
  const [tx0, ty0] = p(t0);
  const [tx1, ty1] = p(t1);
  const largeS = s1 - s0 > Math.PI ? 1 : 0;
  const largeT = t1 - t0 > Math.PI ? 1 : 0;
  let d = `M${r2(sx0)},${r2(sy0)}A${r2(r)},${r2(r)} 0 ${largeS} 1 ${r2(sx1)},${r2(sy1)}`;
  if (s0 === t0 && s1 === t1)
    return `${d}Q${r2(cx)},${r2(cy)} ${r2(sx0)},${r2(sy0)}Z`;
  d += `Q${r2(cx)},${r2(cy)} ${r2(tx0)},${r2(ty0)}A${r2(r)},${r2(r)} 0 ${largeT} 1 ${r2(tx1)},${r2(ty1)}Q${r2(cx)},${r2(cy)} ${r2(sx0)},${r2(sy0)}Z`;
  return d;
}

/** 고리 조각 (라디안 — 12 시 = 0 · 시계 방향). 한 바퀴는 반원 둘 (evenodd 로 뚫는다). */
export function ringArcPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const da = a1 - a0;
  if (!(da > 1e-4) || r1 <= 0) return "";
  if (da >= TAU - 1e-4) {
    const ring = (r: number, sweep: 0 | 1) => {
      const [x0, y0] = polarXY(cx, cy, r, a0);
      const [x1, y1] = polarXY(cx, cy, r, a0 + Math.PI);
      return `M${r2(x0)},${r2(y0)}A${r2(r)},${r2(r)} 0 1 ${sweep} ${r2(x1)},${r2(y1)}A${r2(r)},${r2(r)} 0 1 ${sweep} ${r2(x0)},${r2(y0)}Z`;
    };
    return r0 > 0 ? `${ring(r1, 1)}${ring(r0, 0)}` : ring(r1, 1);
  }
  const large = da > Math.PI ? 1 : 0;
  const [x0, y0] = polarXY(cx, cy, r1, a0);
  const [x1, y1] = polarXY(cx, cy, r1, a1);
  if (r0 <= 0)
    return `M${r2(cx)},${r2(cy)}L${r2(x0)},${r2(y0)}A${r2(r1)},${r2(r1)} 0 ${large} 1 ${r2(x1)},${r2(y1)}Z`;
  const [x2, y2] = polarXY(cx, cy, r0, a1);
  const [x3, y3] = polarXY(cx, cy, r0, a0);
  return `M${r2(x0)},${r2(y0)}A${r2(r1)},${r2(r1)} 0 ${large} 1 ${r2(x1)},${r2(y1)}L${r2(x2)},${r2(y2)}A${r2(r0)},${r2(r0)} 0 ${large} 0 ${r2(x3)},${r2(y3)}Z`;
}
