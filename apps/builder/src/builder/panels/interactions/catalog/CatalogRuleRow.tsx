import { memo, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
import type {
  InteractionEntry,
  NodeId,
  Scalar,
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
import { useI18n } from "@/i18n";
import { ActionPicker } from "../ActionPicker";
import { CapabilityPicker } from "../CapabilityPicker";
import { ParamField } from "../ParamField";
import { ValueSourceField } from "../ValueSourceField";
import { StateActionFieldsView } from "../StateActionFields";
import { TriggerPicker } from "../TriggerPicker";
import { triggerLabel } from "../labels";
import type { ActionChoice } from "../types";

const DeleteIcon = ACTION_ICONS.delete;

/** `useListData`'s operations: the rule fields after the collection (reference argument order). */
const LIST_DATA_FIELDS = {
  append: ["value"],
  update: ["key", "value"],
  remove: ["keys"],
} as const;
const LIST_DATA_SUMMARY_KEYS = {
  append: "interactions.summaryAppend",
  update: "interactions.summaryUpdate",
  remove: "interactions.summaryRemove",
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

const targetLabel = (target: CatalogTargetOption) =>
  target.name ? `${target.type} #${target.name}` : target.type;
/** A picker option: unnamed nodes of one type are told apart by their id's short tail. */
const targetOptionLabel = (target: CatalogTargetOption) =>
  target.name
    ? targetLabel(target)
    : `${target.type} (${target.id.split(":").pop()!.slice(0, 8)})`;

interface CatalogRuleRowProps {
  rule: InteractionEntry;
  componentType: string;
  context: CatalogActionContext;
  /** Do choices that have something to point at. */
  choices: readonly ActionChoice[];
  /** A target the page list does not hold (another page's node): its type and label. */
  describeTarget: (id: NodeId) => CatalogTargetOption | undefined;
  /** ADR-281 Decision 1 — the owner's restricting props (what its When offers). */
  exposure: ExposureInput;
  /** ADR-281 Decision 1 — a target's restricting props (what its Do offers). */
  targetExposure: (id: NodeId) => ExposureInput;
  expanded: boolean;
  onToggle: () => void;
  onChange: (rule: InteractionEntry) => void;
  onRemove: () => void;
}

/**
 * ADR-248 Phase 4e-4e: one rule over the catalog interaction record — the old row's summary and
 * inline editor (When · Do · target/argument) with the record's action shape: navigate names a
 * page, setState always carries a valid value, capability a target node.
 */
export const CatalogRuleRow = memo(function CatalogRuleRow({
  rule,
  componentType,
  context,
  choices,
  describeTarget,
  exposure,
  targetExposure,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: CatalogRuleRowProps) {
  const { t } = useI18n();
  const action = rule.action;
  const setAction = (next: CatalogInteractionAction) =>
    onChange({ ...rule, action: next });

  const target =
    action.opcode === "capability"
      ? (context.targets.find((option) => option.id === action.targetId) ??
        describeTarget(action.targetId))
      : undefined;
  const targetType = target?.type ?? "";

  const summary = useMemo(() => {
    const when = triggerLabel(componentType, rule.trigger, t);
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
    if (
      action.opcode === "append" ||
      action.opcode === "update" ||
      action.opcode === "remove"
    ) {
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
      const label = capability ? t(capability.labelKey) : action.capabilityId;
      return `${when} → ${label} @ ${target ? targetLabel(target) : t("interactions.targetUnset")}`;
    }
    return when;
  }, [action, componentType, context, rule.trigger, t, target, targetType]);

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
          targetExposure(action.targetId),
        )
      : undefined;
  }, [action, componentType, exposure, rule.trigger, targetExposure, targetType]);

  const capabilityDef =
    action.opcode === "capability"
      ? resolveCapabilities(targetType)[action.capabilityId]
      : undefined;

  const variableOptions = useMemo(
    () =>
      context.variables.map((variable) => ({
        id: variable.id,
        name: variable.name,
        type: variable.type,
        groupLabelKey: GROUP_LABEL_KEYS[variable.group],
      })),
    [context.variables],
  );

  return (
    <div className="interaction-rule" data-expanded={expanded || undefined}>
      <div className="interaction-rule-summary">
        <button
          type="button"
          className="interaction-rule-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="interaction-rule-text">{summary}</span>
        </button>
        <button
          type="button"
          className="interaction-rule-remove"
          onClick={onRemove}
          aria-label={t("interactions.deleteRule")}
        >
          <DeleteIcon size={14} />
        </button>
      </div>
      {refusal && (
        <p className="interaction-rule-refusal">
          {t("interactions.racRefuses", { reason: refusal })}
        </p>
      )}

      {expanded && (
        <div className="interaction-rule-editor">
          <div className="fieldset-row interaction-rule-row">
            <TriggerPicker
              componentType={componentType}
              value={rule.trigger}
              exposure={exposure}
              onChange={(trigger) => onChange({ ...rule, trigger })}
            />
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

          {action.opcode === "toast" && (
            <ParamField
              param={APP_ACTIONS.toast.param}
              value={action.message}
              onChange={(value) =>
                setAction({ opcode: "toast", message: String(value) })
              }
            />
          )}

          {action.opcode === "setState" && (
            <StateActionFieldsView
              variables={variableOptions}
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
              <ValueSourceField
                param={{ kind: "text", labelKey: "interactions.endpointBody" }}
                value={action.body}
                eventArgs={eventArgsOf(componentType, rule.trigger)}
                onChange={(value) =>
                  setAction(
                    value === "" || value === undefined
                      ? { opcode: "callEndpoint", endpointId: action.endpointId }
                      : { ...action, body: value as Scalar },
                  )
                }
              />
            </>
          )}

          {(action.opcode === "append" ||
            action.opcode === "update" ||
            action.opcode === "remove") && (
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
              {LIST_DATA_FIELDS[action.opcode].map((field) => (
                <ValueSourceField
                  key={field}
                  param={{
                    kind: "text",
                    labelKey:
                      field === "value"
                        ? "interactions.appendValue"
                        : "interactions.itemKey",
                  }}
                  value={(action as Record<string, unknown>)[field]}
                  eventArgs={eventArgsOf(componentType, rule.trigger)}
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
              <PropertySelect
                label={t("interactions.target")}
                value={action.targetId}
                onChange={(targetId) => {
                  const next = context.targets.find(
                    (option) => option.id === targetId,
                  );
                  if (!next) return;
                  const capabilities = exposedCapabilities(
                    next.type,
                    targetExposure(next.id),
                  );
                  setAction({
                    opcode: "capability",
                    targetId: next.id,
                    capabilityId:
                      action.capabilityId in capabilities
                        ? action.capabilityId
                        : "hide",
                  });
                }}
                options={[
                  ...(target && !context.targets.includes(target)
                    ? [target]
                    : []),
                  ...context.targets,
                ].map((option) => ({
                  value: option.id,
                  label: targetOptionLabel(option),
                }))}
              />
              <CapabilityPicker
                targetType={targetType}
                value={action.capabilityId}
                exposure={targetExposure(action.targetId)}
                onChange={(capabilityId) =>
                  setAction({
                    opcode: "capability",
                    targetId: action.targetId,
                    capabilityId,
                  })
                }
              />
              {capabilityDef?.param && (
                <ValueSourceField
                  param={capabilityDef.param}
                  value={action.value}
                  eventArgs={eventArgsOf(componentType, rule.trigger)}
                  onChange={(value) =>
                    setAction({ ...action, value: value as Scalar })
                  }
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});
