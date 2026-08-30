/**
 * DataTableList - DataTable 목록 컴포넌트
 *
 * DataTable CRUD 및 목록 표시
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 */

import { useMemo } from "react";
import { Table2, SquarePen, Link } from "lucide-react";
import { Button } from "react-aria-components";
import { useDataStore } from "../../../stores/data";
import { Section } from "../../../components";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { translateKey, useOptionalI18n } from "../../../../i18n";
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
  const deleteCollection = useDataStore((state) => state.deleteCollection);

  // useMemo로 배열 변환 캐싱 (Map 참조가 변경될 때만 재계산)
  const collections = useMemo(
    () => Array.from(dataTablesMap.values()),
    [dataTablesMap],
  );
  const apiEndpoints = useMemo(
    () => Array.from(apiEndpointsMap.values()),
    [apiEndpointsMap],
  );

  // Silence unused variable warning
  void projectId;

  // DataTable 이름으로 연결된 API Endpoint 찾기
  const getLinkedApi = useMemo(
    () => (tableName: string) => {
      return apiEndpoints.find((api) => api.targetCollection === tableName);
    },
    [apiEndpoints],
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("confirmDelete"))) return;

    try {
      await deleteCollection(id);
      if (editingId === id) {
        onEditingChange(null);
      }
    } catch (error) {
      console.error("DataTable 삭제 실패:", error);
    }
  };

  const handleEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onEditingChange(id);
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
        <div className="datatable-empty">
          <Table2 size={32} className="datatable-empty-icon" />
          <p className="datatable-empty-text">
            {localize("tableEmpty", "No tables")}
            <br />
            {localize("addTableHint", "Add a new table.")}
          </p>
        </div>
      ) : (
        <div className="list-group" role="list">
          {collections.map((table) => {
            const linkedApi = getLinkedApi(table.name);
            return (
              <div
                key={table.id}
                role="listitem"
                className={`list-item ${editingId === table.id ? "selected" : ""}`}
                onClick={() => onEditingChange(table.id)}
              >
                <div className="list-item-icon">
                  <Table2 {...iconProps} />
                </div>
                <div className="list-item-content">
                  <div className="list-item-name">{table.name}</div>
                  <div className="list-item-meta">
                    {t("tableMeta", {
                      fields: table.schema.length,
                      rows: table.mockData?.length || 0,
                    })}
                    {linkedApi && (
                      <>
                        {" "}
                        · <Link size={10} className="linked-api-icon" />{" "}
                        {linkedApi.name}
                      </>
                    )}
                  </div>
                </div>
                <span
                  className={`list-item-badge ${linkedApi ? "api" : "local"}`}
                >
                  {linkedApi ? "API" : "Local"}
                </span>
                <div className="list-item-actions">
                  <button
                    type="button"
                    className="iconButton"
                    onClick={(e) => handleEdit(table.id, e)}
                    title={localize("edit", "Edit")}
                  >
                    <SquarePen {...iconEditProps} />
                  </button>
                  <button
                    type="button"
                    className="iconButton"
                    onClick={(e) => handleDelete(table.id, e)}
                    title={localize("delete", "Delete")}
                  >
                    <DeleteIcon {...iconEditProps} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button
        className="control-button"
        data-variant="add"
        onPress={onCreateClick}
      >
        <AddIcon {...iconProps} />
        <span>{localize("addTable", "Add Table")}</span>
      </Button>
    </Section>
  );
}
