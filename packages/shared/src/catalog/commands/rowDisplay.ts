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
import {
  clearRowTemplates,
  markRowTemplates,
  setOwnRows,
} from "./rowTemplate";
import { removeTargets } from "./structure";

/** A Pagination's 「Rows per page」 Select — its own Select child (an owned node). */
function catalogPaginationSizeSelect(
  reader: CatalogReader,
  paginationId: NodeId,
): NodeId | undefined {
  for (const child of childPositions(reader, nodePosition(reader, paginationId))) {
    if (child.target.kind !== "node") continue;
    let type = "";
    try {
      type = definitionTypeName(reader, child.definitionId);
    } catch {
      type = "";
    }
    if (type === "Select") return child.target.id;
  }
  return undefined;
}

/**
 * The page-number buttons of a Pagination's number group — its ActionButtons whose `id` is a number
 * (the first · last page buttons are `first` · `last`, the gaps Icons).
 */
function catalogPageButtons(reader: CatalogReader, groupId: NodeId): NodeId[] {
  const ids: NodeId[] = [];
  for (const child of childPositions(reader, nodePosition(reader, groupId))) {
    if (child.target.kind !== "node") continue;
    const entry = reader.getEntry(child.target.id);
    const id = entry?.kind === "node" ? entry.props.id : undefined;
    const value = id?.kind === "set" ? id.value : undefined;
    if (value !== undefined && /^\d+$/.test(String(value)))
      ids.push(child.target.id);
  }
  return ids;
}

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

/** A Pagination's number buttons: the ActionButtonGroup its positions hold (the origin's Pages). */
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
      if (type === "ActionButtonGroup" && child.target.kind === "node")
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
 * the authored sample), its first · last page buttons and gaps stay (2026-11-19 — they show around
 * the page window); `undefined` disconnects (the template stays one static button). One step.
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
      const run = (command: CatalogCommand) => {
        const plan = command(stage);
        stage.apply(plan.ops);
        ops.push(...plan.ops);
      };
      // (Its 「Rows per page」 Select: its first item repeats per size, the sample's others go.)
      const select = catalogPaginationSizeSelect(stage, paginationId);
      if (select)
        run(listId ? markRowTemplates({ ownerId: select }) : clearRowTemplates(select));
      if (!listId) run(clearRowTemplates(pages));
      else {
        // (The first number repeats per page; the sample's other numbers go. The first · last page
        //  buttons and the gaps stay — they show around the window.)
        const [template, ...rest] = catalogPageButtons(stage, pages);
        if (template) run(setOwnRows(template, true));
        if (rest.length)
          run(
            removeTargets({
              targets: rest.map((id) => ({ kind: "node" as const, id })),
            }),
          );
      }
    }
    return { label, ops };
  };

/** A column chooser's Menu items — the MenuItems its positions hold (owned nodes, in order). */
export function catalogColumnChooserItems(
  reader: CatalogReader,
  triggerId: NodeId,
): NodeId[] {
  const typeOf = (position: CatalogPosition) => {
    try {
      return definitionTypeName(reader, position.definitionId);
    } catch {
      return "";
    }
  };
  const visit = (position: CatalogPosition): NodeId[] | undefined => {
    for (const child of childPositions(reader, position)) {
      if (typeOf(child) === "Menu")
        return childPositions(reader, child).flatMap((item) =>
          item.target.kind === "node" && typeOf(item) === "MenuItem"
            ? [item.target.id]
            : [],
        );
      const inner = visit(child);
      if (inner) return inner;
    }
    return undefined;
  };
  return visit(nodePosition(reader, triggerId)) ?? [];
}

/**
 * ADR-315 Phase 4 — a column chooser (a MenuTrigger instance) lists a Table's columns
 * (`columnsOf`): its Menu's first item becomes the template repeated per data column and the
 * sample's other items go (the Canvas draws the template once — the menu is closed there);
 * `undefined` disconnects (the template stays one static item). One step — as `setPagination`.
 */
export const setColumnChooser =
  (triggerId: NodeId, tableId: NodeId | undefined): CatalogCommand =>
  (reader) => {
    const label = tableId ? "Connect column chooser" : "Disconnect column chooser";
    const stage = stageOver(reader);
    const ops: ReturnType<CatalogCommand>["ops"][number][] = [];
    const draft = new CommandDraft(stage);
    const node = draft.node(triggerId);
    if (tableId) draft.write({ ...node, columnsOf: tableId });
    else {
      const { columnsOf: _gone, ...rest } = node;
      draft.write(rest);
    }
    const first = draft.ops();
    stage.apply(first);
    ops.push(...first);
    const run = (command: CatalogCommand) => {
      const plan = command(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    };
    const [template, ...rest] = catalogColumnChooserItems(stage, triggerId);
    if (template) run(tableId ? setOwnRows(template, true) : setOwnRows(template, false));
    if (tableId && rest.length)
      run(
        removeTargets({
          targets: rest.map((id) => ({ kind: "node" as const, id })),
        }),
      );
    return { label, ops };
  };
