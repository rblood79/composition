import { memo, useCallback, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, Minus } from "lucide-react";
import { useI18n } from "@/i18n";
import { definitionTypeName } from "../../../../../../../packages/shared/src/catalog/commands/context";
import type {
  NodeId,
  StateVariableEntry,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  CATALOG_VARIABLE_TYPES,
  catalogAncestorVariables,
  catalogNextVariableName,
  catalogOwnVariables,
  catalogParseVariableValue,
  catalogVariableCommands,
  catalogVariableNameConflict,
  catalogVariableOwner,
  catalogVariableUsageCount,
  type CatalogVariableType,
} from "../../../catalogRuntime/stateVariables";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import {
  PropertyInput,
  PropertySection,
  PropertySelect,
} from "../../../components";
import { ConfirmDialog } from "../../../components/overlay";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import "../state/StateSection.css";

const AddIcon = ACTION_ICONS.add;
const NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;
const TYPE_OPTIONS = CATALOG_VARIABLE_TYPES.map((type) => ({
  value: type,
  label: type,
}));

interface StateView {
  isPage: boolean;
  own: StateVariableEntry[];
  ancestors: { variable: StateVariableEntry; owner: string }[];
  usage: Record<string, number>;
}

/**
 * ADR-248 Phase 4e-4: the State section over the catalog document — a node's variables (a page
 * body's are its page's): add, rename (unique on the visibility chain — refused with a message,
 * never written), type (the default resets), default, delete (the confirmation counts the
 * interactions that set it; they go with it). Each edit is one step. The catalog document has
 * scalar variables only, and no implicit (RAC prop) state.
 */
export const CatalogStateSection = memo(function CatalogStateSection({
  nodeId,
}: {
  nodeId: NodeId;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const owner = catalogVariableOwner(graph, nodeId);

  const ownerLabel = useCallback(
    (ownerId: string): string => {
      const entry = graph.getEntry(ownerId);
      if (entry?.kind === "page")
        return `${t("propertiesPanel.stateOwnerPage")} ${entry.name}`;
      if (entry?.kind === "node")
        return entry.name || definitionTypeName(graph, entry.definitionId);
      return ownerId;
    },
    [graph, t],
  );
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const viewKey = useSyncExternalStore(subscribe, () => {
    const own = catalogOwnVariables(graph, owner);
    return JSON.stringify({
      isPage: owner !== nodeId,
      own,
      ancestors: catalogAncestorVariables(graph, owner).map((variable) => ({
        variable,
        owner: ownerLabel(variable.ownerId),
      })),
      usage: Object.fromEntries(
        own.map((variable) => [
          variable.id,
          catalogVariableUsageCount(graph, variable.id),
        ]),
      ),
    } satisfies StateView);
  });
  const view = JSON.parse(viewKey) as StateView;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StateVariableEntry | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setError = useCallback((id: string, message: string | null) => {
    setErrors((prev) => {
      if (message === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: message };
    });
  }, []);

  // Field controls keep their first onChange (memo comparators skip it), so every handler reads
  // the committed variable when it runs instead of the render's copy.
  const current = useCallback(
    (id: string): StateVariableEntry | undefined => {
      const entry = graph.getEntry(id);
      return entry?.kind === "stateVariable" ? entry : undefined;
    },
    [graph],
  );

  const add = useCallback(() => {
    const name = catalogNextVariableName(graph, owner);
    if (run(catalogVariableCommands.add(owner, name, workspace.newId))) {
      const added = catalogOwnVariables(graph, owner).find(
        (variable) => variable.name === name,
      );
      if (added) setExpandedId(added.id);
    }
  }, [graph, owner, run, workspace]);

  const rename = useCallback(
    (id: string, raw: string) => {
      const variable = current(id);
      if (!variable) return;
      const name = raw.trim();
      if (name === variable.name) return setError(variable.id, null);
      if (!NAME_PATTERN.test(name))
        return setError(variable.id, t("propertiesPanel.stateNameInvalid"));
      const conflict = catalogVariableNameConflict(
        graph,
        owner,
        name,
        variable.id,
      );
      if (conflict)
        return setError(
          variable.id,
          t("propertiesPanel.stateNameConflict", {
            name,
            owner: ownerLabel(conflict.ownerId),
          }),
        );
      setError(variable.id, null);
      run(catalogVariableCommands.rename(variable, name));
    },
    [current, graph, owner, ownerLabel, run, setError, t],
  );

  const changeType = useCallback(
    (id: string, type: CatalogVariableType) => {
      const variable = current(id);
      if (variable && variable.valueType !== type)
        run(catalogVariableCommands.setType(variable, type));
    },
    [current, run],
  );

  const changeDefault = useCallback(
    (id: string, raw: string) => {
      const variable = current(id);
      if (!variable) return;
      const type = variable.valueType as CatalogVariableType;
      const value = catalogParseVariableValue(type, raw);
      if (value === undefined)
        return setError(
          variable.id,
          t("propertiesPanel.stateDefaultInvalid", { type }),
        );
      setError(variable.id, null);
      if (value !== variable.defaultValue)
        run(catalogVariableCommands.setDefault(variable, value));
    },
    [current, run, setError, t],
  );

  const confirmDelete = useCallback(() => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    run(catalogVariableCommands.remove(target.id));
    setError(target.id, null);
  }, [pendingDelete, run, setError]);

  const renderRow = (variable: StateVariableEntry) => {
    const expanded = expandedId === variable.id;
    const usages = view.usage[variable.id] ?? 0;
    const error = errors[variable.id];
    return (
      <div
        key={variable.id}
        className="state-def"
        data-expanded={expanded || undefined}
        data-variable-id={variable.id}
      >
        <div className="list-row">
          <div className="list-row__body">
            <button
              type="button"
              className="list-row__action state-def-toggle"
              onClick={() => setExpandedId(expanded ? null : variable.id)}
              aria-expanded={expanded}
              aria-label={variable.name}
            >
              {expanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
            </button>
            <span className="list-row__label state-def-name">
              {variable.name}
            </span>
            <span className="list-row__meta state-def-meta">
              {variable.valueType}
            </span>
            {usages > 0 && (
              <span className="list-row__meta state-def-usage">
                {t("propertiesPanel.stateUsageCount", { count: usages })}
              </span>
            )}
          </div>
          <div className="list-row__actions">
            <button
              type="button"
              className="list-row__action state-def-remove"
              onClick={() => setPendingDelete(variable)}
              aria-label={t("common.delete")}
            >
              <Minus size={12} />
            </button>
          </div>
        </div>
        {expanded && (
          <div className="list-row__fields state-def-editor">
            <div className="fieldset-row" data-wide="true">
              <PropertyInput
                label={t("propertiesPanel.stateName")}
                value={variable.name}
                onChange={(value) => rename(variable.id, value)}
              />
            </div>
            <div className="fieldset-row">
              <PropertySelect
                label={t("propertiesPanel.stateType")}
                value={variable.valueType}
                options={TYPE_OPTIONS}
                translateOptions={false}
                onChange={(value) =>
                  changeType(variable.id, value as CatalogVariableType)
                }
              />
              {variable.valueType === "boolean" ? (
                <PropertySelect
                  label={t("propertiesPanel.stateDefault")}
                  value={String(variable.defaultValue === true)}
                  options={[
                    { value: "false", label: "false" },
                    { value: "true", label: "true" },
                  ]}
                  translateOptions={false}
                  onChange={(value) => changeDefault(variable.id, value)}
                />
              ) : (
                <PropertyInput
                  label={t("propertiesPanel.stateDefault")}
                  value={String(variable.defaultValue)}
                  onChange={(value) => changeDefault(variable.id, value)}
                />
              )}
            </div>
          </div>
        )}
        {error && (
          <p className="state-def-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <div data-state-owner={owner}>
      <PropertySection
        title={t("propertiesPanel.stateSection")}
        badge={<span className="state-section-count">{view.own.length}</span>}
      >
        <fieldset className="properties-aria state-group" data-group="explicit">
          <legend className="fieldset-legend">
            {t(
              view.isPage
                ? "propertiesPanel.statePageTitle"
                : "propertiesPanel.stateExplicitTitle",
            )}
          </legend>
          {view.own.map(renderRow)}
          <button
            type="button"
            className="control-button"
            data-variant="add"
            onClick={add}
          >
            <AddIcon size={14} />
            <span>{t("propertiesPanel.stateAdd")}</span>
          </button>
        </fieldset>
        {view.ancestors.length > 0 && (
          <fieldset
            className="properties-aria state-group"
            data-group="ancestors"
          >
            <legend className="fieldset-legend">
              {t("propertiesPanel.stateAncestorTitle")}
            </legend>
            {view.ancestors.map(({ variable, owner: label }) => (
              <div key={variable.id} className="list-row state-ancestor-row">
                <div className="list-row__body">
                  <span className="list-row__label state-def-name">
                    {variable.name}
                  </span>
                  <span className="list-row__meta state-def-meta">
                    {variable.valueType} · {label}
                  </span>
                </div>
              </div>
            ))}
          </fieldset>
        )}
      </PropertySection>
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={t("propertiesPanel.stateDeleteTitle")}
        message={t("propertiesPanel.stateDeleteSettersMessage", {
          name: pendingDelete?.name ?? "",
          count: pendingDelete ? (view.usage[pendingDelete.id] ?? 0) : 0,
        })}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
});
