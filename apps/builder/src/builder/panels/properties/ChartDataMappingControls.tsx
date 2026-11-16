import "./ChartAuthoringControls.css";
import { Button } from "react-aria-components/Button";
import { Checkbox } from "@composition/shared/components/list";
import { memo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useOwnedState } from "./useOwnedState";
import {
  chartActiveForm,
  chartForms,
  chartKeepsStrandedColumns,
} from "@composition/rendering";
import type { ChartDataMode } from "@composition/rendering";
import type { ResolvedField } from "@composition/shared";
import { PropertyRowMenu } from "../../components/property/PropertyRowMenu";
import { PropertySelect } from "../../components/property/PropertySelect";
import { ACTION_ICONS } from "../../config/actionIcons";
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
 * - 값 필드 목록은 추가/삭제/위·아래 (행 메뉴 — drag 없이 키보드 가능). 컬럼 타입은 schema
 *   에서만 읽고, 원본에 없는 필드는 "원본에 없음" 으로 표시하되 키는 보존한다.
 *
 * DOM 은 패널 표준 (ADR-163): 라벨 그룹은 `fieldset.properties-aria` + legend, 행은
 * `.fieldset-row` + `.fieldset-actions`(행 메뉴), 확정 액션은 `.control-button[primary]`.
 */
const EMPTY_PICKED: string[] = [];

export const ChartDataMappingControls = memo(function ChartDataMappingControls({
  elementId = "",
  fields,
  columns,
  onPatch,
}: {
  /** 로컬 상태 (선택 화면) 의 소유 요소 — 요소가 바뀌면 초기화 */
  elementId?: string;
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
  // ADR-312 — 원천 모드 칸의 선택지 = 그 종류의 형태 (`CHART_FORMS`). 형태가 하나인 종류 (parallel · pie …) 는
  //   칸이 없다. columns 를 받지 않는 종류에 columns 가 저장된 때 (columns 로 둔 pie) 만 되돌릴 수 있게 칸을 낸다
  //   (ADR-210 — 조용히 바꾸지 않는다). `dataMode` 의 값은 binding 기본값 (`group`) 을 포함하므로 「저장된 모드」
  //   로 쓰지 않는다.
  const forms = chartForms(chartType);
  const activeForm = chartActiveForm({
    chartType: chartType as never,
    dataMode: props.dataMode as ChartDataMode | undefined,
  }).id;
  // columns 를 받지 않는 시리즈 종류 (Pie · Radial) 에 저장된 채 남은 columns — 되돌릴 수 있게 칸을 낸다.
  const strandedColumns = chartKeepsStrandedColumns(chartType, props.dataMode);
  const dataMode: ChartDataMode = strandedColumns ? "columns" : activeForm;
  const showMode = forms.length > 1 || strandedColumns;
  const modeLabel: Record<ChartDataMode, string> = {
    group: t("chart.modeGroup"),
    columns: t("chart.modeColumns"),
    binned: t("chart.modeBinned"),
    ranked: t("chart.modeRanked"),
    pair: t("chart.modePair"),
  };
  const modeIds: ChartDataMode[] = [
    ...forms.map((form) => form.id),
    ...(strandedColumns ? (["columns"] as const) : []),
  ];
  const valueFields = readValueFields(props.valueFields);
  const [picking, setPicking] = useOwnedState(elementId, false);
  const [picked, setPicked] = useOwnedState<string[]>(elementId, EMPTY_PICKED);

  const typeLabel = (type: ChartColumnCandidate["type"]): string =>
    type === "number"
      ? t("chart.fieldTypeNumber")
      : type === "text"
        ? t("chart.fieldTypeText")
        : type === "date"
          ? t("chart.fieldTypeDate")
          : t("chart.fieldTypeUnknown");
  const columnByKey = new Map((columns ?? []).map((c) => [c.key, c]));

  const applyColumns = (nextFields: string[]): void => {
    const patch: Record<string, unknown> = {
      dataMode: "columns",
      valueFields: nextFields,
    };
    // 범주색 bar 는 columns 와 조합할 수 없다 — 같은 patch 에서 시리즈색으로 바꾼다
    //   (Undo 한 번에 같이 돌아간다).
    if (chartType === "bar" && props.colorBy === "category") {
      patch.colorBy = "series";
    }
    onPatch(patch);
  };

  return (
    <>
      {showMode && (
        <div className="fieldset-row" data-wide="true">
          <PropertySelect
            label={t("chart.dataMode")}
            value={picking ? "columns" : dataMode}
            options={modeIds.map((id) => ({ value: id, label: modeLabel[id] }))}
            translateOptions={false}
            // columns 선택지는 형태 표에 있거나 (받는 종류) 저장된 채 남은 때 (받지 않는 종류) 만 있다 —
            //   안내 · 비활성화는 뒤의 경우뿐 (형태 표에 columns 가 없는 bump · histogram … 에 pie · radial 안내가
            //   붙던 것 — ADR-312 Phase 5 live).
            disabledKeys={strandedColumns ? COLUMNS_MODE_KEY : undefined}
            onChange={(value) => {
              // columns 는 값 열을 고르기 전까지 지금 형태를 유지하는 선택 화면 (ADR-210)
              if (value === "columns") {
                if (dataMode !== "columns") {
                  setPicked(valueFields);
                  setPicking(true);
                }
                return;
              }
              setPicking(false);
              if (value !== dataMode) onPatch({ dataMode: value });
            }}
            afterControl={
              strandedColumns ? (
                <span slot="description">{t("chart.columnsUnsupported")}</span>
              ) : undefined
            }
          />
        </div>
      )}
      {picking && (
        <fieldset className="properties-aria chart-field-picker">
          <legend className="fieldset-legend">{t("chart.chooseFields")}</legend>
          {/* legend 가 그룹 이름을 공급한다 — RAC CheckboxGroup 을 겹치면 같은 이름의 group 이
              둘이 된다. 각 Checkbox 는 자기 라벨로 독립 (controlled). */}
          <div className="react-aria-control react-aria-Group chart-field-picker-list">
            {(columns ?? []).map((column) => (
              <Checkbox
                key={column.key}
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
              >
                {`${column.key} · ${typeLabel(column.type)}`}
              </Checkbox>
            ))}
          </div>
          <div className="chart-actions">
            <Button
              type="button"
              className="control-button"
              data-variant="primary"
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
        </fieldset>
      )}
      {activeForm === "columns" && !picking && (
        <>
          {valueFields.map((key, index) => {
            const column = columnByKey.get(key);
            const status =
              columns && !column
                ? t("chart.missingField")
                : column
                  ? typeLabel(column.type)
                  : "";
            return (
              <div
                key={`${key}:${index}`}
                className="fieldset-row chart-field-row"
              >
                <fieldset className="properties-aria chart-field">
                  <legend className="fieldset-legend">{key}</legend>
                  <div className="react-aria-control react-aria-Group">
                    <span
                      className="chart-field-type"
                      data-missing={columns && !column ? "true" : undefined}
                    >
                      {status}
                    </span>
                  </div>
                </fieldset>
                <div className="fieldset-actions actions-chart-field">
                  <PropertyRowMenu
                    label={`${key} ${t("chart.rowActions")}`}
                    items={[
                      {
                        id: "up",
                        label: t("chart.moveUp"),
                        icon: ArrowUp,
                        isDisabled: index === 0,
                      },
                      {
                        id: "down",
                        label: t("chart.moveDown"),
                        icon: ArrowDown,
                        isDisabled: index === valueFields.length - 1,
                      },
                      {
                        id: "remove",
                        label: t("common.remove"),
                        icon: ACTION_ICONS.delete,
                        // 마지막 필드는 지울 수 없다 — 빈 목록은 설정 오류 상태다 (§2.3
                        //   "빈 설정 상태" 는 선택 화면이 맡는다). 바꾸려면 그룹 필드로 전환한다.
                        isDisabled: valueFields.length <= 1,
                      },
                    ]}
                    onAction={(id) => {
                      if (id === "up")
                        applyColumns(moveItem(valueFields, index, index - 1));
                      else if (id === "down")
                        applyColumns(moveItem(valueFields, index, index + 1));
                      else if (id === "remove")
                        applyColumns(valueFields.filter((_, i) => i !== index));
                    }}
                  />
                </div>
              </div>
            );
          })}
          {columns && columns.some((c) => !valueFields.includes(c.key)) && (
            <div className="fieldset-row" data-wide="true">
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
            </div>
          )}
        </>
      )}
    </>
  );
});
