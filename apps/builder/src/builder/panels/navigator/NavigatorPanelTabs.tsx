/**
 * NodesPanelTabs
 *
 * Pages/Frames 탭 전환 UI 컴포넌트.
 * React Aria TabList 패턴을 따름.
 */

import { FileText, Layout } from "lucide-react";
import { Tab, TabList } from "react-aria-components";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useI18n } from "../../../i18n";

export type NodesPanelTabType = "pages" | "layouts";

export function NodesPanelTabs() {
  const { t } = useI18n();
  const tabs: {
    id: NodesPanelTabType;
    label: string;
    Icon: typeof FileText;
  }[] = [
    {
      id: "pages",
      label: t("nodes.pages"),
      Icon: FileText,
    },
    {
      // ADR-111 P2 followup: UI 라벨만 "Frames" — 탭 id "layouts" / EditMode "layout"
      // 은 데이터 호환성 유지를 위해 그대로. 후속 PR 에서 정합화 가능.
      id: "layouts",
      label: t("nodes.frames"),
      Icon: Layout,
    },
  ];

  return (
    <TabList
      className="panel-tablist nodes-panel-tablist"
      aria-label={t("nodes.panelTabs")}
    >
      {tabs.map(({ id, label, Icon }) => (
        <Tab key={id} id={id} className="panel-tab nodes-panel-tab">
          <Icon
            color="currentColor"
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
          <span className="panel-tab-label nodes-panel-tab-label">{label}</span>
        </Tab>
      ))}
    </TabList>
  );
}

export default NodesPanelTabs;
