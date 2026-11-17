/**
 * ADR-313 Decision 2 · §2.5 — 열이 고를 수 있는 「타입 + 값 표현」 한 벌. 비개발자가 형식 문자열 대신 고르는
 * 닫힌 목록이다 (`"Y" / "N"` · 숫자 글자 · `20261106` …). 생성 미리보기 · API 저장 · 열 편집 팝오버가 같은
 * 목록을 쓴다. 순수 함수.
 */
import type { FieldEncoding } from "../../../../../../../packages/shared/src/collections/intake/encoding";
import type { DataFieldType } from "../../../../types/builder/data.types";

/** 열 하나의 선택 — 타입과 (있으면) 값 표현. */
export interface ColumnChoice {
  type: DataFieldType;
  encoding?: FieldEncoding;
}

/** 알려진 참 · 거짓 짝 (감지 후보 · 팝오버 선택지). */
export const FLAG_PAIRS: readonly (readonly [unknown, unknown])[] = [
  ["Y", "N"],
  [1, 0],
  ["1", "0"],
  ["T", "F"],
  ["true", "false"],
];

/** 팝오버 · 미리보기가 보이는 값 표현 (타입마다). */
export const ENCODING_PRESETS: readonly ColumnChoice[] = [
  ...FLAG_PAIRS.map(([t, f]): ColumnChoice => ({
    type: "boolean",
    encoding: {
      kind: "flag",
      true: t as string | number,
      false: f as string | number,
    },
  })),
  { type: "number", encoding: { kind: "numberText" } },
  { type: "date", encoding: { kind: "compactDate", wire: "string" } },
  { type: "date", encoding: { kind: "compactDate", wire: "number" } },
  { type: "date", encoding: { kind: "compactDateTime", wire: "string" } },
  { type: "date", encoding: { kind: "compactDateTime", wire: "number" } },
  { type: "date", encoding: { kind: "epochMs", wire: "number" } },
  { type: "date", encoding: { kind: "epochMs", wire: "string" } },
  { type: "date", encoding: { kind: "epochSec", wire: "number" } },
  { type: "date", encoding: { kind: "epochSec", wire: "string" } },
  { type: "date", encoding: { kind: "dateParts", precision: "date" } },
  { type: "date", encoding: { kind: "dateParts", precision: "dateTime" } },
  { type: "string", encoding: { kind: "bigInt" } },
];

/** 선택의 id — Select 의 key (같은 선택 = 같은 id). */
export function choiceId(choice: ColumnChoice): string {
  const encoding = choice.encoding;
  if (!encoding) return choice.type;
  switch (encoding.kind) {
    case "flag":
      return `${choice.type}:flag:${JSON.stringify(encoding.true)}/${JSON.stringify(encoding.false)}`;
    case "dateParts":
      return `${choice.type}:dateParts:${encoding.precision}`;
    case "numberText":
    case "bigInt":
      return `${choice.type}:${encoding.kind}`;
    default:
      return `${choice.type}:${encoding.kind}:${encoding.wire}`;
  }
}

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** 선택의 표시 이름 — 타입 이름 (값 표현이 있으면 「· 표기 예」). */
export function choiceLabel(choice: ColumnChoice, dt: Translate): string {
  const type = dt(`types.${choice.type === "array" ? "json" : choice.type === "object" ? "json" : choice.type}`);
  const encoding = choice.encoding;
  if (!encoding) return type;
  return `${type} · ${notationLabel(encoding, dt)}`;
}

const shown = (value: unknown) =>
  typeof value === "string" ? `"${value}"` : String(value);

/** 값 표현만의 이름 (예를 보인다 — 비개발자가 원본을 보고 고른다). */
export function notationLabel(encoding: FieldEncoding, dt: Translate): string {
  const wire = (value: "number" | "string") => dt(`notation.wire.${value}`);
  switch (encoding.kind) {
    case "flag":
      // (A text notation shows its quotes — `"1" / "0"` is not the number pair `1 / 0`.)
      return dt("notation.flag", {
        true: shown(encoding.true),
        false: shown(encoding.false),
      });
    case "numberText":
      return dt("notation.numberText");
    case "compactDate":
      return dt("notation.compactDate", { wire: wire(encoding.wire) });
    case "compactDateTime":
      return dt("notation.compactDateTime", { wire: wire(encoding.wire) });
    case "epochMs":
      return dt("notation.epochMs", { wire: wire(encoding.wire) });
    case "epochSec":
      return dt("notation.epochSec", { wire: wire(encoding.wire) });
    case "dateParts":
      return dt(
        encoding.precision === "date"
          ? "notation.datePartsDate"
          : "notation.datePartsDateTime",
      );
    case "bigInt":
      return dt("notation.bigInt");
  }
}

/** 열이 가진 선택 목록 — 감지한 타입 (값 표현 없음) · 후보 · 지금 값 (중복 없이). */
export function columnChoices(
  base: ColumnChoice,
  candidates: readonly ColumnChoice[],
  current?: ColumnChoice,
): ColumnChoice[] {
  const out: ColumnChoice[] = [];
  const seen = new Set<string>();
  for (const choice of [
    { type: base.type },
    ...candidates,
    ...(current ? [current] : []),
    { type: "string" as const },
  ]) {
    const id = choiceId(choice);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(choice);
  }
  return out;
}
