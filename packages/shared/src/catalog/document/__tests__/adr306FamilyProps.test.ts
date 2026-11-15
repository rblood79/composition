/**
 * ADR-306 G3 (R2) — family 종류의 새 prop 이 세 소비자에 같은 목록 하나로 닿는다
 * (binding `accepts` · `propPassthrough` · DOM destructure · Skia allowlist — breakdown §4.5).
 * 정적 검사: `accepts` 의 Chart key 집합 = 기존 목록 ∪ `CHART_FAMILY_PROP_KEYS`.
 */
import { readFileSync } from "node:fs";
import {
  CHART_DESCRIPTORS,
  CHART_FAMILY_PROP_KEYS,
  pickChartFamilyProps,
} from "@composition/rendering";
import { describe, expect, it } from "vitest";
import { chartBinding } from "../../bindings/Chart.binding";

/** Phase 1 뒤의 Chart accepts (ADR-306 전 목록 — 이 위에 family 키만 더해진다). */
const BEFORE = [
  "chartType",
  "dimension",
  "metric",
  "color",
  "dataMode",
  "valueFields",
  "seriesConfig",
  "valueFormat",
  "valueLocale",
  "valueFractionDigits",
  "valueCurrency",
  "valuePercentUnit",
  "budgetOverflow",
  "budgetAggregate",
  "budgetAxis",
  "budgetOthersLabel",
  "dimensionScale",
  "dimensionFormat",
  "dimensionLabelFormat",
  "referenceLines",
  "dataBinding",
  "data",
  "orientation",
  "stackType",
  "curve",
  "showDots",
  "showValueLabels",
  "labelKey",
  "palette",
  "colorBy",
  "innerRadius",
  "gridType",
  "startAngle",
  "endAngle",
  "showTotal",
  "showSpokes",
  "gridRings",
  "fillGrid",
  "fillArea",
  "showTooltip",
  "showAxis",
  "showGrid",
  "showLegend",
  "legendPosition",
  "isAnimationActive",
  "animationBegin",
  "animationDuration",
  "animationEasing",
];

describe("ADR-306 G3 — family prop 전달 목록 하나 (R2)", () => {
  it("kpi · category · distribution · matrix 역할 · 옵션 키 목록", () => {
    expect([...CHART_FAMILY_PROP_KEYS].sort()).toEqual(
      [
        "goalField",
        "rangeFields",
        "startField",
        "endField",
        "valueMin",
        "valueMax",
        "centerLabel",
        "shape",
        "bands",
        "independent",
        "sort",
        "includeZero",
        // Phase 3 — category family.
        "kindField",
        "rankField",
        "frontFields",
        "cells",
        "columns",
        "showRates",
        "rateBase",
        "rateLabel",
        "threshold",
        "rankLabels",
        "startTotal",
        "endTotal",
        "connectors",
        "showExtremes",
        "streamOffset",
        "reorder",
        "periodLabels",
        "depth",
        "wall",
        "texture",
        "frontRate",
        // Phase 4 — distribution · matrix family.
        "binStartField",
        "binEndField",
        "countField",
        "percentiles",
        "edges",
        "binWidth",
        "bins",
        "log",
        "kde",
        "outliers",
        "whiskers",
        "labelField",
        "dotRadius",
        "showMedian",
        "overlap",
        "bandwidth",
        "rowField",
        "legendLabels",
        "weekStart",
        "cellGap",
        "openField",
        "highField",
        "lowField",
        "closeField",
        "volumeField",
        "movingAverages",
        "invertFields",
      ].sort(),
    );
  });

  it("accepts 의 Chart key 집합 = 기존 목록 ∪ CHART_FAMILY_PROP_KEYS", () => {
    expect(Object.keys(chartBinding.props.accepts).sort()).toEqual(
      [...new Set([...BEFORE, ...CHART_FAMILY_PROP_KEYS])].sort(),
    );
  });

  it("chartType 선택지 = descriptor 의 종류 전부 (Phase 마다 빠지지 않게 — 판독 Phase 4)", () => {
    const options = (chartBinding.props.accepts.chartType.options ?? []).map(
      (o) => o.value,
    );
    expect([...options].sort()).toEqual(
      [...new Set(CHART_DESCRIPTORS.map((d) => d.chartType))].sort(),
    );
  });

  it("종류마다 뜻이 다른 공유 키는 binding 기본값이 없다 (정의 기본값은 모든 종류의 해석 props 에 들어간다)", () => {
    for (const key of ["threshold", "valueMin"])
      expect(chartBinding.props.accepts[key]?.default, key).toBeUndefined();
  });

  it("propPassthrough 가 같은 목록을 싣는다", () => {
    for (const key of CHART_FAMILY_PROP_KEYS)
      expect(chartBinding.props.propPassthrough ?? []).toContain(key);
  });

  it("DOM · Skia 는 같은 목록 (상수) 을 읽는다 — 손으로 적은 사본이 없다", () => {
    const dom = readFileSync(
      new URL("../../../components/Chart.components.tsx", import.meta.url),
      "utf8",
    );
    expect(dom).toMatch(/CHART_FAMILY_PROP_KEYS/);
    expect(dom).toMatch(/pickChartFamilyProps\(rest\)/);
    const skia = readFileSync(
      new URL(
        "../../../../../rendering/src/renderers/skiaPrimitives.ts",
        import.meta.url,
      ),
      "utf8",
    );
    expect(skia).toMatch(/\.\.\.pickChartFamilyProps\(props\)/);
    // 미설정 키는 싣지 않는다.
    expect(
      pickChartFamilyProps({ goalField: "t", startField: undefined }),
    ).toEqual({ goalField: "t" });
  });

  it("역할 표 하나 — descriptor roles 의 field 역할은 accepts 에 collection 으로 있다", () => {
    for (const d of CHART_DESCRIPTORS)
      for (const role of d.roles) {
        const contract = chartBinding.props.accepts[role.prop];
        expect(contract, `${d.chartType}.${role.prop}`).toBeTruthy();
        expect(contract.section).toBe("collection");
        expect(contract.kind).toBe(
          role.kind === "fields" ? "string-array" : "string",
        );
      }
  });
});
