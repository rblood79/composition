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
import { PropertyInput } from "../../../components/property/PropertyInput";

/** An unfilled template binding (`{description}`) is no text. */
const UNFILLED = /^\{\w+\}$/;

/**
 * A collection item's text role (its `Text[slot=description]` child) written in place, in place of
 * the role's on/off switch (사용자 2026-11-28 「description 도 switch 제거, menuitem 에 바로 배치」):
 * a text writes the child's `children` and shows it in one step; an empty text hides it. The
 * required label (RAC's accessible name) is the same field without hiding — an empty text is not
 * written (「label - required 는 프로퍼티에서 제거해도」 — the 「Required」 row became its text).
 */
export const CatalogItemTextField = memo(function CatalogItemTextField({
  row,
  label,
  required = false,
}: {
  row: CatalogItemRoleRow;
  label: string;
  required?: boolean;
}) {
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const target = row.target;
  const read = useCallback((): string => {
    try {
      const value = readTargetProp(workspace.runtime.graph, target, "children");
      return typeof value === "string" && !UNFILLED.test(value) ? value : "";
    } catch {
      return "";
    }
  }, [target, workspace]);
  const text = useCatalogStepReading<string>(workspace, read);
  const shown = row.enabled || required ? text : "";
  const write = (next: string) => {
    const enabled = next.trim() !== "";
    if (required && !enabled) return;
    const commands: CatalogCommand[] = [];
    if (enabled && next !== text)
      commands.push(
        setFields({
          targets: [target],
          props: { children: { kind: "set", value: next } },
        }),
      );
    if (!required && enabled !== row.enabled)
      commands.push(catalogItemRoleCommand(row, enabled));
    if (commands.length)
      run((reader) =>
        composeOver(
          reader,
          enabled ? "Set item text" : "Hide item text",
          commands,
        ),
      );
  };
  return <PropertyInput label={label} value={shown} onChange={write} />;
});
