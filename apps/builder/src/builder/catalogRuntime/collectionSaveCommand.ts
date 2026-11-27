/**
 * ADR-324 Decision 1 · 7 — the Data panel's 「모아서 저장」 switch as one command (one undo):
 *
 * - on: the collection takes its `save` setting; the rules that would save its edits at once
 *   (`catalogImmediateSaveRules` — the document refuses them beside it) go when the author chose
 *   「규칙을 지우고 켜기」; each Table bound to it gets a save bar after it (사용자 결정 5) — a frame
 *   (row) with the unsaved count (`{{ changes.<collection>.count }}`), 「Discard」 and 「Save」
 *   Buttons whose rules run the two Dos, disabled while nothing can be saved (`!var.changes:…`).
 * - an edit of the setting writes it alone.
 * - off takes the setting away with what cannot stand without it (round 3 m14 — the document
 *   refuses a 「변경 저장」 Do on a collection without `save`, so the switch that made a bar could
 *   not be turned off): the save bars still as made (a frame holding only the collection's save ·
 *   discard Buttons and its count Text) go whole; a save Do anywhere else loses its rule, the node
 *   stays the author's.
 */
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  collectionSaveBarLabels,
  type CollectionSaveBarLabels,
} from "../../../../../packages/shared/src/catalog/runtime/collectionSaveText";
import { catalogSiteLanguage } from "../../../../../packages/shared/src/catalog/document/templateLocalizedProps";
import { setDataEntries } from "../../../../../packages/shared/src/catalog/commands/data";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { removeRecords } from "../../../../../packages/shared/src/catalog/commands/project";
import { removeTargets } from "../../../../../packages/shared/src/catalog/commands/structure";
import { catalogActionsDeep } from "../../../../../packages/shared/src/catalog/document/interactionActions";
import { setFields } from "../../../../../packages/shared/src/catalog/commands/fields";
import { insertNodes } from "../../../../../packages/shared/src/catalog/commands/structure";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogReader,
  CollectionEntry,
  CollectionSaveSettings,
  DataCollectionId,
  EntryId,
  InteractionEntry,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  ProjectEntry,
  PropWrites,
} from "../../../../../packages/shared/src/catalog/document/types";
import { CATALOG_CHANGES_ROOT } from "../../../../../packages/shared/src/catalog/runtime/stateTemplate";
import { catalogParentOfNode } from "./insertParent";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "./paletteInsert";
import { catalogStyleWritesOf } from "./styleFields";
import { childIdsOf, sequence } from "./viewAuthoring";

/** The collection's raw id (the `{{ changes.<id> }}` · `!var.changes:<id>` key). */
const rawCollectionId = (id: string) => id.slice("data:collection:".length);

/** The Tables bound to the collection (where a save bar goes). */
export function catalogCollectionTables(
  graph: Pick<CatalogGraph, "bindingsOf" | "getEntry" | "library">,
  collectionId: string,
): NodeId[] {
  return [...graph.bindingsOf(collectionId)].filter((id) => {
    const entry = graph.getEntry(id);
    if (entry?.kind !== "node") return false;
    try {
      return definitionTypeName(graph as never, entry.definitionId) === "Table";
    } catch {
      return false;
    }
  }) as NodeId[];
}

function saveBarEntries(
  stage: Parameters<typeof catalogCreationProps>[0],
  collectionId: DataCollectionId,
  labels: CollectionSaveBarLabels,
  newId: NewId,
): { entries: NodeEntry[]; rootId: NodeId; related: InteractionEntry[] } {
  const raw = rawCollectionId(collectionId);
  const frameId = newId("node") as NodeId;
  const textId = newId("node") as NodeId;
  const mineId = newId("node") as NodeId;
  const serverId = newId("node") as NodeId;
  const linkId = newId("node") as NodeId;
  const resendId = newId("node") as NodeId;
  const dropPendingId = newId("node") as NodeId;
  const discardId = newId("node") as NodeId;
  const saveId = newId("node") as NodeId;
  const textDef = catalogPaletteDefinitionId(
    stage.library,
    "Text",
  ) as LibraryDefinitionId;
  const buttonDef = catalogPaletteDefinitionId(
    stage.library,
    "Button",
  ) as LibraryDefinitionId;
  // (Nothing to save · a save on its way: the buttons wait — `canSave` · `canDiscard` are the
  //  session's values, false in the Canvas where no changes exist.)
  const disabledUnless = (flag: string): PropWrites[string] => ({
    kind: "set",
    value: {
      kind: "when",
      subject: `!var.${CATALOG_CHANGES_ROOT}:${raw}.${flag}`,
      op: "notEquals",
      value: true,
    },
  });
  const button = (
    id: NodeId,
    label: string,
    variant: string,
    flag: string,
  ): NodeEntry => ({
    kind: "node",
    id,
    definitionId: buttonDef,
    children: [],
    props: {
      ...catalogCreationProps(stage, buttonDef, "Button", { label, variant }),
      isDisabled: disabledUnless(flag),
    },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  const frame: NodeEntry = {
    kind: "node",
    id: frameId,
    name: "Save bar",
    definitionId: "lib:definition:type-frame",
    children: [
      textId,
      mineId,
      serverId,
      linkId,
      resendId,
      dropPendingId,
      discardId,
      saveId,
    ],
    props: {},
    ...(catalogStyleWritesOf({
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: "8px",
    }) as Pick<NodeEntry, "visual" | "sizing">),
    descendantOverrides: [],
  } as NodeEntry;
  const text: NodeEntry = {
    kind: "node",
    id: textId,
    definitionId: textDef,
    children: [],
    props: {
      ...catalogCreationProps(stage, textDef, "Text"),
      children: {
        kind: "set",
        value: labels.unsaved.replace(
          "{count}",
          `{{ ${CATALOG_CHANGES_ROOT}.${raw}.count }}`,
        ),
      },
    },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  const rule = (
    ownerId: NodeId,
    action:
      | { opcode: "saveChanges"; scope?: "conflicts" | "link" | "pending" }
      | { opcode: "discardChanges"; scope?: "conflicts" | "pending" },
  ): InteractionEntry => ({
    kind: "interaction",
    id: newId("interaction") as EntryId<"interaction">,
    ownerId,
    trigger: "onPress",
    actions: [{ ...action, collectionId }],
  });
  return {
    entries: [
      frame,
      text,
      button(mineId, labels.keepMine, "secondary", "hasConflicts"),
      button(serverId, labels.takeServer, "secondary", "hasConflicts"),
      button(linkId, labels.link, "secondary", "hasUnlinked"),
      button(resendId, labels.resend, "secondary", "hasPending"),
      button(dropPendingId, labels.dropPending, "secondary", "hasPending"),
      button(discardId, labels.discard, "secondary", "canDiscard"),
      button(saveId, labels.save, "accent", "canSave"),
    ],
    rootId: frameId,
    related: [
      rule(saveId, { opcode: "saveChanges" }),
      rule(discardId, { opcode: "discardChanges" }),
      rule(mineId, { opcode: "saveChanges", scope: "conflicts" }),
      rule(serverId, { opcode: "discardChanges", scope: "conflicts" }),
      rule(linkId, { opcode: "saveChanges", scope: "link" }),
      rule(resendId, { opcode: "saveChanges", scope: "pending" }),
      rule(dropPendingId, { opcode: "discardChanges", scope: "pending" }),
    ],
  };
}

/**
 * What turning the collection's 「모아서 저장」 off takes along: the rules holding a 「변경 저장」
 * Do of it (refused without `save`), and the save bars still as made — a frame whose children are
 * only that collection's save · discard rule owners and its count Text.
 */
export function catalogSaveDependents(
  stage: CatalogReader,
  collectionId: DataCollectionId,
): { ruleIds: EntryId<"interaction">[]; barIds: NodeId[] } {
  const project = stage.getEntry(stage.projectId) as ProjectEntry | undefined;
  const raw = rawCollectionId(collectionId);
  const names = (rule: InteractionEntry, opcodes: readonly string[]) =>
    catalogActionsDeep(rule.actions).some(
      (action) =>
        opcodes.includes(action.opcode) &&
        "collectionId" in action &&
        action.collectionId === collectionId,
    );
  const saveRules: InteractionEntry[] = [];
  const owners = new Set<string>();
  for (const id of project?.interactionIds ?? []) {
    const rule = stage.getEntry(id);
    if (rule?.kind !== "interaction") continue;
    if (names(rule, ["saveChanges"])) saveRules.push(rule);
    if (names(rule, ["saveChanges", "discardChanges"])) owners.add(rule.ownerId);
  }
  const readsCount = (id: string) => {
    const entry = stage.getEntry(id);
    const text =
      entry?.kind === "node" && entry.props.children?.kind === "set"
        ? entry.props.children.value
        : undefined;
    return (
      typeof text === "string" &&
      text.includes(`${CATALOG_CHANGES_ROOT}.${raw}.`)
    );
  };
  const bars = new Set<NodeId>();
  for (const rule of saveRules) {
    const parentId = stage.ownerOf(rule.ownerId);
    const parent = parentId ? stage.getEntry(parentId) : undefined;
    if (
      parent?.kind === "node" &&
      parent.definitionId === "lib:definition:type-frame" &&
      parent.children.every((child) => owners.has(child) || readsCount(child))
    )
      bars.add(parent.id);
  }
  return {
    ruleIds: saveRules
      .filter((rule) => !bars.has(stage.ownerOf(rule.ownerId) as NodeId))
      .map((rule) => rule.id),
    barIds: [...bars],
  };
}

/**
 * The switch's command: the collection with `save` (undefined = off — with its dependents,
 * `catalogSaveDependents`), the rules named go, and on the first turn-on (`saveBars`) a bar after
 * each bound Table.
 */
export function catalogCollectionSaveCommand(
  graph: CatalogGraph,
  input: {
    collectionId: DataCollectionId;
    save: CollectionSaveSettings | undefined;
    removeRuleIds?: readonly string[];
    /** Put a save bar after each bound Table (its texts in the site's language). */
    saveBars?: boolean;
    label?: string;
  },
  newId: NewId,
): CatalogCommand {
  const tables = input.saveBars
    ? catalogCollectionTables(graph, input.collectionId)
    : [];
  return sequence(
    input.label ?? (input.save ? "Turn on batch save" : "Turn off batch save"),
    [
      () =>
        input.removeRuleIds?.length
          ? removeRecords({
              ids: input.removeRuleIds as EntryId<"interaction">[],
            })
          : undefined,
      (stage) => {
        const entry = stage.getEntry(input.collectionId);
        if (entry?.kind !== "collection")
          throw new Error(`ENTRY_NOT_FOUND: ${input.collectionId}`);
        const { save: _old, ...rest } = entry;
        const next: CollectionEntry = input.save
          ? { ...rest, save: input.save }
          : rest;
        return setDataEntries({ puts: [next] });
      },
      (stage) => {
        if (input.save) return undefined;
        const { barIds } = catalogSaveDependents(stage, input.collectionId);
        return barIds.length
          ? removeTargets({
              targets: barIds.map((id) => ({ kind: "node" as const, id })),
              newId,
            })
          : undefined;
      },
      (stage) => {
        if (input.save) return undefined;
        // (Read again: the bars' own rules went with them.)
        const { ruleIds } = catalogSaveDependents(stage, input.collectionId);
        return ruleIds.length ? removeRecords({ ids: ruleIds }) : undefined;
      },
      // (Each bound Table shows the rows' edit · save marks — a refused · conflicted row is seen.)
    ...tables.map(
      (tableId) => () =>
        setFields({
          targets: [{ kind: "node" as const, id: tableId }],
          props: { showEditMarks: { kind: "set", value: true } },
        }),
    ),
    ...tables.map(
        (tableId) => (stage: Parameters<typeof catalogCreationProps>[0]) => {
          const parent = catalogParentOfNode(stage, tableId);
          if (!parent) return undefined;
          const bar = saveBarEntries(
            stage,
            input.collectionId,
            collectionSaveBarLabels(catalogSiteLanguage(graph)),
            newId,
          );
          return insertNodes({
            parent,
            index: childIdsOf(stage, parent).indexOf(tableId) + 1,
            entries: bar.entries,
            rootIds: [bar.rootId],
            related: bar.related,
            newId,
          });
        },
      ),
    ],
  );
}
