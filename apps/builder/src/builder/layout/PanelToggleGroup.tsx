import { memo } from "react";
import type { Key } from "react-aria-components";
import { Tooltip, TooltipTrigger } from "react-aria-components";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import { iconProps } from "../../utils/ui/uiConstants";
import { useI18n } from "../../i18n";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import type { PanelId, PanelSide } from "../panels/core/types";
import { getPanelLabel } from "./panelLabels";

const PANEL_SIDE_LABEL_KEYS = {
  left: "workspace.leftPanelControls",
  right: "workspace.rightPanelControls",
  bottom: "workspace.bottomPanelControls",
} as const;

export interface PanelToggleGroupProps {
  /** 현재 rail 위치. */
  side: PanelSide;

  /** 이 rail에 배치된 패널 ID 목록. */
  panelIds: PanelId[];

  /** 현재 표시 중인 패널 ID 목록. */
  activePanels: PanelId[];

  /** 패널 visibility를 전환하는 기존 workspace 명령. */
  onPanelToggle: (panelId: PanelId) => void;
}

/**
 * 좌우 PanelDock의 패널 visibility를 제어하는 vertical ToggleButtonGroup.
 *
 * 위치·스크롤은 `panel-toggle-rail` shell이 담당하고, DOM/선택 semantics와 버튼
 * 시각 패턴은 header와 같은 RAC ToggleButtonGroup 계약을 사용한다.
 */
export const PanelToggleGroup = memo(function PanelToggleGroup({
  side,
  panelIds,
  activePanels,
  onPanelToggle,
}: PanelToggleGroupProps) {
  const { t } = useI18n();
  const activePanelIds = new Set<PanelId>(activePanels);
  const items = panelIds.flatMap((panelId) => {
    const config = PanelRegistry.getPanel(panelId);
    // 저빈도 진입점은 registry/placement를 유지하고 rail 표시만 생략한다.
    if (!config || config.hiddenFromRail) return [];
    return [{ panelId, config }];
  });
  const visiblePanelIds = items.map(({ panelId }) => panelId);
  const selectedKeys = new Set<Key>(
    visiblePanelIds.filter((panelId) => activePanelIds.has(panelId)),
  );
  const tooltipPlacement =
    side === "left" ? "right" : side === "right" ? "left" : "top";

  return (
    <div className="panel-toggle-rail" data-side={side}>
      <ToggleButtonGroup
        className="builder-control-group"
        orientation="vertical"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        indicator={true}
        aria-label={t(PANEL_SIDE_LABEL_KEYS[side])}
        onSelectionChange={(nextKeys: Set<Key>) => {
          // workspace SSOT는 한 번에 한 panelId를 뒤집는 명령을 제공한다. RAC가
          // 계산한 다음 Set과 현재 Set의 차이 하나만 기존 명령으로 전달한다.
          const toggledPanelId = visiblePanelIds.find(
            (panelId) => activePanelIds.has(panelId) !== nextKeys.has(panelId),
          );
          if (toggledPanelId) onPanelToggle(toggledPanelId);
        }}
      >
        {items.map(({ panelId, config }) => {
          const Icon = config.icon;
          const panelName = getPanelLabel(config, t);

          return (
            <TooltipTrigger key={panelId} delay={700}>
              <ToggleButton id={panelId} aria-label={panelName}>
                <Icon
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              </ToggleButton>
              <Tooltip placement={tooltipPlacement} className="action-tooltip">
                <span className="action-tooltip-label">{panelName}</span>
                {config.shortcut && (
                  <kbd className="action-tooltip-kbd">{config.shortcut}</kbd>
                )}
              </Tooltip>
            </TooltipTrigger>
          );
        })}
      </ToggleButtonGroup>
    </div>
  );
});
