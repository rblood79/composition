import { memo, useCallback } from "react";
import type { NodeId } from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogButtonChildCommands,
  catalogButtonChildren,
  type CatalogButtonChildren,
} from "../../../catalogRuntime/buttonChildren";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { PropertyIconPicker } from "../../../components/property/PropertyIconPicker";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

/**
 * ADR-248 Phase 4e-4: a Button / ToggleButton's Icon and Text children in the Content section
 * (fields only — injected through `contentExtras`, like the old ButtonChildFields). Picking an
 * icon, clearing it and the icon Button's label are each one step; handlers read the committed
 * children when they run.
 */
export const CatalogButtonChildFields = memo(function CatalogButtonChildFields({
  nodeId,
  state,
}: {
  nodeId: NodeId;
  state: CatalogButtonChildren;
}) {
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;

  const selectIcon = useCallback(
    (iconName: string) => {
      if (!iconName) return;
      if (catalogButtonChildren(graph, nodeId)?.iconName === iconName) return;
      run(
        catalogButtonChildCommands.setIcon(nodeId, iconName, workspace.newId),
      );
    },
    [graph, nodeId, run, workspace],
  );
  const clearIcon = useCallback(() => {
    if (catalogButtonChildren(graph, nodeId)?.iconId)
      run(catalogButtonChildCommands.clearIcon(nodeId));
  }, [graph, nodeId, run]);
  const changeText = useCallback(
    (value: string) => {
      const current = catalogButtonChildren(graph, nodeId);
      if (current?.textId && current.text !== value)
        run(catalogButtonChildCommands.setText(current.textId, value));
    },
    [graph, nodeId, run],
  );

  return (
    <>
      <div className="fieldset-row" data-wide="true">
        <PropertyIconPicker
          label="Icon"
          value={state.iconName}
          onChange={selectIcon}
          onClear={clearIcon}
        />
      </div>
      {state.textId ? (
        <div className="fieldset-row" data-wide="true">
          <PropertyInput
            label="Text"
            value={state.text ?? ""}
            onChange={changeText}
          />
        </div>
      ) : null}
    </>
  );
});
