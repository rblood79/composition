/**
 * ADR-159: collection 필드 템플릿 단일 resolver (D3 대칭 SSOT).
 *
 * Skia projection(빌더 샘플 데이터)과 DOM 렌더(Preview/Publish 실데이터)가
 * **이 두 심볼만** 소비한다 (G2) — consumer 자체 `{...}` 파싱 금지.
 *
 * P1 문법 (breakdown §2-1): `{field}` 토큰 + literal 혼합 + `{{`/`}}` 이스케이프
 * + 미지 필드 빈 문자열. 경로(`{a.b.c}`)/포맷(`{d|fmt}`)의 해석은 P5 —
 * 토큰 판정 정규식은 경로 문자를 이미 수용하므로 P5 는 resolver 내부 확장만으로
 * API 무변 (ADR-162 소비: string prop 일반 — slot 텍스트 특정 가정 금지, breakdown §1-6).
 */

import {
  getItemDescription,
  getItemIcon,
  getItemLabel,
  getItemValue,
} from "./resolveCollectionItems";

export type CompiledTemplatePart =
  | { kind: "literal"; text: string }
  | { kind: "field"; key: string };

export interface CompiledTemplate {
  /** 원본 템플릿 텍스트 (캐시 키 겸 디버깅). */
  source: string;
  parts: readonly CompiledTemplatePart[];
  /** field 토큰 수 (이스케이프 제외). */
  tokenCount: number;
}

/**
 * `{{` / `}}` 이스케이프 + `{식별자}` 토큰. 매칭 실패 조각(`{not a token}` 등)은
 * literal 보존. 식별자에 경로 문자(`.` `[` `]`)를 포함해 P5 경로 문법을 선수용.
 */
const TOKEN_PATTERN = /\{\{|\}\}|\{([A-Za-z_$][\w$.[\]]*)\}/g;

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
      parts.push({ kind: "field", key: match[1] });
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
 * 행 데이터 보간. compile 은 slot 당 1회(행 루프 밖), 본 함수는 행별 토큰 수 O(k).
 * rowItem 이 record 가 아니면 모든 토큰이 빈 문자열로 치환된다.
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
    } else {
      out += record ? stringifyFieldValue(record[part.key]) : "";
    }
  }
  return out;
}
