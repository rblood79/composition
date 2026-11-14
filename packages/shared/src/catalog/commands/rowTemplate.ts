import { CATALOG_ROW_ITEM_TYPES } from "../document/collectionItems";
import type { CatalogReader, NodeEntry, NodeId } from "../document/types";
import {
  childPositions,
  nodePosition,
  type CatalogPosition,
} from "../resolution/positions";
import { catalogPairedTabPanels } from "./collections";
import { stageOver, type CatalogCommand } from "./compose";
import {
  CommandDraft,
  definitionTypeName,
  fail,
  type EditTarget,
} from "./context";
import type { NewId } from "./materialize";
import { duplicateNodes, removeTargets } from "./structure";

/**
 * ADR-310 Decision 2 — how a list that already holds items takes its data: `template` = its first
 * item becomes the rows' template and the other items go (the default — what a bound list showed
 * before), `keep` = every item stays a static item and a copy of the last one, after them, is the
 * rows' template.
 */
export type CatalogRowTemplateMode = "template" | "keep";

function typeOf(reader: CatalogReader, position: CatalogPosition): string {
  try {
    return definitionTypeName(reader, position.definitionId);
  } catch {
    return "";
  }
}

function nodeOf(
  reader: CatalogReader,
  position: CatalogPosition,
): NodeEntry | undefined {
  if (position.target.kind !== "node") return undefined;
  const entry = reader.getEntry(position.target.id);
  return entry?.kind === "node" ? entry : undefined;
}

/**
 * ADR-310 — the item positions a bound owner's rows reach, one list per level that holds them: the
 * rows pass down through the owner's non-item children until a level holds items (a Tabs passes
 * them on to its TabList as well as repeating its TabPanels), and a node bound on its own reads its
 * own rows. The resolver passes rows the same way.
 */
export function catalogRowItemGroups(
  reader: CatalogReader,
  ownerId: NodeId,
): CatalogPosition[][] {
  const groups: CatalogPosition[][] = [];
  const walk = (position: CatalogPosition) => {
    const rows = childPositions(reader, position);
    const items = rows.filter((row) =>
      CATALOG_ROW_ITEM_TYPES.has(typeOf(reader, row)),
    );
    if (items.length) groups.push(items);
    if (items.length && typeOf(reader, position) !== "Tabs") return;
    for (const row of rows) {
      if (items.includes(row)) continue;
      if (nodeOf(reader, row)?.binding) continue;
      walk(row);
    }
  };
  walk(nodePosition(reader, ownerId));
  return groups;
}

/** Whether a bound owner already has its rows' template (an item marked `repeat`). */
export function catalogHasRowTemplate(
  reader: CatalogReader,
  ownerId: NodeId,
): boolean {
  return catalogRowItemGroups(reader, ownerId).some((group) =>
    group.some((position) => nodeOf(reader, position)?.repeat),
  );
}

/** The static items a bound owner would keep or lose on `template` (the panel's 「기존 항목 N개」). */
export function catalogStaticItemCount(
  reader: CatalogReader,
  ownerId: NodeId,
): number {
  const groups = catalogRowItemGroups(reader, ownerId);
  // (A Tabs counts its Tabs — a panel goes with its Tab.)
  const items = groups.find((group) =>
    group.some((position) => typeOf(reader, position) !== "TabPanel"),
  );
  return (items ?? []).filter((position) => !nodeOf(reader, position)?.repeat)
    .length;
}

const writeRepeat = (
  draft: CommandDraft,
  id: NodeId,
  repeat: boolean,
): void => {
  const node = draft.node(id);
  if (!!node.repeat === repeat) return;
  const next: NodeEntry = { ...node };
  if (repeat) next.repeat = true;
  else delete next.repeat;
  draft.write(next);
};

/**
 * ADR-310 Decision 2 — give a bound owner its rows' template (no-op when it has one): `template`
 * marks each level's first item `repeat` and removes the other items (a removed Tab takes its
 * TabPanel — `removeTargets`); `keep` copies each level's last item (a Tab with its TabPanel —
 * `duplicateNodes`) after it and marks the copy. Template positions an instance does not own are
 * not marked (the library's items are never a row template).
 */
export const markRowTemplates =
  (input: {
    ownerId: NodeId;
    mode?: CatalogRowTemplateMode;
    /** Needed by `keep` (it copies an item). */
    newId?: NewId;
  }): CatalogCommand =>
  (reader) => {
    const label = "Bind data";
    if (catalogHasRowTemplate(reader, input.ownerId)) return { label, ops: [] };
    const stage = stageOver(reader);
    const ops: ReturnType<CatalogCommand>["ops"][number][] = [];
    const run = (command: CatalogCommand) => {
      const plan = command(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
      return plan;
    };
    const groups = catalogRowItemGroups(reader, input.ownerId).map((group) =>
      group.filter((position) => position.target.kind === "node"),
    );
    const tabs = groups.find((group) =>
      group.some((position) => typeOf(reader, position) === "Tab"),
    );
    // (A Tabs' panels follow their Tabs: the kept · copied Tab's panel is marked with it.)
    const markPanels = (tabId: NodeId) => {
      const draft = new CommandDraft(stage);
      for (const panel of catalogPairedTabPanels(draft, {
        kind: "node",
        id: tabId,
      }))
        if (panel.kind === "node") writeRepeat(draft, panel.id, true);
      run(() => ({ label, ops: draft.ops() }));
    };
    const levels = tabs ? [tabs] : groups;
    if ((input.mode ?? "template") === "keep") {
      const newId = input.newId;
      if (!newId) return fail("NEW_ID_REQUIRED", input.ownerId);
      for (const group of levels) {
        const last = group[group.length - 1];
        if (!last) continue;
        const plan = run(
          duplicateNodes({
            ids: [(last.target as { id: NodeId }).id],
            newId,
          }),
        );
        const copy = plan.selectAfter?.[0];
        if (!copy) continue;
        const draft = new CommandDraft(stage);
        writeRepeat(draft, copy, true);
        run(() => ({ label, ops: draft.ops() }));
        if (tabs) markPanels(copy);
      }
      return { label, ops };
    }
    const drop: EditTarget[] = [];
    for (const group of levels) {
      const [first, ...rest] = group;
      if (!first) continue;
      const draft = new CommandDraft(stage);
      writeRepeat(draft, (first.target as { id: NodeId }).id, true);
      run(() => ({ label, ops: draft.ops() }));
      if (tabs) markPanels((first.target as { id: NodeId }).id);
      drop.push(...rest.map((position) => position.target));
    }
    if (drop.length) run(removeTargets({ targets: drop }));
    return { label, ops };
  };

/** ADR-310 — unbinding: the owner's row template stays as a static item (its `repeat` goes). */
export const clearRowTemplates =
  (ownerId: NodeId): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    for (const group of catalogRowItemGroups(reader, ownerId))
      for (const position of group)
        if (nodeOf(reader, position)?.repeat)
          writeRepeat(draft, (position.target as { id: NodeId }).id, false);
    return { label: "Unbind data", ops: draft.ops() };
  };

/**
 * ADR-310 §4.4 「템플릿 바꾸기」 — the item becomes its bound list's rows' template: the mark moves
 * to it from the other items of its level (a Tab takes its TabPanel along). One step.
 */
export const setRowTemplate =
  (input: { itemId: NodeId }): CatalogCommand =>
  (reader) => {
    const label = "Use as row template";
    const draft = new CommandDraft(reader);
    const item = draft.node(input.itemId);
    let type = "";
    try {
      type = definitionTypeName(reader, item.definitionId);
    } catch {
      type = "";
    }
    if (!CATALOG_ROW_ITEM_TYPES.has(type)) return fail("REPEAT_NOT_ITEM", input.itemId);
    // The bound owner the item's rows come from: the nearest bound ancestor whose levels hold it.
    for (
      let id: string | undefined = reader.ownerOf(input.itemId);
      id;
      id = reader.ownerOf(id)
    ) {
      const owner = reader.getEntry(id);
      if (owner?.kind !== "node" || !owner.binding) continue;
      const groups = catalogRowItemGroups(reader, owner.id);
      const group = groups.find((level) =>
        level.some(
          (position) =>
            position.target.kind === "node" &&
            position.target.id === input.itemId,
        ),
      );
      if (!group) continue;
      const panels =
        type === "Tab"
          ? catalogPairedTabPanels(draft, { kind: "node", id: input.itemId })
              .filter((panel) => panel.kind === "node")
              .map((panel) => (panel as { id: NodeId }).id)
          : [];
      const panelLevel = panels.length
        ? groups.find((level) =>
            level.some(
              (position) =>
                position.target.kind === "node" &&
                panels.includes(position.target.id),
            ),
          )
        : undefined;
      for (const level of [group, ...(panelLevel ? [panelLevel] : [])])
        for (const position of level)
          if (position.target.kind === "node")
            writeRepeat(
              draft,
              position.target.id,
              position.target.id === input.itemId ||
                panels.includes(position.target.id),
            );
      return { label, ops: draft.ops(), selectAfter: [input.itemId] };
    }
    return fail("NOT_IN_BOUND_LIST", input.itemId);
  };
