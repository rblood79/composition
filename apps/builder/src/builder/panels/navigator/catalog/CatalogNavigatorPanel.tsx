import { useCallback, useState, useSyncExternalStore } from "react";
import type { Key } from "react-stately";
import { Box, FileText, LayoutTemplate, ListTree } from "lucide-react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components/Tabs";
import "../NavigatorPanel.css";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogNavigatorTabOf,
  type CatalogNavigatorTab,
} from "../../../catalogRuntime/layouts";
import {
  CatalogWorkspaceGate,
  useCatalogSession,
  useCatalogWorkspace,
  useOptionalCatalogWorkspace,
} from "../../../catalogRuntime/react";
import {
  EmptyState,
  PanelHeader,
  Section,
  SectionGroupToggleButton,
  SectionSplitStack,
  panelContents,
} from "../../../components";
import { ACTION_ICONS } from "../../../config/actionIcons";
import {
  NAVIGATOR_SECTION_IDS,
  NAVIGATOR_SPLIT_STORAGE_KEYS,
} from "../navigatorSectionIds";
import { CatalogLayersSection } from "./CatalogLayersSection";
import { CatalogDefinitionsSection } from "./CatalogDefinitionsSection";
import { CatalogPagesSection } from "./CatalogPagesSection";

/** Each tab's list section (the header toggle folds it with Layers). */
const TAB_LIST_SECTION: Record<CatalogNavigatorTab, string> = {
  pages: NAVIGATOR_SECTION_IDS.pages,
  components: NAVIGATOR_SECTION_IDS.components,
  layouts: NAVIGATOR_SECTION_IDS.layouts,
};

/**
 * ADR-248 Phase 4e-4: the Navigator of the open catalog project — tabs Pages / Components /
 * Layouts, each its list over the Layers of what the Canvas shows (the session page, or the
 * definition edit view's template). Reads and edits go through the workspace (read model ·
 * commands). The tab follows the edit view: entering one selects its tab, leaving it returns to
 * Pages, and choosing Pages leaves it; choosing Components / Layouts only shows the list.
 */
export function CatalogNavigatorPanel() {
  const { t } = useI18n();
  const workspace = useOptionalCatalogWorkspace();
  // Panels mount before the workspace exists: no project = no edit view.
  const definitionView = useSyncExternalStore(
    workspace?.session.subscribe ?? noSubscribe,
    () => workspace?.session.getSnapshot().definitionView,
  );
  const viewTab = workspace
    ? catalogNavigatorTabOf(workspace.runtime.graph, definitionView)
    : undefined;
  // The chosen tab, reset when the edit view changes (adjusted while rendering — no stale frame).
  const [chosen, setChosen] = useState<{
    view: typeof definitionView;
    tab: CatalogNavigatorTab;
  }>({ view: definitionView, tab: viewTab ?? "pages" });
  let tab = chosen.tab;
  if (chosen.view !== definitionView) {
    tab = viewTab ?? "pages";
    setChosen({ view: definitionView, tab });
  }
  const handleTabChange = useCallback(
    (key: Key) => {
      const next = String(key) as CatalogNavigatorTab;
      setChosen({ view: definitionView, tab: next });
      if (next === "pages" && definitionView)
        workspace?.showDefinition(undefined);
    },
    [definitionView, workspace],
  );
  const tabs: {
    id: CatalogNavigatorTab;
    label: string;
    Icon: typeof FileText;
  }[] = [
    { id: "pages", label: t("navigator.pages"), Icon: FileText },
    {
      id: "components",
      label: t("navigator.components"),
      Icon: ACTION_ICONS.component,
    },
    { id: "layouts", label: t("navigator.layouts"), Icon: LayoutTemplate },
  ];
  return (
    <div className="panel navigator-panel navigator-panel--new-tree">
      <PanelHeader
        icon={
          <ListTree
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        }
        title={t("panels.navigator")}
        panelId="navigator"
        actions={
          <SectionGroupToggleButton
            sectionIds={[TAB_LIST_SECTION[tab], NAVIGATOR_SECTION_IDS.layers]}
          />
        }
      />
      <Tabs
        className="panel-tabs navigator-tabs"
        selectedKey={tab}
        onSelectionChange={handleTabChange}
      >
        <div className="panel-header panel-tabrow">
          <TabList
            className="panel-tablist"
            aria-label={t("navigator.panelTabs")}
          >
            {tabs.map(({ id, label, Icon }) => (
              <Tab key={id} id={id} className="panel-tab navigator-panel-tab">
                <Icon
                  color="currentColor"
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
                <span className="panel-tab-label navigator-panel-tab-label">
                  {label}
                </span>
              </Tab>
            ))}
          </TabList>
        </div>
        {tabs.map(({ id }) => (
          <TabPanel
            key={id}
            id={id}
            className={panelContents("navigator-panel-content")}
          >
            <CatalogWorkspaceGate>
              <NavigatorSections tab={id} />
            </CatalogWorkspaceGate>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}

const noSubscribe = () => () => {};

function NavigatorSections({ tab }: { tab: CatalogNavigatorTab }) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const pageId = useCatalogSession((state) => state.pageId);
  const definitionView = useCatalogSession((state) => state.definitionView);
  // Layers lists what the tab is about: the page on Pages, the opened definition's template on
  // its own tab — Components / Layouts with nothing opened list nothing (not the page).
  const owner =
    tab === "pages"
      ? pageId
      : catalogNavigatorTabOf(workspace.runtime.graph, definitionView) === tab
        ? definitionView
        : undefined;
  const hint =
    tab === "pages"
      ? t("navigator.selectPage")
      : tab === "layouts"
        ? t("navigator.selectLayout")
        : t("navigator.selectComponent");
  return (
    <SectionSplitStack
      storageKey={NAVIGATOR_SPLIT_STORAGE_KEYS[tab]}
      topId={TAB_LIST_SECTION[tab]}
      bottomId={NAVIGATOR_SECTION_IDS.layers}
      label={t("navigator.resizeSections")}
      top={
        tab === "pages" ? (
          <CatalogPagesSection />
        ) : (
          <CatalogDefinitionsSection
            usage={tab === "layouts" ? "layout" : "component"}
          />
        )
      }
      bottom={
        owner ? (
          <CatalogLayersSection key={owner} ownerId={owner} />
        ) : (
          <Section
            id={NAVIGATOR_SECTION_IDS.layers}
            className="node-tree-section"
            title={t("navigator.layers")}
          >
            <EmptyState icon={<Box size={32} />} message={hint} />
          </Section>
        )
      }
    />
  );
}
