import {
  memo,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { Key } from "react-stately";
import { Button } from "react-aria-components/Button";
import { File, LayoutTemplate, Lock, LockOpen } from "lucide-react";
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
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import {
  COMPONENTS_VIEW,
  PROJECT_COMPONENTS_VIEW,
} from "../../../catalogRuntime/originView";
import {
  catalogOverriddenOrigins,
  confirmCatalogOriginReset,
} from "../../../catalogRuntime/originUnlock";
import { useToastStore } from "../../../stores/toast";
import type { CatalogDefinitionViewId } from "../../../catalogRuntime/session";
import { ActionIconButton } from "../../../components/ui/ActionIconButton";
import { Section } from "../../../components/panel/Section";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { NAVIGATOR_SECTION_IDS } from "../navigatorSectionIds";
import { ICON_EDIT_PROPS } from "../tree/helpers";
import { InlineRenameInput } from "../tree/InlineRenameInput";
import { TreeBase } from "../tree/TreeBase";
import type { TreeItemState } from "../tree/TreeBase/types";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";

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
const ResetIcon = ACTION_ICONS.reset;
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
    const list = useCatalogStepReading(workspace, (): CatalogDefinitionItem[] =>
      catalogDefinitionList(graph, usage),
    );
    const items = useMemo(
      () =>
        list.map((item): DefinitionNode => ({
          ...item,
          parentId: null,
          depth: 0,
          hasChildren: false,
        })),
      [list],
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
        {item.id === COMPONENTS_VIEW && <LibraryOriginActions />}
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

/**
 * ADR-282 — the Library page row's actions (user 2026-10-24 「리셋(초기화) - 해제(잠금)」 · 「Library
 * 전체 해제」): the lock (`lock` ↔ `lock-open`) unlocks the whole Library for editing — every ◆ is
 * its origin's copy — and locks it again (the copies nobody edited go back to the library); reset
 * takes every overridden origin back to the library default (after the reset dialog) and locks.
 * Its own subscriptions: the RAC row keeps rendered content until its item changes.
 */
function LibraryOriginActions() {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const unlocked = useSyncExternalStore(
    useCallback(
      (notify: () => void) => workspace.subscribeLibraryMode(notify),
      [workspace],
    ),
    () => workspace.isLibraryUnlocked,
  );
  const overridden = useCatalogStepReading(
    workspace,
    () => catalogOverriddenOrigins(graph).length,
  );
  const LockIcon = unlocked ? LockOpen : Lock;
  const lockLabel = unlocked
    ? t("navigator.lockOrigin")
    : t("navigator.unlockOrigin");
  return (
    <>
      <Button
        className="iconButton"
        aria-label={t("navigator.resetOrigins")}
        isDisabled={overridden === 0}
        onPress={() => void confirmCatalogOriginReset(graph, run)}
      >
        <ResetIcon
          color={ICON_EDIT_PROPS.color}
          strokeWidth={ICON_EDIT_PROPS.stroke}
          size={ICON_EDIT_PROPS.size}
        />
      </Button>
      <span title={lockLabel}>
        <Button
          className="iconButton"
          aria-label={lockLabel}
          aria-pressed={unlocked}
          onPress={() => {
            try {
              workspace.setLibraryUnlocked(!unlocked);
            } catch (error) {
              useToastStore
                .getState()
                .showToast("error", String((error as Error).message ?? error));
            }
          }}
        >
          <LockIcon
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
          />
        </Button>
      </span>
    </>
  );
}
