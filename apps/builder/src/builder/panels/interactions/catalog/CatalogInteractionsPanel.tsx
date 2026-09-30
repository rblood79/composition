import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { SquareMousePointer } from "lucide-react";
import { resolveTriggers } from "@composition/shared";
import type {
  EditTarget,
  EntryId,
  InteractionEntry,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogCapabilityTargets,
  catalogDefaultAction,
  catalogInteractionOwner,
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
import {
  EmptyState,
  PanelContents,
  PanelHeader,
  Section,
} from "../../../components";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useI18n } from "@/i18n";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { ACTION_CHOICE_LABEL_KEYS } from "../labels";
import type { ActionChoice } from "../types";
import { CatalogRuleRow } from "./CatalogRuleRow";
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

  const view = useMemo(() => {
    const componentType = catalogTargetTypeName(graph, target);
    const context: CatalogActionContext = {
      pages: catalogPageOptions(graph),
      currentPageId: pageId,
      variables: catalogVisibleVariables(graph, owner.ownerId),
      targets: catalogCapabilityTargets(
        graph,
        pageId,
        target.kind === "node" ? target.id : undefined,
      ),
    };
    return {
      componentType,
      triggers: resolveTriggers(componentType),
      rules: catalogInteractionsOf(graph, owner),
      context,
      choices: CHOICES.filter(
        (choice) => catalogDefaultAction(choice, context) !== undefined,
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read at each graph revision
  }, [graph, owner, pageId, revision, target]);

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

  const write = (entries: readonly InteractionEntry[], label: string) =>
    run(catalogInteractionsCommand(owner, entries, label));

  const handleAdd = () => {
    const trigger = view.triggers[0];
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
