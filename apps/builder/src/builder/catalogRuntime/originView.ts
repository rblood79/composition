import { setLibraryDefault } from "../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogReader,
  LibraryDefinitionId,
  NodeEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogOperation } from "../../../../../packages/shared/src/catalog/transactions/transaction";

/**
 * ADR-248 4e (user 2026-10-01): the library origin view — a built-in component origin
 * (`lib:definition:origin-*`) opened from the Navigator Components tab. The Canvas draws one
 * derived sample instance of it (`ORIGIN_VIEW_NODE`, a graph view entry: never saved, exported or
 * indexed). Its own props and styles are the project's override of the origin (the root defaults
 * every instance shows), so the panels read and reset them as own values. Edits are root only
 * (user decision): a command's prop and base style writes on the sample become the origin's
 * project defaults (`setLibraryDefault`); anything else on it — its children, sizing, layout,
 * breakpoint layers, fills, structure — is refused.
 */
import { ORIGIN_VIEW_NODE, isLibraryOrigin } from "./originViewNode";

export { ORIGIN_VIEW_NODE, isLibraryOrigin };

export class CatalogOriginEditError extends Error {
  constructor() {
    super("ORIGIN_ROOT_ONLY");
    this.name = "CatalogOriginEditError";
  }
}

/** A library origin's display name: its type (`Button`). */
export function catalogDefinitionTitle(
  graph: CatalogReader,
  definitionId: LibraryDefinitionId,
): string {
  // The origin's own name (`IconButton`), not its template root's type (`Button`).
  const name = graph.library.definitions.get(definitionId)?.name;
  if (name) return name;
  try {
    return definitionTypeName(graph, definitionId);
  } catch {
    return definitionId;
  }
}

/** The project override of a library definition, if any. */
function overrideOf(graph: CatalogReader, definitionId: LibraryDefinitionId) {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return undefined;
  for (const id of project.overrideIds) {
    const entry = graph.getEntry(id);
    if (entry?.kind === "definitionOverride" && entry.targetId === definitionId)
      return entry;
  }
  return undefined;
}

/** The sample instance the origin view draws: its own fields = the project's override. */
export function catalogOriginViewEntry(
  graph: CatalogReader,
  definitionId: LibraryDefinitionId,
): NodeEntry {
  const override = overrideOf(graph, definitionId);
  return {
    kind: "node",
    id: ORIGIN_VIEW_NODE,
    name: catalogDefinitionTitle(graph, definitionId),
    definitionId,
    children: [],
    props: override?.defaults ?? {},
    visual: override?.visual ?? {},
    sizing: {},
    descendantOverrides: [],
  };
}

/** Show (or stop showing) the sample of a library origin in the graph's view entries. */
export function setCatalogOriginView(
  graph: CatalogGraph,
  definitionId: LibraryDefinitionId | undefined,
): void {
  graph.setViewEntry(
    ORIGIN_VIEW_NODE,
    definitionId
      ? () => catalogOriginViewEntry(graph, definitionId)
      : undefined,
  );
}

const touchesSample = (op: CatalogOperation): boolean =>
  op.kind === "put"
    ? op.entry.id === ORIGIN_VIEW_NODE
    : "id" in op && op.id === ORIGIN_VIEW_NODE;

/**
 * A command on the origin view: its writes on the sample root as the origin's project defaults.
 * Commands that do not touch the sample run as they are.
 */
export function catalogOriginEditCommand(
  graph: CatalogGraph,
  command: CatalogCommand,
  definitionId: LibraryDefinitionId,
  newId: NewId,
): CatalogCommand {
  return (reader) => {
    const planned = command(reader);
    if (!planned.ops.some(touchesSample)) return planned;
    const writes: CatalogCommand[] = [];
    const rest: CatalogOperation[] = [];
    for (const op of planned.ops) {
      if (!touchesSample(op)) {
        rest.push(op);
        continue;
      }
      if (op.kind === "patchNodeProp")
        writes.push(
          setLibraryDefault({
            definitionId,
            scope: "defaults",
            key: op.key,
            write: op.write,
            newId,
          }),
        );
      else if (op.kind === "patchNodeVisual" && !op.breakpoint)
        writes.push(
          setLibraryDefault({
            definitionId,
            scope: "visual",
            key: op.key,
            write: op.write,
            newId,
          }),
        );
      else throw new CatalogOriginEditError();
    }
    // One transaction: each default write reads the override the previous one created.
    return composeCommands(graph, planned.label, [
      ...(rest.length ? [() => ({ label: planned.label, ops: rest })] : []),
      ...writes,
    ]);
  };
}
