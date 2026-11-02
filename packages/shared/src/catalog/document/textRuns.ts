/**
 * ADR-299 — 글자 범위 서식 (run). 한 글자 노드의 `children` 은 문자열 또는 `RichText`
 * (`{ kind: "text", runs: [{ text, marks? }] }`) 이고, 이 파일이 그 값의 정규형 · 읽기 · 구간 쓰기의
 * 유일한 정의다 (문서 검증 · resolver · Canvas · DOM · 측정 · 편집기 · 패널 · 코드 보기가 같이 읽는다).
 *
 * 정규형 (`normalizeRichText`, 순서 고정):
 * 1. 빈 run 제거 · 빈 `marks` 제거 · mark 키는 `TEXT_RUN_MARK_KEYS` 순서
 * 2. **토큰 맞춤** — 템플릿 토큰 (`{{ … }}` · 이스케이프 `\{{` · 행 필드 `{ … }`) 은 원자다: 경계가
 *    토큰 안에 있으면 토큰 전체를 그 토큰 첫 글자의 mark 로 맞춘다 (리뷰 h1 · F17)
 * 3. 이웃한 같은 mark 의 run 을 합친다
 * 4. mark 있는 run 이 없으면 **문자열로 되돌린다** — 구간이 없는 글자는 저장 모양 무변경
 *
 * offset 은 UTF-16 code unit (`String#length` — ProseMirror 의 글자 위치와 같다).
 */
import type { RichText, TextRun, TextRunMarks } from "./types";

/** 사용자 결정 1 (2026-11-02) — 구간에 둘 수 있는 글자 축 다섯. 순서 = 정규형의 키 순서. */
export const TEXT_RUN_MARK_KEYS = [
  "fontWeight",
  "fontStyle",
  "textDecoration",
  "color",
  "fontSize",
] as const satisfies readonly (keyof TextRunMarks)[];
export type TextRunMarkKey = (typeof TEXT_RUN_MARK_KEYS)[number];

const MARK_KEY_SET: ReadonlySet<string> = new Set(TEXT_RUN_MARK_KEYS);

/** 글자 범위 서식을 담는 노드 type (Decision 1 — 부모 prop 에 묶인 글자는 문자열 그대로). */
export const RICH_TEXT_HOST_TYPES: ReadonlySet<string> = new Set([
  "Text",
  "Paragraph",
  "Heading",
  "Link",
]);

export function isRichText(value: unknown): value is RichText {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "text" &&
    Array.isArray((value as { runs?: unknown }).runs)
  );
}

/** run 들을 이어 붙인 글자 (구간 없는 같은 글자의 문자열 값과 같다). */
export function richTextPlain(value: string | RichText): string {
  if (typeof value === "string") return value;
  let text = "";
  for (const run of value.runs) text += run.text;
  return text;
}

/** run 목록 — 문자열이면 mark 없는 run 하나 (빈 문자열은 run 0). */
export function richTextRuns(value: string | RichText): readonly TextRun[] {
  if (typeof value !== "string") return value.runs;
  return value ? [{ text: value }] : [];
}

/**
 * 템플릿 토큰 — 상태 템플릿 (`state/template.ts` 의 `{{ name(.seg)* }}` · `\{{`) 과 행 필드
 * (`collections/fieldTemplate.ts` 의 `{ … }`) 를 둘 다 원자로 본다 (둘 중 하나의 경계 안에 run
 * 경계가 오면 그 해석기가 토큰을 못 본다). 행 필드 문법보다 넓게 (중괄호 쌍 하나) 잡는다 — 넓게
 * 잡으면 경계가 밖으로 밀릴 뿐 해석은 바뀌지 않는다.
 */
const ATOMIC_TOKEN = /\\\{\{|\{\{[^{}]*\}\}|\{[^{}\n]*\}/g;

/** 글자 안 토큰 구간 `[start, end)` 목록 (등장 순). */
export function templateTokenRanges(text: string): [number, number][] {
  if (!text.includes("{")) return [];
  const ranges: [number, number][] = [];
  for (const match of text.matchAll(ATOMIC_TOKEN))
    ranges.push([match.index!, match.index! + match[0].length]);
  return ranges;
}

/** `[from, to)` 의 양 끝이 토큰 안이면 토큰 밖으로 넓힌다 (토큰 일부를 굵게 = 토큰 전체를 굵게). */
export function widenToTokens(
  text: string,
  from: number,
  to: number,
): [number, number] {
  let start = from;
  let end = to;
  for (const [tokenStart, tokenEnd] of templateTokenRanges(text)) {
    if (tokenStart < start && start < tokenEnd) start = tokenStart;
    if (tokenStart < end && end < tokenEnd) end = tokenEnd;
  }
  return [start, end];
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) =>
    sameValue(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
}

/** mark 두 벌이 같은가 (키 · 값 deep — 토큰 참조 값 포함, 키 순서 무관). */
export function sameTextRunMarks(
  a: TextRunMarks | undefined,
  b: TextRunMarks | undefined,
): boolean {
  for (const key of TEXT_RUN_MARK_KEYS)
    if (!sameValue(a?.[key], b?.[key])) return false;
  return true;
}

/** 키 순서를 고정하고 비면 `undefined`. */
function cleanMarks(
  marks: Readonly<Record<string, unknown>> | undefined,
): TextRunMarks | undefined {
  if (!marks) return undefined;
  let out: Record<string, unknown> | undefined;
  for (const key of TEXT_RUN_MARK_KEYS) {
    const value = marks[key];
    if (value === undefined) continue;
    (out ??= {})[key] = value;
  }
  return out as TextRunMarks | undefined;
}

const runOf = (text: string, marks: TextRunMarks | undefined): TextRun =>
  marks ? { text, marks } : { text };

/** 글자 하나하나가 아니라 구간 단위로 `[from, to)` 의 mark 를 `map` 으로 바꾼다. */
function mapRange(
  runs: readonly TextRun[],
  from: number,
  to: number,
  map: (marks: TextRunMarks | undefined) => TextRunMarks | undefined,
): TextRun[] {
  const out: TextRun[] = [];
  let at = 0;
  for (const run of runs) {
    const start = at;
    const end = at + run.text.length;
    at = end;
    if (end <= from || start >= to) {
      out.push(run);
      continue;
    }
    const cutStart = Math.max(from, start) - start;
    const cutEnd = Math.min(to, end) - start;
    if (cutStart > 0) out.push(runOf(run.text.slice(0, cutStart), run.marks));
    out.push(
      runOf(run.text.slice(cutStart, cutEnd), cleanMarks(map(run.marks))),
    );
    if (cutEnd < run.text.length)
      out.push(runOf(run.text.slice(cutEnd), run.marks));
  }
  return out;
}

function marksAt(
  runs: readonly TextRun[],
  offset: number,
): TextRunMarks | undefined {
  let at = 0;
  for (const run of runs) {
    if (offset < at + run.text.length) return run.marks;
    at += run.text.length;
  }
  return undefined;
}

/** 정규형 (머리말의 1 ~ 4). 이미 정규형이면 같은 값 (참조) 을 돌려주지는 않는다 — 비교는 `isNormalRichText`. */
export function normalizeRichText(value: string | RichText): string | RichText {
  if (typeof value === "string") return value;
  // 1. empty runs and empty marks out, mark keys in order.
  let runs: TextRun[] = [];
  for (const run of value.runs)
    if (run.text) runs.push(runOf(run.text, cleanMarks(run.marks)));
  // 2. a token is one run: its characters take the token's first character's marks.
  const plain = richTextPlain({ kind: "text", runs });
  for (const [start, end] of templateTokenRanges(plain)) {
    const marks = marksAt(runs, start);
    runs = mapRange(runs, start, end, () => marks);
  }
  // 3. neighbours with the same marks merge.
  const merged: TextRun[] = [];
  for (const run of runs) {
    const last = merged.at(-1);
    if (last && sameTextRunMarks(last.marks, run.marks))
      merged[merged.length - 1] = runOf(last.text + run.text, last.marks);
    else merged.push(run);
  }
  // 4. no marks left — the plain string (storage shape unchanged).
  if (merged.every((run) => !run.marks))
    return merged.map((run) => run.text).join("");
  return { kind: "text", runs: merged };
}

/** 값이 이미 정규형인가 (문서 검증 — 토큰을 가르는 경계 · 빈 run · 합칠 이웃 · mark 없는 RichText 는 아니다). */
export function isNormalRichText(value: RichText): boolean {
  const normal = normalizeRichText(value);
  if (typeof normal === "string") return false;
  if (normal.runs.length !== value.runs.length) return false;
  return normal.runs.every(
    (run, index) =>
      run.text === value.runs[index].text &&
      sameTextRunMarks(run.marks, value.runs[index].marks) &&
      // (`marks: {}` is not normal — absent is.)
      (value.runs[index].marks === undefined ||
        Object.keys(value.runs[index].marks!).length > 0) &&
      Object.keys(value.runs[index].marks ?? {}).every((key) =>
        MARK_KEY_SET.has(key),
      ),
  );
}

/** mark 키가 구간 서식 어휘 안인가. */
export function isTextRunMarkKey(key: string): key is TextRunMarkKey {
  return MARK_KEY_SET.has(key);
}

/**
 * `[from, to)` 에 mark 를 덮는다 (값 `undefined` 인 키는 지운다). 구간 끝은 토큰 밖으로 넓힌다.
 * 결과는 정규형 (mark 가 다 빠지면 문자열).
 */
export function applyTextRunMarks(
  value: string | RichText,
  from: number,
  to: number,
  marks: Partial<
    Record<TextRunMarkKey, TextRunMarks[TextRunMarkKey] | undefined>
  >,
): string | RichText {
  const plain = richTextPlain(value);
  const [start, end] = widenToTokens(plain, from, to);
  if (start >= end) return normalizeRichText(value);
  const runs = mapRange(richTextRuns(value), start, end, (current) => {
    const next: Record<string, unknown> = { ...current };
    for (const [key, item] of Object.entries(marks))
      if (item === undefined) delete next[key];
      else next[key] = item;
    return next as TextRunMarks;
  });
  return normalizeRichText({ kind: "text", runs });
}

/** `[from, to)` 에서 `keys` 의 mark 를 지운다 (구간 끝은 토큰 밖으로). */
export function clearTextRunMarks(
  value: string | RichText,
  from: number,
  to: number,
  keys: readonly TextRunMarkKey[] = TEXT_RUN_MARK_KEYS,
): string | RichText {
  return applyTextRunMarks(
    value,
    from,
    to,
    Object.fromEntries(keys.map((key) => [key, undefined])),
  );
}

/**
 * 구간 `[from, to)` 의 mark — 키마다 한 값이면 그 값, 글자마다 다르면 `"mixed"`, 구간 어디에도
 * 없으면 키가 빠진다 (패널의 「Mixed」 — Figma). 빈 구간은 `from` 앞 글자의 mark (커서 자리).
 */
export function textRunMarksIn(
  value: string | RichText,
  from: number,
  to: number,
): Partial<Record<TextRunMarkKey, unknown>> {
  const runs = richTextRuns(value);
  if (from >= to) {
    const marks = marksAt(runs, Math.max(0, from - 1));
    return { ...marks };
  }
  const out: Partial<Record<TextRunMarkKey, unknown>> = {};
  let at = 0;
  let first = true;
  for (const run of runs) {
    const start = at;
    const end = at + run.text.length;
    at = end;
    if (end <= from || start >= to) continue;
    for (const key of TEXT_RUN_MARK_KEYS) {
      const item = run.marks?.[key];
      if (first) {
        if (item !== undefined) out[key] = item;
      } else if (!sameValue(out[key], item)) out[key] = "mixed";
    }
    first = false;
  }
  for (const key of TEXT_RUN_MARK_KEYS)
    if (out[key] === undefined) delete out[key];
  return out;
}

/**
 * 해석된 run 목록 (record 가 그리는 것) — `{{ }}` 가 run `text` 마다 해석된 값. resolver 가 문서
 * 값을 해석하면 토큰이 원자라 run 구조 · mark 가 그대로이고 text 만 바뀐다. 빈 text 의 run 은 뺀다
 * (치환 값이 빈 문자열인 토큰).
 */
export function resolvedTextRuns(value: RichText): readonly TextRun[] {
  return value.runs.filter((run) => run.text.length > 0);
}
