import "./ChartAuthoringControls.css";
import { memo } from "react";
import { LayoutTemplate } from "lucide-react";
import {
  CHART_DESCRIPTORS,
  getChartDescriptor,
  getChartPresetId,
} from "@composition/specs";
import type { ResolvedField } from "@composition/shared";
import { PropertySelect } from "../../components";
import { useI18n } from "@/i18n";
import { resolvePropertyFieldIcon } from "../../config/propertyFieldIcons";

const chartIcon = (key: string, kind: string) =>
  resolvePropertyFieldIcon(key, kind, "Chart");

/** ADR-210 — columns 모드가 지원하지 않는 종류 (breakdown §2.3 3). */
const COLUMNS_UNSUPPORTED_TYPES: readonly string[] = ["pie", "radial"];

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
      <PropertySelect
        label={t("chart.changeTarget")}
        icon={chartIcon("chartType", "enum")}
        value={descriptor.chartType}
        options={CHART_DESCRIPTORS.map((item) => ({
          value: item.chartType,
          label: item.label,
        }))}
        disabledKeys={unsupportedTypes}
        onChange={(value) => {
          if (unsupportedTypes?.includes(value)) return;
          if (value !== descriptor.chartType) onPatch({ chartType: value });
        }}
        afterControl={
          columnsMode ? (
            <span slot="description">
              {t("chart.typeUnavailableInColumns")}
            </span>
          ) : undefined
        }
      />
      <PropertySelect
        label="Preset"
        icon={LayoutTemplate}
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
    </>
  );
});
