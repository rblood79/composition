/**
 * ADR-313 Decision 2 · 3 · 5 — 필드의 값 표현 (`encoding`): 「원본이 이 필드를 JSON 에 어떻게 싣는가」.
 *
 * 저장 값은 늘 타입의 정규 값 한 벌이다 (`boolean` = `true` · `false`, `number` = 숫자, `date` = ISO 글자 —
 * offset 없는 일시 포함, 큰 정수 = 글자). 값 표현은 원본 표기 ↔ 정규 값의 읽기 · 되돌리기만 정한다.
 * 종류는 닫힌 목록이고 형식 문자열은 받지 않는다 (breakdown §2.1).
 *
 * - 읽기는 멱등이다 — 이미 정규 값인 셀은 그대로 둔다.
 * - 값을 잃는 읽기는 하지 않는다 (HC7) — 수로 정확히 옮겨지지 않는 숫자 글자 · 이미 근삿값이 된 큰 정수는
 *   `precision` 실패다.
 * - 되돌리기는 서버가 같은 값으로 읽는 JSON 표현이다 — 같은 JSON 타입 · 같은 값. 글자 단위로 같은 원문은
 *   보장하지 않는다 (`"4500000.00"` → `"4500000"`).
 *
 * 의존 0 · 순수 함수 (Preview · Publish 의 조회 경로가 읽는다 — `collections` barrel 로 내보내지 않는다).
 */
import { rawJsonNumber, type RawJsonNumber } from "./parseJsonLossless";

export {
  ENCODING_FIELD_TYPE,
  FIELD_ENCODING_KINDS,
  encodingProblem,
  type EncodingProblem,
  type FieldEncoding,
  type FieldEncodingKind,
  type FlagNotation,
} from "./encodingKinds";
import type { FieldEncoding } from "./encodingKinds";

export type EncodedRead =
  | { ok: true; value: unknown }
  /** `mismatch` = 선언과 다른 값 · `precision` = 값을 잃는 읽기 (HC7). 둘 다 셀은 `null`. */
  | { ok: false; reason: "mismatch" | "precision" };

const MISMATCH: EncodedRead = { ok: false, reason: "mismatch" };
const PRECISION: EncodedRead = { ok: false, reason: "precision" };
const ok = (value: unknown): EncodedRead => ({ ok: true, value });

// ---------------------------------------------------------------------------------------------
// 숫자 글자 — 값을 잃지 않는 읽기
// ---------------------------------------------------------------------------------------------

const DECIMAL = /^([+-])?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

/** 십진 글자의 값 열쇠 (부호 · 유효 숫자 · 지수) — 표기가 달라도 같은 수면 같다. */
function decimalKey(text: string): string | undefined {
  const match = DECIMAL.exec(text);
  if (!match) return undefined;
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  let digits = (whole + fraction).replace(/^0+/, "");
  let power = Number(exponent) - fraction.length;
  if (digits === "") return "0";
  const trailing = /0+$/.exec(digits)?.[0].length ?? 0;
  digits = digits.slice(0, digits.length - trailing);
  power += trailing;
  return `${sign === "-" ? "-" : ""}${digits}e${power}`;
}

/**
 * 숫자 글자 → 수. 글자 → 수 → 가장 짧은 십진 글자가 원문과 같은 수일 때만 읽는다 (HC7) — 안전 범위 밖 정수 ·
 * 유효 숫자가 넘치는 소수는 `precision`.
 */
export function readNumberText(raw: string): EncodedRead {
  const text = raw.trim();
  const key = decimalKey(text);
  if (key === undefined) return MISMATCH;
  const value = Number(text);
  if (!Number.isFinite(value)) return PRECISION;
  return decimalKey(String(value)) === key
    ? ok(Object.is(value, -0) ? 0 : value)
    : PRECISION;
}

// ---------------------------------------------------------------------------------------------
// 날짜 — 정규 값은 ISO 글자 (ADR-309 · F9)
// ---------------------------------------------------------------------------------------------

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

function calendarDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clock(hour: number, minute: number, second: number): boolean {
  return hour <= 23 && minute <= 59 && second <= 59;
}

const day = (y: number, m: number, d: number) =>
  `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
const dayTime = (
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  fraction = "",
) =>
  `${day(y, m, d)}T${pad(h)}:${pad(mi)}:${pad(s)}${fraction ? `.${fraction}` : ""}`;

/** 절대 시각 (밀리초) → `…Z` ISO (밀리초가 0 이면 뺀다). 0 ~ 9999 년 밖은 읽지 않는다. */
function instant(ms: number): string | undefined {
  if (!Number.isFinite(ms)) return undefined;
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  if (Number.isNaN(year) || year < 0 || year > 9999) return undefined;
  return date.toISOString().replace(".000Z", "Z");
}

/** 정규 날짜 값의 모양 (`date` 의 ISO 글자) — 이미 정규 값인 셀을 알아본다. */
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const ISO_TIME = /^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;

/** 정규 `date` 값인가 (날짜 · 일시 · 절대 시각 · 시각의 ISO 글자). */
export function isIsoDateText(value: unknown): value is string {
  return (
    typeof value === "string" && (ISO_DATE.test(value) || ISO_TIME.test(value))
  );
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 초 아래 자리 글자 (`"5"` = 0.5 초) — 없으면 `""`. */
  fraction: string;
  /** `Z` · `+09:00` — 없으면 offset 없는 값. */
  offset?: string;
  hasTime: boolean;
}

function datePartsOf(stored: unknown): DateParts | undefined {
  if (typeof stored !== "string") return undefined;
  const match = ISO_DATE.exec(stored.trim());
  if (!match) return undefined;
  const [, y, m, d, h, mi, s, f, offset] = match;
  return {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: Number(h ?? 0),
    minute: Number(mi ?? 0),
    second: Number(s ?? 0),
    fraction: f ?? "",
    offset,
    hasTime: h !== undefined,
  };
}

/** 저장 값의 절대 시각 — offset 없는 일시 · 날짜는 UTC 로 읽는다 (breakdown §2.1). */
function epochOf(parts: DateParts): number {
  const local = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const ms = local + Math.floor(Number(`0.${parts.fraction || "0"}`) * 1000);
  if (!parts.offset || parts.offset === "Z") return ms;
  const sign = parts.offset[0] === "-" ? -1 : 1;
  const [oh, om] = parts.offset.slice(1).split(":").map(Number);
  return ms - sign * (oh * 60 + om) * 60_000;
}

const DIGITS = /^-?\d+$/;

/** 정수 표기 (숫자 또는 숫자 글자) → 정수 — 안전 범위 밖은 `undefined`. */
function integerOf(raw: unknown): number | undefined {
  if (typeof raw === "number")
    return Number.isSafeInteger(raw) ? raw : undefined;
  if (typeof raw === "string" && DIGITS.test(raw.trim())) {
    const value = Number(raw.trim());
    return Number.isSafeInteger(value) ? value : undefined;
  }
  return undefined;
}

function readCompact(raw: unknown, length: 8 | 14): EncodedRead {
  const text =
    typeof raw === "number" && Number.isSafeInteger(raw)
      ? String(raw)
      : typeof raw === "string"
        ? raw.trim()
        : undefined;
  if (text === undefined || text.length !== length || !/^\d+$/.test(text))
    return MISMATCH;
  const y = Number(text.slice(0, 4));
  const m = Number(text.slice(4, 6));
  const d = Number(text.slice(6, 8));
  if (!calendarDay(y, m, d)) return MISMATCH;
  if (length === 8) return ok(day(y, m, d));
  const h = Number(text.slice(8, 10));
  const mi = Number(text.slice(10, 12));
  const s = Number(text.slice(12, 14));
  return clock(h, mi, s) ? ok(dayTime(y, m, d, h, mi, s)) : MISMATCH;
}

function readDateParts(
  raw: unknown,
  precision: "date" | "dateTime",
): EncodedRead {
  if (!Array.isArray(raw) || !raw.every((item) => Number.isSafeInteger(item)))
    return MISMATCH;
  const [y, m, d, h = 0, mi = 0, s = 0, nanos = 0] = raw as number[];
  if (
    precision === "date" ? raw.length !== 3 : raw.length < 5 || raw.length > 7
  )
    return MISMATCH;
  if (!calendarDay(y, m, d) || y < 0 || y > 9999) return MISMATCH;
  if (precision === "date") return ok(day(y, m, d));
  if (!clock(h, mi, s) || nanos < 0 || nanos > 999_999_999) return MISMATCH;
  const fraction = nanos ? pad(nanos, 9).replace(/0+$/, "") : "";
  return ok(dayTime(y, m, d, h, mi, s, fraction));
}

// ---------------------------------------------------------------------------------------------
// 읽기 · 되돌리기
// ---------------------------------------------------------------------------------------------

/** 이미 정규 값인가 — 읽기의 멱등 (작성 행 · 다시 들어온 값). */
function isCanonical(encoding: FieldEncoding, value: unknown): boolean {
  switch (encoding.kind) {
    case "flag":
      return typeof value === "boolean";
    case "numberText":
      return typeof value === "number" && Number.isFinite(value);
    case "bigInt":
      return typeof value === "string" && DIGITS.test(value);
    default:
      // (날짜 표현의 원본은 숫자 · 숫자만인 글자 · 배열이라 ISO 글자와 겹치지 않는다.)
      return isIsoDateText(value);
  }
}

/**
 * JSON 원본의 한 셀을 선언대로 읽는다. `null` · `undefined` 는 그대로 (빈 셀). 이미 정규 값이면 그대로.
 */
export function readEncoded(
  encoding: FieldEncoding,
  raw: unknown,
): EncodedRead {
  if (raw === null || raw === undefined) return ok(null);
  if (encoding.kind !== "flag" && isCanonical(encoding, raw)) return ok(raw);
  switch (encoding.kind) {
    case "flag":
      if (raw === encoding.true) return ok(true);
      if (raw === encoding.false) return ok(false);
      return typeof raw === "boolean" ? ok(raw) : MISMATCH;
    case "numberText":
      return typeof raw === "string" ? readNumberText(raw) : MISMATCH;
    case "epochMs":
    case "epochSec": {
      const value = integerOf(raw);
      if (value === undefined)
        // (정수인데 안전 범위 밖 = 근삿값이 된 시각 — 소수 · 글자는 표기가 다르다.)
        return (typeof raw === "number" && Number.isInteger(raw)) ||
          (typeof raw === "string" && DIGITS.test(raw.trim()))
          ? PRECISION
          : MISMATCH;
      const text = instant(encoding.kind === "epochMs" ? value : value * 1000);
      return text === undefined ? MISMATCH : ok(text);
    }
    case "compactDate":
      return readCompact(raw, 8);
    case "compactDateTime":
      return readCompact(raw, 14);
    case "dateParts":
      return readDateParts(raw, encoding.precision);
    case "bigInt":
      // (큰 정수 보존 파싱이 안전 범위 밖 literal 을 글자로 넘긴다 — 숫자로 왔다면 안전 범위 안이거나 이미 바뀐 값.)
      if (typeof raw === "number")
        return Number.isSafeInteger(raw) ? ok(String(raw)) : PRECISION;
      if (typeof raw === "string" && DIGITS.test(raw.trim()))
        return ok(BigInt(raw.trim()).toString());
      return MISMATCH;
  }
}

/**
 * 글자 원본의 한 셀을 선언의 표기로 읽는다 — 표기가 아니면 `undefined` (호출자가 열 타입의 글자 읽기로
 * 넘어간다, breakdown §2.3 셀 규칙).
 */
export function readEncodedText(
  encoding: FieldEncoding,
  text: string,
): EncodedRead | undefined {
  const value = text.trim();
  switch (encoding.kind) {
    case "flag":
      if (value === String(encoding.true)) return ok(true);
      if (value === String(encoding.false)) return ok(false);
      return undefined;
    case "numberText":
      return undefined; // (열 타입 number 의 글자 읽기와 같다.)
    case "epochMs":
    case "epochSec":
    case "compactDate":
    case "compactDateTime":
      if (!DIGITS.test(value)) return undefined;
      return readEncoded(encoding, value);
    case "dateParts": {
      if (!value.startsWith("[")) return undefined;
      try {
        return readEncoded(encoding, JSON.parse(value));
      } catch {
        return MISMATCH;
      }
    }
    case "bigInt":
      return DIGITS.test(value) ? ok(BigInt(value).toString()) : undefined;
  }
}

/** JSON body 의 되돌린 값 — `bigInt` 는 따옴표 없는 literal (`stringifyJsonLossless` 가 쓴다). */
export type OutgoingJson = unknown | RawJsonNumber;

/**
 * 저장 값 → 서버가 같은 값으로 읽는 JSON 표현 (Decision 5 · HC7). 되돌릴 수 없는 값 (정규 값이 아님) 은
 * 그대로 낸다 — 선언 없는 필드와 같다.
 */
export function writeEncoded(
  encoding: FieldEncoding,
  stored: unknown,
): OutgoingJson {
  if (stored === null || stored === undefined) return stored;
  switch (encoding.kind) {
    case "flag":
      return stored === true
        ? encoding.true
        : stored === false
          ? encoding.false
          : stored;
    case "numberText":
      return typeof stored === "number" && Number.isFinite(stored)
        ? String(stored)
        : stored;
    case "bigInt":
      if (typeof stored === "string" && DIGITS.test(stored))
        return rawJsonNumber(stored);
      return stored;
    case "dateParts": {
      const parts = datePartsOf(stored);
      if (!parts) return stored;
      const base = [parts.year, parts.month, parts.day];
      if (encoding.precision === "date") return base;
      const nanos = parts.fraction ? Number(parts.fraction.padEnd(9, "0")) : 0;
      // (Jackson 의 `LocalDateTime` 배열 — 0 초는 빼고, 0 이 아닌 초 · 초 아래만 싣는다.)
      return [
        ...base,
        parts.hour,
        parts.minute,
        ...(parts.second || nanos ? [parts.second] : []),
        ...(nanos ? [nanos] : []),
      ];
    }
    default: {
      const parts = datePartsOf(stored);
      if (!parts) return stored;
      let text: string;
      if (encoding.kind === "epochMs") text = String(epochOf(parts));
      else if (encoding.kind === "epochSec")
        text = String(Math.floor(epochOf(parts) / 1000));
      else if (encoding.kind === "compactDate")
        text = `${pad(parts.year, 4)}${pad(parts.month)}${pad(parts.day)}`;
      else
        text = `${pad(parts.year, 4)}${pad(parts.month)}${pad(parts.day)}${pad(parts.hour)}${pad(parts.minute)}${pad(parts.second)}`;
      return encoding.wire === "number" ? Number(text) : text;
    }
  }
}

/** 쿼리 파라미터의 되돌린 글자 (Decision 5 — 쿼리에는 그 글자). */
export function writeEncodedText(
  encoding: FieldEncoding,
  stored: unknown,
): string {
  const value = writeEncoded(encoding, stored);
  if (value && typeof value === "object" && "rawJson" in value)
    return (value as RawJsonNumber).rawJson;
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}
