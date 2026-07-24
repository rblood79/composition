/**
 * ADR-159 P5: Table 셀 값 표시 분류 — array/object 필드의 컴포넌트 placeholder 판정
 * 단일 소스 (Skia projection ↔ DOM Table 셀 렌더 공유, G2 대칭).
 *
 * - array → `tags`: TagGroup placeholder — 칩 cap(TABLE_CELL_TAG_CAP) + `+N` overflow.
 *   원소는 scalar → String, record → getItemLabel 휴리스틱.
 * - object(record) → `text`: 휴리스틱 label 텍스트 (구 `String(value)` "[object Object]" /
 *   DOM JSON.stringify 표시 개선). Select/Toggle placeholder 는 BindingNode(breakdown
 *   §2-4) component 축 확장 지점 — write-back 과 함께 후속 ADR.
 * - scalar → `text`: 기존 readRowCells stringify 와 bit-동일 (BC).
 *
 * read-only placeholder 전용 — 동작(선택/제거)은 D1 소관으로 본 분류가 관여하지 않는다.
 */

import { getItemLabel } from "./resolveCollectionItems";

export type TableCellDisplay =
  | { kind: "text"; text: string }
  | {
      kind: "tags";
      /** 표시할 칩 라벨 (cap 적용 후). */
      items: string[];
      /** cap 초과분 — 0 이면 overflow 칩 없음. */
      overflow: number;
    };

/** 셀 안 칩 최대 표시 수 — 초과분은 `+N` 칩 1개로 축약. */
export const TABLE_CELL_TAG_CAP = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** scalar → 문자열. readRowCells(resolveCollectionItems.ts) 현행 semantics 와 bit-동일 (BC). */
function stringifyScalarCell(value: unknown): string {
  return value == null ? "" : typeof value === "string" ? value : String(value);
}

/** array 원소 1개 → 칩 라벨. record 는 label 휴리스틱, scalar 는 stringify. */
function tagItemLabel(element: unknown, index: number): string {
  if (isRecord(element)) return getItemLabel(element, "", index);
  return stringifyScalarCell(element);
}

/**
 * Table 셀 raw 값 → 표시 분류. throw 금지 — 모든 입력에 대해 text 또는 tags 반환.
 * 빈 배열은 칩 0개 대신 빈 텍스트 (빈 셀과 시각 동일).
 */
export function classifyTableCellDisplay(value: unknown): TableCellDisplay {
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: "text", text: "" };
    const items = value
      .slice(0, TABLE_CELL_TAG_CAP)
      .map((element, index) => tagItemLabel(element, index));
    return {
      kind: "tags",
      items,
      overflow: Math.max(0, value.length - TABLE_CELL_TAG_CAP),
    };
  }
  if (isRecord(value)) {
    return { kind: "text", text: getItemLabel(value, "", 0) };
  }
  return { kind: "text", text: stringifyScalarCell(value) };
}
