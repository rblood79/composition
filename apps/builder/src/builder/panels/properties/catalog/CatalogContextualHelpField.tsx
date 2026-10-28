import { memo, useCallback, useSyncExternalStore } from "react";
import {
  catalogContextualHelp,
  catalogContextualHelpCommand,
  type CatalogContextualHelpKind,
} from "../../../catalogRuntime/contextualHelpCommand";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";

const KIND_OPTIONS: readonly {
  value: CatalogContextualHelpKind;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "help", label: "Help" },
  { value: "info", label: "Info" },
];

/**
 * ADR-259 Phase 3 — a field's contextual help (S2 `contextualHelp`) in the Content section
 * (injected through `contentExtras`): none, or a help (`help` · `info`) beside the field's Label —
 * one step each way (`catalogContextualHelpCommand`). Its title, text and place are the
 * ContextualHelp node's own (select it in the Layers).
 */
export const CatalogContextualHelpField = memo(
  function CatalogContextualHelpField({ elementId }: { elementId: string }) {
    const workspace = useCatalogWorkspace();
    const run = useCatalogCommandRunner();
    const graph = workspace.runtime.graph;
    const subscribe = useCallback(
      (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
      [workspace],
    );
    const kind = useSyncExternalStore(
      subscribe,
      () =>
        catalogContextualHelp(graph, workspace.positionOfRecord(elementId))
          ?.kind,
    );
    const setKind = useCallback(
      (value: string) => {
        const field = workspace.positionOfRecord(elementId);
        if (!field || !KIND_OPTIONS.some((option) => option.value === value))
          return;
        run(
          catalogContextualHelpCommand({
            field,
            kind: value as CatalogContextualHelpKind,
            newId: workspace.newId,
          }),
        );
      },
      [elementId, run, workspace],
    );
    if (!kind) return null;
    return (
      <div className="fieldset-row" data-wide="true">
        <PropertySelect
          label="Contextual Help"
          value={kind}
          options={KIND_OPTIONS}
          onChange={setKind}
        />
      </div>
    );
  },
);
