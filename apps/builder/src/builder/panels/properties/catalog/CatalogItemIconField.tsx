import { memo, useCallback } from "react";
import { setFields } from "../../../../../../../packages/shared/src/catalog/commands";
import {
  composeOver,
  type CatalogCommand,
} from "../../../../../../../packages/shared/src/catalog/commands/compose";
import { readTargetProp } from "../../../../../../../packages/shared/src/catalog/resolution/fieldSource";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import {
  catalogItemRoleCommand,
  type CatalogItemRoleRow,
} from "../../../catalogRuntime/itemRoles";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { PropertyIconPicker } from "../../../components/property/PropertyIconPicker";

/** An unfilled template binding (`{icon}`) is no icon. */
const UNFILLED = /^\{\w+\}$/;

/**
 * A collection item's icon role (its `Icon[slot=icon]` child) picked in place, in place of the
 * role's on/off switch (사용자 2026-11-28 — 「icon 도 switch 토글후 layer 트리에서 선택후 다시 프로퍼티
 * 패널에서 아이콘을 선택해야한다. switch 토글 제거하고 바로 달아도」): picking an icon writes the
 * child's `iconName` and shows it in one step; clearing hides it (the name stays for the template).
 */
export const CatalogItemIconField = memo(function CatalogItemIconField({
  row,
  label,
}: {
  row: CatalogItemRoleRow;
  label: string;
}) {
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const target = row.target;
  const read = useCallback((): string => {
    try {
      const value = readTargetProp(workspace.runtime.graph, target, "iconName");
      return typeof value === "string" && !UNFILLED.test(value) ? value : "";
    } catch {
      return "";
    }
  }, [target, workspace]);
  const name = useCatalogStepReading<string>(workspace, read);
  const write = (next: string | undefined, enabled: boolean) => {
    const commands: CatalogCommand[] = [];
    if (next !== undefined && next !== name)
      commands.push(
        setFields({
          targets: [target],
          props: { iconName: { kind: "set", value: next } },
        }),
      );
    if (enabled !== row.enabled)
      commands.push(catalogItemRoleCommand(row, enabled));
    if (commands.length)
      run((reader) =>
        composeOver(
          reader,
          enabled ? "Set item icon" : "Hide item icon",
          commands,
        ),
      );
  };
  return (
    <PropertyIconPicker
      label={label}
      value={row.enabled ? name || undefined : undefined}
      onChange={(next) => (next ? write(next, true) : write(undefined, false))}
      onClear={() => write(undefined, false)}
    />
  );
});
