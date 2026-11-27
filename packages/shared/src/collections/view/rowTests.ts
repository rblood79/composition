/**
 * ADR-320 Decision 3 — a condition tree (`ViewConditionGroup`) as the row tests that run it on row
 * numbers (`rowFilter.ts`). What applies is the one evaluator's reading (`readViewCondition` — a
 * condition turned off, a value that skips it, a field the schema does not have): such a
 * condition is left out, so a group all of whose conditions are left out is skipped.
 */
import type {
  ViewCondition,
  ViewConditionGroup,
} from "../../catalog/document/types";
import {
  readViewCondition,
  viewCellOf,
  type ViewRunField,
  type ViewRunInput,
} from "./evaluate";
import type { ViewRowTest, ViewRowTestGroup } from "./rowFilter";

/**
 * A condition tree as row tests over `rows`. `valueAt` = how a field's cell of a row number is
 * read (absent = the views' own reading of `rows[index]` — `viewCellOf`).
 */
export function viewRowTestGroupOf(
  group: ViewConditionGroup,
  input: Pick<ViewRunInput, "schema" | "resolve" | "references">,
  rows: readonly unknown[],
  valueAt?: (field: ViewRunField) => (index: number) => unknown,
): ViewRowTestGroup {
  const test = (condition: ViewCondition): ViewRowTest | undefined => {
    const read = readViewCondition(condition, input);
    if (read.skip) return undefined;
    return {
      fields: read.fields.map((field) => ({
        valueAt:
          valueAt?.(field) ??
          ((index: number) => viewCellOf(rows[index], field)),
        ...(field.type !== undefined ? { type: field.type } : {}),
        name: field.key,
      })),
      op: condition.op,
      ...(read.value !== undefined ? { value: read.value } : {}),
      ...(condition.sensitivity ? { sensitivity: condition.sensitivity } : {}),
      ...(condition.unit ? { unit: condition.unit } : {}),
    };
  };
  return {
    op: group.op,
    items: group.items.flatMap((item): (ViewRowTest | ViewRowTestGroup)[] => {
      if ("items" in item)
        return [viewRowTestGroupOf(item, input, rows, valueAt)];
      const made = test(item);
      return made ? [made] : [];
    }),
  };
}
