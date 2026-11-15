/**
 * ADR-306 G4 — kpi family 손계산 fixture (breakdown §7.1 · 외부 oracle) + 예산 · 진단.
 *
 * 수치는 ztd-charts 0.5.0 (`3c4376c`) 식을 손으로 푼 값이다 — 코드 출력으로 만들지 않았다:
 * - gauge: `frac = (value - min) / (max - min)` (자동 domain 이 아니다 — 42 / [0, 100] = 0.42, 자동
 *   domain `[0, 50]` 이면 0.84 — 원복 RED).
 * - bullet `niceDomain(0, m, 4)[1]`: m = 34 → step 10 → 40 · m = 5 → step 1 → 5 · m = 18 → step 5 → 20.
 * - dumbbell `fitDomain(1.6, 4.6, 4, { zero: false, pad: 0.08 })`: span 3 → step 1 → 끝까지 0.6 · 0.4 >
 *   0.3 step 이라 여유 0.24 → [1.36, 4.84] (step 다시 1 — 고정).
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
} from "../../computeChartScene";
import { getChartDescriptor } from "../../authoring";
import { arcSlicePath } from "../../marks/pie";
import type { ChartProps, ChartRow } from "../../types";
import {
  bulletModel,
  dumbbellModel,
  gaugeGeometry,
  gaugeModel,
  kpiFamily,
} from "../kpi";
import { fitDomain, niceDomain, ticksFor } from "../niceScale";

const size = { width: 480, height: 270 };
const props = (patch: Partial<ChartProps>): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...patch,
});
const sampled = (
  type: "gauge" | "bullet" | "dumbbell",
  patch: Partial<ChartProps> = {},
) => ({
  // 팔레트 생성과 같은 순서 — descriptor 기본값 (dumbbell 범례 on …) 위에 family 의 역할 이름.
  props: props({
    ...getChartDescriptor(type).defaults,
    chartType: type,
    ...kpiFamily.sampleProps(type),
    ...patch,
  }),
  rows: kpiFamily.sample(type),
});

describe("ADR-306 G4 — ztd 축 범위 함수 (손계산)", () => {
  it("niceDomain · fitDomain · ticksFor", () => {
    expect(niceDomain(0, 34, 4)).toEqual([0, 40]);
    expect(niceDomain(0, 5, 4)).toEqual([0, 5]);
    expect(niceDomain(0, 18, 4)).toEqual([0, 20]);
    const [lo, hi] = fitDomain(1.6, 4.6, 4, { zero: false, pad: 0.08 });
    expect(lo).toBeCloseTo(1.36, 10);
    expect(hi).toBeCloseTo(4.84, 10);
    expect(ticksFor(1.36, 4.84, 4)).toEqual([2, 3, 4]);
    expect(ticksFor(0, 40, 4)).toEqual([0, 10, 20, 30, 40]);
  });
});

describe("ADR-306 G4 — gauge", () => {
  it("값 42 · valueMax 100 → 42 % (자동 domain 이면 84 %)", () => {
    const { props: p } = sampled("gauge", { goalField: undefined });
    const model = gaugeModel(p, [{ value: 42 }]);
    expect(model).not.toBeNull();
    if (!model || model === "empty") throw new Error("model");
    expect(model.frac).toBeCloseTo(0.42, 10);
    expect(Number.isNaN(model.targetFrac)).toBe(true);
    // scene 의 값 호 = 시작각부터 sweep × 0.42.
    const scene = kpiFamily.buildScene(
      p,
      [{ value: 42 }],
      size,
      CHART_DEFAULT_METRICS,
    );
    const g = gaugeGeometry("arc", scene.plot, CHART_DEFAULT_METRICS.fontSize);
    const valueArc = scene.marks.find(
      (m) => m.kind === "path" && m.fillPaint === "accent",
    );
    expect(valueArc && valueArc.kind === "path" && valueArc.d).toBe(
      arcSlicePath(
        g.cx,
        g.cy,
        g.radius,
        g.radius - g.thickness,
        g.start,
        g.sweep * 0.42,
      ),
    );
    expect(g.sweep).toBe(240);
  });

  it("목표 · 범위 밖 · 구간 · 설정 오류", () => {
    const { props: p, rows } = sampled("gauge");
    const model = gaugeModel(p, rows);
    if (!model || model === "empty") throw new Error("model");
    expect(model.value).toBe(73);
    expect(model.targetFrac).toBeCloseTo(0.85, 10);
    // 범위 밖은 끝에 붙는다.
    const over = gaugeModel(p, [{ value: 150 }]);
    expect(over !== null && over !== "empty" && over.frac).toBe(1);
    // 패널 목록 칸의 숫자 글자도 구간으로 · 범위 밖 구간은 버린다.
    const banded = gaugeModel({ ...p, bands: ["50", 80, 120] }, rows);
    expect(banded !== null && banded !== "empty" && banded.bands).toEqual([
      50, 80,
    ]);
    const broken = kpiFamily.buildScene(
      { ...p, bands: ["x"] },
      rows,
      size,
      CHART_DEFAULT_METRICS,
    );
    expect(broken.diagnostics?.map((d) => d.code)).toContain("bands.invalid");
    const inverted = kpiFamily.buildScene(
      { ...p, valueMin: 10, valueMax: 10 },
      rows,
      size,
      CHART_DEFAULT_METRICS,
    );
    expect(inverted.empty).toBe(true);
    expect(inverted.diagnostics?.map((d) => d.code)).toContain(
      "valueRange.invalid",
    );
    const missing = kpiFamily.buildScene(
      { ...p, metric: "" },
      rows,
      size,
      CHART_DEFAULT_METRICS,
    );
    expect(missing.diagnostics?.map((d) => d.code)).toContain("role.missing");
    expect(kpiFamily.buildScene(p, [], size, CHART_DEFAULT_METRICS).empty).toBe(
      true,
    );
  });

  it("모양 4 — sweep · ring 은 끝 글자 없음 · ticks 는 선 눈금", () => {
    const { props: p, rows } = sampled("gauge");
    for (const [shape, sweep] of [
      ["arc", 240],
      ["semi", 180],
      ["ring", 360],
      ["ticks", 240],
    ] as const) {
      const scene = kpiFamily.buildScene(
        { ...p, shape },
        rows,
        size,
        CHART_DEFAULT_METRICS,
      );
      const g = gaugeGeometry(
        shape,
        scene.plot,
        CHART_DEFAULT_METRICS.fontSize,
      );
      expect(g.sweep).toBe(sweep);
      // 상자 안 (plot) 에 호가 들어간다.
      expect(g.cx - g.radius).toBeGreaterThanOrEqual(scene.plot.x - 0.01);
      expect(g.cx + g.radius).toBeLessThanOrEqual(
        scene.plot.x + scene.plot.w + 0.01,
      );
      expect(g.cy - g.radius).toBeGreaterThanOrEqual(scene.plot.y - 0.01);
      const ticks = scene.marks.filter(
        (m) => m.kind === "line" && m.role === "grid",
      );
      if (shape === "ticks") expect(ticks.length).toBeGreaterThanOrEqual(24);
      else expect(ticks).toHaveLength(0);
    }
  });
});

describe("ADR-306 G4 — bullet", () => {
  it("행 상한 = niceDomain(0, max(값 · 목표 · 구간), 4)[1]", () => {
    const { props: p, rows } = sampled("bullet");
    const model = bulletModel(p, rows);
    expect(model?.rows.map((r) => r.max)).toEqual([40, 5, 20, 5]);
    expect(model?.globalMax).toBe(40);
    expect(model?.rows[0].ranges).toEqual([18, 25, 34]);
  });

  it("마크 — 행마다 구간 띠 (중립) · 값 막대 (accent) · 목표선 (reference)", () => {
    const { props: p, rows } = sampled("bullet");
    const scene = kpiFamily.buildScene(p, rows, size, CHART_DEFAULT_METRICS);
    const rects = scene.marks.filter((m) => m.kind === "rect");
    expect(
      rects.filter((m) => m.kind === "rect" && m.fillPaint === "accent"),
    ).toHaveLength(4);
    // 경계 [0, …구간, 상한] 중 앞보다 큰 것만 — 상한과 같은 마지막 구간 (5 · 5) 은 띠가 없다: 4 + 3 + 4 + 3.
    expect(
      rects.filter((m) => m.kind === "rect" && m.fillPaint === "neutral"),
    ).toHaveLength(14);
    expect(
      scene.marks.filter((m) => m.kind === "line" && m.role === "reference"),
    ).toHaveLength(4);
    // 첫 행: 값 27.4 / 상한 40 → 막대 폭 = (x1 - x0) × 0.685.
    const bar = rects.find(
      (m) => m.kind === "rect" && m.fillPaint === "accent",
    );
    const band = rects
      .filter((m) => m.kind === "rect" && m.fillPaint === "neutral")
      .slice(0, 4);
    const x0 = band[0].kind === "rect" ? band[0].x : 0;
    const last = band[3];
    const x1 = last.kind === "rect" ? last.x + last.w : 0;
    expect(bar && bar.kind === "rect" && bar.w).toBeCloseTo(
      (x1 - x0) * (27.4 / 40),
      1,
    );
  });

  it("예산 — 줄이 넘치면 앞 줄만 + 진단, 공용 축은 잘리기 전 전체의 최댓값", () => {
    const rows: ChartRow[] = Array.from({ length: 40 }, (_, i) => ({
      kpi: `K${i}`,
      actual: i === 39 ? 900 : 10,
      target: 12,
    }));
    const p = props({
      chartType: "bullet",
      dimension: "kpi",
      metric: "actual",
      goalField: "target",
      independent: false,
    });
    const scene = kpiFamily.buildScene(p, rows, size, CHART_DEFAULT_METRICS);
    expect(scene.diagnostics?.map((d) => d.code)).toContain(
      "budget.rowsTruncated",
    );
    const ticks = scene.axes[0]?.ticks.map((t) => t.text) ?? [];
    // 마지막 행 (900) 은 보이지 않아도 공용 축 상한은 1000 이다 (잘린 표본으로 축을 만들지 않는다).
    expect(ticks.at(-1)).toBe("1,000");
  });
});

describe("ADR-306 G4 — dumbbell", () => {
  it("이후 값 내림차순 · fitDomain 범위", () => {
    const { props: p, rows } = sampled("dumbbell");
    const model = dumbbellModel(p, rows);
    expect(model?.rows.map((r) => r.label)).toEqual([
      "Seoul",
      "Gyeonggi",
      "Incheon",
      "Busan",
      "Daejeon",
      "Daegu",
      "Gwangju",
    ]);
    expect(model?.domain[0]).toBeCloseTo(1.36, 10);
    expect(model?.domain[1]).toBeCloseTo(4.84, 10);
    const none = dumbbellModel({ ...p, sort: "none" }, rows);
    expect(none?.rows[0].label).toBe("Seoul");
    expect(none?.rows[1].label).toBe("Gyeonggi");
    expect(none?.rows[2].label).toBe("Busan");
    // includeZero 는 0 을 넣는다.
    expect(dumbbellModel({ ...p, includeZero: true }, rows)?.domain[0]).toBe(0);
  });

  it("마크 — 연결선 (neutral) · 시작 점 (neutral) · 끝 점 (accent) · 범례 2 · 결측 행 제외", () => {
    const { props: p, rows } = sampled("dumbbell");
    const withHole = [...rows, { region: "Ulsan", before: null, after: 2 }];
    const scene = kpiFamily.buildScene(
      p,
      withHole,
      size,
      CHART_DEFAULT_METRICS,
    );
    expect(
      scene.marks.filter((m) => m.kind === "line" && m.paint === "neutral"),
    ).toHaveLength(7);
    expect(
      scene.marks.filter((m) => m.kind === "path" && m.fillPaint === "accent"),
    ).toHaveLength(7);
    expect(scene.legend?.items.map((i) => i.label)).toEqual([
      "before",
      "after",
    ]);
    // 판독 LOW — 범례는 showLegend 를 따른다 (패널 토글).
    expect(
      kpiFamily.buildScene(
        { ...p, showLegend: false },
        rows,
        size,
        CHART_DEFAULT_METRICS,
      ).legend,
    ).toBeNull();
    const missing = kpiFamily.buildScene(
      { ...p, startField: undefined },
      rows,
      size,
      CHART_DEFAULT_METRICS,
    );
    expect(missing.diagnostics?.map((d) => d.code)).toContain("role.missing");
  });
});

describe("ADR-306 — targets (hover · 키보드 순서)", () => {
  it("showTooltip 이면 행마다 하나 (원본 행 인덱스), 아니면 없음", () => {
    const { props: p, rows } = sampled("dumbbell", {
      showTooltip: true,
      sort: "none",
    });
    const scene = kpiFamily.buildScene(p, rows, size, CHART_DEFAULT_METRICS);
    expect(scene.targets?.map((t) => t.rows[0])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(
      kpiFamily.buildScene(
        { ...p, showTooltip: false },
        rows,
        size,
        CHART_DEFAULT_METRICS,
      ).targets,
    ).toEqual([]);
  });
});
