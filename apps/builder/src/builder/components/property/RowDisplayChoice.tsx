import { SelectValue } from "react-aria-components/Select";
import { useI18n } from "@/i18n";
import {
  setPagination,
  setRowDisplay,
} from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogGrowsWithRows } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { runCatalogCommand } from "../../catalogRuntime/commandRunner";
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
    // a Table's fixed height mode) and a `Layout` places its rows as the Canvas does.
    const record = workspace.root.domInputs.get(elementId);
    let virtualBlocked: string | undefined;
    if (record) {
      const bounded =
        record.ruleId === "Table"
          ? record.props.heightMode === "fixed"
          : !catalogGrowsWithRows(
              record.visual as never,
              record.sizing as never,
            );
      // (The `Layout` check — four equal paddings — runs in the Preview's chunk: a
      //  list it cannot place the same way draws as it is there. Kept out of this panel's import —
      //  it moved shared modules into the Builder's initial chunk, +1,160 B.)
      // (A waterfall is RAC's `WaterfallLayout` — the Canvas does not place it that way yet.)
      virtualBlocked = !bounded
        ? "height"
        : record.props.layout === "waterfall"
          ? "waterfall"
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
              setRowDisplay(
                listId,
                key === "pages"
                  ? { mode: "pages", size: state.size }
                  : key === "virtual"
                    ? { mode: "virtual" }
                    : undefined,
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
      {state.mode === "pages" && (
        <>
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
          <div className="binding-row">
            <PanelSelect
              aria-label={t("propertiesPanel.rowDisplayPagination")}
              selectedKey={connected?.id ?? "none"}
              onSelectionChange={(key) => {
                if (key === "none") {
                  if (connected)
                    runCatalogCommand(
                      workspace,
                      setPagination(connected.id as NodeEntry["id"], undefined),
                    );
                  return;
                }
                runCatalogCommand(
                  workspace,
                  setPagination(String(key) as NodeEntry["id"], listId),
                );
              }}
              trigger={<SelectValue />}
            >
              <PanelSelectItem
                id="none"
                label={t("propertiesPanel.rowDisplayPaginationNone")}
              />
              {state.paginations.map((item) => (
                <PanelSelectItem key={item.id} id={item.id} label={item.name} />
              ))}
            </PanelSelect>
          </div>
        </>
      )}
    </>
  );
}

