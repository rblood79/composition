import { ownedChildren } from "./graph";
import type {
  CatalogDocument,
  CatalogEntry,
  CatalogReader,
  EntryId,
} from "./types";

/**
 * ADR-282 Phase 3 — the Components tab's pages: the Library's (the built-in origins' cards) and
 * the Local's (the project components'). The project owns them outside `pageIds`
 * (`ProjectEntry.componentPageIds`), made the first time the tab opens one. They are the
 * Builder's: Preview and publish take the document without them (`withoutComponentPages`) — the
 * templates their ◆ cells draw are owned by definitions and overrides, not by the pages.
 */
export const LIBRARY_COMPONENT_PAGE =
  "project:page:catalog-library" as EntryId<"page">;
export const LOCAL_COMPONENT_PAGE =
  "project:page:catalog-local" as EntryId<"page">;

/** The component pages and every node they own (stored children — never a view's). */
export function componentPageMembers(
  get: (id: string) => CatalogEntry | undefined,
  projectId: string,
): Set<string> {
  const members = new Set<string>();
  const project = get(projectId);
  if (project?.kind !== "project") return members;
  const walk = (id: string) => {
    if (members.has(id)) return;
    const entry = get(id);
    if (!entry) return;
    members.add(id);
    for (const child of ownedChildren(entry)) walk(child);
  };
  for (const id of project.componentPageIds ?? []) walk(id);
  return members;
}

/** The project entry as Preview and publish take it (no component pages listed). */
export function withoutComponentPageIds(entry: CatalogEntry): CatalogEntry {
  if (entry.kind !== "project" || !entry.componentPageIds) return entry;
  const { componentPageIds: _, ...project } = entry;
  return project;
}

/** A document without its component pages (Preview's snapshot, publish). */
export function withoutComponentPages(
  document: CatalogDocument,
): CatalogDocument {
  const members = componentPageMembers(
    (id) => document.entries[id],
    document.projectId,
  );
  if (!members.size) return document;
  const entries: Record<string, CatalogEntry> = {};
  for (const [id, entry] of Object.entries(document.entries))
    if (!members.has(id)) entries[id] = withoutComponentPageIds(entry);
  return { ...document, entries };
}

/**
 * A definition's instances in the project's own pages and templates — not the component pages'
 * showcase instances (a Library card's ◇). What the user is told an origin edit reaches.
 */
export function projectInstancesOf(
  reader: Pick<CatalogReader, "getEntry" | "ownerOf" | "instancesOf" | "projectId">,
  definitionId: string,
): string[] {
  const project = reader.getEntry(reader.projectId);
  const pages = new Set<string>(
    project?.kind === "project" ? (project.componentPageIds ?? []) : [],
  );
  const instances = [...reader.instancesOf(definitionId)];
  if (!pages.size) return instances;
  return instances.filter((id) => {
    for (
      let cursor: string | undefined = id;
      cursor;
      cursor = reader.ownerOf(cursor)
    )
      if (pages.has(cursor)) return false;
    return true;
  });
}
