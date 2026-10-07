import type { NodeId } from "../../../../../packages/shared/src/catalog/document/types";
import type { RenderCommandStream } from "../workspace/canvas/skia/renderCommands";
import {
  ORIGIN_VIEW_NODE,
  isPageCard,
  isThemeSample,
  originOfPageInstance,
  originOfSample,
} from "./originViewNode";
import type { CatalogSelectionItem, CatalogSession } from "./session";

/** The record fields picking reads (a composition root record). */
export interface CatalogPickRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly parentId: string;
}
export type CatalogPickRecords = ReadonlyMap<string, CatalogPickRecord>;

/** The page grid's synthetic root: a record under it is a page root (the page body). */
const PAGE_GRID = "catalog:root";
const isNodeSource = (sourceId: string) => sourceId.startsWith("project:node:");

/**
 * ADR-248 Phase 4e-3: the drawn record under a scene point. `candidates` are the spatial index hits
 * (clip-aware boxes); the stream's hit box confirms each, and the one drawn last (its subtree
 * starts later in the stream — every drawn record has one, painted or not) is on top.
 */
export function pickTopmostRecord(
  stream: Pick<RenderCommandStream, "hitBoundsMap" | "subtreeSpans">,
  x: number,
  y: number,
  candidates: Iterable<string>,
  /** Records drawn boxes that picking skips (`false`) — rows the sample does not draw. */
  pickable?: (id: string) => boolean,
): string | undefined {
  let top: string | undefined;
  let topStart = -1;
  for (const id of candidates) {
    const box = stream.hitBoundsMap.get(id);
    if (
      !box ||
      (pickable && !pickable(id)) ||
      x < box.x ||
      y < box.y ||
      x > box.x + box.width ||
      y > box.y + box.height
    )
      continue;
    const start = stream.subtreeSpans.get(id)?.start ?? -1;
    if (start > topStart || top === undefined) {
      top = id;
      topStart = start;
    }
  }
  return top;
}

/**
 * Hierarchical click target of a picked record (the old Builder's rule over record parents): with
 * no editing context the element directly under the page body; inside a context the element
 * directly under the context node. The page body itself selects the body. `undefined` = the pick
 * is outside the context (the caller leaves the context).
 */
export function resolveCatalogClickRecord(
  records: CatalogPickRecords,
  pickedId: string,
  editingContext: string | undefined,
): string | undefined {
  for (
    let record = records.get(pickedId);
    record;
    record = records.get(record.parentId)
  ) {
    const parent = records.get(record.parentId);
    if (editingContext === undefined) {
      // The Components page: what a card holds (an origin's sample, a part, an instance, a theme value), else the
      // card, else the page (its
      // card, line and cell frames are layout only).
      if (
        originOfSample(record.sourceId) ||
        originOfPageInstance(record.sourceId) ||
        isThemeSample(record.sourceId) ||
        isPageCard(record.sourceId)
      )
        return record.id;
      if (record.parentId === PAGE_GRID) return record.id;
      if (parent?.parentId === PAGE_GRID)
        return parent.sourceId === ORIGIN_VIEW_NODE ? parent.id : record.id;
    } else if (parent?.sourceId === editingContext) return record.id;
  }
  return undefined;
}

/**
 * Double click: the container the click enters (the current target when the pick is deeper than
 * it) and the target inside it. `undefined` = nothing to enter (the pick is the target itself, or
 * the target is not a document node).
 */
export function resolveCatalogContextEntry(
  records: CatalogPickRecords,
  pickedId: string,
  editingContext: string | undefined,
): { context: string; target: string } | undefined {
  const current = resolveCatalogClickRecord(records, pickedId, editingContext);
  if (!current || current === pickedId) return undefined;
  const record = records.get(current)!;
  if (record.parentId === PAGE_GRID || !isNodeSource(record.sourceId))
    return undefined;
  const target = resolveCatalogClickRecord(records, pickedId, record.sourceId);
  return target ? { context: record.sourceId, target } : undefined;
}

/**
 * The record a double click edits the text of, when it enters nothing (`resolveCatalogContextEntry`
 * is `undefined`): the click target when it has its own text, else the text drawn under the
 * pointer inside it. The second case is a container the double click cannot enter — a template
 * position of an instance (a Card's CardHeader: a context is a document node, and the template id
 * names that position in every Card), so its text (the Card's title) is edited from there.
 * `undefined` = no text to edit.
 */
export function resolveCatalogTextEditRecord(
  records: CatalogPickRecords,
  pickedId: string,
  targetId: string,
  hasText: (id: string) => boolean,
): string | undefined {
  if (hasText(targetId)) return targetId;
  if (pickedId === targetId || !hasText(pickedId)) return undefined;
  for (
    let record = records.get(pickedId);
    record;
    record = records.get(record.parentId)
  )
    if (record.parentId === targetId) return pickedId;
  return undefined;
}

/**
 * Escape inside a context: the context's record on the selected record's parent chain (it becomes
 * the selection) and the context one level up (`undefined` = back to the page level).
 */
export function resolveCatalogContextExit(
  records: CatalogPickRecords,
  selectedId: string | undefined,
  editingContext: string,
): { select: string | undefined; context: string | undefined } {
  let contextRecord: CatalogPickRecord | undefined;
  for (
    let record = selectedId ? records.get(selectedId) : undefined;
    record;
    record = records.get(record.parentId)
  )
    if (record.sourceId === editingContext) {
      contextRecord = record;
      break;
    }
  if (!contextRecord) return { select: undefined, context: undefined };
  const parent = records.get(contextRecord.parentId);
  return {
    select: contextRecord.id,
    context:
      parent && parent.parentId !== PAGE_GRID && isNodeSource(parent.sourceId)
        ? parent.sourceId
        : undefined,
  };
}

/**
 * The editing context a Layers selection enters (the old Builder's tree rule): the selected
 * record's parent element, unless the parent is the page body (page level).
 */
export function resolveCatalogTreeContext(
  records: CatalogPickRecords,
  selectedId: string,
): string | undefined {
  const record = records.get(selectedId);
  const parent = record && records.get(record.parentId);
  return parent &&
    parent.parentId !== PAGE_GRID &&
    isNodeSource(parent.sourceId)
    ? parent.sourceId
    : undefined;
}

/** What pointer picking reads from the open project (`CatalogWorkspace` + the Canvas scene). */
export interface CatalogCanvasPickHost {
  readonly records: CatalogPickRecords;
  readonly session: CatalogSession;
  readonly stream: Pick<RenderCommandStream, "hitBoundsMap" | "subtreeSpans">;
  /** Candidate records under a scene point (the spatial index). */
  query(x: number, y: number): Iterable<string>;
  /** `false` = a laid-out record the Canvas does not draw (a row past the sample). */
  pickable?(id: string): boolean;
  /** Select drawn records (their Layers rows' targets). */
  selectRecords(ids: readonly string[], options?: { additive?: boolean }): void;
  /** The selection item of one drawn record (`undefined` = not an element row). */
  itemOf(id: string): CatalogSelectionItem | undefined;
}

/**
 * ADR-248 Phase 4e-3: Canvas pointer picking over the session — click (hierarchical; shift toggles,
 * ⌘/Ctrl selects the picked element itself), hover (what a click would select), double click
 * (enter the container) and Escape (one level up, then clear). Points are scene coordinates.
 */
export class CatalogCanvasPicking {
  constructor(private readonly host: CatalogCanvasPickHost) {}

  pick(x: number, y: number): string | undefined {
    return pickTopmostRecord(
      this.host.stream,
      x,
      y,
      this.host.query(x, y),
      this.host.pickable && ((id) => this.host.pickable!(id)),
    );
  }

  /** The record a click at the point selects in the current context (and the context it needs). */
  target(
    x: number,
    y: number,
    deep: boolean,
  ): { id: string; leaveContext: boolean } | undefined {
    const picked = this.pick(x, y);
    if (!picked) return undefined;
    const { records } = this.host;
    if (deep && records.get(picked)?.parentId !== PAGE_GRID)
      return { id: picked, leaveContext: false };
    const context = this.host.session.getSnapshot().editingContext;
    const inside = resolveCatalogClickRecord(records, picked, context);
    if (inside) return { id: inside, leaveContext: false };
    const outside = resolveCatalogClickRecord(records, picked, undefined);
    return outside ? { id: outside, leaveContext: true } : undefined;
  }

  click(
    x: number,
    y: number,
    modifiers: { additive?: boolean; deep?: boolean } = {},
  ): string | undefined {
    const target = this.target(x, y, !!modifiers.deep);
    const { session } = this.host;
    if (!target) {
      if (!modifiers.additive) {
        session.exitContext();
        session.clearSelection();
      }
      return undefined;
    }
    if (target.leaveContext) session.exitContext();
    this.host.selectRecords([target.id], { additive: modifiers.additive });
    return target.id;
  }

  hover(x: number, y: number): void {
    const target = this.target(x, y, false);
    this.host.session.setHover(target && this.host.itemOf(target.id));
  }
  leave(): void {
    this.host.session.setHover(undefined);
  }

  /** Enters the container under the point; `false` = nothing to enter (the target is a leaf). */
  doubleClick(x: number, y: number): boolean {
    const picked = this.pick(x, y);
    if (!picked) return false;
    const { records, session } = this.host;
    const entry = resolveCatalogContextEntry(
      records,
      picked,
      session.getSnapshot().editingContext,
    );
    if (!entry) return false;
    session.enterContext(entry.context as NodeId);
    this.host.selectRecords([entry.target]);
    return true;
  }

  /** After an edit (a drag out of the context): leave the context the selection is no longer in. */
  fitContext(): void {
    const { records, session } = this.host;
    const state = session.getSnapshot();
    const first = state.selection[0];
    if (!state.editingContext || !first) return;
    for (
      let record = records.get(first.identity);
      record;
      record = records.get(record.parentId)
    )
      if (records.get(record.parentId)?.sourceId === state.editingContext)
        return;
    session.exitContext();
  }

  escape(): void {
    const { records, session } = this.host;
    const state = session.getSnapshot();
    if (!state.editingContext) {
      session.clearSelection();
      return;
    }
    const exit = resolveCatalogContextExit(
      records,
      state.selection[0]?.identity,
      state.editingContext,
    );
    if (exit.context) session.enterContext(exit.context as NodeId);
    else session.exitContext();
    if (exit.select) this.host.selectRecords([exit.select]);
  }
}
