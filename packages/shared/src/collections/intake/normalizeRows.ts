/**
 * ADR-313 Decision 4 · HC4 · HC5 · HC6 — 행 진입 변환기 하나. 모든 진입 (붙여넣기 · 파일 · 기존 표로
 * 가져오기 · Builder API 실행 · Preview/Publish 조회 · 격자 입력 · Form 값) 이 이 함수를 지난다.
 *
 * 진입이 원본 종류를 알려 준다 (값을 보고 추측하지 않는다):
 * - `json` — JSON 값은 타입을 갖고 온다. 값 표현을 선언한 필드만 선언대로 읽고, 선언이 없으면 바꾸지 않는다
 *   (HC5 — 열 타입과 다르면 「타입과 다른 셀」 로 센다).
 * - `text` — 글자에는 타입이 없다. 선언의 표기로 읽고, 아니면 열 타입의 글자 읽기 (`readTextCell`).
 *
 * 읽지 못한 셀은 `null` 로 두고 열마다 센다. 변환이 필요 없는 행은 새 객체를 만들지 않는다 (HC6 — 행 배열 ·
 * 행 객체 identity 유지). 의존 0 · 순수 함수.
 *
 * 한계 (Phase 1): `object` · `array` 필드의 `children` 안은 내려가지 않는다 — 값 표현은 최상위 필드에만 둔다.
 */
import {
  readEncoded,
  readEncodedText,
  readNumberText,
  isIsoDateText,
  type EncodedRead,
  type FieldEncoding,
} from "./encoding";

export type IntakeSource = "json" | "text";

/** 변환기가 읽는 필드 (`CatalogDataField` · builder `DataField` 의 부분). */
export interface IntakeField {
  id?: string;
  key: string;
  type?: string;
  encoding?: FieldEncoding;
  /** 계산 필드는 진입 값이 없다 — 건너뛴다. */
  formula?: string;
}

/** 열마다 센 수 (field key → 셀 수). 0 인 열은 싣지 않는다. */
export interface IntakeReport {
  /** 선언과 다른 값 · 읽을 수 없는 글자 → `null`. */
  unread: Readonly<Record<string, number>>;
  /** 값을 잃는 읽기라 하지 않은 셀 (HC7) → `null`. */
  precision: Readonly<Record<string, number>>;
  /** (JSON 원본 · 선언 없음) 열 타입과 다른 JSON 타입 — 값은 그대로 (값 표현 후보 제안의 근거). */
  typeMismatch: Readonly<Record<string, number>>;
  /** key 필드 (`keyField`) 가 빈 행 수 · 다른 행과 겹치는 행 수 (행은 버리지 않는다 — breakdown §2.2). */
  keyEmpty: number;
  keyDuplicate: number;
  /** 값이 바뀐 셀 수. */
  changedCells: number;
}

export interface IntakeResult<Row> {
  /** 바뀐 셀이 없으면 받은 배열 그대로 — 바뀐 행만 새 객체. */
  rows: readonly Row[];
  report: IntakeReport;
}

export type TextCellRead =
  | { ok: true; value: unknown }
  | { ok: false; reason: "mismatch" | "precision" };

const EMPTY: TextCellRead = { ok: true, value: null };
const MISMATCH: TextCellRead = { ok: false, reason: "mismatch" };

/**
 * 글자 셀 읽기 — 열 타입으로 (지금의 `coerceCellValue` 규칙 + 값을 잃는 숫자 읽기 금지, HC7). 빈 글자는
 * 어느 타입이든 `null`. `date` 는 받는 글자를 넓게 (브라우저가 읽는 날짜 글자) 읽는 `readDateText` 를
 * 호출자가 줄 수 있다 — 없으면 ISO 글자만.
 */
export function readTextCell(
  type: string | undefined,
  raw: string,
  readDateText?: (text: string) => string | undefined,
): TextCellRead {
  const text = raw.trim();
  if (text === "") return EMPTY;
  switch (type) {
    case "number": {
      const read = readNumberText(text);
      return read.ok ? read : read.reason === "precision" ? read : MISMATCH;
    }
    case "boolean": {
      const lower = text.toLowerCase();
      // (`on` · `off` — an HTML checkbox's value in a Form.)
      if (["true", "1", "yes", "y", "on"].includes(lower))
        return { ok: true, value: true };
      if (["false", "0", "no", "n", "off"].includes(lower))
        return { ok: true, value: false };
      return MISMATCH;
    }
    case "date": {
      const value = readDateText
        ? readDateText(text)
        : isIsoDateText(text)
          ? text
          : undefined;
      return value === undefined ? MISMATCH : { ok: true, value };
    }
    case "array":
    case "object": {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return MISMATCH;
      }
      return typeof parsed === "object" && parsed !== null
        ? { ok: true, value: parsed }
        : MISMATCH;
    }
    default:
      return { ok: true, value: text };
  }
}

/** JSON 값이 열 타입의 정규 값인가 (선언 없는 필드의 「타입과 다른 셀」 판정). */
export function jsonFitsType(
  type: string | undefined,
  value: unknown,
): boolean {
  if (value === null || value === undefined) return true;
  switch (type) {
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "date":
      return isIsoDateText(value);
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && !Array.isArray(value);
    case "reference":
      return typeof value === "string" || typeof value === "number";
    case undefined:
    case "string":
      return typeof value === "string";
    default:
      return true;
  }
}

export interface NormalizeOptions {
  /** key 필드 (`CollectionEntry.keyField` — 필드 id). 있으면 빈 · 겹치는 key 를 센다. */
  keyField?: string;
  /** 글자 원본의 `date` 읽기 (Builder 는 `coerceDateText`). */
  readDateText?: (text: string) => string | undefined;
}

function bump(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

/** 한 셀 — 바뀐 값 또는 같은 값. */
function readCell(
  field: IntakeField,
  raw: unknown,
  source: IntakeSource,
  options: NormalizeOptions,
  report: {
    unread: Record<string, number>;
    precision: Record<string, number>;
    typeMismatch: Record<string, number>;
  },
): unknown {
  const fail = (read: EncodedRead | TextCellRead) => {
    if (!read.ok)
      bump(
        read.reason === "precision" ? report.precision : report.unread,
        field.key,
      );
    return read.ok ? read.value : null;
  };
  // 글자 원본의 글자 셀 — 선언의 표기 → 열 타입의 글자 읽기.
  if (source === "text" && typeof raw === "string") {
    const declared = field.encoding
      ? readEncodedText(field.encoding, raw)
      : undefined;
    return fail(
      declared ?? readTextCell(field.type, raw, options.readDateText),
    );
  }
  // JSON 값 (또는 글자 원본에 이미 들어 있는 정규 값 — 격자의 다시 들어온 값).
  if (field.encoding) return fail(readEncoded(field.encoding, raw));
  if (!jsonFitsType(field.type, raw)) bump(report.typeMismatch, field.key);
  return raw;
}

/**
 * 행 배열을 스키마의 정규 값으로 (Decision 4). `source` 는 진입이 알려 주는 원본 종류.
 * 스키마에 없는 키는 건드리지 않는다.
 */
export function normalizeRows<Row extends Readonly<Record<string, unknown>>>(
  rows: readonly Row[],
  fields: readonly IntakeField[],
  source: IntakeSource,
  options: NormalizeOptions = {},
): IntakeResult<Row> {
  const unread: Record<string, number> = {};
  const precision: Record<string, number> = {};
  const typeMismatch: Record<string, number> = {};
  const counts = { unread, precision, typeMismatch };
  const active = fields.filter((field) => !field.formula);
  const keyName = options.keyField
    ? active.find((field) => field.id === options.keyField)?.key
    : undefined;
  const seen = new Set<string>();
  let keyEmpty = 0;
  let keyDuplicate = 0;
  let changedCells = 0;
  let out: Row[] | undefined;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    let next: Record<string, unknown> | undefined;
    for (const field of active) {
      if (!(field.key in row)) continue;
      const raw = row[field.key];
      const value = readCell(field, raw, source, options, counts);
      if (!Object.is(value, raw)) {
        next ??= { ...row };
        next[field.key] = value;
        changedCells++;
      }
    }
    if (next) {
      out ??= rows.slice(0, index);
      out.push(next as Row);
    } else out?.push(row);
    if (keyName !== undefined) {
      const key = (next ?? row)[keyName];
      if (key === null || key === undefined || key === "") keyEmpty++;
      else {
        const text = String(key);
        if (seen.has(text)) keyDuplicate++;
        else seen.add(text);
      }
    }
  }
  return {
    rows: out ?? rows,
    report: {
      unread,
      precision,
      typeMismatch,
      keyEmpty,
      keyDuplicate,
      changedCells,
    },
  };
}
