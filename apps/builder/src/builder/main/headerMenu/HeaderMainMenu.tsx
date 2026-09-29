/**
 * 전체 메뉴 본문 (ADR-249) — `BuilderHeader` 의 `MenuTrigger` Popover 안에서 lazy 로
 * 받는다. `COMMAND_META` · `componentSemanticsActions` 는 이 chunk 에만 있다 (ADR-196
 * HC6 — 초기 번들 상주 금지).
 *
 * 구조는 `BUILDER_MENU_ROOT`, 라벨 · 단축키 · 실행 · 활성은 원본에서 읽는다
 * (`menuModel.ts`). 검색어가 있으면 모든 잎 항목을 경로 머리글과 함께 평면으로
 * 보인다 — `SubmenuTrigger` 안쪽은 Autocomplete 필터가 닿지 않는다.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { Header } from "react-aria-components/Header";
import { Keyboard } from "react-aria-components/Keyboard";
import {
  Menu,
  MenuItem,
  MenuSection,
  SubmenuTrigger,
} from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Separator } from "react-aria-components/Separator";
import { Text } from "react-aria-components/Text";
import { useStore } from "../../stores";
import { useSectionCollapse } from "../../panels/styles/hooks/useSectionCollapse";
import { PanelRegistry } from "../../panels/core/PanelRegistry";
import { togglePanelWorkspace } from "../../hooks/usePanelLayout";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../../config/keyboardShortcuts";
import { snapshotManager } from "../../stores/history/snapshots";
// 읽기 모델은 agent executor 경유 — executor 청크가 이미 싣고 있는 모듈 묶음을 그대로 가리켜야
// Rolldown 이 initial 공유 청크 (canvasActions) 를 쪼개지 않는다 (G2, headerMenuRuntime.ts).
import { buildAgentReadModel } from "../../../services/agent/executeAgentCommand";
import { BUILDER_MENU_ROOT } from "./builderMenuStructure";
import "./HeaderMainMenu.css";
import type { HeaderMenuHost } from "./headerMenuActions";
import { deriveWorkspacePanelGroups } from "./resolveMenuItemState";
import {
  buildMenuModel,
  searchMenuModel,
  type MenuBlock,
  type MenuLeaf,
  type MenuSubmenu,
} from "./menuModel";

/**
 * 메뉴에서 고른 명령 실행 — 대상 scope 를 인자로 넘긴다 (ADR-249 §4-5). 메뉴가
 * 닫히며 포커스가 트리거로 돌아간 다음 프레임에 부른다 (명령 팔레트와 같은 순서).
 */
function runMenuCommand(
  id: ShortcutId,
  resolveCommand: HeaderMenuHost["runtime"]["resolveCommand"],
): void {
  const entry = resolveCommand(id);
  if (!entry || entry.disabled) return;
  requestAnimationFrame(() => entry.handler({ scope: "canvas-focused" }));
}

export interface HeaderMainMenuProps {
  host: HeaderMenuHost;
}

export default function HeaderMainMenu({ host }: HeaderMainMenuProps) {
  const { t } = host.runtime.useI18n();
  const [query, setQuery] = useState("");

  // 열린 동안만 마운트된다 — 구독도 그동안만.
  const { runtime } = host;
  const registry = useSyncExternalStore(
    runtime.subscribeCommandRegistry,
    runtime.getCommandRegistrySnapshot,
  );
  const workspaceLayout = useStore((state) => state.panelWorkspaceLayout);
  const showRulers = useStore((state) => state.showRulers);
  const showWorkflowOverlay = useStore((state) => state.showWorkflowOverlay);
  const snapToObjects = useStore((state) => state.snapToObjects);
  const selectedElementId = useStore((state) => state.selectedElementId);
  const selectedElementIds = useStore((state) => state.selectedElementIds);
  const focusMode = useSectionCollapse((state) => state.focusMode);
  const themeMode = host.runtime.useThemeMode();

  // 스냅샷 상한 판정은 IndexedDB 목록 hydrate 뒤에 맞다 — 열 때 받아 두고 갱신을 구독한다.
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  useEffect(() => {
    const unsubscribe = snapshotManager.subscribe(() =>
      setSnapshotVersion((version) => version + 1),
    );
    if (host.projectId) void snapshotManager.loadProject(host.projectId);
    return unsubscribe;
  }, [host.projectId]);

  const isPanelVisible = useCallback(
    (panelId: Parameters<typeof togglePanelWorkspace>[0]) =>
      workspaceLayout?.visibility[panelId] === true,
    [workspaceLayout],
  );

  const blocks = useMemo(() => {
    const readModel = buildAgentReadModel();
    const selected = selectedElementId
      ? readModel.elementsMap.get(selectedElementId)
      : undefined;

    return buildMenuModel(BUILDER_MENU_ROOT, {
      t,
      host,
      enablement: {
        readModel,
        resolve: runtime.resolveCommand,
        isPanelVisible,
        panelIdForScope: runtime.panelIdForScope,
      },
      checks: { showRulers, showWorkflowOverlay, focusMode, isPanelVisible },
      panelGroups: workspaceLayout
        ? deriveWorkspacePanelGroups(workspaceLayout.railOrder, (id) =>
            PanelRegistry.getPanel(id),
          )
        : [],
      panelLabel: (config) => runtime.panelLabel(config, t),
      // 선택에 따라 바뀌는 라벨 (컴포넌트 만들기/해제) 은 시맨틱 액션 표가 정본
      commandLabel: (id) => {
        const label = runtime.contextLabelKey(id, selected);
        return label ? t(label.key, label.params) : t(`command.${id}`);
      },
      commandShortcut: (id) => {
        const def = SHORTCUT_DEFINITIONS[id];
        return runtime.formatShortcut({ key: def.key, modifier: def.modifier });
      },
      commandCategory: (id) => SHORTCUT_DEFINITIONS[id].category,
      runCommand: (id: ShortcutId) =>
        runMenuCommand(id, runtime.resolveCommand),
      togglePanel: togglePanelWorkspace,
    });
    // registry · 체크 · 선택 · 스냅샷 · 모양이 바뀌면 다시 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    t,
    host,
    registry,
    workspaceLayout,
    isPanelVisible,
    showRulers,
    showWorkflowOverlay,
    snapToObjects,
    focusMode,
    themeMode,
    selectedElementId,
    selectedElementIds,
    snapshotVersion,
  ]);

  const visibleBlocks = useMemo(
    () => (query.trim() ? searchMenuModel(blocks, query, host.runtime.matchesCommandSearch) : blocks),
    [blocks, query],
  );

  const BuilderSearchField = runtime.SearchField;
  return (
    <Autocomplete inputValue={query} onInputChange={setQuery}>
      <div className="header-menu-search">
        <BuilderSearchField
          appearance="control"
          autoFocus
          placeholder={`${t("common.search")}…`}
          aria-label={t("common.search")}
        />
      </div>
      <Menu
        className="header-menu"
        aria-label={t("header.menu")}
        renderEmptyState={() => (
          <div className="header-menu-empty">
            {t("commandPalette.noResults", { query })}
          </div>
        )}
      >
        {renderBlocks(
          visibleBlocks,
          host.runtime.icons,
          host.runtime.iconSize,
          host.runtime.iconStrokeWidth,
        )}
      </Menu>
    </Autocomplete>
  );
}

type MenuIcons = HeaderMainMenuProps["host"]["runtime"]["icons"];

interface MenuRenderOptions {
  icons: MenuIcons;
  /** 빌더 표준 아이콘 크기 (`iconProps.size` 16 — 메뉴 행 정본 builder-menu-row.css 도 16) */
  iconSize: number;
  iconStrokeWidth: number;
  /**
   * 이 구역에 아이콘 있는 항목이 하나라도 있으면 구역 전 항목이 자리를 받는다 (라벨 시작선).
   * 구역 단위 — 아이콘 없는 구역 (Workflow 아래) 은 빈 칸을 두지 않는다 (사용자 2026-09-29).
   */
  reservesIconColumn: boolean;
}

function renderBlocks(
  blocks: readonly MenuBlock[],
  icons: MenuIcons,
  iconSize: number,
  iconStrokeWidth: number,
) {
  return blocks.flatMap((block, index) => {
    const options: MenuRenderOptions = {
      icons,
      iconSize,
      iconStrokeWidth,
      reservesIconColumn: block.entries.some(
        (entry) => entry.kind === "leaf" && entry.icon,
      ),
    };
    const section = (
      <MenuSection
        key={block.key}
        id={block.key}
        className="header-menu-section"
        selectionMode={block.selection}
        selectedKeys={
          block.selection === "none"
            ? undefined
            : block.entries.flatMap((entry) =>
                entry.kind === "leaf" && entry.checked ? [entry.key] : [],
              )
        }
      >
        {block.header && (
          <Header className="header-menu-section-header">{block.header}</Header>
        )}
        {block.entries.map((entry) =>
          entry.kind === "submenu"
            ? renderSubmenu(entry, options)
            : renderLeaf(entry, options),
        )}
      </MenuSection>
    );
    // 머리글 있는 구역 (검색 결과) 은 머리글이 경계다 — 구분선은 모델이 정한 곳에만
    return index > 0 && !block.header && block.separated
      ? [
          <Separator
            key={`${block.key}:separator`}
            className="header-menu-separator"
          />,
          section,
        ]
      : [section];
  });
}

/** 아이콘 자리 — 아이콘 있는 구역 안에서는 아이콘 없는 항목도 같은 폭. */
function MenuItemIcon({
  leaf,
  options,
}: {
  leaf?: MenuLeaf;
  options: MenuRenderOptions;
}) {
  if (!options.reservesIconColumn) return null;
  const Icon = leaf?.icon;
  return (
    <span aria-hidden="true" className="header-menu-item-icon">
      {Icon ? (
        <Icon size={options.iconSize} strokeWidth={options.iconStrokeWidth} />
      ) : null}
    </span>
  );
}

function renderLeaf(leaf: MenuLeaf, options: MenuRenderOptions) {
  const { Check } = options.icons;
  return (
    <MenuItem
      key={leaf.key}
      id={leaf.key}
      data-menu-key={leaf.key}
      className="header-menu-item"
      textValue={leaf.label}
      isDisabled={!leaf.enabled || !leaf.run}
      onAction={leaf.run}
    >
      {({ isSelected, selectionMode }) => (
        <>
          <MenuItemIcon leaf={leaf} options={options} />
          <Text slot="label" className="header-menu-item-label">
            {leaf.label}
          </Text>
          {/* 켜짐 표시 — 아이콘 있는 항목 (패널) 은 아이콘 칸을 채워 레일의 선택 버튼처럼
              보이고 (CSS `[data-selected]`), 아이콘 없는 항목만 오른쪽 체크를 단다
              (사용자 2026-09-29 — 왼쪽 체크 열 제거). */}
          {selectionMode !== "none" && isSelected && !leaf.icon ? (
            <Check
              aria-hidden="true"
              className="header-menu-item-check"
              size={options.iconSize}
            />
          ) : null}
          {leaf.shortcut && <Keyboard>{leaf.shortcut}</Keyboard>}
        </>
      )}
    </MenuItem>
  );
}

function renderSubmenu(submenu: MenuSubmenu, options: MenuRenderOptions) {
  const { ChevronRight } = options.icons;
  return (
    <SubmenuTrigger key={submenu.key}>
      <MenuItem
        id={submenu.key}
        data-menu-key={submenu.key}
        className="header-menu-item"
        textValue={submenu.label}
      >
        <MenuItemIcon options={options} />
        <Text slot="label" className="header-menu-item-label">
          {submenu.label}
        </Text>
        <ChevronRight
          aria-hidden="true"
          className="header-menu-chevron"
          size={options.iconSize}
        />
      </MenuItem>
      <Popover className="header-menu-popover" placement="end top" offset={-4}>
        <Menu className="header-menu" aria-label={submenu.label}>
          {renderBlocks(
            submenu.blocks,
            options.icons,
            options.iconSize,
            options.iconStrokeWidth,
          )}
        </Menu>
      </Popover>
    </SubmenuTrigger>
  );
}
