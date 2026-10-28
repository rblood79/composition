/**
 * DataTableList - DataTable 목록 컴포넌트
 *
 * ADR-212 Phase 1 — 항목은 RAC `GridList` 행 (키보드로 열림 · 행 안 버튼은 Arrow 로 도달,
 * A5). ADR-288 G6 (사용자 2026-10-28 「navigator 의 pages · layers 패턴으로 — field · rows ·
 * used 는 … 줄임」): 행은 Navigator 의 `.elementItem` 한 줄 (아이콘 · 이름 · 메타 · 행 액션) 이고
 * 행 액션은 Navigator Pages 와 같은 두 아이콘 (G6 수정 10, 사용자 2026-10-29 「edit, delete 버튼을
 * navigator-pages 처럼 바로」): 설정 (Settings2) 이 행 아래 표 설정 팝오버 (`TableSettingsPopover`) 를
 * 열고, 삭제는 ConfirmDialog. 메타 (소스 · 필드 수 · 행 수 · 사용처 N · 마지막 실행 오류) 는 글자로
 * 보이지 않고 행의 `title` 로만 남는다 — `data-empty` · `data-error` · `data-source` 는 그대로.
 *
 * @see presets/dataTablePresets.ts (카탈로그) · @composition/sample-data (생성기, ADR-220) — DATATABLE_PRESET_SYSTEM.md 는 없다 (stale 참조 정리 2026-09-16)
 */

import { Settings2, Table2 } from "lucide-react";

import { useMemo, useRef, useState } from "react";

import { Button } from "react-aria-components/Button";

import { GridList, GridListItem } from "react-aria-components/GridList";

import { translateKey, useOptionalI18n } from "../../../../i18n";

import { iconEditProps, iconProps } from "../../../../utils/ui/uiConstants";

import { EmptyState } from "../../../components/feedback/EmptyState";

import { ConfirmDialog } from "../../../components/overlay";

import { Section } from "../../../components/panel/Section";
import { ActionIconButton } from "../../../components/ui/ActionIconButton";

import { useDataStore } from "../../../stores/data";

import { announceDataPanelStatus } from "../stores/dataPanelStatusStore";

import { useDataUsageSource } from "../usage/dataUsageSource";

import { TableSettingsPopover } from "./TableSettingsPopover";

import {
  findLinkedApi,
  resolveCollectionBadgeStatus,
} from "../utils/collectionBadgeStatus";
import {
  AddIcon,
  DataTableListProps,
  DeleteIcon,
} from "./DataTableList.runtime";

export function DataTableList({
  projectId,
  editingId,
  onEditingChange,
  onCreateClick,
}: DataTableListProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  /** 보간이 필요한 문구 — provider 밖(격리 렌더)이면 키를 그대로 돌려준다. */
  const t = (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => (i18n ? i18n.t(`datatable.${key}`, params) : key);
  // 개별 selector로 Map 직접 구독 (리렌더링 최적화)
  const dataTablesMap = useDataStore((state) => state.collections);
  const apiEndpointsMap = useDataStore((state) => state.apiEndpoints);
  const apiRuns = useDataStore((state) => state.apiRuns);
  const deleteCollection = useDataStore((state) => state.deleteCollection);
  // 사용처 N (152 역참조) — 문서 쪽 읽기는 usage source (구 store · catalog 색인)
  const usageSource = useDataUsageSource();

  // useMemo로 배열 변환 캐싱 (Map 참조가 변경될 때만 재계산)
  const collections = useMemo(
    () => Array.from(dataTablesMap.values()),
    [dataTablesMap],
  );
  const apiEndpoints = useMemo(
    () => Array.from(apiEndpointsMap.values()),
    [apiEndpointsMap],
  );
  const usage = usageSource.useCollectionUsage(collections);

  // Silence unused variable warning
  void projectId;

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Settings — the table settings popover anchors under the row's actions cell (G6 수정 9 · 10).
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const actionCells = useRef(new Map<string, HTMLElement>());
  const settingsTriggerRef = useRef<Element | null>(null);
  const openSettings = (id: string) => {
    settingsTriggerRef.current = actionCells.current.get(id) ?? null;
    setSettingsId(id);
  };
  const settingsTable = settingsId
    ? (collections.find((c) => c.id === settingsId) ?? null)
    : null;

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id) return;
    const name = collections.find((c) => c.id === id)?.name ?? "";
    try {
      await deleteCollection(id);
      if (editingId === id) {
        onEditingChange(null);
      }
      announceDataPanelStatus(t("tableDeleted", { name }), {
        tone: "success",
      });
    } catch (error) {
      console.error("DataTable 삭제 실패:", error);
    }
  };

  return (
    <Section
      id="datatable-list"
      title={localize("tableList", "Tables")}
      badge={
        <span className="category-count">
          {t("countItems", { count: collections.length })}
        </span>
      }
      // Navigator's Pages pattern (G6, 사용자): the add action sits in the section header.
      actions={
        <ActionIconButton
          aria-label={localize("addTable", "New table")}
          tooltip={localize("addTable", "New table")}
          onPress={onCreateClick}
        >
          <AddIcon {...iconProps} />
        </ActionIconButton>
      }
      collapsible={false}
    >
      {collections.length === 0 ? (
        <EmptyState
          icon={<Table2 size={32} />}
          message={localize("tableEmpty", "No tables. Add a new table.")}
        />
      ) : (
        <GridList
          className="datatable-tree"
          aria-label={localize("tableList", "Tables")}
          selectionMode="single"
          selectionBehavior="replace"
          selectedKeys={editingId ? [editingId] : []}
          // Selecting a row opens it (G6, 사용자 「선택시 바로 테이블 edit 으로」) — Enter too.
          onSelectionChange={(keys) => {
            if (keys === "all") return;
            const key = [...keys][0];
            if (key !== undefined && String(key) !== editingId)
              onEditingChange(String(key));
          }}
          onAction={(key) => onEditingChange(String(key))}
        >
          {collections.map((table) => {
            const linkedApi = findLinkedApi(table, apiEndpoints);
            const status = resolveCollectionBadgeStatus(
              table,
              apiEndpoints,
              apiRuns,
            );
            const rows = status.rows;
            const used = usage.get(table.id) ?? 0;
            const failed = status.state === "error";
            const source = linkedApi
              ? localize("sourceApi", "API")
              : localize("sourceSample", "Sample");
            // Hover text only (G6 수정 10) — the row shows the name; the states stay as data-*.
            const meta = [
              failed
                ? t("runError", { status: status.errorStatus ?? "—" })
                : source,
              t("tableMeta", { fields: table.schema.length, rows }),
              linkedApi?.name,
              t("usedBy", { count: used }),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <GridListItem
                key={table.id}
                id={table.id}
                textValue={table.name}
                className="datatable-tree-item"
                data-empty={rows === 0 || undefined}
                data-error={failed || undefined}
                data-source={linkedApi ? "api" : "local"}
              >
                {({ isSelected, isFocusVisible }) => (
                  <div
                    className={`elementItem ${isSelected ? "active" : ""} ${
                      isFocusVisible ? "focused" : ""
                    }`}
                  >
                    <div className="elementItemIcon">
                      <Table2 {...iconEditProps} />
                    </div>
                    <div className="elementItemLabel" title={meta}>
                      <span className="datatable-tree-name">{table.name}</span>
                    </div>
                    <div
                      className="elementItemActions"
                      ref={(el) => {
                        if (el) actionCells.current.set(table.id, el);
                        else actionCells.current.delete(table.id);
                      }}
                    >
                      <Button
                        className="iconButton"
                        onPress={() => openSettings(table.id)}
                        aria-label={`${localize("tableSettings", "Table settings")} ${table.name}`}
                      >
                        <Settings2 {...iconEditProps} />
                      </Button>
                      <Button
                        className="iconButton"
                        onPress={() => setPendingDeleteId(table.id)}
                        aria-label={`${localize("delete", "Delete")} ${table.name}`}
                      >
                        <DeleteIcon {...iconEditProps} />
                      </Button>
                    </div>
                  </div>
                )}
              </GridListItem>
            );
          })}
        </GridList>
      )}

      {settingsTable && (
        <TableSettingsPopover
          table={settingsTable}
          triggerRef={settingsTriggerRef}
          isOpen
          onOpenChange={(open) => {
            if (!open) setSettingsId(null);
          }}
        />
      )}
      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title={localize("deleteTitle", "Delete")}
        message={t("deleteMessage", {
          name: collections.find((c) => c.id === pendingDeleteId)?.name ?? "",
        })}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </Section>
  );
}
