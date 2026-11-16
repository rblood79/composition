/**
 * ADR-306 Phase 5 — treemap · sunburst (breakdown §2.2 #33 · #34). 뜻은 ztd-charts 0.5.0 (`3c4376c`, MIT —
 * `src/charts/treemap.tsx` · `sunburst.tsx`) 을 따른다: 계층의 비율을 넓이 · 각도로, 가장 큰 잎 강조
 * (accent — sunburst 는 그 조상도), 나머지는 중립. 칸 안 이름은 칠 위의 대비 색 (`on-fill`).
 *
 * - treemap: squarify · 형제 사이 틈 2px · 위 단계 머리글 (칸이 충분할 때) · 기본 정렬 큰 순서.
 * - sunburst: 깊이마다 고리 하나 · 가운데 구멍 `innerRadius` % · 바깥 고리 잎은 바깥 이름표 (양쪽으로
 *   밀어내기), 안쪽 조각은 이름이 들어갈 때만 · 기본 정렬 데이터 순서.
 */
import { hasHighlight, highlightIndex } from "../../highlight";
import { approxTextWidth, r2 } from "../../scales";
import type {
  ChartProps,
  ChartTarget,
  Mark,
  RectMark,
  TextMark,
} from "../../types";
import {
  invalidScene,
  noDataScene,
  sceneOf,
  sortOf,
  type CategoryContext,
} from "../category/common";
import { fieldKey, readLabel, readNumber, requireField } from "../fields";
import { dodgeVertical, fitText } from "../shapes";
import { polarXY, ringArcPath } from "./flow";
import {
  buildTree,
  leaves,
  partitionAngles,
  sortTree,
  squarify,
  treeHeight,
  type Box,
  type TreeNode,
} from "./hierarchy";

export const pct = (v: number) =>
  Number.isFinite(v) ? `${Math.round(v * 10) / 10}%` : "-";

export interface TreeModel {
  root: TreeNode;
  /** 가장 큰 잎 (강조). */
  top: TreeNode | null;
}

/** 경로 필드 키 (등록된 것만, 순서 유지). */
export function pathKeys(props: ChartProps): string[] {
  const refs = Array.isArray(props.pathFields) ? props.pathFields : [];
  return refs.map((ref) => fieldKey(ref)).filter((k): k is string => !!k);
}

export function treeModel(
  ctx: CategoryContext,
  fallbackSort: "none" | "descending",
): TreeModel | null {
  const { props, rows, input } = ctx;
  const keys = pathKeys(props);
  if (keys.length === 0)
    input.error("role.missing", "Path fields are required", "Path");
  const valueKey = requireField(input, "Value", props.metric);
  if (!input.ok) return null;
  const { root, excluded } = buildTree(
    rows.map((row) => keys.map((k) => readLabel(row, k))),
    rows.map((row) => readNumber(row, valueKey)),
  );
  if (excluded > 0)
    input.warning(
      "values.excluded",
      `${excluded} rows have no value or a negative value`,
      String(excluded),
    );
  sortTree(root, sortOf(props, fallbackSort));
  let top: TreeNode | null = null;
  for (const leaf of leaves(root))
    if (leaf !== root && leaf.value > 0 && (!top || leaf.value > top.value))
      top = leaf;
  // ADR-306 Phase 6 — `highlight`: 잎 이름 · 값 (ztd treemap · sunburst 와 같다 — 기본 max).
  if (hasHighlight(props.highlight)) {
    const all = leaves(root).filter((l) => l !== root);
    const k = highlightIndex(
      props.highlight,
      all.map((l) => l.label),
      all.map((l) => l.value),
      "max",
      -1,
    );
    top = k >= 0 ? all[k] : null;
  }
  return { root, top };
}

const titleOf = (n: TreeNode) =>
  n.parent && n.parent.depth > 0 ? `${n.parent.label} › ${n.label}` : n.label;

// ── treemap ─────────────────────────────────────────────────────────────

const GAP = 2;

export interface TreemapCell {
  node: TreeNode;
  rect: Box;
}

/** 크기 의존 배치 — 잎 칸 + 머리글 상자. 칸 넓이 합 = 그림 넓이 (틈은 칸에서 뺀다). */
export function treemapLayout(
  model: TreeModel,
  plot: Box,
  head: number,
): { cells: TreemapCell[]; groups: TreemapCell[] } {
  const cells: TreemapCell[] = [];
  const groups: TreemapCell[] = [];
  const grouped = model.root.children.some((c) => c.children.length > 0);
  const place = (node: TreeNode, box: Box) => {
    const rects = squarify(
      node.children.map((k) => k.value),
      box,
    );
    node.children.forEach((k, j) => {
      const r = rects[j];
      if (k.children.length) {
        const h = grouped && r.h > head + 18 && r.w > 40 ? head : 0;
        groups.push({ node: k, rect: r });
        place(k, { x: r.x, y: r.y + h, w: r.w, h: r.h - h });
      } else cells.push({ node: k, rect: r });
    });
  };
  place(model.root, {
    x: plot.x,
    y: plot.y,
    w: plot.w + GAP,
    h: plot.h + GAP,
  });
  return { cells, groups };
}

export function treemapScene(ctx: CategoryContext) {
  const model = treeModel(ctx, "descending");
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  const total = model.root.value;
  if (!(total > 0) || outer.w <= 0 || outer.h <= 0) return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const head = Math.round(fontSize * 1.5);
  const { cells, groups } = treemapLayout(model, outer, head);
  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  const labels = props.showValueLabels !== false;
  const shareOnly = props.labelKey === "value";
  let hidden = 0;
  cells.forEach((c, i) => {
    const w = c.rect.w - GAP;
    const h = c.rect.h - GAP;
    if (w < 1 || h < 1) {
      if (c.node.value > 0) hidden++;
      return;
    }
    const hot = c.node === model.top;
    const rect: RectMark = {
      kind: "rect",
      x: r2(c.rect.x),
      y: r2(c.rect.y),
      w: r2(w),
      h: r2(h),
      seriesIndex: 0,
      fillPaint: hot ? "accent" : "neutral",
    };
    marks.push(rect);
    const share = pct((c.node.value / total) * 100);
    if (labels) {
      const pad = Math.min(7, fontSize * 0.6);
      const room = w - pad * 2;
      const one = h >= fontSize + 10 && room >= fontSize * 2;
      const two = !shareOnly && h >= fontSize * 2.6 + 8;
      const first = shareOnly ? share : fitText(c.node.label, room, fontSize);
      if (one && first)
        texts.push({
          kind: "text",
          x: r2(c.rect.x + pad),
          y: r2(c.rect.y + pad + fontSize / 2),
          text: first,
          anchor: "start",
          baseline: "middle",
          role: "value",
          paint: "on-fill",
        });
      if (one && two) {
        const second = fitText(share, room, fontSize);
        if (second)
          texts.push({
            kind: "text",
            x: r2(c.rect.x + pad),
            y: r2(c.rect.y + pad + fontSize * 1.8),
            text: second,
            anchor: "start",
            baseline: "middle",
            role: "value",
            paint: "on-fill",
          });
      }
    }
    targets.push({
      id: `leaf-${i}`,
      x: r2(c.rect.x + w / 2),
      y: r2(c.rect.y),
      rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      rows: c.node.rows,
      title: titleOf(c.node),
      entries: [
        {
          label: "Value",
          text: fx(c.node.value),
          paint: hot ? "accent" : "neutral",
        },
        { label: "Share", text: share },
      ],
    });
  });
  for (const g of groups) {
    if (!(g.rect.h > head + 18 && g.rect.w > 40)) continue;
    const text = fitText(
      `${g.node.label} ${pct((g.node.value / total) * 100)}`,
      g.rect.w - GAP - 2,
      fontSize,
    );
    if (text)
      texts.push({
        kind: "text",
        x: r2(g.rect.x + 1),
        y: r2(g.rect.y + head / 2 - 1),
        text,
        anchor: "start",
        baseline: "middle",
        role: "tick",
      });
  }
  if (hidden > 0)
    input.warning(
      "budget.rowsTruncated",
      `${hidden} items are too small to draw`,
      String(hidden),
    );
  return sceneOf(ctx, { marks: [...marks, ...texts], targets });
}

// ── sunburst ────────────────────────────────────────────────────────────

/**
 * 고리 조각 가운데에 가로로 쓰는 이름의 최대 폭 (ztd `labelRoom`) — 높이 h 인 글자 상자의 네 모서리가
 * 조각 가장자리에서 pad 만큼 안쪽에 드는 가장 큰 폭. 이분 탐색 12 회.
 */
export function labelRoom(
  r0: number,
  r1: number,
  a0: number,
  a1: number,
  h: number,
  pad: number,
): number {
  const rm = (r0 + r1) / 2;
  const mid = (a0 + a1) / 2;
  const [px, py] = polarXY(0, 0, rm, mid);
  const half = (a1 - a0) / 2 - pad / rm;
  const fits = (w: number) => {
    if (
      Math.hypot(
        Math.max(Math.abs(px) - w / 2, 0),
        Math.max(Math.abs(py) - h / 2, 0),
      ) <
      r0 + pad
    )
      return false;
    for (const x of [px - w / 2, px + w / 2])
      for (const y of [py - h / 2, py + h / 2]) {
        if (Math.hypot(x, y) > r1 - pad) return false;
        const off = Math.atan2(x, -y) - mid;
        if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > half)
          return false;
      }
    return true;
  };
  if (half <= 0 || !fits(0)) return 0;
  let lo = 0;
  let hi = 2 * r1;
  for (let k = 0; k < 12; k++) {
    const w = (lo + hi) / 2;
    if (fits(w)) lo = w;
    else hi = w;
  }
  return lo;
}

export function sunburstScene(ctx: CategoryContext) {
  const model = treeModel(ctx, "none");
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  const total = model.root.value;
  if (!(total > 0) || outer.w <= 0 || outer.h <= 0) return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const levels = Math.max(1, treeHeight(model.root));
  const arcs = partitionAngles(model.root);
  // 강조 = 가장 큰 잎과 그 조상.
  const hot = new Set<TreeNode>();
  for (let q = model.top; q && q.depth > 0; q = q.parent) hot.add(q);
  const labels = props.showValueLabels !== false;
  const outerLeaves = arcs.filter(
    (a) => a.depth === levels && !a.node.children.length && a.node.value > 0,
  );
  const outsideText = (a: (typeof arcs)[number]) =>
    `${a.node.label} ${pct((a.node.value / total) * 100)}`;
  const labelW = labels
    ? Math.min(
        outer.w * 0.3,
        outerLeaves.reduce(
          (m, a) => Math.max(m, approxTextWidth(outsideText(a), fontSize)),
          0,
        ) + 14,
      )
    : 0;
  const R = Math.max(8, Math.min(outer.h / 2 - 4, (outer.w - 2 * labelW) / 2));
  const cx = outer.x + outer.w / 2;
  const cy = outer.y + outer.h / 2;
  const holeRatio =
    typeof props.innerRadius === "number" && Number.isFinite(props.innerRadius)
      ? Math.min(90, Math.max(0, props.innerRadius)) / 100
      : 0.3;
  const hole = R * holeRatio;
  const ring = (R - hole) / levels;
  const radii = (d: number): [number, number] => [
    hole + ring * (d - 1) + (d > 1 ? 1.5 : 0),
    hole + ring * d,
  ];
  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  let hidden = 0;
  arcs.forEach((a, i) => {
    if (!(a.a1 - a.a0 > 0)) return;
    const [r0, r1] = radii(a.depth);
    const rm = (r0 + r1) / 2;
    // 형제 사이 틈 — 가운데 반지름에서 1.5px (조각이 그보다 좁으면 틈 없이).
    const gap = (a.a1 - a.a0) * rm > 4 ? 0.75 / rm : 0;
    const a0 = a.a0 + gap;
    const a1 = a.a1 - gap;
    if ((a1 - a0) * r1 < 0.5) {
      hidden++;
      return;
    }
    const d = ringArcPath(cx, cy, r0, r1, a0, a1);
    if (!d) return;
    const isHot = hot.has(a.node);
    marks.push({
      kind: "path",
      d,
      bbox: {
        x: r2(cx - r1),
        y: r2(cy - r1),
        w: r2(r1 * 2),
        h: r2(r1 * 2),
      },
      fillPaint: isHot ? "accent" : "neutral",
      fillRule: "evenodd",
    });
    const [tx, ty] = polarXY(cx, cy, rm, (a.a0 + a.a1) / 2);
    const share = pct((a.node.value / total) * 100);
    targets.push({
      id: `arc-${i}`,
      x: r2(tx),
      y: r2(ty),
      r: r2(Math.max(4, (r1 - r0) / 2)),
      arc: {
        cx: r2(cx),
        cy: r2(cy),
        r0: r2(r0),
        r1: r2(r1),
        a0: a.a0,
        a1: a.a1,
      },
      rows: leaves(a.node).flatMap((l) => l.rows),
      title: titleOf(a.node),
      entries: [
        {
          label: "Value",
          text: fx(a.node.value),
          paint: isHot ? "accent" : "neutral",
        },
        { label: "Share", text: share },
      ],
    });
    // 안쪽 조각 이름 (바깥 고리 잎은 바깥 이름표).
    if (!labels || (a.depth === levels && !a.node.children.length)) return;
    const arcLen = (a.a1 - a.a0) * rm;
    if (arcLen < 26 || r1 - r0 < fontSize * 1.3) return;
    const name = fitText(
      a.node.label,
      labelRoom(r0, r1, a.a0, a.a1, fontSize, 3),
      fontSize,
    );
    // 세 글자도 못 남기고 잘린 이름 (「P…」) 은 읽히지 않는다 — 툴팁에 맡긴다 (live 에서 발견).
    if (!name || (name.endsWith("…") && name.length < 4)) return;
    texts.push({
      kind: "text",
      x: r2(tx),
      y: r2(ty),
      text: name,
      anchor: "middle",
      baseline: "middle",
      role: "value",
      paint: "on-fill",
    });
  });
  // 바깥 이름표 — 오른쪽 · 왼쪽으로 나눠 세로로 밀어낸다. 이름표 칸이 글자보다 좁으면 내지 않는다.
  if (labels && labelW >= fontSize * 3) {
    const list = outerLeaves.map((a) => {
      const mid = (a.a0 + a.a1) / 2;
      const [x, y] = polarXY(cx, cy, R + 8, mid);
      return { a, x, y, mid, side: Math.sin(mid) >= 0 ? 1 : -1 };
    });
    for (const side of [1, -1]) {
      const g = list.filter((l) => l.side === side);
      // 한쪽에 줄이 다 들어가지 않으면 큰 것부터 (나머지는 툴팁).
      const fit = Math.max(0, Math.floor(outer.h / (fontSize * 1.25)));
      const keep = new Set(
        [...g]
          .sort((p, q) => q.a.node.value - p.a.node.value)
          .slice(0, fit)
          .map((l) => l.a),
      );
      const shown = g.filter((l) => keep.has(l.a));
      const ys = dodgeVertical(
        shown.map((l) => l.y),
        fontSize * 1.25,
        outer.y + fontSize / 2,
        outer.y + outer.h - fontSize / 2,
      );
      shown.forEach((l, k) => {
        const nearV = Math.abs(Math.sin(l.mid)) < 0.18;
        const room =
          side > 0 ? outer.x + outer.w - (l.x + 2) : l.x - 2 - outer.x;
        const text = fitText(outsideText(l.a), nearV ? labelW : room, fontSize);
        if (!text) return;
        texts.push({
          kind: "text",
          x: r2(l.x + (nearV ? 0 : side * 2)),
          y: ys[k],
          text,
          anchor: nearV ? "middle" : side > 0 ? "start" : "end",
          baseline: "middle",
          role: hot.has(l.a.node) ? "value" : "tick",
        });
      });
    }
  }
  if (hidden > 0)
    input.warning(
      "budget.rowsTruncated",
      `${hidden} items are too small to draw`,
      String(hidden),
    );
  return sceneOf(ctx, { marks: [...marks, ...texts], targets });
}
