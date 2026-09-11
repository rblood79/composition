/**
 * DataTableList - DataTable 목록 컴포넌트
 *
 * ADR-212 Phase 1 — 항목은 RAC `GridList` 행 (키보드로 열림 · 행 안 버튼은 Arrow 로 도달,
 * A5) 이고 배지는 필드 수 · 행 수 · 소스 (샘플/API) · 사용처 N (152 역참조) · 0행 · 마지막
 * 실행 오류 (UI-6, Main 아트보드). 세 곳 (목록 · 편집기 · 캔버스 배지) 이 같은 값을 보이는
 * 규칙의 첫 자리.
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 */

import { useMemo, useState } from "react";
import { Table2, SquarePen } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { useDataStore } from "../../../stores/data";
import { useStore } from "../../../stores";
import { EmptyState, Section } from "../../../components";
import { ConfirmDialog } from "../../../components/overlay";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { translateKey, useOptionalI18n } from "../../../../i18n";
import { resolveCollectionUsage } from "../../../../services/ai/data/collectionReadModel";
import { getAiToolReadModel } from "../../../../services/ai/tools/canonicalToolReadModel";
import { announceDataPanelStatus } from "../stores/dataPanelStatusStore";
import type {
  ApiEndpoint,
  DataTable,
} from "../../../../types/builder/data.types";
/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

interface DataTableListProps {
  projectId: string;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  onCreateClick: () => void;
}

/** DataTable 에 연결된 API Endpoint — id 우선 (ADR-152 v2.1) · 이름 fallback */
export function findLinkedApi(
  table: Pick<DataTable, "id" | "name">,
  apiEndpoints: readonly ApiEndpoint[],
): ApiEndpoint | undefined {
  return (
    apiEndpoints.find((api) => api.targetCollectionId === table.id) ??
    apiEndpoints.find(
      (api) => !api.targetCollectionId && api.targetCollection === table.name,
    )
  );
}

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
  // 사용처 N (152 역참조) — 요소가 바뀌면 다시 센다
  const elements = useStore((state) => state.elements);

  // useMemo로 배열 변환 캐싱 (Map 참조가 변경될 때만 재계산)
  const collections = useMemo(
    () => Array.from(dataTablesMap.values()),
    [dataTablesMap],
  );
  const apiEndpoints = useMemo(
    () => Array.from(apiEndpointsMap.values()),
    [apiEndpointsMap],
  );
  const usage = useMemo(() => {
    void elements;
    return resolveCollectionUsage(getAiToolReadModel().elements, collections);
  }, [collections, elements]);

  // Silence unused variable warning
  void projectId;

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
      title={localize("tableList", "Table List")}
      badge={
        <span className="datatable-list-count">
          {t("countItems", { count: collections.length })}
        </span>
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
          className="list-group list-group--stack"
          aria-label={localize("tableList", "Table List")}
          selectionMode="single"
          selectionBehavior="replace"
          selectedKeys={editingId ? [editingId] : []}
          onAction={(key) => onEditingChange(String(key))}
        >
          {collections.map((table) => {
            const linkedApi = findLinkedApi(table, apiEndpoints);
            const lastRun = linkedApi ? apiRuns.get(linkedApi.id) : undefined;
            const rows = table.useMockData
              ? (table.mockData?.length ?? 0)
              : (table.runtimeData?.length ?? table.mockData?.length ?? 0);
            const used = usage.get(table.id) ?? 0;
            const failed = lastRun && !lastRun.ok;
            return (
              <GridListItem
                key={table.id}
                id={table.id}
                textValue={table.name}
                className={({ isSelected }) =>
                  `list-item ${isSelected ? "selected" : ""}`
                }
                data-empty={rows === 0 || undefined}
                data-error={failed || undefined}
              >
                <div className="list-item-icon">
                  <Table2 {...iconProps} />
                </div>
                <div className="list-item-content">
                  <div className="list-item-name">{table.name}</div>
                  <div className="list-item-meta">
                    <span>
                      {t("tableMeta", { fields: table.schema.length, rows })}
                    </span>
                    {linkedApi ? <span> · {linkedApi.name}</span> : null}
                    <span className="list-item-usage">
                      {" "}
                      · {t("usedBy", { count: used })}
                    </span>
                  </div>
                </div>
                {failed ? (
                  <span className="list-item-badge error">
                    {t("runError", {
                      status: lastRun.response?.status ?? "—",
                    })}
                  </span>
                ) : (
                  <span
                    className={`list-item-badge ${linkedApi ? "api" : "local"}`}
                  >
                    {linkedApi
                      ? localize("sourceApi", "API")
                      : localize("sourceSample", "Sample")}
                  </span>
                )}
                <div className="list-item-actions">
                  <Button
                    className="iconButton"
                    onPress={() => onEditingChange(table.id)}
                    aria-label={`${localize("edit", "Edit")} ${table.name}`}
                  >
                    <SquarePen {...iconEditProps} />
                  </Button>
                  <Button
                    className="iconButton"
                    onPress={() => setPendingDeleteId(table.id)}
                    aria-label={`${localize("delete", "Delete")} ${table.name}`}
                  >
                    <DeleteIcon {...iconEditProps} />
                  </Button>
                </div>
              </GridListItem>
            );
          })}
        </GridList>
      )}

      <Button
        className="control-button"
        data-variant="add"
        onPress={onCreateClick}
      >
        <AddIcon {...iconProps} />
        <span>{localize("addTable", "Add Table")}</span>
      </Button>
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
