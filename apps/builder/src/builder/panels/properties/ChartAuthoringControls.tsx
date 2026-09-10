import "./ChartAuthoringControls.css";
import { Button } from "react-aria-components/Button";
import { memo, useState } from "react";
import {
  CHART_DESCRIPTORS,
  getChartDescriptor,
  getChartPresetId,
} from "@composition/specs";
import { resolveChartMetrics } from "@composition/specs";
import { resolveComponentRule } from "@composition/shared";
import type { ResolvedField } from "@composition/shared";
import { PropertySelect } from "../../components";
import { useI18n } from "@/i18n";

/** ADR-210 — columns 모드가 지원하지 않는 종류 (breakdown §2.3 3). */
const COLUMNS_UNSUPPORTED_TYPES: readonly string[] = ["pie", "radial"];

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
  // 행 상한 `R` — 절단 (`resolveChartModel`) 과 같은 rule 채널 읽기 (size 무관 상수).
  const rowCap = resolveChartMetrics(
    resolveComponentRule("Chart")?.chart,
    "md",
  ).rowCap;
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
          읽기 경로 `resolveChartMetrics`). 예산 안내 (`chart.budgetHint`) 는 P3. */}
      {sourceRowCount > rowCap && (
        <p className="chart-authoring-hint" role="status">
          {t("chart.rowCapHint", { cap: rowCap, total: sourceRowCount })}
        </p>
      )}
      <p className="chart-authoring-hint">{t("chart.runtimeHint")}</p>
    </>
  );
});
