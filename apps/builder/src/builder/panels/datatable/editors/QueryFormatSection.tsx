/**
 * ADR-284 Decision 6 — the endpoint's query format: how the data views reading its collection go
 * into the request. `suffix` names a parameter per comparison (json-server's table by default —
 * `{field}_like`), `body` sends the condition tree as JSON, `none` filters the loaded rows. The
 * views the format cannot carry whole are listed here (the format-change moment of the three
 * warnings — never silently dropped).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
// (The file, not the `@composition/shared` barrel — the serializer stays out of the Preview's
// initial chunk: only its lazy session uses it.)
import {
  DEFAULT_QUERY_SUFFIXES,
  viewQueryLimits,
  type EndpointQuerySerialization,
  type SerializationWarning,
} from "../../../../../../../packages/shared/src/collections/view/serialize";
import {
  VIEW_COMPARISONS,
  type NodeId,
  type ViewComparison,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingViews } from "../../../../../../../packages/shared/src/catalog/runtime/viewQuery";
import { catalogCollectionId } from "../../../../../../../packages/shared/src/catalog/runtime/dataBinding";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { catalogTargetTypeName } from "../../../catalogRuntime/interactions";
import { useOptionalCatalogWorkspace } from "../../../catalogRuntime/react.runtime";
import { Section } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { useDataStore } from "../../../stores/data";
import type { ApiEndpoint } from "../../../../types/builder/data.types";

type DtFn = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

const KINDS = ["none", "suffix", "body"] as const;
/** `between` goes as its `gte` and `lte` parameters — not a row of its own. */
const SUFFIX_ROWS = VIEW_COMPARISONS.filter((op) => op !== "between");
const FIELD = "{field}";

/** The views over the endpoint's collection, each with what the format cannot carry of it. */
function useViewLimits(
  workspace: CatalogWorkspace | null,
  endpoint: ApiEndpoint,
  format: EndpointQuerySerialization,
) {
  const collections = useDataStore((state) => state.collections);
  const subscribe = useCallback(
    (notify: () => void) =>
      workspace ? workspace.runtime.subscribeSteps(() => notify()) : () => {},
    [workspace],
  );
  const revision = useSyncExternalStore(subscribe, () =>
    workspace ? workspace.runtime.graph.revision : 0,
  );
  return useMemo(() => {
    void revision;
    const table = [...collections.values()].find((item) =>
      endpoint.targetCollectionId
        ? item.id === endpoint.targetCollectionId
        : item.name === endpoint.targetCollection,
    );
    if (!workspace || !table) return [];
    const graph = workspace.runtime.graph;
    const schema = table.schema.flatMap((field) =>
      field.id ? [{ id: field.id, key: field.key, type: field.type }] : [],
    );
    const seen = new Set<string>();
    const out: { name: string; warnings: SerializationWarning[] }[] = [];
    for (const nodeId of graph.bindingsOf(catalogCollectionId(table.id))) {
      const node = graph.getEntry(nodeId as never);
      const binding = node?.kind === "node" ? node.binding : undefined;
      const queries = binding && catalogBindingViews(graph, binding);
      if (!binding || !queries) continue;
      const key = JSON.stringify(queries);
      if (seen.has(key)) continue;
      seen.add(key);
      const warnings = viewQueryLimits(
        format,
        { queries, schema },
        endpoint.method,
      );
      const shared = binding.viewId && graph.getEntry(binding.viewId);
      // (A shared view by its name; a built-in one by its component, as the Layers name it.)
      const name =
        shared && shared.kind === "view"
          ? shared.name
          : (node?.kind === "node" && node.name) ||
            catalogTargetTypeName(graph, {
              kind: "node",
              id: nodeId as NodeId,
            }) ||
            nodeId;
      out.push({ name, warnings });
    }
    return out;
  }, [workspace, collections, endpoint, format, revision]);
}

/**
 * A table cell that saves on blur · Enter — and on unmount while focused: a tab switch removes it
 * inside React's commit, where the browser's blur is not delivered (PropertyInput has the same
 * rule). The caller's `onCommit` ignores an unchanged value.
 */
function CommitInput({
  defaultValue,
  placeholder,
  onCommit,
}: {
  defaultValue: string;
  placeholder: string;
  onCommit: (text: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const editing = useRef(false);
  /** The text last handed to `onCommit` — a re-key after an Enter save does not send it again. */
  const sent = useRef(defaultValue);
  const latest = useRef(onCommit);
  latest.current = onCommit;
  const commit = (text: string) => {
    sent.current = text;
    latest.current(text);
  };
  useEffect(() => {
    const input = ref.current;
    return () => {
      if (editing.current && input && input.value !== sent.current)
        commit(input.value);
    };
    // (Unmount only — `commit` reads refs.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <input
      ref={ref}
      type="text"
      className="react-aria-Input"
      defaultValue={defaultValue}
      placeholder={placeholder}
      spellCheck={false}
      onFocus={() => {
        editing.current = true;
      }}
      onBlur={(event) => {
        editing.current = false;
        commit(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit(event.currentTarget.value);
      }}
    />
  );
}

export function QueryFormatSection({
  endpoint,
  save,
  dt,
}: {
  endpoint: ApiEndpoint;
  save: (patch: Partial<ApiEndpoint>) => Promise<void>;
  dt: DtFn;
}) {
  const workspace = useOptionalCatalogWorkspace();
  const format = useMemo<EndpointQuerySerialization>(
    () => endpoint.querySerialization ?? { kind: "none" },
    [endpoint.querySerialization],
  );
  const views = useViewLimits(workspace, endpoint, format);
  const suffixes = format.suffixes ?? DEFAULT_QUERY_SUFFIXES;
  const setFormat = (next: EndpointQuerySerialization) =>
    void save({
      querySerialization:
        next.kind === "none" && !next.suffixes ? undefined : next,
    });
  const setSuffix = (op: ViewComparison, text: string) => {
    const value = text.trim();
    const { [op]: _previous, ...rest } = suffixes;
    // (Empty = the comparison is not sent; `{field}` alone = the bare field.)
    const next: Partial<Record<ViewComparison, string>> = value
      ? { ...rest, [op]: value.replace(FIELD, "") }
      : rest;
    if ((suffixes[op] ?? null) === (next[op] ?? null)) return;
    setFormat({ ...format, suffixes: next });
  };
  const reason = (warning: SerializationWarning) =>
    dt(`apiQueryWarn${warning.code}`, {
      condition: warning.conditionId ?? "",
      comparison: warning.comparison ?? "",
    });

  return (
    <Section
      title={dt("apiQuerySection")}
      collapsible={false}
      className="datatable-api-query"
    >
      <PropertySelect
        label={dt("apiQueryFormat")}
        value={format.kind}
        onChange={(kind) =>
          setFormat({
            ...format,
            kind: kind as EndpointQuerySerialization["kind"],
          })
        }
        options={KINDS.map((kind) => ({
          value: kind,
          label: dt(`apiQueryFormat_${kind}`),
        }))}
      />
      <p className="datatable-api-hint">
        {dt(`apiQueryFormatHint_${format.kind}`)}
      </p>
      {format.kind === "suffix" && (
        <fieldset className="properties-aria datatable-api-query-table">
          <legend className="fieldset-legend">{dt("apiQueryParams")}</legend>
          {SUFFIX_ROWS.map((op) => (
            <label className="datatable-api-query-row" key={op}>
              <span className="datatable-api-query-op">{op}</span>
              <span className="react-aria-control react-aria-Group">
                <CommitInput
                  // (Re-keyed by the saved value: a reset table shows its own.)
                  key={`${op}:${suffixes[op] ?? ""}`}
                  defaultValue={
                    suffixes[op] === undefined ? "" : `${FIELD}${suffixes[op]}`
                  }
                  placeholder={dt("apiQueryNotSent")}
                  onCommit={(text) => setSuffix(op, text)}
                />
              </span>
            </label>
          ))}
          {(["sortParam", "orderParam"] as const).map((param) => (
            <label className="datatable-api-query-row" key={param}>
              <span className="datatable-api-query-op">
                {dt(`apiQuery_${param}`)}
              </span>
              <span className="react-aria-control react-aria-Group">
                <CommitInput
                  key={`${param}:${format[param] ?? ""}`}
                  defaultValue={format[param] ?? ""}
                  placeholder={param === "sortParam" ? "_sort" : "_order"}
                  onCommit={(text) => {
                    const value = text.trim();
                    if (value === (format[param] ?? "")) return;
                    const { [param]: _previous, ...rest } = format;
                    setFormat(value ? { ...rest, [param]: value } : rest);
                  }}
                />
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {format.kind !== "none" && views.length > 0 && (
        <ul
          className="datatable-api-query-views"
          aria-label={dt("apiQueryViews")}
        >
          {views.map((view) => (
            <li
              key={view.name}
              className="datatable-api-query-view-row"
              data-carried={view.warnings.length === 0}
            >
              <span className="datatable-api-query-view">{view.name}</span>
              {view.warnings.length === 0 ? (
                <span className="datatable-api-hint">
                  {dt("apiQueryCarried")}
                </span>
              ) : (
                <ul className="datatable-api-query-warnings">
                  {view.warnings.map((warning, index) => (
                    <li key={index}>{reason(warning)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
