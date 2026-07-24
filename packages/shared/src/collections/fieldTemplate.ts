/**
 * ADR-159: collection 필드 템플릿 단일 resolver (D3 대칭 SSOT).
 *
 * Skia projection(빌더 샘플 데이터)과 DOM 렌더(Preview/Publish 실데이터)가
 * **이 두 심볼만** 소비한다 (G2) — consumer 자체 `{...}` 파싱 금지.
 *
 * 문법 (breakdown §2-1): `{field}` 토큰 + literal 혼합 + `{{`/`}}` 이스케이프
 * + 미지 필드 빈 문자열 (P1) / 경로 접근 `{a.b.c}`·`{arr[0].x}` + 포맷 `{d|date}`·
 * `{d|number}` (P5 — resolver 내부 확장, 소비처 API 무변. ADR-162 소비: string prop
 * 일반 — slot 텍스트 특정 가정 금지, breakdown §1-6).
 *
 * P5 BC: 경로 해석 전에 **flat key 정확 일치가 항상 우선** — record 에 `"a.b"` 리터럴
 * 키가 있으면 P1 과 동일하게 그 값을 쓰고, 없을 때만 경로 traversal (신규 가산).
 */

import {
  getItemDescription,
  getItemIcon,
  getItemLabel,
  getItemValue,
} from "./resolveCollectionItems";

export type CompiledTemplatePart =
  | { kind: "literal"; text: string }
  | {
      kind: "field";
      key: string;
      /** P5: compile 시 파싱된 경로 세그먼트 — `a.b[0]` → `["a","b",0]`. flat key 는 길이 1. */
      path: readonly (string | number)[];
      /** P5: `{field|fmt}` 포맷 이름 — FIELD_TEMPLATE_FORMATTERS 조회 키. */
      format?: string;
    };

export interface CompiledTemplate {
  /** 원본 템플릿 텍스트 (캐시 키 겸 디버깅). */
  source: string;
  parts: readonly CompiledTemplatePart[];
  /** field 토큰 수 (이스케이프 제외). */
  tokenCount: number;
}

/**
 * `{{` / `}}` 이스케이프 + `{식별자[|포맷]}` 토큰. 매칭 실패 조각(`{not a token}`,
 * `{x|}` 등)은 literal 보존. 식별자는 경로 문자(`.` `[` `]`) 포함, 포맷은 `|` 뒤
 * 단순 이름 1개 (P5 최소셋 — 인자 문법은 확장 지점).
 */
const TOKEN_PATTERN =
  /\{\{|\}\}|\{([A-Za-z_$][\w$.[\]]*)(?:\|([A-Za-z]\w*))?\}/g;

/**
 * 필드 키 → 경로 세그먼트 (compile 시 1회). `a.b[0].c` → `["a","b",0,"c"]`.
 * 비숫자 브래킷(`a[b]`)은 관용적으로 dot 세그먼트 취급 (`["a","b"]`).
 */
const PATH_SEGMENT_PATTERN = /([^.[\]]+)|\[(\d+)\]/g;

function parseFieldPath(key: string): (string | number)[] {
  const segments: (string | number)[] = [];
  for (const match of key.matchAll(PATH_SEGMENT_PATTERN)) {
    if (match[1] !== undefined) segments.push(match[1]);
    else segments.push(Number(match[2]));
  }
  return segments;
}

/**
 * P5 포맷 최소셋 — **확장 지점**: 새 포맷은 이 registry 에 formatter 를 추가한다
 * (`{field|fmt}` 의 fmt 가 조회 키). formatter 는 적용 불가 시 null 반환 →
 * 미포맷 문자열 fallback (throw 금지). 인자 있는 포맷(`|date:MM/DD` 류)·locale
 * 선택은 후속 확장 — 현재 date 는 `YYYY-MM-DD`, number 는 en-US 천단위 고정
 * (Skia↔DOM 대칭을 위해 런타임 locale 비의존 결정론 출력).
 */
const FIELD_TEMPLATE_FORMATTERS: Record<
  string,
  (value: unknown) => string | null
> = {
  date: formatDateValue,
  number: formatNumberValue,
};

function formatDateValue(value: unknown): string | null {
  if (typeof value === "string") {
    // ISO date 접두(`2026-07-24` / `2026-07-24T10:30:00Z`)는 TZ 시프트 없이 date part.
    const isoPrefix = /^(\d{4}-\d{2}-\d{2})([T\s].*)?$/.exec(value);
    if (isoPrefix) return isoPrefix[1];
  }
  const date =
    value instanceof Date
      ? value
      : typeof value === "number" || typeof value === "string"
        ? new Date(value)
        : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

function formatNumberValue(value: unknown): string | null {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(num)) return null;
  return NUMBER_FORMATTER.format(num);
}

/**
 * R5: scene rebuild 마다 projection 이 재호출되어도 동일 템플릿 텍스트는 재compile
 * 하지 않는다 (Map by text). 상한 초과 시 전체 clear — 실사용 slot 텍스트 종류는
 * 수십 개 수준이라 도달하지 않는 안전판.
 */
const COMPILE_CACHE_LIMIT = 500;
const compileCache = new Map<string, CompiledTemplate | null>();

/**
 * 템플릿 compile. **토큰 0개 + 이스케이프 0개면 null** — 소비자는 null 이면 기존
 * 휴리스틱(`getItemLabel`/`getItemDescription`)으로 fallback 한다 (G3 BC 계약).
 * 이스케이프만 있는 텍스트(`{{num}}`)는 사용자가 brace 표기를 의도한 템플릿이므로
 * non-null (§2-1 이스케이프 예시 정합).
 */
export function compileFieldTemplate(text: string): CompiledTemplate | null {
  const cached = compileCache.get(text);
  if (cached !== undefined) return cached;

  const parts: CompiledTemplatePart[] = [];
  let tokenCount = 0;
  let hasEscape = false;
  let lastIndex = 0;

  TOKEN_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ kind: "literal", text: text.slice(lastIndex, index) });
    }
    if (match[0] === "{{") {
      parts.push({ kind: "literal", text: "{" });
      hasEscape = true;
    } else if (match[0] === "}}") {
      parts.push({ kind: "literal", text: "}" });
      hasEscape = true;
    } else {
      parts.push({
        kind: "field",
        key: match[1],
        path: parseFieldPath(match[1]),
        ...(match[2] ? { format: match[2] } : {}),
      });
      tokenCount += 1;
    }
    lastIndex = index + match[0].length;
  }

  let compiled: CompiledTemplate | null;
  if (tokenCount === 0 && !hasEscape) {
    compiled = null;
  } else {
    if (lastIndex < text.length) {
      parts.push({ kind: "literal", text: text.slice(lastIndex) });
    }
    compiled = { source: text, parts, tokenCount };
  }

  if (compileCache.size >= COMPILE_CACHE_LIMIT) compileCache.clear();
  compileCache.set(text, compiled);
  return compiled;
}

/**
 * 필드 값 → 표시 문자열. 미지/null/undefined 는 빈 문자열 (throw 금지).
 * object/array 는 텍스트 보간 대상 아님 — 빈 문자열 (P5 컴포넌트 placeholder 영역).
 */
function stringifyFieldValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") return String(value);
  return "";
}

/** 템플릿 텍스트를 갖는 행 텍스트 role — P2 는 label/description 2종 (icon/value 는 비텍스트). */
export type RowTemplateRole = "label" | "description";

/**
 * 템플릿 소스 precedence 판정 단일 헬퍼 (breakdown §2-3-1) — Skia projection 과 DOM
 * 렌더가 동일 판정을 공유한다 (G2 대칭).
 *
 * 1. slot 구성의 해당 role slot 자식 `text` → template 정본 (item 자체 props 는 superseded)
 * 2. 없으면 item 자체 props — label: `children` ?? `textValue` / description: `description`
 *    (flat/legacy 저작 커버)
 * 3. 그것도 없으면 null → 소비자는 휴리스틱 (여기 반환된 소스도 토큰이 없으면 compile
 *    null → 동일 휴리스틱 — G3 BC)
 */
export function resolveRowTemplateSource(
  slotComposition:
    | { slots?: Partial<Record<string, { text?: string }>> }
    | null
    | undefined,
  role: RowTemplateRole,
  itemProps: Record<string, unknown> | null | undefined,
): string | null {
  const slotText = slotComposition?.slots?.[role]?.text;
  if (typeof slotText === "string" && slotText.length > 0) return slotText;
  if (!itemProps) return null;
  const keys = role === "label" ? ["children", "textValue"] : ["description"];
  for (const key of keys) {
    const value = itemProps[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/**
 * 보간 대상 record — raw row item + **가상 필드 4종** (projected row 의
 * label/description/icon/value 휴리스틱 산출값).
 *
 * **Why (P2 BC — seed 템플릿)**: 시스템 seed origin(ListBoxItem/Default 등)의 slot
 * 텍스트가 이미 `{label}`/`{description}` 이다. raw item 만 보간하면 해당 필드가 없는
 * 데이터(예: num/email/name)에서 seed 행이 빈 문자열로 회귀한다. 가상 필드는 raw
 * item 에 같은 키가 있으면 휴리스틱이 그 값을 그대로 고르므로 (heuristic 1순위 키)
 * 항상 무손실 — 없을 때만 휴리스틱 산출값(name 등)으로 채워져 현행 표시와 bit-동일.
 */
export function buildCollectionRowTemplateItem(row: {
  description: string | null;
  icon: string | null;
  item: unknown;
  label: string;
  value: string | null;
}): Record<string, unknown> {
  const base =
    row.item !== null &&
    typeof row.item === "object" &&
    !Array.isArray(row.item)
      ? (row.item as Record<string, unknown>)
      : {};
  return {
    ...base,
    label: row.label,
    description: row.description ?? "",
    icon: row.icon ?? "",
    value: row.value ?? "",
  };
}

/**
 * 병합 record(원본 필드 + id/label 등이 이미 섞인 행 데이터) 보간 편의 wrapper —
 * projection row 객체가 없는 DOM 소비자(renderer / ListBox / GridList 내부 렌더)용.
 * 가상 필드 4종은 shared 휴리스틱으로 직접 산출해 [[buildCollectionRowTemplateItem]] 과
 * 동일 의미를 보장한다 (Skia ↔ DOM 대칭, G2).
 */
export function interpolateCollectionRowTemplate(
  compiled: CompiledTemplate,
  item: Record<string, unknown>,
): string {
  const itemKey = typeof item.id === "string" ? item.id : String(item.id ?? "");
  return interpolateFieldTemplate(
    compiled,
    buildCollectionRowTemplateItem({
      item,
      label: getItemLabel(item, itemKey, 0),
      description: getItemDescription(item),
      icon: getItemIcon(item),
      value: getItemValue(item),
    }),
  );
}

/**
 * P5 경로 해석 — flat key 정확 일치 우선 (P1 BC), miss + 다중 세그먼트일 때만
 * traversal. 중간 세그먼트 miss/비-container 는 undefined (→ 빈 문자열).
 */
function resolveFieldPathValue(
  record: Record<string, unknown>,
  part: Extract<CompiledTemplatePart, { kind: "field" }>,
): unknown {
  if (part.key in record) return record[part.key];
  if (part.path.length <= 1) return undefined;
  let current: unknown = record;
  for (const segment of part.path) {
    if (current == null || typeof current !== "object") return undefined;
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[segment];
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }
  return current;
}

/**
 * 행 데이터 보간. compile 은 slot 당 1회(행 루프 밖), 본 함수는 행별 토큰 수 O(k).
 * rowItem 이 record 가 아니면 모든 토큰이 빈 문자열로 치환된다.
 * P5: 경로 해석(resolveFieldPathValue) + 포맷(FIELD_TEMPLATE_FORMATTERS — 실패 시
 * 미포맷 fallback) 적용.
 */
export function interpolateFieldTemplate(
  compiled: CompiledTemplate,
  rowItem: unknown,
): string {
  const record =
    rowItem !== null && typeof rowItem === "object" && !Array.isArray(rowItem)
      ? (rowItem as Record<string, unknown>)
      : null;

  let out = "";
  for (const part of compiled.parts) {
    if (part.kind === "literal") {
      out += part.text;
    } else if (record) {
      const raw = resolveFieldPathValue(record, part);
      let text = stringifyFieldValue(raw);
      if (part.format !== undefined) {
        const formatter = FIELD_TEMPLATE_FORMATTERS[part.format];
        const formatted = formatter ? formatter(raw) : null;
        if (formatted !== null) text = formatted;
      }
      out += text;
    }
  }
  return out;
}
