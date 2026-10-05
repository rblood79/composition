import {
  readDataBindingRows,
  resolveComponentRule,
  type ResolvedField,
} from "@composition/shared";
import {
  CHART_DEFAULT_SERIES_COUNT,
  resolveChartPalette,
  type ChartRow,
} from "@composition/rendering";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useI18n } from "../../../i18n";
import { useCollections } from "../../stores/data";
import { ChartAuthoringControls } from "./ChartAuthoringControls";
import { ChartBudgetControls } from "./ChartBudgetControls";
import { ChartDataMappingControls } from "./ChartDataMappingControls";
import { buildChartSemanticFields } from "./chartFieldOptions";
import { ChartNumberFormatControls } from "./ChartNumberFormatControls";
import {
  chartColumnCandidates,
  chartPresentationPatch,
} from "./chartPresentationPatch";
import { ChartReferenceLineControls } from "./ChartReferenceLineControls";
import {
  ChartSeriesControls,
  chartSeriesConfigApplies,
} from "./ChartSeriesControls";
import { ChartTimeAxisControls } from "./ChartTimeAxisControls";

/**
 * ADR-210 컨트롤 3개가 읽는 필드 — `buildSeriesGrid`/`resolveChartPresentation` 입력 + 종류/색 축.
 * 이 밖의 필드 (showGrid · 크기 …) 변경은 컨트롤을 다시 그리지 않는다.
 */
const CHART_CONTROL_FIELD_KEYS: ReadonlySet<string> = new Set([
  "chartType",
  "dimension",
  "metric",
  "color",
  "colorBy",
  "stackType",
  "dataMode",
  "valueFields",
  "seriesConfig",
  "valueFormat",
  "valueLocale",
  "valueFractionDigits",
  "valueCurrency",
  "valuePercentUnit",
  // ADR-211 — 표시 예산 4 키 (ChartBudgetControls).
  "budgetOverflow",
  "budgetAggregate",
  "budgetAxis",
  "budgetOthersLabel",
  // 예산 metrics (행 상한 · 문구) 는 size 별이다 — 없으면 sm · lg 에서도 md 로 풀었다.
  "size",
  // ADR-216 — 시간축 3 키 (ChartTimeAxisControls).
  "dimensionScale",
  "dimensionFormat",
  "dimensionLabelFormat",
  // ADR-217 — 기준선 (ChartReferenceLineControls).
  "referenceLines",
  "dataBinding",
]);
const EMPTY_FIELDS: ResolvedField[] = [];
const EMPTY_ROWS: readonly ChartRow[] = [];
const LITERAL_OPTION_FIELDS = ["dimension", "metric", "color"];

export interface ChartPropertyExtras {
  /** The fields to render (a Chart's options filled from its data). */
  fields: ResolvedField[];
  contentExtras: ReactNode;
  sectionExtras?: Record<string, ReactNode>;
  literalOptionFields?: string[];
}

/**
 * The Chart editor's extra controls (ADR-210/211/215/216/217) around the generic fields — shared
 * by the old and the catalog Properties panels. Every control writes through `onPatch`; a Chart
 * control's patch keeps only what changed (arrays compared by meaning). Other types pass through.
 */
export function useChartPropertyExtras({
  elementId,
  elementType,
  contractFields,
  semanticFields: baseFields,
  contentExtras,
  onPatch,
  isRefInstance,
}: {
  elementId: string;
  elementType: string;
  /** The whole contract (current values of every field). */
  contractFields: readonly ResolvedField[];
  /** The semantic fields shown (before Chart options). */
  semanticFields: ResolvedField[];
  contentExtras?: ReactNode;
  onPatch: (patch: Record<string, unknown>) => void;
  /** A reusable instance (the series array's explicit pin button shows). */
  isRefInstance: boolean;
}): ChartPropertyExtras {
  const { t } = useI18n();
  const collections = useCollections();
  const isChart = elementType === "Chart";
  const semanticFields = useMemo(
    () =>
      isChart
        ? buildChartSemanticFields(baseFields, collections, {
            none: t("chart.none"),
            columnQualifier: t("chart.columnQualifier"),
          })
        : baseFields,
    [baseFields, collections, isChart, t],
  );
  const chartValues = isChart
    ? Object.fromEntries(
        contractFields.map((field) => [field.key, field.currentValue]),
      )
    : {};
  // ADR-210 P4 — Chart 전용 컨트롤은 **자기 입력이 바뀔 때만** 다시 그린다 (contract 는 매 편집마다
  //   새 객체다 — frame A/B 실측으로 longtask 가 2배였다).
  const dataBindingKey = JSON.stringify(chartValues.dataBinding ?? null);
  const chartControlKey = isChart
    ? JSON.stringify(
        contractFields
          .filter((field) => CHART_CONTROL_FIELD_KEYS.has(field.key))
          .map((field) => [
            field.key,
            field.currentValue,
            field.isOverridden,
            field.options,
          ]),
      )
    : "";
  const chartControlFields = useMemo(
    () =>
      isChart
        ? semanticFields.filter((field) =>
            CHART_CONTROL_FIELD_KEYS.has(field.key),
          )
        : EMPTY_FIELDS,
    // semanticFields 는 contract 마다 새 배열 — 실제 의존은 chartControlKey 다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartControlKey, isChart],
  );
  const chartData = Array.isArray(chartValues.data)
    ? (chartValues.data as ChartRow[])
    : null;
  const chartRows: readonly ChartRow[] = useMemo(
    () =>
      chartValues.dataBinding
        ? (readDataBindingRows(
            chartValues.dataBinding,
            collections,
          ) as ChartRow[])
        : (chartData ?? EMPTY_ROWS),
    // dataBinding 객체는 contract 마다 새 참조 — 직렬화 키로 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataBindingKey, collections, chartData],
  );
  // baseline 은 ref 로 읽어 콜백 참조를 요소당 하나로 고정한다 (컨트롤 memo 유지). 커밋 뒤에
  //   기록한다 — 폐기된 transition 렌더의 값이 남지 않게.
  const chartValuesRef = useRef(chartValues);
  useLayoutEffect(() => {
    chartValuesRef.current = chartValues;
  });
  const handleChartPatch = useCallback(
    (patch: Record<string, unknown>, force?: readonly string[]) => {
      const changed = chartPresentationPatch(
        chartValuesRef.current,
        patch,
        force,
      );
      if (Object.keys(changed).length > 0) onPatch(changed);
    },
    [onPatch],
  );
  const chartColumns = useMemo(
    () =>
      isChart
        ? chartColumnCandidates(
            { dataBinding: chartValues.dataBinding, data: chartData },
            collections,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isChart, dataBindingKey, chartData, collections],
  );
  if (!isChart) return { fields: semanticFields, contentExtras };
  // ADR-215 — 선택된 팔레트의 길이. Series 섹션 색 Select 의 순번 후보 수.
  const chartPaletteLength =
    resolveChartPalette(
      resolveComponentRule("Chart")?.chart,
      typeof chartValues.palette === "string" ? chartValues.palette : undefined,
    ).length || CHART_DEFAULT_SERIES_COUNT;
  // 섹션 자리 (ADR-210/211): Content = 정체 + 데이터 / Series = 시리즈별 레코드 (적용되지 않는
  //   종류에서는 열지 않는다) / Appearance 말미 = 숫자 형식 / Interaction 말미 = 표시 예산.
  const seriesApplies = chartSeriesConfigApplies(
    chartControlFields,
    chartRows,
    chartPaletteLength,
  );
  return {
    fields: semanticFields,
    literalOptionFields: LITERAL_OPTION_FIELDS,
    contentExtras: (
      <>
        {contentExtras}
        <ChartAuthoringControls fields={semanticFields} onPatch={onPatch} />
        {/* 로컬 상태 (선택 화면 · pending 통화) 는 요소마다 새로 시작한다 (`useOwnedState`). */}
        <ChartDataMappingControls
          elementId={elementId}
          fields={chartControlFields}
          columns={chartColumns}
          onPatch={handleChartPatch}
        />
        <ChartTimeAxisControls
          fields={chartControlFields}
          rows={chartRows}
          onPatch={handleChartPatch}
        />
        <ChartReferenceLineControls
          fields={chartControlFields}
          onPatch={handleChartPatch}
        />
      </>
    ),
    sectionExtras: {
      series: seriesApplies ? (
        <ChartSeriesControls
          elementId={elementId}
          fields={chartControlFields}
          rows={chartRows}
          paletteLength={chartPaletteLength}
          isRefInstance={isRefInstance}
          onPatch={handleChartPatch}
        />
      ) : undefined,
      appearance: (
        <ChartNumberFormatControls
          elementId={elementId}
          fields={chartControlFields}
          onPatch={handleChartPatch}
        />
      ),
      interaction: (
        <ChartBudgetControls
          elementId={elementId}
          fields={chartControlFields}
          rows={chartRows}
          sourceRowCount={chartRows.length}
          onPatch={handleChartPatch}
        />
      ),
    },
  };
}
