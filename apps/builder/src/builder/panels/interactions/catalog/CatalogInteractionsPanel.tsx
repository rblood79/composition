import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { SquareMousePointer } from "lucide-react";
import { exposedTriggerGroups, resolveTriggers } from "@composition/shared";
import type {
  EditTarget,
  EntryId,
  InteractionEntry,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogCapabilityTargets,
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
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { targetKey } from "../../../catalogRuntime/session";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { PanelContents } from "../../../components/panel/PanelContents";
import { PanelHeader } from "../../../components/panel/PanelHeader";
import { Section } from "../../../components/panel/Section";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useI18n } from "@/i18n";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { ACTION_CHOICE_LABEL_KEYS } from "../labels";
import type { ActionChoice } from "../types";
import { useDataStore, useProjectVariableDefs } from "../../../stores/data";
import { CatalogRuleRow } from "./CatalogRuleRow";
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
      pageId={pageId}
    />
  );
}

function CatalogRules({
  target,
  pageId,
}: {
  target: EditTarget;
  pageId: EntryId<"page"> | undefined;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const owner = useMemo(() => catalogInteractionOwner(target), [target]);
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const revision = useSyncExternalStore(subscribe, () => graph.revision);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Project variables live in the data store (H1).
  const projectVariables = useProjectVariableDefs();
  // ADR-281 Decision 5 — the endpoints a Form's submit can call (the data store's, H1).
  const apiEndpoints = useDataStore((state) => state.apiEndpoints);
  // The collections a rule can append to (the data store's, H1).
  const collections = useDataStore((state) => state.collections);

  const view = useMemo(() => {
    const componentType = catalogTargetTypeName(graph, target);
    const context: CatalogActionContext = {
      pages: catalogPageOptions(graph),
      currentPageId: pageId,
      variables: catalogVisibleVariables(graph, owner.ownerId, projectVariables),
      targets: catalogCapabilityTargets(
        graph,
        pageId,
        target.kind === "node" ? target.id : undefined,
      ),
      endpoints: [...apiEndpoints.values()].map((endpoint) => ({
        id: `data:endpoint:${endpoint.id}` as const,
        name: endpoint.name,
        method: endpoint.method,
      })),
      collections: [...collections.values()].map((collection) => ({
        id: `data:collection:${collection.id}` as const,
        name: collection.name,
      })),
    };
    const exposure = catalogExposureInput(graph, target);
    return {
      componentType,
      exposure,
      triggers: resolveTriggers(componentType),
      // ADR-281 Decision 1 — a new rule starts from a When RAC fires now.
      firstTrigger: exposedTriggerGroups(componentType, exposure)[0]
        ?.events[0],
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
    owner,
    pageId,
    projectVariables,
    revision,
    target,
  ]);

  const describeTarget = useCallback(
    (id: NodeId) => {
      if (graph.getEntry(id)?.kind !== "node") return undefined;
      const node = graph.getEntry(id);
      return {
        id,
        type: catalogTargetTypeName(graph, { kind: "node", id }),
        ...(node?.kind === "node" && node.name ? { name: node.name } : {}),
      };
    },
    [graph],
  );

  const targetExposure = useCallback(
    (id: NodeId) => catalogExposureInput(graph, { kind: "node", id }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read at each graph revision
    [graph, revision],
  );

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
            badge={String(view.inherited.length)}
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
                  run(catalogInheritedRuleEnabledCommand(owner, rule.id, enabled))
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
          title={t("interactions.rulesTitle")}
          id="interactions-rules"
          badge={view.rules.length > 0 ? String(view.rules.length) : undefined}
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
                  message={t("interactions.noRules")}
                />
              )}
              {view.rules.map((rule) => (
                <CatalogRuleRow
                  key={rule.id}
                  rule={rule}
                  componentType={view.componentType}
                  context={view.context}
                  choices={view.choices}
                  describeTarget={describeTarget}
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
              <button
                type="button"
                className="control-button"
                data-variant="add"
                onClick={handleAdd}
              >
                <AddIcon size={14} />
                {t("interactions.addRule")}
              </button>
            </>
          )}
        </Section>
      </PanelContents>
    </div>
  );
}
