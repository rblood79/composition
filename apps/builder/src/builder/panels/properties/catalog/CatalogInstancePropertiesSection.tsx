import { memo, useCallback, useState, useSyncExternalStore } from "react";
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
  catalogInstancePropertyScope,
  type CatalogInstancePropertyRow,
} from "../../../catalogRuntime/componentProperties";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { ActionTooltipTrigger } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useToastStore } from "../../../stores/toast";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
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
    const subscribe = useCallback(
      (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
      [workspace],
    );
    const rowsKey = useSyncExternalStore(subscribe, () => {
      const scope = catalogInstancePropertyScope(graph, target);
      return scope
        ? JSON.stringify(catalogInstancePropertyRows(graph, scope))
        : "[]";
    });
    const rows = JSON.parse(rowsKey) as CatalogInstancePropertyRow[];
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
