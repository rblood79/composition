/**
 * ADR-312 G0 → G2 — Chart 데이터 포맷 표. Phase 0 (main `ce4500fde`) 에 현재 표를 고정했고 (그 표는 breakdown §3 ·
 * §8 에 있다), Phase 2 가 이 표를 **표준 표** 로 바꿨다 — 표본 열 = 역할의 기본 열 이름 (결정 3), 생성 때 쓰는 역할
 * 값은 기본 열 이름이 없는 목록 역할뿐 (Decision 8), candlestick 의 종가 = `metric`.
 *
 * 36 제공 항목마다 생성 직후의 표본 열 · 저장되는 역할 값 · 그 중 그 종류가 읽지 않는 역할 · 범례 ·
 * `seriesConfig` 반응 · 같은 키 행 (표본 첫 행 복제) 의 반응을 고정한다. Phase 3 이 행 정책을 표준으로 바꿨다 (사용자
 * 결정 4 — 범주 × 값 · bullet · dumbbell · gauge · sparkline · slope 합산, bump 순위 첫 행). Phase 4 가 시리즈 표시 표를
 * 공통으로 했다 (marimekko · segmented · waffle · dumbbell · slope · parallel 이 `seriesConfig` 를 읽는다). 기대 값은 breakdown §3 의 손 표
 * (코드 판독) 이고, 「읽지 않음」 · `seriesConfig` · 행 복제는 동작으로 잰다 (값을 바꿔도 scene 이 같은가).
 * 이 표는 Phase 2 (저장) · 3 (행 정책) · 4 (시리즈 표시 표) 가 바꾼다 — 그때 기대 값을 표준 표로 고친다.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DESCRIPTORS,
  completeChartCreationProps,
  createChartInitialProps,
} from "../authoring";
import { computeChartScene } from "../computeChartScene";
import { seriesIdentity } from "../presentation";
import { chartActiveForm, type ChartRowPolicy } from "../roles";
import type { ChartProps, ChartRow, ChartScene } from "../types";

/** 역할 prop 전부 (breakdown §2.1 역할 목록 + 지금의 `closeField` · `dataMode`). */
const ROLE_KEYS = [
  "dimension",
  "metric",
  "color",
  "dataMode",
  "valueFields",
  "goalField",
  "rangeFields",
  "startField",
  "endField",
  "kindField",
  "rankField",
  "frontFields",
  "binStartField",
  "binEndField",
  "countField",
  "labelField",
  "rowField",
  "openField",
  "highField",
  "lowField",
  "closeField",
  "volumeField",
  "invertFields",
  "pathFields",
  "sourceField",
  "targetField",
  "lowerFields",
  "upperFields",
  "sizeField",
] as const;

/**
 * 행 정책 — Phase 3 부터 형태의 선언 (`ChartForm.rows`) 을 읽는다. Phase 0 의 코드 판독 분류 (첫 행 · 마지막 행 ·
 * 순위 합산 …) 는 breakdown §3.2 에 있다. 선언이 실제로 그렇게 읽히는지는 `adr312RowPolicy.test.ts` 의 손계산 fixture.
 */
type RowPolicy = ChartRowPolicy;

interface Current {
  /** 표본 행의 열 (첫 출현 순) */
  columns: string;
  /** 생성 때 저장되는 역할 값 (`key=value`, 목록은 `a+b`) */
  stored: string;
  /** 저장되지만 표본에서 scene 이 바뀌지 않는 역할 (본문 F5) */
  unread?: string;
  rows: RowPolicy;
  /** `showLegend: true` 에서 scene 범례가 있는가 (segmented · heatmap 은 자체 마크로 그린다) */
  legend?: true;
  /** `seriesConfig` 의 이름이 scene 글자에 나오는가 (본문 F9) */
  seriesConfig?: true;
  /** 표본 첫 행을 끝에 복제해도 scene 이 그대로인가 */
  duplicateInvisible?: true;
}

const CURRENT: Record<string, Current> = {
  "chart-area": {
    columns: "category value series",
    stored: "",
    rows: "sum",
    legend: true,
    seriesConfig: true,
  },
  "chart-bar": {
    columns: "category value series",
    stored: "",
    rows: "sum",
    legend: true,
    seriesConfig: true,
  },
  "chart-line": {
    columns: "category value series",
    stored: "",
    rows: "sum",
    legend: true,
    seriesConfig: true,
  },
  "chart-pie": {
    columns: "category value series",
    stored: "",
    rows: "sum",
    legend: true,
  },
  "chart-donut": {
    columns: "category value series",
    stored: "",
    rows: "sum",
    legend: true,
  },
  "chart-radar": {
    columns: "category value series",
    stored: "",
    rows: "sum",
    legend: true,
    seriesConfig: true,
  },
  "chart-radial": {
    columns: "category value series",
    stored: "",
    rows: "sum",
    legend: true,
  },
  "chart-scatter": {
    columns: "category value series",
    stored: "",
    rows: "row",
    legend: true,
    seriesConfig: true,
  },
  "chart-bubble": {
    columns: "category value size series",
    stored: "",
    rows: "row",
    legend: true,
    seriesConfig: true,
  },
  "chart-gauge": {
    columns: "label value goal",
    stored: "",
    rows: "sum",
  },
  "chart-bullet": {
    columns: "category value goal poor ok good",
    stored: "rangeFields=poor+ok+good",
    rows: "sum",
  },
  "chart-dumbbell": {
    columns: "category start end",
    stored: "",
    rows: "sum",
    legend: true,
    seriesConfig: true,
  },
  "chart-lollipop": { columns: "category value", stored: "", rows: "sum" },
  "chart-segmented": {
    columns: "category value",
    stored: "",
    rows: "sum",
    seriesConfig: true,
  },
  "chart-waffle": {
    columns: "category value",
    stored: "",
    rows: "sum",
    seriesConfig: true,
  },
  "chart-funnel": { columns: "category value", stored: "", rows: "sum" },
  "chart-pareto": { columns: "category value", stored: "", rows: "sum" },
  "chart-waterfall": {
    columns: "category value kind",
    stored: "",
    rows: "row",
  },
  "chart-sparkline": { columns: "category value", stored: "", rows: "sum" },
  "chart-marimekko": {
    columns: "category series value",
    stored: "",
    rows: "sum",
    legend: true,
    seriesConfig: true,
  },
  "chart-stream": {
    columns: "category series value",
    stored: "",
    rows: "sum",
    legend: true,
    seriesConfig: true,
  },
  "chart-bump": {
    columns: "category series rank",
    stored: "",
    rows: "sum",
    duplicateInvisible: true,
    seriesConfig: true,
  },
  "chart-slope": {
    columns: "series category value",
    stored: "",
    rows: "sum",
    seriesConfig: true,
  },
  "chart-skyline": {
    columns: "category Input Cached Output Reasoning Failed Retried",
    stored:
      "dataMode=columns valueFields=Input+Cached+Output+Reasoning frontFields=Failed+Retried",
    rows: "sum",
    legend: true,
    seriesConfig: true,
  },
  "chart-histogram": {
    columns: "value",
    stored: "",
    rows: "sample",
  },
  "chart-box": { columns: "category value", stored: "", rows: "sample" },
  "chart-beeswarm": {
    columns: "label category value",
    stored: "",
    rows: "sample",
  },
  "chart-ridgeline": { columns: "category value", stored: "", rows: "sample" },
  "chart-heatmap": { columns: "row category value", stored: "", rows: "sum" },
  "chart-calendar": { columns: "category value", stored: "", rows: "sum" },
  "chart-candlestick": {
    columns: "category open high low value volume",
    stored: "",
    rows: "row",
  },
  "chart-parallel": {
    columns: "label price weight battery perf screen",
    stored:
      "valueFields=price+weight+battery+perf+screen invertFields=price+weight",
    rows: "row",
    seriesConfig: true,
  },
  "chart-treemap": {
    columns: "group category value",
    stored: "",
    rows: "sum",
  },
  "chart-sunburst": {
    columns: "group category value",
    stored: "",
    rows: "sum",
  },
  "chart-sankey": {
    columns: "source target value",
    stored: "",
    rows: "sum",
  },
  "chart-chord": {
    columns: "source target value",
    stored: "",
    rows: "sum",
  },
};

const size = { width: 480, height: 320 };
const same = (a: ChartScene, b: ChartScene) =>
  JSON.stringify(a) === JSON.stringify(b);

function sceneTexts(scene: ChartScene): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      for (const [key, inner] of Object.entries(value)) {
        if ((key === "text" || key === "label") && typeof inner === "string")
          out.push(inner);
        else walk(inner);
      }
  };
  walk([scene.marks, scene.legend, scene.axes]);
  return out;
}

async function observe(paletteId: string): Promise<Current> {
  const d = CHART_DESCRIPTORS.find((row) => row.paletteId === paletteId)!;
  const created = (await completeChartCreationProps(
    createChartInitialProps(d.chartType, d.paletteId) as never,
  )) as unknown as ChartProps & { data: ChartRow[] };
  const rows = created.data;
  const props = { ...created, showLegend: true } as ChartProps;
  const base = computeChartScene(props, rows, size);
  expect(base.empty, `${paletteId} 표본이 그려진다`).toBe(false);

  const record = props as unknown as Record<string, unknown>;
  // 저장 역할 = 생성 값 중 기본 열 이름과 다른 것 (같은 값은 원본 template 이 이미 들고 있어 문서에 쓰이지 않고,
  //   써도 기본 열 이름 읽기와 같다 — ADR-312 Decision 8).
  const DEFAULT_NAME: Record<string, string> = {
    dimension: "category",
    metric: "value",
    color: "series",
  };
  const stored = ROLE_KEYS.filter(
    (key) => record[key] !== undefined && record[key] !== DEFAULT_NAME[key],
  );
  const unread = stored.filter((key) => {
    if (key === "dataMode") return false;
    const value = record[key];
    const probe = {
      ...props,
      [key]: Array.isArray(value) ? ["__none__"] : "__none__",
    };
    return same(computeChartScene(probe as ChartProps, rows, size), base);
  });

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  // 모든 열 (field identity) · 모든 글자 값 (group identity) 에 이름을 단다 — 하나라도 글자에 나오면 읽는다.
  const config = columns.flatMap((column, i) => [
    { key: seriesIdentity("field", column), label: `§f${i}` },
    ...[...new Set(rows.map((row) => row[column]))]
      .filter((v): v is string => typeof v === "string")
      .map((v, j) => ({
        key: seriesIdentity("group", v),
        label: `§g${i}.${j}`,
      })),
  ]);
  const named = computeChartScene(
    { ...props, seriesConfig: config } as ChartProps,
    rows,
    size,
  );
  const duplicated = computeChartScene(props, [...rows, { ...rows[0] }], size);

  return {
    columns: columns.join(" "),
    stored: stored
      .map((key) => {
        const value = record[key];
        return `${key}=${Array.isArray(value) ? value.join("+") : String(value)}`;
      })
      .join(" "),
    ...(unread.length > 0 ? { unread: unread.join(" ") } : {}),
    rows: chartActiveForm(props).rows,
    ...(base.legend ? { legend: true as const } : {}),
    ...(sceneTexts(named).some((t) => t.includes("§"))
      ? { seriesConfig: true as const }
      : {}),
    ...(same(duplicated, base) ? { duplicateInvisible: true as const } : {}),
  };
}

describe("ADR-312 G0 — 현재 데이터 포맷 표 (36 항목)", () => {
  it("표가 제공 항목 36 을 빠짐없이 덮는다", () => {
    expect(Object.keys(CURRENT).sort()).toEqual(
      CHART_DESCRIPTORS.map((d) => d.paletteId).sort(),
    );
  });

  for (const paletteId of Object.keys(CURRENT))
    it(`${paletteId} — 표본 열 · 저장 역할 · 읽지 않는 역할 · 범례 · seriesConfig · 행 복제`, async () => {
      expect(await observe(paletteId)).toEqual(CURRENT[paletteId]);
    });

  // F2 · F6 · F7 (descriptor 의 역할 · columns 깃발 · `closeField`) 의 Phase 0 상태는 breakdown §8 에 적었다 —
  //   Phase 1 이 descriptor 를 형태 표 (`roles.ts` `CHART_FORMS`) 로 바꿨다 (`adr312Roles.test.ts`).
});
