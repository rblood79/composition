/**
 * VariableList — Data 탭 Variables (ADR-214 Phase 5, VarsIndex 아트보드).
 *
 * 두 부분:
 * 1. **프로젝트 변수** — 편집 가능 (생성 · 편집 · 삭제는 종전 `define_variable` 경로, 편집 UI 는 스냅 패널)
 * 2. **페이지 · 컴포넌트 인덱스** — canonical 문서의 `state` 정의 전부 (소유자 열 + 읽기 전용).
 *    행 클릭 → 소유자로 점프 (페이지 활성화 · 요소 선택 · Properties 상태 절 스크롤 —
 *    `useStateSectionFocus`). 편집은 소유자 (Properties) 에서만 — 여기서 canonical 을 만지지 않는다.
 *
 * 사용처 배지 (`collectVariableUsages`) 는 Properties 삭제 확인과 같은 함수를 읽는다.
 * 구 data store 의 `scope:"page"` 변수 (Phase 1 lazy owner) 는 인덱스의 해당 페이지 아래 legacy 로
 * 보이고 "페이지로 이관" 이 canonical page `state` 로 옮긴다 (같은 id 유지 — setState.variableId 축).
 */

import { useCallback, useMemo, useState } from "react";
import { Variable, SquarePen, ArrowUpRight } from "lucide-react";
import type { VisibleVariable } from "@composition/shared";
import {
  useDataStore,
  useProjectVariableDefs,
  useVariables,
} from "../../../stores/data";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import { useDataPanelStatusStore } from "../stores/dataPanelStatusStore";
import { EmptyState, Section } from "../../../components";
import { ConfirmDialog } from "../../../components/overlay";
import type { Variable as VariableType } from "../../../../types/builder/data.types";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { translateKey, useOptionalI18n } from "../../../../i18n";
import {
  useDataVariablesHost,
  type VariableIndexGroup,
} from "../usage/dataVariablesHost";
/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

interface VariableListProps {
  projectId: string;
}


export function VariableList({ projectId }: VariableListProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  /** 보간이 필요한 문구 — provider 밖(격리 렌더)이면 키를 그대로 돌려준다. */
  const i18nT = i18n?.t;
  const t = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      i18nT ? i18nT(`datatable.${key}`, params) : key,
    [i18nT],
  );
  const variables = useVariables();
  const deleteVariable = useDataStore((state) => state.deleteVariable);
  const announce = useDataPanelStatusStore((state) => state.announce);
  const host = useDataVariablesHost();

  // Editor Store 액션
  const editorMode = useDataTableEditorStore((state) => state.mode);
  const openVariableEditor = useDataTableEditorStore(
    (state) => state.openVariableEditor,
  );

  // 현재 편집 중인 Variable ID (하이라이트용)
  const editingVariableId =
    editorMode?.type === "variable-edit" ? editorMode.variableId : null;

  const projectVariables = useMemo(
    () => variables.filter((v) => !v.owner || v.owner.kind === "project"),
    [variables],
  );
  const legacyPageVariables = useMemo(
    () => variables.filter((v) => v.owner?.kind === "page"),
    [variables],
  );
  const projectDefs = useProjectVariableDefs();
  // 문서 쪽 (페이지 · 요소 변수 인덱스 · 사용처) 은 host — 구 canonical 문서 또는 catalog 문서
  const {
    usageCount,
    groups: indexGroups,
    pageTitle,
  } = host.useView(legacyPageVariables, projectDefs);
  const jumpToOwner = host.jumpToOwner;

  const migrateLegacyToPage = useCallback(
    async (variable: VariableType) => {
      if (variable.owner?.kind !== "page") return;
      const pageId = variable.owner.pageId;
      try {
        if (!(await host.migrateLegacyToPage(variable))) return;
        announce(
          t("variableMigrated", {
            name: variable.name,
            page: pageTitle(pageId),
          }),
        );
      } catch (error) {
        console.error("Variable 이관 실패:", error);
      }
    },
    [announce, host, pageTitle, t],
  );

  const openVariableCreator = useDataTableEditorStore(
    (state) => state.openVariableCreator,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // 생성은 목록 옆에 스냅되는 패널에서 (리서치 U2 — window.prompt 제거)
  const handleCreate = () => {
    openVariableCreator(projectId);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id) return;
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
          {" · "}
          {t("variableUsageCount", { count: usageCount(variable.id) })}
        </div>
      </div>
      <div className="list-item-actions">
        <button
          type="button"
          className="iconButton"
          onClick={(e) => handleEdit(variable.id, e)}
          title={localize("edit", "Edit")}
          aria-label={localize("edit", "Edit")}
        >
          <SquarePen {...iconEditProps} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="iconButton"
          onClick={(e) => handleDelete(variable.id, e)}
          title={localize("delete", "Delete")}
          aria-label={localize("delete", "Delete")}
        >
          <DeleteIcon {...iconEditProps} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const renderIndexEntry = (item: VariableIndexGroup["entries"][number]) => {
    if (item.kind === "legacy") {
      const { variable, conflict } = item;
      return (
        <div
          key={`legacy-${variable.id}`}
          role="listitem"
          className="list-item variable-index-item"
          data-legacy-page-variable={variable.id}
        >
          <div className="list-item-icon">
            <Variable {...iconProps} />
          </div>
          <div className="list-item-content">
            <div className="list-item-name">{variable.name}</div>
            <div className="list-item-meta">
              {variable.type} ·{" "}
              {localize("variableLegacyPage", "Legacy page variable")}
            </div>
          </div>
          <div className="list-item-actions">
            <button
              type="button"
              className="control-button"
              disabled={conflict}
              title={
                conflict
                  ? localize(
                      "variableMigrateConflict",
                      "Name already exists on the page",
                    )
                  : undefined
              }
              onClick={() => void migrateLegacyToPage(variable)}
            >
              {localize("variableMigrateToPage", "Move to page")}
            </button>
          </div>
        </div>
      );
    }
    const { entry, ownerLabel } = item;
    const implicit = entry.def.source?.prop;
    return (
      <div
        key={entry.def.id}
        role="listitem"
        className="list-item variable-index-item"
        data-variable-id={entry.def.id}
        data-owner-kind={entry.owner.kind}
        onClick={() => jumpToOwner(entry)}
        title={localize("variableJumpToOwner", "Edit at owner")}
      >
        <div className="list-item-icon">
          <Variable {...iconProps} />
        </div>
        <div className="list-item-content">
          <div className="list-item-name">{entry.def.name}</div>
          <div className="list-item-meta">
            {entry.def.type}
            {implicit
              ? ` · ${localize("variableImplicit", "implicit")} ${implicit}`
              : ""}
            {" · "}
            {t("variableUsageCount", { count: usageCount(entry.def.id) })}
          </div>
        </div>
        <span className={`list-item-badge ${entry.owner.kind}`}>
          {ownerLabel ?? localize("page", "Page")}
        </span>
        <div className="list-item-actions">
          <ArrowUpRight {...iconEditProps} />
        </div>
      </div>
    );
  };

  const indexCount = indexGroups.reduce(
    (sum, group) => sum + group.entries.length,
    0,
  );

  return (
    <Section
      id="variable-list"
      title={localize("variableList", "Variable List")}
      badge={
        <span className="datatable-list-count">
          {t("countItems", { count: projectVariables.length + indexCount })}
        </span>
      }
      collapsible={false}
    >
      {/* 프로젝트 변수 — 편집 가능 */}
      <div className="list-subgroup" data-variable-group="project">
        <div className="list-subgroup-header">
          <span className="list-subgroup-title">
            {localize("variableProjectGroup", "Project · editable")}
          </span>
          <span className="list-subgroup-count">
            {t("countItems", { count: projectVariables.length })}
          </span>
        </div>
        {projectVariables.length === 0 ? (
          <EmptyState
            icon={<Variable size={32} />}
            message={localize(
              "variableEmpty",
              "No variables. Add a new variable.",
            )}
          />
        ) : (
          <div className="list-group" role="list">
            {projectVariables.map(renderVariableItem)}
          </div>
        )}
        <button
          type="button"
          className="control-button"
          data-variant="add"
          onClick={handleCreate}
        >
          <AddIcon {...iconProps} />
          <span>{localize("addVariable", "Add Variable")}</span>
        </button>
      </div>

      {/* 페이지 · 컴포넌트 인덱스 — 소유자에서 편집 */}
      {indexGroups.length > 0 && (
        <div className="list-subgroup" data-variable-group="index">
          <div className="list-subgroup-header">
            <span className="list-subgroup-title">
              {localize(
                "variableIndexGroup",
                "Page · component index · edit at owner",
              )}
            </span>
            <span className="list-subgroup-count">
              {t("countItems", { count: indexCount })}
            </span>
          </div>
          {indexGroups.map((group) => (
            <div
              key={group.pageId}
              className="list-subgroup"
              data-index-page={group.pageId}
            >
              <div className="list-subgroup-header">
                <span className="list-subgroup-title">{group.title}</span>
                <span className="list-subgroup-count">
                  {t("countItems", { count: group.entries.length })}
                </span>
              </div>
              <div className="list-group" role="list">
                {group.entries.map(renderIndexEntry)}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title={localize("deleteTitle", "Delete")}
        message={t("deleteMessage", {
          name: variables.find((v) => v.id === pendingDeleteId)?.name ?? "",
        })}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </Section>
  );
}
