import { memo, useCallback, useState } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  DefinitionId,
  EditTarget,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  catalogComponentLabel,
  catalogInstancePropertyCandidates,
  catalogInstancePropertyPlan,
  catalogInstancePropertyRows,
  catalogInstanceEventRows,
  catalogInstancePropertyScope,
  catalogInstanceVariableRows,
  type CatalogInstancePropertyRow,
} from "../../../catalogRuntime/componentProperties";
import { setPanelWorkspacePanelVisibility } from "../../../layout/panelWorkspaceVisibility";
import { setFields } from "../../../../../../../packages/shared/src/catalog/commands";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { useProjectVariableDefs } from "../../../stores/data";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { ActionTooltipTrigger } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useToastStore } from "../../../stores/toast";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import { CatalogComponentPicker } from "./CatalogSwapPicker";
import "./CatalogComponentPropertiesSection.css";

const ComponentIcon = ACTION_ICONS.component;

/**
 * ADR-261 Phase 5 — an instance's swap properties (Figma's instance swap property): each one picks
 * the component its nested instance shows — the preferred ones first — and resets to the origin's.
 * One step each; the notice counts what the swap kept, dropped and moved out, with undo.
 */
export const CatalogInstancePropertiesRows = memo(
  function CatalogInstancePropertiesRows({ target }: { target: EditTarget }) {
    const { t } = useI18n();
    const workspace = useCatalogWorkspace();
    const run = useCatalogCommandRunner();
    const graph = workspace.runtime.graph;
    const rows = useCatalogStepReading(
      workspace,
      (): CatalogInstancePropertyRow[] => {
        const scope = catalogInstancePropertyScope(graph, target);
        return scope ? catalogInstancePropertyRows(graph, scope) : [];
      },
    );
    const [open, setOpen] = useState<string | undefined>();
    const pick = useCallback(
      (key: string, definitionId: DefinitionId | null) => {
        const scope = catalogInstancePropertyScope(graph, target);
        if (!scope) return;
        const { command, report } = catalogInstancePropertyPlan(
          graph,
          scope,
          key,
          definitionId,
          workspace.newId,
        );
        if (!run(command)) return;
        const shown = definitionId
          ? catalogComponentLabel(graph, definitionId)
          : undefined;
        useToastStore.getState().showToast(
          "info",
          shown
            ? t("componentAction.swapped", {
                name: shown,
                kept: report.kept,
                dropped: report.dropped,
                movedOut: report.movedOut,
                targetsUnset: report.targetsUnset,
              })
            : t("propertiesPanel.instancePropertyReset"),
          {
            bypassCooldown: true,
            action: {
              label: t("errors.undo"),
              onClick: () => workspace.undo(),
            },
          },
        );
      },
      [graph, run, t, target, workspace],
    );
    if (!rows.length) return null;
    return (
      <>
        {rows.map((row) => (
          <div key={row.key} className="fieldset-row instance-property-row">
            <fieldset className="properties-aria instance-property-field">
              <legend className="fieldset-legend">{row.name}</legend>
              <CatalogComponentPicker
                label={`${row.name}: ${row.label}`}
                triggerClassName="component-semantics-identity component-swap-trigger"
                dataRole={row.isDefault ? "origin" : "instance"}
                candidates={() => {
                  const scope = catalogInstancePropertyScope(graph, target);
                  return scope
                    ? catalogInstancePropertyCandidates(graph, scope, row.key)
                    : [];
                }}
                onPick={(definitionId) => pick(row.key, definitionId)}
                open={open === row.key}
                onOpenChange={(next) => setOpen(next ? row.key : undefined)}
              >
                <ComponentIcon aria-hidden="true" size={14} />
                <span
                  className="component-semantics-identity-name"
                  title={row.label}
                >
                  {row.label}
                </span>
                <ChevronDown aria-hidden="true" size={12} />
              </CatalogComponentPicker>
            </fieldset>
            {!row.isDefault && (
              <div className="fieldset-actions actions-instance-property">
                <ActionTooltipTrigger
                  tooltip={t("propertiesPanel.instancePropertyResetAction", {
                    name: row.name,
                  })}
                >
                  <RACButton
                    aria-label={t(
                      "propertiesPanel.instancePropertyResetAction",
                      {
                        name: row.name,
                      },
                    )}
                    className="control-button"
                    data-icon-only="true"
                    onPress={() => pick(row.key, null)}
                  >
                    <ACTION_ICONS.reset
                      aria-hidden="true"
                      size={iconProps.size}
                    />
                  </RACButton>
                </ActionTooltipTrigger>
              </div>
            )}
          </div>
        ))}
      </>
    );
  },
);

/**
 * ADR-294 — an instance's component events (the component's outputs): each is received by a rule
 * in Interactions (`property:<key>` — the When 「컴포넌트」 group), so the row opens that panel on
 * this selection. The count is this instance's receiving rules.
 */
export const CatalogInstanceEventRows = memo(function CatalogInstanceEventRows({
  target,
}: {
  target: EditTarget;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const graph = workspace.runtime.graph;
  const rows = useCatalogStepReading(workspace, () =>
    catalogInstanceEventRows(graph, target),
  );
  if (!rows.length) return null;
  return (
    <>
      {rows.map((row) => (
        <div key={row.key} className="fieldset-row instance-property-row">
          <fieldset className="properties-aria instance-property-field">
            <legend className="fieldset-legend">
              {`${t("propertiesPanel.componentPropertyKindEvent")} · ${row.name}`}
            </legend>
            <RACButton
              className="control-button"
              onPress={() => setPanelWorkspacePanelVisibility("events", true)}
            >
              {row.rules > 0
                ? `${t("propertiesPanel.componentPropertyReceive")} (${row.rules})`
                : t("propertiesPanel.componentPropertyReceive")}
            </RACButton>
          </fieldset>
        </div>
      ))}
    </>
  );
});

/** (A Select option's value for 「직접 입력」 — `""` would read as no choice.) */
const TYPED_VALUE = "typed";

/**
 * ADR-294 — an instance's variable properties: where the value comes from (a typed value — the
 * Content field — or a variable of the same type the instance sees, `role={roleFilter}`), and what
 * the origin reads in this instance now (the Canvas reading — a referenced variable's default).
 */
export const CatalogInstanceVariableRows = memo(
  function CatalogInstanceVariableRows({ target }: { target: EditTarget }) {
    const { t } = useI18n();
    const workspace = useCatalogWorkspace();
    const run = useCatalogCommandRunner();
    const graph = workspace.runtime.graph;
    const projectVariables = useProjectVariableDefs();
    const rows = useCatalogStepReading(workspace, () =>
      target.kind === "node"
        ? catalogInstanceVariableRows(graph, target.id, projectVariables)
        : [],
    );
    if (target.kind !== "node" || !rows.length) return null;
    const write = (key: string, value: string | undefined) =>
      run(
        setFields({
          targets: [{ kind: "node", id: target.id }],
          props: {
            [key]:
              value === undefined
                ? { kind: "remove" }
                : { kind: "set", value: `!var.${value}` },
          },
          label: "Edit properties",
        }),
      );
    return (
      <>
        {rows.map((row) => (
          <div key={row.key} className="fieldset-row" data-wide="true">
            <PropertySelect
              label={`${row.name} · ${t("propertiesPanel.componentPropertyValueSource")}`}
              value={row.reference ?? TYPED_VALUE}
              options={[
                {
                  value: TYPED_VALUE,
                  label: t("propertiesPanel.componentPropertyValueLiteral"),
                },
                ...row.candidates.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.name,
                })),
              ]}
              translateOptions={false}
              onChange={(value) =>
                write(row.key, value === TYPED_VALUE ? undefined : value)
              }
              afterControl={
                <span slot="description">
                  {t("propertiesPanel.componentPropertyValueNow", {
                    value:
                      row.now === undefined || row.now === null
                        ? "—"
                        : typeof row.now === "object"
                          ? JSON.stringify(row.now)
                          : String(row.now),
                  })}
                </span>
              }
            />
          </div>
        ))}
      </>
    );
  },
);
