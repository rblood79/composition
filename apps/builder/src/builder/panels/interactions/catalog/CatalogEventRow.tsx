import { memo, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "react-aria-components";
import {
  APP_ACTIONS,
  capabilityRefusal,
  eventArgsOf,
  exposedCapabilities,
  groupRefusal,
  resolveCapabilities,
  triggerGroupOf,
  type ExposureInput,
  type SetStateOp,
} from "@composition/shared";
import {
  CATALOG_TOAST_MIN_TIMEOUT,
  CATALOG_TOAST_VARIANTS,
  type CatalogCapabilityTarget,
  type CatalogToastVariant,
  type EditTarget,
  type InteractionEntry,
  type Scalar,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogDefaultAction,
  catalogListDataEventDefaults,
  catalogSetStateAction,
  type CatalogActionContext,
  type CatalogInteractionAction,
  type CatalogTargetOption,
} from "../../../catalogRuntime/interactions";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { ACTION_ICONS } from "../../../config/actionIcons";
import {
  CatalogTargetPicker,
  catalogTargetLabels,
} from "./CatalogTargetPicker";
import { catalogTargetPickFallback } from "../../../catalogRuntime/targetRef";
import { useI18n } from "@/i18n";
import { ActionPicker } from "../ActionPicker";
import { CapabilityPicker } from "../CapabilityPicker";
import { ParamField } from "../ParamField";
import { ValueField } from "../ValueField";
import type { CatalogValueSources } from "../valueOptions";
import { StateActionFieldsView } from "../StateActionFields";
import { TriggerPicker } from "../TriggerPicker";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import {
  ACTION_CHOICE_LABEL_KEYS,
  capabilityChoices,
  capabilityLabel as labelOfCapability,
  triggerLabel,
} from "../labels";
import type { ActionChoice } from "../types";

const DeleteIcon = ACTION_ICONS.delete;
const AddIcon = ACTION_ICONS.add;

/** `useListData`'s operations: the rule fields after the collection (reference argument order). */
const LIST_DATA_FIELDS = {
  // (`useTreeData` adds the parent first — `append(parentKey, …)` · `insert(parentKey, index, …)` ·
  // `prepend(parentKey, …)` · `move(key, toParentKey, index)`; empty = the top level.)
  append: ["parentKey", "value"],
  update: ["key", "value"],
  remove: ["keys"],
  reload: [],
  loadMore: [],
  setFilterText: ["value"],
  insert: ["parentKey", "index", "value"],
  insertBefore: ["key", "value"],
  insertAfter: ["key", "value"],
  prepend: ["parentKey", "value"],
  move: ["key", "toParentKey", "toIndex"],
  // (ADR-284 Phase 5 — a drop's side picks before · after: `!event.target.dropPosition`.)
  moveBefore: ["key", "keys", "dropPosition"],
  moveAfter: ["key", "keys", "dropPosition"],
  removeSelectedItems: [],
} as const;
type ListDataOpcode = keyof typeof LIST_DATA_FIELDS;
const isListDataOpcode = (opcode: string): opcode is ListDataOpcode =>
  opcode in LIST_DATA_FIELDS;
/** A list-data field's label (the reference's argument names: `index` · `key` · `keys` …). */
function listDataFieldLabelKey(opcode: ListDataOpcode, field: string): string {
  if (opcode === "setFilterText") return "interactions.filterText";
  if (field === "value") return "interactions.appendValue";
  if (field === "index" || field === "toIndex") return "interactions.listIndex";
  if (field === "keys") return "interactions.movedKeys";
  if (field === "parentKey") return "interactions.parentKey";
  if (field === "toParentKey") return "interactions.toParentKey";
  if (field === "dropPosition") return "interactions.dropPosition";
  if (
    opcode === "moveBefore" ||
    opcode === "moveAfter" ||
    opcode.startsWith("insert")
  )
    return "interactions.targetKey";
  return "interactions.itemKey";
}
const LIST_DATA_SUMMARY_KEYS = {
  append: "interactions.summaryAppend",
  update: "interactions.summaryUpdate",
  remove: "interactions.summaryRemove",
  reload: "interactions.summaryReload",
  loadMore: "interactions.summaryLoadMore",
  setFilterText: "interactions.summarySetFilterText",
  insert: "interactions.summaryInsert",
  insertBefore: "interactions.summaryInsertBefore",
  insertAfter: "interactions.summaryInsertAfter",
  prepend: "interactions.summaryPrepend",
  move: "interactions.summaryMove",
  moveBefore: "interactions.summaryMoveBefore",
  moveAfter: "interactions.summaryMoveAfter",
  removeSelectedItems: "interactions.summaryRemoveSelectedItems",
} as const;

const STATE_OP_LABEL_KEYS = {
  set: "interactions.stateOpSet",
  toggle: "interactions.stateOpToggle",
  increment: "interactions.stateOpIncrement",
  reset: "interactions.stateOpReset",
} as const;

const GROUP_LABEL_KEYS = {
  project: "interactions.stateVariableGroupProject",
  page: "interactions.stateVariableGroupPage",
  element: "interactions.stateVariableGroupElement",
} as const;

/** A target's text (the picker's label for it alone — its chain, else `type #name`). */
const targetLabel = (target: CatalogTargetOption) =>
  catalogTargetLabels([target]).get(target.key)!;

/** ADR-283 — why a rule's target names nothing from the selected place. */
export type CatalogTargetNotice = "unset" | "outOfContext";

interface CatalogEventRowProps {
  rule: InteractionEntry;
  componentType: string;
  /** ADR-294 — the owner instance's component events (its When 「컴포넌트」 group). */
  componentEvents?: readonly { key: string; name: string }[];
  context: CatalogActionContext;
  /** Do choices that have something to point at. */
  choices: readonly ActionChoice[];
  /** ADR-283 — the option a stored target stands for (its type, labels, document place). */
  describeTarget: (
    ref: CatalogCapabilityTarget,
  ) => CatalogTargetOption | undefined;
  /** ADR-283 Decision 2 — whether the target names a record from the selected place. */
  targetNotice: (
    ref: CatalogCapabilityTarget,
  ) => CatalogTargetNotice | undefined;
  /** ADR-283 Decision 4 — the list highlights its option on the Canvas (and back). */
  onTargetHover: (option: CatalogTargetOption | undefined) => void;
  canvasHoverKey?: string;
  /** ADR-283 Decision 5 — pick this rule's target on the Canvas. */
  onAim?: () => void;
  aiming?: boolean;
  /** ADR-281 Decision 1 — the owner's restricting props (what its When offers). */
  exposure: ExposureInput;
  /** ADR-281 Decision 1 — a target's restricting props (what its Do offers). */
  targetExposure: (edit: EditTarget) => ExposureInput;
  expanded: boolean;
  onToggle: () => void;
  onChange: (rule: InteractionEntry) => void;
  onRemove: () => void;
  /**
   * 295 후속 C8 — a toast's action button Dos (S2 `onAction`) edited with this same editor: no
   * summary · When (they run in the When's context), and the last Do can be removed.
   */
  nested?: boolean;
}

/**
 * ADR-248 Phase 4e-4e: one rule over the catalog interaction record — the old row's summary and
 * inline editor (When · Do · target/argument) with the record's action shape: navigate names a
 * page, setState always carries a valid value, capability a target node.
 */
export const CatalogEventRow = memo(function CatalogEventRow({
  rule,
  componentType,
  componentEvents,
  context,
  choices,
  describeTarget,
  targetNotice,
  onTargetHover,
  canvasHoverKey,
  onAim,
  aiming,
  exposure,
  targetExposure,
  expanded,
  onToggle,
  onChange,
  onRemove,
  nested = false,
}: CatalogEventRowProps) {
  const { t } = useI18n();
  // ADR-284 Decision 8 — the rule's Do list: the editor shows one Do at a time (the order list
  // picks it); a new Do goes last, a Do is removed while another stays.
  const [doIndex, setDoIndex] = useState(0);
  const at = Math.min(doIndex, rule.actions.length - 1);
  const action = rule.actions[at]!;
  const setAction = (next: CatalogInteractionAction) =>
    onChange({
      ...rule,
      actions: rule.actions.map((item, index) => (index === at ? next : item)),
    });

  const target =
    action.opcode === "capability" ? describeTarget(action.target) : undefined;
  const targetType = target?.type ?? "";
  const notice =
    action.opcode === "capability" ? targetNotice(action.target) : undefined;
  // ADR-283 Decision 4 — a new target that does not take the capability: the line says what
  // changed (never a silent fallback); it stays until the next change.
  const [fallback, setFallback] = useState<
    { target: string; from: string; to: string } | undefined
  >(undefined);
  // (A Canvas pick's fallback — the same line.)
  const picked = useSyncExternalStore(
    catalogTargetPickFallback.subscribe,
    catalogTargetPickFallback.get,
  );
  const capabilityLabel = (id: string) => {
    const def = resolveCapabilities(targetType)[id];
    return def ? labelOfCapability(def, t) : id;
  };
  const shownFallback =
    fallback ??
    (picked?.ruleId === rule.id && target
      ? {
          target: targetLabel(target),
          from: capabilityLabel(picked.from),
          to: capabilityLabel(picked.to),
        }
      : undefined);

  const summary = useMemo(() => {
    const when = triggerLabel(componentType, rule.trigger, t, componentEvents);
    if (action.opcode === "emit")
      return t("interactions.summaryEmit", {
        when,
        name:
          context.events?.find((event) => event.key === action.propertyKey)
            ?.name ?? action.propertyKey,
      });
    if (action.opcode === "navigate") {
      const page = context.pages.find((option) => option.id === action.pageId);
      return page
        ? t("interactions.summaryNavigateWithPath", { when, path: page.name })
        : t("interactions.summaryNavigate", { when });
    }
    if (action.opcode === "toast")
      return action.message
        ? t("interactions.summaryToastWithMessage", {
            when,
            message: action.message,
          })
        : t("interactions.summaryToast", { when });
    if (action.opcode === "setState") {
      const variable = context.variables.find(
        (option) => option.id === action.variableId,
      );
      return t("interactions.summarySetState", {
        when,
        op: t(STATE_OP_LABEL_KEYS[action.op]),
        name: variable?.name ?? action.variableId,
      });
    }
    if (action.opcode === "callEndpoint") {
      const endpoint = context.endpoints?.find(
        (option) => option.id === action.endpointId,
      );
      return t("interactions.summaryCallEndpoint", {
        when,
        name: endpoint?.name ?? action.endpointId,
      });
    }
    if ("collectionId" in action && isListDataOpcode(action.opcode)) {
      const collection = context.collections?.find(
        (option) => option.id === action.collectionId,
      );
      return t(LIST_DATA_SUMMARY_KEYS[action.opcode], {
        when,
        name: collection?.name ?? action.collectionId,
      });
    }
    if (action.opcode === "capability") {
      const capability = resolveCapabilities(targetType)[action.capabilityId];
      const label = capability
        ? labelOfCapability(capability, t)
        : action.capabilityId;
      return `${when} → ${label} @ ${target && notice !== "unset" ? targetLabel(target) : t("interactions.targetUnset")}`;
    }
    return when;
  }, [
    action,
    componentEvents,
    componentType,
    context,
    notice,
    rule.trigger,
    t,
    target,
    targetType,
  ]);
  const more = rule.actions.length - 1;
  const doName = (item: CatalogInteractionAction) =>
    item.opcode in ACTION_CHOICE_LABEL_KEYS
      ? t(
          ACTION_CHOICE_LABEL_KEYS[
            item.opcode as keyof typeof ACTION_CHOICE_LABEL_KEYS
          ],
        )
      : item.opcode;

  // ADR-281 Decision 1 — a rule the declared props now stop is kept, marked with the reason the
  // dispatcher reports (never deleted).
  const refusal = useMemo(() => {
    const group = triggerGroupOf(componentType, rule.trigger);
    const when = group ? groupRefusal(group, exposure) : undefined;
    if (when) return when;
    return action.opcode === "capability"
      ? capabilityRefusal(
          targetType,
          action.capabilityId,
          target ? targetExposure(target.edit) : { props: {} },
        )
      : undefined;
  }, [
    action,
    componentType,
    exposure,
    rule.trigger,
    targetExposure,
    targetType,
  ]);

  const capabilityDef =
    action.opcode === "capability"
      ? resolveCapabilities(targetType)[action.capabilityId]
      : undefined;

  // (ADR-294 — a component's input variable is read only: no Set state writes it.)
  const variableOptions = useMemo(
    () =>
      context.variables
        .filter((variable) => !variable.readOnly)
        .map((variable) => ({
          id: variable.id,
          name: variable.name,
          type: variable.type,
          groupLabelKey: GROUP_LABEL_KEYS[variable.group],
        })),
    [context.variables],
  );
  // 「값 고르기」 — what this rule's values can name: its When's arguments, the owner's selected
  //   item (a bound owner's keys), the variables in reach.
  const valueSources = useMemo<CatalogValueSources>(
    () => ({
      eventArgs: eventArgsOf(componentType, rule.trigger),
      ...(context.ownerItems ? { items: context.ownerItems } : {}),
      variables: context.variables,
    }),
    [componentType, context.ownerItems, context.variables, rule.trigger],
  );

  return (
    <div
      className={nested ? "interaction-rule-nested" : "interaction-rule"}
      data-expanded={expanded || undefined}
    >
      {!nested && (
        <div className="interaction-rule-summary">
          <button
            type="button"
            className="interaction-rule-toggle"
            onClick={() => {
              setDoIndex(0);
              onToggle();
            }}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="interaction-rule-text">
              {more > 0
                ? t("interactions.summaryMoreDos", { summary, count: more })
                : summary}
            </span>
          </button>
          <button
            type="button"
            className="interaction-rule-remove"
            onClick={onRemove}
            aria-label={t("interactions.deleteEvent")}
          >
            <DeleteIcon size={14} />
          </button>
        </div>
      )}
      {!nested && refusal && (
        <p className="interaction-rule-refusal">
          {t("interactions.racRefuses", { reason: refusal })}
        </p>
      )}

      {(expanded || nested) && (
        <div className="interaction-rule-editor">
          {!nested && (
            <div className="fieldset-row interaction-rule-row">
              <TriggerPicker
                componentType={componentType}
                componentEvents={componentEvents}
                value={rule.trigger}
                exposure={exposure}
                onChange={(trigger) => onChange({ ...rule, trigger })}
              />
            </div>
          )}
          {(rule.actions.length > 1 || nested) && (
            <div className="fieldset-row interaction-rule-dos">
              {rule.actions.length > 1 && (
                <PropertySelect
                  label={t("interactions.doList")}
                  value={String(at)}
                  onChange={(value) => setDoIndex(Number(value))}
                  options={rule.actions.map((item, index) => ({
                    value: String(index),
                    label: t("interactions.doStep", {
                      index: index + 1,
                      name: doName(item),
                    }),
                  }))}
                  translateOptions={false}
                />
              )}
              <div className="fieldset-actions actions-remove-do">
                <button
                  type="button"
                  className="iconButton"
                  aria-label={t("interactions.removeDo")}
                  onClick={() => {
                    onChange({
                      ...rule,
                      actions: rule.actions.filter(
                        (_item, index) => index !== at,
                      ),
                    });
                    setDoIndex(Math.max(0, at - 1));
                  }}
                >
                  <DeleteIcon size={14} />
                </button>
              </div>
            </div>
          )}
          <div className="fieldset-row interaction-rule-row">
            <ActionPicker
              value={action.opcode as ActionChoice}
              choices={
                choices.includes(action.opcode as ActionChoice)
                  ? choices
                  : [action.opcode as ActionChoice, ...choices]
              }
              onChange={(choice) => {
                if (choice === action.opcode) return;
                const next = catalogDefaultAction(choice, context);
                if (!next) return;
                setAction(
                  catalogListDataEventDefaults(
                    next,
                    eventArgsOf(componentType, rule.trigger),
                  ),
                );
              }}
            />
          </div>

          {action.opcode === "navigate" && (
            <PropertySelect
              label={t("interactions.navigatePage")}
              value={action.pageId}
              onChange={(pageId) => {
                const page = context.pages.find(
                  (option) => option.id === pageId,
                );
                if (page) setAction({ opcode: "navigate", pageId: page.id });
              }}
              options={context.pages.map((page) => ({
                value: page.id,
                label: `${page.name} (${page.route})`,
              }))}
            />
          )}

          {action.opcode === "emit" && (
            <>
              <PropertySelect
                label={t("interactions.emitEvent")}
                value={action.propertyKey}
                onChange={(propertyKey) =>
                  setAction({ ...action, propertyKey })
                }
                options={(context.events ?? []).map((event) => ({
                  value: event.key,
                  label: event.name,
                }))}
                translateOptions={false}
              />
              <ValueField
                label={t("interactions.emitValue")}
                kind="text"
                value={action.value}
                sources={valueSources}
                onChange={(value) => {
                  const { value: _old, ...rest } = action;
                  setAction(
                    value === "" || value === undefined
                      ? rest
                      : { ...rest, value: value as Scalar },
                  );
                }}
              />
            </>
          )}

          {action.opcode === "toast" && (
            <>
              <ParamField
                param={APP_ACTIONS.toast.param}
                value={action.message}
                onChange={(value) =>
                  setAction({ ...action, message: String(value) })
                }
              />
              {/* S2 `ToastQueue.<variant>(message, {timeout})` — ADR-295 후속 C2. Absent variant =
                  info (S2's), absent timeout = until closed (a set one is at least 5000 ms). */}
              <PropertySelect
                label={t("capabilities.paramToastVariant")}
                value={action.variant ?? "info"}
                onChange={(variant) =>
                  setAction({
                    ...action,
                    variant: variant as CatalogToastVariant,
                  })
                }
                options={CATALOG_TOAST_VARIANTS.map((variant) => ({
                  value: variant,
                  label: variant[0]!.toUpperCase() + variant.slice(1),
                }))}
                translateOptions={false}
              />
              {/* S2: an actionable toast is not auto dismissed (WCAG 2.2.1) — no timeout with a
                  button. */}
              {!action.actionLabel && (
                <ParamField
                  param={{
                    kind: "number",
                    labelKey: "capabilities.paramTimeout",
                  }}
                  value={action.timeout ?? ""}
                  onChange={(value) => {
                    const { timeout: _old, ...rest } = action;
                    const ms = Number(value);
                    setAction(
                      value === "" || !Number.isFinite(ms) || ms <= 0
                        ? rest
                        : {
                            ...rest,
                            timeout: Math.max(
                              Math.round(ms),
                              CATALOG_TOAST_MIN_TIMEOUT,
                            ),
                          },
                    );
                  }}
                />
              )}
              {/* 295 후속 C8 — S2 `ToastOptions` `actionLabel` · `shouldCloseOnAction` · `onAction`:
                  the button's text, whether it closes the toast, and the Dos it runs. Clearing the
                  text removes the button. */}
              <ParamField
                param={{
                  kind: "text",
                  labelKey: "capabilities.paramToastActionLabel",
                }}
                value={action.actionLabel ?? ""}
                onChange={(value) => {
                  const label = String(value);
                  const {
                    actionLabel: _label,
                    shouldCloseOnAction: _close,
                    onAction: _dos,
                    timeout: _timeout,
                    ...rest
                  } = action;
                  setAction(
                    label
                      ? {
                          ...rest,
                          actionLabel: label,
                          ...(action.shouldCloseOnAction
                            ? { shouldCloseOnAction: true }
                            : {}),
                          ...(action.onAction
                            ? { onAction: action.onAction }
                            : {}),
                        }
                      : action.timeout !== undefined
                        ? { ...rest, timeout: action.timeout }
                        : rest,
                  );
                }}
              />
              {action.actionLabel && (
                <>
                  <PropertySwitch
                    label={t("capabilities.paramToastCloseOnAction")}
                    isSelected={!!action.shouldCloseOnAction}
                    onChange={(close) => {
                      const { shouldCloseOnAction: _old, ...rest } = action;
                      setAction(
                        close ? { ...rest, shouldCloseOnAction: true } : rest,
                      );
                    }}
                  />
                  {action.onAction?.length ? (
                    <div
                      className="interaction-rule-toast-action"
                      role="group"
                      aria-label={t("interactions.toastActionDos")}
                    >
                      <CatalogEventRow
                        rule={{ ...rule, actions: action.onAction }}
                        componentType={componentType}
                        componentEvents={componentEvents}
                        context={context}
                        choices={choices}
                        describeTarget={describeTarget}
                        targetNotice={targetNotice}
                        onTargetHover={onTargetHover}
                        canvasHoverKey={canvasHoverKey}
                        exposure={exposure}
                        targetExposure={targetExposure}
                        expanded
                        onToggle={() => {}}
                        onChange={(next) => {
                          const { onAction: _old, ...rest } = action;
                          setAction(
                            next.actions.length
                              ? { ...rest, onAction: next.actions }
                              : rest,
                          );
                        }}
                        onRemove={() => {}}
                        nested
                      />
                    </div>
                  ) : (
                    <Button
                      className="control-button"
                      data-variant="add"
                      onPress={() => {
                        // (The first Do kind that has something to point at; another toast last.)
                        for (const choice of [
                          ...choices.filter((item) => item !== "toast"),
                          "toast" as const,
                        ]) {
                          const next = catalogDefaultAction(choice, context);
                          if (!next) continue;
                          setAction({ ...action, onAction: [next] });
                          break;
                        }
                      }}
                    >
                      <AddIcon size={14} />
                      {t("interactions.addToastActionDo")}
                    </Button>
                  )}
                </>
              )}
            </>
          )}

          {action.opcode === "setState" && (
            <StateActionFieldsView
              variables={variableOptions}
              valueSources={valueSources}
              allowUnset={false}
              action={{
                variableId: action.variableId,
                op: action.op,
                value: action.value,
              }}
              onChange={(next) => {
                const variable = context.variables.find(
                  (option) => option.id === next.variableId,
                );
                if (!variable) return;
                setAction(
                  catalogSetStateAction(
                    variable,
                    next.op as SetStateOp,
                    next.value as Scalar | undefined,
                  ),
                );
              }}
            />
          )}
          {action.opcode === "setState" && context.events && (
            // ADR-294 — an origin rule's Set state sees the component's own chain only: the
            // screen that uses the component gets a value through an event.
            <div className="interactions-target-notice" role="status">
              {t("interactions.emitHint")}
            </div>
          )}

          {action.opcode === "callEndpoint" && (
            <>
              <PropertySelect
                label={t("interactions.endpoint")}
                value={action.endpointId}
                onChange={(endpointId) => {
                  const next = context.endpoints?.find(
                    (option) => option.id === endpointId,
                  );
                  if (next)
                    setAction({
                      ...action,
                      endpointId: next.id,
                    });
                }}
                options={(context.endpoints ?? []).map((option) => ({
                  value: option.id,
                  label: `${option.name} (${option.method})`,
                }))}
                translateOptions={false}
              />
              <ValueField
                label={t("interactions.endpointBody")}
                kind="text"
                value={action.body}
                sources={valueSources}
                onChange={(value) =>
                  setAction(
                    value === "" || value === undefined
                      ? {
                          opcode: "callEndpoint",
                          endpointId: action.endpointId,
                        }
                      : { ...action, body: value as Scalar },
                  )
                }
              />
            </>
          )}

          {isListDataOpcode(action.opcode) && "collectionId" in action && (
            <>
              <PropertySelect
                label={t("interactions.collection")}
                value={action.collectionId}
                onChange={(collectionId) => {
                  const next = context.collections?.find(
                    (option) => option.id === collectionId,
                  );
                  if (next) setAction({ ...action, collectionId: next.id });
                }}
                options={(context.collections ?? []).map((option) => ({
                  value: option.id,
                  label: option.name,
                }))}
                translateOptions={false}
              />
              {action.opcode === "update" && (
                <PropertySelect
                  label={t("interactions.updateField")}
                  value={action.field ?? ""}
                  onChange={(field) => {
                    const { field: _old, ...rest } = action;
                    setAction(
                      field
                        ? { ...rest, field: field as `data:field:${string}` }
                        : rest,
                    );
                  }}
                  options={[
                    { value: "", label: t("interactions.updateWholeItem") },
                    ...(
                      context.collections?.find(
                        (option) => option.id === action.collectionId,
                      )?.fields ?? []
                    ).map((field) => ({
                      value: `data:field:${field.id}`,
                      label: field.key,
                    })),
                  ]}
                  translateOptions={false}
                />
              )}
              {LIST_DATA_FIELDS[action.opcode].map((field) => (
                <ValueField
                  key={field}
                  label={t(
                    listDataFieldLabelKey(
                      action.opcode as ListDataOpcode,
                      field,
                    ),
                  )}
                  kind="text"
                  value={(action as Record<string, unknown>)[field]}
                  sources={valueSources}
                  onChange={(value) => {
                    const next = { ...action } as Record<string, unknown>;
                    if (value === "" || value === undefined) delete next[field];
                    else next[field] = value as Scalar;
                    setAction(next as CatalogInteractionAction);
                  }}
                />
              ))}
            </>
          )}

          {action.opcode === "capability" && (
            <>
              <CatalogTargetPicker
                label={t("interactions.target")}
                value={target ? targetLabel(target) : undefined}
                options={context.targets as () => CatalogTargetOption[]}
                onHover={onTargetHover}
                canvasHoverKey={canvasHoverKey}
                onAim={onAim}
                aiming={aiming}
                onPick={(next) => {
                  const capabilities = exposedCapabilities(
                    next.type,
                    targetExposure(next.edit),
                  );
                  const keeps = action.capabilityId in capabilities;
                  const label = (id: string) => {
                    const def =
                      resolveCapabilities(next.type)[id] ??
                      resolveCapabilities(targetType)[id];
                    return def ? labelOfCapability(def, t) : id;
                  };
                  setFallback(
                    keeps
                      ? undefined
                      : {
                          target: targetLabel(next),
                          from: label(action.capabilityId),
                          to: label("hide"),
                        },
                  );
                  setAction({
                    opcode: "capability",
                    target: next.ref,
                    capabilityId: keeps ? action.capabilityId : "hide",
                  });
                }}
              />
              {shownFallback && (
                <div
                  className="interactions-target-notice"
                  role="status"
                  data-tone="warning"
                >
                  {t("interactions.capabilityFallback", shownFallback)}
                </div>
              )}
              {notice && (
                <div
                  className="interactions-target-notice"
                  role="status"
                  data-tone="warning"
                >
                  {notice === "unset"
                    ? `${t("interactions.targetUnset")} · ${t("interactions.targetRepoint")}`
                    : t("interactions.targetOutOfContext")}
                </div>
              )}
              <CapabilityPicker
                targetType={targetType}
                value={action.capabilityId}
                exposure={target ? targetExposure(target.edit) : { props: {} }}
                onChange={(capabilityId) => {
                  setFallback(undefined);
                  setAction({
                    opcode: "capability",
                    target: action.target,
                    capabilityId,
                  });
                }}
              />
              {capabilityDef?.param && (
                <ValueField
                  label={t(capabilityDef.param.labelKey)}
                  kind={
                    capabilityDef.param.kind === "number"
                      ? "number"
                      : capabilityDef.param.kind === "icon"
                        ? "icon"
                        : "text"
                  }
                  choices={
                    capabilityDef.param.kind === "choice"
                      ? capabilityChoices(targetType, capabilityDef)
                      : undefined
                  }
                  value={action.value}
                  sources={valueSources}
                  onChange={(value) =>
                    setAction({ ...action, value: value as Scalar })
                  }
                />
              )}
            </>
          )}

          <Button
            className="control-button"
            data-variant="add"
            onPress={() => {
              // (The new Do starts as the last one's kind — a kanban drop's `update` then `move`.)
              const next =
                catalogDefaultAction(action.opcode as ActionChoice, context) ??
                catalogDefaultAction("toast", context);
              if (!next) return;
              onChange({ ...rule, actions: [...rule.actions, next] });
              setDoIndex(rule.actions.length);
            }}
          >
            <AddIcon size={14} />
            {t("interactions.addDo")}
          </Button>
        </div>
      )}
    </div>
  );
});
