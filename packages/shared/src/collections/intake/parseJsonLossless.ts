/**
 * ADR-313 F5 · Decision 4 · 5 — 큰 정수를 보존하는 JSON 읽기 · 쓰기.
 *
 * 읽기: 안전 범위 (±(2^53 − 1)) 밖의 **정수 literal** 을 원문 글자로 둔다 (Java `Long` PK). 그 밖의 값은
 * `JSON.parse` 와 같다 — 소수 · 지수 literal 과 글자 안의 숫자는 건드리지 않는다 (R3). 원문을 한 번 훑어 해당
 * literal 을 따옴표로 감싼 뒤 `JSON.parse` 한다. 16 자리 이상의 숫자 열이 원문에 없으면 그냥 `JSON.parse` 다 (HC6).
 *
 * 쓰기: `rawJsonNumber(digits)` 로 표시한 값을 따옴표 없는 literal 로 쓴다 — `JSON.rawJSON` 을 기능 감지로
 * 쓰고, 없으면 자리 표시 글자로 직렬화한 뒤 literal 로 바꾼다.
 *
 * 의존 0 · 순수 함수. 네트워크를 쓰지 않는다 (HC1).
 */

/** 정수 literal 하나 (부호 · 숫자만 — 소수점 · 지수 없음). */
const INTEGER_LITERAL = /^-?\d+$/;
/** 안전 범위를 넘을 수 있는 숫자 열 (16 자리 이상) — 없으면 파싱 경로를 바꾸지 않는다. */
const LONG_DIGITS = /\d{16,}/;

type SourceReviver = (
  key: string,
  value: unknown,
  context?: { source?: string },
) => unknown;

let sourceSupport: boolean | undefined;
function supportsSource(): boolean {
  if (sourceSupport === undefined) {
    sourceSupport = false;
    (JSON.parse as (text: string, reviver: SourceReviver) => unknown)(
      "1",
      (_key, value, context) => {
        sourceSupport = typeof context?.source === "string";
        return value;
      },
    );
  }
  return sourceSupport;
}

const keepLongIntegers: SourceReviver = (_key, value, context) =>
  typeof value === "number" &&
  !Number.isSafeInteger(value) &&
  typeof context?.source === "string" &&
  INTEGER_LITERAL.test(context.source)
    ? context.source
    : value;

/** 숫자 literal 을 이루는 글자 (`0-9 . e E + -`). */
const isNumberChar = (ch: number) =>
  (ch >= 48 && ch <= 57) || ch === 46 || ch === 101 || ch === 69 || ch === 43 || ch === 45;

/** 원문 훑기 — 글자 밖의 안전 범위 밖 정수 literal 을 따옴표로 감싼다. */
function quoteLongIntegers(text: string): string {
  let out = "";
  let last = 0;
  const length = text.length;
  for (let i = 0; i < length; i++) {
    const ch = text.charCodeAt(i);
    if (ch === 34 /* " */) {
      // (글자는 끝 따옴표까지 건너뛴다 — `\` 다음 글자는 이스케이프.)
      for (i++; i < length; i++) {
        const inner = text.charCodeAt(i);
        if (inner === 92 /* \ */) i++;
        else if (inner === 34) break;
      }
      continue;
    }
    if (ch === 45 /* - */ || (ch >= 48 && ch <= 57)) {
      let end = i + 1;
      let integer = true;
      while (end < length) {
        const next = text.charCodeAt(end);
        if (!isNumberChar(next)) break;
        if (next < 48 || next > 57) integer = false;
        end++;
      }
      // (안전 범위 밖일 수 있는 정수 = 16 자리 이상 — 그때만 값을 본다.)
      if (integer && end - i >= 16) {
        const literal = text.slice(i, end);
        if (INTEGER_LITERAL.test(literal) && !Number.isSafeInteger(Number(literal))) {
          out += `${text.slice(last, i)}"${literal}"`;
          last = end;
        }
      }
      i = end - 1;
    }
  }
  return last === 0 ? text : out + text.slice(last);
}

/**
 * `JSON.parse` 와 같되 안전 범위 밖의 정수 literal 은 원문 글자로 (F5). 형식 오류는 `JSON.parse` 와 같이 던진다.
 * 기본은 원문 훑기 + `JSON.parse` 다 — reviver 의 원문 접근 (`context.source`) 보다 1 만 행 × 20 열에서
 * 2.5 배 빠르다 (ADR-313 Phase 2 측정, breakdown §8). 두 경로의 같음은 차등 테스트가 지킨다.
 */
export function parseJsonLossless(text: string): unknown {
  if (!LONG_DIGITS.test(text)) return JSON.parse(text);
  return JSON.parse(quoteLongIntegers(text));
}

/** 테스트 전용 — reviver 의 원문 접근 경로 (지원하는 엔진에서). 훑기 경로와 차등 비교한다. */
export function parseJsonLosslessWithSource(text: string): unknown {
  if (!supportsSource()) throw new Error("JSON.parse source 미지원");
  return (JSON.parse as (text: string, reviver: SourceReviver) => unknown)(text, keepLongIntegers);
}

/** 따옴표 없이 쓸 숫자 literal (큰 정수 key — `bigInt` 의 되돌린 값). */
export interface RawJsonNumber {
  readonly rawJson: string;
}

const RAW = Symbol("composition.rawJsonNumber");

export function rawJsonNumber(digits: string): RawJsonNumber {
  if (!INTEGER_LITERAL.test(digits))
    throw new Error(`정수 literal 이 아닙니다: ${digits}`);
  return Object.freeze({ rawJson: digits, [RAW]: true });
}

export function isRawJsonNumber(value: unknown): value is RawJsonNumber {
  return typeof value === "object" && value !== null && RAW in value;
}

type RawJsonFactory = (text: string) => unknown;

/** `JSON.stringify` 와 같되 `rawJsonNumber` 는 따옴표 없는 literal 로 (Decision 5 — JSON body). */
export function stringifyJsonLossless(
  value: unknown,
  rawJson: RawJsonFactory | undefined = (JSON as { rawJSON?: RawJsonFactory })
    .rawJSON,
): string {
  if (rawJson)
    return JSON.stringify(value, (_key, item) =>
      isRawJsonNumber(item) ? rawJson(item.rawJson) : item,
    );
  const literals: string[] = [];
  const marker = `__composition_raw_${Math.random().toString(36).slice(2)}_`;
  const text = JSON.stringify(value, (_key, item) => {
    if (!isRawJsonNumber(item)) return item;
    literals.push(item.rawJson);
    return `${marker}${literals.length - 1}`;
  });
  if (!literals.length) return text;
  return text.replace(
    new RegExp(`"${marker}(\\d+)"`, "g"),
    (_match, index: string) => literals[Number(index)],
  );
}
