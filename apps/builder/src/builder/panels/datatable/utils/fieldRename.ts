/**
 * 필드 이름 변경 계획 — 격자 헤더 인라인 rename 과 필드 패널 이름 input 이 같은 판정을 쓴다.
 * 순수 함수: 빈 값 · 같은 값 · 중복 · 정상 (→ `update_field { key }` op 1개). 행 이전은 적용기 몫.
 */
import type { DataOp } from "@composition/shared";
import type { DataField } from "../../../../types/builder/data.types";

export type FieldRenamePlan =
  | { kind: "noop" }
  | { kind: "empty" }
  | { kind: "dup"; key: string }
  | { kind: "ok"; key: string; op: DataOp };

export function planFieldRename(
  collectionId: string,
  field: DataField,
  existingKeys: readonly string[],
  raw: string,
): FieldRenamePlan {
  const key = raw.trim();
  if (key === field.key) return { kind: "noop" };
  if (key === "") return { kind: "empty" };
  if (existingKeys.includes(key)) return { kind: "dup", key };
  return {
    kind: "ok",
    key,
    op: {
      op: "update_field",
      collectionId,
      fieldId: field.id ?? field.key,
      patch: { key },
    },
  };
}
