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
 * (S2 `FieldLabel` — `Field.tsx:96-184`). Every field origin holds the row (S2 — 2026-11-18): adding
 * puts the help after the row's Label, removing takes it out and leaves the row; changing the
 * variant writes the help's `variant`. A field placed before the row was in its origin has its Label
 * wrapped in a new row. One command = one step (one undo).
 *
 * As with the prefix (ADR-259 Phase 2, 사용자 결정 2026-10-13 「5종 모두 진행」), writing into the
 * row of a placed field makes the field's template children owned copies (`ensureChildList`): its
 * Label · Description no longer follow its `label` · `description` props.
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
  // (A Slider's label row sits in its label container — S2 `labelContainer`, 2026-11-18.)
  children = children.flatMap((child) => {
    if (typeOf(reader, child.definitionId) !== "SliderLabelContainer")
      return [child];
    try {
      return childPositions(reader, child);
    } catch {
      return [];
    }
  });
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
    if (state.kind === input.kind) return { label, ops: [] };
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

    // Take the help out of its row (the row stays — S2's FieldLabel is always there).
    if (input.kind === "none") {
      if (state.help?.target.kind !== "node")
        return fail("HELP_NOT_OWNED", input.field.identity);
      const helpId = state.help.target.id;
      const at = locate(draft, helpId).parent;
      setChildList(
        draft,
        at,
        (childList(draft, at) ?? []).filter((id) => id !== helpId),
      );
      removeWithReferrers(draft, [helpId]);
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
      props: catalogCreationProps(reader, helpDefinition, "ContextualHelp", {
        variant: input.kind,
      }),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    draft.create(help);

    // The row is there (the origin's, or a placed one's own): the help goes after its Label.
    if (state.fieldLabel) {
      let rowId: NodeId;
      if (state.fieldLabel.target.kind === "node")
        rowId = state.fieldLabel.target.id;
      else {
        const list = ensureChildList(
          draft,
          parentOfChild(draft, state.fieldLabel.target),
          input.newId,
        );
        const found = list.find(
          (id) => typeOf(reader, draft.node(id).definitionId) === "FieldLabel",
        );
        if (!found) return fail("HELP_ROW_NOT_OWNED", input.field.identity);
        rowId = found;
      }
      const rowAt: NodeParent = { kind: "node", id: rowId };
      const inRow = ensureChildList(draft, rowAt, input.newId);
      const labelAt = inRow.findIndex(
        (id) => typeOf(reader, draft.node(id).definitionId) === "Label",
      );
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
