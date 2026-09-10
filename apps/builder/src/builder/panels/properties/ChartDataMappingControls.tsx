import "./ChartAuthoringControls.css";
import { Button } from "react-aria-components/Button";
import { memo, useState } from "react";
import type { ChartDataMode } from "@composition/specs";
import type { ResolvedField } from "@composition/shared";
import { PropertyCheckbox, PropertySelect } from "../../components";
import { useI18n } from "@/i18n";
import {
  moveItem,
  readValueFields,
  type ChartColumnCandidate,
} from "./chartPresentationPatch";

const COLUMNS_MODE_KEY: readonly string[] = ["columns"];

/**
 * ADR-210 P2 — 시리즈 원천 (group / columns) 과 columns 의 값 필드 목록.
 *
 * breakdown §2.3:
 * - group→columns 는 값 필드를 고르기 전까지 기존 모드를 유지하는 선택 화면이고, Apply 가
 *   `dataMode`+`valueFields` (+ 범주색 bar 면 `colorBy:"series"`) 를 **한 patch** 로 쓴다.
 *   취소는 write 0.
 * - columns→group 은 `dataMode` 만 쓴다 (legacy metric/color · 휴면 valueFields 보존).
 * - Pie/Radial 은 columns 를 지원하지 않는다 — 모드 항목을 비활성화하고 사유를 둔다.
 * - 값 필드 목록은 추가/삭제/위·아래 (버튼 — drag 없이 키보드 가능). 컬럼 타입은 schema
 *   에서만 읽고, 원본에 없는 필드는 "원본에 없음" 으로 표시하되 키는 보존한다.
 */
export const ChartDataMappingControls = memo(function ChartDataMappingControls({
  fields,
  columns,
  onPatch,
}: {
  fields: ResolvedField[];
  /** 데이터 원천의 컬럼 후보 (타입 안내). 원천이 없으면 null. */
  columns: ChartColumnCandidate[] | null;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  );
  const chartType = String(props.chartType ?? "bar");
  const columnsUnsupported = chartType === "pie" || chartType === "radial";
  const dataMode: ChartDataMode =
    props.dataMode === "columns" ? "columns" : "group";
  const valueFields = readValueFields(props.valueFields);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const typeLabel = (type: ChartColumnCandidate["type"]): string =>
    type === "number"
      ? t("chart.fieldTypeNumber")
      : type === "text"
        ? t("chart.fieldTypeText")
        : t("chart.fieldTypeUnknown");
  const columnByKey = new Map((columns ?? []).map((c) => [c.key, c]));

  const applyColumns = (nextFields: string[]): void => {
    const patch: Record<string, unknown> = {
      dataMode: "columns",
      valueFields: nextFields,
    };
    // 범주색 bar 는 columns 와 조합할 수 없다 — 같은 patch 에서 시리즈색으로 바꾸고
    //   (Undo 한 번에 같이 돌아간다) 화면에 그 사실을 표시한다 (§3).
    if (chartType === "bar" && props.colorBy === "category") {
      patch.colorBy = "series";
    }
    onPatch(patch);
  };

  return (
    <>
      <PropertySelect
        label={t("chart.dataMode")}
        value={picking ? "columns" : dataMode}
        options={[
          { value: "group", label: t("chart.modeGroup") },
          { value: "columns", label: t("chart.modeColumns") },
        ]}
        translateOptions={false}
        disabledKeys={columnsUnsupported ? COLUMNS_MODE_KEY : undefined}
        onChange={(value) => {
          if (value === "group") {
            setPicking(false);
            if (dataMode !== "group") onPatch({ dataMode: "group" });
            return;
          }
          if (value === "columns" && dataMode !== "columns") {
            setPicked(valueFields);
            setPicking(true);
          }
        }}
      />
      {columnsUnsupported && (
        <p className="chart-authoring-hint" role="note">
          {t("chart.columnsUnsupported")}
        </p>
      )}
      {picking && (
        <div
          className="chart-field-picker"
          role="group"
          aria-label={t("chart.chooseFields")}
        >
          <p className="chart-authoring-hint">{t("chart.sameUnitHint")}</p>
          {(columns ?? []).map((column) => (
            <PropertyCheckbox
              key={column.key}
              label={`${column.key} · ${typeLabel(column.type)}`}
              isSelected={picked.includes(column.key)}
              onChange={(selected) =>
                setPicked((current) =>
                  selected
                    ? current.includes(column.key)
                      ? current
                      : [...current, column.key]
                    : current.filter((key) => key !== column.key),
                )
              }
            />
          ))}
          {chartType === "bar" && props.colorBy === "category" && (
            <p className="chart-authoring-hint">
              {t("chart.colorBySeriesNote")}
            </p>
          )}
          <div className="chart-authoring-actions">
            <Button
              type="button"
              className="control-button"
              isDisabled={picked.length === 0}
              onPress={() => {
                applyColumns(picked);
                setPicking(false);
              }}
            >
              {t("common.apply")}
            </Button>
            <Button
              type="button"
              className="control-button"
              onPress={() => setPicking(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
      {dataMode === "columns" && !picking && (
        <div
          className="chart-value-fields"
          role="group"
          aria-label={t("chart.valueFields")}
        >
          <ul className="chart-value-fields-list">
            {valueFields.map((key, index) => {
              const column = columnByKey.get(key);
              return (
                <li key={`${key}:${index}`} className="chart-value-field">
                  <span className="chart-value-field-name">{key}</span>
                  <span className="chart-authoring-hint">
                    {columns && !column
                      ? t("chart.missingField")
                      : column
                        ? typeLabel(column.type)
                        : ""}
                  </span>
                  <Button
                    type="button"
                    className="control-button chart-authoring-square"
                    aria-label={`${t("chart.moveUp")} ${key}`}
                    isDisabled={index === 0}
                    onPress={() =>
                      applyColumns(moveItem(valueFields, index, index - 1))
                    }
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    className="control-button chart-authoring-square"
                    aria-label={`${t("chart.moveDown")} ${key}`}
                    isDisabled={index === valueFields.length - 1}
                    onPress={() =>
                      applyColumns(moveItem(valueFields, index, index + 1))
                    }
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    className="control-button chart-authoring-square"
                    aria-label={`${t("common.remove")} ${key}`}
                    // 마지막 필드는 지울 수 없다 — 빈 목록은 설정 오류 상태다 (§2.3 "빈 설정
                    //   상태" 는 선택 화면이 맡는다). 바꾸려면 그룹 필드로 전환한다.
                    isDisabled={valueFields.length <= 1}
                    onPress={() =>
                      applyColumns(valueFields.filter((_, i) => i !== index))
                    }
                  >
                    ×
                  </Button>
                </li>
              );
            })}
          </ul>
          {columns && columns.some((c) => !valueFields.includes(c.key)) && (
            <PropertySelect
              label={t("chart.addField")}
              value=""
              optionValueMode="literal"
              translateOptions={false}
              options={columns
                .filter((c) => !valueFields.includes(c.key))
                .map((c) => ({
                  value: c.key,
                  label: `${c.key} · ${typeLabel(c.type)}`,
                }))}
              onChange={(key) => applyColumns([...valueFields, key])}
            />
          )}
        </div>
      )}
    </>
  );
});
