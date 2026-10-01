import { memo, useCallback, useSyncExternalStore } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { Diamond } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  DefinitionId,
  NodeId,
  VisualField,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogComponentCommands,
  catalogComponentState,
} from "../../../catalogRuntime/componentActions";
import {
  confirmCatalogDetach,
  confirmCatalogDissolve,
} from "../../../catalogRuntime/componentConfirm";
import { catalogSemanticPatchCommand } from "../../../catalogRuntime/editContract";
import type { CatalogDefinitionViewId } from "../../../catalogRuntime/session";
import {
  useCatalogOwnFields,
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { setFields } from "../../../../../../../packages/shared/src/catalog/commands";
import { Section as PropertySection } from "../../../components/panel/Section";
import { ActionTooltipTrigger } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

const ComponentIcon = ACTION_ICONS.component;

/**
 * ADR-248 Phase 4e-4: the Component section over the catalog document (the old section's actions,
 * user 2026-10-01) —
 * - an instance (of a project component or a built-in origin): what it is an instance of, go to
 *   component (the project template, or the built-in origin's view), detach, select instances,
 *   its own overrides (props and styles, each resettable); a project component's also dissolves;
 * - the origin the definition edit view shows: what it is the origin of, select instances, and a
 *   project component dissolves; a built-in origin lists its project defaults (each resettable);
 * - any other node (and an instance, as the old section did) can become a component.
 * Each action is one step.
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
  const definitionView = useCatalogSession((state) => state.definitionView);
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const stateKey = useSyncExternalStore(subscribe, () =>
    JSON.stringify(catalogComponentState(graph, nodeId, definitionView)),
  );
  const { instanceOf, originOf } = JSON.parse(stateKey) as ReturnType<
    typeof catalogComponentState
  >;
  const component = instanceOf ?? originOf;
  const own = useCatalogOwnFields({ kind: "node", id: nodeId });
  // An instance's overrides, or a built-in origin's project defaults (its sample's own fields).
  const listsOwn = !!instanceOf || (!!originOf && !originOf.project);
  const overrides = listsOwn
    ? [
        ...Object.keys(own.props).map((key) => ({ key, visual: false })),
        ...Object.keys(own.visual).map((key) => ({ key, visual: true })),
      ]
    : [];

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
  // Detach and dissolve ask first (the old component confirmation dialog).
  const detach = useCallback(
    () =>
      void confirmCatalogDetach(graph, nodeId, () =>
        run(catalogComponentCommands.detach(nodeId, workspace.newId)),
      ),
    [graph, nodeId, run, workspace],
  );
  const dissolve = useCallback(() => {
    if (component?.project)
      void confirmCatalogDissolve(graph, component.definitionId, () =>
        run(
          catalogComponentCommands.dissolve(
            component.definitionId,
            workspace.newId,
          ),
        ),
      );
  }, [graph, component, run, workspace]);
  const selectInstances = useCallback(() => {
    if (!component) return;
    // From the origin's view: back to the pages, where the instances are drawn.
    if (definitionView) workspace.showDefinition(undefined);
    workspace.session.select(
      component.instanceIds.flatMap((id) => workspace.itemsOfNode(id, 1)),
    );
  }, [component, definitionView, workspace]);
  const reset = useCallback(
    (key: string, visual: boolean) => {
      const command = visual
        ? setFields({
            targets: [{ kind: "node", id: nodeId }],
            visual: { [key as VisualField]: { kind: "remove" } },
            label: "Reset override",
          })
        : catalogSemanticPatchCommand(
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
      {component && (
        <div className="fieldset-row">
          <div
            className="component-semantics-identity"
            data-role={instanceOf ? "instance" : "origin"}
          >
            <ComponentIcon aria-hidden="true" size={14} />
            <span
              className="component-semantics-identity-name"
              title={component.name}
            >
              {component.name}
            </span>
            <span className="component-semantics-identity-role">
              {instanceOf ? t("properties.instance") : t("properties.origin")}
            </span>
          </div>
        </div>
      )}
      <div className="fieldset-row">
        <div className="component-semantics-strip">
          {instanceOf && (
            <ActionTooltipTrigger tooltip={t("componentAction.goToOrigin")}>
              <RACButton
                aria-label={t("componentAction.goToOrigin")}
                className="control-button"
                data-icon-only="true"
                onPress={() =>
                  workspace.showDefinition(
                    instanceOf.definitionId as CatalogDefinitionViewId,
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
          {component && component.instanceIds.length > 0 && (
            <ActionTooltipTrigger
              tooltip={t("componentAction.selectInstances", {
                count: component.instanceIds.length,
              })}
            >
              <RACButton
                aria-label={t("componentAction.selectInstances", {
                  count: component.instanceIds.length,
                })}
                className="control-button"
                data-icon-only="true"
                onPress={selectInstances}
              >
                <Diamond aria-hidden="true" size={iconProps.size} />
                <span aria-hidden="true" className="component-semantics-count">
                  {component.instanceIds.length}
                </span>
              </RACButton>
            </ActionTooltipTrigger>
          )}
          {component?.project && (
            <RACButton className="control-button" onPress={dissolve}>
              <ACTION_ICONS.detach aria-hidden="true" size={iconProps.size} />
              {t("componentAction.detachComponent")}
            </RACButton>
          )}
          {!originOf && (
            <RACButton className="control-button" onPress={create}>
              <ACTION_ICONS.createComponent
                aria-hidden="true"
                size={iconProps.size}
              />
              {t("componentAction.createComponent")}
            </RACButton>
          )}
        </div>
      </div>
      {overrides.length > 0 && (
        <fieldset className="properties-aria component-semantics-overrides">
          <legend className="fieldset-legend">
            {instanceOf
              ? t("propertiesPanel.overridesLegend")
              : t("propertiesPanel.originDefaultsLegend")}
          </legend>
          <div className="react-aria-Group component-semantics-field-list">
            {overrides.map(({ key, visual }) => (
              <button
                aria-label={t("propertiesPanel.resetOverride", { label: key })}
                className="component-semantics-field"
                key={`${visual ? "visual" : "prop"}:${key}`}
                onClick={() => reset(key, visual)}
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
