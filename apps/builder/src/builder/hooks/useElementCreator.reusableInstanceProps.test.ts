/**
 * ADR-228 §3.2 (리뷰 H1) — reusable instance 의 초기 props = 호출자가 명시한 initialProps 중
 * origin 유효값과 **다른 키만** (명시 patch). `chartType` 은 진입점 정체라 값이 같아도 보존.
 * 팔레트 (`useElementCreator` ref 분기) 와 AI (`compositeCreation`) 가 같은 함수를 쓴다.
 */
import { describe, expect, it } from "vitest";
import { buildReusableInstanceProps } from "./useElementCreator";

const origin = {
  chartType: "bar",
  showGrid: false,
  showLegend: true,
  size: "md",
  style: { width: 320 },
  data: [{ category: "Mon", value: 1 }],
};

describe("buildReusableInstanceProps", () => {
  it("initialProps 없음 → {} (전부 origin 상속)", () => {
    expect(buildReusableInstanceProps(undefined, origin)).toEqual({});
  });

  it("origin 과 같은 값은 버리고 다른 값만 남긴다 (배열·객체는 JSON 동치)", () => {
    expect(
      buildReusableInstanceProps(
        {
          showGrid: true,
          showLegend: true,
          size: "md",
          data: [{ category: "Mon", value: 1 }],
          style: { width: 320 },
        },
        origin,
      ),
    ).toEqual({ showGrid: true });
  });

  it("chartType 은 origin 과 같아도 명시 보존 (진입점 정체)", () => {
    expect(
      buildReusableInstanceProps({ chartType: "bar", size: "md" }, origin),
    ).toEqual({ chartType: "bar" });
    expect(buildReusableInstanceProps({ chartType: "pie" }, origin)).toEqual({
      chartType: "pie",
    });
  });

  it("origin 에 없는 키는 그대로 patch 다", () => {
    expect(
      buildReusableInstanceProps({ orientation: "horizontal" }, origin),
    ).toEqual({ orientation: "horizontal" });
  });

  it("origin props 를 모르면 (문서에 origin 없음) initialProps 전체를 patch 로 둔다", () => {
    expect(
      buildReusableInstanceProps({ chartType: "bar", size: "md" }, undefined),
    ).toEqual({ chartType: "bar", size: "md" });
  });
});
