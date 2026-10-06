import type {
  CatalogLibrary,
  CatalogReader,
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { createLayout } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import {
  BASE_PART_DERIVED_ORIGINS,
  BASE_PART_ORIGIN_TYPES,
} from "../../../../../packages/shared/src/catalog/componentCatalog";
import { getPaletteItems } from "../panels/components/paletteItems";
import { isComponentsView, isLibraryOrigin } from "./originView";
import { catalogPaletteDefinitionId } from "./paletteInsert";
import type { CatalogDefinitionViewId } from "./session";

/** A project definition the Navigator lists (the definition edit view opens it). */
export interface CatalogDefinitionItem {
  id: EntryId<"definition">;
  name: string;
  usage: "layout" | "component";
}

/** The Navigator's tabs: Pages, the project's components, its layouts. */
export type CatalogNavigatorTab = "pages" | "components" | "layouts";

/**
 * ADR-248 4e: the project's layouts, then its components (document order within each) — the
 * Navigator's lists (`usage` = one kind, its tab); selecting one opens the definition edit view.
 */
export function catalogDefinitionList(
  graph: CatalogReader,
  usage?: CatalogDefinitionItem["usage"],
): CatalogDefinitionItem[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  const items = project.definitionIds.flatMap((id) => {
    const definition = graph.getEntry(id);
    return definition?.kind === "definition" && definition.templateRootId
      ? [
          {
            id,
            name: definition.name,
            usage:
              definition.usage === "layout"
                ? ("layout" as const)
                : ("component" as const),
          },
        ]
      : [];
  });
  if (usage) return items.filter((item) => item.usage === usage);
  return [
    ...items.filter((item) => item.usage === "layout"),
    ...items.filter((item) => item.usage === "component"),
  ];
}

/** A built-in component origin the Components tab lists (its edit view shows a derived sample). */
export interface CatalogBuiltinOrigin {
  id: LibraryDefinitionId;
  name: string;
  /** The palette category it is registered under (`PALETTE_CATEGORIES` key); `parts` = a base part. */
  category: string;
  /**
   * The palette's creation variants of the origin, palette order (a Chart's chart types: one
   * palette item each, the same origin with other initial props). Absent = one palette item.
   */
  kinds?: {
    key: string;
    label: string;
    initialProps: Record<string, unknown>;
  }[];
}
/**
 * The built-in component origins the Components page draws (user 2026-10-01 · 2026-10-05): the
 * reusable origin of each type the Components palette registers, in palette order (one each).
 */
export function catalogBuiltinOrigins(
  library: CatalogLibrary,
): CatalogBuiltinOrigin[] {
  const seen = new Map<string, CatalogBuiltinOrigin>();
  // The base parts first (ADR-253): the origins the composed components below are built from.
  const parts: CatalogBuiltinOrigin[] = BASE_PART_ORIGIN_TYPES.flatMap(
    (type) => {
      const id = catalogPaletteDefinitionId(library, type);
      return isLibraryOrigin(id)
        ? [{ id, name: type, category: "parts" } satisfies CatalogBuiltinOrigin]
        : [];
    },
  );
  // Part origins made from another origin's instance (a FieldButton = a Button instance).
  for (const { name, reusableId } of BASE_PART_DERIVED_ORIGINS) {
    const id = `lib:definition:origin-${reusableId}` as LibraryDefinitionId;
    if (library.definitions.has(id))
      parts.push({ id, name, category: "parts" });
  }
  const palette = getPaletteItems().flatMap((item) => {
    const type = item.componentType ?? item.type;
    const id = catalogPaletteDefinitionId(library, type);
    if (!isLibraryOrigin(id)) return [];
    const kind =
      item.componentType && item.initialProps
        ? { key: item.type, label: item.label, initialProps: item.initialProps }
        : undefined;
    const known = seen.get(id);
    if (known) {
      if (kind) known.kinds?.push(kind);
      return [];
    }
    const origin: CatalogBuiltinOrigin = {
      id,
      name: type,
      category: item.category,
      ...(kind ? { kinds: [kind] } : {}),
    };
    seen.set(id, origin);
    return [origin];
  });
  return [...parts, ...palette];
}

/** The Navigator tab listing a definition (its edit view selects it); `undefined` = none. */
export function catalogNavigatorTabOf(
  graph: CatalogReader,
  definitionId: CatalogDefinitionViewId | undefined,
): CatalogNavigatorTab | undefined {
  if (!definitionId) return undefined;
  if (isComponentsView(definitionId)) return "components";
  const definition = graph.getEntry(definitionId);
  if (definition?.kind !== "definition") return undefined;
  return definition.usage === "layout" ? "layouts" : "components";
}

/** `Layout`, `Layout 2`, … — the first name no layout uses yet. */
export function catalogNextLayoutName(
  graph: CatalogReader,
  base: string,
): string {
  const taken = new Set(
    catalogDefinitionList(graph)
      .filter((item) => item.usage === "layout")
      .map((item) => item.name),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1)
    if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

/**
 * A new layout, as the old Layouts tab made one: a page body whose content is one slot
 * ("content", a frame that declares it) — applying it to a page puts the page's content there.
 */
export function catalogNewLayoutCommand(
  name: string,
  newId: NewId,
): CatalogCommand {
  const rootId = newId("node") as NodeId;
  const slotId = newId("node") as NodeId;
  const entries: NodeEntry[] = [
    {
      kind: "node",
      id: rootId,
      name: "Body",
      definitionId: "lib:definition:type-body",
      children: [slotId],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    },
    {
      kind: "node",
      id: slotId,
      name: "Content",
      // A slot is any node with a slot declaration (the product library has no Slot element).
      definitionId: "lib:definition:type-frame",
      children: [],
      props: {},
      // The content area spans the page (an applied page's content lays out in it).
      visual: { width: { kind: "set", value: "100%" } },
      sizing: {},
      descendantOverrides: [],
      slot: { name: "content", required: false },
    },
  ];
  return createLayout({ name, entries, rootId, newId, label: "Add layout" });
}
