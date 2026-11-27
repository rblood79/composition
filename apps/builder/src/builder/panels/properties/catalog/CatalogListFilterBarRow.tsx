/**
 * ADR-320 Phase 2 (breakdown §5.11) — a bound list's 「검색 · 필터」 row: 「Add filter bar」 (one step —
 * the bar before the list, connected), or the bar that filters it.
 */
import { Button } from "react-aria-components/Button";
import { useI18n } from "@/i18n";
import type {
  DefinitionId,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { CATALOG_FILTER_TARGET_TYPES } from "../../../../../../../packages/shared/src/catalog/runtime/filterBar";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import {
  catalogAddFilterBarCommand,
  catalogListFilterBar,
} from "../../../catalogRuntime/filterBarAuthoring";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react.runtime";
import { ACTION_ICONS } from "../../../config/actionIcons";

const AddIcon = ACTION_ICONS.add;

/** A bound list's row in its 「검색 · 필터」: add a bar, or name the one that filters it. */
export function CatalogListFilterBarRow({ listId }: { listId: NodeId }) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const state = useCatalogStepReading(workspace, () => {
    const graph = workspace.runtime.graph;
    const list = graph.getEntry(listId);
    if (list?.kind !== "node") return undefined;
    const type =
      graph.getDefinition(list.definitionId as DefinitionId)?.name ?? "";
    const bar = catalogListFilterBar(graph, listId);
    return {
      target: CATALOG_FILTER_TARGET_TYPES.has(type),
      bar: bar ? { id: bar.id, name: bar.name || "FilterBar" } : undefined,
    };
  });
  if (!state?.target) return null;
  if (state.bar)
    return (
      <p className="data-view-detail-line" data-filter-bar-of={listId}>
        {t("filterBar.filteredBy", { name: state.bar.name })}
      </p>
    );
  return (
    <Button
      className="control-button"
      data-variant="add"
      onPress={() =>
        run(catalogAddFilterBarCommand({ listId }, workspace.newId).command)
      }
    >
      <AddIcon size={14} aria-hidden />
      {t("filterBar.add")}
    </Button>
  );
}
