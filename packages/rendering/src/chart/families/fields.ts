/**
 * ADR-306 — family 공용 입력 읽기. 필드 역할은 시리즈 경로와 같은 field 참조 (`#<fieldId>` 또는 key —
 * `resolveFieldRef`) 이고, 숫자 표시는 시리즈 경로와 같은 `valueFormat` 계열 (ADR-210) 이다.
 */
import { resolveFieldRef } from "../../data/fieldIdIndex";
import { formatChartNumber, resolveChartPresentation } from "../presentation";
import { formatTick, toFiniteNumber } from "../scales";
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
  const presentation = resolveChartPresentation(
    {
      valueFormat: props.valueFormat,
      valueLocale: props.valueLocale,
      valueFractionDigits: props.valueFractionDigits,
      valueCurrency: props.valueCurrency,
      valuePercentUnit: props.valuePercentUnit,
    } as Parameters<typeof resolveChartPresentation>[0],
    1,
  );
  const diagnostics: ChartDiagnostic[] = presentation.diagnostics.filter((d) =>
    d.code.startsWith("value"),
  );
  const numberFormat = presentation.numberFormat;
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
    formatValue(value) {
      if (!Number.isFinite(value)) return "-";
      return numberFormat.format === "auto"
        ? formatTick(value)
        : formatChartNumber(value, numberFormat, "raw");
    },
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
