import { getReusableOriginId } from "../../../../../packages/shared/src/catalog/componentCatalog";
import { insertNodes } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { catalogTypeDefinitionId } from "../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  CatalogReader,
  LibraryDefinitionId,
  EditTarget,
  NodeEntry,
  NodeId,
  NodeParent,
  PropWrites,
} from "../../../../../packages/shared/src/catalog/document/types";
import { getDefaultProps } from "../../types/builder/unified.types";
import type { CatalogConsumerNode } from "./compositionRoot";
import type { CatalogSelectionItem } from "./session";
import { catalogStyleWrites, type CatalogStyleFieldWrites } from "./styleFields";

/** What a palette insert reads from the open project (`CatalogWorkspace`). */
export interface CatalogPaletteHost {
  readonly graph: CatalogReader;
  readonly records: ReadonlyMap<string, CatalogConsumerNode>;
  selection(): readonly CatalogSelectionItem[];
  /** The selection item (edit target) of a drawn record, if it is an element row. */
  itemOfRecord(identity: string): CatalogSelectionItem | undefined;
  /** The open page's body node. */
  /** Where content goes without a selection: the page body or its layout's content slot. */
  pageContent(): EditTarget | undefined;
  newId: NewId;
}

/**
 * The library definition a palette type creates: its reusable origin when the catalog has one (the
 * old palette made every such item an instance of that origin, ADR-228), else the type's
 * definition.
 */
export function catalogPaletteDefinitionId(
  library: CatalogLibrary,
  type: string,
): LibraryDefinitionId {
  const reusableId = getReusableOriginId(type);
  const origin = reusableId && `lib:definition:origin-${reusableId}`;
  return origin && library.definitions.has(origin as LibraryDefinitionId)
    ? (origin as LibraryDefinitionId)
    : catalogTypeDefinitionId(type);
}

/**
 * The own props a new node of a palette type starts with: the type's creation defaults (the old
 * palette's `getDefaultProps` — a Text's text, an Icon's glyph …) and the item's initial props,
 * kept where the definition accepts the key and the value differs from its default (so editing the
 * definition still reaches the node). `chartType` marks the palette entry point and is kept as
 * given.
 */
export function catalogCreationProps(
  library: CatalogLibrary,
  definitionId: LibraryDefinitionId,
  type: string,
  initialProps?: Readonly<Record<string, unknown>>,
): Record<string, PropWrites[string]> {
  const definition = library.definitions.get(definitionId) as
    | {
        accepts?: Readonly<Record<string, unknown>>;
        defaults?: Readonly<Record<string, unknown>>;
      }
    | undefined;
  const accepts = definition?.accepts ?? {};
  const defaults = definition?.defaults ?? {};
  const props: Record<string, PropWrites[string]> = {};
  const given = { ...(getDefaultProps(type) as Record<string, unknown>) };
  for (const [key, value] of Object.entries(initialProps ?? {}))
    given[key] = value;
  for (const [key, value] of Object.entries(given)) {
    // `style` is the old element model's CSS bag — a catalog node keeps it in typed fields
    // (`catalogCreationStyle`), never as a prop (the document rejects an object prop value).
    if (value === undefined || key === "style") continue;
    const initial = initialProps !== undefined && key in initialProps;
    if (key !== "chartType" && !(key in accepts) && !initial) continue;
    if (
      key === "chartType" ||
      JSON.stringify(defaults[key]) !== JSON.stringify(value)
    )
      props[key] = { kind: "set", value } as PropWrites[string];
  }
  return props;
}

/**
 * The typed fields (`visual` · `layout` · `sizing`) of a palette item's initial `style` — the old
 * element model's creation size (Chart's `style: { width: 320 }`). Only set writes: a new node
 * has nothing to remove.
 */
export function catalogCreationStyle(
  initialProps?: Readonly<Record<string, unknown>>,
): Required<Pick<NodeEntry, "visual" | "sizing">> & Pick<NodeEntry, "layout"> {
  const style = initialProps?.style;
  const fields: CatalogStyleFieldWrites = { visual: {}, layout: {}, sizing: {} };
  if (style && typeof style === "object" && !Array.isArray(style))
    for (const [key, raw] of Object.entries(style)) {
      if (typeof raw !== "string" && typeof raw !== "number") continue;
      const writes = catalogStyleWrites(key, raw);
      for (const group of ["visual", "layout", "sizing"] as const)
        for (const [field, write] of Object.entries(writes[group] ?? {}))
          if (write?.kind === "set")
            (fields[group] as Record<string, unknown>)[field] = write;
    }
  return {
    visual: fields.visual as NodeEntry["visual"],
    sizing: fields.sizing as NodeEntry["sizing"],
    ...(Object.keys(fields.layout!).length
      ? { layout: fields.layout as NodeEntry["layout"] }
      : {}),
  };
}

const parentOf = (target: EditTarget): NodeParent =>
  target.kind === "node"
    ? { kind: "node", id: target.id }
    : { kind: "descendant", ownerId: target.ownerId, address: target.address };

/**
 * ADR-248 Phase 4e-4: a Components palette item as one insert command — a new node of the item's
 * library definition (initial props that differ from its defaults as own writes; a composite shows
 * its template children),
 * appended to the selected element, or to the nearest ancestor that can hold it (the old
 * creation rule), or to the open page's body when nothing is selected. `undefined` = no place
 * accepts it. The command selects the new node.
 */
export function catalogPaletteInsertCommand(
  host: CatalogPaletteHost,
  type: string,
  initialProps?: Readonly<Record<string, unknown>>,
): CatalogCommand | undefined {
  return catalogPaletteInsertPlan(host, type, initialProps)?.command;
}

/** The insert's placement outcome: where it went, and what refused the aimed target (if any). */
export interface CatalogPaletteInsertPlan {
  command: CatalogCommand;
  /** The first candidate (the selection) refused it; the insert went to `target` instead. */
  relocated?: { refusal: unknown; target: EditTarget };
}

/**
 * `catalogPaletteInsertCommand` with the outcome: the caller tells the user when the element did
 * not go where they aimed (the old creation notice), and why nothing accepted it (`refusal`).
 */
export function catalogPaletteInsertPlan(
  host: CatalogPaletteHost,
  type: string,
  initialProps?: Readonly<Record<string, unknown>>,
): CatalogPaletteInsertPlan | { command?: undefined; refusal: unknown } {
  const definitionId = catalogPaletteDefinitionId(host.graph.library, type);
  const props = catalogCreationProps(
    host.graph.library,
    definitionId,
    type,
    initialProps,
  );
  const entry: NodeEntry = {
    kind: "node",
    id: host.newId("node") as NodeId,
    definitionId,
    children: [],
    props,
    ...catalogCreationStyle(initialProps),
    descendantOverrides: [],
  };
  const candidates: EditTarget[] = [];
  const [first] = host.selection();
  if (first) {
    candidates.push(first.target);
    for (
      let record = host.records.get(
        host.records.get(first.identity)?.parentId ?? "",
      );
      record;
      record = host.records.get(record.parentId)
    ) {
      const item = host.itemOfRecord(record.id);
      if (!item) break;
      candidates.push(item.target);
    }
  }
  const content = host.pageContent();
  if (content) candidates.push(content);
  let refusal: unknown;
  for (const target of candidates) {
    const command = insertNodes({
      parent: parentOf(target),
      entries: [entry],
      rootIds: [entry.id],
      newId: host.newId,
      label: "Add element",
    });
    try {
      // The command's own checks (nesting, a composite's template) decide where it can go.
      command(host.graph);
      return refusal === undefined
        ? { command }
        : { command, relocated: { refusal, target } };
    } catch (error) {
      refusal ??= error;
      continue;
    }
  }
  return { refusal };
}
