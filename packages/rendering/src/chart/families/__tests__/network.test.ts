/**
 * ADR-306 G4 — network family 손계산 fixture (breakdown §7.1 · 외부 oracle) + 진단 · 예산 · 크기 표.
 *
 * 수치는 ztd-charts 0.5.0 (`3c4376c`) 식을 손으로 푼 값이다 — 코드 출력으로 만들지 않았다:
 * - squarify [6, 3, 1] · 상자 10 × 6: 넓이 [36, 18, 6]. 첫 줄 side 6 — [36] 의 최악비 1, 18 을 더하면 4.5
 *   로 나빠져 멈춤 → 열 폭 36 / 6 = 6 → {0, 0, 6, 6}. 남은 4 × 6 은 side 4 — [18] 1.125, 6 을 더하면 6 →
 *   멈춤, 세로가 길어 행: 높이 18 / 4 = 4.5 → {6, 0, 4, 4.5}. 남은 4 × 1.5 → {6, 4.5, 4, 1.5}.
 * - 트리: 경로 [A x] 1 · [A y] 2 · [B z] 3 · [A x] 4 → A 7 (x 5 · 행 [0, 3] · y 2) · B 3 · 전체 10.
 *   sunburst 각도: A 0.7 바퀴 · B 0.3 바퀴, A 안 x 는 A 의 5 / 7.
 * - sankey: A→B 5 · A→C 3 · B→C 2 → 노드 값 = max(들어옴, 나감) A 8 · B 5 · C 5, 열 A 0 · B 1 · C 2 (가장
 *   긴 경로). A→B · B→A 순환은 되돌아가는 연결 1 → 진단 `links.cycle`.
 * - chord: [[0, 2], [1, 0]] · 틈 0 → 마디 크기 3 · 3 → 각 반 바퀴, 리본 출발 = 큰 쪽 (0 → 1 의 2).
 * - treemap 칸 넓이 합 = 그림 넓이 (틈 포함 — (w + 2)(h + 2)) · 부모 = 자식 합.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
} from "../../computeChartScene";
import { getChartDescriptor } from "../../authoring";
import type { ChartProps, ChartRow, ChartScene, Mark } from "../../types";
import { categoryContext } from "../category/common";
import { networkFamily, NETWORK_TYPES } from "../network";
import { chordLayout, sankeyGraph, sankeyPlace } from "../network/flow";
import {
  buildTree,
  leaves,
  partitionAngles,
  squarify,
} from "../network/hierarchy";
import { sankeyModel } from "../network/links";
import { treemapLayout, treeModel } from "../network/tree";

type Type = (typeof NETWORK_TYPES)[number];
const SIZE = { width: 640, height: 360 };
const TAU = Math.PI * 2;
const props = (patch: Partial<ChartProps>): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...patch,
});
const sampled = (type: Type, patch: Partial<ChartProps> = {}) => ({
  props: props({
    ...getChartDescriptor(type).defaults,
    chartType: type,
    showTooltip: true,
    ...networkFamily.sampleProps(type),
    ...patch,
  }),
  rows: networkFamily.sample(type) as ChartRow[],
});
const sceneOf = (
  type: Type,
  patch: Partial<ChartProps> = {},
  rows?: ChartRow[],
  size = SIZE,
): ChartScene => {
  const s = sampled(type, patch);
  return networkFamily.buildScene(
    s.props,
    rows ?? s.rows,
    size,
    CHART_DEFAULT_METRICS,
  );
};
const ctxOf = (type: Type, patch: Partial<ChartProps>, rows: ChartRow[]) =>
  categoryContext(
    sampled(type, patch).props,
    rows,
    SIZE,
    CHART_DEFAULT_METRICS,
    false,
  );

function finiteScene(scene: ChartScene): string[] {
  const bad: string[] = [];
  const check = (mark: Mark, where: string) => {
    for (const [key, value] of Object.entries(mark)) {
      if (typeof value === "number" && !Number.isFinite(value))
        bad.push(`${where}.${key}`);
      if (
        key === "d" &&
        typeof value === "string" &&
        /NaN|Infinity/.test(value)
      )
        bad.push(`${where}.d`);
      if (key === "bbox" && value && typeof value === "object")
        for (const [bk, bv] of Object.entries(value))
          if (typeof bv === "number" && !Number.isFinite(bv))
            bad.push(`${where}.bbox.${bk}`);
    }
  };
  scene.marks.forEach((m, i) => check(m, `marks[${i}]`));
  for (const t of scene.targets ?? [])
    if (![t.x, t.y].every(Number.isFinite)) bad.push(`target ${t.id}`);
  return bad;
}

describe("ADR-306 G4 — 계층 (손계산)", () => {
  it("squarify [6, 3, 1] · 10 × 6 → 세 상자 · 넓이 합 = 상자 넓이", () => {
    const rects = squarify([6, 3, 1], { x: 0, y: 0, w: 10, h: 6 });
    expect(rects).toEqual([
      { x: 0, y: 0, w: 6, h: 6 },
      { x: 6, y: 0, w: 4, h: 4.5 },
      { x: 6, y: 4.5, w: 4, h: 1.5 },
    ]);
    expect(rects.reduce((s, r) => s + r.w * r.h, 0)).toBeCloseTo(60, 9);
  });

  it("buildTree — 부모 = 자식 합 · 같은 경로는 한 잎 (행 [0, 3])", () => {
    const { root, excluded } = buildTree(
      [
        ["A", "x"],
        ["A", "y"],
        ["B", "z"],
        ["A", "x"],
      ],
      [1, 2, 3, 4],
    );
    expect(excluded).toBe(0);
    expect(root.value).toBe(10);
    const [a, b] = root.children;
    expect([a.label, a.value, b.label, b.value]).toEqual(["A", 7, "B", 3]);
    expect(a.children.map((c) => [c.label, c.value, c.rows])).toEqual([
      ["x", 5, [0, 3]],
      ["y", 2, [1]],
    ]);
  });

  it("경로가 다른 행 경로의 앞부분이면 (하위 분류 빈 칸) 그 값은 부모 이름의 자식 잎으로 남는다 (판독)", () => {
    const { root } = buildTree(
      [
        ["Gear", ""],
        ["Gear", "Socks"],
        ["Shoes", "Run"],
      ],
      [5, 7, 3],
    );
    expect(root.value).toBe(15);
    const gear = root.children[0];
    expect(gear.value).toBe(12);
    expect(gear.children.map((c) => [c.label, c.value, c.rows])).toEqual([
      ["Socks", 7, [1]],
      ["Gear", 5, [0]],
    ]);
    expect(gear.rows).toEqual([]);
  });

  it("partitionAngles — A 0.7 바퀴 · B 0.3 바퀴 · x 는 A 의 5 / 7", () => {
    const { root } = buildTree(
      [
        ["A", "x"],
        ["A", "y"],
        ["B", "z"],
        ["A", "x"],
      ],
      [1, 2, 3, 4],
    );
    const arcs = partitionAngles(root);
    const span = (label: string) => {
      const a = arcs.find((q) => q.node.label === label)!;
      return a.a1 - a.a0;
    };
    expect(span("A")).toBeCloseTo(0.7 * TAU, 9);
    expect(span("B")).toBeCloseTo(0.3 * TAU, 9);
    expect(span("x")).toBeCloseTo(0.7 * TAU * (5 / 7), 9);
  });

  it("treemap 배치 — 칸 넓이 합 = 그림 넓이 (틈 포함) · 머리글 없이 2 단계", () => {
    const ctx = ctxOf(
      "treemap",
      {},
      networkFamily.sample("treemap") as ChartRow[],
    );
    const model = treeModel(ctx, "descending")!;
    const plot = { x: 0, y: 0, w: 300, h: 200 };
    const { cells } = treemapLayout(model, plot, 0);
    expect(cells.length).toBe(leaves(model.root).length);
    expect(cells.reduce((s, c) => s + c.rect.w * c.rect.h, 0)).toBeCloseTo(
      302 * 202,
      6,
    );
  });

  it("음수 · 결측 값은 0 + values.excluded", () => {
    const ctx = ctxOf("treemap", {}, [
      { category: "A", product: "x", share: 5 },
      { category: "A", product: "y", share: -3 },
      { category: "B", product: "z", share: null },
    ]);
    const model = treeModel(ctx, "descending")!;
    expect(model.root.value).toBe(5);
    expect(ctx.input.diagnostics.map((d) => d.code)).toContain(
      "values.excluded",
    );
  });
});

describe("ADR-306 G4 — 흐름 (손계산)", () => {
  const link = (source: string, target: string, value: number, row = 0) => ({
    source,
    target,
    value,
    row,
  });

  it("sankey 노드 값 = max(들어옴, 나감) · 열 = 가장 긴 경로", () => {
    const g = sankeyGraph([
      link("A", "B", 5),
      link("A", "C", 3),
      link("B", "C", 2),
    ]);
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    expect([by.A.value, by.B.value, by.C.value]).toEqual([8, 5, 5]);
    expect([by.A.layer, by.B.layer, by.C.layer]).toEqual([0, 1, 2]);
    expect(g.back).toBe(0);
  });

  it("sankey 배치 — 같은 열 노드 높이 비율 = 값 비율 · 띠 폭 합 = 노드 높이", () => {
    const g = sankeyGraph([link("A", "C", 6), link("B", "C", 2)]);
    sankeyPlace(g, {
      x0: 0,
      y0: 0,
      width: 200,
      height: 100,
      nodeWidth: 10,
      nodePadding: 10,
    });
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    const h = (id: string) => by[id].y1 - by[id].y0;
    expect(h("A") / h("B")).toBeCloseTo(3, 9);
    expect(h("A") + h("B") + 10).toBeCloseTo(100, 6);
    expect(g.links.reduce((s, l) => s + l.width, 0)).toBeCloseTo(h("C"), 6);
    expect(by.C.x1).toBeCloseTo(200, 9);
  });

  it("sankey 순환 → 되돌아가는 연결 1 + links.cycle 진단 · 자기 자신 · 0 이하 값은 그리지 않는다", () => {
    const ctx = ctxOf("sankey", {}, [
      { source: "A", target: "B", value: 1 },
      { source: "B", target: "A", value: 1 },
      { source: "A", target: "A", value: 4 },
      { source: "B", target: "C", value: 0 },
    ]);
    const g = sankeyModel(ctx)!;
    expect(g.back).toBe(1);
    expect(g.dropped).toBe(2);
    const codes = ctx.input.diagnostics.map((d) => d.code);
    expect(codes).toContain("links.cycle");
    expect(codes).toContain("values.excluded");
  });

  it("sankey — 같은 출발 · 도착 행은 한 연결로 합산 (행 둘)", () => {
    const g = sankeyGraph([link("A", "B", 2, 0), link("A", "B", 3, 1)]);
    expect(g.links.map((l) => [l.value, l.rows])).toEqual([[5, [0, 1]]]);
  });

  it("chord [[0, 2], [1, 0]] · 틈 0 → 마디 반 바퀴씩 · 리본 출발 = 큰 쪽", () => {
    const { groups, chords } = chordLayout(
      [
        [0, 2],
        [1, 0],
      ],
      0,
    );
    expect(groups.map((g) => g.value)).toEqual([3, 3]);
    expect(groups[0].a1 - groups[0].a0).toBeCloseTo(Math.PI, 9);
    expect(chords).toHaveLength(1);
    expect([chords[0].source.index, chords[0].source.value]).toEqual([0, 2]);
    expect(chords[0].target.value).toBe(1);
  });
});

describe("ADR-306 G4 — network 4 종 scene (표본 · 경계 입력)", () => {
  for (const type of NETWORK_TYPES)
    for (const size of [
      { width: 320, height: 240 },
      { width: 640, height: 360 },
      { width: 160, height: 48 },
    ])
      it(`${type} ${size.width}×${size.height} 표본 — 마크 있음 · 숫자 유한 · 설정 오류 없음`, () => {
        const scene = sceneOf(type, {}, undefined, size);
        expect(finiteScene(scene)).toEqual([]);
        expect(
          (scene.diagnostics ?? []).filter((d) => d.severity === "error"),
        ).toEqual([]);
        if (size.width >= 320) {
          expect(scene.empty).toBe(false);
          expect(scene.marks.length).toBeGreaterThan(0);
          expect(scene.targets?.length ?? 0).toBeGreaterThan(0);
        }
      });

  for (const type of NETWORK_TYPES) {
    it(`${type} — 행 0 은 빈 상태 · 역할 비면 설정 오류`, () => {
      expect(sceneOf(type, {}, []).empty).toBe(true);
      const broken = sceneOf(type, {
        metric: "",
        pathFields: [],
        sourceField: "",
        targetField: "",
      });
      expect(broken.empty).toBe(true);
      expect(broken.diagnostics?.some((d) => d.code === "role.missing")).toBe(
        true,
      );
    });
    it(`${type} — 음수 · 0 · 결측 행에서도 숫자 유한`, () => {
      const s = sampled(type);
      const rows = s.rows.map((row, i) => {
        const out: ChartRow = { ...row };
        for (const [k, v] of Object.entries(row))
          if (typeof v === "number")
            out[k] = i % 3 === 0 ? -v : i % 3 === 1 ? 0 : null;
        return out;
      });
      expect(finiteScene(sceneOf(type, {}, rows))).toEqual([]);
    });
    it(`${type} — 항목 하나 · 긴 한국어 이름에서도 숫자 유한`, () => {
      const s = sampled(type);
      const longKo = s.rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            typeof v === "string" ? `아주 긴 한국어 이름 ${v}` : v,
          ]),
        ),
      );
      expect(finiteScene(sceneOf(type, {}, s.rows.slice(0, 1)))).toEqual([]);
      expect(finiteScene(sceneOf(type, {}, longKo))).toEqual([]);
    });
    it(`${type} — 항목이 아주 많아도 기하가 음수 · NaN 이 아니다`, () => {
      const s = sampled(type);
      const many: ChartRow[] = [];
      for (let k = 0; k < 120; k++)
        for (const row of s.rows)
          many.push(
            Object.fromEntries(
              Object.entries(row).map(([key, v]) => [
                key,
                typeof v === "string" ? `${v}-${k % 40}` : v,
              ]),
            ),
          );
      for (const size of [
        { width: 640, height: 360 },
        { width: 140, height: 78 },
        { width: 40, height: 30 },
      ]) {
        const scene = sceneOf(type, {}, many, size);
        expect(finiteScene(scene), `${size.width}`).toEqual([]);
        expect(
          scene.marks.filter((m) => m.kind === "rect" && (m.w < 0 || m.h < 0)),
          `${size.width}`,
        ).toEqual([]);
        expect(
          scene.marks.filter(
            (m) => m.kind === "path" && (m.bbox.w < 0 || m.bbox.h < 0),
          ),
          `${size.width}`,
        ).toEqual([]);
      }
    });
  }

  it("강조 하나 — treemap 가장 큰 잎 · sankey 마지막 열 가장 큰 노드 · chord 가장 큰 마디만 accent", () => {
    const accentRects = (scene: ChartScene) =>
      scene.marks.filter((m) => m.kind === "rect" && m.fillPaint === "accent")
        .length;
    expect(accentRects(sceneOf("treemap"))).toBe(1);
    expect(accentRects(sceneOf("sankey"))).toBe(1);
    const chord = sceneOf("chord");
    const groupArcs = chord.marks.filter(
      (m) => m.kind === "path" && m.fillRule === "evenodd",
    );
    expect(
      groupArcs.filter((m) => m.kind === "path" && m.fillPaint === "accent"),
    ).toHaveLength(1);
  });

  it("칸 안 이름은 대비 색 (on-fill) — treemap · sunburst 안쪽 조각", () => {
    const inCell = (scene: ChartScene) =>
      scene.marks.filter((m) => m.kind === "text" && m.paint === "on-fill");
    expect(inCell(sceneOf("treemap")).length).toBeGreaterThan(0);
    expect(inCell(sceneOf("sunburst")).length).toBeGreaterThan(0);
    // 이름을 끄면 칸 안 글자 0.
    expect(inCell(sceneOf("treemap", { showValueLabels: false }))).toEqual([]);
  });

  it("treemap labelKey value — 칸 안에 비율만 (이름 없음)", () => {
    const texts = sceneOf("treemap", { labelKey: "value" }).marks.filter(
      (m) => m.kind === "text" && m.paint === "on-fill",
    );
    expect(texts.every((m) => m.kind === "text" && /%$/.test(m.text))).toBe(
      true,
    );
  });

  it("숫자 옵션이 NaN · 문자여도 기본값으로", () => {
    for (const patch of [
      { nodeWidth: Number.NaN, nodePadding: "x" as unknown as number },
      { padAngle: Number.NaN },
      { innerRadius: Number.NaN },
    ])
      for (const type of NETWORK_TYPES)
        expect(finiteScene(sceneOf(type, patch)), type).toEqual([]);
  });
});
