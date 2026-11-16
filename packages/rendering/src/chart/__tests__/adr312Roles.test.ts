/**
 * ADR-312 Phase 1 (G1 · G2) — 역할 표 하나 · 형태 · 파생 · 공통 검증. 저장 무변경.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DESCRIPTORS,
  CHART_FAMILY_PROP_KEYS,
  CHART_FIELD_ROLE_KEYS,
  chartTypeAcceptsColumns,
  chartTypesReading,
} from "../authoring";
import { CHART_DEFAULT_PROPS, computeChartScene } from "../computeChartScene";
import {
  CHART_FORMS,
  CHART_ROLE_DEFS,
  CHART_ROLE_KEYS,
  chartActiveForm,
  chartColumnsOfRows,
  chartRoleLabel,
  reconcileChartRoles,
  resolveChartRoleDefaults,
  standardizeChartSample,
  validateChartRoles,
} from "../roles";
import type { ChartProps, ChartType } from "../types";
import { SERIES_CHART_TYPES } from "../types";
import { loadChartFamily } from "../families/registry";

const props = (patch: Partial<ChartProps>): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...patch,
});
const size = { width: 320, height: 240 };
const rows = [
  { category: "a", value: 1, series: "x" },
  { category: "b", value: 2, series: "x" },
];
const codes = (d: readonly { code: string }[] | undefined) =>
  (d ?? []).map((x) => x.code);

describe("ADR-312 G2 — 역할 표 · 형태 (정적)", () => {
  it("36 항목 전부 형태가 있고 형태마다 역할이 있다 · 역할은 표에 있다", () => {
    expect(CHART_DESCRIPTORS).toHaveLength(36);
    for (const d of CHART_DESCRIPTORS) {
      expect(d.forms.length, d.paletteId).toBeGreaterThan(0);
      for (const form of d.forms) {
        expect(form.roles.length, `${d.paletteId}/${form.id}`).toBeGreaterThan(
          0,
        );
        for (const use of form.roles)
          expect(CHART_ROLE_KEYS, `${d.paletteId}.${use.role}`).toContain(
            use.role,
          );
      }
      // 형태 id 는 종류 안에서 겹치지 않는다
      expect(new Set(d.forms.map((f) => f.id)).size).toBe(d.forms.length);
    }
  });

  it("key 문법 — 핵심 넷이 아니면 `Field` · `Fields` 로 끝난다 (본문 Decision 3)", () => {
    const core = new Set(["dimension", "metric", "color", "valueFields"]);
    for (const def of CHART_ROLE_DEFS) {
      if (core.has(def.key)) continue;
      expect(def.key, def.key).toMatch(
        def.kind === "fields" ? /Fields$/ : /Field$/,
      );
    }
    expect(new Set(CHART_ROLE_KEYS).size).toBe(CHART_ROLE_KEYS.length);
  });

  it("F2 — 기존 9 항목도 역할 표에 있다 (group 형태에 `dimension` · `metric` 필수 · `color` 선택)", () => {
    const series = CHART_DESCRIPTORS.filter((d) => d.family === null);
    expect(series).toHaveLength(9);
    for (const d of series) {
      const group = d.forms.find((f) => f.id === "group")!;
      const req = (key: string) =>
        group.roles.find((u) => u.role === key)?.required;
      expect(
        [req("dimension"), req("metric"), req("color")],
        d.paletteId,
      ).toEqual([true, true, false]);
    }
  });

  it("columns 를 받는 종류 = 형태 표 (pie · radial 제외 · parallel 은 columns 하나)", () => {
    const accepting = (Object.keys(CHART_FORMS) as ChartType[]).filter(
      chartTypeAcceptsColumns,
    );
    expect(accepting.sort()).toEqual(
      [
        "area",
        "bar",
        "line",
        "parallel",
        "radar",
        "scatter",
        "skyline",
        "stream",
      ].sort(),
    );
    expect(CHART_FORMS.parallel.map((f) => f.id)).toEqual(["columns"]);
    // ADR-312 Phase 2 — 역할의 유무로 바뀌던 형태는 `dataMode` 값으로 (첫 형태 = 미설정)
    expect(CHART_FORMS.histogram.map((f) => f.id)).toEqual(["group", "binned"]);
    expect(CHART_FORMS.bump.map((f) => f.id)).toEqual(["ranked", "group"]);
    expect(CHART_FORMS.slope.map((f) => f.id)).toEqual(["group", "pair"]);
    // 형태가 하나면 dataMode 와 무관하게 그 형태다
    expect(
      chartActiveForm({ chartType: "parallel", dataMode: "group" }).id,
    ).toBe("columns");
  });

  it("전달 목록 = 역할 표 + 옵션 (기존 시리즈 prop 제외) — 손 목록 없음", () => {
    const expected = new Set(
      [
        ...CHART_ROLE_KEYS,
        ...CHART_DESCRIPTORS.flatMap((d) => d.options),
      ].filter(
        (k) =>
          !(k in CHART_DEFAULT_PROPS) &&
          !["color", "dataMode", "valueFields"].includes(k),
      ),
    );
    expect(new Set(CHART_FAMILY_PROP_KEYS)).toEqual(expected);
    expect(CHART_FIELD_ROLE_KEYS).toEqual(
      CHART_ROLE_DEFS.filter((d) => d.kind === "field").map((d) => d.key),
    );
  });

  it("역할을 읽는 종류 — 시리즈 종류도 형태에서 나온다 (`SERIES_TYPES` 덧붙이기 없음)", () => {
    expect(chartTypesReading("dimension")).toEqual(
      expect.arrayContaining([...SERIES_CHART_TYPES, "calendar", "box"]),
    );
    expect(chartTypesReading("dimension")).not.toContain("gauge");
    expect(chartTypesReading("metric")).not.toContain("dumbbell");
    expect(chartTypesReading("sizeField")).toEqual(["scatter"]);
  });

  it("종류 · 형태별 라벨", () => {
    expect(chartRoleLabel({ chartType: "scatter" }, "dimension")).toBe("X");
    expect(chartRoleLabel({ chartType: "scatter" }, "metric")).toBe("Y");
    expect(chartRoleLabel({ chartType: "bar" }, "dimension")).toBe("Category");
    expect(chartRoleLabel({ chartType: "calendar" }, "dimension")).toBe("Date");
    expect(chartRoleLabel({ chartType: "slope" }, "dimension")).toBe("Period");
    expect(
      chartRoleLabel({ chartType: "slope", dataMode: "pair" }, "color"),
    ).toBe("Item");
    expect(chartRoleLabel({ chartType: "candlestick" }, "metric")).toBe(
      "Close",
    );
    expect(chartRoleLabel({ chartType: "box" }, "dimension")).toBe("Groups");
  });
});

describe("ADR-312 — 공통 역할 검증 (`validateChartRoles`)", () => {
  it("유효한 입력은 진단 0 — 기존 scene 그대로 (HC2)", () => {
    expect(validateChartRoles(props({ color: "series" }), rows)).toEqual([]);
  });

  it("R5 — 시리즈 경로: 필수 역할의 열이 행에 없으면 「No data」 가 아니라 `role.missing` 설정 오류", () => {
    const scene = computeChartScene(props({ metric: "amount" }), rows, size);
    expect(scene.empty).toBe(true);
    expect(codes(scene.diagnostics)).toContain("role.missing");
    expect(
      scene.diagnostics?.find((d) => d.code === "role.missing")?.value,
    ).toBe("metric");
  });

  it("선택 역할 (`color`) 의 열이 없으면 진단 없음 — 그리던 대로", () => {
    expect(validateChartRoles(props({ color: "nope" }), rows)).toEqual([]);
  });

  it("숫자 역할에 숫자가 없으면 `role.notNumeric` 경고", () => {
    const d = validateChartRoles(props({ metric: "category" }), rows);
    expect(d).toEqual([
      expect.objectContaining({
        code: "role.notNumeric",
        severity: "warning",
        value: "metric",
      }),
    ]);
  });

  it("행이 0 이면 열을 판정하지 않는다 (로딩 · 빈 결과 · 아직 등록되지 않은 `#id`)", () => {
    expect(validateChartRoles(props({ metric: "#unregistered" }), [])).toEqual(
      [],
    );
  });

  it("형태를 따른다 — columns 의 bar 는 `metric` 을 보지 않는다 · 목록 필수 역할이 비면 `role.missing`", () => {
    expect(
      validateChartRoles(
        props({ dataMode: "columns", valueFields: ["value"], metric: "nope" }),
        rows,
      ),
    ).toEqual([]);
    expect(
      codes(
        validateChartRoles(
          props({ chartType: "treemap", pathFields: [], metric: "value" }),
          rows,
        ),
      ),
    ).toEqual(["role.missing"]);
  });
});

describe("ADR-312 Phase 2 — 기본 열 이름 (Decision 8) · 표본 표준화 (결정 3)", () => {
  it("필수 역할은 값이 없으면 기본 열 이름 — 열이 없으면 `role.missing`", async () => {
    await loadChartFamily("kpi");
    const p = resolveChartRoleDefaults(
      { ...CHART_DEFAULT_PROPS, chartType: "dumbbell" } as ChartProps,
      [{ category: "a", start: 1, end: 2 }],
    );
    expect([p.startField, p.endField]).toEqual(["start", "end"]);
    const missing = computeChartScene(
      { ...CHART_DEFAULT_PROPS, chartType: "dumbbell" } as ChartProps,
      [{ category: "a", before: 1, after: 2 }],
      size,
    );
    expect(codes(missing.diagnostics)).toContain("role.missing");
  });

  it("선택 역할은 그 열이 있을 때만 기본 열 이름 · 빈 글자는 해제로 둔다", () => {
    const base = { ...CHART_DEFAULT_PROPS, chartType: "scatter" } as ChartProps;
    expect(resolveChartRoleDefaults(base, rows).sizeField).toBeUndefined();
    expect(
      resolveChartRoleDefaults(base, [{ ...rows[0], size: 3 }]).sizeField,
    ).toBe("size");
    expect(
      resolveChartRoleDefaults({ ...base, sizeField: "" }, [
        { ...rows[0], size: 3 },
      ]).sizeField,
    ).toBe("");
  });

  it("형태가 `dataMode` 로 바뀐다 — histogram binned 의 필수 역할이 기본 열 이름으로 채워진다", () => {
    const p = resolveChartRoleDefaults(
      {
        ...CHART_DEFAULT_PROPS,
        chartType: "histogram",
        dataMode: "binned",
      } as ChartProps,
      [{ binStart: 0, binEnd: 10, count: 3 }],
    );
    expect([p.binStartField, p.binEndField, p.countField]).toEqual([
      "binStart",
      "binEnd",
      "count",
    ]);
  });

  it("표본 표준화 — 열 이름을 한 번에 바꾸고 (treemap 의 겹치는 이름) 이름으로 읽히는 역할 값 · 읽지 않는 역할 · 하나뿐인 형태의 dataMode 를 지운다", () => {
    const treemap = standardizeChartSample(
      "treemap",
      [{ category: "A", product: "x", share: 1 }],
      { pathFields: ["category", "product"], metric: "share" },
    );
    expect(treemap.rows).toEqual([{ group: "A", category: "x", value: 1 }]);
    expect(treemap.props).toEqual({});
    const parallel = standardizeChartSample(
      "parallel",
      [{ model: "m", a: 1, b: 2 }],
      {
        dimension: "category",
        dataMode: "columns",
        valueFields: ["a", "b"],
        labelField: "model",
      },
    );
    expect(parallel.rows).toEqual([{ label: "m", a: 1, b: 2 }]);
    expect(parallel.props).toEqual({ valueFields: ["a", "b"] });
    const gauge = standardizeChartSample("gauge", [{ label: "g", value: 1 }], {
      dimension: "label",
      goalField: "target",
      centerLabel: "Goal",
    });
    expect(gauge.props).toEqual({ centerLabel: "Goal" });
  });
});

describe("ADR-312 G6 — 원천이 바뀔 때의 역할 (`reconcileChartRoles`)", () => {
  const collection = [
    { key: "status", id: "f-status", type: "string" as const },
    { key: "date", id: "f-date", type: "date" as const },
    { key: "points", id: "f-points", type: "number" as const },
  ];
  it("표본과 열 이름이 다른 컬렉션 — 필수 역할이 형이 맞는 첫 열 (`#id`), 선택 역할은 없는 열이면 그대로", () => {
    expect(
      reconcileChartRoles({ props: { chartType: "bar" }, columns: collection }),
    ).toEqual({ dimension: "#f-status", metric: "#f-points" });
  });
  it("다시 연결 — 가리키는 열이 있으면 지정을 둔다 (patch 없음)", () => {
    expect(
      reconcileChartRoles({
        props: { chartType: "bar", dimension: "#f-date", metric: "#f-points" },
        columns: collection,
      }),
    ).toEqual({});
  });
  it("묶고 합친 보기 (`points` → `total`) — 결과 schema 의 집계 열을 key 로", () => {
    expect(
      reconcileChartRoles({
        props: {
          chartType: "bar",
          dimension: "#f-status",
          metric: "#f-points",
        },
        columns: [
          { key: "status", id: "f-status", type: "string" },
          { key: "total", type: "number" },
        ],
      }),
    ).toEqual({ metric: "total" });
  });
  it("날짜 열이 첫 열이 아닌 컬렉션을 calendar 에 — `dimension` = 날짜 열", () => {
    expect(
      reconcileChartRoles({
        props: { chartType: "calendar" },
        columns: collection,
      }),
    ).toEqual({ dimension: "#f-date", metric: "#f-points" });
  });
  it("해제 — 표본 지정으로 되돌린다 (parallel 의 값 열 목록 · 기본 열 이름 역할은 지움)", () => {
    expect(
      reconcileChartRoles({
        props: { chartType: "parallel", valueFields: ["#f-points"] },
        columns: chartColumnsOfRows([{ label: "m", price: 1, weight: 2 }]),
        sample: { valueFields: ["price", "weight"] },
      }),
    ).toEqual({ valueFields: ["price", "weight"] });
    expect(
      reconcileChartRoles({
        props: {
          chartType: "bar",
          dimension: "#f-status",
          metric: "#f-points",
        },
        columns: chartColumnsOfRows([{ category: "a", value: 1, series: "A" }]),
        sample: {},
      }),
    ).toEqual({ dimension: undefined, metric: undefined });
  });
  it("해제 — 사용자가 표본 열을 바꾼 차트는 형이 맞는 표본 열로", () => {
    expect(
      reconcileChartRoles({
        props: {
          chartType: "bar",
          dimension: "#f-status",
          metric: "#f-points",
        },
        columns: chartColumnsOfRows([{ name: "a", amount: 1 }]),
        sample: {},
      }),
    ).toEqual({ dimension: "name", metric: "amount" });
  });
});
