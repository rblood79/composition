/**
 * ADR-306 Phase 5 — sankey · chord (breakdown §2.2 #35 · #36). 뜻은 ztd-charts 0.5.0 (`3c4376c`, MIT —
 * `src/charts/sankey.tsx` · `chord.tsx`) 을 따른다: 행 = 출발 → 도착 흐름 하나 (같은 쌍은 합산), 강조
 * 하나 (sankey 는 마지막 열의 가장 큰 노드, chord 는 가장 큰 마디) 와 그에 닿는 흐름 (accent), 나머지 중립.
 */
import { approxTextWidth, r2 } from "../../scales";
import type { ChartTarget, Mark, PathMark, TextMark } from "../../types";
import {
  invalidScene,
  noDataScene,
  sceneOf,
  type CategoryContext,
} from "../category/common";
import { numberOption, readLabel, readNumber, requireField } from "../fields";
import { fitText } from "../shapes";
import {
  chordLayout,
  polarXY,
  ribbonPath,
  ringArcPath,
  sankeyGraph,
  sankeyLinkPath,
  sankeyPlace,
  type FlowLinkIn,
  type SankeyGraph,
} from "./flow";
import { pct } from "./tree";

/** 흐름 입력 — 출발 · 도착 · 값 역할 (셋 다 필수). */
export function flowLinks(ctx: CategoryContext): FlowLinkIn[] | null {
  const { props, rows, input } = ctx;
  const s = requireField(input, "Source", props.sourceField);
  const t = requireField(input, "Target", props.targetField);
  const v = requireField(input, "Value", props.metric);
  if (!input.ok) return null;
  const out: FlowLinkIn[] = [];
  rows.forEach((row, i) => {
    const source = readLabel(row, s);
    const target = readLabel(row, t);
    if (source === "" || target === "") return;
    out.push({ source, target, value: readNumber(row, v), row: i });
  });
  return out;
}

// ── sankey ──────────────────────────────────────────────────────────────

export function sankeyModel(ctx: CategoryContext): SankeyGraph | null {
  const links = flowLinks(ctx);
  if (links === null) return null;
  const graph = sankeyGraph(links);
  if (graph.back > 0)
    ctx.input.warning(
      "links.cycle",
      `${graph.back} links form a cycle and do not set columns`,
      String(graph.back),
    );
  if (graph.dropped > 0)
    ctx.input.warning(
      "values.excluded",
      `${graph.dropped} rows have no positive value or point to themselves`,
      String(graph.dropped),
    );
  return graph;
}

export function sankeyScene(ctx: CategoryContext) {
  const graph = sankeyModel(ctx);
  if (graph === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (graph.links.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const labels = props.showValueLabels !== false;
  const maxLayer = graph.nodes.reduce((m, n) => Math.max(m, n.layer), 0);
  const widthOf = (layer: number) =>
    labels
      ? Math.min(
          outer.w * 0.22,
          graph.nodes
            .filter((n) => n.layer === layer)
            .reduce(
              (m, n) =>
                Math.max(
                  m,
                  approxTextWidth(n.id, fontSize),
                  approxTextWidth(fx(n.value), fontSize),
                ),
              0,
            ) + 10,
        )
      : 0;
  // 열마다 노드 폭 두 배는 남아야 띠가 거꾸로 서지 않는다 — 이름 칸까지 들어가지 않으면 이름을 빼고
  //   (툴팁에 남는다), 그래도 좁으면 노드 폭을 줄인다 (Library 칸 · 작은 카드).
  const nLayers = maxLayer + 1;
  let nodeWidth = numberOption(props.nodeWidth, 10, 2, 40);
  let lw = widthOf(0);
  let rw = maxLayer > 0 ? widthOf(maxLayer) : 0;
  const showNames = outer.w - lw - rw >= nLayers * nodeWidth * 2;
  if (!showNames) {
    lw = 0;
    rw = 0;
    nodeWidth = Math.max(0.5, Math.min(nodeWidth, outer.w / (nLayers * 2)));
  }
  sankeyPlace(graph, {
    x0: outer.x + lw,
    y0: outer.y + 4,
    width: outer.w - lw - rw,
    height: Math.max(1, outer.h - 8),
    nodeWidth,
    nodePadding: numberOption(props.nodePadding, 14, 0, 60),
  });
  // 강조 = 마지막 열에서 가장 큰 노드.
  let top = -1;
  for (const n of graph.nodes)
    if (n.layer === maxLayer && (top < 0 || n.value > graph.nodes[top].value))
      top = n.index;
  const hotLink = (l: (typeof graph.links)[number]) =>
    l.source.index === top || l.target.index === top;
  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  // 중립 흐름을 먼저, 강조 흐름을 위에.
  const ordered = [
    ...graph.links.filter((l) => !hotLink(l)),
    ...graph.links.filter(hotLink),
  ];
  for (const l of ordered) {
    if (!(l.width > 0)) continue;
    const hot = hotLink(l);
    const top0 = Math.min(l.y0, l.y1) - l.width / 2;
    const path: PathMark = {
      kind: "path",
      d: sankeyLinkPath(l),
      bbox: {
        x: r2(l.source.x1),
        y: r2(top0),
        w: r2(l.target.x0 - l.source.x1),
        h: r2(Math.abs(l.y1 - l.y0) + l.width),
      },
      fillPaint: hot ? "accent" : "neutral",
      fillOpacity: hot ? 0.55 : 0.32,
    };
    marks.push(path);
    targets.push({
      id: `link-${l.index}`,
      x: r2((l.source.x1 + l.target.x0) / 2),
      y: r2((l.y0 + l.y1) / 2),
      r: r2(Math.max(4, l.width / 2)),
      rows: l.rows,
      title: `${l.source.id} → ${l.target.id}`,
      entries: [
        {
          label: "Flow",
          text: fx(l.value),
          paint: hot ? "accent" : "neutral",
        },
        {
          label: `Share of ${l.source.id}`,
          text: pct((l.value / (l.source.value || 1)) * 100),
        },
      ],
    });
  }
  for (const n of graph.nodes) {
    const h = n.y1 - n.y0;
    const hot = n.index === top;
    marks.push({
      kind: "rect",
      x: r2(n.x0),
      y: r2(n.y0),
      w: r2(n.x1 - n.x0),
      h: r2(Math.max(1, h)),
      seriesIndex: 0,
      fillPaint: hot ? "accent" : "neutral",
    });
    targets.push({
      id: `node-${n.index}`,
      x: r2((n.x0 + n.x1) / 2),
      y: r2(n.y0),
      rect: {
        x: r2(n.x0),
        y: r2(n.y0),
        w: r2(n.x1 - n.x0),
        h: r2(Math.max(1, h)),
      },
      rows: [...new Set([...n.inLinks, ...n.outLinks].flatMap((l) => l.rows))],
      title: n.id,
      entries: [
        {
          label: "Total",
          text: fx(n.value),
          paint: hot ? "accent" : "neutral",
        },
      ],
    });
    if (!labels || !showNames || h < fontSize * 0.8) continue;
    const first = n.layer === 0;
    const room = first
      ? lw - 10
      : n.layer === maxLayer
        ? rw - 10
        : Math.max(40, outer.w * 0.18);
    const name = fitText(n.id, room, fontSize);
    if (!name) continue;
    const x = first ? n.x0 - 6 : n.x1 + 6;
    const anchor = first ? "end" : "start";
    const cy = (n.y0 + n.y1) / 2;
    const both = h >= fontSize * 2.4;
    texts.push({
      kind: "text",
      x: r2(x),
      y: r2(both ? cy - fontSize * 0.6 : cy),
      text: name,
      anchor,
      baseline: "middle",
      role: "value",
    });
    if (both)
      texts.push({
        kind: "text",
        x: r2(x),
        y: r2(cy + fontSize * 0.6),
        text: fx(n.value),
        anchor,
        baseline: "middle",
        role: "tick",
      });
  }
  return sceneOf(ctx, { marks: [...marks, ...texts], targets });
}

// ── chord ───────────────────────────────────────────────────────────────

export interface ChordModel {
  names: string[];
  matrix: number[][];
  /** 원본 행 — [출발][도착]. */
  cellRows: number[][][];
}

export function chordModel(ctx: CategoryContext): ChordModel | null {
  const links = flowLinks(ctx);
  if (links === null) return null;
  const idx = new Map<string, number>();
  const names: string[] = [];
  for (const l of links)
    for (const name of [l.source, l.target])
      if (!idx.has(name)) {
        idx.set(name, names.length);
        names.push(name);
      }
  const matrix = names.map(() => names.map(() => 0));
  const cellRows: number[][][] = names.map(() => names.map(() => []));
  let excluded = 0;
  for (const l of links) {
    const a = idx.get(l.source)!;
    const b = idx.get(l.target)!;
    if (!(l.value > 0)) {
      excluded++;
      continue;
    }
    matrix[a][b] += l.value;
    cellRows[a][b].push(l.row);
  }
  if (excluded > 0)
    ctx.input.warning(
      "values.excluded",
      `${excluded} rows have no positive value`,
      String(excluded),
    );
  return { names, matrix, cellRows };
}

export function chordScene(ctx: CategoryContext) {
  const model = chordModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  const n = model.names.length;
  const lay = chordLayout(
    model.matrix,
    (numberOption(ctx.props.padAngle, 3, 0, 20) * Math.PI) / 180,
  );
  const grand = lay.groups.reduce((a, g) => a + g.value, 0);
  if (n === 0 || !(grand > 0) || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const labels = props.showValueLabels !== false;
  const labelW = labels
    ? model.names.reduce(
        (m, name) => Math.max(m, approxTextWidth(name, fontSize)),
        20,
      ) + 14
    : 0;
  const R = Math.max(
    12,
    Math.min(outer.h / 2 - fontSize - 2, outer.w / 2 - labelW),
  );
  const cx = outer.x + outer.w / 2;
  const cy = outer.y + outer.h / 2;
  const thick = Math.max(4, Math.min(14, R * 0.09));
  const rr = R - thick - 3;
  let top = 0;
  lay.groups.forEach((g) => {
    if (g.value > lay.groups[top].value) top = g.index;
  });
  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  const box = {
    x: r2(cx - R),
    y: r2(cy - R),
    w: r2(R * 2),
    h: r2(R * 2),
  };
  const hot = (c: (typeof lay.chords)[number]) =>
    c.source.index === top || c.target.index === top;
  const ordered = [
    ...lay.chords.filter((c) => !hot(c)),
    ...lay.chords.filter(hot),
  ];
  if (rr > 2)
    for (const c of ordered) {
      const isHot = hot(c);
      marks.push({
        kind: "path",
        d: ribbonPath(
          cx,
          cy,
          rr,
          c.source.a0,
          c.source.a1,
          c.target.a0,
          c.target.a1,
        ),
        bbox: box,
        fillPaint: isHot ? "accent" : "neutral",
        fillOpacity: isHot ? 0.68 : 0.4,
      });
      const a = (c.source.a0 + c.source.a1) / 2;
      const [tx, ty] = polarXY(cx, cy, rr * 0.6, a);
      const s = model.names[c.source.index];
      const t = model.names[c.target.index];
      targets.push({
        id: `chord-${c.source.index}-${c.target.index}`,
        x: r2(tx),
        y: r2(ty),
        r: 6,
        rows: [
          ...model.cellRows[c.source.index][c.target.index],
          ...(c.source.index === c.target.index
            ? []
            : model.cellRows[c.target.index][c.source.index]),
        ],
        title: `${s} ↔ ${t}`,
        entries: [
          {
            label: `${s} →`,
            text: fx(c.source.value),
            paint: isHot ? "accent" : "neutral",
          },
          { label: `${t} →`, text: fx(c.target.value) },
        ],
      });
    }
  for (const g of lay.groups) {
    const isHot = g.index === top;
    const d = ringArcPath(cx, cy, R - thick, R, g.a0, g.a1);
    if (d)
      marks.push({
        kind: "path",
        d,
        bbox: box,
        fillPaint: isHot ? "accent" : "neutral",
        fillRule: "evenodd",
      });
    const mid = (g.a0 + g.a1) / 2;
    const [gx, gy] = polarXY(cx, cy, R - thick / 2, mid);
    const outs = model.matrix[g.index].reduce((a, b) => a + b, 0);
    const ins = model.matrix.reduce((a, row) => a + row[g.index], 0);
    targets.push({
      id: `group-${g.index}`,
      x: r2(gx),
      y: r2(gy),
      r: r2(Math.max(4, thick)),
      arc: {
        cx: r2(cx),
        cy: r2(cy),
        r0: r2(R - thick),
        r1: r2(R),
        a0: g.a0,
        a1: g.a1,
      },
      rows: [
        ...model.cellRows[g.index].flat(),
        ...model.cellRows.flatMap((row, i) =>
          i === g.index ? [] : row[g.index],
        ),
      ],
      title: model.names[g.index],
      entries: [
        {
          label: "Sent",
          text: fx(outs),
          paint: isHot ? "accent" : "neutral",
        },
        { label: "Received", text: fx(ins) },
        { label: "Share", text: pct((g.value / grand) * 100) },
      ],
    });
    if (!labels || (g.a1 - g.a0) * R < fontSize * 0.6) continue;
    const [lx, ly] = polarXY(cx, cy, R + 6, mid);
    const s = Math.sin(mid);
    const c = Math.cos(mid);
    const room =
      s > 0.12
        ? outer.x + outer.w - lx
        : s < -0.12
          ? lx - outer.x
          : outer.w / 2;
    const name = fitText(model.names[g.index], room, fontSize);
    if (!name) continue;
    texts.push({
      kind: "text",
      x: r2(lx),
      y: r2(ly + (c > 0.9 ? -fontSize * 0.4 : c < -0.9 ? fontSize * 0.4 : 0)),
      text: name,
      anchor: s > 0.12 ? "start" : s < -0.12 ? "end" : "middle",
      baseline: "middle",
      role: isHot ? "value" : "tick",
    });
  }
  return sceneOf(ctx, { marks: [...marks, ...texts], targets });
}
