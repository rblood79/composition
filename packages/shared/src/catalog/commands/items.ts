import type {
  AuthoredValue,
  CatalogReader,
  ItemRow,
  ItemValue,
  Scalar,
} from "../document/types";
import type { CatalogCommand } from "./compose";
import { fail, type EditTarget } from "./context";
import { setFields } from "./fields";
import { readTargetProp } from "../resolution/fieldSource";

export { readTargetProp };

/**
 * ADR-248 Phase 4b collection item commands on an items-manager prop (ADR-073 static items,
 * ADR-099 sections and separators). The edit reads the list the target shows now — its own
 * value, else its template's, else the project and library defaults — and writes the whole list
 * back as the target's value (one prop edit, one history entry).
 */

type ItemId = string | number;
export type ItemsEdit =
  | { kind: "add"; item: ItemValue; section?: string; index?: number }
  | { kind: "remove"; id: ItemId; section?: string }
  | {
      kind: "update";
      id: ItemId;
      /** `undefined` drops the cell. */
      patch: Readonly<Record<string, Scalar | undefined>>;
      section?: string;
    }
  | { kind: "move"; id: ItemId; index: number; section?: string };

const asList = (
  value: AuthoredValue | undefined,
): readonly ItemValue[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "object")
    ? (value as readonly ItemValue[])
    : undefined;

/** The list a target shows now. */
export function currentItems(
  reader: CatalogReader,
  target: EditTarget,
  key: string,
): readonly ItemValue[] {
  return asList(readTargetProp(reader, target, key)) ?? [];
}

const indexOf = (
  rows: readonly ItemValue[] | readonly ItemRow[],
  id: ItemId,
) =>
  typeof id === "number"
    ? id >= 0 && id < rows.length
      ? id
      : -1
    : rows.findIndex((row) => row.id === id);

function applyEdit<T extends ItemValue | ItemRow>(
  rows: readonly T[],
  edit: ItemsEdit,
): T[] {
  const next = [...rows];
  if (edit.kind === "add") {
    const at =
      edit.index === undefined || edit.index < 0 || edit.index > next.length
        ? next.length
        : edit.index;
    next.splice(at, 0, structuredClone(edit.item) as T);
    return next;
  }
  const at = indexOf(next, edit.id);
  if (at < 0) return fail("ITEM_NOT_FOUND", String(edit.id));
  if (edit.kind === "remove") next.splice(at, 1);
  else if (edit.kind === "update") {
    const row: Record<string, unknown> = { ...next[at] };
    for (const [cell, value] of Object.entries(edit.patch))
      if (value === undefined) delete row[cell];
      else row[cell] = value;
    next[at] = row as T;
  } else {
    const [row] = next.splice(at, 1);
    next.splice(Math.max(0, Math.min(edit.index, next.length)), 0, row);
  }
  return next;
}

export const editItems =
  (input: {
    target: EditTarget;
    key: string;
    edit: ItemsEdit;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const rows = currentItems(reader, input.target, input.key);
    let next: readonly ItemValue[];
    if (!input.edit.section) next = applyEdit(rows, input.edit);
    else {
      const sectionAt = indexOf(rows, input.edit.section);
      const section = rows[sectionAt];
      if (sectionAt < 0 || section.type !== "section")
        return fail("SECTION_NOT_FOUND", input.edit.section);
      const inner = Array.isArray(section.items)
        ? (section.items as readonly ItemRow[])
        : [];
      if (
        input.edit.kind === "add" &&
        Object.values(input.edit.item).some(Array.isArray)
      )
        fail("SECTION_ROWS_ARE_FLAT", input.edit.section);
      const copy = [...rows];
      copy[sectionAt] = {
        ...section,
        items: applyEdit(inner, input.edit),
      };
      next = copy;
    }
    return setFields({
      targets: [input.target],
      props: { [input.key]: { kind: "set", value: next } },
      label: input.label ?? "Edit items",
    })(reader);
  };
