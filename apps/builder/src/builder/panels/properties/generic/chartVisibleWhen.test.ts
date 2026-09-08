/**
 * ADR-208 G2 ① — 조건 표 ↔ 소비 경로 차등 오라클.
 *
 * **선언을 선언으로 대조하지 않는다.** binding 의 `visibleWhen` 이 맞는지를 `computeChartScene`
 * 의 코드를 다시 읽어 확인하면 검증자와 설계자가 같은 사람이 된다 (measurement-validity §2 #5).
 * 대신 **값을 바꿔 scene 이 실제로 달라지는지**를 잰다:
 *
 *     { 값을 바꾸면 그 종류의 scene 이 달라지는 prop } ⊆ { 패널에 보이는 prop }
 *
 * 위반 = 사용자가 그림에 영향을 주는 값을 편집할 수단을 못 찾는 상태 (ADR-208 R2). 반대 방향
 * (보이는데 안 달라짐) 은 실패로 치지 않는다 — 데이터·크기에 따라 우연히 같아질 수 있고,
 * 여유 있게 보여 주는 것은 결함이 아니다.
 */
import { describe, expect, it } from "vitest";

import {
  CHART_DEFAULT_METRICS,
  computeChartScene,
  type ChartProps,
  type ChartRow,
  type ChartType,
} from "@composition/specs";
import { getCatalogEntry } from "@composition/shared";

import { evaluateVisibility } from "./evaluateVisibility";

const CHART_TYPES: ChartType[] = [
  "bar",
  "line",
  "area",
  "pie",
  "radar",
  "radial",
];

/** 값이 갈리기에 충분한 표본 — 시리즈 2 × 범주 4 (기본 fixture 와 같은 모양). */
const ROWS: ChartRow[] = [
  { category: "Mon", value: 12, series: "A" },
  { category: "Tue", value: 30, series: "A" },
  { category: "Wed", value: 18, series: "A" },
  { category: "Thu", value: 24, series: "A" },
  { category: "Mon", value: 20, series: "B" },
  { category: "Tue", value: 8, series: "B" },
  { category: "Wed", value: 25, series: "B" },
  { category: "Thu", value: 14, series: "B" },
];

const SIZE = { width: 400, height: 300 };

/** binding accepts 의 기본값 = 패널이 보여 주는 baseValue (resolveEditContract.ts:343). */
function acceptsContracts(): Record<
  string,
  { default?: unknown; visibleWhen?: unknown }
> {
  const entry = getCatalogEntry("Chart");
  if (entry?.kind !== "primitive") throw new Error("Chart binding 없음");
  return entry.binding.props.accepts as never;
}

function baseProps(chartType: ChartType): ChartProps {
  const props: Record<string, unknown> = { chartType };
  for (const [key, contract] of Object.entries(acceptsContracts())) {
    if (key === "chartType" || contract.default === undefined) continue;
    props[key] = contract.default;
  }
  // 기본값이 **다른 prop 을 가리는** 자리를 열어 둔다 — 오라클이 안 보고 지나치는 축을
  //   줄이는 것이 목적이다. showGrid=false 면 gridType 이, showLegend=false 면
  //   legendPosition 이, innerRadius=0 이면 showTotal 이 아무 반응도 안 한다.
  props.color = "series";
  props.showAxis = true;
  props.showGrid = true;
  props.showLegend = true;
  props.innerRadius = 40;
  return props as unknown as ChartProps;
}

/**
 * prop 하나를 "기본값이 아닌 다른 값" 으로 바꾼 후보들. 하나라도 scene 을 바꾸면 그 prop 은
 * 그 종류에서 **소비된다**.
 */
const ALTERNATIVES: Record<string, unknown[]> = {
  orientation: ["horizontal"],
  stackType: ["stacked", "expand"],
  curve: ["monotone", "step"],
  showDots: [true],
  showValueLabels: [true],
  colorBy: ["category"],
  innerRadius: [0, 70],
  gridType: ["circle"],
  showTotal: [true],
  showAxis: [false],
  showTooltip: [true],
  showGrid: [false],
  showLegend: [false],
  legendPosition: ["right"],
};

function sceneOf(props: ChartProps): string {
  return JSON.stringify(
    computeChartScene(props, ROWS, SIZE, CHART_DEFAULT_METRICS),
  );
}

/** 값을 바꿨을 때 scene 이 달라지는 prop 집합. */
function consumedBy(chartType: ChartType): Set<string> {
  const base = baseProps(chartType);
  const baseScene = sceneOf(base);
  const consumed = new Set<string>();
  for (const [key, candidates] of Object.entries(ALTERNATIVES)) {
    for (const value of candidates) {
      if (sceneOf({ ...base, [key]: value } as ChartProps) !== baseScene) {
        consumed.add(key);
        break;
      }
    }
  }
  return consumed;
}

/** 그 종류에서 패널에 보이는 prop 집합. */
function visibleFor(chartType: ChartType): Set<string> {
  const contracts = acceptsContracts();
  const conditionValues: Record<string, unknown> = { chartType };
  for (const [key, contract] of Object.entries(contracts)) {
    if (key === "chartType") continue;
    conditionValues[key] = contract.default;
  }
  // baseProps 와 같은 열림 상태 — 두 집합이 다른 전제에서 나오면 비교가 성립하지 않는다.
  conditionValues.showAxis = true;
  conditionValues.showGrid = true;
  conditionValues.showLegend = true;
  conditionValues.innerRadius = 40;
  const visible = new Set<string>();
  for (const [key, contract] of Object.entries(contracts)) {
    if (evaluateVisibility(contract.visibleWhen as never, conditionValues)) {
      visible.add(key);
    }
  }
  return visible;
}

describe("ADR-208 G2 ① — 소비되는 prop 은 반드시 보인다", () => {
  for (const chartType of CHART_TYPES) {
    it(`${chartType} — 값을 바꿔 scene 이 달라지는 prop 이 전부 패널에 보인다`, () => {
      const consumed = consumedBy(chartType);
      const visible = visibleFor(chartType);
      const hiddenButConsumed = [...consumed].filter((k) => !visible.has(k));
      expect(hiddenButConsumed).toEqual([]);
    });
  }

  it("오라클이 공허하지 않다 — 종류마다 소비 prop 이 1개 이상", () => {
    for (const chartType of CHART_TYPES) {
      expect(consumedBy(chartType).size).toBeGreaterThan(0);
    }
  });

  it("조건이 실제로 무언가를 숨긴다 — bar 와 radar 의 노출 집합이 다르다", () => {
    const bar = visibleFor("bar");
    const radar = visibleFor("radar");
    expect(bar.has("gridType")).toBe(false);
    expect(radar.has("gridType")).toBe(true);
    expect([...bar].sort()).not.toEqual([...radar].sort());
  });
});
