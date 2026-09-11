/**
 * ADR-210 P2 — 새 표시 설정 8키의 DOM 투영 (`toRacProps` 는 accepts 키만 투영한다).
 *
 * P0 inventory 의 함정: accepts 미선언은 DOM 쪽만 조용히 깨진다 (Skia 는 scene-node props
 * 를 직접 읽어 멀쩡). 그래서 선언·통과·기본값 채움을 여기서 고정한다. old 305e4c4f7 은
 * 같은 입력에서 5키를 전부 떨어뜨렸다 (P1 evidence §3).
 */
import { describe, expect, it } from "vitest";
import { getPrimitiveBinding } from "../bindings";
import { toRacProps } from "../outputs/toRacProps";

const KEYS = [
  "dataMode",
  "valueFields",
  "seriesConfig",
  "valueFormat",
  "valueLocale",
  "valueFractionDigits",
  "valueCurrency",
  "valuePercentUnit",
] as const;

describe("ADR-210 Chart binding — 표시 설정 투영", () => {
  const binding = getPrimitiveBinding("Chart")!;

  it("8키 전부 accepts 와 propPassthrough 에 있다", () => {
    for (const key of KEYS) {
      expect(binding.props.accepts[key], key).toBeDefined();
      expect(binding.props.propPassthrough, key).toContain(key);
    }
  });

  it("저장된 값은 그대로 통과하고 (배열 포함) 미설정은 default 만 채운다 (dataMode/valueFormat)", () => {
    const props = {
      chartType: "bar",
      dimension: "month",
      metric: "",
      dataMode: "columns",
      valueFields: ["desktop", "mobile"],
      seriesConfig: [
        {
          key: '["field","mobile"]',
          label: "",
          colorToken: "--chart-series-5",
        },
      ],
      valueFormat: "currency",
      valueCurrency: "USD",
      valueFractionDigits: 0,
    };
    const out = toRacProps({ id: "c", type: "Chart", props } as never, binding);
    expect(out).toMatchObject(props);
    // 미설정 키: locale/단위는 default 가 없어 투영되지 않는다 (specs 가 en-US/미설정으로 읽는다).
    expect(out.valueLocale).toBeUndefined();
    expect(out.valuePercentUnit).toBeUndefined();

    const bare = toRacProps(
      { id: "c", type: "Chart", props: { chartType: "bar" } } as never,
      binding,
    );
    expect(bare.dataMode).toBe("group");
    expect(bare.valueFormat).toBe("auto");
    expect(bare.valueFields).toBeUndefined();
    expect(bare.seriesConfig).toBeUndefined();
  });

  // ADR-211 — 예산 4키 (breakdown §2.6 결선 inventory: accepts → toRacProps → Chart.tsx → Skia allowlist).
  it("ADR-211 예산 4키가 accepts·propPassthrough 에 있고 저장값은 통과, 미설정은 enum default 만 채운다", () => {
    for (const key of [
      "budgetOverflow",
      "budgetAggregate",
      "budgetAxis",
      "budgetOthersLabel",
    ] as const) {
      expect(binding.props.accepts[key], key).toBeDefined();
      expect(binding.props.accepts[key].editorHidden, key).toBe(true);
      expect(binding.props.propPassthrough, key).toContain(key);
    }
    const props = {
      chartType: "line",
      budgetOverflow: "extrema",
      budgetAggregate: "mean",
      budgetAxis: "ordinal",
      budgetOthersLabel: "기타",
    };
    const out = toRacProps({ id: "c", type: "Chart", props } as never, binding);
    expect(out).toMatchObject(props);
    const bare = toRacProps(
      { id: "c", type: "Chart", props: { chartType: "pie" } } as never,
      binding,
    );
    expect(bare.budgetOverflow).toBe("auto");
    expect(bare.budgetAggregate).toBe("sum");
    expect(bare.budgetAxis).toBe("auto");
    expect(bare.budgetOthersLabel).toBeUndefined();
  });

  // ADR-216 — 시간축 3키 (breakdown §2.5 결선 inventory).
  it("ADR-216 시간축 3키가 accepts·propPassthrough 에 있고 저장값은 통과, 미설정은 enum default (category) 만 채운다", () => {
    for (const key of [
      "dimensionScale",
      "dimensionFormat",
      "dimensionLabelFormat",
    ] as const) {
      expect(binding.props.accepts[key], key).toBeDefined();
      expect(binding.props.accepts[key].editorHidden, key).toBe(true);
      expect(binding.props.propPassthrough, key).toContain(key);
    }
    const props = {
      chartType: "line",
      dimensionScale: "time",
      dimensionFormat: "%Y/%m/%d",
      dimensionLabelFormat: "%m/%d",
    };
    const out = toRacProps({ id: "c", type: "Chart", props } as never, binding);
    expect(out).toMatchObject(props);
    const bare = toRacProps(
      { id: "c", type: "Chart", props: { chartType: "line" } } as never,
      binding,
    );
    expect(bare.dimensionScale).toBe("category");
    expect(bare.dimensionFormat).toBeUndefined();
    expect(bare.dimensionLabelFormat).toBeUndefined();
  });

  it("columns 모드에서 metric/color/colorBy 는 편집 화면에서 숨고 (visibleWhen) 투영은 유지된다", () => {
    for (const key of ["metric", "color", "colorBy"] as const) {
      expect(binding.props.accepts[key].visibleWhen).toBeDefined();
    }
    const out = toRacProps(
      {
        id: "c",
        type: "Chart",
        props: {
          chartType: "bar",
          dataMode: "columns",
          valueFields: ["a"],
          metric: "legacy",
          color: "s",
        },
      } as never,
      binding,
    );
    expect(out.metric).toBe("legacy");
    expect(out.color).toBe("s");
  });
});
