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
import type { ResolvedField } from "@composition/shared";

import type { DataTable } from "../../../types/builder/data.types";
import { columnsFromOwner } from "./hooks/useOwnerCollectionColumns";

/** collection 컬럼 Select 로 승격되는 매핑 필드. */
export const CHART_MAPPING_FIELD_KEYS: readonly string[] = [
  "dimension",
  "metric",
  "color",
];

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

/** 편집 계약의 semantic 필드 → Chart 저작용 필드(컬럼 Select 승격 + data 필드 정리). */
export function buildChartSemanticFields(
  fields: ResolvedField[],
  collections: readonly DataTable[],
  labels: ChartFieldOptionLabels,
): ResolvedField[] {
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  );
  const columns = columnsFromOwner(
    { props },
    new Map(
      collections.flatMap((table) => [
        [table.name, table] as const,
        [table.id, table] as const,
      ]),
    ),
  );
  return fields
    .filter((field) => field.key !== "data" || !props.dataBinding)
    .map((field) => {
      if (!columns || !CHART_MAPPING_FIELD_KEYS.includes(field.key)) {
        return field;
      }
      const current = String(field.currentValue ?? "");
      // Series 에만 해제 항목을 **항상 첫 자리**에 둔다. Category/Value 는 새 해제 명령을
      //   추가하지 않고, 현재 값이 이미 빈 값일 때의 기존 항목만 그대로 유지한다.
      const values =
        field.key === "color"
          ? ["", ...(current === "" ? [] : [current]), ...columns]
          : [current, ...columns];
      return {
        ...field,
        kind: "enum" as const,
        options: Array.from(new Set(values)).map((value) => ({
          value,
          label: optionLabel(value, labels),
        })),
      };
    });
}
