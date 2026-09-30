import { useSyncExternalStore } from "react";
import { Button } from "react-aria-components/Button";
import { useI18n } from "@/i18n";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import "./CatalogDefinitionBar.css";

/**
 * ADR-248 4e: while the Canvas shows a definition (the definition edit view), a bar names it and
 * returns to the pages. Every edit made there is an ordinary step (undo reaches it from the page).
 */
export function CatalogDefinitionBar({
  workspace,
}: {
  workspace: CatalogWorkspace;
}) {
  const { t } = useI18n();
  const definitionId = useSyncExternalStore(
    workspace.session.subscribe,
    () => workspace.session.getSnapshot().definitionView,
  );
  const name = useSyncExternalStore(
    (notify) => workspace.runtime.subscribeSteps(() => notify()),
    () => {
      const entry = definitionId
        ? workspace.runtime.graph.getEntry(definitionId)
        : undefined;
      return entry?.kind === "definition"
        ? `${entry.usage ?? "component"}:${entry.name}`
        : undefined;
    },
  );
  if (!definitionId || !name) return null;
  const [usage, ...rest] = name.split(":");
  const label = rest.join(":");
  return (
    <div className="catalog-definition-bar" role="status">
      <span>
        {usage === "layout"
          ? t("catalogProject.editingLayout", { name: label })
          : t("catalogProject.editingComponent", { name: label })}
      </span>
      <Button
        className="catalog-definition-bar__done"
        onPress={() => workspace.showDefinition(undefined)}
      >
        {t("catalogProject.doneEditing")}
      </Button>
    </div>
  );
}
