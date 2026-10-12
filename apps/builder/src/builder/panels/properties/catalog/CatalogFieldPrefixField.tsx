import { memo, useCallback, useSyncExternalStore } from "react";
import { setFields } from "../../../../../../../packages/shared/src/catalog/commands";
import { readTargetProp } from "../../../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  catalogFieldPrefix,
  catalogFieldPrefixCommand,
  type CatalogFieldPrefixKind,
} from "../../../catalogRuntime/fieldPrefixCommand";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { PropertyIconPicker } from "../../../components/property/PropertyIconPicker";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

const KIND_OPTIONS: readonly {
  value: CatalogFieldPrefixKind;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "text", label: "Text" },
  { value: "icon", label: "Icon" },
];

/**
 * ADR-259 Phase 2 — a field's prefix (S2 `prefix`) in the Content section (injected through
 * `contentExtras`): none, a Text or an Icon before the input — one step each way
 * (`catalogFieldPrefixCommand`), and its text or glyph, written on the prefix node itself.
 */
export const CatalogFieldPrefixField = memo(function CatalogFieldPrefixField({
  elementId,
}: {
  elementId: string;
}) {
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const viewKey = useSyncExternalStore(subscribe, () => {
    const state = catalogFieldPrefix(
      graph,
      workspace.positionOfRecord(elementId),
    );
    if (!state) return "";
    const read = (key: string) => {
      if (!state.prefix) return undefined;
      try {
        return readTargetProp(graph, state.prefix.target, key);
      } catch {
        return undefined;
      }
    };
    return JSON.stringify({
      kind: state.kind,
      text: state.kind === "text" ? read("children") : undefined,
      icon: state.kind === "icon" ? read("iconName") : undefined,
    });
  });
  const setKind = useCallback(
    (value: string) => {
      const field = workspace.positionOfRecord(elementId);
      if (!field || !KIND_OPTIONS.some((option) => option.value === value))
        return;
      run(
        catalogFieldPrefixCommand({
          field,
          kind: value as CatalogFieldPrefixKind,
          newId: workspace.newId,
        }),
      );
    },
    [elementId, run, workspace],
  );
  const setPrefixProp = useCallback(
    (key: "children" | "iconName", value: string) => {
      const prefix = catalogFieldPrefix(
        graph,
        workspace.positionOfRecord(elementId),
      )?.prefix;
      if (!prefix) return;
      run(
        setFields({
          targets: [prefix.target],
          props: { [key]: { kind: "set", value } },
        }),
      );
    },
    [elementId, graph, run, workspace],
  );

  if (!viewKey) return null;
  const view = JSON.parse(viewKey) as {
    kind: CatalogFieldPrefixKind;
    text?: unknown;
    icon?: unknown;
  };
  return (
    <>
      <div className="fieldset-row" data-wide="true">
        <PropertySelect
          label="Prefix"
          value={view.kind}
          options={KIND_OPTIONS}
          onChange={setKind}
        />
      </div>
      {view.kind === "text" && (
        <div className="fieldset-row" data-wide="true">
          <PropertyInput
            label="Prefix Text"
            value={typeof view.text === "string" ? view.text : ""}
            onChange={(value: string) => setPrefixProp("children", value)}
          />
        </div>
      )}
      {view.kind === "icon" && (
        <div className="fieldset-row" data-wide="true">
          <PropertyIconPicker
            label="Prefix Icon"
            value={typeof view.icon === "string" ? view.icon : undefined}
            onChange={(value) => setPrefixProp("iconName", value)}
          />
        </div>
      )}
    </>
  );
});
