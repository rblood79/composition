/**
 * DataTableList - DataTable 목록 컴포넌트
 *
 * DataTable CRUD 및 목록 표시
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 */

import { useMemo } from "react";
import { Table2, Plus, Edit2, Link } from "lucide-react";
import { Button } from "react-aria-components";
import { useDataStore } from "../../../stores/data";
import { Section } from "../../../components";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";

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
    if (!confirm("정말 삭제하시겠습니까?")) return;

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
      title="Table List"
      badge={
        <span className="datatable-list-count">{collections.length}개</span>
      }
      collapsible={false}
    >
      {collections.length === 0 ? (
        <div className="datatable-empty">
          <Table2 size={32} className="datatable-empty-icon" />
          <p className="datatable-empty-text">
            데이터 테이블이 없습니다.
            <br />새 테이블을 추가하세요.
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
                    {table.schema.length}개 필드 · {table.mockData?.length || 0}
                    개 행
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
                    title="편집"
                  >
                    <Edit2 {...iconEditProps} />
                  </button>
                  <button
                    type="button"
                    className="iconButton"
                    onClick={(e) => handleDelete(table.id, e)}
                    title="삭제"
                  >
                    <DeleteIcon {...iconEditProps} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button className="datatable-add-btn" onPress={onCreateClick}>
        <Plus {...iconProps} />
        <span>Table 추가</span>
      </Button>
    </Section>
  );
}
