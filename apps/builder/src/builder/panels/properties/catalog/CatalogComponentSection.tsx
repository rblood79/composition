import { memo, useCallback, useSyncExternalStore } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { Diamond } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  CatalogReader,
  DefinitionId,
  EditTarget,
  InstanceAddress,
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
import { definitionTypeName } from "../../../../../../../packages/shared/src/catalog/commands/context";
import { useToastStore } from "../../../stores/toast";
import { Section as PropertySection } from "../../../components/panel/Section";
import { ActionTooltipTrigger } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

const ComponentIcon = ACTION_ICONS.component;

/** The fields an instance's template-position patch writes (each key a resettable row). */
const PATCH_FIELDS = ["props", "visual", "sizing", "layout"] as const;
interface OverrideRow {
  /** The row's React key — a template position's path, since two positions can share a label. */
  id: string;
  key: string;
  field: (typeof PATCH_FIELDS)[number];
  /** The field key; at a template position, `position.key` (its node's name, else its type). */
  label: string;
  target: EditTarget;
}

function templateLabel(graph: CatalogReader, id: string | undefined): string {
  if (!id) return "";
  const entry = id.startsWith("lib:")
    ? graph.library.templates.get(id as `lib:template:${string}`)
    : graph.getEntry(id);
  const named = entry as { name?: string; definitionId?: string } | undefined;
  if (named?.name) return named.name;
  try {
    return named?.definitionId
      ? definitionTypeName(graph, named.definitionId as DefinitionId)
      : id;
  } catch {
    return id;
  }
}

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
  const rootTarget: EditTarget = { kind: "node", id: nodeId };
  // The instance's writes at its template positions (the old list's `path.field` rows).
  const patchKey = useSyncExternalStore(subscribe, () => {
    if (!instanceOf) return "[]";
    const node = graph.getEntry(nodeId);
    if (node?.kind !== "node") return "[]";
    return JSON.stringify(
      node.descendantOverrides.flatMap((item) => {
        if (item.kind !== "patch") return [];
        const at = templateLabel(graph, item.address.templatePath.at(-1));
        return PATCH_FIELDS.flatMap((field) =>
          Object.keys(item[field] ?? {}).map((key) => ({
            id: `${field}:${item.address.instances.join("/")}|${item.address.templatePath.join("/")}:${key}`,
            key,
            field,
            label: `${at}.${key}`,
            address: item.address,
          })),
        );
      }),
    );
  });
  const rows: OverrideRow[] = listsOwn
    ? [
        ...Object.keys(own.props).map((key) => ({
          id: `props:${key}`,
          key,
          field: "props" as const,
          label: key,
          target: rootTarget,
        })),
        ...Object.keys(own.visual).map((key) => ({
          id: `visual:${key}`,
          key,
          field: "visual" as const,
          label: key,
          target: rootTarget,
        })),
        ...(
          JSON.parse(patchKey) as (Omit<OverrideRow, "target"> & {
            address: InstanceAddress;
          })[]
        ).map(({ address, ...row }) => ({
          ...row,
          target: { kind: "descendant", ownerId: nodeId, address } as const,
        })),
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
    if (!originOf) return;
    // From the origin's view: back to the pages, where the instances are drawn.
    if (definitionView) workspace.showDefinition(undefined);
    workspace.session.select(
      originOf.instanceIds.flatMap((id) => workspace.itemsOfNode(id, 1)),
    );
  }, [originOf, definitionView, workspace]);
  const reset = useCallback(
    ({ key, field, label, target }: OverrideRow) => {
      const command =
        field === "props"
          ? catalogSemanticPatchCommand(
              [target],
              { [key]: undefined },
              () => true,
            )
          : setFields({
              targets: [target],
              [field]: { [key as VisualField]: { kind: "remove" } },
              label: "Reset override",
            } as Parameters<typeof setFields>[0]);
      // No confirmation (the flow keeps going); one step, so the toast's undo restores it.
      if (command && run(command))
        useToastStore
          .getState()
          .showToast("info", t("propertiesPanel.overrideCleared", { label }), {
            bypassCooldown: true,
            action: {
              label: t("errors.undo"),
              onClick: () => workspace.undo(),
            },
          });
    },
    [run, t, workspace],
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
          {/* The origin's instances (an instance itself has none to pick — old app's rule). */}
          {originOf && originOf.instanceIds.length > 0 && (
            <ActionTooltipTrigger
              tooltip={t("componentAction.selectInstances", {
                count: originOf.instanceIds.length,
              })}
            >
              <RACButton
                aria-label={t("componentAction.selectInstances", {
                  count: originOf.instanceIds.length,
                })}
                className="control-button"
                data-icon-only="true"
                onPress={selectInstances}
              >
                <Diamond aria-hidden="true" size={iconProps.size} />
                <span aria-hidden="true" className="component-semantics-count">
                  {originOf.instanceIds.length}
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
      {rows.length > 0 && (
        <fieldset className="properties-aria component-semantics-overrides">
          <legend className="fieldset-legend">
            {instanceOf
              ? t("propertiesPanel.overridesLegend")
              : t("propertiesPanel.originDefaultsLegend")}
          </legend>
          <div className="react-aria-Group component-semantics-field-list">
            {rows.map((row) => (
              <button
                aria-label={t("propertiesPanel.resetOverride", {
                  label: row.label,
                })}
                className="component-semantics-field"
                key={row.id}
                onClick={() => reset(row)}
                type="button"
              >
                <span className="component-semantics-field-dot" />
                <span className="component-semantics-field-name">
                  {row.label}
                </span>
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
