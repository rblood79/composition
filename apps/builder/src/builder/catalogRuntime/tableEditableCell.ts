/**
 * S2 체크리스트 §9.3 (6-6) — a Table Column's 「Editable」 switch (Design 패널 Property 탭 Behavior,
 * the Column selected): S2 `EditableCell` for the column's body cells. On, each cell holds its
 * content in a frame with S2's edit button (`ActionButton[slot=edit]` — quiet, the edit glyph) and
 * a Form (S2 `EditableCell`'s — its `renderEditing`) with a TextField named by the column's key that
 * starts with the cell's value. Off: the cells hold their content again. Whether it is on is whether
 * the cells hold their Form (`tableColumnEditable`).
 */
import {
  setTableColumnEditable,
  tableColumnEditable,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  NodeEntry,
  NodeId,
  NodeParent,
  TemplateId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogTypeDefinitionId } from "../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { catalogPaletteDefinitionId } from "./paletteInsert";

/** The Column's 「Editable」: true · false, undefined where the switch does not apply. */
export function catalogColumnEditableOn(
  reader: CatalogReader,
  column: NodeParent,
): boolean | undefined {
  return tableColumnEditable(reader, column);
}

/** The switch's command: on (S2 editable cells) · off (the cells as they were). */
export function catalogColumnEditableCommand(
  reader: CatalogReader,
  column: NodeParent,
  on: boolean,
  newId: NewId,
  labels: { edit: (column: string) => string },
): CatalogCommand {
  const definition = (type: string) =>
    catalogPaletteDefinitionId(reader.library, type);
  const entry = (type: string, fields: Partial<NodeEntry> = {}): NodeEntry => ({
    kind: "node",
    id: newId("node") as NodeId,
    definitionId: definition(type) as NodeEntry["definitionId"],
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...fields,
  });
  const set = <T>(value: T) => ({ kind: "set" as const, value });
  return setTableColumnEditable({
    column,
    on,
    buildText: (text) => {
      // (S2's example: the value truncates before the button — `minWidth: 0` · `truncate`.)
      const node = entry("Text", {
        props: { children: set(text) },
        sizing: { minWidth: set(0) },
      } as Partial<NodeEntry>);
      return { entries: [node], rootId: node.id };
    },
    buildEditButton: (label) => {
      const node = entry("ActionButton", {
        props: {
          slot: set("edit"),
          isQuiet: set(true),
          icon: set("pencil"),
          label: set(""),
        },
        metadata: { ariaLabel: labels.edit(label) },
      });
      return { entries: [node], rootId: node.id };
    },
    // (S2's example `div`: `display: flex` · `alignItems: center` · `gap: 8` ·
    //  `justifyContent: space-between`.)
    buildContent: (childIds) =>
      entry("frame", {
        children: [...childIds],
        visual: { gap: set(8), width: set("100%") },
        layout: {
          display: set("flex"),
          flexDirection: set("row"),
          alignItems: set("center"),
          justifyContent: set("space-between"),
        },
      } as Partial<NodeEntry>),
    buildForm: ({ key, text, label }) => {
      const fieldDefinition = definition("TextField");
      const library = reader.library.definitions.get(
        fieldDefinition as never,
      ) as { templateRootId?: TemplateId } | undefined;
      const fieldId = newId("node") as NodeId;
      // (S2's example field: no visible label — its accessible name — named by the column, starting
      //  at the cell's value, focused when the popover opens. The origin's own root takes them.)
      const field: NodeEntry = {
        kind: "node",
        id: fieldId,
        definitionId: fieldDefinition as NodeEntry["definitionId"],
        children: [],
        props: { label: set(""), placeholder: set("") },
        visual: {},
        sizing: {},
        metadata: { ariaLabel: labels.edit(label) },
        descendantOverrides: library?.templateRootId
          ? [
              {
                kind: "patch",
                address: {
                  instances: [fieldId],
                  templatePath: [library.templateRootId],
                },
                props: {
                  name: set(key),
                  value: set(text),
                  autoFocus: set(true),
                },
              },
            ]
          : [],
      } as NodeEntry;
      // (A bare Form — S2's `EditableCell` Form holds only `renderEditing`, not the palette Form
      //  origin's fields and buttons.)
      const form: NodeEntry = {
        ...entry("Form", { children: [fieldId] }),
        definitionId: catalogTypeDefinitionId(
          "Form",
        ) as NodeEntry["definitionId"],
      };
      return { entries: [form, field], rootId: form.id };
    },
    newId,
  });
}
