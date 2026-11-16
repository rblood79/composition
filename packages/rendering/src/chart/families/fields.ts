/**
 * ADR-306 — family 공용 입력 읽기. 필드 역할은 시리즈 경로와 같은 field 참조 (`#<fieldId>` 또는 key —
 * `resolveFieldRef`) 이고, 숫자 표시는 시리즈 경로와 같은 `valueFormat` 계열 (ADR-210) 이다.
 */
import { resolveFieldRef } from "../../data/fieldIdIndex";
import {
  chartValueFormatter,
  resolveNumberPresentation,
} from "../presentation";
import { toFiniteNumber } from "../scales";
import type {
  ChartDiagnostic,
  ChartDiagnosticCode,
  ChartProps,
  ChartRow,
} from "../types";

/** 필드 참조의 행 key (미등록 id 는 null). */
export function fieldKey(ref: string | undefined): string | null {
  if (typeof ref !== "string" || ref === "") return null;
  return resolveFieldRef(ref);
}

export function readNumber(row: ChartRow, key: string | null): number {
  if (key === null) return NaN;
  return toFiniteNumber(row[key]) ?? NaN;
}

export function readLabel(row: ChartRow, key: string | null): string {
  if (key === null) return "";
  const value = row[key];
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

export interface FamilyInput {
  diagnostics: ChartDiagnostic[];
  error(code: ChartDiagnosticCode, message: string, value?: string): void;
  warning(code: ChartDiagnosticCode, message: string, value?: string): void;
  readonly ok: boolean;
  formatValue(value: number): string;
}

/**
 * 진단 모음 + 숫자 형식. 숫자 형식의 설정 오류 (`valueCurrency.missing` …) 는 시리즈 경로와 같은
 * 검증 (`resolveChartPresentation`) 이 낸다 — family 는 그 진단 중 숫자 형식 몫만 이어받는다.
 */
export function familyInput(props: ChartProps): FamilyInput {
  const presentation = resolveNumberPresentation(props);
  const diagnostics: ChartDiagnostic[] = presentation.diagnostics.filter((d) =>
    d.code.startsWith("value"),
  );
  const formatValue = chartValueFormatter(presentation.numberFormat);
  return {
    diagnostics,
    error(code, message, value) {
      diagnostics.push({ code, severity: "error", message, value });
    },
    warning(code, message, value) {
      diagnostics.push({ code, severity: "warning", message, value });
    },
    get ok() {
      return !diagnostics.some((d) => d.severity === "error");
    },
    formatValue,
  };
}

/** 필수 필드 역할 검사 — 비었거나 미등록 참조면 `role.missing`. */
export function requireField(
  input: FamilyInput,
  role: string,
  ref: string | undefined,
): string | null {
  const key = fieldKey(ref);
  if (key === null)
    input.error("role.missing", `${role} field is required`, role);
  return key;
}

/**
 * ADR-306 Phase 4 — 숫자 목록 옵션 (`percentiles` · `edges` · `whiskers` · `movingAverages`). 패널 목록 칸의
 * 글자 (「95」 · 「p95」) 도 받는다 — 앞의 `p` 는 떼고, 숫자로 읽히지 않는 항목은 버린다.
 */
export function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    const text =
      typeof item === "string" ? item.trim().replace(/^p/i, "") : item;
    const n = typeof text === "number" ? text : toFiniteNumber(text);
    if (n !== null && Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** 양수 숫자 옵션 — 숫자가 아니거나 범위 밖이면 기본값 (NaN 옵션 가드). */
export function numberOption(
  value: unknown,
  fallback: number,
  min = -Infinity,
  max = Infinity,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
