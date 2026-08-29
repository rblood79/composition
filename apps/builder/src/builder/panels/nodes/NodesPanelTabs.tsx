/**
 * NodesPanelTabs
 *
 * Pages/Frames 탭 전환 UI 컴포넌트.
 * React Aria TabList 패턴을 따름.
 */

import React from "react";
import { FileText, Layout, X } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useI18n } from "../../../i18n";
import { ActionIconButton } from "../../components";
import { togglePanelWorkspace } from "../../hooks/usePanelLayout";

export type NodesPanelTabType = "pages" | "layouts";

interface NodesPanelTabsProps {
  activeTab: NodesPanelTabType;
  onTabChange: (tab: NodesPanelTabType) => void;
}

export function NodesPanelTabs({
  activeTab,
  onTabChange,
}: NodesPanelTabsProps) {
  const { t } = useI18n();
  const tabs: {
    id: NodesPanelTabType;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "pages",
      label: t("nodes.pages"),
      icon: (
        <FileText
          color={iconProps.color}
          strokeWidth={iconProps.strokeWidth}
          size={iconProps.size}
        />
      ),
    },
    {
      // ADR-111 P2 followup: UI 라벨만 "Frames" — 탭 id "layouts" / EditMode "layout"
      // 은 데이터 호환성 유지를 위해 그대로. 후속 PR 에서 정합화 가능.
      id: "layouts",
      label: t("nodes.frames"),
      icon: (
        <Layout
          color={iconProps.color}
          strokeWidth={iconProps.strokeWidth}
          size={iconProps.size}
        />
      ),
    },
  ];

  return (
    <div className="panel-header nodes-panel-tabs">
      <div
        className="nodes-panel-tablist"
        role="tablist"
        aria-label={t("nodes.panelTabs")}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            className={`nodes-panel-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon}
            <span className="nodes-panel-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="panel-actions">
        <ActionIconButton
          onPress={() => togglePanelWorkspace("nodes")}
          aria-label={t("common.close")}
          tooltip={t("common.close")}
        >
          <X size={iconProps.size} />
        </ActionIconButton>
      </div>
    </div>
  );
}

export default NodesPanelTabs;
