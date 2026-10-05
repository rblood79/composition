import { renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import { useChartPropertyExtras } from "../useChartPropertyExtras";

/**
 * 2026-10-05 감사 LOW — 예산 상태 문구 (ChartBudgetControls) 는 Chart 의 size 로 metrics 를 푼다.
 * size 가 컨트롤 필드에 없으면 sm · lg 에서도 md 기준 행 상한·문구가 나왔다.
 */
type Field = Parameters<typeof useChartPropertyExtras>[0]["semanticFields"][number];
const field = (key: string, currentValue: unknown) =>
  ({ key, currentValue, origin: "semantic", kind: "value", isOverridden: true }) as unknown as Field;

describe("useChartPropertyExtras — 예산 컨트롤의 size", () => {
  it("ChartBudgetControls 가 size 필드를 받는다", () => {
    const fields = [field("chartType", "bar"), field("size", "lg")];
    const { result } = renderHook(
      () =>
        useChartPropertyExtras({
          elementId: "el-1",
          elementType: "Chart",
          contractFields: fields,
          semanticFields: fields,
          onPatch: () => {},
          isRefInstance: false,
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <I18nProvider initialLocale="en-US">{children}</I18nProvider>
        ),
      },
    );
    const budget = result.current.sectionExtras?.interaction as ReactElement<{
      fields: Field[];
    }>;
    expect(budget.props.fields.find((f) => f.key === "size")?.currentValue).toBe("lg");
  });
});
