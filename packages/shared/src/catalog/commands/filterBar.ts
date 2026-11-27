/**
 * ADR-320 Phase 2 — a filter bar's connection (breakdown §5.1 · §5.11): the lists it filters
 * (`filtersOf`) and its chip (the FilterChip its 「Conditions」 frame holds — an owned node) as the
 * template repeated per root item of its tree while it filters a list. One step: connecting,
 * changing and disconnecting (an empty list) undo together with the chip's mark. The graph refuses a
 * list another bar filters and lists of two collections (`FILTER_TARGET_*`).
 */
import type { CatalogReader, NodeId } from "../document/types";
import {
  childPositions,
  nodePosition,
  type CatalogPosition,
} from "../resolution/positions";
import { stageOver, type CatalogCommand } from "./compose";
import { CommandDraft, definitionTypeName } from "./context";
import { setOwnRows } from "./rowTemplate";

/** A bar's chips — the FilterChip nodes it owns (in order). */
export function catalogFilterBarChips(
  reader: CatalogReader,
  barId: NodeId,
): NodeId[] {
  const typeOf = (position: CatalogPosition) => {
    try {
      return definitionTypeName(reader, position.definitionId);
    } catch {
      return "";
    }
  };
  const out: NodeId[] = [];
  const visit = (position: CatalogPosition) => {
    for (const child of childPositions(reader, position)) {
      if (typeOf(child) === "FilterChip") {
        if (child.target.kind === "node") out.push(child.target.id);
        continue;
      }
      visit(child);
    }
  };
  visit(nodePosition(reader, barId));
  return out;
}

/** The lists a bar filters: `targets` (in order, each once) — empty disconnects. */
export const setFilterBarTargets =
  (barId: NodeId, targets: readonly NodeId[]): CatalogCommand =>
  (reader) => {
    const lists = [...new Set(targets)];
    const label = lists.length ? "Connect filter bar" : "Disconnect filter bar";
    const stage = stageOver(reader);
    const draft = new CommandDraft(stage);
    const node = draft.node(barId);
    const { filtersOf: _gone, ...rest } = node;
    draft.write(lists.length ? { ...rest, filtersOf: lists } : rest);
    const ops = draft.ops();
    stage.apply(ops);
    const [template] = catalogFilterBarChips(stage, barId);
    if (template) {
      const plan = setOwnRows(template, lists.length > 0)(stage);
      ops.push(...plan.ops);
    }
    return { label, ops };
  };
