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
  DefinitionId,
  EntryId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type {
  ContextMenuIcon,
  ContextMenuItem,
} from "../components/overlay/contextMenu/types";
import { Maximize, Percent } from "lucide-react";
import {
  ACTION_ICONS,
  ALIGNMENT_ICONS,
  DISTRIBUTION_ICONS,
} from "../config/actionIcons";
import {
  getAlignmentLabelKey,
  type AlignmentType,
} from "../stores/utils/elementAlignment";
import {
  getDistributionLabelKey,
  type DistributionType,
} from "../stores/utils/elementDistribution";
import {
  confirmCatalogDetach,
  confirmCatalogDissolve,
} from "./componentConfirm";
import {
  catalogComponentCommands,
  catalogComponentState,
} from "./componentActions";
import { catalogPageContentTarget } from "./pageSettings";
import type { CatalogDefinitionViewId } from "./session";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
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
  /** A scene point as a placement inside a record (its padding-box origin) — "Paste here". */
  pointIn?(
    identity: string,
    point: { x: number; y: number },
  ): { x: number; y: number } | undefined;
  /** Open a project component's definition edit view (go to origin). */
  showDefinition?(id: CatalogDefinitionViewId): void;
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
  surface: "canvas-element" | "canvas-empty",
  /** The record under the pointer (the page body on the page background, if any). */
  pickedRecord: string | undefined,
  /** The pointer's scene point (a context menu): "Paste here" puts absolute copies there. */
  point?: { x: number; y: number },
): ContextMenuItem[] {
  const allowed = (id: string, command: CatalogCommand) => {
    try {
      command(host.graph);
      return true;
    } catch (error) {
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
  ): ContextMenuItem[] =>
    allowed(id, command)
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
  const pasteInto = (parent: NodeId, index?: number) =>
    clipboard &&
    pasteNodes({
      clipboard,
      parent: { kind: "node", id: parent },
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
      duplicateNodes({ ids, newId: host.newId, placement: COPY_OFFSET }),
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
  const states = ids.map((id) => catalogComponentState(host.graph, id));
  const single = ids.length === 1 ? states[0] : undefined;
  const origin = single?.instanceOf;
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
  if (single && origin?.project)
    component.push(
      ...action(
        "toggle-component-origin",
        "componentAction.detachComponent",
        catalogComponentCommands.dissolve(origin.definitionId, host.newId),
        "toggleComponentOrigin",
        ACTION_ICONS.detach,
        false,
        (execute) =>
          void confirmCatalogDissolve(host.graph, origin.definitionId, execute),
      ),
    );
  else if (single && !origin) {
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
      ),
    );
  }
  if (component.some((item) => item.id !== "detach-instance"))
    items.push({ kind: "separator", id: "component-separator" });
  items.push(...component);
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
