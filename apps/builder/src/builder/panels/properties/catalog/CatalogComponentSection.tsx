import { memo, useCallback, useSyncExternalStore } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { Diamond } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  DefinitionId,
  EntryId,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogComponentCommands,
  catalogComponentState,
} from "../../../catalogRuntime/componentActions";
import { catalogSemanticPatchCommand } from "../../../catalogRuntime/editContract";
import {
  useCatalogOwnFields,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { PropertySection } from "../../../components";
import { ActionTooltipTrigger } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

const ComponentIcon = ACTION_ICONS.component;

/**
 * ADR-248 Phase 4e-4: the Component section over the catalog document — an instance shows what it
 * is an instance of, its own overrides (each resettable) and detach; a project component's
 * instance also selects all instances and dissolves the component; any other node can become a
 * component (it turns into the template and an instance takes its place). Each action is one step.
 */
export const CatalogComponentSection = memo(function CatalogComponentSection({
  nodeId,
}: {
  nodeId: NodeId;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const stateKey = useSyncExternalStore(subscribe, () =>
    JSON.stringify(catalogComponentState(graph, nodeId)),
  );
  const { instanceOf } = JSON.parse(stateKey) as ReturnType<
    typeof catalogComponentState
  >;
  const own = useCatalogOwnFields({ kind: "node", id: nodeId });
  const overrides = instanceOf ? Object.keys(own.props) : [];

  const create = useCallback(() => {
    const node = graph.getEntry(nodeId);
    // An unnamed node names its component after what it is (Frame, Card …).
    const name =
      (node?.kind === "node" &&
        (node.name ||
          graph.getDefinition(node.definitionId as DefinitionId)?.name)) ||
      t("componentAction.createComponent");
    run(catalogComponentCommands.create(nodeId, name, workspace.newId));
  }, [graph, nodeId, run, t, workspace]);
  const detach = useCallback(
    () => run(catalogComponentCommands.detach(nodeId, workspace.newId)),
    [nodeId, run, workspace],
  );
  const dissolve = useCallback(() => {
    if (instanceOf)
      run(
        catalogComponentCommands.dissolve(
          instanceOf.definitionId,
          workspace.newId,
        ),
      );
  }, [instanceOf, run, workspace]);
  const selectInstances = useCallback(() => {
    if (!instanceOf) return;
    workspace.session.select(
      instanceOf.instanceIds.flatMap((id) => workspace.itemsOfNode(id, 1)),
    );
  }, [instanceOf, workspace]);
  const reset = useCallback(
    (key: string) => {
      const command = catalogSemanticPatchCommand(
        [{ kind: "node", id: nodeId }],
        { [key]: undefined },
        () => true,
      );
      if (command) run(command);
    },
    [nodeId, run],
  );

  return (
    <PropertySection title="Component">
      {instanceOf && (
        <div className="fieldset-row">
          <div className="component-semantics-identity" data-role="instance">
            <ComponentIcon aria-hidden="true" size={14} />
            <span
              className="component-semantics-identity-name"
              title={instanceOf.name}
            >
              {instanceOf.name}
            </span>
            <span className="component-semantics-identity-role">
              {t("properties.instance")}
            </span>
          </div>
        </div>
      )}
      <div className="fieldset-row">
        <div className="component-semantics-strip">
          {instanceOf?.project && (
            <ActionTooltipTrigger tooltip={t("componentAction.goToOrigin")}>
              <RACButton
                aria-label={t("componentAction.goToOrigin")}
                className="control-button"
                data-icon-only="true"
                onPress={() =>
                  workspace.showDefinition(
                    instanceOf.definitionId as EntryId<"definition">,
                  )
                }
              >
                <ACTION_ICONS.goToOrigin
                  aria-hidden="true"
                  size={iconProps.size}
                />
              </RACButton>
            </ActionTooltipTrigger>
          )}
          {instanceOf && (
            <ActionTooltipTrigger
              shortcutId="detachInstance"
              tooltip={t("componentAction.detachInstance")}
            >
              <RACButton
                aria-label={t("componentAction.detachInstance")}
                className="control-button"
                data-icon-only="true"
                onPress={detach}
              >
                <ACTION_ICONS.detach aria-hidden="true" size={iconProps.size} />
              </RACButton>
            </ActionTooltipTrigger>
          )}
          {instanceOf?.project && (
            <ActionTooltipTrigger
              tooltip={t("componentAction.selectInstances", {
                count: instanceOf.instanceIds.length,
              })}
            >
              <RACButton
                aria-label={t("componentAction.selectInstances", {
                  count: instanceOf.instanceIds.length,
                })}
                className="control-button"
                data-icon-only="true"
                onPress={selectInstances}
              >
                <Diamond aria-hidden="true" size={iconProps.size} />
                <span aria-hidden="true" className="component-semantics-count">
                  {instanceOf.instanceIds.length}
                </span>
              </RACButton>
            </ActionTooltipTrigger>
          )}
          {instanceOf?.project ? (
            <RACButton className="control-button" onPress={dissolve}>
              <ACTION_ICONS.detach aria-hidden="true" size={iconProps.size} />
              {t("componentAction.detachComponent")}
            </RACButton>
          ) : (
            !instanceOf && (
              <RACButton className="control-button" onPress={create}>
                <ACTION_ICONS.createComponent
                  aria-hidden="true"
                  size={iconProps.size}
                />
                {t("componentAction.createComponent")}
              </RACButton>
            )
          )}
        </div>
      </div>
      {overrides.length > 0 && (
        <fieldset className="properties-aria component-semantics-overrides">
          <legend className="fieldset-legend">
            {t("propertiesPanel.overridesLegend")}
          </legend>
          <div className="react-aria-Group component-semantics-field-list">
            {overrides.map((key) => (
              <button
                aria-label={t("propertiesPanel.resetOverride", { label: key })}
                className="component-semantics-field"
                key={key}
                onClick={() => reset(key)}
                type="button"
              >
                <span className="component-semantics-field-dot" />
                <span className="component-semantics-field-name">{key}</span>
                <span className="component-semantics-field-reset">
                  {t("propertiesPanel.reset")}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </PropertySection>
  );
});
