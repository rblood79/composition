import {
  memo,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { Key } from "react-stately";
import { Button } from "react-aria-components/Button";
import { File, LayoutTemplate } from "lucide-react";
import {
  deleteLayout,
  renameDefinition,
} from "../../../../../../../packages/shared/src/catalog/commands";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogDefinitionList,
  catalogNewLayoutCommand,
  catalogNextLayoutName,
  type CatalogDefinitionItem,
} from "../../../catalogRuntime/layouts";
import {
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import {
  COMPONENTS_VIEW,
  PROJECT_COMPONENTS_VIEW,
} from "../../../catalogRuntime/originView";
import type { CatalogDefinitionViewId } from "../../../catalogRuntime/session";
import { ActionIconButton } from "../../../components/ui/ActionIconButton";
import { Section } from "../../../components/panel/Section";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { NAVIGATOR_SECTION_IDS } from "../navigatorSectionIds";
import { ICON_EDIT_PROPS } from "../tree/helpers";
import { InlineRenameInput } from "../tree/InlineRenameInput";
import { TreeBase } from "../tree/TreeBase";
import type { TreeItemState } from "../tree/TreeBase/types";
import { useCatalogCommandRunner } from "./useCatalogCommandRunner";

/** A listed definition: a project one, or the Components page (`page` — the built-in origins). */
type DefinitionNode = Omit<CatalogDefinitionItem, "id"> & {
  id: CatalogDefinitionViewId;
  page?: true;
  parentId: null;
  depth: 0;
  hasChildren: false;
};

const ComponentIcon = ACTION_ICONS.component;
const DeleteIcon = ACTION_ICONS.delete;
const AddIcon = ACTION_ICONS.add;

/**
 * ADR-248 4e: the project's layouts or components (the Navigator's Layouts / Components tab).
 * Selecting one opens the definition edit view (its template on the Canvas and in Layers); a new
 * layout is a body with one content slot; a layout is deleted with its pages' content given back,
 * and renamed in place by double-clicking its row, as a page is (user 2026-10-24).
 * A component is made from a selection (Create component) and dissolved from Properties. The
 * Components tab lists the Components page first — one derived page that draws every built-in
 * component origin with its state variants (user 2026-10-05, `componentsPage`) — then the
 * project's components page: every component made with Create component on one page, as the
 * built-in origins are (user 2026-10-14 — no item per component).
 */
export const CatalogDefinitionsSection = memo(
  function CatalogDefinitionsSection({
    usage,
  }: {
    usage: CatalogDefinitionItem["usage"];
  }) {
    const { t } = useI18n();
    const workspace = useCatalogWorkspace();
    const run = useCatalogCommandRunner();
    const graph = workspace.runtime.graph;
    const subscribe = useCallback(
      (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
      [workspace],
    );
    const listKey = useSyncExternalStore(subscribe, () =>
      JSON.stringify(catalogDefinitionList(graph, usage)),
    );
    const items = useMemo(
      () =>
        (JSON.parse(listKey) as CatalogDefinitionItem[]).map(
          (item): DefinitionNode => ({
            ...item,
            parentId: null,
            depth: 0,
            hasChildren: false,
          }),
        ),
      [listKey],
    );
    const componentsPage = useMemo(
      (): DefinitionNode[] => [
        {
          id: COMPONENTS_VIEW,
          name: t("navigator.builtinComponents"),
          usage: "component",
          page: true,
          parentId: null,
          depth: 0,
          hasChildren: false,
        },
        // The components made with Create component, on one page (user 2026-10-14).
        {
          id: PROJECT_COMPONENTS_VIEW,
          name: t("navigator.userComponents"),
          usage: "component",
          page: true,
          parentId: null,
          depth: 0,
          hasChildren: false,
        },
      ],
      [t],
    );
    const definitionView = useCatalogSession((state) => state.definitionView);
    const selectedKeys = useMemo(
      () => new Set<Key>(definitionView ? [definitionView] : []),
      [definitionView],
    );

    // Opening a layout selects its body — the layout's selection (Layers row · Canvas frame ·
    // the Design panel's preset and slots), as opening a page does. After the view: it replaces
    // the root.
    const openLayout = useCallback(
      (id: CatalogDefinitionViewId) => {
        workspace.showDefinition(id);
        const entry = graph.getEntry(id);
        const body =
          entry?.kind === "definition" ? entry.templateRootId : undefined;
        if (body) workspace.session.select(workspace.itemsOfNode(body, 1));
      },
      [graph, workspace],
    );
    const addLayout = useCallback(() => {
      const plan = run(
        catalogNewLayoutCommand(
          catalogNextLayoutName(graph, t("navigator.layoutDefaultName")),
          workspace.newId,
        ),
      );
      const created = catalogDefinitionList(graph, "layout").find(
        (item) => !items.some((known) => known.id === item.id),
      );
      if (plan !== undefined && created) openLayout(created.id);
    }, [graph, items, openLayout, run, t]);
    const renameLayout = useCallback(
      (item: DefinitionNode, typed: string) => {
        const name = typed.trim();
        if (!name || name === item.name) return;
        run(
          renameDefinition({
            id: item.id as CatalogDefinitionItem["id"],
            name,
            label: "Rename layout",
          }),
        );
      },
      [run],
    );
    const removeLayout = useCallback(
      (item: DefinitionNode) =>
        run(
          deleteLayout({
            definitionId: item.id as CatalogDefinitionItem["id"],
          }),
        ),
      [run],
    );
    const handleSelectionChange = useCallback(
      (keys: Set<Key>) => {
        const [key] = keys;
        if (key) openLayout(String(key) as CatalogDefinitionViewId);
      },
      [openLayout],
    );
    const renderContent = useCallback(
      (item: DefinitionNode, state: TreeItemState) => (
        <DefinitionRowContent
          item={item}
          state={state}
          onRename={renameLayout}
          onDelete={removeLayout}
        />
      ),
      [removeLayout, renameLayout],
    );

    const title =
      usage === "layout" ? t("navigator.layouts") : t("navigator.components");
    return (
      <Section
        id={
          usage === "layout"
            ? NAVIGATOR_SECTION_IDS.layouts
            : NAVIGATOR_SECTION_IDS.components
        }
        className="node-tree-section"
        title={title}
        actions={
          usage === "layout" ? (
            <ActionIconButton
              aria-label={t("navigator.addLayout")}
              tooltip={t("navigator.addLayout")}
              onPress={addLayout}
            >
              <AddIcon
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
              />
            </ActionIconButton>
          ) : undefined
        }
      >
        {usage === "component" ? (
          <TreeBase<DefinitionNode>
            aria-label={title}
            items={componentsPage}
            getKey={(item) => item.id}
            getTextValue={(item) => item.name}
            renderContent={renderContent}
            selectedKeys={selectedKeys}
            onSelectionChange={handleSelectionChange}
            className="page-tree"
          />
        ) : items.length === 0 ? (
          <div className="page-search-empty" role="status">
            {t("navigator.noLayouts")}
          </div>
        ) : (
          <TreeBase<DefinitionNode>
            aria-label={title}
            items={items}
            getKey={(item) => item.id}
            getTextValue={(item) => item.name}
            renderContent={renderContent}
            selectedKeys={selectedKeys}
            onSelectionChange={handleSelectionChange}
            className="page-tree"
          />
        )}
      </Section>
    );
  },
);

/**
 * A Layouts / Components row. The rename field's state lives here, not in the section: the RAC
 * collection keeps a row's rendered content until its item changes, so section state would not
 * reach the row (the Page row keeps its own the same way).
 */
function DefinitionRowContent({
  item,
  state,
  onRename,
  onDelete,
}: {
  item: DefinitionNode;
  state: TreeItemState;
  onRename: (item: DefinitionNode, name: string) => void;
  onDelete: (item: DefinitionNode) => void;
}) {
  const { t } = useI18n();
  const [isRenaming, setIsRenaming] = useState(false);
  const isLayout = item.usage === "layout" && !item.page;
  return (
    <div
      className={`elementItem ${state.isSelected ? "active" : ""}`}
      onDoubleClick={(event) => {
        if (!isLayout) return;
        const target = event.target;
        if (target instanceof Element && target.closest("button, input"))
          return;
        event.stopPropagation();
        setIsRenaming(true);
      }}
    >
      <div className="elementItemIndent" />
      <div className="elementItemIcon">
        {item.page ? (
          <File
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
          />
        ) : item.usage === "layout" ? (
          <LayoutTemplate
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
          />
        ) : (
          <ComponentIcon
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
          />
        )}
      </div>
      <div className="elementItemLabel">
        {isRenaming ? (
          <InlineRenameInput
            label={`${t("navigator.renameLayout")} ${item.name}`}
            defaultValue={item.name}
            onDone={(typed) => {
              setIsRenaming(false);
              if (typed !== undefined) onRename(item, typed);
            }}
          />
        ) : (
          item.name
        )}
      </div>
      <div className="elementItemActions">
        {item.usage === "layout" && (
          <Button
            className="iconButton"
            aria-label={`${t("navigator.deleteLayout")} ${item.name}`}
            onPress={() => onDelete(item)}
          >
            <DeleteIcon
              color={ICON_EDIT_PROPS.color}
              strokeWidth={ICON_EDIT_PROPS.stroke}
              size={ICON_EDIT_PROPS.size}
            />
          </Button>
        )}
      </div>
    </div>
  );
}
