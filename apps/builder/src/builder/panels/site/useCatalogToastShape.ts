import { useCallback, useSyncExternalStore } from "react";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import { setToastShape } from "../../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import { runCatalogCommand } from "../../catalogRuntime/commandRunner";
import { useOptionalCatalogWorkspace } from "../../catalogRuntime/react";

const noop = () => () => {};

/**
 * The app's toast shape (user 2026-11-01 — RAC `Toast.tsx` `MyToastRegion`: one shape per app, a
 * `toast` Do passes data): `""` = the Library's Toast origin, else a project component whose root is
 * a Toast (`ProjectEntry.toastShapeId`). The options are those components; each edit one history
 * step. `null` outside a catalog project.
 */
export function useCatalogToastShape(): {
  value: string;
  options: readonly { value: string; label: string }[];
  change: (id: string | undefined) => void;
} | null {
  const workspace = useOptionalCatalogWorkspace();
  const subscribe = useCallback(
    (notify: () => void) =>
      workspace ? workspace.runtime.subscribeSteps(notify) : noop(),
    [workspace],
  );
  const snapshot = useSyncExternalStore(subscribe, () => {
    if (!workspace) return "";
    const graph = workspace.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    if (project?.kind !== "project") return "";
    const options: string[] = [];
    for (const id of project.definitionIds) {
      const definition = graph.getEntry(id);
      if (definition?.kind !== "definition" || definition.usage === "layout")
        continue;
      let type: string | undefined;
      try {
        type = definitionTypeName(graph.commandReader, id);
      } catch {
        type = undefined;
      }
      if (type === "Toast") options.push(`${id}\u0000${definition.name}`);
    }
    return JSON.stringify([project.toastShapeId ?? "", options]);
  });
  const change = useCallback(
    (id: string | undefined) => {
      if (workspace)
        runCatalogCommand(
          workspace,
          setToastShape({
            id: id ? (id as EntryId<"definition">) : undefined,
          }),
        );
    },
    [workspace],
  );
  if (!workspace || !snapshot) return null;
  const [value, options] = JSON.parse(snapshot) as [string, string[]];
  return {
    value,
    options: options.map((item) => {
      const [id, label] = item.split("\u0000") as [string, string];
      return { value: id, label };
    }),
    change,
  };
}
