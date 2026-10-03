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
    if (value === undefined) continue;
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
    visual: {},
    sizing: {},
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
      return command;
    } catch {
      continue;
    }
  }
  return undefined;
}
