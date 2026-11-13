import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  assertNestable,
  CommandDraft,
  definitionTypeName,
  fail,
  locate,
  setChildList,
  childList,
} from "../../../../../packages/shared/src/catalog/commands/context";
import {
  ensureChildList,
  type NewId,
} from "../../../../../packages/shared/src/catalog/commands/materialize";
import { removeWithReferrers } from "../../../../../packages/shared/src/catalog/commands/structure";
import type {
  CatalogReader,
  DefinitionId,
  EditTarget,
  NodeEntry,
  NodeId,
  NodeParent,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  type CatalogPosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";
import {
  CATALOG_PREFIX_FIELDS,
} from "../../../../../packages/shared/src/catalog/runtime/fieldPrefix";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "./paletteInsert";

/**
 * ADR-259 Phase 2 — a field's prefix (S2 `prefix`) as one Design choice: none, a Text, or an Icon in
 * the field's control Group (S2 `FieldGroup`), before its Input. Every prefix field has that Group
 * (2026-11-14 — no migration of documents saved before, 사용자). Removing the prefix keeps the Group.
 * One command = one step (one undo).
 *
 * An instance's template children become owned copies at the first structural edit there
 * (`ensureChildList`): a wrapped field's Label · Input · Description no longer follow its `label` ·
 * `placeholder` · `description` props, a NumberField's · ComboBox's Input its `placeholder` (user
 * decisions 2026-10-12 「A」 · 2026-10-13 「5종 모두 진행」).
 */
export type CatalogFieldPrefixKind = "none" | "text" | "icon";

const PREFIX_DEFAULTS = {
  text: { type: "Text", props: { children: "$" } },
  icon: { type: "Icon", props: { iconName: "search" } },
} as const;

export function typeOf(
  reader: CatalogReader,
  definitionId: DefinitionId,
): string {
  try {
    return definitionTypeName(reader, definitionId);
  } catch {
    return "";
  }
}

/** The list a child position sits in: its owner node, else its template parent position. */
export function parentOfChild(
  draft: CommandDraft,
  target: EditTarget,
): NodeParent {
  if (target.kind === "node") return locate(draft, target.id).parent;
  const path = target.address.templatePath;
  if (path.length < 2) return fail("PREFIX_PARENT_UNKNOWN", target.ownerId);
  return {
    kind: "descendant",
    ownerId: target.ownerId,
    address: { ...target.address, templatePath: path.slice(0, -1) },
  };
}

export const parentOfTarget = (target: EditTarget): NodeParent =>
  target.kind === "node"
    ? { kind: "node", id: target.id }
    : { kind: "descendant", ownerId: target.ownerId, address: target.address };

export interface CatalogFieldPrefixState {
  kind: CatalogFieldPrefixKind;
  /** The field's control Group (absent on a TextField · TextArea · ColorField without a prefix). */
  group?: CatalogPosition;
  prefix?: CatalogPosition;
  input?: CatalogPosition;
}

/** A prefix field's prefix and its parts; undefined for any other type. */
export function catalogFieldPrefix(
  reader: CatalogReader,
  field: CatalogPosition | undefined,
): CatalogFieldPrefixState | undefined {
  if (!field || !CATALOG_PREFIX_FIELDS.has(typeOf(reader, field.definitionId)))
    return undefined;
  let children: CatalogPosition[];
  try {
    children = childPositions(reader, field);
  } catch {
    return undefined;
  }
  const group = children.find(
    (child) => typeOf(reader, child.definitionId) === "Group",
  );
  const inGroup = group ? childPositions(reader, group) : [];
  const input = [...inGroup, ...children].find(
    (child) => typeOf(reader, child.definitionId) === "Input",
  );
  const prefix = inGroup.find((child) => {
    const type = typeOf(reader, child.definitionId);
    if (type !== "Text" && type !== "Icon") return false;
    const entry =
      child.target.kind === "node"
        ? reader.getEntry(child.target.id)
        : undefined;
    const slot = entry?.kind === "node" ? entry.props.slot : undefined;
    return slot?.kind === "set" && slot.value === "prefix";
  });
  const kind: CatalogFieldPrefixKind = !prefix
    ? "none"
    : typeOf(reader, prefix.definitionId) === "Icon"
      ? "icon"
      : "text";
  return { kind, group, prefix, input };
}

/** Set a field's prefix: none, a Text (`$`) or an Icon (`search`) — one step. */
export const catalogFieldPrefixCommand =
  (input: {
    field: CatalogPosition;
    kind: CatalogFieldPrefixKind;
    newId: NewId;
  }): CatalogCommand =>
  (reader) => {
    const state = catalogFieldPrefix(reader, input.field);
    if (!state) return fail("NOT_A_PREFIX_FIELD", input.field.identity);
    const label = input.kind === "none" ? "Remove prefix" : "Prefix";
    if (state.kind === input.kind) return { label, ops: [] };
    const draft = new CommandDraft(reader);

    // Take the current prefix out. (The Group stays: it is the field's S2 `FieldGroup` box with or
    //  without a prefix — 2026-11-14.)
    if (state.prefix) {
      if (state.prefix.target.kind !== "node")
        return fail("PREFIX_NOT_OWNED", state.prefix.identity);
      const prefixId = state.prefix.target.id;
      const at = locate(draft, prefixId).parent;
      const list = childList(draft, at) ?? [];
      const rest = list.filter((id) => id !== prefixId);
      setChildList(draft, at, rest);
      removeWithReferrers(draft, [prefixId]);
      if (input.kind === "none") return { label, ops: draft.ops() };
    }

    // Put the new prefix first in the field's Group.
    const spec = PREFIX_DEFAULTS[input.kind as "text" | "icon"];
    const library = reader.library;
    const definitionId = catalogPaletteDefinitionId(library, spec.type);
    const prefix: NodeEntry = {
      kind: "node",
      id: input.newId("node") as NodeId,
      definitionId,
      children: [],
      props: {
        ...catalogCreationProps(library, definitionId, spec.type, spec.props),
        slot: { kind: "set", value: "prefix" },
      },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    draft.create(prefix);
    if (state.group) {
      const at = parentOfTarget(state.group.target);
      assertNestable(draft, at, [definitionId]);
      const list = ensureChildList(draft, at, input.newId).filter(
        (id) => !draft.removed(id),
      );
      setChildList(draft, at, [prefix.id, ...list]);
      return { label, ops: draft.ops() };
    }
    return fail("PREFIX_GROUP_MISSING", input.field.identity);
  };
