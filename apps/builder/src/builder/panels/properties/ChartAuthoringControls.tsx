import "./ChartAuthoringControls.css";
import { Button } from "react-aria-components/Button";
import { memo, useDeferredValue, useMemo, useState } from "react";
import {
  CHART_DEFAULT_PROPS,
  CHART_DESCRIPTORS,
  getChartDescriptor,
  getChartPresetId,
  resolveChartMetrics,
  resolveChartModel,
} from "@composition/specs";
import type { ChartProps, ChartRow } from "@composition/specs";
import { resolveComponentRule } from "@composition/shared";
import type { ResolvedField } from "@composition/shared";
import { PropertySelect } from "../../components";
import { useI18n } from "@/i18n";
import { useLayoutValue } from "../styles/hooks/useLayoutValue";

/** ADR-210 — columns 모드가 지원하지 않는 종류 (breakdown §2.3 3). */
const COLUMNS_UNSUPPORTED_TYPES: readonly string[] = ["pie", "radial"];

const EMPTY_ROWS: readonly ChartRow[] = [];

/** 프리셋/종류 변경은 일반 필드와 같은 canonical batch writer를 한 번 호출한다. */
export const ChartAuthoringControls = memo(function ChartAuthoringControls({
  elementId,
  fields,
  rows = EMPTY_ROWS,
  onPatch,
  sourceRowCount,
}: {
  /** 선택 요소 — Canvas 가 그린 크기 (layout map) 로 예산 안내를 푼다 */
  elementId?: string;
  fields: ResolvedField[];
  /** Canvas 와 같은 입력 행 (예산 안내용) */
  rows?: readonly ChartRow[];
  sourceRowCount: number;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const [changingType, setChangingType] = useState(false);
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  );
  // ADR-211 — 예산 안내는 **Canvas 와 같은 모델** (`resolveChartModel`, 창 0) 을 Canvas 가 그린
  //   크기 (엔진 layout map — `buildSpecNodeData` 의 `_containerWidth/Height` 와 같은 값) 와 같은
  //   rule 채널 metrics 로 푼다. 행 상한 `R` 도 같은 metrics 다. props 는 직렬화 키로 memo —
  //   fields 는 contract 마다 새 배열이라 20,000 행 모델을 op 마다 다시 풀지 않는다.
  //   크기는 리사이즈 드래그 동안 layout publish 마다 바뀌므로 안내 갱신은 뒤로 미룬다 (deferred).
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
  const budgetHint = useMemo(() => {
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
  const { rowCap } = budgetHint;
  const budget = budgetHint.model?.budget;
  const budgetText =
    budget && budgetHint.model?.presentation.ok
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
  const descriptor = getChartDescriptor(props.chartType);
  const presetId = getChartPresetId(descriptor.chartType, props);
  // ADR-210 — columns 모드에서 Pie/Radial 은 지원하지 않는다: 항목을 비활성화하고 사유를
  //   둔다 (조용히 group 으로 바꾸지 않는다). group 으로 전환한 뒤에는 고를 수 있다.
  const columnsMode = props.dataMode === "columns";
  const unsupportedTypes = columnsMode ? COLUMNS_UNSUPPORTED_TYPES : undefined;
  return (
    <>
      <PropertySelect
        label="Preset"
        value={presetId}
        options={[
          ...(presetId === "custom"
            ? [{ value: "custom", label: "Custom" }]
            : []),
          ...descriptor.presets.map((preset) => ({
            value: preset.id,
            label: preset.label,
          })),
        ]}
        onChange={(value) => {
          const preset = descriptor.presets.find(
            (candidate) => candidate.id === value,
          );
          if (preset) onPatch({ ...preset.patch });
        }}
      />
      {/* 패널 라벨 액션 버튼 정본은 `.control-button` 이고 중립(취소·토글)은 무게 변형을
          지정하지 않는다 (panel-system.css · controlButton.static.test.ts).
          종전에는 RAC 기본 클래스에 `quiet` 무게를 얹었는데, 빌더 문서는 생성 CSS 를
          로드하지 않고 그 무게의 규칙도 어디에도 없어 무스타일 버튼이었다. */}
      <Button
        type="button"
        className="control-button"
        onPress={() => setChangingType((value) => !value)}
        aria-expanded={changingType}
      >
        {t("chart.changeType")}
      </Button>
      {changingType && (
        <PropertySelect
          label={t("chart.changeTarget")}
          value={descriptor.chartType}
          options={CHART_DESCRIPTORS.map((item) => ({
            value: item.chartType,
            label: item.label,
          }))}
          disabledKeys={unsupportedTypes}
          onChange={(value) => {
            if (unsupportedTypes?.includes(value)) return;
            onPatch({ chartType: value });
            setChangingType(false);
          }}
        />
      )}
      {changingType && columnsMode && (
        <p className="chart-authoring-hint" role="note">
          {t("chart.typeUnavailableInColumns")}
        </p>
      )}
      {/* ADR-211 — 행 상한 `R` 은 두 leg 동일 (rule chart 채널 `budget.rowCap`, 절단과 같은
          읽기 경로 `resolveChartMetrics`). 예산 안내는 Canvas 크기 기준 (Preview 는 자기 폭). */}
      {sourceRowCount > rowCap && (
        <p className="chart-authoring-hint" role="status">
          {t("chart.rowCapHint", { cap: rowCap, total: sourceRowCount })}
        </p>
      )}
      {budgetText && (
        <p
          className="chart-authoring-hint"
          role="status"
          data-chart-budget-hint={budget?.overflow ? budget.applied : "fits"}
        >
          {budgetText}
        </p>
      )}
      <p className="chart-authoring-hint">{t("chart.runtimeHint")}</p>
    </>
  );
});
