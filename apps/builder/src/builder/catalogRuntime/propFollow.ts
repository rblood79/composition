/**
 * ADR-284 Phase 6 — 「변수로 정하기」: a prop of the selected node that reads a variable instead of a
 * fixed value (the acceptance set's ios-list — `selectionMode={selectionMode}`,
 * `isDisabled={selectedKeys !== 'all' && selectedKeys.size === 0}`).
 *
 * - a boolean prop holds a value condition (`PropWhen` — the view comparisons over one variable),
 * - a text prop holds the variable as a whole template (`{{ name }}` — ADR-214, as written in a
 *   text field), so the prop is the variable's value,
 * - a key list prop (`selectedKeys` · `expandedKeys` …) holds the variable (`PropVar` — the photos
 *   sidebar's `selectedKeys={[album]}`: RAC's selection follows the variable).
 *
 * Read back from the document: the follows are the node's props in those two shapes. Writing is
 * `setFields` (one step, one Undo); removing a follow returns the prop to its default.
 */
import { setFields } from "../../../../../packages/shared/src/catalog/commands/fields";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  NodeId,
  PropVar,
  PropWhen,
  StateVariableEntry,
  ViewComparison,
  ViewConditionValue,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  isPropVar,
  isPropWhen,
} from "../../../../../packages/shared/src/catalog/document/valueType";
import { catalogVisibleVariableEntries } from "./stateVariables";

export type CatalogPropFollow =
  | {
      readonly prop: string;
      readonly kind: "when";
      readonly variableId: string;
      /** The variable's path (`size` — a selection's count). */
      readonly path: string;
      readonly op: ViewComparison;
      readonly value?: ViewConditionValue;
    }
  | {
      readonly prop: string;
      readonly kind: "variable";
      readonly variableId: string;
    };

const WHOLE_TEMPLATE = /^\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}$/;

type Reader = Pick<
  CatalogGraph,
  "getEntry" | "getDefinition" | "referrersOf" | "ownerOf"
>;

function nodeOf(graph: Reader, nodeId: NodeId) {
  const entry = graph.getEntry(nodeId);
  return entry?.kind === "node" ? entry : undefined;
}

/** The variables the node sees (its own, its ancestors', its page's — nearest first). */
export function catalogPropFollowVariables(
  graph: Reader,
  nodeId: NodeId,
): StateVariableEntry[] {
  return catalogVisibleVariableEntries(graph as never, nodeId);
}

/** A follow's prop kind: a value condition · a text template · a key list (`PropVar`). */
export type CatalogPropFollowType = "boolean" | "string" | "keys";
const KEY_LIST = /Keys$/;

/** The props a follow may take: the node's accepted boolean, text and key list props. */
export function catalogPropFollowProps(
  graph: Reader,
  nodeId: NodeId,
): { prop: string; type: CatalogPropFollowType }[] {
  const node = nodeOf(graph, nodeId);
  const accepts =
    (node &&
      (
        graph.getDefinition(node.definitionId) as
          { accepts?: Readonly<Record<string, string>> } | undefined
      )?.accepts) ??
    {};
  // (Booleans first — `isDisabled` leads: the state a value condition is for; text props after.)
  const rank = (entry: { prop: string; type: string }) =>
    entry.prop === "isDisabled" ? 0 : entry.type === "boolean" ? 1 : 2;
  return Object.entries(accepts)
    .flatMap(([prop, type]): { prop: string; type: CatalogPropFollowType }[] =>
      type === "boolean" || type === "string"
        ? [{ prop, type }]
        : type === "string[]" && KEY_LIST.test(prop)
          ? [{ prop, type: "keys" }]
          : [],
    )
    .sort((a, b) => rank(a) - rank(b) || a.prop.localeCompare(b.prop));
}

/** The node's props that follow a variable, as stored. */
export function catalogPropFollows(
  graph: Reader,
  nodeId: NodeId,
): CatalogPropFollow[] {
  const node = nodeOf(graph, nodeId);
  if (!node) return [];
  const variables = catalogPropFollowVariables(graph, nodeId);
  const out: CatalogPropFollow[] = [];
  for (const [prop, write] of Object.entries(node.props)) {
    if (write.kind !== "set") continue;
    const value = write.value;
    if (isPropWhen(value)) {
      const [variableId = "", ...path] = value.subject
        .slice("!var.".length)
        .split(".");
      out.push({
        prop,
        kind: "when",
        variableId,
        path: path.join("."),
        op: value.op,
        ...(value.value !== undefined ? { value: value.value } : {}),
      });
      continue;
    }
    const name =
      typeof value === "string" ? WHOLE_TEMPLATE.exec(value)?.[1] : undefined;
    const variable = name
      ? variables.find((entry) => entry.name === name)
      : undefined;
    if (variable) out.push({ prop, kind: "variable", variableId: variable.id });
  }
  return out;
}

/** The stored value of a follow: a value condition, or the variable's whole template. */
export function catalogPropFollowValue(
  graph: Reader,
  nodeId: NodeId,
  follow: CatalogPropFollow,
): PropWhen | PropVar | string | undefined {
  if (follow.kind === "when")
    return {
      kind: "when",
      subject: [
        `!var.${follow.variableId}`,
        ...(follow.path ? [follow.path] : []),
      ].join("."),
      op: follow.op,
      ...(follow.value !== undefined ? { value: follow.value } : {}),
    };
  // (A key list prop reads the variable itself; a text prop its template.)
  if (KEY_LIST.test(follow.prop))
    return { kind: "var", ref: `!var.${follow.variableId}` };
  const variable = catalogPropFollowVariables(graph, nodeId).find(
    (entry) => entry.id === follow.variableId,
  );
  return variable ? `{{ ${variable.name} }}` : undefined;
}

/**
 * Write (or with `follow` undefined, remove) the prop's follow — one step. A follow moved to
 * another prop (`follow.prop` ≠ `prop`) leaves `prop` in the same step.
 */
export function catalogPropFollowCommand(
  graph: Reader,
  nodeId: NodeId,
  prop: string,
  follow: CatalogPropFollow | undefined,
): CatalogCommand {
  const value = follow
    ? catalogPropFollowValue(graph, nodeId, follow)
    : undefined;
  const target = follow?.prop ?? prop;
  return setFields({
    targets: [{ kind: "node", id: nodeId }],
    props: {
      ...(target !== prop ? { [prop]: { kind: "remove" as const } } : {}),
      [target]:
        value === undefined ? { kind: "remove" } : { kind: "set", value },
    },
    label: follow ? "Set by variable" : "Remove variable",
  });
}
