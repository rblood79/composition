import {
  Menu as MenuIcon,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Columns,
  Filter,
} from "lucide-react";
import { MenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Button } from "react-aria-components/Button";
import type { Key } from "react-aria-components/Collection";
import {
  ToggleButtonGroup,
  ToggleButton,
  Group,
} from "@composition/shared/components";
import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { iconProps, APP_ICON_URL } from "../../utils/ui/uiConstants";
import { usePanelLayout } from "../layout";
import { ActionIconButton } from "../components/ui/ActionIconButton";
import { StorageStatusButton } from "./StorageStatusButton";
import { ActionTooltipTrigger } from "../components/ui/ActionTooltip";
import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
} from "../hooks";
import { ZoomControls } from "../workspace/ZoomControls";
import { useCompareModeStore } from "../workspace/canvas/stores";
import { ConfirmDialog } from "../components/overlay/ConfirmDialog";
import type { HeaderMenuHost } from "./headerMenu/headerMenuActions";
import { HEADER_MENU_RUNTIME } from "./headerMenu/headerMenuRuntime";
import { buildPendingProjectDeleteState } from "../../dashboard/pendingProjectDelete";
import { useI18n } from "../../i18n";
import { navigateWithTransition } from "../../utils/ui/viewTransition";
import { preloadableLazy } from "../../utils/ui/preloadableLazy";

// 트리거 hover · focus 에서 미리 받은 본문은 Suspense 없이 곧바로 그린다 — 받은 뒤에도 lazy 로
// 그리면 첫 열림이 ~300 ms 늦는다 (`preloadableLazy.tsx`).
const HeaderMainMenu = preloadableLazy(
  () => import("./headerMenu/HeaderMainMenu"),
);
const preloadHeaderMainMenu = () => {
  void HeaderMainMenu.preload().catch(() => {});
};

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
  /** ADR-235 — v1 JSON (자산 인라인) 내보내기. 기본 내보내기는 v2 zip */
  onExportProjectJson: () => void | Promise<void>;
  /** ADR-235 Phase 6 — 프로젝트를 폴더에 연결 (Chromium File System Access) */
  onConnectFolder: () => void | Promise<void>;
  /** ADR-248 4e-6-32 — 열린 catalog 프로젝트의 스냅샷 만들기 (없으면 옛 store) */
  snapshotActions?: HeaderMenuHost["snapshotActions"];
  /** 연결된 프로젝트면 폴더 상태 버튼 (lazy) — 없으면 null */
  directoryLink: ReactNode;
  /** ADR-248 — 열린 프로젝트의 저장 상태 표시 */
  saveStatus?: ReactNode;
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
  onExportProjectJson,
  onConnectFolder,
  snapshotActions,
  directoryLink,
  saveStatus,
}) => {
  const { t } = useI18n();
  const { resetWorkspaceLayout } = usePanelLayout();
  const navigate = useNavigate();
  const isCompareMode = useCompareModeStore((state) => state.isCompareMode);
  const toggleCompareMode = useCompareModeStore(
    (state) => state.toggleCompareMode,
  );
  const filterCurrentPage = useCompareModeStore(
    (state) => state.filterCurrentPage,
  );
  const setCurrentPageFilter = useCompareModeStore(
    (state) => state.setCurrentPageFilter,
  );
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // 프로젝트 목록으로 나간다 — 헤더 메뉴 항목과 ⌘O 가 같은 동작을 부른다.
  const handleOpenProject = useCallback(() => {
    navigateWithTransition(() => navigate("/dashboard"));
  }, [navigate]);

  // 열린 프로젝트를 여기서 지우지 않는다 — 대시보드가 빌더 언마운트 뒤 지운다
  // (`dashboard/pendingProjectDelete.ts`).
  const handleConfirmDeleteProject = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    if (!projectId) return;
    navigateWithTransition(() =>
      navigate("/dashboard", {
        state: buildPendingProjectDeleteState(projectId),
      }),
    );
  }, [navigate, projectId]);

  // 전체 메뉴 (lazy) 가 부르는 헤더 콜백 — 대화상자 · 파일 입력 · 내보내기는 여기 산다
  const menuHost = useMemo<HeaderMenuHost>(
    () => ({
      projectId,
      onImportProject: () => importInputRef.current?.click(),
      onExportProject: () => void onExportProject(),
      onExportProjectJson: () => void onExportProjectJson(),
      onConnectFolder: () => void onConnectFolder(),
      snapshotActions,
      onDeleteProject: () => setIsDeleteConfirmOpen(true),
      onResetPanelLayout: resetWorkspaceLayout,
      runtime: HEADER_MENU_RUNTIME,
    }),
    [
      projectId,
      onExportProject,
      onExportProjectJson,
      onConnectFolder,
      snapshotActions,
      resetWorkspaceLayout,
    ],
  );

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
  const currentPageFilterLabel = t("header.compareCurrentPageOnly");
  return (
    <header className="header">
      <div className="header_contents header_left">
        {/* 본문은 lazy chunk (ADR-249 §4-3) — 트리거에 포인터 · 포커스가 오면 미리 받는다 */}
        <MenuTrigger>
          <Button
            className="react-aria-Button header-menu-button"
            aria-label={t("header.menu")}
            onHoverStart={preloadHeaderMainMenu}
            onFocus={preloadHeaderMainMenu}
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
            <Suspense fallback={null}>
              <HeaderMainMenu host={menuHost} />
            </Suspense>
          </Popover>
        </MenuTrigger>
        <ConfirmDialog
          isOpen={isDeleteConfirmOpen}
          title={t("header.deleteProject")}
          message={t("dashboard.confirmDeleteProject")}
          onConfirm={handleConfirmDeleteProject}
          onCancel={() => setIsDeleteConfirmOpen(false)}
        />
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json,application/zip,.zip"
          hidden
          onChange={handleImportFileChange}
        />
        <div className="logo-container">
          <img src={APP_ICON_URL} alt={t("header.logo")} />
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
        <Group
          className="builder-action-group"
          aria-label={t("header.viewOptions")}
        >
          <ToggleButtonGroup
            className="builder-control-group"
            selectionMode="multiple"
            selectedKeys={
              new Set([
                ...(isCompareMode ? ["compare"] : []),
                ...(isCompareMode && filterCurrentPage ? ["current-page"] : []),
              ])
            }
            indicator={true}
            onSelectionChange={(keys: Set<Key>) => {
              const selectedKeys = new Set(keys);
              const wasCompareMode = isCompareMode;
              const isCompareNowSelected = selectedKeys.has("compare");

              // Compare mode 토글
              if (wasCompareMode !== isCompareNowSelected) {
                toggleCompareMode();
              }

              if (isCompareMode) {
                setCurrentPageFilter(selectedKeys.has("current-page"));
              }
            }}
            aria-label={compareLabel}
          >
            <ActionTooltipTrigger tooltip={compareLabel}>
              <ToggleButton id="compare" aria-label={compareLabel}>
                <Columns
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              </ToggleButton>
            </ActionTooltipTrigger>
            {isCompareMode && (
              <ActionTooltipTrigger tooltip={currentPageFilterLabel}>
                <ToggleButton
                  id="current-page"
                  aria-label={currentPageFilterLabel}
                >
                  <Filter
                    strokeWidth={iconProps.strokeWidth}
                    size={iconProps.size}
                  />
                </ToggleButton>
              </ActionTooltipTrigger>
            )}
          </ToggleButtonGroup>
          {directoryLink}
          {saveStatus}
          <StorageStatusButton onExport={() => void onExportProject()} />
          <ActionIconButton
            aria-label={t("header.preview")}
            tooltip={t("header.preview")}
            onPress={onPreview}
          >
            <Eye strokeWidth={iconProps.strokeWidth} size={iconProps.size} />
          </ActionIconButton>
        </Group>
      </div>
    </header>
  );
};
