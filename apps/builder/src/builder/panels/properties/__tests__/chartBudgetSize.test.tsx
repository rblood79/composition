import { renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import { useChartPropertyExtras } from "../useChartPropertyExtras";

/**
 * 2026-10-05 감사 LOW — 예산 상태 문구 (ChartBudgetControls) 는 Chart 의 size 로 metrics 를 풀었다.
 * ADR-306 Phase 1 — 공개 size 축 삭제: metrics 는 rule 한 벌이라 예산 컨트롤은 size 를 받지 않는다
 *   (옛 문서의 size 값이 남아 있어도 넘기지 않는다 — 그런 문서는 contract 로 거부된다).
 */
type Field = Parameters<
  typeof useChartPropertyExtras
>[0]["semanticFields"][number];
const field = (key: string, currentValue: unknown) =>
  ({
    key,
    currentValue,
    origin: "semantic",
    kind: "value",
    isOverridden: true,
  }) as unknown as Field;

describe("useChartPropertyExtras — 예산 컨트롤의 size", () => {
  it("ChartBudgetControls 는 size 필드를 받지 않는다 (ADR-306)", () => {
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
    expect(budget.props.fields.some((f) => f.key === "chartType")).toBe(true);
    expect(budget.props.fields.some((f) => f.key === "size")).toBe(false);
  });
});
