/**
 * ADR-313 Decision 2 — 값 표현의 종류 표와 문서 검증 판정 (작은 모듈 — 문서 검증 · 적용기가 첫 화면에서
 * 읽는다. 읽기 · 되돌리기는 `encoding.ts`, 진입 변환기는 `normalizeRows.ts` 로 lazy 경로에 둔다 — HC3).
 */
/** 참 · 거짓 표기의 JSON 값 (`"Y"` · `1` · `true` …). */
export type FlagNotation = string | number | boolean;

export type FieldEncoding =
  | { kind: "flag"; true: FlagNotation; false: FlagNotation }
  | { kind: "numberText" }
  | { kind: "epochMs"; wire: "number" | "string" }
  | { kind: "epochSec"; wire: "number" | "string" }
  | { kind: "compactDate"; wire: "number" | "string" }
  | { kind: "compactDateTime"; wire: "number" | "string" }
  | { kind: "dateParts"; precision: "date" | "dateTime" }
  | { kind: "bigInt" };

export type FieldEncodingKind = FieldEncoding["kind"];

/** 종류마다 받는 필드 타입 (breakdown §2.1 표의 첫 열). */
export const ENCODING_FIELD_TYPE: Readonly<Record<FieldEncodingKind, string>> =
  {
    flag: "boolean",
    numberText: "number",
    epochMs: "date",
    epochSec: "date",
    compactDate: "date",
    compactDateTime: "date",
    dateParts: "date",
    bigInt: "string",
  };

export const FIELD_ENCODING_KINDS = Object.keys(
  ENCODING_FIELD_TYPE,
) as FieldEncodingKind[];

const ARGUMENTS: Readonly<Record<FieldEncodingKind, readonly string[]>> = {
  flag: ["true", "false"],
  numberText: [],
  epochMs: ["wire"],
  epochSec: ["wire"],
  compactDate: ["wire"],
  compactDateTime: ["wire"],
  dateParts: ["precision"],
  bigInt: [],
};

export type EncodingProblem =
  "INVALID_FIELD_ENCODING" | "FIELD_ENCODING_TYPE_MISMATCH";

/**
 * 문서 검증 — 모르는 종류 · 모르는 인자 · 인자 값이 틀리면 `INVALID_FIELD_ENCODING`, 필드 타입과 맞지 않는
 * 종류 (`number` 필드의 `flag`) 는 `FIELD_ENCODING_TYPE_MISMATCH`.
 */
export function encodingProblem(
  value: unknown,
  fieldType: string | undefined,
): EncodingProblem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "INVALID_FIELD_ENCODING";
  const record = value as Record<string, unknown>;
  const kind = record.kind as FieldEncodingKind;
  if (typeof kind !== "string" || !(kind in ARGUMENTS))
    return "INVALID_FIELD_ENCODING";
  const allowed = new Set(["kind", ...ARGUMENTS[kind]]);
  for (const key of Object.keys(record))
    if (!allowed.has(key)) return "INVALID_FIELD_ENCODING";
  for (const key of ARGUMENTS[kind])
    if (!(key in record)) return "INVALID_FIELD_ENCODING";
  switch (kind) {
    case "flag": {
      const notation = (item: unknown) =>
        typeof item === "string" ||
        typeof item === "boolean" ||
        (typeof item === "number" && Number.isFinite(item));
      if (!notation(record.true) || !notation(record.false))
        return "INVALID_FIELD_ENCODING";
      if (record.true === record.false) return "INVALID_FIELD_ENCODING";
      break;
    }
    case "epochMs":
    case "epochSec":
    case "compactDate":
    case "compactDateTime":
      if (record.wire !== "number" && record.wire !== "string")
        return "INVALID_FIELD_ENCODING";
      break;
    case "dateParts":
      if (record.precision !== "date" && record.precision !== "dateTime")
        return "INVALID_FIELD_ENCODING";
      break;
  }
  if ((fieldType ?? "string") !== ENCODING_FIELD_TYPE[kind])
    return "FIELD_ENCODING_TYPE_MISMATCH";
  return undefined;
}

