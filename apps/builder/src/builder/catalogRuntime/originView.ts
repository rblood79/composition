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
 * ADR-248 4e (user 2026-10-01 · 2026-10-05): the built-in component origins on the Components
 * page (`componentsPage` — derived graph view entries: never saved, exported or indexed). A
 * sample's own props and styles are the project's override of its origin (the root defaults
 * every instance shows), so the panels read and reset them as own values. Edits are root only
 * (user decision): a command's prop and base style writes on a sample become that origin's
 * project defaults (`setLibraryDefault`); anything else on the page — a sample's children,
 * sizing, layout, breakpoint layers, fills, the instances beside it, the page's own frames — is refused.
 */
import {
  COMPONENTS_VIEW,
  ORIGIN_VIEW_NODE,
  isComponentsView,
  isLibraryOrigin,
  isPageCard,
  isThemeSample,
  originInstanceId,
  originCardId,
  originOfPageInstance,
  originOfSample,
  originSampleId,
  themeSampleId,
} from "./originViewNode";

export {
  COMPONENTS_VIEW,
  ORIGIN_VIEW_NODE,
  isComponentsView,
  isLibraryOrigin,
  isPageCard,
  isThemeSample,
  originInstanceId,
  originCardId,
  originOfPageInstance,
  originOfSample,
  originSampleId,
  themeSampleId,
};

/** The origin a Components page node is the editable sample of. */
export const originOfEditableSample = originOfSample;

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
export function catalogOriginOverride(
  graph: CatalogReader,
  definitionId: LibraryDefinitionId,
) {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return undefined;
  for (const id of project.overrideIds) {
    const entry = graph.getEntry(id);
    if (entry?.kind === "definitionOverride" && entry.targetId === definitionId)
      return entry;
  }
  return undefined;
}

/** The Components page node an operation writes (`undefined` = a document entry). */
const pageNodeOf = (graph: CatalogGraph, op: CatalogOperation) => {
  const id = op.kind === "put" ? op.entry.id : "id" in op ? op.id : undefined;
  return id !== undefined && graph.isViewEntry(id) ? id : undefined;
};

/**
 * A command on the Components page: its writes on an origin's sample as that origin's project
 * defaults. Commands that do not touch the page run as they are.
 */
export function catalogOriginEditCommand(
  graph: CatalogGraph,
  command: CatalogCommand,
  newId: NewId,
): CatalogCommand {
  return (reader) => {
    const planned = command(reader);
    if (!planned.ops.some((op) => pageNodeOf(graph, op))) return planned;
    const writes: CatalogCommand[] = [];
    const rest: CatalogOperation[] = [];
    for (const op of planned.ops) {
      const pageNode = pageNodeOf(graph, op);
      if (!pageNode) {
        rest.push(op);
        continue;
      }
      const definitionId = originOfEditableSample(pageNode);
      if (!definitionId) throw new CatalogOriginEditError();
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
