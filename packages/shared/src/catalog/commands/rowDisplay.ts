import type {
  CatalogReader,
  CatalogRowDisplay,
  NodeId,
} from "../document/types";
import {
  childPositions,
  nodePosition,
  type CatalogPosition,
} from "../resolution/positions";
import { stageOver, type CatalogCommand } from "./compose";
import { CommandDraft, definitionTypeName } from "./context";
import { clearRowTemplates, markRowTemplates } from "./rowTemplate";

/**
 * ADR-310 Decision 10 — a bound list's row display (「더 보기」 · pages · virtual scroll). `undefined`
 * = the default (「더 보기」 by 100). One step (Undo gives the last display back).
 */
export const setRowDisplay =
  (id: NodeId, display: CatalogRowDisplay | undefined): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const node = draft.node(id);
    if (display) draft.write({ ...node, rowDisplay: { ...display } });
    else {
      const { rowDisplay: _gone, ...rest } = node;
      draft.write(rest);
    }
    return { label: "Row display", ops: draft.ops() };
  };

/** A Pagination's number buttons: the ToggleButtonGroup its positions hold (the origin's Pages). */
export function catalogPaginationPages(
  reader: CatalogReader,
  paginationId: NodeId,
): NodeId | undefined {
  const visit = (position: CatalogPosition): NodeId | undefined => {
    for (const child of childPositions(reader, position)) {
      let type = "";
      try {
        type = definitionTypeName(reader, child.definitionId);
      } catch {
        type = "";
      }
      if (type === "ToggleButtonGroup" && child.target.kind === "node")
        return child.target.id;
      const inner = visit(child);
      if (inner) return inner;
    }
    return undefined;
  };
  return visit(nodePosition(reader, paginationId));
}

/**
 * ADR-310 사용자 결정 6 — a Pagination pages a list (`pagesOf`): its first number button becomes the
 * template repeated per page and the other number buttons go (the Canvas draws the template once —
 * the authored sample); `undefined` disconnects (the template stays one static button). One step.
 */
export const setPagination =
  (paginationId: NodeId, listId: NodeId | undefined): CatalogCommand =>
  (reader) => {
    const label = listId ? "Connect pagination" : "Disconnect pagination";
    const stage = stageOver(reader);
    const ops: ReturnType<CatalogCommand>["ops"][number][] = [];
    const draft = new CommandDraft(stage);
    const node = draft.node(paginationId);
    if (listId) draft.write({ ...node, pagesOf: listId });
    else {
      const { pagesOf: _gone, ...rest } = node;
      draft.write(rest);
    }
    const first = draft.ops();
    stage.apply(first);
    ops.push(...first);
    const pages = catalogPaginationPages(stage, paginationId);
    if (pages) {
      const plan = (
        listId ? markRowTemplates({ ownerId: pages }) : clearRowTemplates(pages)
      )(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    }
    return { label, ops };
  };
