import type {
  AuthoredValue,
  CatalogReader,
  DefinitionId,
  ItemRow,
  ItemValue,
  NodeEntry,
  Scalar,
  TemplateId,
} from "../document/types";
import type { CatalogCommand } from "./compose";
import { fail, overrideAt, type EditTarget } from "./context";
import { setFields } from "./fields";

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

/** Project default (definition override) or definition default of a prop. */
function definitionDefault(
  reader: CatalogReader,
  definitionId: DefinitionId,
  key: string,
): AuthoredValue | undefined {
  const project = reader.getEntry(reader.projectId);
  if (project?.kind === "project" && definitionId.startsWith("lib:"))
    for (const id of project.overrideIds) {
      const override = reader.getEntry(id);
      if (
        override?.kind === "definitionOverride" &&
        override.targetId === definitionId
      ) {
        const write = override.defaults[key];
        if (write?.kind === "set") return write.value;
      }
    }
  if (definitionId.startsWith("lib:"))
    return reader.library.definitions.get(
      definitionId as `lib:definition:${string}`,
    )?.defaults[key];
  const definition = reader.getEntry(definitionId);
  return definition?.kind === "definition"
    ? definition.defaults[key]
    : undefined;
}

/**
 * A prop value a target shows now: its own value, else (a template position) its path patch, the
 * enclosing library patch, the template node's value; else the project and library defaults.
 * `undefined` when none sets it.
 */
export function readTargetProp(
  reader: CatalogReader,
  target: EditTarget,
  key: string,
): AuthoredValue | undefined {
  if (target.kind === "node") {
    const node = reader.getEntry(target.id);
    if (node?.kind !== "node") return fail("NODE_REQUIRED", target.id);
    const own = node.props[key];
    if (own?.kind === "set") return own.value;
    if (own?.kind === "mask") return undefined;
    return definitionDefault(reader, node.definitionId, key);
  }
  const owner = reader.getEntry(target.ownerId) as NodeEntry | undefined;
  if (owner?.kind !== "node") return fail("NODE_REQUIRED", target.ownerId);
  const patch = overrideAt(owner, target.address);
  const patched = patch?.kind === "patch" ? patch.props?.[key] : undefined;
  if (patched?.kind === "set") return patched.value;
  if (patched?.kind === "mask") return undefined;
  const path = target.address.templatePath;
  const templateId = path[path.length - 1] as TemplateId;
  const instances = target.address.instances;
  // An enclosing library template's patch at this path, then the template node itself.
  if (instances.length > 1) {
    const step = reader.library.templates.get(
      instances[instances.length - 1] as `lib:template:${string}`,
    );
    const libraryPatch = step?.descendantPatches?.find(
      (item) => item.templatePath.join() === path.join(),
    );
    const value = libraryPatch?.props?.[key];
    if (value !== undefined) return value;
  }
  const template = templateId.startsWith("lib:")
    ? reader.library.templates.get(templateId as `lib:template:${string}`)
    : reader.getEntry(templateId);
  if (!template || ("kind" in template && template.kind !== "node"))
    return fail("DANGLING_TEMPLATE", templateId);
  const own = template.props[key];
  if (own !== undefined) {
    if (typeof own === "object" && own !== null && "kind" in own) {
      if (own.kind === "set") return own.value;
      if (own.kind === "mask") return undefined;
    } else return own as AuthoredValue;
  }
  return definitionDefault(reader, template.definitionId, key);
}

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
