import {
  Menu as MenuIcon,
  Eye,
  Undo,
  Redo,
  Play,
  Monitor,
  Tablet,
  Smartphone,
  GitBranch,
  Settings,
  Command,
  FolderOpen,
  Download,
  Upload,
  Trash2,
  HelpCircle,
  Info,
  Columns,
} from "lucide-react";
import {
  Key,
  MenuTrigger,
  Menu,
  MenuItem,
  Popover,
  Separator,
  Keyboard,
  Button,
} from "react-aria-components";
import {
  ToggleButtonGroup,
  ToggleButton,
} from "@composition/shared/components";
import { iconProps } from "../../utils/ui/uiConstants";
import { usePanelLayout } from "../layout";
import { ZoomControls } from "../workspace/ZoomControls";
import { ActionIconButton } from "../components/ui";
import { useCompareModeStore } from "../workspace/canvas/stores";

export interface Breakpoint {
  id: string;
  label: string;
  max_width: string | number;
  max_height: string | number;
}

// 새로운 히스토리 시스템 타입
export interface HistoryInfo {
  current: number;
  total: number;
}

export interface BuilderHeaderProps {
  projectId?: string;
  projectName?: string;
  breakpoint: Set<Key>;
  breakpoints: Breakpoint[];
  onBreakpointChange: (value: Key) => void;
  historyInfo: HistoryInfo;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
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
  historyInfo,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreview,
  onPlay,
  onPublish,
  showWorkflowOverlay,
  onWorkflowOverlayToggle,
}) => {
  const { openPanelAsModal } = usePanelLayout();
  const isCompareMode = useCompareModeStore((state) => state.isCompareMode);
  const toggleCompareMode = useCompareModeStore(
    (state) => state.toggleCompareMode,
  );

  return (
    <nav className="header">
      <div className="header_contents header_left">
        <MenuTrigger>
          <Button aria-label="menu">
            <MenuIcon
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </Button>
          {/* portal 로 body 밑에 붙어 builder 토큰 scope 를 벗어난다 —
              마커가 없으면 빌더 다크 모드에서 이 메뉴만 흰 판으로 남는다
              (ContextMenuOverlay / ExistingSlotDialog 와 같은 처방) */}
          <Popover
            className="header-menu-popover"
            data-context="builder"
            placement="bottom start"
            offset={8}
            containerPadding={0}
          >
            <Menu className="header-menu" onAction={(key) => console.log(key)}>
              <MenuItem id="open" className="header-menu-item">
                <FolderOpen size={14} />
                <span>Open Project</span>
                <Keyboard>⌘O</Keyboard>
              </MenuItem>
              <MenuItem id="import" className="header-menu-item">
                <Download size={14} />
                <span>Import</span>
              </MenuItem>
              <MenuItem id="export" className="header-menu-item">
                <Upload size={14} />
                <span>Export</span>
              </MenuItem>
              <Separator className="header-menu-separator" />
              <MenuItem id="delete" className="header-menu-item">
                <Trash2 size={14} />
                <span>Delete Project</span>
              </MenuItem>
              <Separator className="header-menu-separator" />
              <MenuItem id="help" className="header-menu-item">
                <HelpCircle size={14} />
                <span>Help</span>
              </MenuItem>
              <MenuItem id="about" className="header-menu-item">
                <Info size={14} />
                <span>About</span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
        <div className="logo-container">
          <img src="/appIcon.svg" alt="logo" />
        </div>
        <div className="project-info">
          {projectName && <span className="project-name">{projectName}</span>}
          {/*projectId && <code className="project-id">ID: {projectId}</code>*/}
          {!projectId && !projectName && "No project loaded"}
        </div>
      </div>

      <div className="header_contents screen">
        <code className="code sizeInfo">
          {
            breakpoints.find((bp) => bp.id === Array.from(breakpoint)[0])
              ?.max_width
          }
          x
          {
            breakpoints.find((bp) => bp.id === Array.from(breakpoint)[0])
              ?.max_height
          }
        </code>

        <ToggleButtonGroup
          selectionMode="single"
          selectedKeys={breakpoint}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];
            if (selected) onBreakpointChange(selected);
          }}
          indicator={true}
        >
          {breakpoints.map((bp) => (
            <ToggleButton id={bp.id} key={bp.id} aria-label={bp.label}>
              {bp.id === "desktop" && (
                <Monitor
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              )}
              {bp.id === "tablet" && (
                <Tablet
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              )}
              {bp.id === "mobile" && (
                <Smartphone
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              )}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* Zoom Controls */}
        <ZoomControls />
      </div>

      <div className="header_contents header_right">
        <span className="history-info">
          {historyInfo ? `${historyInfo.current}/${historyInfo.total}` : "0/0"}
        </span>
        <ActionIconButton
          aria-label="Undo"
          onPress={onUndo}
          isDisabled={!canUndo}
          shortcutId="undo"
          tooltipPlacement="bottom"
        >
          <Undo
            color={!canUndo ? "#999" : iconProps.color}
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
        </ActionIconButton>
        <ActionIconButton
          aria-label="Redo"
          onPress={onRedo}
          isDisabled={!canRedo}
          shortcutId="redo"
          tooltipPlacement="bottom"
        >
          <Redo
            color={!canRedo ? "#999" : iconProps.color}
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
        </ActionIconButton>
        <ToggleButtonGroup
          selectionMode="multiple"
          selectedKeys={
            new Set([
              ...(isCompareMode ? ["compare"] : []),
              ...(showWorkflowOverlay ? ["workflow"] : []),
            ])
          }
          indicator={true}
          onSelectionChange={(keys) => {
            const selectedKeys = new Set(keys);
            const wasCompareMode = isCompareMode;
            const isCompareNowSelected = selectedKeys.has("compare");
            const wasWorkflow = showWorkflowOverlay;
            const isWorkflowNowSelected = selectedKeys.has("workflow");

            // Compare mode 토글
            if (wasCompareMode !== isCompareNowSelected) {
              toggleCompareMode();
            }
            // Workflow 오버레이 토글
            if (wasWorkflow !== isWorkflowNowSelected) {
              onWorkflowOverlayToggle();
            }
          }}
          aria-label="View options"
        >
          <ToggleButton
            id="compare"
            aria-label={
              isCompareMode ? "Skia Only Mode" : "Compare Mode (Preview + Skia)"
            }
          >
            <Columns
              color={isCompareMode ? "var(--color-white)" : iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ToggleButton>
          <ToggleButton
            id="workflow"
            aria-label={
              showWorkflowOverlay
                ? "Hide Workflow Overlay"
                : "Show Workflow Overlay"
            }
          >
            <GitBranch
              color={
                showWorkflowOverlay ? "var(--color-white)" : iconProps.color
              }
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ToggleButton>
          <ToggleButton id="preview" aria-label="Preview" onPress={onPreview}>
            <Eye
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ToggleButton>
          <ToggleButton
            id="settings"
            aria-label="Settings"
            onPress={() => openPanelAsModal("settings")}
          >
            <Settings
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ToggleButton>
          <ToggleButton
            id="shortcuts"
            aria-label="Command Palette"
            onPress={() =>
              window.dispatchEvent(new CustomEvent("open-command-palette"))
            }
          >
            <Command
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </ToggleButton>
        </ToggleButtonGroup>
        <button aria-label="Play" onClick={onPlay}>
          <Play
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
        </button>
        <button aria-label="Publish" className="publish" onClick={onPublish}>
          Publish
        </button>
      </div>
    </nav>
  );
};
