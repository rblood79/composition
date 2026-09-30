import type {
  CatalogReader,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { createLayout } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";

/** A project definition the Navigator lists (the definition edit view opens it). */
export interface CatalogDefinitionItem {
  id: EntryId<"definition">;
  name: string;
  usage: "layout" | "component";
}

/**
 * ADR-248 4e: the project's layouts, then its components (document order within each) — the
 * Navigator's list; selecting one opens the definition edit view.
 */
export function catalogDefinitionList(
  graph: CatalogReader,
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
  return [
    ...items.filter((item) => item.usage === "layout"),
    ...items.filter((item) => item.usage === "component"),
  ];
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
