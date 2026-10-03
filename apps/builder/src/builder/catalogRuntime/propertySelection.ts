import { useSyncExternalStore } from "react";
import type { PropertySelectionSource } from "../components/property/propertySelection";
import type { CatalogWorkspace } from "./workspace";

/** The catalog session's selection as property fields compare it (identities, in order). */
export function catalogPropertySelection(
  workspace: CatalogWorkspace,
): PropertySelectionSource {
  const read = () => {
    const { selection } = workspace.session.getSnapshot();
    return selection.length
      ? selection.map((item) => item.identity).join(",")
      : null;
  };
  return {
    useSelectedId: () =>
      useSyncExternalStore(workspace.session.subscribe, read),
    readSelectedId: read,
  };
}
