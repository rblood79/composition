/**
 * preset 컬럼 축약 — mockaroo 스키마 화면의 한 줄 (이름 · 타입 · 규칙 · Blank %).
 * labelKey 는 `presetField.` 접두를 여기서 붙인다.
 */

import type {
  DataFieldFormat,
  DataFieldType,
} from "../../../../../types/builder/data.types";
import type { SampleRule } from "@composition/sample-data";
import type { PresetColumn } from "../types";

export interface ColumnExtra {
  required?: boolean;
  /** 컬럼별 빈 값 비율 0~1 */
  blank?: number;
}

/** A column's type — or a text format (`email` · `url` · `image` → `string` + that format). */
export type ColumnType = DataFieldType | DataFieldFormat;

const FORMATS: readonly string[] = ["email", "url", "image"];

export function col(
  key: string,
  type: ColumnType,
  label: string,
  rule: SampleRule,
  extra: ColumnExtra = {},
): PresetColumn {
  const shape = FORMATS.includes(type)
    ? { type: "string" as const, format: type as DataFieldFormat }
    : { type: type as DataFieldType };
  return { key, ...shape, labelKey: `presetField.${label}`, rule, ...extra };
}

/** 첫 컬럼 관용구 — 필수 id */
export const idCol = (rule: SampleRule = { kind: "rowNumber" }): PresetColumn =>
  col("id", rule.kind === "rowNumber" ? "number" : "string", "id", rule, {
    required: true,
  });
