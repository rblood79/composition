/**
 * VariableList — Data 탭 Variables (ADR-214 Phase 5 → ADR-288 Decision 3 · 사용자 결정 2).
 *
 * 프로젝트 변수를 공용 `VariableTable` 에서 그 자리에서 편집한다 (이름 · 타입 · 시작값 · 유지 ·
 * 사용처 · ⋮ 삭제). 쓰기는 전부 store 의 `updateVariable` → `define_variable` → sink → 문서 명령
 * 한 step (이름 변경은 sink 가 `renameVariable` 을 묶어 `{{ old }}` 참조까지 따라간다).
 *
 * 본문은 목록 열에서 고른 묶음 하나 (사용자 2026-10-29 「tables · apis 처럼 left-list」 — Figma
 * Variables 의 묶음 목록 + 표): `project` 는 프로젝트 변수 (편집 가능), 페이지 묶음은 그 페이지 ·
 * 요소 변수 색인 (읽기 전용 행 — 소유자 열 · 행 = 소유자로 이동, 편집은 소유자의 State 절에서만)
 * 과 구 data store 의 `scope:"page"` 변수 (legacy — 「페이지로 이관」). 묶음 목록은
 * `VariableGroupList`.
 */

import { parseDateValue } from "../../../../../../../packages/shared/src/state/dateValue";
import { Variable } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { translateKey, useI18n, useOptionalI18n } from "../../../../i18n";
import type { Variable as VariableType } from "../../../../types/builder/data.types";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { reportCatalogCommandError } from "../../../catalogRuntime/commandRunner";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ConfirmDialog } from "../../../components/overlay";
import { Section } from "../../../components/panel/Section";
import {
  VariableTable,
  type VariableTableRow,
} from "../../../components/variables/VariableTable";
import {
  useDataStore,
  useProjectVariableDefs,
  useVariables,
} from "../../../stores/data";
import { useDataPanelStatusStore } from "../stores/dataPanelStatusStore";
import type { VariableGroupId } from "../types/editorTypes";
import {
  useDataVariablesHost,
  type VariableIndexGroup,
} from "../usage/dataVariablesHost";

const TYPE_OPTIONS = [
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
].map((type) => ({ value: type, label: type }));

interface VariableListProps {
  /** The list column's row — the project's own variables or a page's (read-only index). */
  group?: VariableGroupId;
}

export function VariableList({ group = "project" }: VariableListProps) {
  const i18n = useOptionalI18n();
  const { t: tr } = useI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const i18nT = i18n?.t;
  const t = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      i18nT ? i18nT(`datatable.${key}`, params) : key,
    [i18nT],
  );
  const variables = useVariables();
  const updateVariable = useDataStore((state) => state.updateVariable);
  const deleteVariable = useDataStore((state) => state.deleteVariable);
  const announce = useDataPanelStatusStore((state) => state.announce);
  const host = useDataVariablesHost();

  const projectVariables = useMemo(
    () => variables.filter((v) => !v.owner || v.owner.kind === "project"),
    [variables],
  );
  const legacyPageVariables = useMemo(
    () => variables.filter((v) => v.owner?.kind === "page"),
    [variables],
  );
  const projectDefs = useProjectVariableDefs();
  const {
    usageCount,
    groups: indexGroups,
    pageTitle,
  } = host.useView(legacyPageVariables, projectDefs);
  const jumpToOwner = host.jumpToOwner;

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const setError = useCallback((id: string, message: string | null) => {
    setErrors((prev) =>
      prev[id] === message ? prev : { ...prev, [id]: message },
    );
  }, []);

  /** A write through the store (one document step); a refusal shows its reason. */
  const write = useCallback(
    async (id: string, updates: Partial<VariableType>) => {
      try {
        await updateVariable(id, updates);
        setError(id, null);
      } catch (error) {
        reportCatalogCommandError(error);
      }
    },
    [setError, updateVariable],
  );

  const pageGroup =
    group === "project"
      ? undefined
      : indexGroups.find((entry) => entry.pageId === group);
  const indexEntries = useMemo(
    () =>
      (pageGroup ? [pageGroup] : []).flatMap((owner) =>
        owner.entries.flatMap((item) =>
          item.kind === "doc" ? [{ group: owner, item }] : [],
        ),
      ),
    [pageGroup],
  );

  const rows = useMemo<VariableTableRow[]>(() => {
    if (group !== "project")
      return indexEntries.map(({ group: owner, item }) => ({
        id: item.entry.def.id,
        name: item.entry.def.name,
        type: item.entry.def.type,
        defaultValue: item.entry.def.defaultValue,
        usage: usageCount(item.entry.def.id),
        readOnly: { owner: item.ownerLabel ?? owner.title },
      }));
    return projectVariables.map((variable) => ({
      id: variable.id,
      name: variable.name,
      type: variable.type,
      defaultValue: variable.defaultValue,
      usage: usageCount(variable.id),
      persist: variable.persist ?? false,
      error: errors[variable.id] ?? null,
    }));
  }, [errors, group, indexEntries, projectVariables, usageCount]);

  const onRename = useCallback(
    (id: string, raw: string) => {
      const name = raw.trim();
      if (!name) return;
      void write(id, { name });
    },
    [write],
  );
  const onType = useCallback(
    (id: string, type: string) =>
      void write(id, { type: type as VariableType["type"] }),
    [write],
  );
  const onDefault = useCallback(
    (id: string, raw: string) => {
      const variable = projectVariables.find((v) => v.id === id);
      if (!variable) return;
      if (variable.type === "boolean")
        return void write(id, { defaultValue: raw === "true" });
      if (variable.type === "date") {
        const text = raw.trim();
        if (text === "") return void write(id, { defaultValue: undefined });
        if (!parseDateValue(text))
          return setError(
            id,
            tr("propertiesPanel.stateDefaultInvalid", { type: "date" }),
          );
        return void write(id, { defaultValue: text });
      }
      if (variable.type === "number") {
        const text = raw.trim();
        if (text === "") return void write(id, { defaultValue: undefined });
        const n = Number(text);
        if (!Number.isFinite(n))
          return setError(
            id,
            tr("propertiesPanel.stateDefaultInvalid", { type: "number" }),
          );
        return void write(id, { defaultValue: n });
      }
      void write(id, { defaultValue: raw });
    },
    [projectVariables, setError, tr, write],
  );
  // The screen's one JSON type (2026-10-29): the saved value decides `array` · `object` — one step.
  const onJsonDefault = useCallback(
    (id: string, value: unknown) => {
      const variable = projectVariables.find((v) => v.id === id);
      const type =
        value === undefined
          ? variable?.type
          : Array.isArray(value)
            ? "array"
            : "object";
      void write(
        id,
        type && type !== variable?.type
          ? { type, defaultValue: value }
          : { defaultValue: value },
      );
    },
    [projectVariables, write],
  );
  const onPersist = useCallback(
    (id: string, persist: boolean) => void write(id, { persist }),
    [write],
  );
  const onGoToOwner = useCallback(
    (id: string) => {
      const found = indexEntries.find(({ item }) => item.entry.def.id === id);
      if (found) jumpToOwner(found.item.entry);
    },
    [indexEntries, jumpToOwner],
  );

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

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  const legacyEntries = (pageGroup ? [pageGroup] : []).flatMap((owner) =>
    owner.entries.flatMap((item) =>
      item.kind === "legacy" ? [{ group: owner, item }] : [],
    ),
  );

  const renderLegacy = ({
    item,
  }: {
    group: VariableIndexGroup;
    item: Extract<VariableIndexGroup["entries"][number], { kind: "legacy" }>;
  }) => {
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
  };

  const isProject = group === "project";

  return (
    <Section
      id="variable-list"
      title={
        isProject
          ? tr("propertiesPanel.stateProjectVariables")
          : (pageGroup?.title ?? pageTitle(group))
      }
      badge={
        <span className="category-count">
          {t("countItems", { count: rows.length })}
        </span>
      }
      // (The add action is the list column's header + — `VariableGroupList`.)
      collapsible={false}
    >
      <div data-variable-group={isProject ? "project" : "page"}>
        {rows.length === 0 ? (
          isProject || legacyEntries.length === 0 ? (
            <EmptyState
              icon={<Variable size={32} />}
              message={localize(
                "variableEmpty",
                "No variables. Add a new variable.",
              )}
            />
          ) : null
        ) : (
          <VariableTable
            owner="project"
            rows={rows}
            label={localize("variableList", "Variable List")}
            typeOptions={TYPE_OPTIONS}
            onRename={onRename}
            onType={onType}
            onDefault={onDefault}
            onJsonDefault={onJsonDefault}
            onPersist={onPersist}
            onRemove={setPendingDeleteId}
            onGoToOwner={onGoToOwner}
          />
        )}
      </div>

      {legacyEntries.length > 0 && (
        <div className="list-subgroup" data-variable-group="legacy">
          <div className="list-subgroup-header">
            <span className="list-subgroup-title">
              {localize("variableLegacyPage", "Legacy page variable")}
            </span>
            <span className="list-subgroup-count">
              {t("countItems", { count: legacyEntries.length })}
            </span>
          </div>
          <div className="list-group" role="list">
            {legacyEntries.map(renderLegacy)}
          </div>
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
