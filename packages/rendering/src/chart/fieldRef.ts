/**
 * Chart 의 필드 참조 읽기 — 역할 표 (`roles.ts` · 첫 화면) 와 시리즈 표시 표 (`seriesItems.ts`) · family 계산
 * (`families/fields.ts`) 이 같은 규칙 하나를 읽는다. 참조는 `#<fieldId>` 또는 key (`resolveFieldRef`).
 *
 * 첫 화면 번들에 든다 — 무거운 모듈 (presentation · family) 을 import 하지 않는다.
 */
import { resolveFieldRef } from "../data/fieldIdIndex";
import type { ChartRow } from "./types";

/** 필드 참조의 행 key (빈 값 · 글자가 아닌 값 · 미등록 id 는 null). */
export function fieldKey(ref: unknown): string | null {
  if (typeof ref !== "string" || ref === "") return null;
  return resolveFieldRef(ref);
}

/** 행의 그 열 값을 글자로 (없음 · null 은 빈 글자) — 범주 · 계열 값의 identity. */
export function readLabel(row: ChartRow, key: string | null): string {
  if (key === null) return "";
  const value = row[key];
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

/** 그 열이 어느 행에든 있는가. */
export const hasColumn = (rows: readonly ChartRow[], key: string): boolean =>
  rows.some((row) => Object.prototype.hasOwnProperty.call(row, key));
