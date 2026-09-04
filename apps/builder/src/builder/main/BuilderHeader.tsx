import {
  Activity,
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
  LayoutDashboard,
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
import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { iconProps } from "../../utils/ui/uiConstants";
import { usePanelLayout } from "../layout";
import { ActionIconButton } from "../components/ui/ActionIconButton";
import { ActionTooltipTrigger } from "../components/ui/ActionTooltip";
import { shortcutDisplayFor } from "../components/ui/actionTooltipUtils";
import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
} from "../hooks";
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
  onImportProject: (file: File) => void | Promise<void>;
  onExportProject: () => void | Promise<void>;
  onWorkflowOverlayToggle: () => void;
}

export const BuilderHeader: React.FC<BuilderHeaderProps> = ({
  projectId,
  projectName,
  breakpoint,
  breakpoints,
  onBreakpointChange,
  onPreview,
  onImportProject,
  onExportProject,
  onWorkflowOverlayToggle,
}) => {
  const { t } = useI18n();
  const { togglePanel, resetWorkspaceLayout } = usePanelLayout();
  const navigate = useNavigate();
  const isCompareMode = useCompareModeStore((state) => state.isCompareMode);
  const toggleCompareMode = useCompareModeStore(
    (state) => state.toggleCompareMode,
  );
  const importInputRef = useRef<HTMLInputElement>(null);

  // 프로젝트 목록으로 나간다 — 헤더 메뉴 항목과 ⌘O 가 같은 동작을 부른다.
  const handleOpenProject = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  const headerShortcuts = useMemo(
    () =>
      bindHandlersToDefinitions(["openProject"], {
        openProject: handleOpenProject,
      }),
    [handleOpenProject],
  );
  useKeyboardShortcutsRegistry(headerShortcuts, [headerShortcuts]);

  const handleImportFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      // 같은 파일도 다시 선택할 수 있도록 즉시 초기화한다.
      event.currentTarget.value = "";
      if (file) void onImportProject(file);
    },
    [onImportProject],
  );

  // aria-label 과 툴팁이 같은 문자열이어야 해서 한 번만 만든다.
  const compareLabel = isCompareMode
    ? t("header.skiaOnlyMode")
    : t("header.compareMode");
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
                if (key === "open") handleOpenProject();
                if (key === "import") importInputRef.current?.click();
                if (key === "export") void onExportProject();
                if (key === "reset-panel-layout") resetWorkspaceLayout();
                if (key === "workflow") onWorkflowOverlayToggle();
                if (key === "monitor") togglePanel("monitor");
                if (key === "settings") togglePanel("settings");
                if (key === "shortcuts")
                  window.dispatchEvent(new CustomEvent("open-command-palette"));
              }}
            >
              <MenuItem id="open" className="header-menu-item">
                <FolderOpen size={14} />
                <span>{t("header.openProject")}</span>
                <Keyboard>{shortcutDisplayFor("openProject")}</Keyboard>
              </MenuItem>
              <MenuItem id="import" className="header-menu-item">
                <Upload size={14} />
                <span>{t("header.importProject")}</span>
              </MenuItem>
              <MenuItem id="export" className="header-menu-item">
                <Download size={14} />
                <span>{t("header.exportProject")}</span>
              </MenuItem>
              <Separator className="header-menu-separator" />
              <MenuItem id="delete" className="header-menu-item">
                <DeleteIcon size={14} />
                <span>{t("header.deleteProject")}</span>
              </MenuItem>
              <Separator className="header-menu-separator" />
              <MenuItem id="reset-panel-layout" className="header-menu-item">
                <LayoutDashboard size={14} />
                <span>{t("header.resetPanelLayout")}</span>
              </MenuItem>
              <MenuItem id="workflow" className="header-menu-item">
                <GitBranch size={14} />
                <span>{t("header.workflow")}</span>
                <Keyboard>
                  {shortcutDisplayFor("toggleWorkflowOverlay")}
                </Keyboard>
              </MenuItem>
              <MenuItem id="monitor" className="header-menu-item">
                {/* Monitor 패널 정체 아이콘 = rail/패널 헤더와 같은 `Activity`.
                    `Monitor`(디스플레이)는 같은 헤더의 desktop breakpoint 가 쓴다. */}
                <Activity size={14} />
                <span>{t("header.monitor")}</span>
                <Keyboard>{shortcutDisplayFor("toggleMonitor")}</Keyboard>
              </MenuItem>
              <MenuItem id="settings" className="header-menu-item">
                <Settings size={14} />
                <span>{t("header.settings")}</span>
                <Keyboard>{shortcutDisplayFor("openSettings")}</Keyboard>
              </MenuItem>
              <Separator className="header-menu-separator" />
              <MenuItem id="shortcuts" className="header-menu-item">
                <Command size={14} />
                <span>{t("header.shortcuts")}</span>
                <Keyboard>{shortcutDisplayFor("commandPalette")}</Keyboard>
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
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImportFileChange}
        />
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
          {breakpoints.map((bp) => {
            const bpLabel =
              bp.id === "desktop"
                ? t("header.desktop")
                : bp.id === "tablet"
                  ? t("header.tablet")
                  : bp.id === "mobile"
                    ? t("header.mobile")
                    : bp.label;

            return (
              <ActionTooltipTrigger key={bp.id} tooltip={bpLabel}>
                <ToggleButton id={bp.id} aria-label={bpLabel}>
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
              </ActionTooltipTrigger>
            );
          })}
        </ToggleButtonGroup>

        {/* Zoom Controls */}
        <ZoomControls />
      </Group>

      <div className="header_contents header_right">
        <ToggleButtonGroup
          className="builder-control-group"
          selectionMode="multiple"
          selectedKeys={new Set([...(isCompareMode ? ["compare"] : [])])}
          indicator={true}
          onSelectionChange={(keys: Set<Key>) => {
            const selectedKeys = new Set(keys);
            const wasCompareMode = isCompareMode;
            const isCompareNowSelected = selectedKeys.has("compare");

            // Compare mode 토글
            if (wasCompareMode !== isCompareNowSelected) {
              toggleCompareMode();
            }
          }}
          aria-label={t("header.viewOptions")}
        >
          <ActionTooltipTrigger tooltip={compareLabel}>
            <ToggleButton id="compare" aria-label={compareLabel}>
              <Columns
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
              />
            </ToggleButton>
          </ActionTooltipTrigger>
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
      </div>
    </header>
  );
};
