import {
  copyNodes,
  duplicateNodes,
  groupNodes,
  moveNodes,
  pasteNodes,
  removeTargets,
  ungroupNodes,
  type CatalogClipboard,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type {
  ContextMenuIcon,
  ContextMenuItem,
} from "../components/overlay/contextMenu/types";
import { ACTION_ICONS } from "../config/actionIcons";
import type { ShortcutId } from "../config/keyboardShortcuts";
import type { CatalogConsumerNode } from "./compositionRoot";
import type { CatalogSelectionItem } from "./session";

const PAGE_GRID = "catalog:root";
const isNodeSource = (id: string) => id.startsWith("project:node:");

/** What the Canvas context menu reads and runs (the open `CatalogWorkspace`). */
export interface CatalogMenuHost {
  readonly graph: CatalogReader;
  readonly records: ReadonlyMap<string, CatalogConsumerNode>;
  selection(): readonly CatalogSelectionItem[];
  execute(command: CatalogCommand): void;
  newId: NewId;
  /** The in-app clipboard of this project (copied subtrees). */
  clipboard: {
    get(): CatalogClipboard | undefined;
    set(value: CatalogClipboard): void;
  };
}

/**
 * ADR-248 Phase 4e-3b: the Canvas context menu of the open project — copy · paste · duplicate,
 * z-order (front, forward, backward, back), group · ungroup and delete over the selection, or paste
 * into the page body under the pointer on the page background. Every item is the new command; an
 * item whose command would be refused (nesting, a composite, another parent) is left out.
 */
export function catalogCanvasMenuItems(
  host: CatalogMenuHost,
  surface: "canvas-element" | "canvas-empty",
  /** The record under the pointer (the page body on the page background, if any). */
  pickedRecord: string | undefined,
): ContextMenuItem[] {
  const allowed = (command: CatalogCommand) => {
    try {
      command(host.graph);
      return true;
    } catch {
      return false;
    }
  };
  const action = (
    id: string,
    labelKey: string,
    command: CatalogCommand,
    shortcutId: ShortcutId | undefined,
    icon: ContextMenuIcon | undefined,
    destructive = false,
  ): ContextMenuItem[] =>
    allowed(command)
      ? [
          {
            kind: "action",
            id,
            labelKey,
            ...(icon ? { icon } : {}),
            ...(shortcutId ? { shortcutId } : {}),
            ...(destructive ? { destructive } : {}),
            run: () => host.execute(command),
          },
        ]
      : [];
  const clipboard = host.clipboard.get();
  const pasteInto = (parent: NodeId, index?: number) =>
    clipboard &&
    pasteNodes({
      clipboard,
      parent: { kind: "node", id: parent },
      ...(index !== undefined ? { index } : {}),
      newId: host.newId,
    });

  if (surface === "canvas-empty") {
    const page = pickedRecord ? host.records.get(pickedRecord) : undefined;
    const paste =
      page && isNodeSource(page.sourceId)
        ? pasteInto(page.sourceId as NodeId)
        : undefined;
    return paste
      ? action(
          "paste",
          "contextMenu.pasteHere",
          paste,
          "paste",
          ACTION_ICONS.paste,
        )
      : [];
  }

  const selection = host.selection();
  const elements = selection.filter(
    (item) =>
      item.target.kind === "node" &&
      host.records.get(item.identity)?.parentId !== PAGE_GRID,
  );
  const ids = elements.map(
    (item) => item.target.kind === "node" && item.target.id,
  ) as NodeId[];
  if (!ids.length) return [];
  const items: ContextMenuItem[] = [];
  const copy: ContextMenuItem = {
    kind: "action",
    id: "copy",
    labelKey: "contextMenu.copy",
    icon: ACTION_ICONS.copy,
    shortcutId: "copy",
    run: () => host.clipboard.set(copyNodes(host.graph, ids)),
  };
  items.push(copy);
  // Paste after the last selected element, in its parent.
  const last = host.records.get(elements[elements.length - 1].identity)!;
  const parent = host.records.get(last.parentId);
  if (parent && isNodeSource(parent.sourceId)) {
    const at = parent.children.indexOf(last.id) + 1;
    const paste = pasteInto(parent.sourceId as NodeId, at);
    if (paste)
      items.push(
        ...action(
          "paste",
          "contextMenu.paste",
          paste,
          "paste",
          ACTION_ICONS.paste,
        ),
      );
  }
  items.push(
    ...action(
      "duplicate",
      "contextMenu.duplicate",
      duplicateNodes({ ids, newId: host.newId }),
      "duplicate",
      ACTION_ICONS.duplicate,
    ),
  );

  // Z-order: one element among its siblings (the index counts the siblings without it).
  if (ids.length === 1 && parent && isNodeSource(parent.sourceId)) {
    const index = parent.children.indexOf(last.id);
    const siblings = parent.children.length - 1;
    const reorder = (to: number) =>
      moveNodes({
        ids,
        parent: { kind: "node", id: parent.sourceId as NodeId },
        index: to,
        newId: host.newId,
        label: "Reorder",
      });
    const order: ContextMenuItem[] = [];
    if (index < siblings) {
      order.push(
        ...action(
          "bring-to-front",
          "contextMenu.bringToFront",
          reorder(siblings),
          "bringToFront",
          undefined,
        ),
      );
      order.push(
        ...action(
          "bring-forward",
          "contextMenu.bringForward",
          reorder(index + 1),
          "bringForward",
          undefined,
        ),
      );
    }
    if (index > 0) {
      order.push(
        ...action(
          "send-backward",
          "contextMenu.sendBackward",
          reorder(index - 1),
          "sendBackward",
          undefined,
        ),
      );
      order.push(
        ...action(
          "send-to-back",
          "contextMenu.sendToBack",
          reorder(0),
          "sendToBack",
          undefined,
        ),
      );
    }
    if (order.length)
      items.push({ kind: "separator", id: "order-separator" }, ...order);
  }

  const structure: ContextMenuItem[] = [
    ...action(
      "group",
      "contextMenu.group",
      groupNodes({
        ids,
        group: {
          kind: "node",
          id: host.newId("node"),
          definitionId: "lib:definition:type-frame",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
        newId: host.newId,
      }),
      "group",
      ACTION_ICONS.group,
    ),
    ...(ids.every((id) => {
      const entry = host.graph.getEntry(id);
      return entry?.kind === "node" && entry.children.length > 0;
    })
      ? action(
          "ungroup",
          "contextMenu.ungroup",
          ungroupNodes({ ids, newId: host.newId }),
          "ungroup",
          ACTION_ICONS.ungroup,
        )
      : []),
  ];
  if (structure.length)
    items.push({ kind: "separator", id: "structure-separator" }, ...structure);
  items.push(
    { kind: "separator", id: "delete-separator" },
    ...action(
      "delete",
      "contextMenu.delete",
      removeTargets({ targets: elements.map((item) => item.target) }),
      "delete",
      ACTION_ICONS.delete,
      true,
    ),
  );
  return items;
}
