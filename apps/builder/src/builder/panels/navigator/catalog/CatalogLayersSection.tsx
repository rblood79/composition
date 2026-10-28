import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { Key } from "react-stately";
import { ListLayout, Virtualizer } from "react-aria-components/Virtualizer";
import { Minimize } from "lucide-react";
import { removeTargets } from "../../../../../../../packages/shared/src/catalog/commands";
import type { EntryId } from "../../../../../../../packages/shared/src/catalog/document/types";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { resolveCatalogTreeContext } from "../../../catalogRuntime/canvasPick";
import type { CatalogDefinitionViewId } from "../../../catalogRuntime/session";
import {
  catalogLayerDropCommand,
  CatalogLayerTreeStore,
  type CatalogLayerNode,
} from "../../../catalogRuntime/layerTree";
import {
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { ActionIconButton } from "../../../components/ui/ActionIconButton";
import { Section } from "../../../components/panel/Section";
import { NAVIGATOR_SECTION_IDS } from "../navigatorSectionIds";
import { TreeBase } from "../tree/TreeBase";
import type { TreeItemState } from "../tree/TreeBase/types";
import { LAYER_TREE_ROW_SIZE_PX } from "../tree/LayerTree/virtualization";
import { CatalogLayerItem } from "./CatalogLayerItem";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import { catalogCanvasMenuItems } from "../../../catalogRuntime/canvasMenu";
import { catalogMenuHost } from "../../../catalogRuntime/shortcuts";
import { catalogMenuView } from "../../../workspace/canvas/catalog/catalogMenuView";
import { ContextMenuOverlay } from "../../../components/overlay/contextMenu/ContextMenuOverlay";
import { resolveContextMenuDisposition } from "../../../components/overlay/contextMenu/contextMenuPolicy";
import type {
  ContextMenuItem,
  ContextMenuRequest,
} from "../../../components/overlay/contextMenu/types";
import { useToastStore } from "../../../stores/toast";

const LAYOUT_OPTIONS = { rowSize: LAYER_TREE_ROW_SIZE_PX };
const EMPTY: readonly CatalogLayerNode[] = [];
const noSubscription = () => () => {};
// Stable item accessors (ADR-265): a new function each render made `TreeBase` re-index every row.
const layerKey = (node: CatalogLayerNode) => node.id;
const layerText = (node: CatalogLayerNode) => node.name;
const noSnapshot = () => EMPTY;

/**
 * What a row reads from the selection: indent guides and the selection's area. A context, not the
 * render closure — RAC keeps a row's render until that row's own state changes, so a closure drew
 * the last selection's area on the rows it did not re-render.
 */
const LayerRowSelection = createContext<{
  tree: CatalogLayerTreeStore | undefined;
  selectedKeys: ReadonlySet<Key>;
  selectedChain: ReadonlySet<string>;
  regionTails: ReadonlySet<string>;
} | null>(null);

function CatalogLayerRow({
  node,
  state,
  onDelete,
  onContextMenu,
}: {
  node: CatalogLayerNode;
  state: TreeItemState;
  onDelete: (node: CatalogLayerNode) => void;
  onContextMenu: (node: CatalogLayerNode, event: React.MouseEvent) => void;
}) {
  const selection = useContext(LayerRowSelection);
  const tree = selection?.tree;
  const guides: boolean[] = [];
  let underSelection = false;
  for (
    let parent = node.parentId && tree?.node(node.parentId);
    parent;
    parent = parent.parentId ? tree?.node(parent.parentId) : undefined
  ) {
    guides.unshift(!!selection?.selectedChain.has(parent.id));
    underSelection ||= !!selection?.selectedKeys.has(parent.id);
  }
  return (
    <CatalogLayerItem
      node={node}
      isSelected={state.isSelected}
      isExpanded={state.isExpanded}
      isFocusVisible={state.isFocusVisible}
      activeGuides={guides}
      selectionRegion={
        selection?.regionTails.has(node.id)
          ? "tail"
          : state.isSelected && (tree?.node(node.id) ?? node).children?.length
            ? "head"
            : underSelection
              ? "body"
              : undefined
      }
      onDelete={onDelete}
      onContextMenu={onContextMenu}
    />
  );
}

/**
 * ADR-248 Phase 4e-4: the Layers tree of the open page — rows from the read model (keys = the
 * Canvas records, so the tree and the Canvas share one selection), expanded rows read one level
 * deeper; selecting enters the parent's editing context (the old tree rule); delete and drag are
 * one command each.
 */
export const CatalogLayersSection = memo(function CatalogLayersSection({
  ownerId,
}: {
  /** The open page, or the definition of the definition edit view. */
  ownerId: EntryId<"page"> | CatalogDefinitionViewId;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const selection = useCatalogSession((state) => state.selection);
  const [tree, setTree] = useState<CatalogLayerTreeStore>();
  useEffect(() => {
    const store = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph: workspace.runtime.graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
        // A bound collection lists the data rows the Canvas draws (4e-6-36).
        boundRows: (position) => workspace.boundRowsOf(position),
        subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
        subscribeRoot: (listener) => workspace.subscribeRoot(listener),
        // A part with no value to show (an empty `{description}`) has no row.
        absentByValue: (position) => workspace.rowAbsentByValue(position),
        // A collection's EmptyState while it has items · its item positions while its data is
        // empty are not drawn, so they have no row.
        collectionRowHidden: (position, parentType) =>
          workspace.collectionRowHidden(position, parentType),
      },
      ownerId,
    );
    setTree(store);
    return () => store.dispose();
  }, [workspace, ownerId]);
  const items = useSyncExternalStore(
    tree?.subscribe ?? noSubscription,
    tree?.getSnapshot ?? noSnapshot,
  );

  // Expanded rows = user toggles + every selection's ancestors (+ a single selection itself) −
  // rows the user closed.
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  const [userCollapsed, setUserCollapsed] = useState<Set<Key>>(new Set());
  const selectedIds = useMemo(
    () => selection.map((item) => item.identity),
    [selection],
  );
  const autoExpanded = useMemo(() => {
    const records = workspace.root.domInputs;
    const parents = new Set<Key>();
    // A single selection opens one level of its own (Framer, 2026-10-24): its children show, theirs
    // stay closed. Only a record with children — a leaf key would replace the Set for nothing.
    if (
      selectedIds.length === 1 &&
      records.get(selectedIds[0])?.children.length
    )
      parents.add(selectedIds[0]);
    for (const id of selectedIds)
      for (
        let record = records.get(records.get(id)?.parentId ?? "");
        record && !parents.has(record.id);
        record = records.get(record.parentId)
      )
        parents.add(record.id);
    return parents;
  }, [selectedIds, workspace]);
  // Rows a selection opened stay open after it moves on (Figma): only the user closes them. Before
  // (2026-10-24 user report 「layer 트리가 깜빡이거나 떨리거나 이전 대상과 왔다갔다」) the rows
  // followed the current selection alone, so each Canvas selection closed the last one's ancestors
  // and opened its own — the rows jumped, twice per double-click (container, then the child).
  // Folded in during render (no second commit), and the Set is replaced only when a row opens: a
  // selection among siblings keeps it, and a new Set made RAC re-flatten the whole expanded tree
  // (ADR-265 — 5k rows per selection).
  const [openedFor, setOpenedFor] = useState<Set<Key>>();
  if (openedFor !== autoExpanded) {
    setOpenedFor(autoExpanded);
    const opened = [...autoExpanded].filter(
      (key) => !expandedKeys.has(key) && !userCollapsed.has(key),
    );
    if (opened.length) setExpandedKeys(new Set([...expandedKeys, ...opened]));
  }
  useLayoutEffect(() => {
    tree?.setExpanded(new Set([...expandedKeys].map(String)));
  }, [expandedKeys, tree]);

  const handleExpandedChange = useCallback(
    (next: Set<Key>) => {
      setUserCollapsed((previous) => {
        const collapsed = new Set(previous);
        for (const key of expandedKeys) if (!next.has(key)) collapsed.add(key);
        for (const key of next) collapsed.delete(key);
        return collapsed;
      });
      setExpandedKeys(next);
    },
    [expandedKeys],
  );
  const handleCollapseAll = useCallback(() => {
    setExpandedKeys(new Set());
    setUserCollapsed(new Set(autoExpanded));
  }, [autoExpanded]);

  const selectedKeys = useMemo(() => new Set<Key>(selectedIds), [selectedIds]);
  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      // The "+N more" row selects the row holding the rows not drawn (as the Canvas hatch).
      const ids = [
        ...new Set(
          [...keys].map(
            (key) => tree?.node(String(key))?.selects ?? String(key),
          ),
        ),
      ];
      if (!ids.length) {
        workspace.session.clearSelection();
        return;
      }
      workspace.selectRecords(ids);
      if (ids.length !== 1) return;
      const context = resolveCatalogTreeContext(
        workspace.root.domInputs,
        ids[0],
      );
      if (context) workspace.session.enterContext(context);
      else workspace.session.exitContext();
    },
    [tree, workspace],
  );

  // The old Layers row's right click (`layer-item`): the Canvas element menu over the selection
  // (the row joins it first when it was not selected). The page body has no menu.
  const [menu, setMenu] = useState<{
    request: ContextMenuRequest;
    items: ContextMenuItem[];
  } | null>(null);
  const handleContextMenu = useCallback(
    (node: CatalogLayerNode, event: React.MouseEvent) => {
      if (node.body) return;
      if (
        resolveContextMenuDisposition({
          altKey: event.altKey,
          target: event.target,
        }) !== "suppress"
      )
        return;
      event.preventDefault();
      const id = node.selects ?? node.id;
      const selected = workspace.session
        .getSnapshot()
        .selection.map((item) => item.identity);
      if (!selected.includes(id)) workspace.selectRecords([id]);
      const host = catalogMenuHost(
        workspace,
        (error) =>
          useToastStore
            .getState()
            .showToast(
              "error",
              error instanceof Error ? error.message : String(error),
            ),
        catalogMenuView(workspace),
      );
      const items = catalogCanvasMenuItems(host, "canvas-element", id);
      if (!items.length) return;
      setMenu({
        request: {
          surface: "layer-item",
          clientX: event.clientX,
          clientY: event.clientY,
          targetElementIds: selected.includes(id) ? selected : [id],
        },
        items,
      });
    },
    [workspace],
  );

  const handleDelete = useCallback(
    (node: CatalogLayerNode) => {
      run(
        removeTargets({
          targets: [node.position.target],
          newId: workspace.newId,
        }),
      );
    },
    [run, workspace],
  );
  const dropCommand = useCallback(
    (
      dragged: readonly string[],
      target: string,
      position: "before" | "after" | "on",
    ) =>
      tree &&
      // A data row is a projection of the row template, not a place to drop into.
      !tree.node(target)?.projection
        ? catalogLayerDropCommand(
            tree,
            workspace.runtime.graph,
            dragged,
            target,
            position,
            workspace.newId,
          )
        : undefined,
    [tree, workspace],
  );
  const isValidDrop = useCallback(
    (dragged: Key, target: Key, position: "before" | "after" | "on") => {
      const command = dropCommand([String(dragged)], String(target), position);
      if (!command) return false;
      try {
        // The command's own checks (nesting, into itself) decide.
        command(workspace.runtime.graph);
        return true;
      } catch {
        return false;
      }
    },
    [dropCommand, workspace],
  );
  const handleMove = useCallback(
    (payload: {
      keys: Set<Key>;
      target: { key: Key; dropPosition: "before" | "after" | "on" };
    }) => {
      const command = dropCommand(
        [...payload.keys].map(String),
        String(payload.target.key),
        payload.target.dropPosition,
      );
      if (command) run(command);
    },
    [dropCommand, run],
  );

  // Indent guides: a guide is emphasized when its ancestor is on the first selection's chain.
  const selectedChain = useMemo(() => {
    const chain = new Set<string>();
    const records = workspace.root.domInputs;
    for (
      let record = records.get(selectedIds[0] ?? "");
      record;
      record = records.get(record.parentId)
    )
      chain.add(record.id);
    return chain;
  }, [selectedIds, workspace]);
  // The selection's region (Framer): a selected row and the rows shown under it read as one area —
  // these are the area's last rows (the deepest last row shown under each selected row).
  const regionTails = useMemo(() => {
    const tails = new Set<string>();
    if (!items.length) return tails;
    for (const id of selectedIds) {
      let node = tree?.node(id);
      if (!node?.children?.length) continue;
      while (node.children?.length)
        node = node.children[node.children.length - 1];
      tails.add(node.id);
    }
    return tails;
  }, [items, selectedIds, tree]);
  const rowSelection = useMemo(
    () => ({ tree, selectedKeys, selectedChain, regionTails }),
    [tree, selectedKeys, selectedChain, regionTails],
  );
  const renderContent = useCallback(
    (node: CatalogLayerNode, state: TreeItemState) => (
      <CatalogLayerRow
        node={node}
        state={state}
        onDelete={handleDelete}
        onContextMenu={handleContextMenu}
      />
    ),
    [handleContextMenu, handleDelete],
  );

  return (
    <Section
      id={NAVIGATOR_SECTION_IDS.layers}
      className="node-tree-section"
      title={t("navigator.layers")}
      actions={
        <ActionIconButton
          aria-label={t("navigator.collapseTree")}
          tooltip={t("navigator.collapseTree")}
          onPress={handleCollapseAll}
        >
          <Minimize
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
        </ActionIconButton>
      }
    >
      <LayerRowSelection.Provider value={rowSelection}>
        <Virtualizer layout={ListLayout} layoutOptions={LAYOUT_OPTIONS}>
          <TreeBase<CatalogLayerNode>
            aria-label="Layers"
            items={items as CatalogLayerNode[]}
            getKey={layerKey}
            getTextValue={layerText}
            renderContent={renderContent}
            selectedKeys={selectedKeys}
            selectionMode="multiple"
            selectionBehavior="replace"
            expandedKeys={expandedKeys}
            onSelectionChange={handleSelectionChange}
            onExpandedChange={handleExpandedChange}
            dnd={{
              canDrag: (node) =>
                !node.body &&
                !node.projection &&
                node.position.target.kind === "node",
              isValidDrop,
              onMove: handleMove,
              dragType: "application/x-layer-tree-item",
              // The old Layers drag preview: the layer's name, or how many layers move.
              renderDragPreview: (items) => (
                <div className="tree-drag-preview">
                  {items.length > 1
                    ? t("navigator.layersDragCount", { count: items.length })
                    : (items[0]?.["text/plain"] ?? t("navigator.layer"))}
                </div>
              ),
            }}
            className="layer-tree layer-tree--rac-virtualized"
            dropIndicatorClassName="layer-drop-indicator"
          />
        </Virtualizer>
      </LayerRowSelection.Provider>
      <ContextMenuOverlay
        isOpen={!!menu}
        request={menu?.request ?? null}
        items={menu?.items ?? []}
        onClose={() => setMenu(null)}
      />
    </Section>
  );
});
