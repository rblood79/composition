/**
 * 셀 값 강제 · 표시 — ADR-212 Phase 2.
 *
 * 편집기 · 붙여넣기가 같은 규칙으로 문자열을 필드 타입 값으로 바꾼다. 실패는 `ok: false` +
 * `null` — 값을 0 이나 오늘 날짜로 바꿔 넣지 않는다 (UX-3, 리서치 U6 의 `convertValueToType`
 * 와 다른 점). 빈 입력은 어느 타입이든 `null` (성공).
 */
import type { DataField, DataFieldType } from "../../../../types/builder/data.types";
import { coerceDateText } from "../../../../../../../packages/shared/src/state/dateValueEditing";
import { readEncodedText } from "../../../../../../../packages/shared/src/collections/intake/encoding";
import { readTextCell } from "../../../../../../../packages/shared/src/collections/intake/normalizeRows";

export type CoercedCell =
  { ok: true; value: unknown } | { ok: false; value: null };

const FAIL: CoercedCell = { ok: false, value: null };

/**
 * ADR-313 Decision 4 — 격자 입력 · 붙여넣기 · 행 양식은 글자 원본이다: 선언의 표기 (`encoding` — `"Y"`)
 * 를 먼저 읽고, 아니면 열 타입의 글자 읽기 (shared `readTextCell` — 진입 변환기와 같은 함수). 수로 정확히
 * 옮겨지지 않는 숫자 글자 (`9007199254740993`) 는 실패다 (HC7 — 근삿값을 넣지 않는다).
 */
export function coerceCellValue(
  type: DataFieldType,
  raw: string,
  encoding?: DataField["encoding"],
): CoercedCell {
  const declared = encoding ? readEncodedText(encoding, raw) : undefined;
  const read = declared ?? readTextCell(type, raw, coerceDateText);
  return read.ok ? { ok: true, value: read.value } : FAIL;
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
