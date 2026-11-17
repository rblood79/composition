/**
 * ADR-313 사용자 결정 6 (2026-11-17 「타입 변경과 같은 규칙」) — 열의 값 표현을 바꿀 때 작성 행: 새 표현으로
 * 읽히는 값은 바꾸고 (`"Y"` → `true`), 못 읽는 값은 사용자가 「비움 / 유지」 를 고른다 (타입 변경 UX-5 와 같은
 * 확인). 읽기는 진입 변환기와 같은 `readEncoded` (작성 행은 JSON 값이다 — 이미 정규 값이면 그대로). 순수 함수.
 */
import type { DataOp } from "@composition/shared";
import { readEncoded } from "../../../../../../../packages/shared/src/collections/intake/encoding";
import type { DataField } from "../../../../types/builder/data.types";
import type { ColumnChoice } from "./encodingChoices";

export interface EncodingChangePreview {
  total: number;
  invalidRowIndexes: number[];
  /** 읽혀서 값이 바뀌는 셀. */
  converted: { rowIndex: number; value: unknown }[];
}

export function previewEncodingChange(
  field: DataField,
  choice: ColumnChoice,
  rows: readonly Record<string, unknown>[],
): EncodingChangePreview {
  const invalidRowIndexes: number[] = [];
  const converted: { rowIndex: number; value: unknown }[] = [];
  if (choice.encoding)
    rows.forEach((row, rowIndex) => {
      const raw = row[field.key];
      if (raw === null || raw === undefined || raw === "") return;
      const read = readEncoded(choice.encoding!, raw);
      if (!read.ok) invalidRowIndexes.push(rowIndex);
      else if (!Object.is(read.value, raw))
        converted.push({ rowIndex, value: read.value });
    });
  return { total: rows.length, invalidRowIndexes, converted };
}

/** 값 표현 변경의 DataChange — `update_field` (타입 · 표현) + 바뀌는 셀 + (비움이면) 못 읽은 셀 null. */
export function encodingChangeToOps(
  collectionId: string,
  field: DataField,
  choice: ColumnChoice,
  preview: EncodingChangePreview,
  mode: "keep" | "clear",
  extraPatch: Record<string, unknown> = {},
): DataOp[] {
  const fieldId = field.id ?? field.key;
  const patch: Record<string, unknown> = {
    ...extraPatch,
    ...(choice.type !== field.type ? { type: choice.type } : {}),
    encoding: choice.encoding ?? null,
    // (A text kind — email · URL — belongs to a plain text column.)
    ...(field.format && (choice.type !== "string" || choice.encoding)
      ? { format: null }
      : {}),
  };
  const ops: DataOp[] = [{ op: "update_field", collectionId, fieldId, patch }];
  for (const { rowIndex, value } of preview.converted)
    ops.push({ op: "set_cell", collectionId, rowIndex, fieldId, value });
  if (mode === "clear")
    for (const rowIndex of preview.invalidRowIndexes)
      ops.push({
        op: "set_cell",
        collectionId,
        rowIndex,
        fieldId,
        value: null,
      });
  return ops;
}
