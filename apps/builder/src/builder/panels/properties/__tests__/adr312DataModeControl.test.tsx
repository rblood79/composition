import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResolvedField } from "@composition/shared";
import { I18nProvider } from "@/i18n";
import { ChartDataMappingControls } from "../ChartDataMappingControls";

/**
 * ADR-312 Phase 1 — 원천 모드 칸 (`Series source`) 은 형태가 둘 이상인 종류에만 선다. parallel 은 값 열
 * 목록 형태 하나라 칸 없이 값 열 목록만 (본문 F6 「읽지 않는 토글」). `dataMode` 는 binding 기본값
 * (`group`) 이 실려 오므로 저장값으로 판정하지 않는다 — columns 로 저장된 pie 만 되돌리는 칸을 낸다 (ADR-210).
 */
const field = (key: string, currentValue: unknown) =>
  ({
    key,
    currentValue,
    origin: "semantic",
    kind: "value",
    isOverridden: true,
  }) as unknown as ResolvedField;

function renderControls(props: Record<string, unknown>) {
  return render(
    <I18nProvider initialLocale="en-US">
      <ChartDataMappingControls
        fields={Object.entries(props).map(([k, v]) => field(k, v))}
        columns={null}
        onPatch={() => {}}
      />
    </I18nProvider>,
  );
}

describe("ADR-312 — 원천 모드 칸은 형태 표에서", () => {
  it("parallel (형태 하나) — 모드 칸 없이 값 열 목록 (binding 기본 dataMode group 이어도)", () => {
    renderControls({
      chartType: "parallel",
      dataMode: "group",
      valueFields: ["price", "weight"],
    });
    expect(screen.queryByText("Series source")).toBeNull();
    expect(screen.getByText("price")).toBeTruthy();
    expect(screen.getByText("weight")).toBeTruthy();
  });

  it("bar (형태 둘) — 모드 칸이 선다", () => {
    renderControls({ chartType: "bar", dataMode: "group" });
    expect(screen.getAllByText("Series source").length).toBeGreaterThan(0);
  });

  it("columns 로 저장된 pie — 되돌리는 칸이 선다 (columns 항목은 막힘)", () => {
    renderControls({ chartType: "pie", dataMode: "columns" });
    expect(screen.getAllByText("Series source").length).toBeGreaterThan(0);
    expect(screen.getByText(/Value columns are not available/)).toBeTruthy();
  });

  // ADR-312 Phase 5 live — 형태 표에 columns 가 없는 종류 (bump) 에 pie · radial 안내가 붙었다.
  it("bump (순위 · 값 형태) — 모드 칸은 서지만 pie · radial 안내는 없다", () => {
    renderControls({ chartType: "bump" });
    expect(screen.getAllByText("Series source").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Value columns are not available/)).toBeNull();
  });

  it("group 의 pie — 모드 칸 없음", () => {
    renderControls({ chartType: "pie", dataMode: "group" });
    expect(screen.queryByText("Series source")).toBeNull();
  });
});
