/**
 * ADR-284 Phase 3 — the filter entries of the Design panel's Property tab (Decision 7 — 기능 이름
 * 하나 = 동작 하나, 진입점 양쪽):
 *
 * - a bound list: 「검색 · 필터」 at the end of its Collection section — its connections (field ·
 *   comparison · the control and variable that feed it) and 「검색 추가」 (field → control kind →
 *   the control, variable, rule and condition in one step);
 * - a filter control (SearchField · Select · …): 「목록 거르기」 — the lists it narrows and 「이
 *   컨트롤로 목록 거르기」 (target list → field), the same planner (`catalogFilterCommand`).
 *
 * A connection opens on its detail — comparison · the value that skips it · the variable — the
 * confirmation the action shows right after it ran (role `status`), and 「고치기」 · 「또는 조건
 * 추가」 · 「연결 해제」. The first screen speaks the author's words (검색 · 필드 · 컨트롤); the
 * parts (변수 · 규칙 · 조건) are the detail's.
 */
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useCatalogRevision } from "../../../catalogRuntime/react";
import { Button } from "react-aria-components/Button";
import { useI18n } from "@/i18n";
import type {
  EntryId,
  NodeId,
  ViewComparison,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  VIEW_COMPARISONS_BY_KIND,
  viewFieldKind,
} from "../../../../../../../packages/shared/src/collections/view/comparison";
import { definitionTypeName } from "../../../../../../../packages/shared/src/catalog/commands/context";
import { useCatalogWorkspace } from "../../../catalogRuntime/react.runtime";
import { catalogNodePage } from "../../../catalogRuntime/stateVariables";
import {
  CATALOG_FILTER_CONTROLS,
  catalogFilterControl,
  catalogFilterControlsOfType,
  catalogControlFilterConnections,
  catalogEditFilterCondition,
  catalogFieldPath,
  catalogStaticConditionCommand,
  catalogFieldValues,
  catalogFilterCommand,
  catalogFilterConnections,
  catalogFilterKindOfType,
  catalogFilterTargets,
  catalogGroupColumnsCommand,
  catalogGroupListCommand,
  catalogOrFilterCondition,
  catalogReferenceCountCommand,
  catalogReferenceValueCommand,
  catalogResultCountCommand,
  catalogRemoveFilterCondition,
  catalogDefaultFilterKind,
  catalogJoinSharedView,
  catalogShareView,
  catalogSharedViewOf,
  catalogSortFollowCommand,
  catalogSplitSharedView,
  catalogUnreadFilterVariables,
  catalogViewFields,
  type CatalogFilterConnection,
  type CatalogFilterControlKind,
  type CatalogFilterField,
} from "../../../catalogRuntime/viewAuthoring";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertyCheckbox } from "../../../components/property/PropertyCheckbox";
import { useCollections, useDataStore } from "../../../stores/data";
import { catalogBindingViews } from "../../../../../../../packages/shared/src/catalog/runtime/viewQuery";
import { explainViewRow } from "../../../../../../../packages/shared/src/collections/view/evaluate";
import {
  schemaHasFormula,
  useFormulaEngine,
} from "../../../catalogRuntime/formulaEngine";
import { useViewSerializer } from "./viewSerializer";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import type { DataTable } from "../../../../types/builder/data.types";
import "./CatalogFilterSection.css";

/** ADR-284 Phase 6 — 「고정 값으로」: a condition with no control (a literal value). */
const STATIC = "static";
type AddKind = CatalogFilterControlKind | typeof STATIC;
/** 「검색 추가」 's controls — every one it can place (from the interaction registry), then 「고정 값」. */
const KINDS: readonly AddKind[] = [
  ...CATALOG_FILTER_CONTROLS.filter((control) => control.insertable).map(
    (control) => control.id,
  ),
  STATIC,
];

/** A control choice's label: its type and the value it writes (「Slider · 숫자」). */
function kindLabel(t: ReturnType<typeof useI18n>["t"], kind: AddKind): string {
  const control = kind === STATIC ? undefined : catalogFilterControl(kind);
  return control
    ? `${control.type} · ${t(`dataView.shape_${control.shape}`)}`
    : t("dataView.kind_static");
}

/** The graph's revision as React state (every committed step re-reads the connections). */
function useGraphRevision() {
  return useCatalogRevision(useCatalogWorkspace());
}

/** A bound node's collection (the data store's table). */
function useBoundTable(nodeId: NodeId | undefined): DataTable | undefined {
  const workspace = useCatalogWorkspace();
  const collections = useCollections();
  const revision = useGraphRevision();
  return useMemo(() => {
    void revision;
    if (!nodeId) return undefined;
    const node = workspace.runtime.graph.getEntry(nodeId);
    const binding = node?.kind === "node" ? node.binding : undefined;
    const id = binding?.collectionId.replace(/^data:collection:/, "");
    return collections.find((table) => table.id === id);
  }, [collections, nodeId, revision, workspace]);
}

/** A list's fields for a condition · a grouping: its own and those through its references. */
function useViewFields(table: DataTable | undefined): CatalogFilterField[] {
  const collections = useCollections();
  return useMemo(
    () => catalogViewFields(table, collections),
    [collections, table],
  );
}

const rowsOf = (table: DataTable | undefined): readonly unknown[] =>
  (table?.useMockData ? table.mockData : table?.runtimeData) ?? [];

/** One connection: its summary row and, opened, its detail (comparison · skip · variable). */
function ConnectionRow({
  connection,
  table,
  open,
  justMade,
  onToggle,
  showList,
}: {
  connection: CatalogFilterConnection;
  table: DataTable | undefined;
  open: boolean;
  justMade: boolean;
  onToggle: () => void;
  showList?: boolean;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const graph = workspace.runtime.graph;
  const { condition, listId } = connection;
  const fieldId = condition.fields[0]?.[0]?.replace(/^data:field:/, "");
  const field = table?.schema.find((item) => item.id === fieldId);
  const typeName = (nodeId: string) => {
    const node = graph.getEntry(nodeId);
    if (node?.kind !== "node") return nodeId;
    if (node.name) return node.name;
    try {
      return definitionTypeName(graph, node.definitionId);
    } catch {
      return nodeId;
    }
  };
  const op = (value: ViewComparison) => t(`dataView.op_${value}`);
  // (ADR-284 Phase 6 — 「또는 조건 추가」 copies the condition for another field: the field is
  //  edited here — plants' search over the common and the scientific name.)
  const viewFields = useViewFields(table);
  const fieldValue = (condition.fields[0] ?? []).join("|");
  const controls = connection.controls.map((control) =>
    typeName(control.nodeId),
  );
  const summary = t("dataView.summary", {
    field: field?.key ?? fieldId ?? "?",
    op: op(condition.op),
    control: controls.join(", ") || t("dataView.noControl"),
  });
  const ops = VIEW_COMPARISONS_BY_KIND[viewFieldKind(field?.type)];
  const edit = (patch: Parameters<typeof catalogEditFilterCondition>[3]) =>
    run(catalogEditFilterCondition(graph, listId, condition.id, patch));
  const skip =
    condition.skip === undefined || condition.skip === "empty"
      ? ""
      : String(condition.skip);
  return (
    <div className="data-view-connection" data-open={open || undefined}>
      <div className="data-view-connection-row">
        <Button
          className="data-view-connection-summary"
          onPress={onToggle}
          aria-expanded={open}
        >
          {showList ? `${typeName(listId)} · ` : ""}
          {summary}
        </Button>
        <div className="data-view-connection-actions">
          <PropertyRowMenu
            label={t("dataView.actions", { name: summary })}
            items={[
              { id: "edit", label: t("dataView.edit") },
              { id: "or", label: t("dataView.orAdd") },
              { id: "unlink", label: t("dataView.unlink") },
            ]}
            onAction={(id) => {
              if (id === "edit") onToggle();
              if (id === "or")
                run(
                  catalogOrFilterCondition(
                    graph,
                    listId,
                    condition.id,
                    `${condition.id}-or-${crypto.randomUUID().slice(0, 4)}`,
                  ),
                );
              if (id === "unlink")
                run(catalogRemoveFilterCondition(graph, listId, condition.id));
            }}
          />
        </div>
      </div>
      {open ? (
        <div
          className="data-view-connection-detail"
          {...(justMade ? { role: "status" } : {})}
        >
          {justMade ? (
            <p className="data-view-made">{t("dataView.made")}</p>
          ) : null}
          {viewFields.length > 1 ? (
            <PropertySelect
              label={t("dataView.field")}
              value={fieldValue}
              options={viewFields.map((item) => ({
                value: catalogFieldPath(item).join("|"),
                label: item.key,
              }))}
              translateOptions={false}
              onChange={(value) => {
                const next = viewFields.find(
                  (item) => catalogFieldPath(item).join("|") === value,
                );
                if (!next) return;
                const kind = viewFieldKind(next.type);
                edit({
                  fields: [catalogFieldPath(next)],
                  // (A comparison the new field's kind does not offer becomes its first.)
                  ...(VIEW_COMPARISONS_BY_KIND[kind].includes(condition.op)
                    ? {}
                    : { op: VIEW_COMPARISONS_BY_KIND[kind][0]! }),
                });
              }}
            />
          ) : null}
          <PropertySelect
            label={t("dataView.comparison")}
            value={condition.op}
            options={ops.map((value) => ({ value, label: op(value) }))}
            translateOptions={false}
            onChange={(value) => edit({ op: value as ViewComparison })}
          />
          {!connection.variable &&
          condition.op !== "exists" &&
          condition.op !== "notExists" &&
          !Array.isArray(condition.value) ? (
            <PropertyInput
              label={t("dataView.fixedValue")}
              value={
                condition.value === undefined ? "" : String(condition.value)
              }
              onChange={(value) =>
                edit({
                  value:
                    viewFieldKind(field?.type) === "number" &&
                    value.trim() !== "" &&
                    Number.isFinite(Number(value))
                      ? Number(value)
                      : viewFieldKind(field?.type) === "boolean"
                        ? value === "true"
                        : value,
                })
              }
            />
          ) : null}
          {condition.enabled === undefined && connection.variable ? (
            <PropertyInput
              label={t("dataView.skip")}
              value={skip}
              placeholder={t("dataView.skipEmpty")}
              onChange={(value) =>
                edit(
                  value.trim() ? { skip: value.trim() } : { skip: undefined },
                )
              }
            />
          ) : null}
          <p className="data-view-detail-line">
            {t("dataView.variableLine", {
              variable: connection.variable?.name ?? "—",
              control: controls.join(", ") || t("dataView.noControl"),
            })}
          </p>
          <ConnectionRun connection={connection} table={table} />
        </div>
      ) : null}
    </div>
  );
}

/** The add form: field → control kind (list entry) or target → field (control entry). */
function AddForm({
  fields,
  kindChoice,
  kinds,
  targets,
  target,
  onTarget,
  onCreate,
  onCancel,
}: {
  fields: readonly { id: string; key: string; type?: string }[];
  kindChoice: boolean;
  /** The controls to choose from (default: every control 「검색 추가」 places). */
  kinds?: readonly AddKind[];
  targets?: readonly { id: NodeId; label: string }[];
  target?: NodeId;
  onTarget?: (id: NodeId) => void;
  onCreate: (fieldId: string, kind: AddKind) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? "");
  // (The control follows the field's type until one is chosen — a boolean is a Checkbox.)
  const [chosen, setChosen] = useState<AddKind | null>(null);
  const choices = kinds ?? KINDS;
  const fallback = catalogDefaultFilterKind(
    fields.find((field) => field.id === fieldId)?.type,
  );
  const kind = chosen ?? (choices.includes(fallback) ? fallback : choices[0]!);
  const setKind = setChosen;
  return (
    <div className="data-view-add-form">
      {targets ? (
        <PropertySelect
          label={t("dataView.target")}
          value={target ?? ""}
          options={targets.map((item) => ({
            value: item.id,
            label: item.label,
          }))}
          translateOptions={false}
          onChange={(value) => onTarget?.(value as NodeId)}
        />
      ) : null}
      {fields.length ? (
        <PropertySelect
          label={t("dataView.field")}
          value={fieldId}
          options={fields.map((field) => ({
            value: field.id,
            label: field.key,
          }))}
          translateOptions={false}
          onChange={setFieldId}
        />
      ) : (
        <p className="data-view-detail-line">{t("dataView.noFields")}</p>
      )}
      {kindChoice ? (
        <PropertySelect
          label={t("dataView.control")}
          value={kind}
          options={choices.map((value) => ({
            value,
            label: kindLabel(t, value),
          }))}
          translateOptions={false}
          onChange={(value) => setKind(value as AddKind)}
        />
      ) : null}
      <div className="data-view-add-actions">
        <Button
          className="control-button"
          data-variant="primary"
          isDisabled={!fieldId}
          onPress={() => onCreate(fieldId, kind)}
        >
          {t("dataView.create")}
        </Button>
        <Button className="control-button" onPress={onCancel}>
          {t("dataView.cancel")}
        </Button>
      </div>
    </div>
  );
}

/** A bound list's 「검색 · 필터」 (the end of its Collection section). */
export function CatalogListFilterSection({ listId }: { listId: NodeId }) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const revision = useGraphRevision();
  const table = useBoundTable(listId);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [madeId, setMadeId] = useState<string | null>(null);
  const connections = useMemo(() => {
    void revision;
    return catalogFilterConnections(workspace.runtime.graph, listId);
  }, [listId, revision, workspace]);
  const fields = useViewFields(table);
  const create = (fieldId: string, kind: AddKind) => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return;
    if (kind === STATIC) {
      const { command, created } = catalogStaticConditionCommand(
        workspace.runtime.graph,
        { listId, field, label: t("dataView.add") },
        workspace.newId,
      );
      if (!run(command)) return;
      setAdding(false);
      setOpenId(created.conditionId);
      setMadeId(created.conditionId);
      return;
    }
    const { command, created } = catalogFilterCommand(
      workspace.runtime.graph,
      {
        listId,
        field,
        kind,
        control: { insert: true },
        values: catalogFieldValues(rowsOf(table), field),
        allLabel: t("dataView.allOption"),
        label: t("dataView.add"),
      },
      workspace.newId,
    );
    if (!run(command)) return;
    setAdding(false);
    setOpenId(created.conditionId);
    setMadeId(created.conditionId);
  };
  return (
    <fieldset className="properties-aria data-view-section">
      <legend className="fieldset-legend">{t("dataView.section")}</legend>
      <SharedView listId={listId} />
      {connections.map((connection) => (
        <ConnectionRow
          key={connection.condition.id}
          connection={connection}
          table={table}
          open={openId === connection.condition.id}
          justMade={madeId === connection.condition.id}
          onToggle={() => {
            setMadeId(null);
            setOpenId((id) =>
              id === connection.condition.id ? null : connection.condition.id,
            );
          }}
        />
      ))}
      {adding ? (
        <AddForm
          fields={fields}
          kindChoice
          onCreate={create}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          className="control-button"
          data-variant="add"
          onPress={() => setAdding(true)}
        >
          {t("dataView.add")}
        </Button>
      )}
      <UnreadVariables listId={listId} table={table} />
      <SortFollow listId={listId} />
      <DerivedViews listId={listId} table={table} />
    </fieldset>
  );
}

/**
 * 「정렬 따라가기」 (Decision 5 · §9.4-6) — from a Table: another list follows its sort; from
 * another list: it follows a Table's. One action (`catalogSortFollowCommand`) either way. A list
 * already sorted by a variable shows that variable.
 */
function SortFollow({ listId }: { listId: NodeId }) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const revision = useGraphRevision();
  const graph = workspace.runtime.graph;
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<NodeId | undefined>();
  const info = useMemo(() => {
    void revision;
    const node = graph.getEntry(listId);
    const binding = node?.kind === "node" ? node.binding : undefined;
    const typeName = (id: NodeId) => {
      const entry = graph.getEntry(id);
      try {
        return entry?.kind === "node"
          ? definitionTypeName(graph, entry.definitionId)
          : "";
      } catch {
        return "";
      }
    };
    const sort =
      binding?.view?.sort ??
      (() => {
        const shared = binding?.viewId
          ? graph.getEntry(binding.viewId)
          : undefined;
        return shared?.kind === "view" ? shared.sort : undefined;
      })();
    const sortVariable =
      sort && "variableId" in sort
        ? graph.getEntry(sort.variableId)
        : undefined;
    const isTable = typeName(listId) === "Table";
    const pageId = catalogNodePage(graph as never, listId);
    const others = pageId
      ? catalogFilterTargets(graph, pageId as EntryId<"page">).filter(
          (id) => id !== listId && (isTable ? true : typeName(id) === "Table"),
        )
      : [];
    return {
      isTable,
      sortName:
        sortVariable?.kind === "stateVariable" ? sortVariable.name : undefined,
      others: others.map((id) => {
        const entry = graph.getEntry(id);
        return {
          id,
          label:
            (entry?.kind === "node" && entry.name) ||
            `${typeName(id)} · ${id.slice(-4)}`,
        };
      }),
    };
  }, [graph, listId, revision]);
  if (info.sortName)
    return (
      <p className="data-view-detail-line">
        {t("dataView.sortFollowing", { variable: info.sortName })}
      </p>
    );
  if (!info.others.length) return null;
  if (!picking)
    return (
      <Button
        className="control-button"
        data-variant="add"
        onPress={() => setPicking(true)}
      >
        {t("dataView.sortFollow")}
      </Button>
    );
  const target = picked ?? info.others[0]!.id;
  return (
    <div className="data-view-add-form">
      <PropertySelect
        label={t(info.isTable ? "dataView.sortFollower" : "dataView.sortTable")}
        value={target}
        options={info.others.map((item) => ({
          value: item.id,
          label: item.label,
        }))}
        translateOptions={false}
        onChange={(value) => setPicked(value as NodeId)}
      />
      <div className="data-view-add-actions">
        <Button
          className="control-button"
          data-variant="primary"
          onPress={() => {
            const { command } = catalogSortFollowCommand(
              graph,
              info.isTable
                ? {
                    tableId: listId,
                    followerIds: [target],
                    label: t("dataView.sortFollow"),
                  }
                : {
                    tableId: target,
                    followerIds: [listId],
                    label: t("dataView.sortFollow"),
                  },
              workspace.newId,
            );
            if (run(command)) setPicking(false);
          }}
        >
          {t("dataView.create")}
        </Button>
        <Button className="control-button" onPress={() => setPicking(false)}>
          {t("dataView.cancel")}
        </Button>
      </div>
    </div>
  );
}

/**
 * ADR-284 G4 — the derived views of a list (Decision 7): 「결과 수 표시」 (a Text with the count of
 * the list's view), 「묶기로 목록 만들기」 · 「묶기로 열 만들기」 (a field → a ListBox of its groups ·
 * kanban columns). Each is one action; the list's built-in view is promoted to the shared view
 * the derived view reads (no condition copied).
 */
function DerivedViews({
  listId,
  table,
}: {
  listId: NodeId;
  table: DataTable | undefined;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const [grouping, setGrouping] = useState<
    "list" | "columns" | "value" | "count" | null
  >(null);
  const fields = useViewFields(table);
  const collections = useCollections();
  const [fieldId, setFieldId] = useState("");
  const [everyValue, setEveryValue] = useState(false);
  const graph = workspace.runtime.graph;
  // (「참조 값 표시」 — a field through a reference; 「참조하는 행 수」 — another collection's
  // reference field pointing at this one.)
  const pathFields = fields.filter((field) => field.path);
  const referring = collections.flatMap((other) =>
    other.id === table?.id
      ? []
      : other.schema.flatMap((field) =>
          field.id &&
          field.reference?.collectionId === table?.id &&
          table?.schema.some((key) => key.id === field.reference!.keyField)
            ? [{ collection: other, field }]
            : [],
        ),
  );
  const options =
    grouping === "value"
      ? pathFields.map((field) => ({ value: field.id, label: field.key }))
      : grouping === "count"
        ? referring.map(({ collection, field }) => ({
            value: `${collection.id}|${field.id}`,
            label: `${collection.name}.${field.key}`,
          }))
        : fields.map((field) => ({ value: field.id, label: field.key }));
  const chosen =
    fieldId && options.some((item) => item.value === fieldId)
      ? fieldId
      : (options[0]?.value ?? "");
  const viewName = () => {
    const node = graph.getEntry(listId);
    return t("dataView.viewName", {
      list: (node?.kind === "node" && node.name) || table?.name || "",
    });
  };
  const group = () => {
    if (grouping === "value") {
      const field = pathFields.find((item) => item.id === chosen);
      const via = fields.find((item) => item.id === field?.path?.[0]);
      const reference = table?.schema.find(
        (item) => item.id === via?.id,
      )?.reference;
      if (!field || !via || !reference) return;
      const { command } = catalogReferenceValueCommand(
        graph,
        {
          listId,
          field: via,
          target: {
            collectionId: reference.collectionId,
            key: field.key.slice(via.key.length + 1),
          },
          label: t("dataView.referenceValue"),
        },
        workspace.newId,
      );
      if (run(command)) setGrouping(null);
      return;
    }
    if (grouping === "count") {
      const hit = referring.find(
        ({ collection, field }) => `${collection.id}|${field.id}` === chosen,
      );
      const key = table?.schema.find(
        (item) => item.id === hit?.field.reference?.keyField,
      );
      if (!hit || !key?.id) return;
      const { command } = catalogReferenceCountCommand(
        graph,
        {
          listId,
          from: {
            collectionId: hit.collection.id,
            collectionName: hit.collection.name,
            field: { id: hit.field.id!, key: hit.field.key, type: "reference" },
          },
          keyField: { id: key.id, key: key.key },
          text: t("dataView.countText"),
          label: t("dataView.referenceCount"),
        },
        workspace.newId,
      );
      if (run(command)) setGrouping(null);
      return;
    }
    const field = fields.find((item) => item.id === chosen);
    if (!field || !grouping) return;
    const plan = {
      listId,
      viewName: viewName(),
      field,
      label: t(
        grouping === "list" ? "dataView.groupList" : "dataView.groupColumns",
      ),
    };
    const { command } =
      grouping === "list"
        ? catalogGroupListCommand(
            graph,
            { ...plan, emptyGroups: everyValue },
            workspace.newId,
          )
        : catalogGroupColumnsCommand(
            graph,
            { ...plan, values: catalogFieldValues(rowsOf(table), field) },
            workspace.newId,
          );
    if (run(command)) setGrouping(null);
  };
  if (grouping)
    return (
      <div className="data-view-add-form">
        <PropertySelect
          label={t(
            grouping === "value"
              ? "dataView.referenceField"
              : grouping === "count"
                ? "dataView.referringField"
                : "dataView.groupField",
          )}
          value={chosen}
          options={options}
          translateOptions={false}
          onChange={setFieldId}
        />
        {grouping === "list" ? (
          <PropertyCheckbox
            label={t("dataView.everyValue")}
            isSelected={everyValue}
            onChange={setEveryValue}
          />
        ) : null}
        <div className="data-view-add-actions">
          <Button
            className="control-button"
            data-variant="primary"
            isDisabled={!options.length}
            onPress={group}
          >
            {t("dataView.create")}
          </Button>
          <Button className="control-button" onPress={() => setGrouping(null)}>
            {t("dataView.cancel")}
          </Button>
        </div>
      </div>
    );
  return (
    <>
      <Button
        className="control-button"
        data-variant="add"
        onPress={() => {
          const { command } = catalogResultCountCommand(
            graph,
            {
              listId,
              viewName: viewName(),
              text: t("dataView.countText"),
              label: t("dataView.resultCount"),
            },
            workspace.newId,
          );
          run(command);
        }}
      >
        {t("dataView.resultCount")}
      </Button>
      <Button
        className="control-button"
        data-variant="add"
        onPress={() => {
          const { command } = catalogResultCountCommand(
            graph,
            {
              listId,
              viewName: viewName(),
              text: t("dataView.appliedText"),
              label: t("dataView.appliedCount"),
              aggregate: "applied",
            },
            workspace.newId,
          );
          run(command);
        }}
      >
        {t("dataView.appliedCount")}
      </Button>
      <Button
        className="control-button"
        data-variant="add"
        onPress={() => setGrouping("list")}
      >
        {t("dataView.groupList")}
      </Button>
      <Button
        className="control-button"
        data-variant="add"
        onPress={() => setGrouping("columns")}
      >
        {t("dataView.groupColumns")}
      </Button>
      {pathFields.length ? (
        <Button
          className="control-button"
          data-variant="add"
          onPress={() => setGrouping("value")}
        >
          {t("dataView.referenceValue")}
        </Button>
      ) : null}
      {referring.length ? (
        <Button
          className="control-button"
          data-variant="add"
          onPress={() => setGrouping("count")}
        >
          {t("dataView.referenceCount")}
        </Button>
      ) : null}
    </>
  );
}

/** A filter control's 「목록 거르기」 — the lists it narrows, and 「이 컨트롤로 목록 거르기」. */
export function CatalogControlFilterSection({
  controlId,
}: {
  controlId: NodeId;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const revision = useGraphRevision();
  const graph = workspace.runtime.graph;
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [madeId, setMadeId] = useState<string | null>(null);
  // (A ComboBox is two controls — the chosen key · the typed text: the author picks which.)
  const kinds = useMemo(() => {
    const node = graph.getEntry(controlId);
    if (node?.kind !== "node") return [];
    try {
      return catalogFilterControlsOfType(
        definitionTypeName(graph, node.definitionId),
      ).map((control) => control.id);
    } catch {
      return [];
    }
  }, [controlId, graph]);
  const kind = kinds[0];
  const targets = useMemo(() => {
    void revision;
    const pageId = catalogNodePage(graph as never, controlId);
    return pageId
      ? catalogFilterTargets(graph, pageId as EntryId<"page">).map((id) => {
          const node = graph.getEntry(id);
          let label: string = id;
          if (node?.kind === "node")
            try {
              label = node.name ?? definitionTypeName(graph, node.definitionId);
            } catch {
              label = id;
            }
          return { id, label };
        })
      : [];
  }, [controlId, graph, revision]);
  const [target, setTarget] = useState<NodeId | undefined>(targets[0]?.id);
  const table = useBoundTable(target ?? targets[0]?.id);
  const connections = useMemo(() => {
    void revision;
    return catalogControlFilterConnections(graph, controlId);
  }, [controlId, graph, revision]);
  const collections = useCollections();
  if (!kind) return null;
  const fields = useViewFields(table);
  const create = (fieldId: string, chosen: AddKind = kind!) => {
    const listId = target ?? targets[0]?.id;
    if (chosen === STATIC) return;
    const field = fields.find((item) => item.id === fieldId);
    if (!listId || !field) return;
    const { command, created } = catalogFilterCommand(
      graph,
      {
        listId,
        field,
        kind: chosen,
        control: { nodeId: controlId },
        values: catalogFieldValues(rowsOf(table), field),
        allLabel: t("dataView.allOption"),
        label: t("dataView.controlAction"),
      },
      workspace.newId,
    );
    if (!run(command)) return;
    setAdding(false);
    setOpenId(created.conditionId);
    setMadeId(created.conditionId);
  };
  return (
    <fieldset className="properties-aria data-view-section">
      <legend className="fieldset-legend">
        {t("dataView.controlSection")}
      </legend>
      {connections.map((connection) => {
        const list = graph.getEntry(connection.listId);
        const binding = list?.kind === "node" ? list.binding : undefined;
        const listTable = collections.find(
          (item) =>
            item.id === binding?.collectionId.replace(/^data:collection:/, ""),
        );
        return (
          <ConnectionRow
            key={`${connection.listId}:${connection.condition.id}`}
            connection={connection}
            table={listTable}
            showList
            open={openId === connection.condition.id}
            justMade={madeId === connection.condition.id}
            onToggle={() => {
              setMadeId(null);
              setOpenId((id) =>
                id === connection.condition.id ? null : connection.condition.id,
              );
            }}
          />
        );
      })}
      {!targets.length ? (
        <p className="data-view-detail-line">{t("dataView.noTargets")}</p>
      ) : adding ? (
        <AddForm
          fields={fields}
          kindChoice={kinds.length > 1}
          kinds={kinds}
          targets={targets}
          target={target ?? targets[0]?.id}
          onTarget={setTarget}
          onCreate={(fieldId, chosen) => create(fieldId, chosen)}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          className="control-button"
          data-variant="add"
          onPress={() => setAdding(true)}
        >
          {t("dataView.controlAction")}
        </Button>
      )}
    </fieldset>
  );
}

/** A node's display name (its own, else its component type). */
function nodeLabel(
  graph: ReturnType<typeof useCatalogWorkspace>["runtime"]["graph"],
  id: string,
): string {
  const node = graph.getEntry(id);
  if (node?.kind !== "node") return id;
  if (node.name) return node.name;
  try {
    return definitionTypeName(graph, node.definitionId);
  } catch {
    return id;
  }
}

/**
 * Decision 7 — a shared view: who reads it (「이 보기를 N 개가 봅니다」 — a change reaches them all)
 * and 「이 목록에서만」 (the list keeps a copy as its own). A built-in view with conditions offers
 * 「이름 붙여 공유」 (another list on the same data reads it instead of its own).
 */
function SharedView({ listId }: { listId: NodeId }) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const revision = useGraphRevision();
  const graph = workspace.runtime.graph;
  const [sharing, setSharing] = useState(false);
  const [name, setName] = useState("");
  // (「없음」 is a key of its own — an empty value reads as no choice.)
  const [other, setOther] = useState<string>("none");
  const info = useMemo(() => {
    void revision;
    const shared = catalogSharedViewOf(graph, listId);
    const node = graph.getEntry(listId);
    const binding = node?.kind === "node" ? node.binding : undefined;
    const own = binding?.view;
    const pageId = catalogNodePage(graph as never, listId);
    const others = pageId
      ? catalogFilterTargets(graph, pageId as EntryId<"page">).filter((id) => {
          if (id === listId) return false;
          const entry = graph.getEntry(id);
          // (A list on the same data — not a one-item read such as a result count's Text.)
          return (
            entry?.kind === "node" &&
            entry.binding?.collectionId === binding?.collectionId &&
            entry.binding?.key === undefined
          );
        })
      : [];
    return {
      shared,
      shareable: !shared && !!own && (own.where.items.length > 0 || !!own.sort),
      others,
    };
  }, [graph, listId, revision]);
  // (Lists on the data that do not read the shared view yet — 「함께 볼 목록」.)
  // (A list reading another shared view keeps it — 「이 목록에서만」 there first.)
  const joinable: string[] = info.shared
    ? info.others.filter((id) => {
        const entry = graph.getEntry(id);
        return entry?.kind === "node" && !entry.binding?.viewId;
      })
    : [];
  const joining = (joinable.includes(other) ? other : joinable[0]) as NodeId;
  if (info.shared)
    return (
      <div className="data-view-shared">
        <p className="data-view-detail-line">
          {t("dataView.sharedLine", {
            name: info.shared.view.name,
            count: info.shared.users.length,
          })}
        </p>
        {info.shared.users.length > 1 ? (
          <Button
            className="control-button"
            onPress={() => run(catalogSplitSharedView(graph, listId))}
          >
            {t("dataView.splitHere")}
          </Button>
        ) : null}
        {joinable.length ? (
          <>
            <PropertySelect
              label={t("dataView.shareWith")}
              value={joining}
              options={joinable.map((id) => ({
                value: id,
                label: nodeLabel(graph, id),
              }))}
              translateOptions={false}
              onChange={setOther}
            />
            <Button
              className="control-button"
              onPress={() =>
                run(catalogJoinSharedView(info.shared!.view.id, [joining]))
              }
            >
              {t("dataView.shareJoin")}
            </Button>
          </>
        ) : null}
      </div>
    );
  if (!info.shareable) return null;
  if (!sharing)
    return (
      <Button className="control-button" onPress={() => setSharing(true)}>
        {t("dataView.shareView")}
      </Button>
    );
  return (
    <div className="data-view-add-form">
      <PropertyInput
        label={t("dataView.shareName")}
        value={name}
        onChange={setName}
      />
      {info.others.length ? (
        <PropertySelect
          label={t("dataView.shareWith")}
          value={other}
          options={[
            { value: "none", label: t("dataView.shareNone") },
            ...info.others.map((id) => ({
              value: id,
              label: nodeLabel(graph, id),
            })),
          ]}
          translateOptions={false}
          onChange={setOther}
        />
      ) : null}
      <div className="data-view-add-actions">
        <Button
          className="control-button"
          data-variant="primary"
          isDisabled={!name.trim()}
          onPress={() => {
            if (
              run(
                catalogShareView(
                  graph,
                  {
                    listId,
                    name: name.trim(),
                    otherIds: other !== "none" ? [other as NodeId] : [],
                  },
                  workspace.newId,
                ),
              )
            )
              setSharing(false);
          }}
        >
          {t("dataView.create")}
        </Button>
        <Button className="control-button" onPress={() => setSharing(false)}>
          {t("dataView.cancel")}
        </Button>
      </div>
    </div>
  );
}

/**
 * §9.3-9 — a control on the page sets a variable no list reads (the variable and the rule were made
 * by hand): it is named here, with 「이 목록의 조건으로 연결」 (the condition reads that variable — no
 * second variable or rule).
 */
function UnreadVariables({
  listId,
  table,
}: {
  listId: NodeId;
  table: DataTable | undefined;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const revision = useGraphRevision();
  const graph = workspace.runtime.graph;
  const [connecting, setConnecting] = useState<string | null>(null);
  const unread = useMemo(() => {
    void revision;
    return catalogUnreadFilterVariables(graph, listId);
  }, [graph, listId, revision]);
  const fields = useViewFields(table);
  if (!unread.length) return null;
  return (
    <>
      {unread.map((item) => (
        <div className="data-view-unread" key={item.variableId}>
          <p className="data-view-detail-line" role="note">
            {t("dataView.unreadLine", {
              control: nodeLabel(graph, item.controlId),
              variable: item.name,
            })}
          </p>
          {connecting === item.variableId ? (
            <AddForm
              fields={fields}
              kindChoice={false}
              onCreate={(fieldId) => {
                const field = fields.find((entry) => entry.id === fieldId);
                const node = graph.getEntry(item.controlId);
                let kind: CatalogFilterControlKind = "SearchField";
                try {
                  kind =
                    (node?.kind === "node" &&
                      catalogFilterKindOfType(
                        definitionTypeName(graph, node.definitionId),
                      )) ||
                    "SearchField";
                } catch {
                  kind = "SearchField";
                }
                if (!field) return;
                const { command } = catalogFilterCommand(
                  graph,
                  {
                    listId,
                    field,
                    kind,
                    control: { nodeId: item.controlId },
                    values: catalogFieldValues(rowsOf(table), field),
                    allLabel: t("dataView.allOption"),
                    reuseVariableId: item.variableId as never,
                    label: t("dataView.connectUnread"),
                  },
                  workspace.newId,
                );
                if (run(command)) setConnecting(null);
              }}
              onCancel={() => setConnecting(null)}
            />
          ) : (
            <Button
              className="control-button"
              onPress={() => setConnecting(item.variableId)}
            >
              {t("dataView.connectUnread")}
            </Button>
          )}
        </div>
      ))}
    </>
  );
}

/** A reference's value: the running Preview's (when it reports), else the variable's default. */
function useViewResolver(listId: NodeId) {
  const workspace = useCatalogWorkspace();
  const projectVariables = useDataStore((state) => state.variables);
  const subscribe = useCallback(
    (notify: () => void) => workspace.subscribePreviewValues(notify),
    [workspace],
  );
  const running = useSyncExternalStore(
    subscribe,
    () => workspace.previewValues,
  );
  const graph = workspace.runtime.graph;
  const valueOf = useCallback(
    (variableId: string): { value: unknown } | undefined => {
      if (running && Object.prototype.hasOwnProperty.call(running, variableId))
        return { value: running[variableId] };
      const entry = graph.getEntry(variableId);
      if (entry?.kind === "stateVariable")
        return {
          value:
            entry.defaultValue === "" &&
            (entry.valueType === "object" || entry.valueType === "array")
              ? null
              : entry.defaultValue,
        };
      if (variableId.startsWith("data:variable:")) {
        const id = variableId.slice("data:variable:".length);
        const project = [...projectVariables.values()].find(
          (variable) => variable.id === id,
        );
        return project ? { value: project.defaultValue } : undefined;
      }
      return undefined;
    },
    [graph, projectVariables, running],
  );
  const resolve = useCallback(
    (value: unknown): { value: unknown } | undefined => {
      if (typeof value !== "string" || !value.startsWith("!")) return { value };
      const match = /^!var\.([^.]+)((?:\.[^.]+)*)$/.exec(value);
      if (!match) return undefined;
      const read = valueOf(match[1]!);
      if (!read) return undefined;
      let current = read.value;
      for (const segment of (match[2] ?? "").split(".").filter(Boolean))
        current =
          current !== null && typeof current === "object"
            ? (current as Record<string, unknown>)[segment]
            : undefined;
      return { value: current };
    },
    [valueOf],
  );
  void listId;
  return { running: running !== undefined, valueOf, resolve };
}

/**
 * Decision 11 — the connection as it runs: the variable's current value (the Preview's, else 「실행
 * 전」 and the default), each local row's verdict on the condition (the evaluator's own judge —
 * `explainViewRow`), or for an API collection the request it sends and what it cannot send (rows the
 * server did not return have no local reason).
 */
function ConnectionRun({
  connection,
  table,
}: {
  connection: CatalogFilterConnection;
  table: DataTable | undefined;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const graph = workspace.runtime.graph;
  const endpoints = useDataStore((state) => state.apiEndpoints);
  const { running, valueOf, resolve } = useViewResolver(connection.listId);
  const show = (value: unknown) =>
    value === undefined || value === null || value === ""
      ? t("dataView.empty")
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  const variableValue = connection.variable
    ? valueOf(connection.variable.id)?.value
    : undefined;
  const list = graph.getEntry(connection.listId);
  const binding = list?.kind === "node" ? list.binding : undefined;
  const queries = binding ? catalogBindingViews(graph, binding) : undefined;
  const schema = useViewFields(table);
  // (ADR-291 — the verdicts read computed cells: rendered again once the formula engine loads,
  //   not left on the cells read before it.)
  useFormulaEngine(schemaHasFormula(schema));
  const local = table?.useMockData !== false;
  const endpoint = !local
    ? [...endpoints.values()].find((item) =>
        item.targetCollectionId
          ? item.targetCollectionId === table?.id
          : item.targetCollection === table?.name,
      )
    : undefined;
  const rows = local ? rowsOf(table).slice(0, 8) : [];
  const label = (row: unknown) => {
    const record = (row ?? {}) as Record<string, unknown>;
    const text = schema.find(
      (field) => typeof record[field.key] === "string" && field.key !== "id",
    );
    return String((text && record[text.key]) ?? record.id ?? "");
  };
  const verdict = (value: string) => t(`dataView.verdict_${value}`);
  const serializer = useViewSerializer(!!endpoint?.querySerialization);
  const served =
    serializer && endpoint?.querySerialization && queries
      ? {
          request: serializer.serializeViewQueries(
            endpoint.querySerialization,
            { queries, schema, resolve },
            endpoint.method,
          ),
          limits: serializer.viewQueryLimits(
            endpoint.querySerialization,
            { queries, schema },
            endpoint.method,
          ),
          cap: serializer.VIEW_LOCAL_LOAD_CAP.toLocaleString(),
        }
      : undefined;
  const request = served?.request;
  const limits = served?.limits ?? [];
  return (
    <div className="data-view-run">
      <p className="data-view-detail-line">
        {connection.variable
          ? running
            ? t("dataView.currentValue", { value: show(variableValue) })
            : t("dataView.beforeRun", { value: show(variableValue) })
          : null}
      </p>
      {local && queries && rows.length ? (
        <ul className="data-view-rows" aria-label={t("dataView.rows")}>
          {rows.map((row, index) => {
            const verdicts = explainViewRow(row, { queries, schema, resolve });
            const own = verdicts.get(connection.condition.id) ?? "skip";
            const shown =
              (verdicts.get(queries[queries.length - 1]!.where.id) ??
                "match") !== "miss";
            return (
              <li key={index} data-shown={shown}>
                {t("dataView.rowLine", {
                  row: label(row),
                  verdict: verdict(own),
                  shown: shown
                    ? t("dataView.rowShown")
                    : t("dataView.rowHidden"),
                })}
              </li>
            );
          })}
        </ul>
      ) : null}
      {!local ? (
        <>
          <p className="data-view-detail-line">
            {endpoint?.querySerialization
              ? request?.body
                ? t("dataView.requestBody", {
                    body: JSON.stringify(request.body),
                  })
                : t("dataView.requestParams", {
                    params:
                      request?.params
                        .map(([key, value]) => `${key}=${value}`)
                        .join("&") || t("dataView.empty"),
                  })
              : t("dataView.requestNone")}
          </p>
          {limits.length ? (
            <ul className="data-view-limits" aria-label={t("dataView.limits")}>
              {limits.map((warning, index) => (
                <li key={index}>
                  {t(`datatable.apiQueryWarn${warning.code}`, {
                    condition: warning.conditionId ?? "",
                    comparison: warning.comparison ?? "",
                    field: warning.field ?? "",
                    cap: served?.cap ?? "",
                  })}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="data-view-detail-line">{t("dataView.serverRows")}</p>
        </>
      ) : null}
    </div>
  );
}
