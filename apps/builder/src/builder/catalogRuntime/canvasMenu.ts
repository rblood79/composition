import { docCounters } from "../../../../../packages/shared/src/catalog/docCounters";
import { Maximize, Percent } from "lucide-react";
import {
  copyNodes,
  duplicateNodes,
  groupNodes,
  moveNodes,
  pasteNodes,
  removeTargets,
  reorderReadsIndex,
  ungroupNodes,
  type CatalogClipboard,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  DefinitionId,
  NodeId,
  NodeParent,
} from "../../../../../packages/shared/src/catalog/document/types";
import type {
  ContextMenuIcon,
  ContextMenuItem,
} from "../components/overlay/contextMenu/types";
import {
  ACTION_ICONS,
  ALIGNMENT_ICONS,
  DISTRIBUTION_ICONS,
} from "../config/actionIcons";
import type { ShortcutId } from "../config/keyboardShortcuts";
import {
  getAlignmentLabelKey,
  type AlignmentType,
} from "../stores/utils/elementAlignment";
import {
  getDistributionLabelKey,
  type DistributionType,
} from "../stores/utils/elementDistribution";
import {
  catalogComponentCommands,
  catalogComponentState,
} from "./componentActions";
import {
  confirmCatalogPush,
  confirmCatalogDetach,
  confirmCatalogDissolve,
} from "./componentConfirm";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogParentOfNode } from "./insertParent";
import { catalogPageContentTarget } from "./pageSettings";
import type { CatalogDefinitionViewId, CatalogSelectionItem } from "./session";

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
  /** Align / distribute the selection (`undefined` = nothing would move). */
  arrange?(id: CatalogArrangeItem): CatalogCommand | undefined;
  /** Prepare the menu from one geometry snapshot; refreshed on every menu build. */
  arrangeItems?(): Partial<
    Record<CatalogArrangeItem, CatalogCommand | undefined>
  >;
  /**
   * An item left out because its command would be refused: the refusal (a shortcut tells the
   * user why nothing happened, as the old `notifyOperationRejected` did).
   */
  noteRefusal?(itemId: string, error: unknown): void;
  /**
   * A paste the selected element refused went to `parent` instead: the old relocation notice
   * (with undo) when the refusal is a nesting rule.
   */
  notePasteRelocated?(refusal: unknown, parent: NodeParent): void;
  /** A scene point as a placement inside a record (its padding-box origin) — "Paste here". */
  pointIn?(
    identity: string,
    point: { x: number; y: number },
  ): { x: number; y: number } | undefined;
  /** ADR-261: open Swap instance for an instance (the Design panel's component list). */
  swapInstance?(id: NodeId): void;
  /** Open a project component's definition edit view (go to origin). */
  showDefinition?(id: CatalogDefinitionViewId): void;
  /** The definition edit view open now (its root is that component's origin). */
  definitionView?(): string | undefined;
  /** The empty-area view items: fit, 100 %, rulers and snapping (Builder view settings). */
  view?: {
    zoomToFit(): void;
    zoom100(): void;
    rulers: boolean;
    toggleRulers(): void;
    snap: boolean;
    toggleSnap(): void;
  };
}

/** The align / distribute shortcut each menu item runs. */
export type CatalogArrangeItem =
  | "alignLeft"
  | "alignHCenter"
  | "alignRight"
  | "alignTop"
  | "alignVCenter"
  | "alignBottom"
  | "distributeH"
  | "distributeV";
const ALIGN_ITEMS: readonly [AlignmentType, CatalogArrangeItem][] = [
  ["left", "alignLeft"],
  ["center", "alignHCenter"],
  ["right", "alignRight"],
  ["top", "alignTop"],
  ["middle", "alignVCenter"],
  ["bottom", "alignBottom"],
];
/** The old duplicate / paste offset for absolutely placed copies. */
const COPY_OFFSET = { offset: { x: 10, y: 10 } } as const;

const DISTRIBUTE_ITEMS: readonly [DistributionType, CatalogArrangeItem][] = [
  ["horizontal", "distributeH"],
  ["vertical", "distributeV"],
];

/**
 * ADR-248 Phase 4e-3b: the Canvas context menu of the open project — copy · paste · duplicate,
 * z-order (front, forward, backward, back), group · ungroup and delete over the selection, or paste
 * into the page body under the pointer on the page background. Every item is the new command; an
 * item whose command would be refused (nesting, a composite, another parent) is left out.
 */
export function catalogCanvasMenuItems(
  host: CatalogMenuHost,
  surface: "canvas-element" | "canvas-empty" | "action-bar",
  /** The record under the pointer (the page body on the page background, if any). */
  pickedRecord: string | undefined,
  /** The pointer's scene point (a context menu): "Paste here" puts absolute copies there. */
  point?: { x: number; y: number },
): ContextMenuItem[] {
  const allowed = (id: string, command: CatalogCommand) => {
    const counting = process.env.NODE_ENV === "development";
    if (counting) docCounters.menuDryRuns += 1;
    try {
      command(host.graph);
      return true;
    } catch (error) {
      if (counting) docCounters.menuRefusals += 1;
      host.noteRefusal?.(id, error);
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
    /** Runs the step after a confirmation (detach · dissolve); absent = at once. */
    confirmThen?: (execute: () => void) => void,
    /**
     * `true`: the command is not planned here to see whether it would be refused — for one that
     * cannot be (Create component on an owned node), the dry-run per menu build was the cost
     * (ADR-246 ratchet: the action bar builds the menu on every selection).
     */
    trusted = false,
  ): ContextMenuItem[] =>
    trusted || allowed(id, command)
      ? [
          {
            kind: "action",
            id,
            labelKey,
            ...(icon ? { icon } : {}),
            ...(shortcutId ? { shortcutId } : {}),
            ...(destructive ? { destructive } : {}),
            run: () =>
              confirmThen
                ? confirmThen(() => host.execute(command))
                : host.execute(command),
          },
        ]
      : [];
  const clipboard = host.clipboard.get();
  // Absolute copies land 10 px from their source (the old paste), so they are not hidden under it.
  const pasteInto = (parent: NodeParent, index?: number) =>
    clipboard &&
    pasteNodes({
      clipboard,
      parent,
      ...(index !== undefined ? { index } : {}),
      newId: host.newId,
      placement: COPY_OFFSET,
    });

  if (surface === "canvas-empty") {
    const page = pickedRecord ? host.records.get(pickedRecord) : undefined;
    // Into the page body, or the slot its content fills when a layout is applied.
    const content =
      page && isNodeSource(page.sourceId)
        ? catalogPageContentTarget(host.graph, page.sourceId as NodeId)
        : undefined;
    // "Paste here": absolute copies go to the pointer (the page body's padding-box point).
    const at =
      point && pickedRecord && content?.kind === "node"
        ? host.pointIn?.(pickedRecord, point)
        : undefined;
    const paste =
      clipboard && content
        ? pasteNodes({
            clipboard,
            parent:
              content.kind === "node"
                ? { kind: "node", id: content.id }
                : {
                    kind: "descendant",
                    ownerId: content.ownerId,
                    address: content.address,
                  },
            newId: host.newId,
            placement: at ? { at } : COPY_OFFSET,
          })
        : undefined;
    const items: ContextMenuItem[] = paste
      ? action(
          "paste",
          "contextMenu.pasteHere",
          paste,
          "paste",
          ACTION_ICONS.paste,
        )
      : [];
    const view = host.view;
    if (view)
      items.push(
        { kind: "separator", id: "viewport-separator" },
        {
          kind: "action",
          id: "zoom-to-fit",
          labelKey: "contextMenu.zoomToFit",
          icon: Maximize,
          shortcutId: "zoomToFit",
          run: view.zoomToFit,
        },
        {
          kind: "action",
          id: "zoom-100",
          labelKey: "100%",
          icon: Percent,
          shortcutId: "zoom100",
          run: view.zoom100,
        },
        { kind: "separator", id: "settings-separator" },
        {
          kind: "toggle",
          id: "show-rulers",
          labelKey: view.rulers
            ? "contextMenu.hideRulers"
            : "contextMenu.showRulers",
          icon: ACTION_ICONS.toggleRulers,
          checked: view.rulers,
          shortcutId: "toggleRulers",
          run: view.toggleRulers,
        },
        {
          kind: "toggle",
          id: "snap-to-objects",
          labelKey: "contextMenu.snapToObjects",
          icon: ACTION_ICONS.toggleSnap,
          checked: view.snap,
          run: view.toggleSnap,
        },
      );
    return items;
  }

  const selection = host.selection();
  // Deletion takes every selected target: a node inside an instance is a `descendant` target that
  // `removeTargets` turns off in its owner (the Layers panel's delete does the same — ADR-256 후속 17).
  const removable = selection.filter(
    (item) => host.records.get(item.identity)?.parentId !== PAGE_GRID,
  );
  const deletion = (): ContextMenuItem[] =>
    surface === "action-bar"
      ? []
      : [
          { kind: "separator", id: "delete-separator" },
          ...action(
            "delete",
            "contextMenu.delete",
            removeTargets({
              targets: removable.map((item) => item.target),
              newId: host.newId,
            }),
            "delete",
            ACTION_ICONS.delete,
            true,
          ),
        ];
  const elements = removable.filter((item) => item.target.kind === "node");
  const ids = elements.map(
    (item) => item.target.kind === "node" && item.target.id,
  ) as NodeId[];
  // (Only descendants: copy · paste · component actions take owned nodes — deletion alone.)
  if (!ids.length) return removable.length ? deletion().slice(1) : [];
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
  // Paste into the last selected element, at its end (the old paste — the palette's rule); one that
  // cannot hold the copy passes it to its parent, after itself, with the old relocation notice.
  const last = host.records.get(elements[elements.length - 1].identity)!;
  const parent = host.records.get(last.parentId);
  // ADR-261: where the node lives — inside an instance, its slot (`fillSlot`), never the origin's
  // or the layout's template node the parent record was projected from.
  const into = catalogParentOfNode(host.graph, ids[ids.length - 1]);
  const inside = pasteInto({ kind: "node", id: ids[ids.length - 1] });
  let refusedInside: unknown;
  if (inside)
    try {
      if (process.env.NODE_ENV === "development") docCounters.menuDryRuns += 1;
      inside(host.graph);
    } catch (error) {
      if (process.env.NODE_ENV === "development")
        docCounters.menuRefusals += 1;
      refusedInside = error;
    }
  if (inside && refusedInside === undefined)
    items.push(
      ...action("paste", "contextMenu.paste", inside, "paste", ACTION_ICONS.paste),
    );
  else if (parent && into) {
    const at = parent.children.indexOf(last.id) + 1;
    const paste = pasteInto(into, at);
    if (paste)
      items.push(
        ...action(
          "paste",
          "contextMenu.paste",
          paste,
          "paste",
          ACTION_ICONS.paste,
        ).map((item) =>
          item.kind === "action" && refusedInside !== undefined
            ? {
                ...item,
                run: () => {
                  void item.run();
                  host.notePasteRelocated?.(refusedInside, into);
                },
              }
            : item,
        ),
      );
  }
  items.push(
    ...action(
      "duplicate",
      "contextMenu.duplicate",
      duplicateNodes({ ids, newId: host.newId, placement: COPY_OFFSET }),
      "duplicate",
      ACTION_ICONS.duplicate,
    ),
  );

  // Z-order: one element among its siblings (the index counts the siblings without it).
  if (ids.length === 1 && parent && into) {
    const index = parent.children.indexOf(last.id);
    const siblings = parent.children.length - 1;
    const reorder = (to: number) =>
      moveNodes({
        ids,
        parent: into,
        index: to,
        newId: host.newId,
        label: "Reorder",
      });
    // ADR-265 (C7): a reorder among the same siblings is refused or not whatever the index — no
    // check of `moveNodes` reads it (into itself, nesting, required parts, state owners, aligned
    // tables) — so one plan decides all four items (each plan copied the 5k sibling list). A RAC
    // Table column takes its cells along by index: its items are each planned.
    const column = reorderReadsIndex(host.graph, ids[0]!);
    let verdict: { allowed: true } | { allowed: false; error: unknown } | null =
      null;
    const shared = (itemId: string, command: CatalogCommand) => {
      if (column) return allowed(itemId, command);
      if (!verdict) {
        if (process.env.NODE_ENV === "development") docCounters.menuDryRuns += 1;
        try {
          command(host.graph);
          verdict = { allowed: true };
        } catch (error) {
          if (process.env.NODE_ENV === "development")
            docCounters.menuRefusals += 1;
          verdict = { allowed: false, error };
        }
      }
      if (!verdict.allowed) host.noteRefusal?.(itemId, verdict.error);
      return verdict.allowed;
    };
    const reorderItem = (
      itemId: string,
      labelKey: string,
      to: number,
      shortcutId: ShortcutId,
    ): ContextMenuItem[] => {
      const command = reorder(to);
      return shared(itemId, command)
        ? action(itemId, labelKey, command, shortcutId, undefined, false, undefined, true)
        : [];
    };
    const order: ContextMenuItem[] = [];
    if (index < siblings) {
      order.push(
        ...reorderItem(
          "bring-to-front",
          "contextMenu.bringToFront",
          siblings,
          "bringToFront",
        ),
      );
      order.push(
        ...reorderItem(
          "bring-forward",
          "contextMenu.bringForward",
          index + 1,
          "bringForward",
        ),
      );
    }
    if (index > 0) {
      order.push(
        ...reorderItem(
          "send-backward",
          "contextMenu.sendBackward",
          index - 1,
          "sendBackward",
        ),
      );
      order.push(
        ...reorderItem(
          "send-to-back",
          "contextMenu.sendToBack",
          0,
          "sendToBack",
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

  // Align / distribute (the old menu's submenu): each item only when it would move something.
  const arrange = host.arrange;
  if (arrange) {
    const prepared = host.arrangeItems?.();
    const arrangeItem = (
      id: string,
      labelKey: string,
      shortcut: CatalogArrangeItem,
      icon: ContextMenuIcon,
    ): ContextMenuItem[] => {
      const command = prepared ? prepared[shortcut] : arrange(shortcut);
      return command ? action(id, labelKey, command, undefined, icon) : [];
    };
    const align = ALIGN_ITEMS.flatMap(([type, shortcut]) =>
      arrangeItem(
        `align-${type}`,
        getAlignmentLabelKey(type),
        shortcut,
        ALIGNMENT_ICONS[type],
      ),
    );
    const distribute = DISTRIBUTE_ITEMS.flatMap(([type, shortcut]) =>
      arrangeItem(
        `distribute-${type}`,
        getDistributionLabelKey(type),
        shortcut,
        DISTRIBUTION_ICONS[type],
      ),
    );
    if (align.length || distribute.length)
      items.push({
        kind: "submenu",
        id: "align",
        labelKey: "contextMenu.align",
        icon: ACTION_ICONS.align,
        items: [
          ...align,
          ...(align.length && distribute.length
            ? [{ kind: "separator" as const, id: "align-distribute-separator" }]
            : []),
          ...distribute,
        ],
      });
  }

  // Component items (the old registry's order: go to origin, detach, create / dissolve) — the
  // Properties Component section's commands over one selected element; detach takes the first
  // instance of a multi-selection, as the old menu did.
  const component: ContextMenuItem[] = [];
  const view = host.definitionView?.();
  const states = ids.map((id) => catalogComponentState(host.graph, id, view));
  const single = ids.length === 1 ? states[0] : undefined;
  const origin = single?.instanceOf;
  // Dissolving is the origin's; an instance detaches itself (user 2026-10-14 — the Component
  // section's rule).
  const ownOrigin = single?.originOf;
  // Go to component: a project component's template, or a built-in origin's view.
  if (origin && host.showDefinition) {
    const showDefinition = host.showDefinition;
    component.push({
      kind: "action",
      id: "go-to-origin",
      labelKey: "componentAction.goToOrigin",
      icon: ACTION_ICONS.goToOrigin,
      run: () => showDefinition(origin.definitionId as CatalogDefinitionViewId),
    });
  }
  // ADR-261 Decision 2: Swap instance (Figma's right-click item) — the component list opens.
  if (origin && single && host.swapInstance && !ownOrigin) {
    const swap = host.swapInstance;
    component.push({
      kind: "action",
      id: "swap-instance",
      labelKey: "componentAction.swapInstance",
      icon: ACTION_ICONS.swapInstance,
      run: () => swap(ids[0]),
    });
  }
  // ADR-262: the instance's override clean-up — push onto the origin (asks when other instances
  // take it), reset all (toast + undo). The instance itself only, as the Component section.
  if (origin && single && !ownOrigin) {
    const instanceId = ids[0];
    // (Trusted: an owned instance is never refused, and planning the push per menu build —
    // the action bar builds it on every selection — reads the origin's nodes: ADR-246 ratchet.)
    component.push(
      ...action(
        "push-changes",
        "componentAction.pushChanges",
        catalogComponentCommands.push(instanceId, host.newId),
        undefined,
        ACTION_ICONS.pushChanges,
        false,
        (execute) => void confirmCatalogPush(host.graph, instanceId, execute),
        true,
      ),
      ...action(
        "reset-all-changes",
        "componentAction.resetAllChanges",
        catalogComponentCommands.resetAll(instanceId),
        undefined,
        ACTION_ICONS.reset,
        false,
        undefined,
        true,
      ),
    );
  }
  // ADR-260 Decision 6: the component's origin was deleted — put it back beside this instance.
  if (origin?.restorable)
    component.push(
      ...action(
        "restore-origin",
        "componentAction.restoreOrigin",
        catalogComponentCommands.restore(ids[0]),
        undefined,
        ACTION_ICONS.restoreOrigin,
      ),
    );
  const detachable = ids.find((_, index) => states[index].instanceOf);
  if (detachable)
    component.push(
      ...action(
        "detach-instance",
        "componentAction.detachInstance",
        catalogComponentCommands.detach(detachable, host.newId),
        "detachInstance",
        ACTION_ICONS.detach,
        false,
        (execute) => void confirmCatalogDetach(host.graph, detachable, execute),
      ),
    );
  if (ownOrigin?.project)
    component.push(
      ...action(
        "toggle-component-origin",
        "componentAction.detachComponent",
        catalogComponentCommands.dissolve(ownOrigin.definitionId, host.newId),
        "toggleComponentOrigin",
        ACTION_ICONS.detach,
        false,
        (execute) =>
          void confirmCatalogDissolve(
            host.graph,
            ownOrigin.definitionId,
            execute,
          ),
      ),
    );
  else if (single && !ownOrigin) {
    const node = host.graph.getEntry(ids[0]);
    const name =
      (node?.kind === "node" &&
        (node.name ||
          definitionTypeName(host.graph, node.definitionId as DefinitionId))) ||
      "Component";
    component.push(
      ...action(
        "toggle-component-origin",
        "componentAction.createComponent",
        catalogComponentCommands.create(ids[0], name, host.newId),
        "toggleComponentOrigin",
        ACTION_ICONS.createComponent,
        false,
        undefined,
        true,
      ),
    );
  }
  if (component.some((item) => item.id !== "detach-instance"))
    items.push({ kind: "separator", id: "component-separator" });
  items.push(...component);
  // The bar policy excludes deletion. Planning it here would repeatedly copy each selected
  // node's sibling list, only to discard the result. Overflow still builds the full menu.
  items.push(...deletion());
  return items;
}
