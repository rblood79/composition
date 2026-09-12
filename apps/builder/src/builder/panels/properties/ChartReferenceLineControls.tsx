import { memo } from "react";
import { Button } from "react-aria-components";
import { Trash2 } from "lucide-react";
import {
  CHART_DEFAULT_PROPS,
  CHART_REFERENCE_LINES_MAX,
  CHART_REFERENCE_LINE_TYPES_SUPPORTED,
} from "@composition/specs";
import type {
  ChartLineType,
  ChartReferenceLayer,
  ChartReferenceLine,
  ChartType,
} from "@composition/specs";
import type { ResolvedField } from "@composition/shared";
import {
  PropertyInput,
  PropertyNumberInput,
  PropertyRowMenu,
  PropertySelect,
} from "../../components";
import { useI18n } from "@/i18n";
import { resolvePropertyFieldIcon } from "../../config/propertyFieldIcons";

const chartIcon = (key: string, kind: string) =>
  resolvePropertyFieldIcon(key, kind, "Chart");

const LINE_TYPES: readonly ChartLineType[] = ["solid", "dashed", "dotted"];
const LAYERS: readonly ChartReferenceLayer[] = ["back", "front"];

/** 저장 배열을 읽는다 — 형식이 아니면 빈 목록 (validator 가 진단으로 알린다). */
function readLines(raw: unknown): ChartReferenceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ChartReferenceLine =>
      item !== null && typeof item === "object" && "value" in item,
  );
}

/**
 * ADR-217 P3 — 값 축 기준선 (`referenceLines[]`) 편집. 자리는 Content 섹션의 시간축 컨트롤 아래.
 *
 * - 행 하나 = 기준선 하나 (값 · 라벨 · 선 모양 · 층), 삭제는 행 메뉴, 추가는 아래 버튼 (≤ 4).
 * - 모든 편집은 배열 **전체 교체** 한 번 (`seriesConfig` 와 같은 규약) — 빈 배열은 키를 지운다
 *   (미설정 = 현행, byte 동일 경로).
 * - 값 축이 없는 종류 (pie/radar/radial) 는 안내만 두고 추가 버튼을 비활성화한다 (validator 가
 *   거부하는 값을 조용히 저장하지 않는다).
 */
export const ChartReferenceLineControls = memo(
  function ChartReferenceLineControls({
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
    const chartType = (props.chartType ??
      CHART_DEFAULT_PROPS.chartType) as ChartType;
    const applies = CHART_REFERENCE_LINE_TYPES_SUPPORTED.includes(chartType);
    const lines = readLines(props.referenceLines);
    const write = (next: ChartReferenceLine[]): void => {
      onPatch({ referenceLines: next.length === 0 ? undefined : next });
    };
    const update = (index: number, patch: Partial<ChartReferenceLine>) => {
      write(
        lines.map((line, i) => {
          if (i !== index) return line;
          const merged = { ...line, ...patch };
          // 기본값과 빈 문자열은 키를 지운다 — 저장 문서에 기본값을 남기지 않는다.
          if (merged.label === "") delete merged.label;
          if (merged.lineType === "solid") delete merged.lineType;
          if (merged.layer === "front") delete merged.layer;
          return merged;
        }),
      );
    };
    const lineTypeOptions = LINE_TYPES.map((value) => ({
      value,
      label:
        value === "dashed"
          ? t("chart.lineDashed")
          : value === "dotted"
            ? t("chart.lineDotted")
            : t("chart.lineSolid"),
    }));
    const layerOptions = LAYERS.map((value) => ({
      value,
      label: value === "back" ? t("chart.layerBack") : t("chart.layerFront"),
    }));
    return (
      <div
        className="chart-reference-lines"
        data-chart-reference-lines={lines.length}
      >
        {lines.map((line, index) => {
          const name = `${t("chart.referenceLines")} ${index + 1}`;
          return (
            <div key={index} className="fieldset-row chart-reference-row">
              <PropertyNumberInput
                label={t("chart.referenceValue")}
                icon={chartIcon("referenceValue", "number")}
                value={Number.isFinite(line.value) ? line.value : undefined}
                onChange={(value) => update(index, { value: value ?? 0 })}
              />
              <PropertyInput
                label={t("chart.referenceLabel")}
                icon={chartIcon("referenceLabel", "string")}
                value={line.label ?? ""}
                placeholder={t("chart.referenceLabelPlaceholder")}
                onChange={(text) => update(index, { label: text })}
              />
              <PropertySelect
                label={t("chart.referenceLineType")}
                icon={chartIcon("referenceLineType", "enum")}
                value={line.lineType ?? "solid"}
                options={lineTypeOptions}
                translateOptions={false}
                onChange={(value) =>
                  update(index, { lineType: value as ChartLineType })
                }
              />
              <PropertySelect
                label={t("chart.referenceLayer")}
                icon={chartIcon("referenceLayer", "enum")}
                value={line.layer ?? "front"}
                options={layerOptions}
                translateOptions={false}
                onChange={(value) =>
                  update(index, { layer: value as ChartReferenceLayer })
                }
              />
              <div className="fieldset-actions actions-chart-reference">
                <PropertyRowMenu
                  label={`${name} ${t("chart.rowActions")}`}
                  items={[
                    {
                      id: "remove",
                      label: t("chart.removeReferenceLine"),
                      icon: Trash2,
                    },
                  ]}
                  onAction={(id) => {
                    if (id === "remove")
                      write(lines.filter((_, i) => i !== index));
                  }}
                />
              </div>
            </div>
          );
        })}
        <div className="chart-actions">
          <Button
            type="button"
            className="control-button"
            data-chart-add-reference-line=""
            isDisabled={!applies || lines.length >= CHART_REFERENCE_LINES_MAX}
            onPress={() => write([...lines, { value: 0 }])}
          >
            {t("chart.addReferenceLine")}
          </Button>
          {!applies || lines.length >= CHART_REFERENCE_LINES_MAX ? (
            <span slot="description" role="status">
              {!applies
                ? t("chart.referenceOnlyCartesian")
                : t("chart.referenceMaxHint", {
                    max: CHART_REFERENCE_LINES_MAX,
                  })}
            </span>
          ) : null}
        </div>
      </div>
    );
  },
);
