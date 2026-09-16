/**
 * preset 컬럼 축약 — mockaroo 스키마 화면의 한 줄 (이름 · 타입 · 규칙 · Blank %).
 * labelKey 는 `presetField.` 접두를 여기서 붙인다.
 */

import type { DataFieldType } from "../../../../../types/builder/data.types";
import type { MockRule } from "../../../../../services/mockData";
import type { PresetColumn } from "../types";

export interface ColumnExtra {
  required?: boolean;
  /** 컬럼별 빈 값 비율 0~1 */
  blank?: number;
}

export function col(
  key: string,
  type: DataFieldType,
  label: string,
  rule: MockRule,
  extra: ColumnExtra = {},
): PresetColumn {
  return { key, type, labelKey: `presetField.${label}`, rule, ...extra };
}

/** 첫 컬럼 관용구 — 필수 id */
export const idCol = (rule: MockRule = { kind: "rowNumber" }): PresetColumn =>
  col("id", rule.kind === "rowNumber" ? "number" : "string", "id", rule, {
    required: true,
  });
