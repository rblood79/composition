import { describe, expect, it } from "vitest";

import { meterBinding } from "../Meter.binding";
import { getPrimitiveBinding } from "../index";
import {
  getCatalogEntry,
  getCatalogCutoverTypes,
} from "../../componentCatalog";
import { toRacProps } from "../../outputs/toRacProps";

/**
 * ADR-912 진로 1번 Meter 확장 (value-fill compound catalog 발효, ProgressBar 동형, 2026-06-08).
 *
 * Meter 는 factory 3자식(Label/MeterValue/MeterTrack) compound → DOM 은 rendererMap.renderMeter
 * 위임(DELEGATING_INTERNAL_RENDERERS, ProgressBar/Tabs 선례). Skia 는 shell-only + 자식 MeterTrack
 * value_fill_bar escape(선행-2 발효, variant 4색). ProgressBar 와 차이 = variant 4색·isIndeterminate
 * 부재. 본 test 는 binding 등록 정합 + cutover 게이트 진입 + toRacProps prop 투영 + isIndeterminate
 * 부재를 고정한다.
 */
describe("Meter binding — value-fill compound (ProgressBar 동형, internal wrapper 위임)", () => {
  it("PRIMITIVE_BINDINGS 에 등록 + internal source renderer='meter'", () => {
    expect(getPrimitiveBinding("Meter")).toBe(meterBinding);
    expect(meterBinding.source.kind).toBe("internal");
    expect(
      meterBinding.source.kind === "internal"
        ? meterBinding.source.renderer
        : null,
    ).toBe("meter");
  });

  it("부모 자체 skiaPrimitive 없음 (자식 MeterTrack value_fill_bar 담당)", () => {
    expect(meterBinding.skiaPrimitive).toBeUndefined();
  });

  it("catalog entry 등록 + cutover='catalog' 게이트 진입", () => {
    const entry = getCatalogEntry("Meter");
    expect(entry?.type).toBe("Meter");
    expect(entry?.kind).toBe("primitive");
    expect([...getCatalogCutoverTypes()]).toContain("Meter");
  });

  it("accepts: value/minValue/maxValue/label/variant/size/showValueLabel — isIndeterminate 부재", () => {
    const a = meterBinding.props.accepts;
    expect(a.value?.kind).toBe("number");
    expect(a.minValue?.kind).toBe("number");
    expect(a.maxValue?.kind).toBe("number");
    expect(a.label?.kind).toBe("string");
    expect(a.variant?.kind).toBe("variant");
    expect(a.size?.kind).toBe("size");
    expect(a.showValueLabel?.kind).toBe("boolean");
    // ProgressBar 와 차이: Meter 는 isIndeterminate 부재 (측정값은 항상 확정)
    expect(a.isIndeterminate).toBeUndefined();
  });

  it("variant default = informative (ProgressBar default 와 차이 — 4색 상태)", () => {
    expect(meterBinding.props.accepts.variant?.default).toBe("informative");
  });

  it("toRacProps: value(number) React prop 통과, variant/size 는 data-attr 라우팅", () => {
    const node = {
      id: "x",
      type: "Meter",
      props: { value: 60, size: "lg", variant: "positive", label: "M" },
    };
    const rac = toRacProps(node as never, meterBinding);
    // value/label 은 React prop (renderMeter 가 소비)
    expect(rac.value).toBe(60);
    expect(rac.label).toBe("M");
    // variant/size 는 data-attr (RAC unstyled + generated CSS)
    expect(rac["data-size"]).toBe("lg");
    expect(rac["data-variant"]).toBe("positive");
  });
});
