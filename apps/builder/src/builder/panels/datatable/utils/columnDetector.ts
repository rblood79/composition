/**
 * Column Detector Utility
 *
 * API 응답 데이터에서 컬럼을 자동 감지하고 타입을 추론합니다.
 */

import {
  readEncoded,
  readNumberText,
  type FieldEncoding,
} from "../../../../../../../packages/shared/src/collections/intake/encoding";
import { FLAG_PAIRS, type ColumnChoice } from "./encodingChoices";
import type { IntakeSource } from "../../../../../../../packages/shared/src/collections/intake/normalizeRows";
import type {
  DataField,
  DataFieldFormat,
  DataFieldType,
} from "../../../../types/builder/data.types";

export interface DetectedColumn {
  key: string;
  label: string;
  type: DataFieldType;
  /** A text column's kind (an email · a URL · an image address). */
  format?: DataFieldFormat;
  sampleValue: unknown;
  selected: boolean;
  /**
   * ADR-313 §2.5 — 값 표현 후보 (제안 — 미리보기에서 사용자가 정한다). 기본 선택은 `encoding` 이 있을 때만
   * (큰 정수 글자) — 그때 `type` · `encoding` 이 이미 그 후보다.
   */
  candidates: ColumnChoice[];
  encoding?: FieldEncoding;
  /** key 후보 — 이름이 `id` · `*_ID` · `*Id` 이고 값이 모두 있고 서로 다름. */
  keyCandidate: boolean;
}

interface InferredType {
  type: DataFieldType;
  format?: DataFieldFormat;
}

/**
 * 값의 타입을 추론합니다 — 변수와 같은 타입 (2026-10-29): 날짜 · 날짜+시각은 `date`, 이메일 ·
 * URL · 이미지는 `string` + `format`.
 */
function inferType(value: unknown): InferredType {
  if (value === null || value === undefined) return { type: "string" };
  if (typeof value === "boolean") return { type: "boolean" };
  if (typeof value === "number") return { type: "number" };
  if (Array.isArray(value)) return { type: "array" };
  if (typeof value === "object") return { type: "object" };
  if (typeof value === "string") {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return { type: "string", format: "email" };
    // (An image address is a URL too — the image check first.)
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(value))
      return { type: "string", format: "image" };
    if (/^https?:\/\/.+/.test(value)) return { type: "string", format: "url" };
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(value)) return { type: "date" };
    return { type: "string" };
  }
  return { type: "string" };
}

/**
 * 키를 레이블로 변환합니다.
 * snake_case, camelCase를 Title Case로 변환
 */
function keyToLabel(key: string): string {
  return key
    // snake_case → space separated
    .replace(/_/g, " ")
    // camelCase → space separated
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // 첫 글자 대문자
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** ADR-313 §2.5 — the most sample rows a column's type reads (keys: every sample row). */
export const DETECT_SAMPLE_ROWS = 200;

/** A text cell's type (CSV · tab cells carry no type — breakdown §2.5): its shape's default. */
function inferTextType(value: string): InferredType {
  const text = value.trim();
  const lower = text.toLowerCase();
  if (lower === "true" || lower === "false") return { type: "boolean" };
  // (A number text that reads exactly — never one starting with 0 (`01234` is a code) · past 2^53.)
  if (!/^[+-]?0\d/.test(text) && readNumberText(text).ok) return { type: "number" };
  return inferType(text);
}

/**
 * 표본 행에서 컬럼을 감지합니다 (ADR-313 §2.5): 열 = 모든 표본 행의 키 (첫 등장 순), 타입 = `null` 이 아닌
 * 표본 값 전부 (처음 200 행) 의 일치 — 갈리면 `string`. `source` 는 진입이 알려 주는 원본 종류 — `text`
 * (CSV · 탭 표) 는 글자의 모양으로 타입의 기본 선택을 한다 (숫자 · true/false · ISO 날짜).
 *
 * @param data 행 배열
 */
export function detectColumns(
  data: unknown,
  source: IntakeSource = "json",
): DetectedColumn[] {
  if (!Array.isArray(data) || data.length === 0) return [];
  const sample = data
    .slice(0, DETECT_SAMPLE_ROWS)
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );
  if (!sample.length) return [];
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of sample)
    for (const key of Object.keys(row))
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }

  return keys.map((key) => {
    let inferred: InferredType | undefined;
    let mixed = false;
    let sampleValue: unknown = null;
    for (const row of sample) {
      const value = row[key];
      if (value === null || value === undefined) continue;
      if (source === "text" && typeof value === "string" && value.trim() === "")
        continue;
      if (sampleValue === null) sampleValue = value;
      const next =
        source === "text" && typeof value === "string"
          ? inferTextType(value)
          : inferType(value);
      if (!inferred) inferred = next;
      else if (inferred.type !== next.type) mixed = true;
      else if (inferred.format !== next.format)
        inferred = { type: inferred.type };
    }
    const type = !inferred || mixed ? { type: "string" as const } : inferred;
    const values = sample
      .map((row) => row[key])
      .filter(
        (value) =>
          value !== null &&
          value !== undefined &&
          !(typeof value === "string" && value.trim() === ""),
      );
    const candidates = encodingCandidates(key, values, source);
    // (§2.5 — 큰 정수만 기본 선택: 근삿값이 될 수 없는 길은 하나뿐이다.)
    const big = candidates.find((c) => c.encoding?.kind === "bigInt");
    return {
      key,
      label: keyToLabel(key),
      type: big ? "string" : type.type,
      ...(!big && type.format ? { format: type.format } : {}),
      sampleValue,
      selected: true, // 기본적으로 모두 선택
      candidates,
      ...(big?.encoding ? { encoding: big.encoding } : {}),
      keyCandidate:
        KEY_NAME.test(key) &&
        values.length === sample.length &&
        new Set(values.map((value) => String(value))).size === values.length,
    };
  });
}

/** key 후보의 이름 (`id` · `USER_ID` · `userId`). */
const KEY_NAME = /^(id|.*_ID|.*_id|.*[a-z]Id)$/;
/** epoch 후보의 이름 — 날짜 · 시각을 암시 (§2.5). */
const TIME_NAME = /(_DT|_DTM|_TS|_DATE|_TIME|_AT|At|Time|Date|_dt|_ts|_date|_time|_at)$/;
const EPOCH_MS = [946684800000, 4102444800000] as const; // 2000-01-01 ~ 2100-01-01
const DIGITS = /^-?\d+$/;

/** ADR-313 §2.5 — 표본 값 전부가 그 표현일 때만 후보. 순서 = 미리보기 선택지 순서. */
function encodingCandidates(
  key: string,
  values: readonly unknown[],
  source: IntakeSource,
): ColumnChoice[] {
  if (!values.length) return [];
  const out: ColumnChoice[] = [];
  const all = (read: (value: unknown) => boolean) => values.every(read);
  // 큰 정수 — 정수 원문이 안전 범위를 넘는다 (JSON 은 보존 파싱이 글자로, 글자 원본은 숫자 글자).
  const integerText = (value: unknown) =>
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && DIGITS.test(value.trim()));
  if (
    all(integerText) &&
    values.some(
      (value) =>
        typeof value === "string" && !Number.isSafeInteger(Number(value)),
    )
  ) {
    out.push({ type: "string", encoding: { kind: "bigInt" } });
    return out;
  }
  // 참 · 거짓 — 값이 두 종류이고 알려진 짝.
  const distinct = [...new Set(values.map((value) => JSON.stringify(value)))].map(
    (text) => JSON.parse(text) as unknown,
  );
  if (distinct.length === 2)
    for (const [t, f] of FLAG_PAIRS) {
      // (글자 원본의 표기는 글자다 — `1` / `0` 숫자 짝은 JSON 원본에만.)
      if (source === "text" && typeof t !== "string") continue;
      if (distinct.includes(t) && distinct.includes(f)) {
        out.push({
          type: "boolean",
          encoding: { kind: "flag", true: t as string | number, false: f as string | number },
        });
        break;
      }
    }
  // 숫자 글자 (JSON 원본만 — 글자 원본의 숫자 글자는 타입의 기본 선택이다).
  if (
    source === "json" &&
    all(
      (value) =>
        typeof value === "string" &&
        !/^[+-]?0\d/.test(value.trim()) &&
        readNumberText(value).ok,
    )
  )
    out.push({ type: "number", encoding: { kind: "numberText" } });
  // 붙여 쓴 날짜 · 일시 (8 · 14 자리) — `wire` 는 표본의 JSON 타입.
  const wireOf = (): "number" | "string" =>
    values.every((value) => typeof value === "number") ? "number" : "string";
  for (const kind of ["compactDate", "compactDateTime"] as const) {
    const encoding = { kind, wire: wireOf() } as FieldEncoding;
    if (all((value) => (typeof value === "number" || typeof value === "string") && readEncoded(encoding, value).ok && String(value).trim().length === (kind === "compactDate" ? 8 : 14)))
      out.push({ type: "date", encoding });
  }
  // epoch — 정수 · 2000 ~ 2100 년 · 이름이 시각을 암시할 때만.
  if (TIME_NAME.test(key) && all(integerText)) {
    const numbers = values.map((value) => Number(value));
    const within = (scale: number) =>
      numbers.every((n) => n * scale >= EPOCH_MS[0] && n * scale < EPOCH_MS[1]);
    if (within(1)) out.push({ type: "date", encoding: { kind: "epochMs", wire: wireOf() } });
    else if (within(1000)) out.push({ type: "date", encoding: { kind: "epochSec", wire: wireOf() } });
  }
  // 날짜 배열 (Jackson `LocalDate` · `LocalDateTime`).
  for (const precision of ["date", "dateTime"] as const) {
    const encoding: FieldEncoding = { kind: "dateParts", precision };
    if (all((value) => Array.isArray(value) && readEncoded(encoding, value).ok))
      out.push({ type: "date", encoding });
  }
  return out;
}

/**
 * DetectedColumn 배열을 DataField 배열로 변환합니다.
 */
export function columnsToSchema(columns: DetectedColumn[]): DataField[] {
  return columns
    .filter((col) => col.selected)
    .map((col) => ({
      key: col.key,
      type: col.type,
      ...(col.format ? { format: col.format } : {}),
      // (ADR-313 — the chosen notation: the big integer default, or the preview's choice.)
      ...(col.encoding ? { encoding: col.encoding } : {}),
      label: col.label,
      required: false,
    }));
}

/**
 * 데이터에서 선택된 컬럼만 추출합니다.
 */
export function extractSelectedData(
  data: unknown[],
  selectedKeys: string[]
): Record<string, unknown>[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item) => {
    const filtered: Record<string, unknown> = {};
    const record = item as Record<string, unknown>;

    for (const key of selectedKeys) {
      if (key in record) {
        filtered[key] = record[key];
      }
    }

    return filtered;
  });
}

/**
 * ADR-313 §2.5 — a column with the preview's choice (type + notation) applied. The choice is the
 * user's: a candidate is never applied by itself (the big integer default is the detector's).
 */
export function applyColumnChoice(
  column: DetectedColumn,
  choice: { type: DataFieldType; encoding?: FieldEncoding } | undefined,
): DetectedColumn {
  if (!choice) return column;
  const { encoding: _previous, format, ...rest } = column;
  return {
    ...rest,
    type: choice.type,
    ...(choice.type === column.type && format && !choice.encoding ? { format } : {}),
    ...(choice.encoding ? { encoding: choice.encoding } : {}),
  };
}
