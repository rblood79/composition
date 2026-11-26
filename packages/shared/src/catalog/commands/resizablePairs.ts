/**
 * ADR-318 Phase 6 — a Resizable Group's children stay `Panel (Handle Panel)*` (breakdown §5.1 「짝
 * 유지」). The commands keep it — the renderer draws a broken order as it is (a Panel without a
 * Handle beside it just does not drag):
 *
 * - delete a Panel → its Handle goes too (the one before it, else the one after) — one step;
 * - a Handle alone is not deleted · moved · duplicated (`REQUIRED_PART_NOT_REMOVABLE`);
 * - a Panel moved inside its Group swaps places with the Panels: the Handles keep their places
 *   (`reweaveResizableGroup`); a Panel does not leave its Group, nor joins another;
 * - 「Add panel」 (the Group's 「+」) and a Panel's duplicate bring a Handle along
 *   (`insertGroupItem` · `duplicateNodes`).
 *
 * Precedent: a Tab's delete · duplicate takes its paired TabPanel (`catalogPairedTabPanels`).
 */
import {
  RESIZABLE_GROUP_TYPE,
  RESIZABLE_HANDLE_TYPE,
  RESIZABLE_PANEL_TYPE,
} from "../runtime/resizablePanels";
import type { NodeId } from "../document/types";
import {
  childList,
  definitionTypeName,
  fail,
  locate,
  parentAncestorTypes,
  setChildList,
  type CommandDraft,
  type EditTarget,
  type NodeParent,
} from "./context";

const RESIZABLE_PANEL = RESIZABLE_PANEL_TYPE;
const RESIZABLE_HANDLE = RESIZABLE_HANDLE_TYPE;

const typeOf = (draft: CommandDraft, id: NodeId): string => {
  const entry = draft.read(id);
  return entry?.kind === "node"
    ? definitionTypeName(draft.reader, entry.definitionId)
    : "";
};

/** A node's place when its parent is a Resizable Group (else `undefined`). */
function groupPlace(
  draft: CommandDraft,
  id: NodeId,
): { parent: NodeParent; list: readonly NodeId[]; index: number } | undefined {
  if (!draft.reader.ownerOf(id)) return undefined;
  const { parent, index } = locate(draft, id);
  if (parent.kind === "page" || index < 0) return undefined;
  if (parentAncestorTypes(draft, parent)[0] !== RESIZABLE_GROUP_TYPE)
    return undefined;
  return { parent, list: childList(draft, parent) ?? [], index };
}

const notAlone = (type: string): never =>
  fail("REQUIRED_PART_NOT_REMOVABLE", `${RESIZABLE_GROUP_TYPE}>${type}`);

/**
 * The Handles a delete takes along: each deleted Panel's (before it, else after it) not already
 * deleted. A Handle deleted without a Panel beside it is refused.
 */
export function catalogResizablePairedDeletes(
  draft: CommandDraft,
  targets: readonly EditTarget[],
): EditTarget[] {
  const ids = new Set(
    targets.flatMap((target) => (target.kind === "node" ? [target.id] : [])),
  );
  const extra: EditTarget[] = [];
  const taken = new Set<NodeId>();
  for (const id of ids) {
    const type = typeOf(draft, id);
    if (type !== RESIZABLE_PANEL && type !== RESIZABLE_HANDLE) continue;
    const place = groupPlace(draft, id);
    if (!place) continue;
    const { list, index } = place;
    const handleAt = (at: number): NodeId | undefined => {
      const candidate = list[at];
      return candidate &&
        typeOf(draft, candidate) === RESIZABLE_HANDLE &&
        !taken.has(candidate)
        ? candidate
        : undefined;
    };
    if (type === RESIZABLE_HANDLE) {
      // (Deleted with a Panel beside it — that Panel's delete accounts for it below.)
      const beside = [list[index - 1], list[index + 1]].some(
        (other) =>
          other && ids.has(other) && typeOf(draft, other) === RESIZABLE_PANEL,
      );
      if (!beside) notAlone(RESIZABLE_HANDLE);
      continue;
    }
    const handle =
      [index - 1, index + 1]
        .map(handleAt)
        .find((candidate) => candidate && ids.has(candidate)) ??
      handleAt(index - 1) ??
      handleAt(index + 1);
    if (!handle) continue;
    taken.add(handle);
    if (!ids.has(handle)) extra.push({ kind: "node", id: handle });
  }
  return extra;
}

/** A Handle is not moved · duplicated alone; a Panel stays in its Group. */
export function assertResizableMove(
  draft: CommandDraft,
  roots: readonly NodeId[],
  to: NodeParent,
): void {
  const into =
    to.kind === "page" ? undefined : parentAncestorTypes(draft, to)[0];
  for (const id of roots) {
    const type = typeOf(draft, id);
    if (type === RESIZABLE_HANDLE) notAlone(RESIZABLE_HANDLE);
    if (type !== RESIZABLE_PANEL) continue;
    const place = groupPlace(draft, id);
    const sameGroup =
      place &&
      into === RESIZABLE_GROUP_TYPE &&
      JSON.stringify(place.parent) === JSON.stringify(to);
    if (place ? !sameGroup : into === RESIZABLE_GROUP_TYPE)
      notAlone(RESIZABLE_PANEL);
  }
}

/** A duplicate of a Handle alone is refused. */
export function assertResizableDuplicate(
  draft: CommandDraft,
  ids: readonly NodeId[],
): void {
  for (const id of ids)
    if (typeOf(draft, id) === RESIZABLE_HANDLE && groupPlace(draft, id))
      notAlone(RESIZABLE_HANDLE);
}

/**
 * Weaves a Group's list back into `Panel (Handle Panel)*`: its Panels in their new order, its
 * Handles in theirs (a Panel moved swaps places with Panels; the Handles stay where they were).
 * Other children (none in a well formed Group) keep their order after the woven run.
 */
export function reweaveResizableGroup(
  draft: CommandDraft,
  parent: NodeParent,
): void {
  if (parent.kind === "page") return;
  if (parentAncestorTypes(draft, parent)[0] !== RESIZABLE_GROUP_TYPE) return;
  const list = childList(draft, parent) ?? [];
  const panels = list.filter((id) => typeOf(draft, id) === RESIZABLE_PANEL);
  const handles = list.filter((id) => typeOf(draft, id) === RESIZABLE_HANDLE);
  if (handles.length !== panels.length - 1) return;
  const others = list.filter(
    (id) => !panels.includes(id) && !handles.includes(id),
  );
  const woven = panels.flatMap((panel, i) =>
    i === 0 ? [panel] : [handles[i - 1] as NodeId, panel],
  );
  const next = [...woven, ...others];
  if (next.some((id, i) => id !== list[i])) setChildList(draft, parent, next);
}

/** The node is a Panel in a Resizable Group (its duplicate brings a Handle). */
export function catalogResizablePanelInGroup(
  draft: CommandDraft,
  id: NodeId,
): boolean {
  return typeOf(draft, id) === RESIZABLE_PANEL && !!groupPlace(draft, id);
}

/** The Group's Handle to copy for a new pair (its last — the Handles of one Group look alike). */
export function catalogResizableHandleOf(
  draft: CommandDraft,
  list: readonly NodeId[],
): NodeId | undefined {
  return [...list]
    .reverse()
    .find((id) => typeOf(draft, id) === RESIZABLE_HANDLE);
}
