/**
 * DataTablePanel — the one data surface (ADR-288 Decision 1, 사용자 2026-10-28 「data패널의
 * 사이즈를 100% 로」 · G6 「기존의 탭형태로 tables, api, variables 구조로」): full workspace width
 * by default (it covers the canvas; narrower = side by side). Under the title the three tabs the
 * panel always had — Tables · APIs · Variables (the shared `.panel-tabs` skeleton, Navigator /
 * Styles). Each tab draws a list column plus a body (`DataSurfaceBody` — the grid · the API
 * form · a variable group's table · a creator, whatever `dataTableEditorStore.mode` says). The
 * Variables list is groups (project · each page — 사용자 2026-10-29 「tables · apis 처럼」), not
 * single variables: a group's variables are edited in its table. No editor or field panel: a
 * column's editor is its header popover.
 *
 * The tab follows the mode (an entry point that opens a table lands on Tables; `openVariables`
 * lands on Variables) and switching tabs closes a body that belongs to another tab.
 *
 * Narrow (≤ 459 px — the saved width of an older layout, R4): the list column and the body take
 * turns, the body header's close going back to the list.
 *
 * The lists read `useDataStore` — the open catalog document's data definitions projected
 * (ADR-286 — nothing to load here).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useParams } from "react-router";
import { Database, FileEdit, Globe, Table2, Variable } from "lucide-react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components/Tabs";
import { iconProps } from "../../../utils/ui/uiConstants";
import { CatalogWorkspaceGate } from "../../catalogRuntime/react";
import { useDataStore } from "../../stores/data";
import { useDataTableEditorStore } from "./stores/dataTableEditorStore";
import type { DataTableEditorMode } from "./types/editorTypes";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { PanelContents } from "../../components/panel/PanelContents";
import { panelContents } from "../../components/panel/panelContentsUtils";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingSpinner } from "../../components/feedback/LoadingSpinner";
import { DataTableList } from "./components/DataTableList";
import { ApiEndpointList } from "./components/ApiEndpointList";
import { VariableGroupList } from "./components/VariableGroupList";
import { DataPanelStatusRegion } from "./components/DataPanelStatusRegion";
import { DataSurfaceBody, dataSurfaceModeKey } from "./DataSurfaceBody";
import { PanelSplitter } from "../../layout/PanelSplitter";
// The Navigator row pattern (`.elementItem` — icon · label · row actions) for the table list
// (G6, 사용자 2026-10-28). One stylesheet, both panels — no twin classes.
import "../navigator/NavigatorPanel.css";
import "./DataTablePanel.css";
import { translateKey, useOptionalI18n } from "../../../i18n";

/** Below this width the list and the body take turns (one column). */
export const DATA_SURFACE_NARROW_MAX = 459;

/** The list column — a panel's standard width (`panelConfigs` 228, 사용자 G6 2026-10-28). */
export const DATA_SURFACE_LIST_WIDTH = 228;
/** The list column never goes under a panel's `minWidth` (200) and leaves the body this much. */
export const DATA_SURFACE_LIST_MIN = 200;
export const DATA_SURFACE_BODY_MIN = 320;
const LIST_WIDTH_STORAGE_KEY = "builder.datatable.listWidth.v1";

/** The list width a drag lands on — clamped to [min, panel − body min]. */
export function clampDataListWidth(width: number, panelWidth: number): number {
  const max = Math.max(
    DATA_SURFACE_LIST_MIN,
    panelWidth - DATA_SURFACE_BODY_MIN,
  );
  return Math.round(Math.min(max, Math.max(DATA_SURFACE_LIST_MIN, width)));
}

function readStoredListWidth(): number {
  try {
    const raw = globalThis.localStorage?.getItem(LIST_WIDTH_STORAGE_KEY);
    const value = raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(value) && value >= DATA_SURFACE_LIST_MIN
      ? value
      : DATA_SURFACE_LIST_WIDTH;
  } catch {
    return DATA_SURFACE_LIST_WIDTH;
  }
}

function storeListWidth(width: number) {
  try {
    globalThis.localStorage?.setItem(LIST_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // storage unavailable — the width lives for the session
  }
}

export type DataTableTab = "tables" | "endpoints" | "variables";

interface TabConfig {
  id: DataTableTab;
  label: string;
  i18nKey: string;
  icon: typeof Table2;
}

const TABS: TabConfig[] = [
  { id: "tables", label: "Tables", i18nKey: "tables", icon: Table2 },
  { id: "endpoints", label: "APIs", i18nKey: "apis", icon: Globe },
  { id: "variables", label: "Variables", i18nKey: "variables", icon: Variable },
];

/** The tab a body mode belongs to. */
export function dataTableTabFor(
  mode: NonNullable<DataTableEditorMode>,
): DataTableTab {
  switch (mode.type) {
    case "table-create":
    case "table-edit":
      return "tables";
    case "api-create":
    case "api-edit":
      return "endpoints";
    case "variable-create":
    case "variables":
      return "variables";
  }
}

/** Panels mount before the workspace exists — the Data hosts are provided with it. */
export function DataTablePanel() {
  return (
    <CatalogWorkspaceGate>
      <DataTablePanelContent />
    </CatalogWorkspaceGate>
  );
}

/** The panel root's width (ResizeObserver; 0 where it does not exist — tests). */
function usePanelWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function DataTablePanelContent() {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;

  const { projectId: currentProjectId } = useParams<{ projectId: string }>();
  const isLoading = useDataStore((state) => state.isLoading);

  const mode = useDataTableEditorStore((state) => state.mode);
  const openTableCreator = useDataTableEditorStore(
    (state) => state.openTableCreator,
  );
  const openTableEditor = useDataTableEditorStore(
    (state) => state.openTableEditor,
  );
  const close = useDataTableEditorStore((state) => state.close);

  // The tab follows the body — Quick Connect · CollectionBinding · the agent open a mode from
  // outside the panel and the user has to see it (in the render the mode arrives in).
  const [tab, setTab] = useState<DataTableTab>(() =>
    mode ? dataTableTabFor(mode) : "tables",
  );
  const [tabMode, setTabMode] = useState(mode);
  if (tabMode !== mode) {
    setTabMode(mode);
    if (mode) setTab(dataTableTabFor(mode));
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const panelWidth = usePanelWidth(rootRef);
  const narrow = panelWidth > 0 && panelWidth <= DATA_SURFACE_NARROW_MAX;

  // The list column: 228 by default, dragged at its right edge (PanelSplitter — the workspace's
  // own resize handle: pointer · Home/End), remembered across sessions.
  const [listWidth, setListWidth] = useState(readStoredListWidth);
  const dragStartWidth = useRef(listWidth);
  const onListResizeStart = useCallback(() => {
    dragStartWidth.current = listWidth;
  }, [listWidth]);
  const onListResize = useCallback(
    (deltaX: number) => {
      const bound = panelWidth || rootRef.current?.clientWidth || Infinity;
      setListWidth(clampDataListWidth(dragStartWidth.current + deltaX, bound));
    },
    [panelWidth],
  );
  const onListResizeEnd = useCallback(() => {
    setListWidth((width) => {
      storeListWidth(width);
      return width;
    });
  }, []);
  const listMax = Math.max(
    DATA_SURFACE_LIST_MIN,
    (panelWidth || Infinity) - DATA_SURFACE_BODY_MIN,
  );

  // 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922).

  if (!currentProjectId) {
    return (
      <div className="panel datatable-panel">
        <PanelHeader
          icon={<Database size={iconProps.size} />}
          title={i18n ? i18n.t("panels.dataTable") : "Data"}
          panelId="datatable"
        />
        <EmptyState
          icon={<Database size={32} />}
          message={localize("noProject", "Select a project")}
        />
      </div>
    );
  }

  const projectId = currentProjectId;
  const tabLabel = (config: TabConfig) =>
    localize(config.i18nKey, config.label);

  /** The body mode of a list tab — null when the open body belongs to another tab. */
  const bodyFor = (
    forTab: DataTableTab,
  ): NonNullable<DataTableEditorMode> | null =>
    mode && dataTableTabFor(mode) === forTab ? mode : null;

  const editingTableId = mode?.type === "table-edit" ? mode.tableId : null;

  const renderSurface = (forTab: DataTableTab, list: React.ReactNode) => {
    const body = bodyFor(forTab);
    const showList = !narrow || body === null;
    const showBody = !narrow || body !== null;
    return (
      <>
        {showList && (
          <div
            className="datatable-surface-list"
            id={`datatable-surface-list-${forTab}`}
          >
            <PanelContents>{list}</PanelContents>
            {!narrow && (
              <PanelSplitter
                edge="right"
                label={localize("resizeList", "Resize list")}
                controls={`datatable-surface-list-${forTab}`}
                value={listWidth}
                minValue={DATA_SURFACE_LIST_MIN}
                maxValue={Number.isFinite(listMax) ? listMax : listWidth}
                onResizeStart={onListResizeStart}
                onResize={onListResize}
                onResizeEnd={onListResizeEnd}
              />
            )}
          </div>
        )}
        {showBody && (
          <div className="datatable-surface-body">
            {body ? (
              <DataSurfaceBody
                key={dataSurfaceModeKey(body)}
                mode={body}
                close={close}
              />
            ) : (
              <div className="datatable-surface-empty">
                <EmptyState
                  icon={<FileEdit size={32} />}
                  message={localize(
                    "selectEditorItem",
                    "Select an item to edit",
                  )}
                />
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className="panel datatable-panel"
      ref={rootRef}
      data-narrow={narrow ? "true" : undefined}
      data-mode={mode?.type ?? "none"}
      data-tab={tab}
      style={{ "--datatable-list-width": `${listWidth}px` } as CSSProperties}
    >
      <PanelHeader
        icon={<Database size={iconProps.size} />}
        title={i18n ? i18n.t("panels.dataTable") : "Data"}
        panelId="datatable"
      />
      {/* 로딩 중에도 목록 유지 (본문이 닫히는 것 방지) */}
      {isLoading && (
        <div className="datatable-loading-overlay">
          <LoadingSpinner />
        </div>
      )}
      {/* 탭 = 공용 패턴 — `.panel-header.panel-tabrow` 래퍼 (바 크롬) + `.panel-tablist` /
          `.panel-tab` (RAC Tabs). Navigator / Styles 와 동일 구조. */}
      <Tabs
        className="panel-tabs"
        selectedKey={tab}
        onSelectionChange={(key) => {
          const next = key as DataTableTab;
          if (next === tab) return;
          // A body of another tab closes with it (the old tab behaviour) — a body of this tab
          // (an external open that moved the tab here) stays.
          if (mode && dataTableTabFor(mode) !== next) close();
          setTab(next);
        }}
      >
        <div className="panel-header panel-tabrow">
          <TabList
            className="panel-tablist"
            aria-label={localize("tabs", "DataTable tabs")}
          >
            {TABS.map((config) => (
              <Tab key={config.id} id={config.id} className="panel-tab">
                {/* 폭 < 360 아이콘 모드에서 tooltip (HC3) — 라벨은 시각만 숨겨 이름은 남는다 */}
                <span className="panel-tab-icon" title={tabLabel(config)}>
                  <config.icon
                    color="currentColor"
                    strokeWidth={iconProps.strokeWidth}
                    size={iconProps.size}
                  />
                </span>
                <span className="panel-tab-label">{tabLabel(config)}</span>
              </Tab>
            ))}
          </TabList>
        </div>

        <TabPanel id="tables" className={panelContents("datatable-surface")}>
          {renderSurface(
            "tables",
            <DataTableList
              projectId={projectId}
              editingId={editingTableId}
              onEditingChange={(id) => {
                if (id) openTableEditor(id);
              }}
              onCreateClick={() => openTableCreator(projectId)}
            />,
          )}
        </TabPanel>
        <TabPanel id="endpoints" className={panelContents("datatable-surface")}>
          {renderSurface(
            "endpoints",
            <ApiEndpointList projectId={projectId} />,
          )}
        </TabPanel>
        <TabPanel id="variables" className={panelContents("datatable-surface")}>
          {renderSurface(
            "variables",
            <VariableGroupList projectId={projectId} />,
          )}
        </TabPanel>
      </Tabs>
      {/* ADR-212 HC4 — 저장 · 행 추가 · Run · import 결과의 `role=status` 영역 (항상 마운트) */}
      <DataPanelStatusRegion />
    </div>
  );
}
