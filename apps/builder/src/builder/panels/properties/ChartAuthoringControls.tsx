import "./ChartAuthoringControls.css";
import { Button } from "react-aria-components";
import { memo, useState } from "react";
import {
  CHART_DESCRIPTORS,
  CHART_SAMPLE_ROWS,
  getChartDescriptor,
  getChartPresetId,
} from "@composition/specs";
import type { ResolvedField } from "@composition/shared";
import { PropertySelect } from "../../components";

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
      <Button
        type="button"
        className="react-aria-Button"
        data-variant="quiet"
        onPress={() => setChangingType((value) => !value)}
        aria-expanded={changingType}
      >
        차트 종류 변경
      </Button>
      {changingType && (
        <PropertySelect
          label="변경할 차트"
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
      {sourceRowCount > CHART_SAMPLE_ROWS && <p className="chart-authoring-hint" role="status">Canvas: {CHART_SAMPLE_ROWS} / {sourceRowCount}행 샘플 · 미리보기는 전체 행</p>}
      <p className="chart-authoring-hint">
        애니메이션과 툴팁은 미리보기에서 확인합니다.
      </p>
    </>
  );
});
