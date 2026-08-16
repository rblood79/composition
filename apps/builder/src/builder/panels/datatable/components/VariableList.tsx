/**
 * VariableList - Variable 목록 컴포넌트
 *
 * 전역/페이지 변수 CRUD 및 목록 표시
 * 편집 UI는 DataTableEditorPanel에서 처리
 */

import { Variable, Edit2 } from "lucide-react";
import { useDataStore, useVariables } from "../../../stores/data";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import { Section } from "../../../components";
import type { Variable as VariableType } from "../../../../types/builder/data.types";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";
/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

interface VariableListProps {
  projectId: string;
}

export function VariableList({ projectId }: VariableListProps) {
  const variables = useVariables();
  const createVariable = useDataStore((state) => state.createVariable);
  const deleteVariable = useDataStore((state) => state.deleteVariable);

  // Editor Store 액션
  const editorMode = useDataTableEditorStore((state) => state.mode);
  const openVariableEditor = useDataTableEditorStore(
    (state) => state.openVariableEditor,
  );

  // 현재 편집 중인 Variable ID (하이라이트용)
  const editingVariableId =
    editorMode?.type === "variable-edit" ? editorMode.variableId : null;

  // Group by scope
  const globalVariables = variables.filter((v) => v.scope === "global");
  const pageVariables = variables.filter((v) => v.scope === "page");

  const handleCreate = async () => {
    const name = prompt("Variable 이름을 입력하세요:");
    if (!name) return;

    try {
      await createVariable({
        name,
        project_id: projectId,
        type: "string",
        defaultValue: "",
        persist: false,
        scope: "global",
      });
    } catch (error) {
      console.error("Variable 생성 실패:", error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      await deleteVariable(id);
    } catch (error) {
      console.error("Variable 삭제 실패:", error);
    }
  };

  const handleEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openVariableEditor(id);
  };

  const renderVariableItem = (variable: VariableType) => (
    <div
      key={variable.id}
      role="listitem"
      className={`list-item ${editingVariableId === variable.id ? "editing" : ""}`}
      onClick={() => openVariableEditor(variable.id)}
    >
      <div className="list-item-icon">
        <Variable {...iconProps} />
      </div>
      <div className="list-item-content">
        <div className="list-item-name">{variable.name}</div>
        <div className="list-item-meta">
          {variable.type}
          {variable.persist && " · localStorage"}
        </div>
      </div>
      <span className={`list-item-badge ${variable.scope}`}>
        {variable.scope}
      </span>
      <div className="list-item-actions">
        <button
          type="button"
          className="iconButton"
          onClick={(e) => handleEdit(variable.id, e)}
          title="편집"
        >
          <Edit2 {...iconEditProps} />
        </button>
        <button
          type="button"
          className="iconButton"
          onClick={(e) => handleDelete(variable.id, e)}
          title="삭제"
        >
          <DeleteIcon {...iconEditProps} />
        </button>
      </div>
    </div>
  );

  return (
    <Section
      id="variable-list"
      title="Variable List"
      badge={<span className="datatable-list-count">{variables.length}개</span>}
      collapsible={false}
    >
      {variables.length === 0 ? (
        <div className="datatable-empty">
          <Variable size={32} className="datatable-empty-icon" />
          <p className="datatable-empty-text">
            변수가 없습니다.
            <br />새 변수를 추가하세요.
          </p>
        </div>
      ) : (
        <>
          {/* Global Variables */}
          {globalVariables.length > 0 && (
            <div className="list-subgroup">
              <div className="list-subgroup-header">
                <span className="list-subgroup-title">Global</span>
                <span className="list-subgroup-count">
                  {globalVariables.length}개
                </span>
              </div>
              <div className="list-group" role="list">
                {globalVariables.map(renderVariableItem)}
              </div>
            </div>
          )}

          {/* Page Variables */}
          {pageVariables.length > 0 && (
            <div className="list-subgroup">
              <div className="list-subgroup-header">
                <span className="list-subgroup-title">Page</span>
                <span className="list-subgroup-count">
                  {pageVariables.length}개
                </span>
              </div>
              <div className="list-group" role="list">
                {pageVariables.map(renderVariableItem)}
              </div>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        className="datatable-add-btn"
        onClick={handleCreate}
      >
        <AddIcon {...iconProps} />
        <span>Variable 추가</span>
      </button>
    </Section>
  );
}
