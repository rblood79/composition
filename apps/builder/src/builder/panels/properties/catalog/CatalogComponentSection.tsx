import { memo, useCallback } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { Diamond } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  EntryId,
  CatalogReader,
  DefinitionId,
  EditTarget,
  InstanceAddress,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  ResponsiveBreakpointName,
  StateName,
  VisualField,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { componentPropertiesOf } from "../../../../../../../packages/shared/src/catalog/document/componentProperties";
import {
  catalogComponentCommands,
  catalogComponentState,
} from "../../../catalogRuntime/componentActions";
import {
  confirmCatalogDetach,
  confirmCatalogDissolve,
  confirmCatalogPush,
  promptCatalogComponentName,
} from "../../../catalogRuntime/componentConfirm";
import { catalogPropertiesPatchCommand } from "../../../catalogRuntime/editContract";
import type { CatalogDefinitionViewId } from "../../../catalogRuntime/session";
import {
  useCatalogOwnFields,
  useCatalogSession,
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import {
  renameDefinition,
  resetOverrideField,
  resetReplacement,
  setFields,
  type ResetOverrideFieldInput,
} from "../../../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../../../packages/shared/src/catalog/commands/context";
import { useToastStore } from "../../../stores/toast";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { ActionTooltipTrigger } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import { catalogSwapPlan } from "../../../catalogRuntime/swapInstance";
import { CatalogSwapPicker } from "./CatalogSwapPicker";
import { CatalogInstancePropertiesRows } from "./CatalogInstancePropertiesSection";
import { catalogComponentLabel } from "../../../catalogRuntime/componentProperties";
import { catalogOriginOverride } from "../../../catalogRuntime/originView";
import { setLibraryDefault } from "../../../../../../../packages/shared/src/catalog/commands";

const ComponentIcon = ACTION_ICONS.component;

/** The fields an instance's template-position patch writes (each key a resettable row). */
const PATCH_FIELDS = ["props", "visual", "sizing", "layout"] as const;
/** The whole-value override kinds (ADR-262 Phase 2 — one row each: Figma lists every change). */
const WHOLE_FIELDS = ["fills", "fillSizing", "visibility"] as const;
interface OverrideRow {
  /** The row's React key — a template position's path, since two positions can share a label. */
  id: string;
  key: string;
  /**
   * `replace` = a swapped nested instance (ADR-261 Phase 5 — its reset folds it back); `enabled`
   * = a hidden position; `stateRules` · `responsive` rows carry their state · breakpoint.
   */
  field:
    | (typeof PATCH_FIELDS)[number]
    | (typeof WHOLE_FIELDS)[number]
    | "replace"
    | "enabled"
    | "stateRules"
    | "responsive";
  state?: StateName;
  breakpoint?: ResponsiveBreakpointName;
  /** `responsive`: the layer field the key is in (absent = `visual`). */
  axis?: "sizing" | "layout";
  replacementId?: NodeId;
  /** The field key; at a template position, `position.key` (its node's name, else its type). */
  label: string;
  target: EditTarget;
}
type RowSeed = Omit<OverrideRow, "target" | "label"> & { label: string };
/**
 * The rows of one override holder's whole · state · breakpoint fields (`prefix` = the position).
 * A position's breakpoint `sizing` · `layout` are overrides too; the root's are its placement,
 * which reset keeps (ADR-262 decision 3), so they list only at a position (review Round 3 m2).
 */
function extraRows(
  fields: Pick<
    NodeEntry,
    "fills" | "fillSizing" | "visibility" | "stateRules" | "responsive"
  > & { enabled?: boolean },
  prefix: string,
  id: string,
  t: (key: string) => string,
  placementIsOverride = false,
): RowSeed[] {
  const rows: RowSeed[] = [];
  if (fields.enabled === false)
    rows.push({
      id: `enabled:${id}`,
      key: "enabled",
      field: "enabled",
      label: `${prefix}${t("propertiesPanel.overrideHidden")}`,
    });
  const names = {
    fills: t("propertiesPanel.overrideFill"),
    fillSizing: t("propertiesPanel.overrideFillSizing"),
    visibility: t("propertiesPanel.overrideVisibility"),
  };
  for (const field of WHOLE_FIELDS)
    if (fields[field])
      rows.push({
        id: `${field}:${id}`,
        key: field,
        field,
        label: `${prefix}${names[field]}`,
      });
  for (const [state, writes] of Object.entries(fields.stateRules ?? {}))
    for (const key of Object.keys(writes ?? {}))
      rows.push({
        id: `state:${id}:${state}:${key}`,
        key,
        field: "stateRules",
        state: state as StateName,
        label: `${prefix}${state}.${key}`,
      });
  for (const [name, layer] of Object.entries(fields.responsive ?? {})) {
    const breakpoint = name as ResponsiveBreakpointName;
    for (const key of Object.keys(layer?.visual ?? {}))
      rows.push({
        id: `layer:${id}:${name}:${key}`,
        key,
        field: "responsive",
        breakpoint,
        label: `${prefix}${name}.${key}`,
      });
    if (placementIsOverride)
      for (const axis of ["sizing", "layout"] as const)
        for (const key of Object.keys(layer?.[axis] ?? {}))
          rows.push({
            id: `layer:${id}:${name}:${axis}:${key}`,
            key,
            field: "responsive",
            breakpoint,
            axis,
            label: `${prefix}${name}.${key}`,
          });
    if (layer?.fillSizing)
      rows.push({
        id: `layer:${id}:${name}:fillSizing`,
        key: "",
        field: "responsive",
        breakpoint,
        label: `${prefix}${name}.${names.fillSizing}`,
      });
  }
  return rows;
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
 * - the origin (a project component's node in place — ADR-260 — or the root the definition edit
 *   view shows): what it is the origin of, select instances, and a project component dissolves
 *   (the node stays); a built-in origin lists its project defaults (each resettable);
 * - an instance of a component whose origin was deleted also restores the origin beside it;
 * - any other node (and an instance, as the old section did) can become a component.
 * Each action is one step.
 */
export const CatalogComponentSection = memo(function CatalogComponentSection({
  target,
}: {
  /**
   * An owned node, or a position of an instance's template — an instance of its row's definition
   * (a ToggleButtonGroup's "Toggle 1" is a ToggleButton instance, user 2026-10-14): identity, go
   * to origin and its own overrides; create and detach need an owned node.
   */
  target: EditTarget;
}) {
  const nodeId = target.kind === "node" ? target.id : undefined;
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const definitionView = useCatalogSession((state) => state.definitionView);
  const { instanceOf, originOf, unlocked } = useCatalogStepReading(
    workspace,
    (): ReturnType<typeof catalogComponentState> =>
      catalogComponentState(graph, target, definitionView),
  );
  const component = instanceOf ?? originOf;
  const own = useCatalogOwnFields(target);
  // An instance's overrides, or a built-in origin's project defaults (its sample's own fields).
  // (An unlocked origin's copy root: its own fields are its template's, not the project's
  // defaults — those are its override's, edited below — ADR-282.)
  const listsOwn =
    !!instanceOf || (!!originOf && !originOf.project && !unlocked);
  const rootTarget: EditTarget = target;
  // The instance's writes at its template positions (the old list's `path.field` rows) and its
  // root's whole · state · breakpoint overrides (ADR-262 — every kind a Reset reaches).
  // (One graph read per step — the ADR-246 selection ratchet counts `getEntry`.)
  type OverrideRows = [
    RowSeed[],
    (Omit<OverrideRow, "target"> & { address: InstanceAddress })[],
  ];
  const [rootExtraRows, patchRows] = useCatalogStepReading(
    workspace,
    (): OverrideRows => {
      if (!instanceOf || !nodeId) return [[], []];
      const node = graph.getEntry(nodeId);
      if (node?.kind !== "node") return [[], []];
      return [
        extraRows(node, "", "root", t),
        node.descendantOverrides.flatMap(
          (
            item,
          ): (Omit<OverrideRow, "target"> & { address: InstanceAddress })[] => {
            const at = templateLabel(graph, item.address.templatePath.at(-1));
            const positionId = `${item.address.instances.join("/")}|${item.address.templatePath.join("/")}`;
            if (item.kind === "replace") {
              const shown = graph.getEntry(item.replacementId);
              return [
                {
                  id: `replace:${item.address.instances.join("/")}|${item.address.templatePath.join("/")}`,
                  key: "",
                  field: "replace" as const,
                  replacementId: item.replacementId,
                  label: `${at} → ${shown?.kind === "node" ? catalogComponentLabel(graph, shown.definitionId) : ""}`,
                  address: item.address,
                },
              ];
            }
            return [
              ...PATCH_FIELDS.flatMap((field) =>
                Object.keys(item[field] ?? {}).map((key) => ({
                  id: `${field}:${positionId}:${key}`,
                  key,
                  field,
                  label: `${at}.${key}`,
                  address: item.address,
                })),
              ),
              ...extraRows(item, `${at}.`, positionId, t, true).map((row) => ({
                ...row,
                address: item.address,
              })),
            ];
          },
        ),
      ];
    },
  );
  // ADR-262: push · reset all act on the selected instance itself (not a position inside one) —
  // the same test as `catalogOverrideCleanupTarget`, from the state already read above.
  const cleanupTarget =
    instanceOf && !originOf && nodeId
      ? { id: nodeId, name: instanceOf.name }
      : undefined;
  // ADR-261 Decision 4: a component property's value reads as the property's name.
  const propertyNames = new Map(
    (instanceOf?.definitionId.startsWith("project:")
      ? (componentPropertiesOf(
          graph.getEntry(instanceOf.definitionId as DefinitionId),
        ) ?? [])
      : []
    ).map((property) => [property.key, property.name]),
  );
  const rows: OverrideRow[] = listsOwn
    ? [
        ...Object.keys(own.props).map((key) => ({
          id: `props:${key}`,
          key,
          field: "props" as const,
          label: propertyNames.get(key) ?? key,
          target: rootTarget,
        })),
        ...Object.keys(own.visual).map((key) => ({
          id: `visual:${key}`,
          key,
          field: "visual" as const,
          label: key,
          target: rootTarget,
        })),
        ...rootExtraRows.map((row) => ({
          ...row,
          target: rootTarget,
        })),
        ...patchRows.map(({ address, ...row }) => ({
          ...row,
          target: {
            kind: "descendant",
            ownerId: nodeId!,
            address,
          } as const,
        })),
      ]
    : [];

  const create = useCallback(() => {
    if (!nodeId) return;
    const node = graph.getEntry(nodeId);
    // An unnamed node names its component after what it is (Frame, Card …).
    const name =
      (node?.kind === "node" &&
        (node.name ||
          graph.getDefinition(node.definitionId as DefinitionId)?.name)) ||
      t("componentAction.createComponent");
    // ADR-279 Decision 3a: the name is asked first (the dialog; none = this default).
    void promptCatalogComponentName(name, (typed) =>
      run(catalogComponentCommands.create(nodeId, typed, workspace.newId)),
    );
  }, [graph, nodeId, run, t, workspace]);
  // ADR-279 Decision 3b: the origin's name (the Local page card's title) is edited here too.
  const rename = useCallback(
    (name: string) => {
      if (!originOf?.project || name.trim() === originOf.name) return;
      run(
        renameDefinition({
          id: originOf.definitionId as EntryId<"definition">,
          name,
          label: "Rename component",
        }),
      );
    },
    [originOf, run],
  );
  // Detach and dissolve ask first (the old component confirmation dialog).
  const detach = useCallback(() => {
    if (!nodeId) return;
    void confirmCatalogDetach(graph, nodeId, () =>
      run(catalogComponentCommands.detach(nodeId, workspace.newId)),
    );
  }, [graph, nodeId, run, workspace]);
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
  // ADR-261 Decision 2: one step; the notice counts what moved, what was dropped and what moved
  // out (user decisions 1 · 6), with undo.
  const swap = useCallback(
    (definitionId: DefinitionId) => {
      if (!nodeId) return;
      const { command, report } = catalogSwapPlan(graph, nodeId, definitionId);
      if (!run(command)) return;
      const name = graph.getDefinition(definitionId)?.name ?? definitionId;
      useToastStore.getState().showToast(
        "info",
        t("componentAction.swapped", {
          name,
          kept: report.kept,
          dropped: report.dropped,
          movedOut: report.movedOut,
          targetsUnset: report.targetsUnset,
        }),
        {
          bypassCooldown: true,
          action: { label: t("errors.undo"), onClick: () => workspace.undo() },
        },
      );
    },
    [graph, nodeId, run, t, workspace],
  );
  // ADR-262 (user decision 4): push asks when other instances take it; reset all is a toast + undo.
  const pushChanges = useCallback(() => {
    if (!cleanupTarget) return;
    const { id, name } = cleanupTarget;
    void confirmCatalogPush(graph, id, () => {
      if (!run(catalogComponentCommands.push(id, workspace.newId))) return;
      useToastStore
        .getState()
        .showToast("info", t("componentAction.pushed", { name }), {
          bypassCooldown: true,
          action: { label: t("errors.undo"), onClick: () => workspace.undo() },
        });
    });
  }, [cleanupTarget, graph, run, t, workspace]);
  const resetAll = useCallback(() => {
    if (!cleanupTarget) return;
    if (!run(catalogComponentCommands.resetAll(cleanupTarget.id))) return;
    useToastStore
      .getState()
      .showToast("info", t("componentAction.resetAllDone"), {
        bypassCooldown: true,
        action: { label: t("errors.undo"), onClick: () => workspace.undo() },
      });
  }, [cleanupTarget, run, t, workspace]);
  const reset = useCallback(
    ({
      key,
      field,
      label,
      target,
      replacementId,
      state,
      breakpoint,
      axis,
    }: OverrideRow) => {
      const command =
        field === "replace"
          ? resetReplacement({ id: replacementId! })
          : field === "enabled" ||
              field === "fills" ||
              field === "fillSizing" ||
              field === "visibility" ||
              field === "stateRules" ||
              field === "responsive"
            ? resetOverrideField({
                target,
                field,
                ...(state ? { state } : {}),
                ...(breakpoint ? { breakpoint } : {}),
                ...(axis ? { axis } : {}),
                ...(key ? { key } : {}),
                label: "Reset override",
              } as ResetOverrideFieldInput)
            : field === "props"
              ? catalogPropertiesPatchCommand(
                  graph,
                  [target],
                  { [key]: undefined },
                  () => true,
                  new Set(),
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
    [graph, run, t, workspace],
  );

  return (
    <PropertySection title="Component">
      {component && instanceOf && nodeId && !originOf ? (
        <div className="fieldset-row">
          <CatalogSwapPicker
            key={nodeId}
            nodeId={nodeId}
            name={component.name}
            onSwap={swap}
          />
        </div>
      ) : (
        component && (
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
        )
      )}
      {originOf?.project && (
        <div className="fieldset-row" data-wide="true">
          <PropertyInput
            key={originOf.definitionId}
            label={t("componentAction.componentName")}
            value={originOf.name}
            onChange={rename}
          />
        </div>
      )}
      {unlocked && originOf && (
        <CatalogOriginDefaultsRows
          definitionId={originOf.definitionId as LibraryDefinitionId}
        />
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
          {instanceOf && nodeId && (
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
          {/* Dissolving is the origin's (it detaches every instance) — an instance has its own
              Detach instance (user 2026-10-14: a second detach after Create component). */}
          {originOf?.project && (
            <RACButton className="control-button" onPress={dissolve}>
              <ACTION_ICONS.delete aria-hidden="true" size={iconProps.size} />
              {t("componentAction.deleteComponent")}
            </RACButton>
          )}
          {!originOf && nodeId && (
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
      {/* ADR-261 Phase 5: the instance's swap properties (a nested instance's component). */}
      {instanceOf && <CatalogInstancePropertiesRows target={target} />}
      {rows.length > 0 && (
        <fieldset className="properties-aria component-semantics-overrides">
          <legend className="fieldset-legend">
            {instanceOf
              ? t("propertiesPanel.overridesLegend")
              : t("propertiesPanel.originDefaultsLegend")}
          </legend>
          {/* ADR-262: the whole list at once — reset all (Figma 「Reset all changes」) · push onto
              the origin (Figma 「Push changes to main component」). */}
          {cleanupTarget && (
            <div className="component-semantics-strip component-semantics-cleanup">
              <RACButton className="control-button" onPress={resetAll}>
                <ACTION_ICONS.reset aria-hidden="true" size={iconProps.size} />
                {t("componentAction.resetAllChanges")}
              </RACButton>
              <RACButton className="control-button" onPress={pushChanges}>
                <ACTION_ICONS.pushChanges
                  aria-hidden="true"
                  size={iconProps.size}
                />
                {t("componentAction.pushChanges")}
              </RACButton>
            </div>
          )}
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

/**
 * ADR-282 Decision 3: an unlocked origin's defaults — its `accepts` text values every instance
 * shows unless it writes its own (the composite namespace: the copy root's own props are the
 * template's) — edited as the locked ◆'s Property fields were (`setLibraryDefault`).
 */
function CatalogOriginDefaultsRows({
  definitionId,
}: {
  definitionId: LibraryDefinitionId;
}) {
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const fields = useCatalogStepReading(workspace, (): [string, string][] => {
    const definition = graph.library.definitions.get(definitionId);
    const written = catalogOriginOverride(graph, definitionId)?.defaults ?? {};
    return Object.entries(definition?.accepts ?? {})
      .filter(([, type]) => type === "string")
      .map(([prop]): [string, string] => {
        const write = written[prop];
        const value =
          write?.kind === "set" ? write.value : definition?.defaults[prop];
        return [prop, typeof value === "string" ? value : ""];
      });
  });
  if (!fields.length) return null;
  return (
    <>
      {fields.map(([prop, value]) => (
        <div className="fieldset-row" data-wide="true" key={prop}>
          <PropertyInput
            label={prop}
            value={value}
            onChange={(next) =>
              run(
                setLibraryDefault({
                  definitionId,
                  scope: "defaults",
                  key: prop,
                  write: { kind: "set", value: next },
                  newId: workspace.newId,
                }),
              )
            }
          />
        </div>
      ))}
    </>
  );
}
