import {
  Menu as MenuIcon,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  GitBranch,
  Command,
  FolderOpen,
  Download,
  Upload,
  CircleHelp,
  Info,
  Columns,
  Settings,
} from "lucide-react";
import {
  MenuTrigger,
  Menu,
  MenuItem,
  Popover,
  Separator,
  Keyboard,
  Button,
} from "react-aria-components";
import type { Key } from "react-aria-components";
import {
  ToggleButtonGroup,
  ToggleButton,
  Group,
} from "@composition/shared/components";
import { iconProps } from "../../utils/ui/uiConstants";
import { usePanelLayout } from "../layout";
import { ActionIconButton } from "../components/ui/ActionIconButton";
import { ZoomControls } from "../workspace/ZoomControls";
import { useCompareModeStore } from "../workspace/canvas/stores";
import { ACTION_ICONS } from "../config/actionIcons";
import { useI18n } from "../../i18n";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

// `Breakpoint` 정본은 `../workspace/types` — `canvasBreakpoints.ts` 의
// `CANVAS_BREAKPOINTS`(캔버스 프레임 실제 크기 SSOT)가 그 타입을 쓰고,
// 헤더 셀렉트는 같은 배열을 그대로 표시한다. 종전에 동일 형상을 여기에도
// 선언해 두 벌이었다 (`main/index.ts` 재수출 경로는 그대로 유지).
//
// `@composition/shared` 의 동명 `Breakpoint`(`{name,minWidth,maxWidth?,label,
// icon}`)는 미디어 쿼리 경계를 서술하는 **별개 타입**이다 — 혼동 금지.
export type { Breakpoint } from "../workspace/types";
import type { Breakpoint } from "../workspace/types";

export interface BuilderHeaderProps {
  projectId?: string;
  projectName?: string;
  breakpoint: Set<Key>;
  breakpoints: Breakpoint[];
  onBreakpointChange: (value: Key) => void;
  onPreview: () => void;
  onPlay: () => void;
  onPublish: () => void;
  showWorkflowOverlay: boolean;
  onWorkflowOverlayToggle: () => void;
}

export const BuilderHeader: React.FC<BuilderHeaderProps> = ({
  projectId,
  projectName,
  breakpoint,
  breakpoints,
  onBreakpointChange,
  onPreview,
  onPublish,
  showWorkflowOverlay,
  onWorkflowOverlayToggle,
}) => {
  const { t } = useI18n();
  const { workspaceLayout, togglePanel, resetWorkspaceLayout } =
    usePanelLayout();
  const isCompareMode = useCompareModeStore((state) => state.isCompareMode);
  const toggleCompareMode = useCompareModeStore(
    (state) => state.toggleCompareMode,
  );

  return (
    <header className="header">
      <div className="header_contents header_left">
        <MenuTrigger>
          <Button
            className="react-aria-Button header-menu-button"
            aria-label={t("header.menu")}
          >
            <MenuIcon
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </Button>
          <Popover
            className="header-menu-popover"
            placement="bottom start"
            offset={8}
            containerPadding={0}
          >
            <Menu
              className="header-menu"
              onAction={(key: Key) => {
                if (key === "reset-panel-layout") resetWorkspaceLayout();
                if (key === "settings") togglePanel("settings");
                if (key === "shortcuts")
                  window.dispatchEvent(new CustomEvent("open-command-palette"));
              }}
            >
              <MenuItem id="open" className="header-menu-item">
                <FolderOpen size={14} />
                <span>{t("header.openProject")}</span>
                <Keyboard>⌘O</Keyboard>
              </MenuItem>
              <MenuItem id="import" className="header-menu-item">
                <Download size={14} />
                <span>{t("header.importProject")}</span>
              </MenuItem>
              <MenuItem id="export" className="header-menu-item">
                <Upload size={14} />
                <span>{t("header.exportProject")}</span>
              </MenuItem>
              <Separator className="header-menu-separator" />
              <MenuItem id="delete" className="header-menu-item">
                <DeleteIcon size={14} />
                <span>{t("header.deleteProject")}</span>
              </MenuItem>
              <Separator className="header-menu-separator" />
              <MenuItem id="reset-panel-layout" className="header-menu-item">
                <Columns size={14} />
                <span>{t("header.resetPanelLayout")}</span>
              </MenuItem>
              <MenuItem id="settings" className="header-menu-item">
                <Settings size={14} />
                <span>{t("header.settings")}</span>
              </MenuItem>
              <Separator className="header-menu-separator" />
              <MenuItem id="shortcuts" className="header-menu-item">
                <Command size={14} />
                <span>{t("header.shortcuts")}</span>
                <Keyboard>⌘/</Keyboard>
              </MenuItem>
              <MenuItem id="help" className="header-menu-item">
                <CircleHelp size={14} />
                <span>{t("header.help")}</span>
              </MenuItem>
              <MenuItem id="about" className="header-menu-item">
                <Info size={14} />
                <span>{t("header.about")}</span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
        <div className="logo-container">
          <img src="/appIcon.svg" alt={t("header.logo")} />
        </div>
        <div className="project-info">
          {projectName && <span className="project-name">{projectName}</span>}
          {/*projectId && <code className="project-id">ID: {projectId}</code>*/}
          {!projectId && !projectName && t("header.noProject")}
        </div>
      </div>

      <Group
        className="header_contents screen builder-viewport-controls"
        aria-label={t("header.viewportControls")}
      >
        <ToggleButtonGroup
          className="builder-control-group"
          aria-label={t("header.viewportSize")}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={breakpoint}
          onSelectionChange={(keys: Set<Key>) => {
            const selected = Array.from(keys)[0];
            if (selected != null) onBreakpointChange(selected);
          }}
          indicator={true}
        >
          {breakpoints.map((bp) => (
            <ToggleButton
              id={bp.id}
              key={bp.id}
              aria-label={
                bp.id === "desktop"
                  ? t("header.desktop")
                  : bp.id === "tablet"
                    ? t("header.tablet")
                    : bp.id === "mobile"
                      ? t("header.mobile")
                      : bp.label
              }
            >
              {bp.id === "desktop" && (
                <Monitor
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              )}
              {bp.id === "tablet" && (
                <Tablet
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              )}
              {bp.id === "mobile" && (
                <Smartphone
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              )}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* Zoom Controls */}
        <ZoomControls />
      </Group>

      <div className="header_contents header_right">
        <ToggleButtonGroup
          className="builder-control-group"
          selectionMode="multiple"
          selectedKeys={
            new Set([
              ...(isCompareMode ? ["compare"] : []),
              ...(showWorkflowOverlay ? ["workflow"] : []),
              ...(workspaceLayout?.visibility.monitor === true
                ? ["monitor"]
                : []),
            ])
          }
          indicator={true}
          onSelectionChange={(keys: Set<Key>) => {
            const selectedKeys = new Set(keys);
            const wasCompareMode = isCompareMode;
            const isCompareNowSelected = selectedKeys.has("compare");
            const wasWorkflow = showWorkflowOverlay;
            const isWorkflowNowSelected = selectedKeys.has("workflow");
            const wasMonitor = workspaceLayout?.visibility.monitor === true;
            const isMonitorNowSelected = selectedKeys.has("monitor");

            // Compare mode 토글
            if (wasCompareMode !== isCompareNowSelected) {
              toggleCompareMode();
            }
            // Workflow 오버레이 토글
            if (wasWorkflow !== isWorkflowNowSelected) {
              onWorkflowOverlayToggle();
            }
            if (wasMonitor !== isMonitorNowSelected) {
              togglePanel("monitor");
            }
          }}
          aria-label={t("header.viewOptions")}
        >
          <ToggleButton
            id="compare"
            aria-label={
              isCompareMode ? t("header.skiaOnlyMode") : t("header.compareMode")
            }
          >
            <Columns
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ToggleButton>
          <ToggleButton
            id="workflow"
            aria-label={
              showWorkflowOverlay
                ? t("header.hideWorkflowOverlay")
                : t("header.showWorkflowOverlay")
            }
          >
            <GitBranch
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ToggleButton>
          <ToggleButton id="monitor" aria-label={t("header.monitor")}>
            <Monitor
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ToggleButton>
        </ToggleButtonGroup>
        <div className="builder-action-group">
          <ActionIconButton
            aria-label={t("header.preview")}
            tooltip={t("header.preview")}
            onPress={onPreview}
          >
            <Eye strokeWidth={iconProps.strokeWidth} size={iconProps.size} />
          </ActionIconButton>
        </div>
        <button
          aria-label={t("header.publish")}
          className="publish"
          onClick={onPublish}
        >
          {t("header.publish")}
        </button>
      </div>
    </header>
  );
};
