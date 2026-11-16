import {
  readDataBindingRows,
  resolveComponentRule,
  type ResolvedField,
} from "@composition/shared";
import {
  CHART_DEFAULT_SERIES_COUNT,
  chartForms,
  chartTypeAcceptsColumns,
  chartTypeReadsDates,
  isFamilyChartType,
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
import { useOptionalCatalogWorkspace } from "../../catalogRuntime/react.runtime";
import { chartBindingColumns } from "../../catalogRuntime/chartRoleReconcile";
import { buildChartSemanticFields } from "./chartFieldOptions";
import type { PanelField } from "./generic/GenericFieldRenderer";
import { ChartNumberFormatControls } from "./ChartNumberFormatControls";
import {
  chartColumnCandidates,
  chartPresentationPatch,
} from "./chartPresentationPatch";
import { ChartReferenceLineControls } from "./ChartReferenceLineControls";
import { ChartAnnotationControls } from "./ChartAnnotationControls";
import {
  ChartSeriesControls,
  chartSeriesConfigApplies,
} from "./ChartSeriesControls";
import {
  ChartDateFormatControl,
  ChartTimeAxisControls,
} from "./ChartTimeAxisControls";

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
  // ADR-216 — 시간축 3 키 (ChartTimeAxisControls).
  "dimensionScale",
  "dimensionFormat",
  "dimensionLabelFormat",
  // ADR-217 — 기준선 (ChartReferenceLineControls).
  "referenceLines",
  // ADR-306 Phase 6 — 주석 (ChartAnnotationControls).
  "annotations",
  "dataBinding",
]);
const EMPTY_FIELDS: ResolvedField[] = [];
const EMPTY_ROWS: readonly ChartRow[] = [];

export interface ChartPropertyExtras {
  /** The fields to render (a Chart's options filled from its data). */
  fields: PanelField[];
  contentExtras: ReactNode;
  sectionExtras?: Record<string, ReactNode>;
  /** Controls at a section's start, after its Data source (a Chart's mode · value fields · time axis). */
  sectionLeads?: Record<string, ReactNode>;
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
  // ADR-312 F14 — 연결한 Chart 의 열 선택지는 보기의 결과 schema (묶기 · 집계면 묶음 열 + 집계 이름). 바인딩이
  //   바뀌면 contract 의 `dataBinding` 값이 바뀌어 다시 읽는다.
  const workspace = useOptionalCatalogWorkspace();
  const bindingKey = JSON.stringify(
    baseFields.find((field) => field.key === "dataBinding")?.currentValue ??
      null,
  );
  const sourceColumns = useMemo(() => {
    void bindingKey;
    if (!isChart || !workspace) return undefined;
    const graph = workspace.runtime.graph;
    const node = graph.getEntry(elementId as never);
    const binding = node?.kind === "node" ? node.binding : undefined;
    return binding ? chartBindingColumns(graph, binding) : undefined;
  }, [bindingKey, elementId, isChart, workspace]);
  const semanticFields = useMemo(
    () =>
      isChart
        ? buildChartSemanticFields(
            baseFields,
            collections,
            {
              none: t("chart.none"),
              columnQualifier: t("chart.columnQualifier"),
            },
            sourceColumns,
          )
        : baseFields,
    [baseFields, collections, isChart, sourceColumns, t],
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
  // ADR-215 — 선택된 팔레트의 길이. Series 섹션 색 Select 의 순번 후보 수.
  const chartPaletteLength = isChart
    ? resolveChartPalette(
        resolveComponentRule("Chart")?.chart,
        typeof chartValues.palette === "string"
          ? chartValues.palette
          : undefined,
      ).length || CHART_DEFAULT_SERIES_COUNT
    : 0;
  // 섹션 자리 (ADR-210/211 · 사용자 결정 2026-11-12 「Property 탭 섹션 병합」 5단계): Content = 정체 (종류 ·
  //   기준선) / Collection = Data source → 모드 · 값 필드 · 시간축 → 축 필드 (목록과 같은 섹션) / Series = 시리즈별 레코드 (적용되지 않는
  //   종류에서는 열지 않는다) / Appearance 말미 = 숫자 형식 / Interaction 말미 = 표시 예산.
  //   family 의 항목 목록은 행 전체를 읽으므로 자기 입력이 바뀔 때만 다시 계산한다 (편집마다 아님).
  const seriesApplies = useMemo(
    () =>
      isChart &&
      chartSeriesConfigApplies(
        chartControlFields,
        chartRows,
        chartPaletteLength,
      ),
    [isChart, chartControlFields, chartRows, chartPaletteLength],
  );
  if (!isChart) return { fields: semanticFields, contentExtras };
  // ADR-306 — family 종류 (gauge · bullet · dumbbell …) 는 시리즈 격자를 지나지 않는다: 시리즈 원천 ·
  //   값 필드 · 범주 간격 · 기준선 · 표시 예산은 읽지 않으니 내지 않는다 (숫자 형식 · 시리즈 표만 공유).
  //   값 필드 목록 (columns 모드) 을 읽는 family (stream · slope · skyline) 만 원천 모드 · 값 필드를 낸다.
  // ADR-312 — 형태가 둘 이상이거나 값 열 목록을 읽는 종류 (parallel) 만 원천 모드 · 값 열 컨트롤, 범주가 날짜인
  //   종류 (calendar · candlestick) 는 날짜 입력 형식 (Decision 9 — 시간 축과 같은 parser).
  const showMapping =
    chartForms(chartValues.chartType).length > 1 ||
    chartTypeAcceptsColumns(chartValues.chartType);
  const showDateFormat = chartTypeReadsDates(chartValues.chartType);
  if (isFamilyChartType(chartValues.chartType))
    return {
      fields: semanticFields,
      contentExtras: (
        <>
          {contentExtras}
          <ChartAuthoringControls fields={semanticFields} onPatch={onPatch} />
        </>
      ),
      ...(showMapping || showDateFormat
        ? {
            sectionLeads: {
              collection: (
                <>
                  {showMapping && (
                    <ChartDataMappingControls
                      elementId={elementId}
                      fields={chartControlFields}
                      columns={chartColumns}
                      onPatch={handleChartPatch}
                    />
                  )}
                  {showDateFormat && (
                    <ChartDateFormatControl
                      fields={chartControlFields}
                      onPatch={handleChartPatch}
                    />
                  )}
                </>
              ),
            },
          }
        : {}),
      sectionExtras: {
        // ADR-312 Phase 4 — 시리즈 표시 표를 읽는 family (stream · bump · skyline · marimekko · segmented ·
        //   waffle · dumbbell · histogram 묶음 · slope · parallel 축 이름) 도 Series 섹션을 연다.
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
      },
    };
  return {
    fields: semanticFields,
    contentExtras: (
      <>
        {contentExtras}
        <ChartAuthoringControls fields={semanticFields} onPatch={onPatch} />
        <ChartReferenceLineControls
          fields={chartControlFields}
          onPatch={handleChartPatch}
        />
        <ChartAnnotationControls
          fields={chartControlFields}
          onPatch={handleChartPatch}
        />
      </>
    ),
    sectionLeads: {
      collection: (
        <>
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
        </>
      ),
    },
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
