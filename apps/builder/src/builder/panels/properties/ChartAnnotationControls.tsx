import { memo } from "react";
import { Button } from "react-aria-components";
import {
  CHART_ANNOTATION_TYPES,
  CHART_ANNOTATIONS_MAX,
  CHART_DEFAULT_PROPS,
  chartTypesReading,
  isChartAnnotation,
  toFiniteNumber,
} from "@composition/rendering";
import type {
  ChartAnnotation,
  ChartAnnotationType,
  ChartType,
} from "@composition/rendering";
import type { ResolvedField } from "@composition/shared";
import { ACTION_ICONS } from "../../config/actionIcons";
import { PropertyInput } from "../../components/property/PropertyInput";
import { PropertyNumberInput } from "../../components/property/PropertyNumberInput";
import { PropertyRowMenu } from "../../components/property/PropertyRowMenu";
import { PropertySelect } from "../../components/property/PropertySelect";
import { useI18n } from "@/i18n";

const AddIcon = ACTION_ICONS.add;

/** 저장 배열을 읽는다 — 종류가 없는 칸은 버린다 (scene 과 같은 판정 `isChartAnnotation`, 상한은 추가 버튼이). */
function readAnnotations(raw: unknown): ChartAnnotation[] {
  return Array.isArray(raw) ? raw.filter(isChartAnnotation) : [];
}

const toNumber = (v: unknown): number | undefined =>
  toFiniteNumber(v) ?? undefined;

/**
 * ADR-306 Phase 6 — 주석 (`annotations[]`) 편집. 자리는 Content 의 기준선 편집 아래. 행 하나 = 주석 하나
 * (종류 · 종류가 읽는 칸 · 이름), 삭제는 행 메뉴, 추가는 아래 버튼 (≤ `CHART_ANNOTATIONS_MAX`). 편집은 배열
 * 전체 교체 한 번 — 빈 배열은 키를 지운다 (기준선 편집과 같은 규약). 주석을 읽는 종류에서만 보인다.
 *
 * 칸: band — X · X 끝 (범주 · 날짜 구간) 또는 값 · 값 끝 (값 구간), event — X, forecast — X (시작),
 * trend · weekends — 이름만.
 */
export const ChartAnnotationControls = memo(function ChartAnnotationControls({
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
  if (!chartTypesReading("annotations").includes(chartType)) return null;
  const list = readAnnotations(props.annotations);
  const write = (next: ChartAnnotation[]): void => {
    onPatch({ annotations: next.length === 0 ? undefined : next });
  };
  const update = (index: number, patch: Partial<ChartAnnotation>) => {
    write(
      list.map((item, i) => {
        if (i !== index) return item;
        const merged: Record<string, unknown> = { ...item, ...patch };
        // 빈 칸은 키를 지운다 — 저장 문서에 빈 값을 남기지 않는다.
        for (const key of Object.keys(merged))
          if (merged[key] === "" || merged[key] === undefined)
            delete merged[key];
        return merged as unknown as ChartAnnotation;
      }),
    );
  };
  const typeLabel: Record<ChartAnnotationType, string> = {
    band: t("chart.annotationBand"),
    event: t("chart.annotationEvent"),
    forecast: t("chart.annotationForecast"),
    trend: t("chart.annotationTrend"),
    weekends: t("chart.annotationWeekends"),
  };
  const typeOptions = CHART_ANNOTATION_TYPES.map((value) => ({
    value,
    label: typeLabel[value],
  }));
  return (
    <div
      className="chart-annotations"
      data-chart-annotations={list.length}
      style={{ display: "contents" }}
    >
      {list.map((item, index) => {
        const name = `${t("chart.annotations")} ${index + 1}`;
        const readsX =
          item.type === "band" ||
          item.type === "event" ||
          item.type === "forecast";
        // 인스펙터 행은 칸 둘 + 아이콘 칸 (`--inspector-row-columns`) — 칸 둘씩 줄을 나눈다.
        return (
          <div
            key={index}
            className="chart-annotation"
            data-type={item.type}
            // 행들이 섹션 세로 간격 (`.section-content` gap) 을 그대로 받게 상자를 만들지 않는다.
            style={{ display: "contents" }}
          >
            <div className="fieldset-row chart-annotation-row">
              <PropertySelect
                label={t("chart.annotationType")}
                value={item.type}
                options={typeOptions}
                translateOptions={false}
                onChange={(value) =>
                  update(index, { type: value as ChartAnnotationType })
                }
              />
              {item.type !== "weekends" ? (
                <PropertyInput
                  label={t("chart.annotationLabel")}
                  value={item.label ?? ""}
                  onChange={(text) => update(index, { label: text })}
                />
              ) : (
                <span />
              )}
              <div className="fieldset-actions actions-chart-annotation">
                <PropertyRowMenu
                  label={`${name} ${t("chart.rowActions")}`}
                  items={[
                    {
                      id: "remove",
                      label: t("chart.removeAnnotation"),
                      icon: ACTION_ICONS.delete,
                    },
                  ]}
                  onAction={(id) => {
                    if (id === "remove")
                      write(list.filter((_, i) => i !== index));
                  }}
                />
              </div>
            </div>
            {readsX ? (
              <div className="fieldset-row chart-annotation-row">
                <PropertyInput
                  label={t("chart.annotationX")}
                  value={item.x ?? ""}
                  onChange={(text) => update(index, { x: text })}
                />
                {item.type === "band" ? (
                  <PropertyInput
                    label={t("chart.annotationXEnd")}
                    value={item.xEnd ?? ""}
                    onChange={(text) => update(index, { xEnd: text })}
                  />
                ) : null}
              </div>
            ) : null}
            {item.type === "band" ? (
              <div className="fieldset-row chart-annotation-row">
                <PropertyNumberInput
                  label={t("chart.annotationY")}
                  value={toNumber(item.y)}
                  onChange={(value) => update(index, { y: value })}
                />
                <PropertyNumberInput
                  label={t("chart.annotationYEnd")}
                  value={toNumber(item.yEnd)}
                  onChange={(value) => update(index, { yEnd: value })}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="chart-actions">
        <Button
          type="button"
          className="control-button"
          data-variant="add"
          data-chart-add-annotation=""
          isDisabled={list.length >= CHART_ANNOTATIONS_MAX}
          onPress={() => write([...list, { type: "event" }])}
        >
          <AddIcon aria-hidden="true" size={14} />
          {t("chart.addAnnotation")}
        </Button>
        {list.length >= CHART_ANNOTATIONS_MAX ? (
          <span slot="description" role="status">
            {t("chart.annotationMaxHint", { max: CHART_ANNOTATIONS_MAX })}
          </span>
        ) : null}
      </div>
    </div>
  );
});
