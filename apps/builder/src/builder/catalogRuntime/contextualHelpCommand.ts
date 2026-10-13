import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  assertNestable,
  childList,
  CommandDraft,
  fail,
  locate,
  setChildList,
  type NodeParent,
} from "../../../../../packages/shared/src/catalog/commands/context";
import {
  ensureChildList,
  type NewId,
} from "../../../../../packages/shared/src/catalog/commands/materialize";
import { removeWithReferrers } from "../../../../../packages/shared/src/catalog/commands/structure";
import type {
  CatalogReader,
  DefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  type CatalogPosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";
import { CATALOG_CONTEXTUAL_HELP_FIELDS } from "../../../../../packages/shared/src/domain/componentTraits";
import { parentOfChild, typeOf } from "./fieldPrefixCommand";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "./paletteInsert";

/**
 * ADR-259 Phase 3 — a field's contextual help (S2 `contextualHelp`) as one Design choice: none, or
 * a ContextualHelp origin instance (`help` · `info`) beside the field's Label in its label row
 * (S2 `FieldLabel` — `Field.tsx:96-184`). Adding wraps the Label in a FieldLabel, removing unwraps
 * it; changing the variant writes the help's `variant`. One command = one step (one undo).
 *
 * As with the prefix (ADR-259 Phase 2, 사용자 결정 2026-10-13 「5종 모두 진행」), wrapping the Label
 * of a placed field makes the field's template children owned copies (`ensureChildList`): its Label
 * · Description no longer follow its `label` · `description` props.
 */
export type CatalogContextualHelpKind = "none" | "help" | "info";

const FIELD_LABEL_DEFINITION = "lib:definition:type-FieldLabel" as DefinitionId;

export interface CatalogContextualHelpState {
  kind: CatalogContextualHelpKind;
  label?: CatalogPosition;
  fieldLabel?: CatalogPosition;
  help?: CatalogPosition;
}

/** A help field's label row and help; undefined for any other type. */
export function catalogContextualHelp(
  reader: CatalogReader,
  field: CatalogPosition | undefined,
): CatalogContextualHelpState | undefined {
  if (
    !field ||
    !CATALOG_CONTEXTUAL_HELP_FIELDS.has(typeOf(reader, field.definitionId))
  )
    return undefined;
  let children: CatalogPosition[];
  try {
    children = childPositions(reader, field);
  } catch {
    return undefined;
  }
  const fieldLabel = children.find(
    (child) => typeOf(reader, child.definitionId) === "FieldLabel",
  );
  const inRow = fieldLabel ? childPositions(reader, fieldLabel) : [];
  const label = [...inRow, ...children].find(
    (child) => typeOf(reader, child.definitionId) === "Label",
  );
  const help = inRow.find(
    (child) => typeOf(reader, child.definitionId) === "ContextualHelp",
  );
  if (!help) return { kind: "none", label, fieldLabel };
  const variant =
    help.target.kind === "node" ? reader.getEntry(help.target.id) : undefined;
  const written = variant?.kind === "node" ? variant.props.variant : undefined;
  return {
    kind: written?.kind === "set" && written.value === "info" ? "info" : "help",
    label,
    fieldLabel,
    help,
  };
}

/** Set a field's contextual help: none, `help` or `info` — one step. */
export const catalogContextualHelpCommand =
  (input: {
    field: CatalogPosition;
    kind: CatalogContextualHelpKind;
    newId: NewId;
  }): CatalogCommand =>
  (reader) => {
    const state = catalogContextualHelp(reader, input.field);
    if (!state) return fail("NOT_A_HELP_FIELD", input.field.identity);
    const label =
      input.kind === "none" ? "Remove contextual help" : "Contextual help";
    // A row left without its help (deleted in Layers) still reads "none": None unwraps it.
    if (
      state.kind === input.kind &&
      !(input.kind === "none" && state.fieldLabel)
    )
      return { label, ops: [] };
    const draft = new CommandDraft(reader);

    // Another variant: the help's own prop.
    if (state.help && input.kind !== "none") {
      if (state.help.target.kind !== "node")
        return fail("HELP_NOT_OWNED", state.help.identity);
      const help = draft.node(state.help.target.id);
      draft.write({
        ...help,
        props: { ...help.props, variant: { kind: "set", value: input.kind } },
      });
      return { label, ops: draft.ops() };
    }

    // Take the help out and unwrap the label row (its other children take its place).
    if (input.kind === "none") {
      if (state.fieldLabel?.target.kind !== "node")
        return fail("HELP_ROW_NOT_OWNED", input.field.identity);
      const rowId = state.fieldLabel.target.id;
      const helpId =
        state.help?.target.kind === "node" ? state.help.target.id : undefined;
      const at = locate(draft, rowId).parent;
      const outer = childList(draft, at) ?? [];
      const index = outer.indexOf(rowId);
      const rest = (childList(draft, { kind: "node", id: rowId }) ?? []).filter(
        (id) => id !== helpId,
      );
      setChildList(draft, at, [
        ...outer.slice(0, index),
        ...rest,
        ...outer.slice(index + 1),
      ]);
      draft.write({ ...draft.node(rowId), children: [] });
      removeWithReferrers(draft, helpId ? [helpId, rowId] : [rowId]);
      return { label, ops: draft.ops() };
    }

    if (!state.label) return fail("HELP_LABEL_MISSING", input.field.identity);
    const library = reader.library;
    const helpDefinition = catalogPaletteDefinitionId(
      library,
      "ContextualHelp",
    );
    const help: NodeEntry = {
      kind: "node",
      id: input.newId("node") as NodeId,
      definitionId: helpDefinition,
      children: [],
      props: catalogCreationProps(library, helpDefinition, "ContextualHelp", {
        variant: input.kind,
      }),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    draft.create(help);

    // A row is already there (its help was deleted): the help goes back after its Label.
    if (state.fieldLabel) {
      if (state.fieldLabel.target.kind !== "node")
        return fail("HELP_ROW_NOT_OWNED", input.field.identity);
      const rowAt: NodeParent = {
        kind: "node",
        id: state.fieldLabel.target.id,
      };
      const inRow = childList(draft, rowAt) ?? [];
      const labelAt =
        state.label.target.kind === "node"
          ? inRow.indexOf(state.label.target.id)
          : -1;
      if (labelAt < 0) return fail("HELP_LABEL_MISSING", input.field.identity);
      setChildList(draft, rowAt, [
        ...inRow.slice(0, labelAt + 1),
        help.id,
        ...inRow.slice(labelAt + 1),
      ]);
      return { label, ops: draft.ops() };
    }

    // Wrap the Label in a label row and put the help after it.
    const at = parentOfChild(draft, state.label.target);
    assertNestable(draft, at, [FIELD_LABEL_DEFINITION]);
    const list = ensureChildList(draft, at, input.newId);
    const labelId = list.find(
      (id) => typeOf(reader, draft.node(id).definitionId) === "Label",
    );
    if (!labelId) return fail("HELP_LABEL_MISSING", input.field.identity);
    const row: NodeEntry = {
      kind: "node",
      id: input.newId("node") as NodeId,
      definitionId: FIELD_LABEL_DEFINITION,
      children: [labelId, help.id],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    draft.create(row);
    setChildList(
      draft,
      at,
      list.map((id) => (id === labelId ? row.id : id)),
    );
    return { label, ops: draft.ops() };
  };
