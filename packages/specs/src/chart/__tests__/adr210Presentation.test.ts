/**
 * ADR-210 P1 / G1 — 표시 설정 validator·identity·숫자 형식 (T03 identity · T05 format · T08 진단).
 *
 * 기대값은 손계산 또는 Intl 의 알려진 출력이다 — helper 출력끼리 비교하지 않는다.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_AUTO_NUMBER_FORMAT,
  formatChartNumber,
  isSupportedCurrency,
  parseSeriesIdentity,
  resolveChartPresentation,
  seriesIdentity,
  seriesTokenIndex,
  seriesTokenName,
  resolveChartPalette,
} from "../presentation";
import type { ResolvedNumberFormat } from "../presentation";
import { formatTick } from "../scales";
import type { ChartProps } from "../types";

const resolve = (props: Partial<ChartProps>, palette = 8) =>
  resolveChartPresentation(props as ChartProps, palette);
const codes = (props: Partial<ChartProps>) =>
  resolve(props).diagnostics.map((d) => `${d.severity}:${d.code}`);

describe("ADR-210 identity — seriesConfig.key 는 JSON 배열이라 원본 키와 충돌하지 않는다 (T03)", () => {
  it("group/field 를 구분하고 왕복한다 — 빈 그룹·따옴표·쉼표·reset·series0 포함", () => {
    for (const key of ["", "reset", "series0", 'a"b', "x,y", "a.b", "1"]) {
      for (const source of ["group", "field"] as const) {
        const id = seriesIdentity(source, key);
        expect(id.startsWith("[")).toBe(true);
        expect(parseSeriesIdentity(id)).toEqual({ source, key });
      }
    }
    // 같은 키라도 원천이 다르면 다른 identity — 숫자 1 그룹과 필드 "1" 은 다른 시리즈다.
    expect(seriesIdentity("group", "1")).not.toBe(seriesIdentity("field", "1"));
  });

  it("형식이 아닌 문자열은 그룹 키로 추정하지 않는다 (null)", () => {
    expect(parseSeriesIdentity("desktop")).toBeNull();
    expect(parseSeriesIdentity('["group"]')).toBeNull();
    expect(parseSeriesIdentity('["other","x"]')).toBeNull();
    expect(parseSeriesIdentity("[1,2]")).toBeNull();
  });
});

describe("ADR-210 팔레트 토큰 — --chart-series-N ⇔ 인덱스 N-1 전단사", () => {
  it("이름 ↔ 인덱스 왕복, 팔레트 밖·형식 밖은 null", () => {
    expect(seriesTokenName(0)).toBe("--chart-series-1");
    expect(seriesTokenIndex("--chart-series-1", 8)).toBe(0);
    expect(seriesTokenIndex("--chart-series-8", 8)).toBe(7);
    expect(seriesTokenIndex("--chart-series-9", 8)).toBeNull();
    expect(seriesTokenIndex("--chart-series-0", 8)).toBeNull();
    expect(seriesTokenIndex("--chart-series-01", 8)).toBeNull();
    expect(seriesTokenIndex("#ff0000", 8)).toBeNull();
    expect(seriesTokenIndex("var(--chart-series-1)", 8)).toBeNull();
    expect(seriesTokenIndex(1, 8)).toBeNull();
  });
});

describe("ADR-210 validator — 기본값·중복·오류 (T08)", () => {
  it("새 키가 전혀 없으면 group·auto·en-US 이고 진단 0 (기존 문서 동작)", () => {
    const r = resolve({});
    expect(r).toMatchObject({
      dataMode: "group",
      valueFields: [],
      seriesConfig: [],
      numberFormat: { format: "auto", locale: "en-US" },
      diagnostics: [],
      ok: true,
    });
    expect(r.numberFormat).toEqual(CHART_AUTO_NUMBER_FORMAT);
  });

  it("columns 에 valueFields 가 비어 있으면 error — legacy metric 으로 fallback 하지 않는다", () => {
    expect(codes({ dataMode: "columns" })).toEqual(["error:valueFields.empty"]);
    expect(codes({ dataMode: "columns", valueFields: [] })).toEqual([
      "error:valueFields.empty",
    ]);
    expect(resolve({ dataMode: "columns", valueFields: [] }).ok).toBe(false);
  });

  it("중복 valueFields 는 first-wins + warning, 원본은 그대로", () => {
    const props = {
      dataMode: "columns",
      valueFields: ["a", "b", "a"],
    } as const;
    const r = resolve(props);
    expect(r.valueFields).toEqual(["a", "b"]);
    expect(codes(props)).toEqual(["warning:valueFields.duplicate"]);
    expect(r.ok).toBe(true);
    expect(props.valueFields).toEqual(["a", "b", "a"]);
  });

  it("columns + pie/radial 은 unsupported error (임의 fallback 0)", () => {
    for (const chartType of ["pie", "radial"] as const) {
      expect(
        codes({ dataMode: "columns", valueFields: ["a"], chartType }),
      ).toEqual(["error:columns.unsupportedChartType"]);
    }
    for (const chartType of ["bar", "line", "area", "radar"] as const) {
      expect(
        codes({ dataMode: "columns", valueFields: ["a"], chartType }),
      ).toEqual([]);
    }
  });

  it("columns bar + colorBy category 는 error — 조용히 series 로 바꾸지 않는다", () => {
    expect(
      codes({
        dataMode: "columns",
        valueFields: ["a"],
        chartType: "bar",
        colorBy: "category",
      }),
    ).toEqual(["error:columns.colorByCategory"]);
    // group 모드의 범주색은 기존 동작 그대로 (진단 0).
    expect(codes({ chartType: "bar", colorBy: "category" })).toEqual([]);
  });

  it("group 모드에서 휴면 valueFields/seriesConfig 는 진단 없이 보존된다", () => {
    const r = resolve({
      dataMode: "group",
      valueFields: ["desktop", "mobile"],
      seriesConfig: [{ key: seriesIdentity("field", "desktop"), label: "D" }],
    });
    expect(r.diagnostics).toEqual([]);
    expect(r.valueFields).toEqual(["desktop", "mobile"]);
    expect(r.seriesConfig).toEqual([
      { key: seriesIdentity("field", "desktop"), label: "D" },
    ]);
  });

  it("seriesConfig — 중복 key first-wins(warning), 잘못된 토큰은 warning 후 제거, 잘못된 형식은 error", () => {
    const k = seriesIdentity("group", "A");
    const r = resolve({
      seriesConfig: [
        { key: k, label: "first", colorToken: "--chart-series-3" },
        { key: k, label: "second" },
        { key: seriesIdentity("group", "B"), colorToken: "#f00" },
      ],
    });
    expect(r.seriesConfig).toEqual([
      { key: k, label: "first", paletteIndex: 2 },
      { key: seriesIdentity("group", "B") },
    ]);
    expect(r.diagnostics.map((d) => d.code)).toEqual([
      "seriesConfig.duplicateKey",
      "seriesConfig.colorToken.invalid",
    ]);
    expect(r.ok).toBe(true);

    expect(codes({ seriesConfig: [{ key: "desktop" }] })).toEqual([
      "error:seriesConfig.invalid",
    ]);
    expect(
      codes({ seriesConfig: [{ key: k, label: 3 as unknown as string }] }),
    ).toEqual(["error:seriesConfig.invalid"]);
    expect(codes({ seriesConfig: "x" as unknown as [] })).toEqual([
      "error:seriesConfig.invalid",
    ]);
  });

  it("빈 문자열 label 은 명시적 빈 이름으로 보존된다 (속성 부재와 다르다)", () => {
    const k = seriesIdentity("group", "A");
    const r = resolve({
      seriesConfig: [
        { key: k, label: "" },
        { key: seriesIdentity("group", "B") },
      ],
    });
    expect(Object.hasOwn(r.seriesConfig[0], "label")).toBe(true);
    expect(r.seriesConfig[0].label).toBe("");
    expect(Object.hasOwn(r.seriesConfig[1], "label")).toBe(false);
  });

  it("format — currency 는 통화 코드, percent 는 입력 단위가 없으면 error (추정 금지)", () => {
    expect(codes({ valueFormat: "currency" })).toEqual([
      "error:valueCurrency.missing",
    ]);
    expect(codes({ valueFormat: "percent" })).toEqual([
      "error:valuePercentUnit.missing",
    ]);
    expect(codes({ valueFormat: "currency", valueCurrency: "USD" })).toEqual(
      [],
    );
    expect(
      codes({ valueFormat: "percent", valuePercentUnit: "ratio" }),
    ).toEqual([]);
  });

  it("format — 잘못된 enum/locale/자릿수/통화 코드는 error 이고 원본은 보존된다", () => {
    expect(codes({ valueFormat: "money" as never })).toEqual([
      "error:valueFormat.invalid",
    ]);
    expect(codes({ valueLocale: "fr-FR" as never })).toEqual([
      "error:valueLocale.invalid",
    ]);
    expect(codes({ valueFractionDigits: 7 })).toEqual([
      "error:valueFractionDigits.invalid",
    ]);
    expect(codes({ valueFractionDigits: 1.5 })).toEqual([
      "error:valueFractionDigits.invalid",
    ]);
    expect(codes({ valueFractionDigits: -1 })).toEqual([
      "error:valueFractionDigits.invalid",
    ]);
    // 휴면 (format 이 currency/percent 가 아님) 형식 오류는 warning, 활성이면 error.
    expect(codes({ valueCurrency: "ABCD" })).toEqual([
      "warning:valueCurrency.unsupported",
    ]);
    expect(codes({ valueFormat: "currency", valueCurrency: "ABCD" })).toEqual([
      "error:valueCurrency.unsupported",
    ]);
    expect(codes({ valuePercentUnit: "points" as never })).toEqual([
      "warning:valuePercentUnit.invalid",
    ]);
    expect(
      codes({ valueFormat: "percent", valuePercentUnit: "points" as never }),
    ).toEqual(["error:valuePercentUnit.invalid"]);
    expect(codes({ dataMode: "wide" as never })).toEqual([
      "error:dataMode.invalid",
    ]);
    expect(codes({ valueFields: "a" as never })).toEqual([
      "error:valueFields.invalid",
    ]);
    const props = { valueCurrency: "ABCD" };
    resolve(props);
    expect(props.valueCurrency).toBe("ABCD");
  });

  it("통화 코드는 대소문자를 정규화하고 Intl 지원 목록으로 검사한다", () => {
    expect(isSupportedCurrency("usd")).toBe(true);
    expect(isSupportedCurrency("KRW")).toBe(true);
    expect(isSupportedCurrency("US")).toBe(false);
    expect(isSupportedCurrency(840)).toBe(false);
    expect(
      resolve({ valueFormat: "currency", valueCurrency: "krw" }).numberFormat
        .currency,
    ).toBe("KRW");
  });
});

describe("ADR-210 formatChartNumber — raw/normalizedPercent (T05)", () => {
  const nf = (o: Partial<ResolvedNumberFormat>): ResolvedNumberFormat => ({
    format: "decimal",
    locale: "en-US",
    ...o,
  });

  it("auto 는 두 context 모두 기존 formatTick 문자열 (expand 축에 % 를 소급하지 않는다)", () => {
    for (const v of [25, 1234.5, 0.256, 0, -3]) {
      expect(formatChartNumber(v, CHART_AUTO_NUMBER_FORMAT, "raw")).toBe(
        formatTick(v),
      );
      expect(
        formatChartNumber(v, CHART_AUTO_NUMBER_FORMAT, "normalizedPercent"),
      ).toBe(formatTick(v));
    }
    expect(formatChartNumber(Number.NaN, CHART_AUTO_NUMBER_FORMAT, "raw")).toBe(
      "",
    );
  });

  it("percent raw — ratio 0.25 → 25%, percentagePoints 25 → 25%; 명시 2자리면 25.00%", () => {
    expect(
      formatChartNumber(
        0.25,
        nf({ format: "percent", percentUnit: "ratio" }),
        "raw",
      ),
    ).toBe("25%");
    expect(
      formatChartNumber(
        25,
        nf({ format: "percent", percentUnit: "percentagePoints" }),
        "raw",
      ),
    ).toBe("25%");
    expect(
      formatChartNumber(
        0.25,
        nf({ format: "percent", percentUnit: "ratio", fractionDigits: 2 }),
        "raw",
      ),
    ).toBe("25.00%");
    // 기본 자릿수는 최소 0 · 최대 2 (현행 formatTick 과 동형).
    expect(
      formatChartNumber(
        0.256789,
        nf({ format: "percent", percentUnit: "ratio" }),
        "raw",
      ),
    ).toBe("25.68%");
  });

  it("normalizedPercent 25 는 단위·통화와 무관하게 항상 25% (2500%·$25 금지)", () => {
    expect(
      formatChartNumber(
        25,
        nf({ format: "percent", percentUnit: "ratio" }),
        "normalizedPercent",
      ),
    ).toBe("25%");
    expect(
      formatChartNumber(
        25,
        nf({ format: "percent", percentUnit: "percentagePoints" }),
        "normalizedPercent",
      ),
    ).toBe("25%");
    expect(
      formatChartNumber(
        25,
        nf({ format: "currency", currency: "USD" }),
        "normalizedPercent",
      ),
    ).toBe("25%");
    expect(
      formatChartNumber(25, nf({ format: "decimal" }), "normalizedPercent"),
    ).toBe("25%");
    expect(
      formatChartNumber(
        100,
        nf({ format: "decimal", locale: "ko-KR" }),
        "normalizedPercent",
      ),
    ).toBe("100%");
  });

  it("currency raw — 1234.5 는 USD $1,234.50 · KRW ₩1,235 · ko-KR USD US$1,234.50; 명시 0자리면 $1,235", () => {
    expect(
      formatChartNumber(
        1234.5,
        nf({ format: "currency", currency: "USD" }),
        "raw",
      ),
    ).toBe("$1,234.50");
    expect(
      formatChartNumber(
        1234.5,
        nf({ format: "currency", currency: "KRW" }),
        "raw",
      ),
    ).toBe("₩1,235");
    expect(
      formatChartNumber(
        1234.5,
        nf({ format: "currency", currency: "USD", locale: "ko-KR" }),
        "raw",
      ),
    ).toBe("US$1,234.50");
    expect(
      formatChartNumber(
        1234.5,
        nf({ format: "currency", currency: "USD", fractionDigits: 0 }),
        "raw",
      ),
    ).toBe("$1,235");
    expect(
      formatChartNumber(
        1234.5,
        nf({ format: "currency", currency: "EUR" }),
        "raw",
      ),
    ).toBe("€1,234.50");
  });

  it("decimal raw — locale 별 자릿수·구분자, 기본 최대 2자리, 명시 min=max", () => {
    expect(formatChartNumber(1234.5, nf({}), "raw")).toBe("1,234.5");
    expect(formatChartNumber(1234.5, nf({ locale: "ko-KR" }), "raw")).toBe(
      "1,234.5",
    );
    expect(formatChartNumber(0.256, nf({}), "raw")).toBe("0.26");
    expect(formatChartNumber(3, nf({ fractionDigits: 2 }), "raw")).toBe("3.00");
    expect(formatChartNumber(-1234.5, nf({}), "raw")).toBe("-1,234.5");
  });

  it("형식은 값을 바꾸지 않는다 — 같은 값을 여러 형식으로 찍어도 입력은 그대로 (display 만)", () => {
    const value = 0.25;
    formatChartNumber(
      value,
      nf({ format: "percent", percentUnit: "ratio" }),
      "raw",
    );
    formatChartNumber(
      value,
      nf({ format: "currency", currency: "USD" }),
      "raw",
    );
    expect(value).toBe(0.25);
  });
});

describe("ADR-215 팔레트 선택 — resolveChartPalette (Skia · generate-css · 패널 공용)", () => {
  const channel = {
    series: ["{color.chart-categorical-1}", "{color.chart-categorical-2}"],
    palettes: { mono: ["{color.chart-accent-1}", "{color.chart-accent-2}"] },
  };
  it("미설정 · categorical · 미지 id → series, mono → palettes.mono, 채널 없음 → []", () => {
    expect(resolveChartPalette(channel, undefined)).toBe(channel.series);
    expect(resolveChartPalette(channel, "categorical")).toBe(channel.series);
    expect(resolveChartPalette(channel, "nope")).toBe(channel.series);
    expect(resolveChartPalette(channel, "mono")).toBe(channel.palettes.mono);
    expect(resolveChartPalette(undefined, "mono")).toEqual([]);
  });
  it("빈 대안 배열은 기본 팔레트로 폴백 (길이 0 팔레트를 그리지 않는다)", () => {
    expect(
      resolveChartPalette({ series: channel.series, palettes: { mono: [] } }, "mono"),
    ).toBe(channel.series);
  });
});
