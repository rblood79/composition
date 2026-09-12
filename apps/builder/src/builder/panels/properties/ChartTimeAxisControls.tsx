import { memo, useMemo } from "react";
import {
  CHART_DEFAULT_PROPS,
  CHART_DEFAULT_SERIES_COUNT,
  buildSeriesGrid,
  resolveAxisKind,
  resolveChartPresentation,
} from "@composition/specs";
import type {
  ChartDimensionScale,
  ChartProps,
  ChartRow,
} from "@composition/specs";
import type { ResolvedField } from "@composition/shared";
import { PropertyInput, PropertySelect } from "../../components";
import { useI18n } from "@/i18n";
import { resolvePropertyFieldIcon } from "../../config/propertyFieldIcons";

const chartIcon = (key: string, kind: string) =>
  resolvePropertyFieldIcon(key, kind, "Chart");

const EMPTY_ROWS: readonly ChartRow[] = [];
const SCALES: readonly ChartDimensionScale[] = ["category", "time"];
// ADR-217 — scatter 도 시간 x 를 받는다 (linear 가 기본).
const TIME_TYPES: readonly string[] = ["line", "area", "scatter"];
const TIME_KEY: readonly string[] = ["time"];

/**
 * ADR-216 P4 — 범주 축 스케일 (`dimensionScale`) 과 시간 지시자 (`dimensionFormat` ·
 * `dimensionLabelFormat`). 자리는 Content 섹션의 데이터 매핑 (`dimension`) 바로 아래.
 *
 * - 시간축은 line/area 만 — 다른 종류에서는 `time` 항목을 비활성화하고 사유를 둔다 (validator 가
 *   거부하는 값을 조용히 저장하지 않는다).
 * - 자동 감지 힌트 (R5): category 스케일에서 범주가 전부 엄격 ISO 날짜면 (`resolveAxisKind`
 *   ordinal) 안내 문자열만 붙인다 — scene 은 바꾸지 않는다 (자동 전환 아님).
 * - 파싱 실패 행 수는 Canvas 와 같은 `buildSeriesGrid` 로 센다 (크기 불요) — 상태 문구.
 * - 지시자 입력이 비면 키를 지운다 (미설정 = ISO / 2단 표).
 */
export const ChartTimeAxisControls = memo(function ChartTimeAxisControls({
  fields,
  rows = EMPTY_ROWS,
  onPatch,
}: {
  fields: ResolvedField[];
  rows?: readonly ChartRow[];
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  ) as Record<string, unknown>;
  const chartType = String(props.chartType ?? CHART_DEFAULT_PROPS.chartType);
  const timeApplies = TIME_TYPES.includes(chartType);
  // ADR-217 — 산점도에는 범주 스케일이 없다: 미설정/`category` 의 표시 이름은 "숫자" (해석 = linear).
  const scatter = chartType === "scatter";
  const scale: ChartDimensionScale =
    props.dimensionScale === "time" ? "time" : "category";
  const format =
    typeof props.dimensionFormat === "string" ? props.dimensionFormat : "";
  const labelFormat =
    typeof props.dimensionLabelFormat === "string"
      ? props.dimensionLabelFormat
      : "";
  // 힌트·파싱 실패는 행이 바뀔 때만 다시 센다 (props 는 직렬화 키 — fields 는 contract 마다 새 배열).
  const chartPropsKey = JSON.stringify(
    Object.fromEntries(
      Object.entries(props).filter(
        ([key, value]) =>
          key !== "dataBinding" && key !== "data" && value !== undefined,
      ),
    ),
  );
  const status = useMemo(() => {
    if (rows.length === 0) return { ordinal: false, parseFailures: 0 };
    const effective: ChartProps = {
      ...CHART_DEFAULT_PROPS,
      ...(JSON.parse(chartPropsKey) as Partial<ChartProps>),
    };
    const presentation = resolveChartPresentation(
      effective,
      CHART_DEFAULT_SERIES_COUNT,
    );
    if (!presentation.ok) return { ordinal: false, parseFailures: 0 };
    const grid = buildSeriesGrid(
      rows,
      effective,
      CHART_DEFAULT_SERIES_COUNT,
      presentation,
    );
    return {
      ordinal:
        presentation.dimension.scale === "category" &&
        grid.categories.length > 0 &&
        resolveAxisKind(grid.categories, undefined) === "ordinal",
      parseFailures: grid.parseFailures ?? 0,
    };
  }, [rows, chartPropsKey]);
  const hint = [
    !timeApplies && scale === "time" ? t("chart.timeOnlyLineArea") : null,
    timeApplies && !scatter && scale === "category" && status.ordinal
      ? t("chart.timeHint")
      : null,
    scale === "time" && status.parseFailures > 0
      ? t("chart.parseFailedHint", { count: status.parseFailures })
      : null,
  ].filter(Boolean);
  const patchText = (key: string, text: string, current: string): void => {
    const next = text.trim() === "" ? undefined : text;
    const prev = current === "" ? undefined : current;
    if (next !== prev) onPatch({ [key]: next });
  };
  return (
    <>
      <PropertySelect
        label={t("chart.dimensionScale")}
        icon={chartIcon("dimensionScale", "enum")}
        value={scale}
        options={SCALES.map((value) => ({
          value,
          label:
            value === "time"
              ? t("chart.scaleTime")
              : scatter
                ? t("chart.scaleLinear")
                : t("chart.scaleCategory"),
        }))}
        translateOptions={false}
        disabledKeys={timeApplies ? undefined : TIME_KEY}
        onChange={(value) => {
          const next: ChartDimensionScale =
            value === "time" ? "time" : "category";
          if (next === "time" && !timeApplies) return;
          if (next === scale) return;
          // 미설정 = category — category 로 돌리면 키를 지운다 (기존 문서 byte 동일 경로).
          onPatch({ dimensionScale: next === "time" ? "time" : undefined });
        }}
        afterControl={
          hint.length > 0 ? (
            <span
              slot="description"
              role="status"
              data-chart-time-hint={
                status.ordinal && scale === "category" ? "ordinal" : undefined
              }
              data-chart-parse-failed={
                status.parseFailures > 0 ? status.parseFailures : undefined
              }
            >
              {hint.join(" · ")}
            </span>
          ) : undefined
        }
      />
      {scale === "time" && (
        <PropertyInput
          label={t("chart.dimensionFormat")}
          icon={chartIcon("dimensionFormat", "string")}
          value={format}
          placeholder={t("chart.dimensionFormatPlaceholder")}
          onChange={(text) => patchText("dimensionFormat", text, format)}
        />
      )}
      {scale === "time" && (
        <PropertyInput
          label={t("chart.dimensionLabelFormat")}
          icon={chartIcon("dimensionLabelFormat", "string")}
          value={labelFormat}
          placeholder={t("chart.dimensionLabelFormatPlaceholder")}
          onChange={(text) =>
            patchText("dimensionLabelFormat", text, labelFormat)
          }
        />
      )}
    </>
  );
});
