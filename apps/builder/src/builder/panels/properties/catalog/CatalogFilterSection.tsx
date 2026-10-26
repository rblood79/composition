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
  catalogControlFilterConnections,
  catalogEditFilterCondition,
  catalogFieldValues,
  catalogFilterCommand,
  catalogFilterConnections,
  catalogFilterKindOfType,
  catalogFilterTargets,
  catalogOrFilterCondition,
  catalogRemoveFilterCondition,
  catalogShareView,
  catalogSharedViewOf,
  catalogSortFollowCommand,
  catalogSplitSharedView,
  catalogUnreadFilterVariables,
  type CatalogFilterConnection,
  type CatalogFilterControlKind,
} from "../../../catalogRuntime/viewAuthoring";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { useCollections } from "../../../stores/data";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import type { DataTable } from "../../../../types/builder/data.types";
import "./CatalogFilterSection.css";

const KINDS = Object.keys(
  CATALOG_FILTER_CONTROLS,
) as CatalogFilterControlKind[];

/** The graph's revision as React state (every committed step re-reads the connections). */
function useGraphRevision() {
  const workspace = useCatalogWorkspace();
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  return useSyncExternalStore(
    subscribe,
    () => workspace.runtime.graph.revision,
  );
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
          <PropertySelect
            label={t("dataView.comparison")}
            value={condition.op}
            options={ops.map((value) => ({ value, label: op(value) }))}
            translateOptions={false}
            onChange={(value) => edit({ op: value as ViewComparison })}
          />
          {condition.enabled === undefined ? (
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
        </div>
      ) : null}
    </div>
  );
}

/** The add form: field → control kind (list entry) or target → field (control entry). */
function AddForm({
  fields,
  kindChoice,
  targets,
  target,
  onTarget,
  onCreate,
  onCancel,
}: {
  fields: readonly { id: string; key: string; type?: string }[];
  kindChoice: boolean;
  targets?: readonly { id: NodeId; label: string }[];
  target?: NodeId;
  onTarget?: (id: NodeId) => void;
  onCreate: (fieldId: string, kind: CatalogFilterControlKind) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? "");
  const [kind, setKind] = useState<CatalogFilterControlKind>("text");
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
          options={KINDS.map((value) => ({
            value,
            label: t(`dataView.kind_${value}`),
          }))}
          translateOptions={false}
          onChange={(value) => setKind(value as CatalogFilterControlKind)}
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
  const fields = (table?.schema ?? []).flatMap((field) =>
    field.id ? [{ id: field.id, key: field.key, type: field.type }] : [],
  );
  const create = (fieldId: string, kind: CatalogFilterControlKind) => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) return;
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
  const kind = useMemo(() => {
    const node = graph.getEntry(controlId);
    if (node?.kind !== "node") return undefined;
    try {
      return catalogFilterKindOfType(
        definitionTypeName(graph, node.definitionId),
      );
    } catch {
      return undefined;
    }
  }, [controlId, graph]);
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
  const fields = (table?.schema ?? []).flatMap((field) =>
    field.id ? [{ id: field.id, key: field.key, type: field.type }] : [],
  );
  const create = (fieldId: string) => {
    const listId = target ?? targets[0]?.id;
    const field = fields.find((item) => item.id === fieldId);
    if (!listId || !field) return;
    const { command, created } = catalogFilterCommand(
      graph,
      {
        listId,
        field,
        kind,
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
          kindChoice={false}
          targets={targets}
          target={target ?? targets[0]?.id}
          onTarget={setTarget}
          onCreate={(fieldId) => create(fieldId)}
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
          return (
            entry?.kind === "node" &&
            entry.binding?.collectionId === binding?.collectionId
          );
        })
      : [];
    return {
      shared,
      shareable: !shared && !!own && (own.where.items.length > 0 || !!own.sort),
      others,
    };
  }, [graph, listId, revision]);
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
  const fields = (table?.schema ?? []).flatMap((field) =>
    field.id ? [{ id: field.id, key: field.key, type: field.type }] : [],
  );
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
                let kind: CatalogFilterControlKind = "text";
                try {
                  kind =
                    (node?.kind === "node" &&
                      catalogFilterKindOfType(
                        definitionTypeName(graph, node.definitionId),
                      )) ||
                    "text";
                } catch {
                  kind = "text";
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
