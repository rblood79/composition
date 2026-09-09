import "./ChartAuthoringControls.css";
import { Button } from "react-aria-components/Button";
import { memo, useState } from "react";
import {
  CHART_DESCRIPTORS,
  CHART_SAMPLE_ROWS,
  getChartDescriptor,
  getChartPresetId,
} from "@composition/specs";
import type { ResolvedField } from "@composition/shared";
import { PropertySelect } from "../../components";
import { useI18n } from "@/i18n";

/** 프리셋/종류 변경은 일반 필드와 같은 canonical batch writer를 한 번 호출한다. */
export const ChartAuthoringControls = memo(function ChartAuthoringControls({
  fields,
  onPatch,
  sourceRowCount,
}: {
  fields: ResolvedField[];
  sourceRowCount: number;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const [changingType, setChangingType] = useState(false);
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  );
  const descriptor = getChartDescriptor(props.chartType);
  const presetId = getChartPresetId(descriptor.chartType, props);
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
          onChange={(value) => {
            onPatch({ chartType: value });
            setChangingType(false);
          }}
        />
      )}
      {sourceRowCount > CHART_SAMPLE_ROWS && (
        <p className="chart-authoring-hint" role="status">
          {t("chart.sampleHint", {
            sample: CHART_SAMPLE_ROWS,
            total: sourceRowCount,
          })}
        </p>
      )}
      <p className="chart-authoring-hint">{t("chart.runtimeHint")}</p>
    </>
  );
});
