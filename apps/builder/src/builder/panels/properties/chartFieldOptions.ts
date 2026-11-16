/**
 * ADR-209 후속 — Chart 매핑 필드(dimension/metric/color)의 Properties 옵션 생산자.
 *
 * `CatalogEditContractEditor` 가 인라인으로 갖고 있던 식을 그대로 옮긴 것이다. 패널이
 * 호출하는 **실제 생산자** 를 테스트가 통과할 수 있어야 F0 가 성립한다 (합성 옵션 배열을
 * `GenericFieldRenderer` 에 넘겨 만든 결과는 이 경로의 증거가 아니다).
 *
 * 입력의 `dataBinding` 은 편집 계약(`resolveEditContract`)이 산출한 `currentValue` 다 —
 * canonical 의 저장 위치(props / `x-composition`)를 이 모듈이 다시 판정하지 않는다.
 */
import {
  CHART_FIELD_ROLE_KEYS,
  chartActiveForm,
  chartRoleDef,
  chartRoleLabel,
  chartSampleColumns,
} from "@composition/rendering";
import type { ChartRow } from "@composition/rendering";
import type { ChartProps } from "@composition/rendering";
import type { ResolvedField } from "@composition/shared";
import type { PanelField } from "./generic/GenericFieldRenderer";

import type { DataTable } from "../../../types/builder/data.types";
import { fieldsFromOwner } from "./hooks/useOwnerCollectionColumns";

/**
 * collection 컬럼 Select 로 승격되는 매핑 필드 — 시리즈 축 3 + ADR-306 descriptor 의 field 역할
 * (goalField · startField · endField …). 역할 표 하나에서 나온다 (`CHART_FIELD_ROLE_KEYS`).
 */
export const CHART_MAPPING_FIELD_KEYS: readonly string[] =
  CHART_FIELD_ROLE_KEYS;
/**
 * 해제 항목 (None) 을 첫 자리에 두는 선택 역할 — 비워도 그려지는 필드. 종류 · 형태마다 다르다 (sparkline 의
 * Category 는 선택이지만 bar 의 Category 는 필수) — ADR-312 역할 표의 지금 형태 (`chartActiveForm`).
 */
function optionalFieldKeys(
  props: Pick<ChartProps, "chartType" | "dataMode">,
): ReadonlySet<string> {
  return new Set(
    chartActiveForm(props)
      .roles.filter((use) => !use.required)
      .map((use) => use.role),
  );
}

export interface ChartFieldOptionLabels {
  /** 빈 값(미설정·시리즈 해제) 항목의 표시 라벨 — `chart.none`. */
  none: string;
  /** None 라벨과 이름이 같은 데이터 컬럼에 덧붙이는 보조 표시 — `chart.columnQualifier`. */
  columnQualifier: string;
}

/**
 * 옵션 하나의 표시 라벨. 저장 값은 바꾸지 않는다.
 *
 * 실제 컬럼명이 번역된 None 라벨과 같으면 두 항목이 화면에서 구별되지 않으므로, 데이터
 * 항목 쪽에만 지역화된 보조 표시를 덧붙인다 (원본 키 부분은 그대로 남긴다).
 */
function optionLabel(value: string, labels: ChartFieldOptionLabels): string {
  if (value === "") return labels.none;
  return value === labels.none ? `${value} (${labels.columnQualifier})` : value;
}

/**
 * 편집 계약의 semantic 필드 → Chart 저작용 필드(컬럼 Select 승격 + data 필드 정리). 매핑 필드는 컬럼이
 * 없어도 `optionsFromData` — 옵션 (있으면) 이 데이터 키라 번역하지 않는다.
 */
export function buildChartSemanticFields(
  fields: ResolvedField[],
  collections: readonly DataTable[],
  labels: ChartFieldOptionLabels,
  /**
   * ADR-312 F14 — 연결의 원천 열 (보기의 결과 schema — `chartBindingColumns`). 있으면 컬렉션 schema 대신 이것이
   * 열 선택지다: 집계 열은 id 가 없어 key 로 저장된다.
   */
  sourceColumns?: readonly { key: string; id?: string }[],
): PanelField[] {
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  );
  const ownerFields = sourceColumns
    ? sourceColumns.map(({ key, id }) => ({ key, ...(id ? { id } : {}) }))
    : fieldsFromOwner({ props }, collections);
  // ADR-152 1b: collection 필드는 저장 값 = `#<fieldId>` (rename-safe), 표시 = key.
  //   id 없는 출처 (정적 items · legacy static) 는 key 그대로. 현재 값이 구 형식 (key) 이고
  //   같은 key 에 id 가 있으면 `#id` 항목으로 접는다 (저장 값은 다음 편집 때 바뀐다).
  const storedValue = (f: { key: string; id?: string }) =>
    f.id ? `#${f.id}` : f.key;
  const displayOf = (value: string): string => {
    if (!value.startsWith("#")) return value;
    const id = value.slice(1);
    return ownerFields?.find((f) => f.id === id)?.key ?? value;
  };
  const columns = ownerFields?.map(storedValue) ?? null;
  const form = props as Pick<ChartProps, "chartType" | "dataMode">;
  const availableKeys = new Set<string>(
    ownerFields
      ? ownerFields.map((f) => f.key)
      : (Array.isArray(props.data) ? (props.data as object[]) : []).flatMap(
          (row) => (row && typeof row === "object" ? Object.keys(row) : []),
        ),
  );
  const optional = optionalFieldKeys(form);
  return fields
    .filter((field) => field.key !== "data" || !props.dataBinding)
    .map((field): PanelField => {
      if (field.key === "data" && field.itemsManager)
        return withSampleColumns(field, form, props.data);
      if (!CHART_MAPPING_FIELD_KEYS.includes(field.key)) return field;
      // ADR-312 Decision 8 — 값이 없는 역할은 기본 열 이름으로 읽힌다: 칸도 그 이름을 보인다 (빈 글자는 해제라 그대로).
      //   선택 역할은 그 열이 원천에 있을 때만 읽히므로 (`resolveChartRoleDefaults`) 열이 있을 때만 보인다.
      if (field.currentValue === undefined) {
        const fallback = chartRoleDef(field.key)?.defaultField;
        const use = chartActiveForm(form).roles.find(
          (u) => u.role === field.key,
        );
        if (
          typeof fallback === "string" &&
          use &&
          (use.required || availableKeys.has(fallback))
        )
          // (칸 값은 leaf hook 이 문서에서 읽고 값이 없으면 기준값 — 기준값도 기본 열 이름.)
          field = { ...field, currentValue: fallback, baseValue: fallback };
      }
      // ADR-312 — 종류 · 형태별 라벨 (scatter 의 X · Y, calendar 의 Date). 번역은 라벨이 조회 key 다.
      const label = chartRoleLabel(form, field.key) ?? field.label;
      if (!columns) return { ...field, label, optionsFromData: true };
      const rawCurrent = String(field.currentValue ?? "");
      const currentField = ownerFields?.find(
        (f) => f.key === rawCurrent && f.id,
      );
      const current = currentField ? storedValue(currentField) : rawCurrent;
      // Series 에만 해제 항목을 **항상 첫 자리**에 둔다. Category/Value 는 새 해제 명령을
      //   추가하지 않고, 현재 값이 이미 빈 값일 때의 기존 항목만 그대로 유지한다.
      const values = optional.has(field.key)
        ? ["", ...(current === "" ? [] : [current]), ...columns]
        : [current, ...columns];
      return {
        ...field,
        label,
        optionsFromData: true,
        // 구 형식 (key) 현재 값은 `#id` 항목이 선택 상태로 보이도록 접는다.
        ...(current !== rawCurrent ? { currentValue: current } : {}),
        kind: "enum" as const,
        options: Array.from(new Set(values)).map((value) => ({
          value,
          label: optionLabel(displayOf(value), labels),
        })),
      };
    });
}

/**
 * ADR-312 — 표본 행 편집기의 칸은 지금 형태의 역할에서 (고정 Category · Value · Series 가 아니다 — F3). 역할이
 * 가리키는 열 + 행에만 있는 열, 새 행은 숫자 열 0 · 글자 열 「New」.
 */
function withSampleColumns(
  field: ResolvedField,
  form: Pick<ChartProps, "chartType" | "dataMode">,
  data: unknown,
): PanelField {
  const rows = (Array.isArray(data) ? data : []) as ChartRow[];
  const columns = chartSampleColumns(form, rows);
  if (columns.length === 0 || !field.itemsManager) return field;
  const firstText = columns.find((column) => !column.numeric) ?? columns[0];
  return {
    ...field,
    itemsManager: {
      ...field.itemsManager,
      itemSchema: columns.map((column) => ({
        key: column.key,
        type: "string" as const,
        label: column.label,
      })),
      defaultItem: Object.fromEntries(
        columns.map((column) => [column.key, column.numeric ? 0 : "New"]),
      ),
      labelKey: firstText.key,
    },
  };
}
