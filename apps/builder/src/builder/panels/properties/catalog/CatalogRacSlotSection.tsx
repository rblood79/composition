import { memo, useCallback, useSyncExternalStore } from "react";
import {
  catalogRacSlotConsumer,
  catalogRacSlotProvider,
  predictRacSlot,
} from "../../../../../../../packages/shared/src/catalog/runtime/racSlot";
import { catalogSemanticPatchCommand } from "../../../catalogRuntime/editContract";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { useToastStore } from "../../../stores/toast";

const DEFAULT = "";
const DETACH = "__detach__";

interface RacSlotView {
  provider?: string;
  names: readonly string[];
  hasDefault: boolean;
  /** The authored value: a name, `false` (detached), or unset. */
  authored?: string | false;
  connected: boolean;
}

/**
 * ADR-256 Decision 4 — a Text · Heading · Button · DateInput part's RAC slot: the names the nearest
 * provider of its context offers (the provider table generated from the installed RAC), the default
 * (unset — RAC's default slot or a plain context), and the explicit detach (`slot={null}`). A name
 * the provider does not have — or unset where it has no default — shows as not connected; the Preview
 * draws the part detached there instead of RAC throwing.
 */
export const CatalogRacSlotSection = memo(function CatalogRacSlotSection({
  identity,
  workspace,
  root,
}: {
  identity: string;
  /** The panel's workspace and root (no hook or getter of its own per selection — ADR-246). */
  workspace: CatalogWorkspace;
  root: CatalogWorkspace["root"];
}) {
  const read = useCallback((): RacSlotView | null => {
    const record = root.canvasInputs.get(identity);
    if (!record) return null;
    const type = root.typeOf(record);
    if (!type || !catalogRacSlotConsumer(type)) return null;
    const ancestors: string[] = [];
    for (
      let cursor = root.canvasInputs.get(record.parentId);
      cursor;
      cursor = root.canvasInputs.get(cursor.parentId)
    ) {
      const ancestor = root.typeOf(cursor);
      if (ancestor) ancestors.push(ancestor);
    }
    const authored =
      record.props.slot === false
        ? false
        : typeof record.props.slot === "string" && record.props.slot
          ? record.props.slot
          : undefined;
    const prediction = predictRacSlot(type, ancestors, authored);
    const provider = catalogRacSlotProvider(type, ancestors);
    if (!provider && authored === undefined) return null;
    return {
      provider: provider?.provider,
      names: provider?.provision.slots ?? [],
      hasDefault: provider?.provision.hasDefault === true,
      authored,
      connected: prediction.kind !== "unconnected",
    };
  }, [identity, root]);
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const viewKey = useSyncExternalStore(subscribe, () => JSON.stringify(read()));
  const view = JSON.parse(viewKey) as RacSlotView | null;

  const choose = useCallback(
    (value: string) => {
      const position = workspace.positionOfRecord(identity);
      const current = read();
      if (!position || !current) return;
      const next =
        value === DEFAULT ? undefined : value === DETACH ? false : value;
      if (next === current.authored) return;
      const command = catalogSemanticPatchCommand(
        [position.target],
        { slot: next },
        () => current.authored,
      );
      if (!command) return;
      try {
        workspace.execute(command);
      } catch (error) {
        useToastStore
          .getState()
          .showToast(
            "error",
            error instanceof Error ? error.message : String(error),
          );
      }
    },
    [identity, read, workspace],
  );

  if (!view) return null;
  const value = view.authored === false ? DETACH : (view.authored ?? DEFAULT);
  const options = [
    { value: DEFAULT, label: view.hasDefault ? "Default" : "Unset" },
    ...view.names.map((name) => ({ value: name, label: name })),
    ...(typeof view.authored === "string" && !view.names.includes(view.authored)
      ? [{ value: view.authored, label: view.authored }]
      : []),
    { value: DETACH, label: "Detach (slot = null)" },
  ];
  return (
    <PropertySection title="RAC slot">
      <div className="fieldset-row" data-wide="true">
        <PropertySelect
          label={view.provider ? `Slot of ${view.provider}` : "Slot"}
          value={value}
          options={options}
          translateOptions={false}
          onChange={choose}
          afterControl={
            view.connected ? undefined : (
              <span slot="description">Not connected</span>
            )
          }
        />
      </div>
    </PropertySection>
  );
});
