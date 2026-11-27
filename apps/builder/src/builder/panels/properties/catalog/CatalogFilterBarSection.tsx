/**
 * ADR-320 Phase 2 (breakdown §5.11) — the filter bar's authoring (lazy — a bar's Design panel only):
 * - the bar's Collection: the lists it filters (the page's lists of its collection — a list another
 *   bar filters is not offered) and the fields it offers (shown · their order);
 * - its start conditions and saved filters are prop fields (`CatalogFilterBarFields.tsx` — lazy).
 */
import { useI18n } from "@/i18n";
import { setFields } from "../../../../../../../packages/shared/src/catalog/commands/fields";
import { setFilterBarTargets } from "../../../../../../../packages/shared/src/catalog/commands/filterBar";
import type {
  DefinitionId,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import {
  catalogFilterBarCandidates,
  catalogFilterBarFields,
} from "../../../catalogRuntime/filterBarPanel";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react.runtime";
import { PropertyCheckbox } from "../../../components/property/PropertyCheckbox";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import "../generic/ValidationRulesField.css";

/** A filter bar's lists and fields (its Collection section). */
export default function CatalogFilterBarSection({ barId }: { barId: NodeId }) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const view = useCatalogStepReading(workspace, () => {
    const graph = workspace.runtime.graph;
    const bar = graph.getEntry(barId);
    if (
      bar?.kind !== "node" ||
      graph.getDefinition(bar.definitionId as DefinitionId)?.name !==
        "FilterBar"
    )
      return undefined;
    return {
      targets: [...(bar.filtersOf ?? [])],
      candidates: catalogFilterBarCandidates(graph, barId),
      fields: catalogFilterBarFields(graph, bar),
    };
  });
  if (!view) return null;
  const writeList = (key: "hiddenFields" | "fieldOrder", ids: string[]) =>
    run(
      setFields({
        targets: [{ kind: "node", id: barId }],
        props: {
          [key]: ids.length ? { kind: "set", value: ids } : { kind: "remove" },
        } as never,
      }),
    );
  const order = view.fields.map((field) => field.id);
  const move = (id: string, by: number) => {
    const at = order.indexOf(id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(at, 1);
    next.splice(to, 0, id);
    writeList("fieldOrder", next);
  };
  return (
    <>
      <PropertyFieldset
        legend={t("filterBar.lists")}
        className="filter-bar-lists"
      >
        {view.candidates.length ? (
          view.candidates.map((list) => (
            <PropertyCheckbox
              key={list.id}
              label={`${list.name} · ${list.type}`}
              isSelected={list.connected}
              onChange={(on) =>
                run(
                  setFilterBarTargets(
                    barId,
                    on
                      ? [...view.targets, list.id]
                      : view.targets.filter((id) => id !== list.id),
                  ),
                )
              }
            />
          ))
        ) : (
          <p className="data-view-detail-line">{t("filterBar.noLists")}</p>
        )}
      </PropertyFieldset>
      {view.fields.length ? (
        <PropertyFieldset
          legend={t("filterBar.fields")}
          className="filter-bar-fields"
        >
          {view.fields.map((field) => (
            <div key={field.id} className="validation-rule-row">
              <PropertyCheckbox
                label={field.label}
                isSelected={!field.hidden}
                onChange={(shown) => {
                  const hidden = view.fields
                    .filter((item) => item.hidden)
                    .map((item) => item.id);
                  writeList(
                    "hiddenFields",
                    shown
                      ? hidden.filter((id) => id !== field.id)
                      : [...hidden, field.id],
                  );
                }}
              />
              <PropertyRowMenu
                label={t("filterBar.fieldActions", { name: field.label })}
                items={[
                  { id: "up", label: t("filterBar.moveUp") },
                  { id: "down", label: t("filterBar.moveDown") },
                ]}
                onAction={(id) => move(field.id, id === "up" ? -1 : 1)}
              />
            </div>
          ))}
        </PropertyFieldset>
      ) : null}
    </>
  );
}
