/**
 * ADR-320 Phase 2 (breakdown §5.11) — the filter bar's start conditions (`defaultQuery`) and saved
 * filters (`presets`) fields: a condition the lists' supply cannot take is marked (the Preview
 * leaves it out — §5.3); saving is never blocked. Loaded when a bar's Design panel shows them
 * (`GenericFieldRenderer` — lazy: the judgment reads the request serializer).
 */
import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { useI18n } from "@/i18n";
import type {
  NodeEntry,
  NodeId,
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogFilterPresetsFit,
  type CatalogFilterPreset,
} from "../../../../../../../packages/shared/src/catalog/document/filterQuery";
import {
  CATALOG_FILTER_TREE_ID,
  catalogFilterTreeRead,
} from "../../../../../../../packages/shared/src/catalog/runtime/filterScope";
import {
  VIEW_COMPARISONS_BY_KIND,
  viewFieldKind,
} from "../../../../../../../packages/shared/src/collections/view/comparison";
import {
  CATALOG_RELATIVE_DATE_OPS,
  CATALOG_RELATIVE_DATES,
  catalogRelativeDateOf,
  catalogRelativeDateToken,
  type CatalogRelativeDate,
} from "../../../../../../../packages/shared/src/catalog/runtime/filterRelativeDates";
import { FILTER_PRESET_NAME } from "../../../../../../../packages/shared/src/catalog/document/filterBarOrigins";
import { catalogSiteLanguage } from "../../../../../../../packages/shared/src/catalog/document/templateLocalizedProps";
import { catalogRelativeDateWord } from "../../../../../../../packages/shared/src/catalog/runtime/filterWording";
import { catalogFilterBarFields } from "../../../catalogRuntime/filterBarPanel";
import { catalogFilterBarRefusedItems } from "../../../catalogRuntime/filterBarRefused";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react.runtime";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import { PropertySelect } from "../../../components/property/PropertySelect";
import "../generic/ValidationRulesField.css";

const AddIcon = ACTION_ICONS.add;
const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

/** The bar this field edits and its fields (the selected record's node). */
function useBar(elementId: string | undefined) {
  const workspace = useCatalogWorkspace();
  return useCatalogStepReading(workspace, () => {
    if (!elementId) return undefined;
    const graph = workspace.runtime.graph;
    // (The field's element is the selected record — or a node id.)
    const record =
      workspace.root.canvasInputs.get(elementId) ??
      workspace.root.canvasInputs.get(
        workspace.recordsOfNode(elementId)[0] ?? "",
      );
    const bar = graph.getEntry((record?.sourceId ?? elementId) as NodeId) as
      NodeEntry | undefined;
    if (bar?.kind !== "node") return undefined;
    return { id: bar.id, fields: catalogFilterBarFields(graph, bar) };
  });
}

/** The ids of the start items the bar's lists cannot take. */
function useRefused(
  barId: string | undefined,
  tree: ViewConditionGroup | undefined,
): string[] {
  const workspace = useCatalogWorkspace();
  return useCatalogStepReading(workspace, () => {
    if (!barId) return [];
    const graph = workspace.runtime.graph;
    const bar = graph.getEntry(barId as NodeId);
    return bar?.kind === "node"
      ? [...catalogFilterBarRefusedItems(graph, bar, tree)]
      : [];
  });
}

const valueText = (value: ViewCondition["value"]) =>
  value === undefined
    ? ""
    : Array.isArray(value)
      ? value.join(", ")
      : String(value);

/** Whether a condition's value may be a relative date (a date field's one-value comparison). */
const relativeOffered = (
  kind: ReturnType<typeof viewFieldKind>,
  op: ViewComparison,
) =>
  kind === "date" && op !== "between" && CATALOG_RELATIVE_DATE_OPS.includes(op);

/** A typed value as the comparison takes it (a number field's number · a list's items). */
function valueFromText(
  text: string,
  kind: ReturnType<typeof viewFieldKind>,
  op: ViewComparison,
): ViewCondition["value"] {
  if (["oneOf", "between", "containsAny", "containsAll"].includes(op)) {
    const cells = text
      .split(",")
      .map((cell) => cell.trim())
      .filter(Boolean);
    return kind === "number" &&
      cells.every((cell) => Number.isFinite(Number(cell)))
      ? cells.map(Number)
      : cells;
  }
  if (kind === "number" && text.trim() !== "" && Number.isFinite(Number(text)))
    return Number(text);
  if (kind === "boolean") return text === "true";
  return text;
}

/** A tree's root conditions as rows (a group is one row the builder edits — Phase 4). */
function TreeEditor({
  tree,
  fields,
  refused,
  onChange,
}: {
  tree: ViewConditionGroup | undefined;
  fields: ReturnType<typeof catalogFilterBarFields>;
  refused: readonly string[];
  onChange: (tree: ViewConditionGroup | undefined) => void;
}) {
  const { t, locale } = useI18n();
  const items = tree?.items ?? [];
  const write = (next: readonly (ViewCondition | ViewConditionGroup)[]) =>
    onChange(
      next.length
        ? { id: tree?.id ?? CATALOG_FILTER_TREE_ID, op: "and", items: next }
        : undefined,
    );
  const fieldOf = (condition: ViewCondition) =>
    fields.find(
      (field) => `data:field:${field.id}` === condition.fields[0]?.[0],
    );
  const add = () => {
    const field = fields.find((item) => !item.hidden) ?? fields[0];
    if (!field) return;
    const kind = viewFieldKind(field.type);
    write([
      ...items,
      {
        id: newId("c"),
        fields: [[`data:field:${field.id}`]],
        op: VIEW_COMPARISONS_BY_KIND[kind][0]!,
      } as ViewCondition,
    ]);
  };
  return (
    <div className="validation-rules-list" data-filter-tree="">
      {items.map((item) => {
        const warn = refused.includes(item.id);
        if ("items" in item)
          return (
            <div key={item.id} className="validation-rule-row">
              <p
                className="data-view-detail-line"
                data-refused={warn || undefined}
              >
                {t("filterBar.group", { count: item.items.length })}
                {warn ? ` — ${t("filterBar.refused")}` : ""}
              </p>
              <PropertyRowMenu
                label={t("filterBar.conditionActions", { name: item.id })}
                items={[{ id: "remove", label: t("filterBar.remove") }]}
                onAction={() => write(items.filter((other) => other !== item))}
              />
            </div>
          );
        const field = fieldOf(item);
        const kind = viewFieldKind(field?.type);
        const edit = (patch: Partial<ViewCondition>) =>
          write(
            items.map((other) =>
              other === item
                ? (Object.fromEntries(
                    Object.entries({ ...item, ...patch }).filter(
                      ([, cell]) => cell !== undefined,
                    ),
                  ) as unknown as ViewCondition)
                : other,
            ),
          );
        const takesValue = item.op !== "exists" && item.op !== "notExists";
        return (
          <div
            key={item.id}
            className="validation-rule-condition"
            data-refused={warn || undefined}
          >
            <div className="validation-rule-row">
              <PropertySelect
                label={t("filterBar.field")}
                value={field?.id ?? ""}
                options={fields.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                translateOptions={false}
                onChange={(next) => {
                  const nextKind = viewFieldKind(
                    fields.find((option) => option.id === next)?.type,
                  );
                  edit({
                    fields: [[`data:field:${next}` as never]],
                    ...(VIEW_COMPARISONS_BY_KIND[nextKind].includes(item.op)
                      ? {}
                      : {
                          op: VIEW_COMPARISONS_BY_KIND[nextKind][0]!,
                          value: undefined,
                        }),
                  });
                }}
              />
              <PropertyRowMenu
                label={t("filterBar.conditionActions", {
                  name: field?.label ?? item.id,
                })}
                items={[
                  {
                    id: "toggle",
                    label:
                      item.enabled === false
                        ? t("filterBar.turnOn")
                        : t("filterBar.turnOff"),
                  },
                  { id: "remove", label: t("filterBar.remove") },
                ]}
                onAction={(id) =>
                  id === "toggle"
                    ? edit({
                        enabled: item.enabled === false ? undefined : false,
                      })
                    : write(items.filter((other) => other !== item))
                }
              />
            </div>
            <PropertySelect
              label={t("filterBar.comparison")}
              value={item.op}
              options={VIEW_COMPARISONS_BY_KIND[kind].map((op) => ({
                value: op,
                label: t(`dataView.op_${op}`),
              }))}
              translateOptions={false}
              onChange={(next) =>
                edit({
                  op: next as ViewComparison,
                  ...(next === "exists" || next === "notExists"
                    ? { value: undefined }
                    : {}),
                })
              }
            />
            {relativeOffered(kind, item.op) ? (
              // (ADR-320 Phase 5 — 사용자 결정 7: a relative date stays its token in the start.)
              <PropertySelect
                label={t("filterBar.date")}
                value={catalogRelativeDateOf(item.value) ?? "exact"}
                options={[
                  { value: "exact", label: t("filterBar.exactDate") },
                  ...CATALOG_RELATIVE_DATES.map((name) => ({
                    value: name,
                    label: catalogRelativeDateWord(name, locale) ?? name,
                  })),
                ]}
                translateOptions={false}
                onChange={(next) =>
                  edit({
                    value:
                      next === "exact"
                        ? undefined
                        : catalogRelativeDateToken(next as CatalogRelativeDate),
                  })
                }
              />
            ) : null}
            {takesValue &&
            !(
              relativeOffered(kind, item.op) &&
              catalogRelativeDateOf(item.value)
            ) ? (
              <PropertyInput
                label={t("filterBar.value")}
                value={valueText(item.value)}
                onChange={(text) =>
                  edit({ value: valueFromText(text, kind, item.op) })
                }
              />
            ) : null}
            {warn ? (
              <p className="data-view-detail-line" data-refused="">
                {t("filterBar.refused")}
              </p>
            ) : null}
          </div>
        );
      })}
      <Button
        className="control-button"
        data-variant="add"
        isDisabled={!fields.length}
        onPress={add}
      >
        <AddIcon size={14} aria-hidden />
        {t("filterBar.addCondition")}
      </Button>
    </div>
  );
}

/** The bar's start conditions (`defaultQuery`). */
function FilterQueryField({
  label,
  value,
  elementId,
  onChange,
}: {
  label: string;
  value: unknown;
  elementId: string | undefined;
  onChange: (value: unknown) => void;
}) {
  const bar = useBar(elementId);
  const tree = catalogFilterTreeRead(value) ?? undefined;
  const refused = useRefused(bar?.id, tree);
  return (
    <PropertyFieldset legend={label} className="filter-query-field">
      <TreeEditor
        tree={tree}
        fields={bar?.fields ?? []}
        refused={refused}
        onChange={(next) => onChange(next)}
      />
    </PropertyFieldset>
  );
}

/** The bar's saved filters (`presets`): a name and a tree each. */
function FilterPresetsField({
  label,
  value,
  elementId,
  onChange,
}: {
  label: string;
  value: unknown;
  elementId: string | undefined;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const bar = useBar(elementId);
  const presets: readonly CatalogFilterPreset[] = catalogFilterPresetsFit(value)
    ? (value as CatalogFilterPreset[])
    : [];
  const [open, setOpen] = useState<string | null>(null);
  const write = (next: readonly CatalogFilterPreset[]) =>
    onChange(next.length ? next : undefined);
  const refusedAll = useRefused(
    bar?.id,
    open ? presets.find((preset) => preset.id === open)?.query : undefined,
  );
  const add = () => {
    const field = bar?.fields[0];
    if (!field) return;
    const preset: CatalogFilterPreset = {
      id: newId("preset"),
      // (Page content: the site's language, not the Builder's.)
      name: (
        FILTER_PRESET_NAME[
          catalogSiteLanguage(workspace.runtime.graph).split("-")[0] ?? "en"
        ] ?? FILTER_PRESET_NAME.en!
      )(presets.length + 1),
      query: {
        id: CATALOG_FILTER_TREE_ID,
        op: "and",
        items: [
          {
            id: newId("c"),
            fields: [[`data:field:${field.id}` as never]],
            op: VIEW_COMPARISONS_BY_KIND[viewFieldKind(field.type)][0]!,
          },
        ],
      },
    };
    write([...presets, preset]);
    setOpen(preset.id);
  };
  return (
    <PropertyFieldset legend={label} className="filter-presets-field">
      <div className="validation-rules-list">
        {presets.map((preset) => (
          <div key={preset.id} className="validation-rule">
            <div className="validation-rule-row">
              <Button
                className="validation-rule-summary"
                aria-expanded={open === preset.id}
                onPress={() => setOpen(open === preset.id ? null : preset.id)}
              >
                {preset.name}
              </Button>
              <PropertyRowMenu
                label={t("filterBar.conditionActions", { name: preset.name })}
                items={[{ id: "remove", label: t("filterBar.remove") }]}
                onAction={() =>
                  write(presets.filter((other) => other.id !== preset.id))
                }
              />
            </div>
            {open === preset.id ? (
              <div className="validation-rule-detail">
                <PropertyInput
                  label={t("filterBar.presetLabel")}
                  value={preset.name}
                  onChange={(name) =>
                    name.trim() &&
                    write(
                      presets.map((other) =>
                        other.id === preset.id ? { ...other, name } : other,
                      ),
                    )
                  }
                />
                <TreeEditor
                  tree={preset.query}
                  fields={bar?.fields ?? []}
                  refused={refusedAll}
                  onChange={(query) =>
                    query
                      ? write(
                          presets.map((other) =>
                            other.id === preset.id
                              ? { ...other, query }
                              : other,
                          ),
                        )
                      : write(presets.filter((other) => other.id !== preset.id))
                  }
                />
              </div>
            ) : null}
          </div>
        ))}
        <Button
          className="control-button"
          data-variant="add"
          isDisabled={!bar?.fields.length}
          onPress={add}
        >
          <AddIcon size={14} aria-hidden />
          {t("filterBar.addPreset")}
        </Button>
      </div>
    </PropertyFieldset>
  );
}

/** The field of a bar's prop kind (`filter-query` · `filter-presets`). */
export default function CatalogFilterBarField(props: {
  kind: "filter-query" | "filter-presets";
  label: string;
  value: unknown;
  elementId: string | undefined;
  onChange: (value: unknown) => void;
}) {
  const { kind, ...rest } = props;
  return kind === "filter-query" ? (
    <FilterQueryField {...rest} />
  ) : (
    <FilterPresetsField {...rest} />
  );
}
