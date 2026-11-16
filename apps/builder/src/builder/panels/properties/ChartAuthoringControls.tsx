import "./ChartAuthoringControls.css";
import { memo } from "react";
import {
  CHART_TYPE_DESCRIPTORS,
  getChartDescriptor,
  getChartPresetId,
  chartForms,
  chartKeepsStrandedColumns,
  chartTypeHasForm,
} from "@composition/rendering";
import type { ChartDataMode } from "@composition/rendering";
import type { ResolvedField } from "@composition/shared";
import { PropertySelect } from "../../components/property/PropertySelect";
import { useI18n } from "@/i18n";

/**
 * ADR-210 — columns 모드가 지원하지 않는 시리즈 종류 (breakdown §2.3 3). ADR-312 — 형태 표에서 (Pie · Radial).
 * family 종류는 종류 변경 patch 가 첫 형태로 되돌린다 (`chartTypeChangePatch`).
 */
const COLUMNS_UNSUPPORTED_TYPES: readonly string[] =
  CHART_TYPE_DESCRIPTORS.filter((d) =>
    chartKeepsStrandedColumns(d.chartType, "columns"),
  ).map((d) => d.chartType);

/**
 * Content 선두 — 차트의 **정체** (종류 · 프리셋). shadcn 갤러리의 "종류 × 변형" 층.
 *
 * 종류는 일반 Select 다. ADR-209 의 "기본 Properties 의 Chart Type 선택 0개" 는 팔레트에
 * 6종을 따로 두자는 결정의 부산물이지 (`209:13` — "Chart 하나를 넣고 Properties 에서 종류를
 * 고르는 흐름이 불편") 패널에서 종류 변경을 어렵게 하자는 뜻이 아니다. 종류 변경은 파괴적이지
 * 않다 — 데이터·숨은 종류별 값은 보존되고 왕복하면 돌아오며 preset 자동 적용도 없다
 * (209 breakdown §116). 2단계 (버튼 → Select) 는 안전 이득 0 에 클릭만 더했다 (2026-09-11
 * 사용자 판정). 프리셋/종류 변경은 일반 필드와 같은 canonical batch writer 를 한 번 호출한다.
 */
/**
 * ADR-306 — 종류 변경 patch. 값 필드 목록 (columns 모드) 을 읽지 않는 family 종류는 그 모드를 바꾸는
 * 컨트롤 (`ChartDataMappingControls`) 도 내지 않는다. Value Columns 로 둔 채 바꾸면 Value 칸
 * (`metric` — group 모드에서만 보인다) 을 고를 길이 없어지므로 group 으로 되돌린다. columns 를 읽는
 * family (stream · slope · skyline) 는 모드를 그대로 둔다.
 */
export function chartTypeChangePatch(
  props: Readonly<Record<string, unknown>>,
  chartType: string,
): Record<string, unknown> {
  // ADR-312 — 새 종류의 형태에 없는 `dataMode` 는 그 종류의 첫 형태로 되돌린다 (slope pair → bar 등). 단
  //   시리즈 종류에 남은 columns (pie · radial) 는 ADR-210 대로 조용히 바꾸지 않는다 — 패널이 사유를 보인다.
  const mode = props.dataMode;
  const stranded =
    typeof mode === "string" &&
    !chartTypeHasForm(chartType, mode as ChartDataMode) &&
    !chartKeepsStrandedColumns(chartType, mode);
  return stranded
    ? { chartType, dataMode: chartForms(chartType)[0].id }
    : { chartType };
}

export const ChartAuthoringControls = memo(function ChartAuthoringControls({
  fields,
  onPatch,
}: {
  fields: ResolvedField[];
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  );
  const descriptor = getChartDescriptor(props.chartType);
  const presetId = getChartPresetId(descriptor.chartType, props);
  // ADR-210 — columns 모드에서 Pie/Radial 은 지원하지 않는다: 항목을 비활성화하고 사유를
  //   둔다 (조용히 group 으로 바꾸지 않는다). group 으로 전환한 뒤에는 고를 수 있다.
  const columnsMode = props.dataMode === "columns";
  const unsupportedTypes = columnsMode ? COLUMNS_UNSUPPORTED_TYPES : undefined;
  return (
    <>
      <div className="fieldset-row" data-wide="true">
        <PropertySelect
          label={t("chart.changeTarget")}
          value={descriptor.chartType}
          // ADR-306 Phase 5 — 종류마다 한 항목 (donut · bubble 은 pie · scatter 의 기본값 행 — 팔레트 몫).
          options={CHART_TYPE_DESCRIPTORS.map((item) => ({
            value: item.chartType,
            label: item.label,
          }))}
          disabledKeys={unsupportedTypes}
          onChange={(value) => {
            if (unsupportedTypes?.includes(value)) return;
            if (value === descriptor.chartType) return;
            onPatch(chartTypeChangePatch(props, value));
          }}
          afterControl={
            columnsMode ? (
              <span slot="description">
                {t("chart.typeUnavailableInColumns")}
              </span>
            ) : undefined
          }
        />
      </div>
      <div className="fieldset-row" data-wide="true">
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
      </div>
    </>
  );
});
