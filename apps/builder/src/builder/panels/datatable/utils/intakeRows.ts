/**
 * ADR-313 Decision 4 — Builder 진입의 변환기 호출 한 곳. shared `normalizeRows` 에 Builder 의 날짜 글자 읽기
 * (`coerceDateText` — 격자 입력과 같은 넓은 읽기) 를 붙인다. 붙여넣기 · 파일 · 기존 표로 가져오기 · AI 붙여넣기
 * 가 이 함수를 지난다 (API 실행은 `intakeQueryItems`).
 */
import {
  normalizeRows,
  type IntakeField,
  type IntakeResult,
  type IntakeSource,
} from "../../../../../../../packages/shared/src/collections/intake/normalizeRows";
import { coerceDateText } from "../../../../../../../packages/shared/src/state/dateValueEditing";

export function intakeRows<Row extends Readonly<Record<string, unknown>>>(
  rows: readonly Row[],
  fields: readonly IntakeField[],
  source: IntakeSource,
  keyField?: string,
): IntakeResult<Row> {
  return normalizeRows(rows, fields, source, {
    readDateText: coerceDateText,
    ...(keyField ? { keyField } : {}),
  });
}
