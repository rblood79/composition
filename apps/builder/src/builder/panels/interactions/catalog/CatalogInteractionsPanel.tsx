import { useCallback, useMemo, useState } from "react";
import { SquareMousePointer } from "lucide-react";
import { exposedTriggerGroups, resolveTriggers } from "@composition/shared";
import type {
  CatalogCapabilityTarget,
  EditTarget,
  EntryId,
  InteractionEntry,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogOriginRootOf,
  resolveCapabilityTarget,
} from "../../../../../../../packages/shared/src/catalog/runtime/capabilityTarget";
import {
  catalogCapabilityTargets,
  catalogFirstCapabilityTarget,
  catalogTargetOptionOf,
  type CatalogTargetOption,
  catalogDefaultAction,
  catalogExposureInput,
  catalogInheritedInteractionsOf,
  catalogInheritedRuleEnabledCommand,
  catalogInteractionOwner,
  catalogReplaceInheritedRuleCommand,
  catalogInteractionsCommand,
  catalogInteractionsOf,
  catalogNewInteraction,
  catalogPageOptions,
  catalogTargetTypeName,
  catalogVisibleVariables,
  type CatalogActionContext,
} from "../../../catalogRuntime/interactions";
import {
  CatalogWorkspaceGate,
  useCatalogRevision,
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { targetKey } from "../../../catalogRuntime/session";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { PanelContents } from "../../../components/panel/PanelContents";
import { PanelHeader } from "../../../components/panel/PanelHeader";
import { Section } from "../../../components/panel/Section";
import { ActionIconButton } from "../../../components/ui/ActionIconButton";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useI18n } from "@/i18n";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import { ACTION_CHOICE_LABEL_KEYS } from "../labels";
import type { ActionChoice } from "../types";
import { useDataStore, useProjectVariableDefs } from "../../../stores/data";
import { CatalogEventRow, type CatalogTargetNotice } from "./CatalogEventRow";
import { catalogTargetRefOf } from "../../../catalogRuntime/targetRef";
import { CatalogInheritedRuleRow } from "./CatalogInheritedRuleRow";
import "../InteractionsPanel.css";

const AddIcon = ACTION_ICONS.add;
const CHOICES = Object.keys(ACTION_CHOICE_LABEL_KEYS) as ActionChoice[];

/**
 * ADR-248 Phase 4e-4e: the Interactions panel over the open catalog project — the selected
 * node's rules (an instance descendant's: its instance node at the address). Each add · edit ·
 * delete writes the owner's whole list (`setNodeInteractions`), one history step.
 */
export function CatalogInteractionsPanel() {
  return (
    <CatalogWorkspaceGate>
      <CatalogInteractionsContent />
    </CatalogWorkspaceGate>
  );
}

function CatalogInteractionsContent() {
  const { t } = useI18n();
  const first = useCatalogSession((state) => state.selection[0]);
  const pageId = useCatalogSession((state) => state.pageId);
  if (!first)
    return (
      <div className="panel interactions-panel">
        <PanelHeader
          title="Interactions"
          icon={<SquareMousePointer size={14} />}
          panelId="events"
        />
        <PanelContents>
          <EmptyState
            icon={<SquareMousePointer size={32} />}
            message={t("interactions.selectElement")}
          />
        </PanelContents>
      </div>
    );
  return (
    <CatalogRules
      key={targetKey(first.target)}
      target={first.target}
      identity={first.identity}
      pageId={pageId}
    />
  );
}

function CatalogRules({
  target,
  identity,
  pageId,
}: {
  target: EditTarget;
  /** The selected record (ADR-283 — a target is read as this record sees it). */
  identity: string;
  pageId: EntryId<"page"> | undefined;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const owner = useMemo(() => catalogInteractionOwner(target), [target]);
  // The rules' targets and values read across the document (pages, nodes, variables) — the whole
  // revision, not one entry's fields.
  const revision = useCatalogRevision(workspace);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Project variables live in the data store (H1).
  const projectVariables = useProjectVariableDefs();
  // ADR-281 Decision 5 — the endpoints a Form's submit can call (the data store's, H1).
  const apiEndpoints = useDataStore((state) => state.apiEndpoints);
  // The collections a rule can append to (the data store's, H1).
  const collections = useDataStore((state) => state.collections);

  const view = useMemo(() => {
    let targets: CatalogTargetOption[] | undefined;
    // 「선택한 항목」 — the collection the selected record shows (its own binding, an instance's on
    //   the node it collapses) and its selection mode as RAC reads it (the record's props).
    const ownerItemsOf = (): Pick<CatalogActionContext, "ownerItems"> => {
      const record = workspace.root.domInputs.get(identity);
      for (const sourceId of record
        ? [record.sourceId, ...(record.collapsedSourceIds ?? [])]
        : []) {
        const entry = graph.getEntry(sourceId as never);
        const collectionId =
          entry?.kind === "node" ? entry.binding?.collectionId : undefined;
        if (!collectionId) continue;
        const collection = collections.get(
          collectionId.replace(/^data:collection:/, ""),
        );
        return {
          ownerItems: {
            fields: (collection?.schema ?? []).map((field) => ({
              key: field.key,
              type: field.type,
            })),
            single: record?.props.selectionMode === "single",
          },
        };
      }
      return {};
    };
    const componentType = catalogTargetTypeName(graph, target);
    const context: CatalogActionContext = {
      pages: catalogPageOptions(graph),
      currentPageId: pageId,
      variables: catalogVisibleVariables(
        graph,
        owner.ownerId,
        projectVariables,
      ),
      // ADR-283 R6: read when a picker opens (once per graph revision), the first one stops early.
      targets: () =>
        (targets ??= catalogCapabilityTargets(graph, pageId, undefined, owner)),
      firstTarget: () =>
        catalogFirstCapabilityTarget(graph, pageId, undefined, owner),
      endpoints: [...apiEndpoints.values()].map((endpoint) => ({
        id: `data:endpoint:${endpoint.id}` as const,
        name: endpoint.name,
        method: endpoint.method,
      })),
      collections: [...collections.values()].map((collection) => ({
        id: `data:collection:${collection.id}` as const,
        name: collection.name,
        fields: (collection.schema ?? []).flatMap((field) =>
          field.id ? [{ id: field.id, key: field.key }] : [],
        ),
      })),
      ...ownerItemsOf(),
    };
    const exposure = catalogExposureInput(graph, target);
    return {
      componentType,
      exposure,
      triggers: resolveTriggers(componentType),
      // ADR-281 Decision 1 — a new rule starts from a When RAC fires now.
      firstTrigger: exposedTriggerGroups(componentType, exposure)[0]?.events[0],
      rules: catalogInteractionsOf(graph, owner),
      // ADR-281 Decision 4 — what this instance position inherits from its component.
      inherited: catalogInheritedInteractionsOf(graph, owner),
      context,
      choices: CHOICES.filter(
        (choice) => catalogDefaultAction(choice, context) !== undefined,
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read at each graph revision
  }, [
    apiEndpoints,
    collections,
    graph,
    identity,
    owner,
    pageId,
    projectVariables,
    revision,
    target,
    workspace,
  ]);

  const describeTarget = useCallback(
    (ref: CatalogCapabilityTarget) =>
      "unset" in ref ? undefined : catalogTargetOptionOf(graph, ref),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read at each graph revision
    [graph, revision],
  );
  // ADR-283 Decision 2 — the panel reads a target as the selected record sees it (the Preview's
  // `resolveCapabilityTarget`): another row's · instance's place names nothing from here.
  const targetNotice = useCallback(
    (ref: CatalogCapabilityTarget): CatalogTargetNotice | undefined => {
      if ("unset" in ref) return "unset";
      const resolved = resolveCapabilityTarget(
        workspace.root,
        identity,
        ref,
        catalogOriginRootOf(graph, owner.ownerId),
      );
      return "error" in resolved && resolved.error === "TARGET_OUT_OF_CONTEXT"
        ? "outOfContext"
        : undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read at each graph revision
    [graph, identity, owner, revision, workspace],
  );

  const targetExposure = useCallback(
    (edit: EditTarget) => catalogExposureInput(graph, edit),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read at each graph revision
    [graph, revision],
  );
  // ADR-283 Decision 4 — the list ↔ Canvas highlight: an option's record (as the selected record
  // sees it) is the session hover; the Canvas hover marks its option.
  const onTargetHover = useCallback(
    (option: CatalogTargetOption | undefined) => {
      if (!option) return workspace.session.setHover(undefined);
      const resolved = resolveCapabilityTarget(
        workspace.root,
        identity,
        option.ref,
        catalogOriginRootOf(workspace.runtime.graph, owner.ownerId),
      );
      const recordId =
        "recordId" in resolved
          ? resolved.recordId
          : workspace.root.recordsOfSource(
              option.edit.kind === "node"
                ? option.edit.id
                : option.edit.address.templatePath.at(-1)!,
            )[0];
      workspace.session.setHover(
        recordId ? { target: option.edit, identity: recordId } : undefined,
      );
    },
    [identity, owner, workspace],
  );
  const hover = useCatalogSession((state) => state.hover);
  const canvasHoverKey = useMemo(() => {
    if (!hover) return undefined;
    const ref = catalogTargetRefOf(graph, owner, hover.target);
    return ref ? JSON.stringify(ref) : undefined;
  }, [graph, hover, owner]);
  const targetPick = useCatalogSession((state) => state.targetPick);

  const write = (entries: readonly InteractionEntry[], label: string) =>
    run(catalogInteractionsCommand(owner, entries, label));

  const handleAdd = () => {
    const trigger = view.firstTrigger ?? view.triggers[0];
    const action = catalogDefaultAction("navigate", view.context);
    if (!trigger || !action) return;
    const rule = catalogNewInteraction(owner, trigger, action, workspace.newId);
    if (write([...view.rules, rule], "Add interaction")) setExpandedId(rule.id);
  };

  return (
    <div className="panel interactions-panel">
      <PanelHeader
        title="Interactions"
        icon={<SquareMousePointer size={14} />}
        panelId="events"
      />
      <PanelContents>
        {view.inherited.length > 0 && (
          <Section
            title={t("interactions.inheritedTitle")}
            id="interactions-inherited"
            badge={
              <span className="category-count">{view.inherited.length}</span>
            }
          >
            {view.inherited.map(({ rule, status }) => (
              <CatalogInheritedRuleRow
                key={rule.id}
                rule={rule}
                status={status}
                componentType={catalogTargetTypeName(graph, {
                  kind: "node",
                  id: rule.ownerId,
                })}
                onEnabledChange={(enabled) =>
                  run(
                    catalogInheritedRuleEnabledCommand(owner, rule.id, enabled),
                  )
                }
                onReplace={() =>
                  run(
                    catalogReplaceInheritedRuleCommand(
                      owner,
                      rule,
                      workspace.newId,
                    ),
                  )
                }
              />
            ))}
          </Section>
        )}
        <Section
          title={t("interactions.eventsTitle")}
          id="interactions-rules"
          badge={
            view.rules.length > 0 ? (
              <span className="category-count">{view.rules.length}</span>
            ) : undefined
          }
          actions={
            view.triggers.length > 0 ? (
              <ActionIconButton
                aria-label={t("interactions.addEvent")}
                tooltip={t("interactions.addEvent")}
                onPress={handleAdd}
              >
                <AddIcon size={16} />
              </ActionIconButton>
            ) : undefined
          }
        >
          {view.triggers.length === 0 ? (
            <EmptyState
              icon={<SquareMousePointer size={32} />}
              message={t("interactions.noTriggers", {
                type: view.componentType,
              })}
            />
          ) : (
            <>
              {view.rules.length === 0 && (
                <EmptyState
                  icon={<SquareMousePointer size={32} />}
                  message={t("interactions.noEvents")}
                />
              )}
              {view.rules.map((rule) => (
                <CatalogEventRow
                  key={rule.id}
                  rule={rule}
                  componentType={view.componentType}
                  context={view.context}
                  choices={view.choices}
                  describeTarget={describeTarget}
                  targetNotice={targetNotice}
                  onTargetHover={onTargetHover}
                  canvasHoverKey={canvasHoverKey}
                  aiming={targetPick?.ruleId === rule.id}
                  onAim={() =>
                    workspace.session.setTargetPick(
                      targetPick?.ruleId === rule.id ? undefined : rule.id,
                    )
                  }
                  exposure={view.exposure}
                  targetExposure={targetExposure}
                  expanded={expandedId === rule.id}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === rule.id ? null : rule.id,
                    )
                  }
                  onChange={(next) =>
                    write(
                      view.rules.map((item) =>
                        item.id === next.id ? next : item,
                      ),
                      "Edit interaction",
                    )
                  }
                  onRemove={() => {
                    if (expandedId === rule.id) setExpandedId(null);
                    write(
                      view.rules.filter((item) => item.id !== rule.id),
                      "Delete interaction",
                    );
                  }}
                />
              ))}
            </>
          )}
        </Section>
      </PanelContents>
    </div>
  );
}
