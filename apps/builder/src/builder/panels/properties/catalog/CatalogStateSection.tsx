import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "react-aria-components/Button";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import {
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components/Select";
import { Minus } from "lucide-react";
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
import { useControlPopoverMetrics } from "../../../components/property/useControlPopoverMetrics";
import { useSelectTriggerFocusRestore } from "../../../components/property/useSelectTriggerFocusRestore";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { ConfirmDialog } from "../../../components/overlay";
import {
  ActionIconButton,
  ActionTooltipTrigger,
  SwatchIconButton,
} from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { useStateSectionFocus } from "../state/stateSectionFocus";
import { useSectionCollapse } from "../../styles/hooks/useSectionCollapse";
import "../state/StateSection.css";

const AddIcon = ACTION_ICONS.add;
const STATE_SECTION_ID = "property-state";
const NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;
const TYPE_OPTIONS = CATALOG_VARIABLE_TYPES.map((type) => ({
  value: type,
  label: type,
}));

/** 단위 피커와 같은 입력 내부 보조 선택. 타입 이름 자체가 트리거가 된다. */
function StateVariableTypeSelect({
  value,
  onChange,
}: {
  value: CatalogVariableType;
  onChange: (value: CatalogVariableType) => void;
}) {
  const { t } = useI18n();
  const { controlRef, popoverStyle } = useControlPopoverMetrics();
  const { triggerRef, restoreFocusOnClose } = useSelectTriggerFocusRestore();
  return (
    <AriaSelect
      className="react-aria-Select state-variable-type"
      ref={controlRef}
      aria-label={t("propertiesPanel.stateType")}
      selectedKey={value}
      onSelectionChange={(key) =>
        key !== null && onChange(String(key) as CatalogVariableType)
      }
      onOpenChange={restoreFocusOnClose}
    >
      <Button className="react-aria-Button" ref={triggerRef}>
        <SelectValue />
      </Button>
      <Popover
        className="react-aria-Popover property-select-popover"
        style={popoverStyle}
      >
        <ListBox className="react-aria-ListBox">
          {TYPE_OPTIONS.map((option) => (
            <ListBoxItem
              key={option.value}
              id={option.value}
              textValue={option.label}
              className="react-aria-ListBoxItem"
            >
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

/** 기존 상태 이름을 직접 편집하고 실제로 바뀐 값만 반영한다. */
function StateSourceField({
  source,
  label,
  error,
  onName,
  onRename,
  onRemove,
  onClearError,
}: {
  source: CatalogStateSource;
  label: string;
  error?: string;
  onName: (source: CatalogStateSource, name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (variable: StateVariableEntry) => void;
  onClearError: () => void;
}) {
  const { t } = useI18n();
  const variable = source.variable;
  const savedName = variable?.name ?? source.prop;
  const [draft, setDraft] = useState(savedName);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelOnBlur = useRef(false);
  const changed = draft.trim() !== savedName;

  useEffect(() => {
    setDraft(savedName);
  }, [variable?.id, savedName]);

  const commit = () => {
    if (cancelOnBlur.current) {
      cancelOnBlur.current = false;
      return;
    }
    if (!changed) {
      setDraft(savedName);
      onClearError();
      return;
    }
    if (variable) onRename(variable.id, draft.trim());
    else onName(source, draft.trim());
  };
  const removeLabel = t("common.delete");
  return (
    <div
      className="state-def"
      data-implicit={source.prop}
      data-variable-id={variable?.id}
    >
      <div
        className="fieldset-row state-source-row"
        data-wide="true"
        onFocusCapture={() => {
          cancelOnBlur.current = false;
        }}
        onBlur={(event) => {
          // 행 안의 제거 버튼으로 이동할 때는 저장하지 않는다. 행을 떠날 때만 반영한다.
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          )
            return;
          commit();
        }}
      >
        <PropertyFieldset legend={label} labelMode="hidden">
          <input
            id={inputId}
            ref={inputRef}
            className="react-aria-Input"
            aria-label={t("propertiesPanel.stateVariableName")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancelOnBlur.current = true;
                setDraft(savedName);
                onClearError();
                event.currentTarget.blur();
              }
            }}
          />
          <span className="state-source-type">{source.type}</span>
        </PropertyFieldset>
        <div className="fieldset-actions state-source-actions">
          <ActionTooltipTrigger tooltip={removeLabel}>
            <SwatchIconButton
              aria-label={removeLabel}
              isDisabled={!variable && !changed}
              onPress={() => {
                setDraft(savedName);
                onClearError();
                if (variable) {
                  cancelOnBlur.current = true;
                  onRemove(variable);
                } else inputRef.current?.focus();
              }}
            >
              <Minus size={16} />
            </SwatchIconButton>
          </ActionTooltipTrigger>
        </div>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="state-def-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

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

  // The Data panel's index jumps here: focus the variable and bring the section into view.
  const focusRequest = useStateSectionFocus((state) => state.request);
  const rootRef = useRef<HTMLDivElement>(null);
  const handledSeq = useRef(0);
  useEffect(() => {
    if (!focusRequest || focusRequest.seq === handledSeq.current) return;
    if (focusRequest.ownerNodeId !== owner) return;
    handledSeq.current = focusRequest.seq;
    const sections = useSectionCollapse.getState();
    sections.expandSections([STATE_SECTION_ID]);
    sections.setFocusSection(STATE_SECTION_ID);
    // The panel's sections are `content-visibility: auto`: a section that just mounted has no
    // height until the browser's next rendering (all of them sat at the panel top, so a scroll
    // now did nothing and they then pushed this one below the fold). Scroll after that frame.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        rootRef.current?.scrollIntoView({ block: "nearest" });
        if (focusRequest.variableId) {
          const row = [
            ...(rootRef.current?.querySelectorAll<HTMLElement>(
              "[data-variable-id]",
            ) ?? []),
          ].find(
            (element) => element.dataset.variableId === focusRequest.variableId,
          );
          const input = row?.querySelector<HTMLInputElement>("input");
          input?.focus();
          input?.select();
        }
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
      if (added) {
        const sections = useSectionCollapse.getState();
        sections.expandSections([STATE_SECTION_ID]);
        sections.setFocusSection(STATE_SECTION_ID);
      }
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
      if (!name)
        return setError(errorId, t("propertiesPanel.stateNameInvalid"));
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
      const record = recordId
        ? workspace.root.domInputs.get(recordId)
        : undefined;
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
    const source = variable.source;
    const usages = view.usage[variable.id] ?? 0;
    const error = errors[variable.id];
    return (
      <div
        key={variable.id}
        className="state-def"
        data-variable-id={variable.id}
      >
        <div
          className="fieldset-row state-variable-row"
          data-source={source ? "true" : undefined}
        >
          <PropertyInput
            label={t(
              source
                ? "propertiesPanel.stateVariableName"
                : "propertiesPanel.stateName",
            )}
            value={variable.name}
            onChange={(value) => rename(variable.id, value)}
            endControl={
              !source ? (
                <StateVariableTypeSelect
                  value={variable.valueType as CatalogVariableType}
                  onChange={(value) => changeType(variable.id, value)}
                />
              ) : undefined
            }
          />
          {!source && (
            <>
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
            </>
          )}
          <div className="fieldset-actions state-variable-actions">
            <ActionTooltipTrigger tooltip={t("common.delete")}>
              <SwatchIconButton
                onPress={() => setPendingDelete(variable)}
                aria-label={t("common.delete")}
              >
                <Minus size={16} />
              </SwatchIconButton>
            </ActionTooltipTrigger>
          </div>
        </div>
        {source && (
          <p className="state-source-hint">
            <code>{`{{ ${variable.name} }}`}</code>{" "}
            {t("propertiesPanel.stateSourceReference")}
          </p>
        )}
        {usages > 0 && (
          <span className="state-source-hint">
            {t("propertiesPanel.stateUsageCount", { count: usages })}
          </span>
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
        id={STATE_SECTION_ID}
        title={t("propertiesPanel.stateSection")}
        badge={<span className="state-section-count">{view.own.length}</span>}
        actions={
          <ActionIconButton
            aria-label={t("propertiesPanel.stateAdd")}
            tooltip={t("propertiesPanel.stateAdd")}
            onPress={add}
          >
            <AddIcon size={16} />
          </ActionIconButton>
        }
      >
        {view.sources.length > 0 && (
          <fieldset
            className="properties-aria state-group"
            data-group="implicit"
          >
            <legend className="fieldset-legend">
              {t("propertiesPanel.stateImplicitTitle")}
            </legend>
            {view.sources.map((source) => {
              // The RAC prop the state is (`isSelected` · `selectedKeys` · `inputValue` …) — the
              // reference's name in every locale (사용자 2026-10-24 「레퍼런스에 나온대로」).
              const label = source.prop;
              return (
                <StateSourceField
                  key={`${nodeId}:${source.prop}`}
                  source={source}
                  label={label}
                  error={errors[source.variable?.id ?? `source:${source.prop}`]}
                  onName={nameSource}
                  onRename={rename}
                  onRemove={setPendingDelete}
                  onClearError={() =>
                    setError(
                      source.variable?.id ?? `source:${source.prop}`,
                      null,
                    )
                  }
                />
              );
            })}
          </fieldset>
        )}
        {view.own.length > 0 && (
          <fieldset
            className="properties-aria state-group"
            data-group="explicit"
          >
            <legend className="fieldset-legend">
              {t(
                view.isPage
                  ? "propertiesPanel.statePageTitle"
                  : "propertiesPanel.stateExplicitTitle",
              )}
            </legend>
            {view.own.map((variable) => renderRow(variable))}
          </fieldset>
        )}
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
