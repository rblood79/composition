import { memo, useCallback, useSyncExternalStore } from "react";
import { Minus } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  NodeId,
  ViewComparison,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  VIEW_COMPARISONS_BY_KIND,
  type ViewFieldKind,
} from "../../../../../../../packages/shared/src/collections/view/comparison";
import {
  catalogPropFollowCommand,
  catalogPropFollowMoved,
  catalogPropFollowProps,
  catalogPropFollowVariables,
  catalogPropFollows,
  type CatalogPropFollow,
  type CatalogPropFollowType,
} from "../../../catalogRuntime/propFollow";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { runBuiltCatalogCommand } from "../../../catalogRuntime/commandRunner";

const AddIcon = ACTION_ICONS.add;
/** The comparisons that take no value. */
const NO_VALUE = new Set<ViewComparison>(["exists", "notExists"]);

interface FollowView {
  follows: CatalogPropFollow[];
  props: { prop: string; type: CatalogPropFollowType }[];
  variables: { id: string; name: string; valueType: string }[];
}

/** A variable's value kind as the comparisons see it (a selection's count is a number). */
function kindOf(valueType: string | undefined, path: string): ViewFieldKind {
  if (path === "size") return "number";
  if (valueType === "number") return "number";
  if (valueType === "boolean") return "boolean";
  if (valueType === "string[]" || valueType === "array") return "list";
  return "text";
}

/**
 * ADR-284 Phase 6 — 「변수로 정하기」: the selected node's props that read a variable. A boolean
 * prop is true while the variable compares (the view's comparisons — 「값 없음」 · 「같음」 …, or a
 * selection's count); a text prop is the variable's value; a key list or a filter control's state
 * prop (a Slider's `value`) is the variable itself. One row per prop, one step per edit.
 */
export const CatalogPropFollowSection = memo(function CatalogPropFollowSection({
  nodeId,
  workspace,
}: {
  nodeId: NodeId;
  workspace: CatalogWorkspace;
}) {
  const { t } = useI18n();
  const read = useCallback((): FollowView => {
    const graph = workspace.runtime.graph;
    return {
      follows: catalogPropFollows(graph, nodeId),
      props: catalogPropFollowProps(graph, nodeId),
      variables: catalogPropFollowVariables(graph, nodeId).map((entry) => ({
        id: entry.id,
        name: entry.name,
        valueType: entry.valueType,
      })),
    };
  }, [nodeId, workspace]);
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const viewKey = useSyncExternalStore(subscribe, () => JSON.stringify(read()));
  const view = JSON.parse(viewKey) as FollowView;

  const write = useCallback(
    (prop: string, follow: CatalogPropFollow | undefined) => {
      runBuiltCatalogCommand(workspace, () =>
        catalogPropFollowCommand(workspace.runtime.graph, nodeId, prop, follow),
      );
    },
    [nodeId, workspace],
  );

  // (A follow is listed even where nothing more can follow — a filter control's state prop.)
  if (!view.follows.length && (!view.variables.length || !view.props.length))
    return null;
  const typeOf = (prop: string) =>
    view.props.find((entry) => entry.prop === prop)?.type;
  const variableOf = (id: string) =>
    view.variables.find((entry) => entry.id === id);
  const free = view.props.filter(
    (entry) => !view.follows.some((follow) => follow.prop === entry.prop),
  );
  const add = () => {
    const next = free[0];
    const variable = view.variables[0];
    if (!next || !variable) return;
    write(
      next.prop,
      next.type === "boolean"
        ? {
            prop: next.prop,
            kind: "when",
            variableId: variable.id,
            path: "",
            op: "exists",
          }
        : { prop: next.prop, kind: "variable", variableId: variable.id },
    );
  };
  const variableOptions = view.variables.map((entry) => ({
    value: entry.id,
    label: entry.name,
  }));
  return (
    <PropertySection
      title={t("dataView.follow_title")}
      actions={
        free.length ? (
          <button
            type="button"
            className="iconButton"
            aria-label={t("dataView.follow_add")}
            onClick={add}
          >
            <AddIcon size={16} />
          </button>
        ) : undefined
      }
    >
      {view.follows.map((follow) => {
        const variable = variableOf(follow.variableId);
        const isWhen = follow.kind === "when";
        const path = isWhen ? follow.path : "";
        const kind = kindOf(variable?.valueType, path);
        const ops = VIEW_COMPARISONS_BY_KIND[kind];
        const list =
          variable?.valueType === "string[]" || variable?.valueType === "array";
        return (
          <div key={follow.prop} className="prop-follow-row">
            <div className="list-row">
              <div className="list-row__body">
                <span className="list-row__label">{follow.prop}</span>
              </div>
              <div className="list-row__actions">
                <button
                  type="button"
                  className="list-row__action"
                  aria-label={t("dataView.follow_remove", {
                    prop: follow.prop,
                  })}
                  onClick={() => write(follow.prop, undefined)}
                >
                  <Minus size={12} />
                </button>
              </div>
            </div>
            <div className="list-row__fields">
              <div className="fieldset-row">
                <PropertySelect
                  label={t("dataView.follow_prop")}
                  value={follow.prop}
                  options={[
                    { value: follow.prop, label: follow.prop },
                    ...free.map((entry) => ({
                      value: entry.prop,
                      label: entry.prop,
                    })),
                  ]}
                  translateOptions={false}
                  onChange={(prop) => {
                    if (prop === follow.prop) return;
                    // (ADR-287 — another kind of prop takes the other shape.)
                    write(
                      follow.prop,
                      catalogPropFollowMoved(follow, prop, typeOf(prop)),
                    );
                  }}
                />
                <PropertySelect
                  label={t("dataView.follow_variable")}
                  value={follow.variableId}
                  options={variableOptions}
                  translateOptions={false}
                  onChange={(variableId) =>
                    write(
                      follow.prop,
                      isWhen
                        ? { ...follow, variableId, path: "" }
                        : { ...follow, variableId },
                    )
                  }
                />
              </div>
              {isWhen && (
                <div className="fieldset-row">
                  {list && (
                    <PropertySelect
                      label={t("dataView.follow_read")}
                      value={path || "value"}
                      options={[
                        {
                          value: "value",
                          label: t("dataView.follow_readValue"),
                        },
                        { value: "size", label: t("dataView.follow_readSize") },
                      ]}
                      translateOptions={false}
                      onChange={(read) =>
                        write(follow.prop, {
                          ...follow,
                          path: read === "size" ? "size" : "",
                          op: read === "size" ? "equals" : "exists",
                          ...(read === "size"
                            ? { value: 0 }
                            : { value: undefined }),
                        })
                      }
                    />
                  )}
                  <PropertySelect
                    label={t("dataView.follow_op")}
                    value={ops.includes(follow.op) ? follow.op : ops[0]!}
                    options={ops.map((op) => ({
                      value: op,
                      label: t(`dataView.op_${op}`),
                    }))}
                    translateOptions={false}
                    onChange={(op) => {
                      const next = op as ViewComparison;
                      const { value: _value, ...rest } = follow;
                      write(
                        follow.prop,
                        NO_VALUE.has(next)
                          ? { ...rest, op: next }
                          : {
                              ...rest,
                              op: next,
                              value:
                                follow.value ?? (kind === "number" ? 0 : ""),
                            },
                      );
                    }}
                  />
                </div>
              )}
              {isWhen && !NO_VALUE.has(follow.op) && (
                <PropertyInput
                  label={t("dataView.follow_value")}
                  value={follow.value === undefined ? "" : String(follow.value)}
                  onChange={(text) =>
                    write(follow.prop, {
                      ...follow,
                      value:
                        kind === "number" &&
                        text.trim() !== "" &&
                        Number.isFinite(Number(text))
                          ? Number(text)
                          : kind === "boolean"
                            ? text === "true"
                            : text,
                    })
                  }
                />
              )}
            </div>
          </div>
        );
      })}
    </PropertySection>
  );
});
