/**
 * ADR-288 — where a document reads a variable by name (`{{ name }}`), judged per field with that
 * field's runtime resolution, so a rename rewrites exactly the places the runtime would have read
 * the renamed variable, and a usage count counts the same places:
 *
 * - `prop` — a node's string props (and an instance's patch props at a template position):
 *   the record chain — the node, its ancestors, its page, then the project (`catalogRecordVariables`).
 *   A template node (a component's origin) sees its template ancestors, then the project.
 * - `bindingKey` — a node's `binding.key`: its page's variables, then the project's
 *   (`catalogBindingKey` → `pageAndProjectStates`).
 * - `endpoint` — an endpoint's URL · query · header · body templates: the project's variables only
 *   (the Preview's `endpointTemplateFor` resolves them with no owner).
 *
 * `\{{` literals and the reserved `env` root are never references; `params` is one only where a
 * variable of that name is visible (else the route params answer — not a variable).
 */
import { collectStateTemplateRefs } from "../../state/stateDependencies";
import { rewriteStateTemplateRoots } from "../../state/template";
import type {
  CatalogEntry,
  CatalogReader,
  DescendantOverride,
  EndpointEntry,
  InstanceAddress,
  NodeEntry,
  ProjectEntry,
  ProjectVariableEntry,
  StateVariableEntry,
} from "../document/types";

export type VariableReferenceField = "prop" | "bindingKey" | "endpoint";

/** One string in the document that reads variables by name. */
export interface VariableReferenceSite {
  /** The node or endpoint entry holding the string. */
  entryId: string;
  field: VariableReferenceField;
  /** Where the string is inside the entry (object keys · array indexes). */
  path: readonly (string | number)[];
  text: string;
  /** The root names in `text` that resolve to the variable asked for (nearest wins). */
  names: readonly string[];
}

export type VariableReferenceReader = Pick<
  CatalogReader,
  "projectId" | "getEntry" | "ownerOf" | "referrersOf"
>;

/**
 * The project variables to resolve against instead of the document's entries — a caller that
 * holds the data store's projection (`{ id, name }`, raw ids) passes it; ids are normalized to the
 * entry form (`data:variable:<id>`).
 */
export interface VariableReferenceOptions {
  projectVariables?: readonly { id: string; name: string }[];
}

const PROJECT_VARIABLE = "data:variable:";
const projectVariableEntryId = (id: string) =>
  id.startsWith(PROJECT_VARIABLE) ? id : `${PROJECT_VARIABLE}${id}`;

interface VisibleVariable {
  id: string;
  name: string;
}

interface RawSite {
  entryId: string;
  field: VariableReferenceField;
  path: readonly (string | number)[];
  text: string;
  visible: () => readonly VisibleVariable[];
}

const MAX_DEPTH = 6;

function project(reader: VariableReferenceReader): ProjectEntry | undefined {
  const entry = reader.getEntry(reader.projectId);
  return entry?.kind === "project" ? entry : undefined;
}

/** The project's variables (document entries — ADR-286), in list order. */
export function projectVariableEntries(
  reader: VariableReferenceReader,
): ProjectVariableEntry[] {
  const out: ProjectVariableEntry[] = [];
  for (const id of project(reader)?.projectVariableIds ?? []) {
    const entry = reader.getEntry(id);
    if (entry?.kind === "projectVariable") out.push(entry);
  }
  return out;
}

/** The state variables an owner (node or page) holds. */
export function ownedStateVariables(
  reader: VariableReferenceReader,
  ownerId: string,
): StateVariableEntry[] {
  const out: StateVariableEntry[] = [];
  for (const id of reader.referrersOf(ownerId)) {
    const entry = reader.getEntry(id);
    if (entry?.kind === "stateVariable" && entry.ownerId === ownerId)
      out.push(entry);
  }
  return out;
}

/**
 * The owner itself, then its node ancestors up to and including its page (a template node's chain
 * stops at its definition). The visibility chain — nearest first.
 */
export function ownerChain(
  reader: VariableReferenceReader,
  ownerId: string,
): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  for (
    let id: string | undefined = ownerId;
    id && !seen.has(id);
    id = reader.ownerOf(id)
  ) {
    seen.add(id);
    const entry = reader.getEntry(id);
    if (entry?.kind !== "node" && entry?.kind !== "page") break;
    chain.push(id);
    if (entry.kind === "page") break;
  }
  return chain;
}

function pageOf(
  reader: VariableReferenceReader,
  id: string,
): string | undefined {
  const chain = ownerChain(reader, id);
  const last = chain.at(-1);
  return last && reader.getEntry(last)?.kind === "page" ? last : undefined;
}

function projectVisible(
  reader: VariableReferenceReader,
  options: VariableReferenceOptions,
): VisibleVariable[] {
  if (options.projectVariables)
    return options.projectVariables.map((variable) => ({
      id: projectVariableEntryId(variable.id),
      name: variable.name,
    }));
  return projectVariableEntries(reader).map((variable) => ({
    id: variable.id,
    name: variable.name,
  }));
}

function visibleOf(
  reader: VariableReferenceReader,
  ownerIds: readonly string[],
  options: VariableReferenceOptions,
): VisibleVariable[] {
  const out: VisibleVariable[] = [];
  for (const ownerId of ownerIds)
    for (const variable of ownedStateVariables(reader, ownerId))
      out.push({ id: variable.id, name: variable.name });
  out.push(...projectVisible(reader, options));
  return out;
}

/** What a node's own props see: its chain, then the project. */
function propVisible(
  reader: VariableReferenceReader,
  nodeId: string,
  options: VariableReferenceOptions,
) {
  return visibleOf(reader, ownerChain(reader, nodeId), options);
}

/**
 * What an instance's patch at a template position sees: the addressed template node and its
 * template ancestors, each nested template instance's, then the authored instance's chain.
 */
function patchVisible(
  reader: VariableReferenceReader,
  instanceId: string,
  address: InstanceAddress,
  options: VariableReferenceOptions,
) {
  const ids: string[] = [];
  const target = address.templatePath.at(-1);
  if (target) ids.push(...ownerChain(reader, target));
  for (const nested of [...address.instances.slice(1)].reverse())
    ids.push(...ownerChain(reader, nested));
  ids.push(...ownerChain(reader, instanceId));
  return visibleOf(reader, ids, options);
}

/** What a `binding.key` sees: the node's page, then the project. */
function keyVisible(
  reader: VariableReferenceReader,
  nodeId: string,
  options: VariableReferenceOptions,
) {
  const page = pageOf(reader, nodeId);
  return visibleOf(reader, page ? [page] : [], options);
}

/** The variable a name resolves to in a visible list (nearest first); none = not a variable here. */
export function resolveVisibleName(
  visible: readonly VisibleVariable[],
  name: string,
): string | undefined {
  return visible.find((entry) => entry.name === name)?.id;
}

/** Every string leaf in a value (depth ≤ 6 — the resolver's reach), with its path. */
function stringLeaves(
  value: unknown,
  path: readonly (string | number)[],
  depth: number,
  out: { path: (string | number)[]; text: string }[],
): void {
  if (typeof value === "string") {
    if (value.includes("{{")) out.push({ path: [...path], text: value });
    return;
  }
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      stringLeaves(item, [...path, index], depth + 1, out),
    );
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>))
    stringLeaves(item, [...path, key], depth + 1, out);
}

function propSites(
  node: NodeEntry,
  visible: () => readonly VisibleVariable[],
  out: RawSite[],
): void {
  const leaves: { path: (string | number)[]; text: string }[] = [];
  for (const [key, write] of Object.entries(node.props))
    if (write.kind === "set")
      stringLeaves(write.value, ["props", key, "value"], 0, leaves);
  for (const leaf of leaves)
    out.push({ entryId: node.id, field: "prop", ...leaf, visible });
}

function patchSites(
  reader: VariableReferenceReader,
  node: NodeEntry,
  options: VariableReferenceOptions,
  out: RawSite[],
): void {
  node.descendantOverrides.forEach((override: DescendantOverride, index) => {
    if (override.kind === "replace" || !override.props) return;
    const leaves: { path: (string | number)[]; text: string }[] = [];
    for (const [key, write] of Object.entries(override.props))
      if (write.kind === "set")
        stringLeaves(
          write.value,
          ["descendantOverrides", index, "props", key, "value"],
          0,
          leaves,
        );
    if (!leaves.length) return;
    let cached: readonly VisibleVariable[] | undefined;
    const visible = () =>
      (cached ??= patchVisible(reader, node.id, override.address, options));
    for (const leaf of leaves)
      out.push({ entryId: node.id, field: "prop", ...leaf, visible });
  });
}

const ENDPOINT_TEXT_FIELDS = ["baseUrl", "path", "bodyTemplate"] as const;

function endpointSites(
  endpoint: EndpointEntry,
  visible: () => readonly VisibleVariable[],
  out: RawSite[],
): void {
  const push = (path: (string | number)[], text: unknown) => {
    if (typeof text === "string" && text.includes("{{"))
      out.push({
        entryId: endpoint.id,
        field: "endpoint",
        path,
        text,
        visible,
      });
  };
  for (const field of ENDPOINT_TEXT_FIELDS) push([field], endpoint[field]);
  endpoint.headers.forEach((header, index) =>
    push(["headers", index, "value"], header.value),
  );
  endpoint.queryParams.forEach((param, index) =>
    push(["queryParams", index, "value"], param.value),
  );
}

/**
 * Every node that can hold a template: the pages' trees (owned children and slot fills — the
 * Components pages too), and each project definition's template tree.
 */
function everyNode(reader: VariableReferenceReader): NodeEntry[] {
  const out: NodeEntry[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = reader.getEntry(id);
    if (node?.kind !== "node") return;
    out.push(node);
    node.children.forEach(visit);
    for (const item of node.descendantOverrides)
      if (item.kind === "fillSlot") item.childIds.forEach(visit);
      else if (item.kind === "replace") visit(item.replacementId);
  };
  const entry = project(reader);
  if (!entry) return out;
  for (const pageId of [...entry.pageIds, ...(entry.componentPageIds ?? [])]) {
    const page = reader.getEntry(pageId);
    if (page?.kind === "page") page.children.forEach(visit);
  }
  for (const definitionId of entry.definitionIds) {
    const definition = reader.getEntry(definitionId);
    if (definition?.kind === "definition" && definition.templateRootId)
      visit(definition.templateRootId);
  }
  return out;
}

function rawSites(
  reader: VariableReferenceReader,
  options: VariableReferenceOptions,
): RawSite[] {
  const out: RawSite[] = [];
  for (const node of everyNode(reader)) {
    let cached: readonly VisibleVariable[] | undefined;
    const visible = () => (cached ??= propVisible(reader, node.id, options));
    propSites(node, visible, out);
    patchSites(reader, node, options, out);
    const key = node.binding?.key;
    if (key !== undefined && key.includes("{{")) {
      let keyCached: readonly VisibleVariable[] | undefined;
      out.push({
        entryId: node.id,
        field: "bindingKey",
        path: ["binding", "key"],
        text: key,
        visible: () => (keyCached ??= keyVisible(reader, node.id, options)),
      });
    }
  }
  const endpoints: EndpointEntry[] = [];
  for (const id of project(reader)?.endpointIds ?? []) {
    const entry = reader.getEntry(id);
    if (entry?.kind === "endpoint") endpoints.push(entry);
  }
  if (endpoints.length) {
    let cached: readonly VisibleVariable[] | undefined;
    const visible = () => (cached ??= visibleOf(reader, [], options));
    for (const endpoint of endpoints) endpointSites(endpoint, visible, out);
  }
  return out;
}

/** The places whose `{{ }}` the runtime resolves to this variable (a state or project variable). */
export function variableReferenceSites(
  reader: VariableReferenceReader,
  variableId: string,
  options: VariableReferenceOptions = {},
): VariableReferenceSite[] {
  const out: VariableReferenceSite[] = [];
  for (const site of rawSites(reader, options)) {
    const roots = collectStateTemplateRefs(site.text);
    if (!roots.length) continue;
    const visible = site.visible();
    const names = roots.filter(
      (name) => resolveVisibleName(visible, name) === variableId,
    );
    if (names.length) {
      const { visible: _visible, ...rest } = site;
      out.push({ ...rest, names });
    }
  }
  return out;
}

/** How many places read the variable by name — the same judgment as the rewrite. */
export function variableReferenceCount(
  reader: VariableReferenceReader,
  variableId: string,
  options: VariableReferenceOptions = {},
): number {
  return variableReferenceSites(reader, variableId, options).length;
}

/**
 * The places where `{{ newName }}` would start reading this variable after a rename although it
 * reads another variable (or the route params · nothing) now — the rename must not capture them.
 */
export function variableRenameCaptures(
  reader: VariableReferenceReader,
  variableId: string,
  newName: string,
  options: VariableReferenceOptions = {},
): VariableReferenceSite[] {
  const out: VariableReferenceSite[] = [];
  for (const site of rawSites(reader, options)) {
    if (!collectStateTemplateRefs(site.text).includes(newName)) continue;
    const visible = site.visible();
    const before = resolveVisibleName(visible, newName);
    const after = resolveVisibleName(
      visible.map((entry) =>
        entry.id === variableId ? { ...entry, name: newName } : entry,
      ),
      newName,
    );
    if (after === variableId && before !== variableId) {
      const { visible: _visible, ...rest } = site;
      out.push({ ...rest, names: [newName] });
    }
  }
  return out;
}

/**
 * A variable whose name `name` would collide with: for a state variable, one on its owner's chain
 * (an ancestor, the owner or a descendant — ADR-214 HC5) or any project variable (the end of every
 * chain); for a project variable, any state variable or another project variable.
 */
export function variableNameTaken(
  reader: VariableReferenceReader,
  variable:
    | { kind: "stateVariable"; ownerId: string; id?: string }
    | { kind: "projectVariable"; id?: string },
  name: string,
): StateVariableEntry | ProjectVariableEntry | undefined {
  const target = name.trim();
  if (!target) return undefined;
  const entry = project(reader);
  if (!entry) return undefined;
  const chain =
    variable.kind === "stateVariable"
      ? new Set(ownerChain(reader, variable.ownerId))
      : undefined;
  for (const id of entry.stateVariableIds) {
    if (id === variable.id) continue;
    const candidate = reader.getEntry(id);
    if (candidate?.kind !== "stateVariable" || candidate.name.trim() !== target)
      continue;
    if (
      !chain ||
      chain.has(candidate.ownerId) ||
      ownerChain(reader, candidate.ownerId).includes(
        (variable as { ownerId: string }).ownerId,
      )
    )
      return candidate;
  }
  for (const candidate of projectVariableEntries(reader))
    if (candidate.id !== variable.id && candidate.name.trim() === target)
      return candidate;
  return undefined;
}

function withAt<T>(
  value: T,
  path: readonly (string | number)[],
  update: (leaf: unknown) => unknown,
): T {
  if (!path.length) return update(value) as T;
  const [head, ...rest] = path;
  if (Array.isArray(value)) {
    const next = [...value];
    next[head as number] = withAt(next[head as number], rest, update);
    return next as T;
  }
  const record = value as Record<string, unknown>;
  return {
    ...record,
    [head as string]: withAt(record[head as string], rest, update),
  } as T;
}

/** The entry with the sites' names rewritten to `newName` — the same object when none applies. */
export function rewriteVariableReferences<T extends CatalogEntry>(
  entry: T,
  sites: readonly VariableReferenceSite[],
  newName: string,
): T {
  let next = entry;
  for (const site of sites) {
    if (site.entryId !== entry.id) continue;
    const names = new Set(site.names);
    next = withAt(next, site.path, (leaf) =>
      typeof leaf === "string"
        ? rewriteStateTemplateRoots(leaf, (root) =>
            names.has(root) ? newName : undefined,
          )
        : leaf,
    );
  }
  return next;
}
