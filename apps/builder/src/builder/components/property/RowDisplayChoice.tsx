import { SelectValue } from "react-aria-components/Select";
import { useI18n } from "@/i18n";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogGrowsWithRows } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { catalogVirtualFlow } from "../../../../../../packages/shared/src/catalog/runtime/virtualFlow";
import { runCatalogCommand } from "../../catalogRuntime/commandRunner";
import {
  catalogPagedListCommand,
  catalogUnpagedListCommand,
} from "../../catalogRuntime/pagedList";
import { useCatalogStepReading } from "../../catalogRuntime/react.runtime";
import type { CatalogWorkspace } from "../../catalogRuntime/workspace";
import { PanelSelect, PanelSelectItem } from "./PanelSelect";
import { PropertyInput } from "./PropertyInput";

/**
 * ADR-310 Phase 7 (Decision 10 · 사용자 결정 6) — how a bound list shows its rows: 「더 보기」 at its
 * end (the default) or pages of `size` rows a Pagination on the page steps (it points at the list).
 */
export default function RowDisplayChoice({
  workspace,
  elementId,
}: {
  workspace: CatalogWorkspace;
  elementId: string;
}) {
  const { t } = useI18n();
  const state = useCatalogStepReading(workspace, () => {
    const target = workspace.positionOfRecord(elementId)?.target;
    if (target?.kind !== "node") return undefined;
    const graph = workspace.runtime.graph;
    const node = graph.getEntry(target.id);
    if (node?.kind !== "node") return undefined;
    const paginations = new Map<string, { name: string; pagesOf?: string }>();
    for (const record of workspace.root.domInputs.values()) {
      if (record.ruleId !== "Pagination" || paginations.has(record.sourceId))
        continue;
      const entry = graph.getEntry(record.sourceId) as NodeEntry | undefined;
      if (entry?.kind !== "node") continue;
      paginations.set(record.sourceId, {
        name: entry.name ?? "Pagination",
        ...(entry.pagesOf ? { pagesOf: entry.pagesOf } : {}),
      });
    }
    // ADR-310 Phase 8 — a list can virtual-scroll when it has a scroll box (a bounded height —
    // a Table's too: its Styles height) and a `Layout` places its rows as the Canvas does.
    const record = workspace.root.domInputs.get(elementId);
    let virtualBlocked: string | undefined;
    if (record) {
      const bounded = !catalogGrowsWithRows(
        record.visual as never,
        record.sizing as never,
      );
      // (The `Layout` check — four equal paddings — runs in the Preview's chunk: a
      //  list it cannot place the same way draws as it is there. Kept out of this panel's import —
      //  it moved shared modules into the Builder's initial chunk, +1,160 B.)
      // (A waterfall is RAC's `WaterfallLayout` — the Canvas does not place it that way yet.)
      // (A list that is not one line of stretched items — a wrapping · reversed flex, a many-column
      //  grid in Styles — is not a `ListLayout`'s: `catalogVirtualFlow`. Grids are GridLayouts.)
      const grid =
        record.ruleId === "CardView" ||
        (record.ruleId === "GridList" && record.props.layout !== "stack");
      const flow =
        record.ruleId === "Table" || grid
          ? undefined
          : catalogVirtualFlow(
              workspace.root.getDrawnLayoutStyle(elementId) ?? {},
            );
      virtualBlocked = !bounded
        ? "height"
        : record.props.layout === "waterfall"
          ? "waterfall"
          : flow && "refused" in flow
            ? flow.refused
            : undefined;
    }
    return {
      listId: target.id,
      ...(virtualBlocked ? { virtualBlocked } : {}),
      mode: node.rowDisplay?.mode ?? "more",
      size: node.rowDisplay?.size ?? 20,
      paginations: [...paginations].map(([id, value]) => ({ id, ...value })),
    };
  });
  if (!state) return null;
  const listId = state.listId as NodeEntry["id"];
  const connected = state.paginations.find((item) => item.pagesOf === listId);
  return (
    <>
      <div className="binding-row">
        <PanelSelect
          aria-label={t("propertiesPanel.rowDisplay")}
          selectedKey={state.mode}
          disabledKeys={
            state.virtualBlocked && state.mode !== "virtual" ? ["virtual"] : []
          }
          onSelectionChange={(key) =>
            runCatalogCommand(
              workspace,
              key === "pages"
                ? // (Pages brings its Pagination along — `catalogPagedListCommand`.)
                  catalogPagedListCommand(
                    workspace,
                    elementId,
                    listId,
                    state.size,
                    !!connected,
                  )
                : // (Away from Pages its Paginations go too — `catalogUnpagedListCommand`.)
                  catalogUnpagedListCommand(
                    listId,
                    key === "virtual" ? { mode: "virtual" } : undefined,
                    state.mode === "pages"
                      ? state.paginations
                          .filter((item) => item.pagesOf === listId)
                          .map((item) => item.id as NodeEntry["id"])
                      : [],
                  ),
            )
          }
          trigger={<SelectValue />}
        >
          <PanelSelectItem
            id="more"
            label={t("propertiesPanel.rowDisplayMore")}
          />
          <PanelSelectItem
            id="pages"
            label={t("propertiesPanel.rowDisplayPages")}
          />
          <PanelSelectItem
            id="virtual"
            label={t("propertiesPanel.rowDisplayVirtual")}
            {...(state.virtualBlocked
              ? {
                  detail: t(
                    `propertiesPanel.rowDisplayVirtualBlocked.${state.virtualBlocked}` as never,
                  ),
                }
              : {})}
          />
        </PanelSelect>
      </div>
      {/* (No Pagination picker — 사용자 결정 2026-11-19: Pages places its Pagination and pages it,
          another display removes it — `pagedList.ts`.) */}
      {state.mode === "pages" && (
        <PropertyInput
          label={t("propertiesPanel.rowDisplayPageSize")}
          value={String(state.size)}
          onChange={(text) => {
            const size = Number(text);
            if (Number.isInteger(size) && size >= 1 && size <= 1000)
              runCatalogCommand(
                workspace,
                setRowDisplay(listId, { mode: "pages", size }),
              );
          }}
        />
      )}
    </>
  );
}
