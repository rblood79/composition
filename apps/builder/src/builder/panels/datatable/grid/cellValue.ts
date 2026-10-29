/**
 * 셀 값 강제 · 표시 — ADR-212 Phase 2.
 *
 * 편집기 · 붙여넣기가 같은 규칙으로 문자열을 필드 타입 값으로 바꾼다. 실패는 `ok: false` +
 * `null` — 값을 0 이나 오늘 날짜로 바꿔 넣지 않는다 (UX-3, 리서치 U6 의 `convertValueToType`
 * 와 다른 점). 빈 입력은 어느 타입이든 `null` (성공).
 */
import type { DataFieldType } from "../../../../types/builder/data.types";
import { coerceDateText } from "../../../../../../../packages/shared/src/state/dateValue";

export type CoercedCell =
  { ok: true; value: unknown } | { ok: false; value: null };

const FAIL: CoercedCell = { ok: false, value: null };
const EMPTY: CoercedCell = { ok: true, value: null };

export function coerceCellValue(type: DataFieldType, raw: string): CoercedCell {
  const text = raw.trim();
  if (text === "") return EMPTY;
  switch (type) {
    case "number": {
      if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text)) return FAIL;
      const value = Number(text);
      return Number.isFinite(value) ? { ok: true, value } : FAIL;
    }
    case "boolean": {
      const lower = text.toLowerCase();
      if (["true", "1", "yes", "y"].includes(lower))
        return { ok: true, value: true };
      if (["false", "0", "no", "n"].includes(lower))
        return { ok: true, value: false };
      return FAIL;
    }
    case "date": {
      // (The variables' date — an ISO text whose shape says its precision; a looser text the
      //   browser reads becomes a day · a day and time, `coerceDateText`.)
      const value = coerceDateText(text);
      return value === undefined ? FAIL : { ok: true, value };
    }
    case "array":
    case "object": {
      // (One JSON type on screen — an object or an array, 2026-10-29.)
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return FAIL;
      }
      if (typeof parsed !== "object" || parsed === null) return FAIL;
      return { ok: true, value: parsed };
    }
    default:
      return { ok: true, value: text };
  }
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export type CellEditorKind = "inline" | "popover";

/**
 * 긴 값 · JSON 은 Popover 편집 (RAC 권고 Y2) — 셀 안 한 줄 input 으로는 못 다룬다. 날짜는 셀 안의
 * 브라우저 날짜 선택기 (변수 표와 같은 편집 — 2026-10-29).
 */
export const INLINE_TEXT_MAX = 80;

export function resolveCellEditorKind(
  type: DataFieldType,
  value: unknown,
): CellEditorKind {
  if (type === "array" || type === "object") return "popover";
  if (type === "date") return "inline";
  const text = formatCellValue(value);
  return text.length > INLINE_TEXT_MAX || text.includes("\n")
    ? "popover"
    : "inline";
}
