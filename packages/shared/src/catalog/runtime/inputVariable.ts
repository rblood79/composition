import { isInputVariable } from "../document/componentEvents";
import type { CatalogGraph } from "../document/graph";
import type { DefinitionId, EntryId } from "../document/types";
import { parseRuleValueRef } from "../../interactions/valueRef";
import {
  componentBoundariesOf,
  type CatalogComponentBoundary,
} from "./componentBoundaries";
import type { CatalogConsumerNode } from "./compositionRoot";
import {
  catalogRecordVariables,
  type CatalogStateSource,
} from "./stateTemplate";

/**
 * ADR-294 Decision 7 — a component's input variable (a `variable` property's — owned by the
 * template root) has no value of its own: it is the value the instance that holds the origin passes
 * (`role="admin"` · `role={roleFilter}`), else its default. One function reads it for every reader
 * — the `{{ }}` · prop environment (a record's boundaries), a view's `!var` (the bound node's
 * instance path) and a rule's `!var` (the runtime state's `derive`).
 *
 * `boundaries` are the instances the reader sits in, innermost first (`componentBoundariesOf` of a
 * record, or `instancePathBoundaries` of a resolution path). A reference the instance passes is read
 * where the instance stands: another input variable (a wrapper passing its own input on) is read at
 * the instance's own boundaries — the ones after it — and a page · project · element variable by
 * `readOther` (the runtime value in the Preview, the default on the Canvas).
 */
export function resolveInputVariable(
  graph: Pick<CatalogGraph, "getEntry" | "ownerOf">,
  variableId: string,
  boundaries: readonly Pick<
    CatalogComponentBoundary,
    "instanceId" | "definitionId" | "recordId"
  >[],
  readOther: (
    variableId: string,
    boundary: Pick<CatalogComponentBoundary, "instanceId" | "recordId">,
  ) => { value: unknown } | undefined,
  depth = 0,
): { value: unknown } | undefined {
  const variable = graph.getEntry(variableId as never);
  if (!isInputVariable(variable)) return undefined;
  const fallback = { value: inputDefault(variable) };
  const definitionId = graph.ownerOf(variable.ownerId);
  const at = boundaries.findIndex((item) => item.definitionId === definitionId);
  // (No instance holds the origin here — the origin drawn by itself: its default.)
  if (at < 0 || depth > 16) return fallback;
  const boundary = boundaries[at]!;
  const instance = graph.getEntry(boundary.instanceId as never);
  const write =
    instance?.kind === "node"
      ? instance.props[variable.input.propertyKey]
      : undefined;
  if (write?.kind !== "set") return fallback;
  const ref = parseRuleValueRef(write.value);
  if (!ref) return { value: write.value };
  if (ref.from !== "var" || ref.path.length) return fallback;
  const source = graph.getEntry(ref.variableId as never);
  if (isInputVariable(source))
    return (
      resolveInputVariable(
        graph,
        ref.variableId,
        boundaries.slice(at + 1),
        readOther,
        depth + 1,
      ) ?? fallback
    );
  return readOther(ref.variableId, boundary) ?? fallback;
}

function inputDefault(variable: {
  valueType: string;
  defaultValue: unknown;
}): unknown {
  return (variable.valueType === "object" || variable.valueType === "array") &&
    variable.defaultValue === ""
    ? null
    : variable.defaultValue;
}

/**
 * The record-side reader: a record's boundaries, and a referenced variable read as the instance's
 * record chain sees it (its scope there — an element variable under the record that draws its owner).
 */
export function resolveInputVariableAt(
  graph: CatalogGraph,
  variableId: string,
  recordId: string,
  records: { get(id: string): CatalogConsumerNode | undefined },
  pageId: EntryId<"page"> | undefined,
  source: CatalogStateSource | undefined,
): { value: unknown } | undefined {
  return resolveInputVariable(
    graph,
    variableId,
    componentBoundariesOf(graph, records, recordId),
    (otherId, boundary) => {
      const record = boundary.recordId
        ? records.get(boundary.recordId)
        : undefined;
      if (!record) return undefined;
      const entry = catalogRecordVariables(
        graph,
        record,
        (id) => records.get(id),
        pageId,
        source?.projectVariables() ?? [],
      ).find((item) => item.id === otherId);
      if (!entry) return undefined;
      return {
        value:
          source?.read?.(entry.id, entry.scope) ??
          (entry.defaultValue as unknown),
      };
    },
  );
}

/**
 * The resolution-side boundaries: the project component instances on a node's instance path,
 * innermost first (a bound node inside an origin — its view reads the instance's input).
 */
export function instancePathBoundaries(
  graph: Pick<CatalogGraph, "getEntry" | "getDefinition">,
  instancePath: readonly string[],
): Pick<
  CatalogComponentBoundary,
  "instanceId" | "definitionId" | "recordId"
>[] {
  const out: Pick<
    CatalogComponentBoundary,
    "instanceId" | "definitionId" | "recordId"
  >[] = [];
  for (let index = instancePath.length - 1; index >= 0; index -= 1) {
    const id = instancePath[index]!;
    if (!id.startsWith("project:node:")) continue;
    const entry = graph.getEntry(id as never);
    if (entry?.kind !== "node" || !entry.definitionId.startsWith("project:"))
      continue;
    if (
      graph.getDefinition(entry.definitionId as DefinitionId)?.mode !==
      "composite"
    )
      continue;
    out.push({
      instanceId: id,
      definitionId: entry.definitionId as DefinitionId,
      recordId: "",
    });
  }
  return out;
}

/**
 * ADR-294 — which input variables follow which variables: every instance's variable property that
 * references a variable (`"!var.<id>"`). A change of a variable (by name or id, as the refresh
 * compares) reaches the input variables that follow it, and theirs (a wrapper passing it on).
 */
export function inputVariableDependencies(
  graph: CatalogGraph,
): ReadonlyMap<string, ReadonlySet<string>> {
  const out = new Map<string, Set<string>>();
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return out;
  const add = (from: string, to: string) => {
    const set = out.get(from) ?? new Set<string>();
    set.add(to);
    out.set(from, set);
  };
  for (const variableId of project.stateVariableIds) {
    const input = graph.getEntry(variableId);
    if (!isInputVariable(input)) continue;
    const definitionId = graph.ownerOf(input.ownerId);
    if (!definitionId) continue;
    for (const instanceId of graph.instancesOf(definitionId as never)) {
      const instance = graph.getEntry(instanceId);
      const write =
        instance?.kind === "node"
          ? instance.props[input.input.propertyKey]
          : undefined;
      const ref =
        write?.kind === "set" ? parseRuleValueRef(write.value) : undefined;
      if (ref?.from !== "var") continue;
      const source = graph.getEntry(ref.variableId as never);
      const name =
        source?.kind === "stateVariable" || source?.kind === "projectVariable"
          ? source.name
          : undefined;
      for (const key of [ref.variableId, name])
        if (key) {
          add(key, input.id);
          add(key, input.name);
        }
    }
  }
  return out;
}

/** The names · ids a change reaches, closed over the input variables that follow them. */
export function closeOverInputs(
  names: ReadonlySet<string>,
  dependencies: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlySet<string> {
  if (!dependencies.size) return names;
  const out = new Set(names);
  const queue = [...names];
  while (queue.length) {
    const name = queue.pop()!;
    for (const next of dependencies.get(name) ?? [])
      if (!out.has(next)) {
        out.add(next);
        queue.push(next);
      }
  }
  return out;
}
