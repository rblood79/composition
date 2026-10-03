import { memo, useCallback, useMemo, useState } from "react";
import type { Key } from "react-stately";
import { Search } from "lucide-react";
import {
  removePage,
  updatePage,
} from "../../../../../../../packages/shared/src/catalog/commands";
import type { EntryId } from "../../../../../../../packages/shared/src/catalog/document/types";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogNewPageCommand,
  catalogPageAfterDelete,
  catalogPageDropCommand,
  catalogTreePages,
  type CatalogTreePage,
} from "../../../catalogRuntime/pageTree";
import {
  useCatalogPages,
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { ActionIconButton } from "../../../components/ui/ActionIconButton";
import { Section } from "../../../components/panel/Section";
import { ActionIconToggleButton } from "../../../components/ui/ActionIconButton";
import { SearchField } from "../../../components/ui/SearchField";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { openDesignPanel } from "../../design/designPanelView";
import { filterPagesByQuery } from "../filterPagesByQuery";
import { NAVIGATOR_SECTION_IDS } from "../navigatorSectionIds";
import { TreeBase } from "../tree/TreeBase";
import type { TreeItemState } from "../tree/TreeBase/types";
import { buildPageTree } from "../tree/PageTree/buildPageTree";
import { PageTreeItemContent } from "../tree/PageTree/PageTreeItemContent";
import type { PageTreeNode } from "../tree/PageTree/types";
import { isValidPageDrop } from "../tree/PageTree/validation";
import { useCatalogCommandRunner } from "./useCatalogCommandRunner";
import { useStateSectionFocus } from "../../properties/state/stateSectionFocus";

const AddIcon = ACTION_ICONS.add;
type Node = PageTreeNode<CatalogTreePage>;

/**
 * ADR-248 Phase 4e-4: the Pages tree of the open project — the project's pages (read model),
 * selecting one opens it (session page) and brings its frame into view; add · rename · delete ·
 * drag (order and parent) are one command each (one history step).
 */
export const CatalogPagesSection = memo(function CatalogPagesSection() {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const entries = useCatalogPages();
  const pageId = useCatalogSession((state) => state.pageId);
  const pages = useMemo(() => catalogTreePages(entries), [entries]);
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pageQuery, setPageQuery] = useState("");

  const query = useMemo(
    () => filterPagesByQuery(pages, isSearchOpen ? pageQuery : ""),
    [isSearchOpen, pageQuery, pages],
  );
  const treeExpandedKeys = useMemo(
    () =>
      query.expandIds.size === 0
        ? expandedKeys
        : new Set<Key>([...expandedKeys, ...query.expandIds]),
    [expandedKeys, query.expandIds],
  );
  const { treeNodes, nodeMap } = useMemo(
    () => buildPageTree(query.pages),
    [query.pages],
  );
  const selectedKeys = useMemo(
    () => new Set<Key>(pageId ? [pageId] : []),
    [pageId],
  );

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setPageQuery("");
  }, []);

  const openPage = useCallback(
    (id: EntryId<"page">) => {
      workspace.session.setPage(id);
      workspace.revealPage(id);
    },
    [workspace],
  );
  const selectPage = useCallback(
    (page: CatalogTreePage) => openPage(page.id),
    [openPage],
  );
  const handleAddPage = useCallback(() => {
    const { command, pageId: added } = catalogNewPageCommand(
      entries,
      workspace.newId,
    );
    if (run(command)) openPage(added);
  }, [entries, openPage, run, workspace]);
  const handleRename = useCallback(
    (page: CatalogTreePage, title: string) => {
      const name = title.trim();
      if (!name || name === page.title) return;
      run(updatePage({ id: page.id, fields: { name }, label: "Rename page" }));
    },
    [run],
  );
  // Deleting the open page opens its neighbour (before it, else after), not the first page.
  const handleDelete = useCallback(
    (page: CatalogTreePage) => {
      const next =
        page.id === pageId ? catalogPageAfterDelete(pages, page.id) : undefined;
      if (run(removePage({ id: page.id })) && next) openPage(next);
    },
    [openPage, pageId, pages, run],
  );
  // Page settings: the page body's selection is the page settings surface (Properties).
  const handleSettings = useCallback(
    (page: CatalogTreePage) => {
      selectPage(page);
      const body = entries.find((entry) => entry.id === page.id)?.children[0];
      if (body) workspace.session.select(workspace.itemsOfNode(body, 1));
      openDesignPanel("property");
      // The Design panel's Property tab: its State section (the page's variables) opens and comes into view.
      useStateSectionFocus.getState().requestFocus(page.id);
    },
    [entries, selectPage, workspace],
  );

  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      const key = [...keys][0];
      if (key === undefined || key === pageId) return;
      const node = nodeMap.get(String(key));
      if (node) selectPage(node.page);
    },
    [nodeMap, pageId, selectPage],
  );
  const getItem = useCallback(
    (key: Key | string) => {
      const value = nodeMap.get(String(key));
      return value ? { value } : undefined;
    },
    [nodeMap],
  );
  const isValidDrop = useCallback(
    (dragged: Key, target: Key, position: "before" | "after" | "on") =>
      isValidPageDrop(String(dragged), String(target), position, { getItem })
        .valid,
    [getItem],
  );
  const handleMove = useCallback(
    (payload: {
      keys: Set<Key>;
      target: { key: Key; dropPosition: "before" | "after" | "on" };
    }) => {
      const command = catalogPageDropCommand(
        entries,
        [...payload.keys].map(String),
        String(payload.target.key),
        payload.target.dropPosition,
      );
      if (command) run(command);
    },
    [entries, run],
  );
  const renderContent = useCallback(
    (node: Node, state: TreeItemState) => (
      <PageTreeItemContent<CatalogTreePage>
        node={node}
        state={state}
        onDelete={handleDelete}
        onSettings={handleSettings}
        onReselect={selectPage}
        onRename={handleRename}
      />
    ),
    [handleDelete, handleRename, handleSettings, selectPage],
  );

  const canSearch = pages.length > 1;
  return (
    <Section
      id={NAVIGATOR_SECTION_IDS.pages}
      className="node-tree-section"
      title={t("navigator.pages")}
      actions={
        <>
          {canSearch && (
            <ActionIconToggleButton
              aria-label={t("navigator.searchPages")}
              tooltip={t("navigator.searchPages")}
              isSelected={isSearchOpen}
              onChange={(selected) =>
                selected ? setIsSearchOpen(true) : closeSearch()
              }
            >
              <Search
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
              />
            </ActionIconToggleButton>
          )}
          <ActionIconButton
            aria-label={t("navigator.addPage")}
            tooltip={t("navigator.addPage")}
            onPress={handleAddPage}
          >
            <AddIcon
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ActionIconButton>
        </>
      }
    >
      {isSearchOpen && canSearch && (
        <SearchField
          className="page-search-field"
          appearance="control"
          autoFocus
          value={pageQuery}
          onChange={setPageQuery}
          placeholder={t("navigator.searchPages")}
          aria-label={t("navigator.searchPages")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeSearch();
            }
          }}
        />
      )}
      {query.query && query.matchCount === 0 ? (
        <div className="page-search-empty" role="status">
          {t("navigator.noPagesMatch")}
        </div>
      ) : (
        <TreeBase<Node>
          aria-label={t("navigator.pages")}
          items={treeNodes}
          getKey={(node) => node.id}
          getTextValue={(node) => node.name}
          renderContent={renderContent}
          selectedKeys={selectedKeys}
          expandedKeys={treeExpandedKeys}
          onSelectionChange={handleSelectionChange}
          onExpandedChange={setExpandedKeys}
          dnd={{
            canDrag: (node) => node.isDraggable,
            isValidDrop,
            onMove: handleMove,
            dragType: "application/x-page-tree-item",
          }}
          className="page-tree"
          dropIndicatorClassName="layer-drop-indicator"
        />
      )}
    </Section>
  );
});
