/**
 * ADR-306 Phase 5 — 계층 (treemap · sunburst). 트리 만들기 · squarify · 원형 분할은 ztd-charts 0.5.0
 * (`3c4376c`, MIT — `src/layout/hierarchy.ts` `buildTree` · `squarify` · `sortTree` · `partitionAngles`)
 * 의 식을 옮겼다. 입력은 경로 필드 목록 (`pathFields` — 위 단계부터, 마지막이 잎 이름) 하나다 — ztd 의
 * 중첩 객체 · group 필드 모양은 표의 행이 만들 수 없어 받지 않는다 (경로 필드 하나가 같은 일을 한다).
 *
 * 값은 잎에서 위로 더한다 (부모 = 자식 합). 음수 · 결측은 0 (넓이 · 각도는 음수를 표현하지 못한다 —
 * 진단 `values.excluded`).
 */
import type { ChartSort } from "../../types";

export interface TreeNode {
  id: string;
  label: string;
  value: number;
  depth: number;
  parent: TreeNode | null;
  children: TreeNode[];
  /** 잎이 모은 원본 행 (같은 경로의 행 여러 개는 한 잎에 합산). */
  rows: number[];
  index: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 행 → 트리. 경로의 빈 단계는 건너뛴다 (ztd 와 같음). 잎 이름이 비면 `#<행 번호>`.
 * `excluded` 는 음수 · 결측 값 행 수.
 */
export function buildTree(
  paths: readonly (readonly string[])[],
  values: readonly number[],
  rootLabel = "All",
): { root: TreeNode; excluded: number } {
  const root: TreeNode = {
    id: "",
    label: rootLabel,
    value: 0,
    depth: 0,
    parent: null,
    children: [],
    rows: [],
    index: 0,
  };
  // 형제 이름 → 노드 색인 (ztd 는 children.find — 형제가 많으면 행 수 × 형제 수가 된다).
  const byName = new Map<TreeNode, Map<string, TreeNode>>();
  const add = (parent: TreeNode, label: string): TreeNode => {
    let names = byName.get(parent);
    if (!names) {
      names = new Map();
      byName.set(parent, names);
    }
    let node = names.get(label);
    if (!node) {
      node = {
        id: parent.id ? `${parent.id}/${label}` : label,
        label,
        value: 0,
        depth: parent.depth + 1,
        parent,
        children: [],
        rows: [],
        index: parent.children.length,
      };
      parent.children.push(node);
      names.set(label, node);
    }
    return node;
  };
  let excluded = 0;
  paths.forEach((path, i) => {
    const parts = path.filter((p) => p !== "");
    let parent = root;
    for (const part of parts.slice(0, -1)) parent = add(parent, part);
    const leaf = add(parent, parts[parts.length - 1] ?? `#${i + 1}`);
    leaf.rows.push(i);
    const v = values[i];
    if (Number.isFinite(v) && v >= 0) leaf.value += v;
    else excluded++;
  });
  const total = (n: TreeNode): number => {
    if (!n.children.length) return n.value;
    // 이 노드에서 끝난 경로 (하위 분류가 빈 행) 가 있으면 그 값을 같은 이름의 자식 잎으로 옮긴다 —
    //   부모 = 자식 합으로 덮어쓰면 그 값이 진단 없이 사라진다 (판독 2026-11-16).
    if (n.rows.length) {
      n.children.push({
        id: `${n.id}/`, // 빈 단계는 경로에서 빠지므로 진짜 노드 id 는 `/` 로 끝나지 않는다
        label: n.label,
        value: n.value,
        depth: n.depth + 1,
        parent: n,
        children: [],
        rows: n.rows,
        index: n.children.length,
      });
      n.rows = [];
    }
    n.value = n.children.reduce((sum, c) => sum + total(c), 0);
    return n.value;
  };
  total(root);
  return { root, excluded };
}

export function leaves(n: TreeNode): TreeNode[] {
  if (!n.children.length) return [n];
  return n.children.flatMap((c) => leaves(c));
}

export function treeHeight(n: TreeNode): number {
  let h = 0;
  for (const c of n.children) h = Math.max(h, 1 + treeHeight(c));
  return h;
}

/** 형제 순서를 값으로 (none 은 데이터 순서). */
export function sortTree(n: TreeNode, sort: ChartSort): void {
  if (sort !== "none")
    n.children.sort((a, b) =>
      sort === "descending" ? b.value - a.value : a.value - b.value,
    );
  n.children.forEach((c, i) => {
    c.index = i;
    sortTree(c, sort);
  });
}

/** 줄의 최악 종횡비 (합 · 최소 · 최대 넓이로 — 줄을 다시 만들지 않는다). */
function worst(s: number, mn: number, mx: number, side: number): number {
  if (s <= 0 || mn <= 0) return Infinity;
  return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
}

/** Squarified treemap (Bruls · Huizing · van Wijk). 넓이 합 = 상자 넓이 (값 0 은 빈 상자). */
export function squarify(values: readonly number[], box: Box): Box[] {
  const tot = values.reduce((s, v) => s + Math.max(0, v), 0);
  const out: Box[] = values.map(() => ({ x: box.x, y: box.y, w: 0, h: 0 }));
  if (tot <= 0 || box.w <= 0 || box.h <= 0) return out;
  const scale = (box.w * box.h) / tot;
  const order = values
    .map((v, i) => ({ v: Math.max(0, v) * scale, i }))
    .filter((d) => d.v > 0);
  let { x, y, w, h } = box;
  let i = 0;
  while (i < order.length) {
    const side = Math.min(w, h);
    let rs = order[i].v;
    let mn = rs;
    let mx = rs;
    let j = i + 1;
    while (j < order.length) {
      const v = order[j].v;
      if (
        worst(rs + v, Math.min(mn, v), Math.max(mx, v), side) >
        worst(rs, mn, mx, side)
      )
        break;
      rs += v;
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
      j++;
    }
    if (w >= h) {
      const cw = h > 0 ? rs / h : 0;
      let yy = y;
      for (let k = i; k < j; k++) {
        const hh = cw > 0 ? order[k].v / cw : 0;
        out[order[k].i] = { x, y: yy, w: cw, h: hh };
        yy += hh;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = w > 0 ? rs / w : 0;
      let xx = x;
      for (let k = i; k < j; k++) {
        const ww = rh > 0 ? order[k].v / rh : 0;
        out[order[k].i] = { x: xx, y, w: ww, h: rh };
        xx += ww;
      }
      y += rh;
      h -= rh;
    }
    i = j;
  }
  return out;
}

export interface ArcSpan {
  node: TreeNode;
  /** 라디안, 12 시 = 0 · 시계 방향. */
  a0: number;
  a1: number;
  depth: number;
}

/** 원형 분할 (sunburst) — 깊이마다 고리 하나, 각도는 부모 안에서 값 비율. */
export function partitionAngles(
  root: TreeNode,
  a0 = 0,
  a1 = Math.PI * 2,
): ArcSpan[] {
  const out: ArcSpan[] = [];
  const walk = (n: TreeNode, s: number, e: number) => {
    let acc = s;
    for (const c of n.children) {
      const span = n.value > 0 ? ((e - s) * c.value) / n.value : 0;
      out.push({ node: c, a0: acc, a1: acc + span, depth: c.depth });
      walk(c, acc, acc + span);
      acc += span;
    }
  };
  walk(root, a0, a1);
  return out;
}
