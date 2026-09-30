import {
  memo,
  useCallback,
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
import type {
  EntryId,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { resolveCatalogTreeContext } from "../../../catalogRuntime/canvasPick";
import {
  catalogLayerDropCommand,
  CatalogLayerTreeStore,
  type CatalogLayerNode,
} from "../../../catalogRuntime/layerTree";
import {
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { ActionIconButton, Section } from "../../../components";
import { NAVIGATOR_SECTION_IDS } from "../navigatorSectionIds";
import { TreeBase } from "../tree/TreeBase";
import type { TreeItemState } from "../tree/TreeBase/types";
import { LAYER_TREE_ROW_SIZE_PX } from "../tree/LayerTree/virtualization";
import { CatalogLayerItem } from "./CatalogLayerItem";
import { useCatalogCommandRunner } from "./useCatalogCommandRunner";

const LAYOUT_OPTIONS = { rowSize: LAYER_TREE_ROW_SIZE_PX };
const EMPTY: readonly CatalogLayerNode[] = [];
const noSubscription = () => () => {};
const noSnapshot = () => EMPTY;

/**
 * ADR-248 Phase 4e-4: the Layers tree of the open page — rows from the read model (keys = the
 * Canvas records, so the tree and the Canvas share one selection), expanded rows read one level
 * deeper; selecting enters the parent's editing context (the old tree rule); delete and drag are
 * one command each.
 */
export const CatalogLayersSection = memo(function CatalogLayersSection({
  pageId,
}: {
  pageId: EntryId<"page">;
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
      },
      pageId,
    );
    setTree(store);
    return () => store.dispose();
  }, [workspace, pageId]);
  const items = useSyncExternalStore(
    tree?.subscribe ?? noSubscription,
    tree?.getSnapshot ?? noSnapshot,
  );

  // Expanded rows = user toggles + the selection's ancestors − rows the user closed.
  const [userExpanded, setUserExpanded] = useState<Set<Key>>(new Set());
  const [userCollapsed, setUserCollapsed] = useState<Set<Key>>(new Set());
  const selectedIds = useMemo(
    () => selection.map((item) => item.identity),
    [selection],
  );
  const autoExpanded = useMemo(() => {
    const records = workspace.root.domInputs;
    const parents = new Set<Key>();
    for (const id of selectedIds)
      for (
        let record = records.get(records.get(id)?.parentId ?? "");
        record && !parents.has(record.id);
        record = records.get(record.parentId)
      )
        parents.add(record.id);
    return parents;
  }, [selectedIds, workspace]);
  const expandedKeys = useMemo(() => {
    const merged = new Set(userExpanded);
    for (const key of autoExpanded)
      if (!userCollapsed.has(key)) merged.add(key);
    return merged;
  }, [autoExpanded, userCollapsed, userExpanded]);
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
      setUserExpanded(next);
    },
    [expandedKeys],
  );
  const handleCollapseAll = useCallback(() => {
    setUserExpanded(new Set());
    setUserCollapsed(new Set(autoExpanded));
  }, [autoExpanded]);

  const selectedKeys = useMemo(() => new Set<Key>(selectedIds), [selectedIds]);
  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      const ids = [...keys].map(String);
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
      if (context) workspace.session.enterContext(context as NodeId);
      else workspace.session.exitContext();
    },
    [workspace],
  );

  const handleDelete = useCallback(
    (node: CatalogLayerNode) => {
      run(removeTargets({ targets: [node.position.target] }));
    },
    [run],
  );
  const dropCommand = useCallback(
    (
      dragged: readonly string[],
      target: string,
      position: "before" | "after" | "on",
    ) =>
      tree &&
      catalogLayerDropCommand(tree, dragged, target, position, workspace.newId),
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
  const renderContent = useCallback(
    (node: CatalogLayerNode, state: TreeItemState) => {
      const guides: boolean[] = [];
      for (
        let parent = node.parentId && tree?.node(node.parentId);
        parent;
        parent = parent.parentId ? tree?.node(parent.parentId) : undefined
      )
        guides.unshift(selectedChain.has(parent.id));
      return (
        <CatalogLayerItem
          node={node}
          isSelected={state.isSelected}
          isExpanded={state.isExpanded}
          isFocusVisible={state.isFocusVisible}
          activeGuides={guides}
          onDelete={handleDelete}
        />
      );
    },
    [handleDelete, selectedChain, tree],
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
      <Virtualizer layout={ListLayout} layoutOptions={LAYOUT_OPTIONS}>
        <TreeBase<CatalogLayerNode>
          aria-label="Layers"
          items={items as CatalogLayerNode[]}
          getKey={(node) => node.id}
          getTextValue={(node) => node.name}
          renderContent={renderContent}
          selectedKeys={selectedKeys}
          selectionMode="multiple"
          selectionBehavior="replace"
          expandedKeys={expandedKeys}
          onSelectionChange={handleSelectionChange}
          onExpandedChange={handleExpandedChange}
          dnd={{
            canDrag: (node) =>
              !node.body && node.position.target.kind === "node",
            isValidDrop,
            onMove: handleMove,
            dragType: "application/x-layer-tree-item",
          }}
          className="layer-tree layer-tree--rac-virtualized"
          dropIndicatorClassName="layer-drop-indicator"
        />
      </Virtualizer>
    </Section>
  );
});
