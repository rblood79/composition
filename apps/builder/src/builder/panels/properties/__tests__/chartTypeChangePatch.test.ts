/**
 * ADR-306 판독 MEDIUM — Value Columns 모드의 Chart 를 family 종류로 바꾸면 Value 칸 (`metric`, group
 * 모드에서만 보임) 을 고를 길이 없었다 (family 는 모드 전환 컨트롤을 내지 않는다). 전환이 group 으로
 * 되돌린다.
 */
import { describe, expect, it } from "vitest";
import { chartTypeChangePatch } from "../ChartAuthoringControls";

describe("ADR-306 — 종류 변경 patch", () => {
  it("columns 모드에서 family 종류로 바꾸면 group 으로", () => {
    expect(chartTypeChangePatch({ dataMode: "columns" }, "gauge")).toEqual({
      chartType: "gauge",
      dataMode: "group",
    });
  });
  it("시리즈 종류끼리 · group 모드는 종류만", () => {
    expect(chartTypeChangePatch({ dataMode: "columns" }, "line")).toEqual({
      chartType: "line",
    });
    expect(chartTypeChangePatch({ dataMode: "group" }, "bullet")).toEqual({
      chartType: "bullet",
    });
  });
});
