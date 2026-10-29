/**
 * VariableGroupList — the Variables tab's list column (사용자 2026-10-29 「tables · apis 와는 다르게
 * variables 는 left-list 구조가 아니다」 → 결정 「변수 묶음 목록」, Figma Variables 어법).
 *
 * Rows are groups, not variables: the project's own variables, then each page that has page ·
 * element variables (the index `DataVariablesHost.useView` already groups by page). Selecting a
 * row opens that group's table in the Data body (`openVariables(projectId, group)`); the table
 * itself is `VariableList`. Same row pattern as the table and API lists (Navigator
 * `.elementItem`), the add action in the section header (project variables).
 */

import { File, Variable } from "lucide-react";
import { useMemo } from "react";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { translateKey, useI18n, useOptionalI18n } from "../../../../i18n";
import { iconEditProps, iconProps } from "../../../../utils/ui/uiConstants";
import { Section } from "../../../components/panel/Section";
import { ActionIconButton } from "../../../components/ui/ActionIconButton";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useProjectVariableDefs, useVariables } from "../../../stores/data";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import type { VariableGroupId } from "../types/editorTypes";
import { useDataVariablesHost } from "../usage/dataVariablesHost";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

interface VariableGroupListProps {
  projectId: string;
}

interface GroupRow {
  id: VariableGroupId;
  label: string;
  count: number;
}

export function VariableGroupList({ projectId }: VariableGroupListProps) {
  const i18n = useOptionalI18n();
  const { t: tr } = useI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const t = (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => (i18n ? i18n.t(`datatable.${key}`, params) : key);

  const variables = useVariables();
  const projectDefs = useProjectVariableDefs();
  const projectCount = useMemo(
    () =>
      variables.filter((v) => !v.owner || v.owner.kind === "project").length,
    [variables],
  );
  const legacyPageVariables = useMemo(
    () => variables.filter((v) => v.owner?.kind === "page"),
    [variables],
  );
  const { groups } = useDataVariablesHost().useView(
    legacyPageVariables,
    projectDefs,
  );

  const rows: GroupRow[] = [
    {
      id: "project",
      label: tr("propertiesPanel.stateProjectVariables"),
      count: projectCount,
    },
    ...groups.map((group) => ({
      id: group.pageId,
      label: group.title,
      count: group.entries.length,
    })),
  ];

  const mode = useDataTableEditorStore((state) => state.mode);
  const openVariables = useDataTableEditorStore((state) => state.openVariables);
  const openVariableCreator = useDataTableEditorStore(
    (state) => state.openVariableCreator,
  );
  const selected =
    mode?.type === "variables" ? (mode.group ?? "project") : null;

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Section
      id="variable-group-list"
      title={localize("variableList", "Variable List")}
      badge={
        <span className="category-count">
          {t("countItems", { count: total })}
        </span>
      }
      // Navigator's Pages pattern (G6): the add action sits in the section header.
      actions={
        <ActionIconButton
          aria-label={localize("addVariable", "Add Variable")}
          tooltip={localize("addVariable", "Add Variable")}
          onPress={() => openVariableCreator(projectId)}
        >
          <AddIcon {...iconProps} />
        </ActionIconButton>
      }
      collapsible={false}
    >
      <GridList
        className="datatable-tree"
        aria-label={localize("variableList", "Variable List")}
        selectionMode="single"
        selectionBehavior="replace"
        selectedKeys={selected ? [selected] : []}
        // Selecting a row opens its table (G6) — Enter too.
        onSelectionChange={(keys) => {
          if (keys === "all") return;
          const key = [...keys][0];
          if (key !== undefined && String(key) !== selected)
            openVariables(projectId, String(key));
        }}
        onAction={(key) => openVariables(projectId, String(key))}
      >
        {rows.map((row) => (
          <GridListItem
            key={row.id}
            id={row.id}
            textValue={row.label}
            className="datatable-tree-item"
            data-variable-group={row.id === "project" ? "project" : "page"}
          >
            {({ isSelected, isFocusVisible }) => (
              <div
                className={`elementItem ${isSelected ? "active" : ""} ${
                  isFocusVisible ? "focused" : ""
                }`}
              >
                <div className="elementItemIcon">
                  {row.id === "project" ? (
                    <Variable {...iconEditProps} />
                  ) : (
                    <File {...iconEditProps} />
                  )}
                </div>
                <div className="elementItemLabel">
                  <span className="datatable-tree-name">{row.label}</span>
                  <span className="datatable-tree-meta">{row.count}</span>
                </div>
              </div>
            )}
          </GridListItem>
        ))}
      </GridList>
    </Section>
  );
}
