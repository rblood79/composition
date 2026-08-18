/**
 * PanelNav - 패널 네비게이션 바
 *
 * 48px 너비의 아이콘 버튼 네비게이션
 * 기존 sidebar-nav 디자인 재사용
 */

import {
  Button as RACButton,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import type { PanelSide, PanelId } from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import { iconProps, iconPropsOn } from "../../utils/ui/uiConstants";
import "../components/ui/ActionIconButton.css";

export interface PanelNavProps {
  /** 현재 사이드 (left/right) */
  side: PanelSide;

  /** 이 사이드에 배치된 패널 ID 목록 */
  panelIds: PanelId[];

  /** 현재 활성 패널 ID 배열 (Multi toggle 지원) */
  activePanels: PanelId[];

  /** 패널 클릭 시 콜백 */
  onPanelClick: (panelId: PanelId) => void;
}

export function PanelNav({
  side,
  panelIds,
  activePanels,
  onPanelClick,
}: PanelNavProps) {
  return (
    <nav className="panel-nav" data-side={side}>
      <ul className="nav-list">
        {panelIds.map((panelId) => {
          const panelConfig = PanelRegistry.getPanel(panelId);
          if (!panelConfig) return null;

          const Icon = panelConfig.icon;
          const isActive = activePanels.includes(panelId);

          const tooltipPlacement =
            side === "left" ? "right" : side === "right" ? "left" : "top";

          return (
            <li key={panelId}>
              <TooltipTrigger delay={700}>
                <RACButton
                  className={`nav-button ${isActive ? "active" : ""}`}
                  onPress={() => onPanelClick(panelId)}
                  aria-pressed={isActive}
                  aria-label={panelConfig.name}
                >
                  <Icon
                    color={isActive ? iconPropsOn.color : iconProps.color}
                    strokeWidth={
                      isActive ? iconPropsOn.strokeWidth : iconProps.strokeWidth
                    }
                    size={isActive ? iconPropsOn.size : iconProps.size}
                  />
                </RACButton>
                <Tooltip
                  placement={tooltipPlacement}
                  className="action-tooltip"
                >
                  <span className="action-tooltip-label">
                    {panelConfig.name}
                  </span>
                  {panelConfig.shortcut && (
                    <kbd className="action-tooltip-kbd">
                      {panelConfig.shortcut}
                    </kbd>
                  )}
                </Tooltip>
              </TooltipTrigger>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
