import { ListTree } from "lucide-react";
import "../NavigatorPanel.css";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  CatalogWorkspaceGate,
  useCatalogSession,
} from "../../../catalogRuntime/react";
import {
  PanelHeader,
  SectionGroupToggleButton,
  SectionSplitStack,
  panelContents,
} from "../../../components";
import {
  NAVIGATOR_PAGES_TAB_SECTION_IDS,
  NAVIGATOR_SECTION_IDS,
  NAVIGATOR_SPLIT_STORAGE_KEYS,
} from "../navigatorSectionIds";
import { CatalogLayersSection } from "./CatalogLayersSection";
import { CatalogDefinitionsSection } from "./CatalogDefinitionsSection";
import { CatalogPagesSection } from "./CatalogPagesSection";

/**
 * ADR-248 Phase 4e-4: the Navigator of the open catalog project — Pages over Layers of the open
 * page (the session page). Reads and edits go through the workspace (read model · commands).
 */
export function CatalogNavigatorPanel() {
  const { t } = useI18n();
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
            sectionIds={NAVIGATOR_PAGES_TAB_SECTION_IDS}
          />
        }
      />
      <div className={panelContents("navigator-panel-content")}>
        <CatalogWorkspaceGate>
          <NavigatorSections />
        </CatalogWorkspaceGate>
      </div>
    </div>
  );
}

function NavigatorSections() {
  const { t } = useI18n();
  const pageId = useCatalogSession((state) => state.pageId);
  // The definition edit view lists its template instead of the page.
  const definitionView = useCatalogSession((state) => state.definitionView);
  const owner = definitionView ?? pageId;
  return (
    <SectionSplitStack
      storageKey={NAVIGATOR_SPLIT_STORAGE_KEYS.pages}
      topId={NAVIGATOR_SECTION_IDS.pages}
      bottomId={NAVIGATOR_SECTION_IDS.layers}
      label={t("navigator.resizeSections")}
      top={
        <>
          <CatalogPagesSection />
          <CatalogDefinitionsSection />
        </>
      }
      bottom={
        owner ? <CatalogLayersSection key={owner} ownerId={owner} /> : null
      }
    />
  );
}
