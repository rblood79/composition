import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronDown, ChevronRight, Minus } from "lucide-react";
import { useI18n } from "@/i18n";
import { definitionTypeName } from "../../../../../../../packages/shared/src/catalog/commands/context";
import type {
  NodeId,
  StateVariableEntry,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { catalogStateSourceValue } from "../../../../../../../packages/shared/src/catalog/runtime/delegatedDom.runtime";
import {
  CATALOG_VARIABLE_TYPES,
  catalogAncestorVariables,
  catalogNodePage,
  catalogNodeStateSources,
  type CatalogStateSource,
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
import { PropertyInput } from "../../../components/property/PropertyInput";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { ConfirmDialog } from "../../../components/overlay";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { useStateSectionFocus } from "../state/stateSectionFocus";
import "../state/StateSection.css";

const AddIcon = ACTION_ICONS.add;
const NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;
const TYPE_OPTIONS = CATALOG_VARIABLE_TYPES.map((type) => ({
  value: type,
  label: type,
}));

interface StateView {
  isPage: boolean;
  /** The node's RAC states (named or not) — the old implicit state. */
  sources: CatalogStateSource[];
  own: StateVariableEntry[];
  ancestors: { variable: StateVariableEntry; owner: string }[];
  usage: Record<string, number>;
}

/**
 * ADR-248 Phase 4e-4: the State section over the catalog document — a node's variables (a page
 * body's are its page's): add, rename (unique on the visibility chain — refused with a message,
 * never written), type (the default resets), default, delete (the confirmation counts the
 * interactions that set it; they go with it). Each edit is one step. A node's RAC states (the
 * old implicit state — Tabs' selected key, a Switch's selection …) take a name and become read-only
 * variables of its page that follow the component at run time.
 */
export const CatalogStateSection = memo(function CatalogStateSection({
  nodeId,
  type,
}: {
  nodeId: NodeId;
  /** The node's component type (its edit contract's): which RAC states it can name. */
  type?: string;
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
      sources:
        owner === nodeId
          ? // (The contract's type — no document read per selection, ADR-246.)
            catalogNodeStateSources(graph, nodeId, type)
          : [],
      own,
      // (The states this node named show in its implicit group, not again as its page's.)
      ancestors: catalogAncestorVariables(graph, owner)
        .filter((variable) => variable.source?.nodeId !== nodeId)
        .map((variable) => ({
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
  // The Data panel's index jumps here: open the variable and bring the section into view.
  const focusRequest = useStateSectionFocus((state) => state.request);
  const rootRef = useRef<HTMLDivElement>(null);
  const handledSeq = useRef(0);
  useEffect(() => {
    if (!focusRequest || focusRequest.seq === handledSeq.current) return;
    if (focusRequest.ownerNodeId !== owner) return;
    handledSeq.current = focusRequest.seq;
    if (focusRequest.variableId) setExpandedId(focusRequest.variableId);
    // The panel's sections are `content-visibility: auto`: a section that just mounted has no
    // height until the browser's next rendering (all of them sat at the panel top, so a scroll
    // now did nothing and they then pushed this one below the fold). Scroll after that frame.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        rootRef.current?.scrollIntoView({ block: "nearest" });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, owner]);
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
        variable.ownerId,
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
    [current, graph, ownerLabel, run, setError, t],
  );

  // Naming a RAC state: a variable of the node's page, its default the component's value now.
  const nameSource = useCallback(
    (source: CatalogStateSource, raw: string) => {
      const errorId = `source:${source.prop}`;
      const name = raw.trim();
      if (!name) return setError(errorId, null);
      const pageId = catalogNodePage(graph, nodeId);
      if (!pageId) return;
      if (!NAME_PATTERN.test(name))
        return setError(errorId, t("propertiesPanel.stateNameInvalid"));
      const conflict = catalogVariableNameConflict(graph, pageId, name);
      if (conflict)
        return setError(
          errorId,
          t("propertiesPanel.stateNameConflict", {
            name,
            owner: ownerLabel(conflict.ownerId),
          }),
        );
      setError(errorId, null);
      const recordId = workspace.root.recordsOfSource(nodeId)[0];
      const record = recordId ? workspace.root.domInputs.get(recordId) : undefined;
      run(
        catalogVariableCommands.nameSource(
          pageId,
          nodeId,
          source,
          record
            ? catalogStateSourceValue(workspace.root, record, source.prop)
            : undefined,
          name,
          workspace.newId,
        ),
      );
    },
    [graph, nodeId, ownerLabel, run, setError, t, workspace],
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
    const source = variable.source;
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
              {source
                ? `${source.prop} · ${ownerLabel(source.nodeId)}`
                : variable.valueType}
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
            {/* (A named RAC state follows its component: no type or default of its own.) */}
            {!source && (
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
            )}
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
    <div data-state-owner={owner} ref={rootRef}>
      <PropertySection
        title={t("propertiesPanel.stateSection")}
        badge={<span className="state-section-count">{view.own.length}</span>}
      >
        {view.sources.length > 0 && (
          <fieldset
            className="properties-aria state-group"
            data-group="implicit"
          >
            <legend className="fieldset-legend">
              {t("propertiesPanel.stateImplicitTitle")}
              <span className="state-group-meta">
                {t("propertiesPanel.stateImplicitRac")}
              </span>
            </legend>
            {view.sources.map((source) => {
              if (source.variable) return renderRow(source.variable);
              const errorId = `source:${source.prop}`;
              // An unnamed RAC state: [prop · type] [name input].
              return (
                <div
                  key={source.prop}
                  className="state-def state-def--unnamed"
                  data-implicit={source.prop}
                >
                  <div className="list-row state-def-summary">
                    <div className="list-row__body">
                      <span className="list-row__label state-def-name state-def-name--prop">
                        {source.prop}
                      </span>
                      <span className="list-row__meta state-def-meta">
                        {source.type}
                      </span>
                    </div>
                    <div className="list-row__actions state-def-name-group">
                      <input
                        type="text"
                        className="list-row__input state-def-name-input"
                        placeholder={t("propertiesPanel.stateNamePlaceholder")}
                        aria-label={`${t("propertiesPanel.stateNamePlaceholder")} ${source.prop}`}
                        onKeyDown={(event) => {
                          if (event.key === "Enter")
                            nameSource(source, event.currentTarget.value);
                        }}
                        onBlur={(event) =>
                          nameSource(source, event.currentTarget.value)
                        }
                      />
                    </div>
                  </div>
                  {errors[errorId] && (
                    <p className="state-def-error" role="alert">
                      {errors[errorId]}
                    </p>
                  )}
                </div>
              );
            })}
          </fieldset>
        )}
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
