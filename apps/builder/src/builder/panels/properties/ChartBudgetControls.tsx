import "./ChartAuthoringControls.css";
import { memo } from "react";
import { supportsBudgetMode } from "@composition/specs";
import type {
  ChartBudgetAggregate,
  ChartBudgetAxis,
  ChartBudgetOverflow,
  ChartType,
} from "@composition/specs";
import type { ResolvedField } from "@composition/shared";
import { PropertyInput, PropertySelect } from "../../components";
import { useI18n } from "@/i18n";

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
const CARTESIAN: readonly string[] = ["bar", "line", "area"];

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
 */
export const ChartBudgetControls = memo(function ChartBudgetControls({
  fields,
  onPatch,
}: {
  fields: ResolvedField[];
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  ) as Record<string, unknown>;
  const chartType = pick<ChartType>(
    props.chartType,
    ["bar", "line", "area", "pie", "radar", "radial"],
    "bar",
  );
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
      />
      {unsupported.includes(overflow) && (
        <p className="chart-authoring-hint" role="note">
          {t("chart.overflowUnsupported")}
        </p>
      )}
      {cartesian && (
        <PropertySelect
          label={t("chart.budgetAggregate")}
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
      <p className="chart-authoring-hint">{t("chart.budgetSettingsHint")}</p>
    </>
  );
});
