import { insertNodes } from "../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  EditTarget,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogPosition } from "../../../../../packages/shared/src/catalog/resolution/positions";
import type { AiReadHost } from "../../services/ai/aiReadHost";
import type { Element } from "../../types/builder/unified.types";
import { catalogEditContract } from "./editContract";
import type { CatalogWorkspace } from "./workspace";

const typeOf = (workspace: CatalogWorkspace, position: CatalogPosition) => {
  try {
    return definitionTypeName(workspace.runtime.graph, position.definitionId);
  } catch {
    return "";
  }
};

/** The project's element rows as the AI's Element shape (ids = record identities). */
function projectElements(workspace: CatalogWorkspace): Element[] {
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  const records = workspace.root.domInputs;
  const out: Element[] = [];
  const visit = (
    position: CatalogPosition,
    parentId: string | null,
    pageId: string,
  ) => {
    const node =
      position.target.kind === "node"
        ? graph.getEntry(position.target.id)
        : undefined;
    out.push({
      id: position.identity,
      type: typeOf(workspace, position),
      props: { ...(records.get(position.identity)?.props ?? {}) },
      parent_id: parentId,
      page_id: pageId,
      ...(node?.kind === "node" && node.name ? { customId: node.name } : {}),
    });
    for (const child of workspace.readModel.childRows(position))
      visit(child, position.identity, pageId);
  };
  for (const pageId of project.pageIds)
    for (const row of workspace.readModel.pageRows(pageId))
      visit(row, null, pageId);
  return out;
}

const PROBE: NodeEntry = {
  kind: "node",
  id: "project:node:__ai_parent_probe__" as NodeId,
  definitionId: "lib:definition:type-frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
};

/**
 * ADR-248 Phase 4e-5: the AI's read host over the open catalog workspace — the element rows of
 * every page (Layers rows; props = the resolved record props), the session page and selection,
 * the Properties edit contract per element, and the creation parent (the selection, or the
 * nearest ancestor that takes a Frame, else the page body — the palette's rule).
 */
export function createCatalogAiReadHost(
  workspace: CatalogWorkspace,
): AiReadHost {
  // One projection per document revision and composition root (a breakpoint switch makes a new
  // root).
  let cache:
    | { revision: number; root: object; elements: Element[] }
    | undefined;
  const documentKey = () =>
    `${workspace.runtime.graph.revision}:${workspace.session.getSnapshot().breakpoint}`;
  const selection = () => workspace.session.getSnapshot().selection;
  return {
    version: () =>
      `${documentKey()}|${workspace.session.getSnapshot().pageId ?? ""}|${selection()
        .map((item) => item.identity)
        .join(",")}`,
    subscribe(listener) {
      const offs = [
        workspace.runtime.subscribeSteps(() => listener()),
        workspace.session.subscribe(listener),
        workspace.subscribeRows(listener),
        workspace.subscribeRoot(listener),
      ];
      return () => offs.forEach((off) => off());
    },
    elements() {
      const revision = workspace.runtime.graph.revision;
      const root = workspace.root;
      if (cache?.revision !== revision || cache.root !== root)
        cache = { revision, root, elements: projectElements(workspace) };
      return cache.elements;
    },
    currentPageId: () => workspace.session.getSnapshot().pageId ?? null,
    selectedIds: () => selection().map((item) => item.identity),
    fields(id) {
      const position = workspace.positionOfRecord(id);
      if (!position) return [];
      try {
        return catalogEditContract(
          workspace.runtime.graph,
          workspace.readModel,
          position.target,
        ).fields;
      } catch {
        return [];
      }
    },
    creationParentId() {
      const records = workspace.root.domInputs;
      const candidates: { target: EditTarget; identity: string }[] = [];
      const [first] = selection();
      if (first) {
        candidates.push(first);
        for (
          let record = records.get(records.get(first.identity)?.parentId ?? "");
          record;
          record = records.get(record.parentId)
        ) {
          const item = workspace.itemOfRecord(record.id);
          if (!item) break;
          candidates.push(item);
        }
      }
      const { pageId } = workspace.session.getSnapshot();
      const page = pageId && workspace.runtime.graph.getEntry(pageId);
      const body = page && page.kind === "page" ? page.children[0] : undefined;
      const bodyRecord = body && workspace.root.recordsOfSource(body)[0];
      if (body && bodyRecord)
        candidates.push({
          target: { kind: "node", id: body as NodeId },
          identity: bodyRecord,
        });
      for (const candidate of candidates) {
        const parent =
          candidate.target.kind === "node"
            ? { kind: "node" as const, id: candidate.target.id }
            : {
                kind: "descendant" as const,
                ownerId: candidate.target.ownerId,
                address: candidate.target.address,
              };
        try {
          insertNodes({
            parent,
            entries: [PROBE],
            rootIds: [PROBE.id],
            newId: workspace.newId,
          })(workspace.runtime.graph);
          return candidate.identity;
        } catch {
          continue;
        }
      }
      return null;
    },
    projectId: () => workspace.projectId,
  };
}
