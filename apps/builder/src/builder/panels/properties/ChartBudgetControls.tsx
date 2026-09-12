import "./ChartAuthoringControls.css";
import { memo, useDeferredValue, useMemo } from "react";
import {
  CHART_DEFAULT_PROPS,
  CHART_TYPES,
  resolveChartMetrics,
  resolveChartModel,
  supportsBudgetMode,
} from "@composition/specs";
import type {
  ChartBudgetAggregate,
  ChartBudgetAxis,
  ChartBudgetOverflow,
  ChartProps,
  ChartRow,
  ChartType,
} from "@composition/specs";
import { resolveComponentRule } from "@composition/shared";
import type { ResolvedField } from "@composition/shared";
import { PropertyInput, PropertySelect } from "../../components";
import { useI18n } from "@/i18n";
import { resolvePropertyFieldIcon } from "../../config/propertyFieldIcons";

const chartIcon = (key: string, kind: string) =>
  resolvePropertyFieldIcon(key, kind, "Chart");
import { useLayoutValue } from "../styles/hooks/useLayoutValue";

const EMPTY_ROWS: readonly ChartRow[] = [];

const OVERFLOWS: readonly ChartBudgetOverflow[] = [
  "auto",
  "window",
  "aggregate",
  "extrema",
  "others",
];
const AGGREGATES: readonly ChartBudgetAggregate[] = [
  "sum",
  "mean",
  "max",
  "min",
];
const AXES: readonly ChartBudgetAxis[] = ["auto", "category", "ordinal"];
// ADR-217 — scatter 도 직교 (창 · 극값).
const CARTESIAN: readonly string[] = ["bar", "line", "area", "scatter"];

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * ADR-211 P3 — 표시 예산 4 키 (breakdown §2.4 · §2.6 · §2.7).
 *
 * 키마다 **스칼라 교체** (`valueFormat` 과 같은 규칙) — 공통 `chartPresentationPatch` 의
 * `===` 비교로 같은 값 재적용은 write 0. 지원표 밖 조합 (pie + window 등) 은 항목을
 * 비활성화하고 사유를 둔다 — validator 가 거부하는 값을 조용히 저장하지 않는다. 집계·축은
 * 직교 차트에서만 뜻이 있고, 묶음 라벨은 others 가 적용되는 곳 (극좌표 · bar 명시) 에서만.
 * 라벨 입력이 비면 키를 지운다 (영문 상수 "Other" 로 돌아간다 — §2.7).
 *
 * 자리는 Interaction 섹션 말미 (레퍼런스에 대응 개념이 없는 composition 고유 설정 — 가장
 * 가까운 Recharts `Brush` 가 상호작용 층). 예산 적용 상태 (창/집계/… · 행 상한 초과) 는
 * overflow 필드의 상태 문구 (`slot="description"`) 로 붙는다 — 정적 안내 문단은 두지 않는다.
 */
export const ChartBudgetControls = memo(function ChartBudgetControls({
  elementId,
  fields,
  rows = EMPTY_ROWS,
  sourceRowCount = 0,
  onPatch,
}: {
  /** 선택 요소 — Canvas 가 그린 크기 (layout map) 로 예산 상태를 푼다 */
  elementId?: string;
  fields: ResolvedField[];
  /** Canvas 와 같은 입력 행 (예산 상태용) */
  rows?: readonly ChartRow[];
  sourceRowCount?: number;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  ) as Record<string, unknown>;
  // ADR-211 — 예산 상태는 **Canvas 와 같은 모델** (`resolveChartModel`, 창 0) 을 Canvas 가 그린
  //   크기 (엔진 layout map — `buildSpecNodeData` 의 `_containerWidth/Height` 와 같은 값) 와 같은
  //   rule 채널 metrics 로 푼다. 행 상한 `R` 도 같은 metrics 다. props 는 직렬화 키로 memo —
  //   fields 는 contract 마다 새 배열이라 20,000 행 모델을 op 마다 다시 풀지 않는다.
  //   크기는 리사이즈 드래그 동안 layout publish 마다 바뀌므로 갱신은 뒤로 미룬다 (deferred).
  const width = useDeferredValue(useLayoutValue(elementId, "width"));
  const height = useDeferredValue(useLayoutValue(elementId, "height"));
  const sizeKey = String(props.size ?? "md").toLowerCase();
  const chartPropsKey = JSON.stringify(
    Object.fromEntries(
      Object.entries(props).filter(
        ([key, value]) =>
          key !== "dataBinding" && key !== "data" && value !== undefined,
      ),
    ),
  );
  const budgetState = useMemo(() => {
    const metrics = resolveChartMetrics(
      resolveComponentRule("Chart")?.chart,
      sizeKey,
    );
    const rowCap = metrics.rowCap;
    if (!width || !height || rows.length === 0) return { rowCap, model: null };
    const effective: ChartProps = {
      ...CHART_DEFAULT_PROPS,
      ...(JSON.parse(chartPropsKey) as Partial<ChartProps>),
    };
    return {
      rowCap,
      model: resolveChartModel(rows, effective, {
        size: { width, height },
        metrics,
        windowStart: 0,
      }),
    };
  }, [rows, chartPropsKey, width, height, sizeKey]);
  const { rowCap } = budgetState;
  const budget = budgetState.model?.budget;
  const budgetText =
    budget && budgetState.model?.presentation.ok
      ? budget.n > budget.fitEff
        ? t("chart.budgetHint", {
            fitEff: budget.fitEff,
            n: budget.n,
            mode:
              budget.applied === "window"
                ? t("chart.budgetModeWindow")
                : budget.applied === "aggregate"
                  ? t("chart.budgetModeAggregate", {
                      aggregate: budget.aggregate,
                    })
                  : budget.applied === "extrema"
                    ? t("chart.budgetModeExtrema")
                    : t("chart.budgetModeOthers"),
          })
        : t("chart.budgetFits", { n: budget.n })
      : null;
  const chartType = pick<ChartType>(props.chartType, CHART_TYPES, "bar");
  const overflow = pick(props.budgetOverflow, OVERFLOWS, "auto");
  const aggregate = pick(props.budgetAggregate, AGGREGATES, "sum");
  const axis = pick(props.budgetAxis, AXES, "auto");
  const cartesian = CARTESIAN.includes(chartType);
  const unsupported = OVERFLOWS.filter(
    (mode) => mode !== "auto" && !supportsBudgetMode(chartType, mode),
  );
  const othersApplies = !cartesian || overflow === "others";
  const overflowLabel: Record<ChartBudgetOverflow, string> = {
    auto: t("chart.overflowAuto"),
    window: t("chart.overflowWindow"),
    aggregate: t("chart.overflowAggregate"),
    extrema: t("chart.overflowExtrema"),
    others: t("chart.overflowOthers"),
  };
  const aggregateLabel: Record<ChartBudgetAggregate, string> = {
    sum: t("chart.aggregateSum"),
    mean: t("chart.aggregateMean"),
    max: t("chart.aggregateMax"),
    min: t("chart.aggregateMin"),
  };
  const axisLabel: Record<ChartBudgetAxis, string> = {
    auto: t("chart.axisAuto"),
    category: t("chart.axisCategory"),
    ordinal: t("chart.axisOrdinal"),
  };
  return (
    <>
      <PropertySelect
        label={t("chart.budgetOverflow")}
        icon={chartIcon("budgetOverflow", "enum")}
        value={overflow}
        options={OVERFLOWS.map((mode) => ({
          value: mode,
          label: overflowLabel[mode],
        }))}
        translateOptions={false}
        disabledKeys={unsupported}
        onChange={(value) => {
          const next = pick(value, OVERFLOWS, "auto");
          if (unsupported.includes(next)) return;
          if (next !== overflow) onPatch({ budgetOverflow: next });
        }}
        afterControl={
          unsupported.includes(overflow) ||
          budgetText ||
          sourceRowCount > rowCap ? (
            <span
              slot="description"
              role="status"
              data-chart-budget-hint={
                budget ? (budget.overflow ? budget.applied : "fits") : undefined
              }
            >
              {[
                unsupported.includes(overflow)
                  ? t("chart.overflowUnsupported")
                  : null,
                sourceRowCount > rowCap
                  ? t("chart.rowCapHint", {
                      cap: rowCap,
                      total: sourceRowCount,
                    })
                  : null,
                budgetText,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : undefined
        }
      />
      {cartesian && (
        <PropertySelect
          label={t("chart.budgetAggregate")}
          icon={chartIcon("budgetAggregate", "enum")}
          value={aggregate}
          options={AGGREGATES.map((stat) => ({
            value: stat,
            label: aggregateLabel[stat],
          }))}
          translateOptions={false}
          onChange={(value) => {
            const next = pick(value, AGGREGATES, "sum");
            if (next !== aggregate) onPatch({ budgetAggregate: next });
          }}
        />
      )}
      {cartesian && (
        <PropertySelect
          label={t("chart.budgetAxis")}
          icon={chartIcon("budgetAxis", "enum")}
          value={axis}
          options={AXES.map((kind) => ({
            value: kind,
            label: axisLabel[kind],
          }))}
          translateOptions={false}
          onChange={(value) => {
            const next = pick(value, AXES, "auto");
            if (next !== axis) onPatch({ budgetAxis: next });
          }}
        />
      )}
      {othersApplies && (
        <PropertyInput
          label={t("chart.othersLabel")}
          icon={chartIcon("budgetOthersLabel", "string")}
          value={
            typeof props.budgetOthersLabel === "string"
              ? props.budgetOthersLabel
              : ""
          }
          placeholder={t("chart.othersLabelPlaceholder")}
          onChange={(text) => {
            const trimmed = text.trim();
            const current =
              typeof props.budgetOthersLabel === "string"
                ? props.budgetOthersLabel
                : undefined;
            const next = trimmed === "" ? undefined : trimmed;
            if (next !== current) onPatch({ budgetOthersLabel: next });
          }}
        />
      )}
    </>
  );
});
