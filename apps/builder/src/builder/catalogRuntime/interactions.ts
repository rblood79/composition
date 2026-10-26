import {
  isCapabilityTarget,
  parseRuleValueRef,
  type ExposureInput,
} from "@composition/shared";
import { setNodeInteractions } from "../../../../../packages/shared/src/catalog/commands";
import {
  catalogInteractionOverridesAt,
  effectiveInteractionsOf,
  type CatalogInteractionStatus,
} from "../../../../../packages/shared/src/catalog/resolution/effectiveInteractions";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  definitionTypeName,
  sameAddress,
} from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogNodeRef,
  DescendantOverride,
  EditTarget,
  EntryId,
  InstanceAddress,
  InteractionEntry,
  NodeId,
  Scalar,
  DataCollectionId,
  DataEndpointId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  catalogPropBaseValue,
  catalogTargetDefinitionId,
} from "./editContract";
import { readPropSource } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import { ownedChildren } from "../../../../../packages/shared/src/catalog/document/graph";
import {
  catalogTemplateDefinitionOf,
  catalogTemplatePathOf,
} from "./targetRef";
import {
  catalogEmptyVariableValue,
  catalogVisibleVariableEntries,
  type CatalogVariableReader,
  type CatalogVariableType,
} from "./stateVariables";

/**
 * ADR-248 Phase 4e-4e: the Interactions panel over the catalog document. A rule is an interaction
 * record owned by the selected node (an instance descendant: its instance node at the address);
 * the panel writes the owner's list as a whole (`setNodeInteractions`, one step). The document
 * holds only complete rules — a Do choice starts from a valid action (the first page, variable or
 * target), and a choice with nothing to point at is not offered.
 */

export type CatalogInteractionAction = InteractionEntry["actions"][number];
export type CatalogActionChoice = CatalogInteractionAction["opcode"];

export interface CatalogInteractionOwner {
  ownerId: NodeId;
  address?: InstanceAddress;
}

export const catalogInteractionOwner = (
  target: EditTarget,
): CatalogInteractionOwner =>
  target.kind === "node"
    ? { ownerId: target.id }
    : { ownerId: target.ownerId, address: target.address };

const sameOwnerAddress = (
  a: InstanceAddress | undefined,
  b: InstanceAddress | undefined,
) => a === b || (!!a && !!b && sameAddress(a, b));

/** The component type the registry keys triggers and capabilities by (`Button`, `Tabs`, …). */
export function catalogTargetTypeName(
  graph: CatalogVariableReader,
  target: EditTarget,
): string {
  try {
    return definitionTypeName(graph, catalogTargetDefinitionId(graph, target));
  } catch {
    return "";
  }
}

/** The props RAC stops a change by (ADR-281 Decision 1 — the panel judges What RAC accepts by them). */
const EXPOSURE_PROPS = [
  "isDisabled",
  "isReadOnly",
  "isPending",
  "selectionMode",
] as const;

/**
 * ADR-281 Decision 1: what the Interactions panel judges a node's When · Do choices by — its
 * declared value of each restricting prop (else what it shows without one: the inherited value or
 * the contract default), as the Preview hands them to RAC.
 */
export function catalogExposureInput(
  graph: Parameters<typeof catalogPropBaseValue>[0],
  target: EditTarget,
): ExposureInput {
  const props: Record<string, unknown> = {};
  try {
    for (const key of EXPOSURE_PROPS) {
      const value =
        readPropSource(graph, target, key).value ??
        catalogPropBaseValue(graph, target, key);
      if (value !== undefined) props[key] = value;
    }
  } catch {
    // (A target the graph no longer holds — nothing restricts.)
  }
  return { props };
}

/** The owner's rules in project order. */
export function catalogInteractionsOf(
  graph: CatalogVariableReader,
  owner: CatalogInteractionOwner,
): InteractionEntry[] {
  const owned: InteractionEntry[] = [];
  for (const id of graph.referrersOf(owner.ownerId)) {
    const entry = graph.getEntry(id);
    if (
      entry?.kind === "interaction" &&
      entry.ownerId === owner.ownerId &&
      sameOwnerAddress(entry.address, owner.address)
    )
      owned.push(entry);
  }
  if (owned.length < 2) return owned;
  const project = graph.getEntry(graph.projectId);
  const order = new Map<string, number>(
    project?.kind === "project"
      ? project.interactionIds.map((id, index) => [id, index])
      : [],
  );
  return owned.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export interface CatalogPageOption {
  id: EntryId<"page">;
  name: string;
  route: string;
}

/** Navigate targets: the project's pages in order. */
export function catalogPageOptions(
  graph: CatalogVariableReader,
): CatalogPageOption[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  return project.pageIds.flatMap((id) => {
    const page = graph.getEntry(id);
    return page?.kind === "page"
      ? [{ id: page.id, name: page.name, route: page.route }]
      : [];
  });
}

export interface CatalogTargetOption {
  /** The option's identity: its stored reference as text. */
  key: string;
  /** What the rule stores (ADR-283 Decision 1). */
  ref: CatalogNodeRef;
  /** The document place (its type, restricting props · the Canvas highlight). */
  edit: EditTarget;
  type: string;
  name?: string;
  /** ADR-283 Decision 4: the instance chain's labels down to it (`OrderCard ▸ Save`); [] on the page. */
  path: string[];
  /** 「이 페이지」 (page nodes) · 「컴포넌트 안」 (positions inside an instance or the origin). */
  group: "page" | "component";
  /**
   * The author DOM id (Accessibility ID — the element's `id=""`) that tells it apart: a page node's
   * own; a place inside an instance has none of its own, so its instance's (the first path label).
   */
  htmlId?: string;
  /** The id's short tail — told apart when names repeat and there is no DOM id. */
  shortId: string;
  /** A page root (the page body): listed, but not a Do choice's starting target. */
  pageRoot?: true;
}

/** A page node's author DOM id (`metadata.htmlId`); none for a template node (`local`). */
const htmlIdOf = (graph: CatalogVariableReader, ref: CatalogNodeRef, id: string) => {
  if ("local" in ref) return undefined;
  const node = graph.getEntry(id);
  return node?.kind === "node" ? node.metadata?.htmlId || undefined : undefined;
};
const shortIdOf = (id: string) => {
  const tail = id.split(":").pop()!;
  return tail.slice(Math.max(0, tail.length - 4));
};
const sameEditTarget = (left: EditTarget, right: EditTarget) =>
  left.kind === "node"
    ? right.kind === "node" && left.id === right.id
    : right.kind === "descendant" &&
      left.ownerId === right.ownerId &&
      sameAddress(left.address, right.address);

/** A template position's node (a library template or a project template node). */
function templateNodeOf(
  graph: CatalogVariableReader,
  id: string,
):
  | { definitionId: string; children: readonly string[]; name?: string }
  | undefined {
  if (id.startsWith("lib:"))
    return graph.library.templates.get(id as `lib:template:${string}`) as
      | { definitionId: string; children: readonly string[]; name?: string }
      | undefined;
  const node = graph.getEntry(id);
  return node?.kind === "node"
    ? {
        definitionId: node.definitionId,
        children: ownedChildren(node),
        ...(node.name ? { name: node.name } : {}),
      }
    : undefined;
}

/** A composite definition's template root and name (a library or a project definition). */
function compositeOf(
  graph: CatalogVariableReader,
  definitionId: string,
): { rootId: string; name: string } | undefined {
  const definition = definitionId.startsWith("lib:")
    ? graph.library.definitions.get(definitionId as `lib:definition:${string}`)
    : graph.getEntry(definitionId);
  if (!definition || ("kind" in definition && definition.kind !== "definition"))
    return undefined;
  const { mode, templateRootId, name } = definition as {
    mode: string;
    templateRootId?: string;
    name: string;
  };
  return mode === "composite" && templateRootId
    ? { rootId: templateRootId, name }
    : undefined;
}

/**
 * ADR-283 Decision 4 — the places a rule of `owner` can target, depth first: on a page, its own
 * nodes (slot contents and replacements too — 「이 페이지」) and every position inside their instances
 * (`{ address }`, nested instances too, user decision 4 「전부」 — 「컴포넌트 안」); for a rule inside a
 * component's template (the Local page), that template's own places only (`{ local }` — a template
 * does not know the page). Only types with a capability; the owner itself is left out. Lazy: a
 * caller wanting the first stops the walk (`catalogFirstCapabilityTarget`).
 */
export function* catalogCapabilityTargetsOf(
  graph: CatalogVariableReader,
  pageId: EntryId<"page"> | undefined,
  excludeId?: NodeId,
  owner?: CatalogInteractionOwner,
): Generator<CatalogTargetOption> {
  const excluded: EditTarget | undefined = owner
    ? owner.address
      ? { kind: "descendant", ownerId: owner.ownerId, address: owner.address }
      : { kind: "node", id: owner.ownerId }
    : excludeId
      ? { kind: "node", id: excludeId }
      : undefined;
  const option = (
    ref: CatalogNodeRef,
    edit: EditTarget,
    path: string[],
    group: CatalogTargetOption["group"],
    name: string | undefined,
    pageRoot = false,
  ): CatalogTargetOption | undefined => {
    if (excluded && sameEditTarget(edit, excluded)) return undefined;
    const type = catalogTargetTypeName(graph, edit);
    if (!type || !isCapabilityTarget(type)) return undefined;
    // (A place inside an instance is told apart by its instance — the template id is shared.)
    const leaf =
      edit.kind === "node" ? edit.id : edit.address.instances[0]!;
    const htmlId = htmlIdOf(graph, ref, leaf);
    return {
      key: JSON.stringify(ref),
      ref,
      edit,
      type,
      ...(name ? { name } : {}),
      path,
      group,
      ...(htmlId ? { htmlId } : {}),
      shortId: shortIdOf(leaf),
      ...(pageRoot ? { pageRoot: true as const } : {}),
    };
  };
  /**
   * The positions under one template node of an instance chain: `instances` reach the definition,
   * `steps` the position; `toRef` stores the address as the rule keeps it.
   */
  function* visitTemplate(
    holder: NodeId,
    instances: readonly string[],
    steps: readonly string[],
    labels: string[],
    toRef: (address: InstanceAddress) => CatalogNodeRef,
    overrides: readonly DescendantOverride[],
  ): Generator<CatalogTargetOption> {
    const id = steps.at(-1)!;
    const template = templateNodeOf(graph, id);
    if (!template) return;
    const address = { instances, templatePath: steps } as InstanceAddress;
    const at = overrides.find((override) =>
      sameAddress(override.address, address),
    );
    // (A replaced position, a filled slot: the replacement · contents are page nodes — listed there.)
    if (at?.kind === "replace") return;
    const edit: EditTarget = { kind: "descendant", ownerId: holder, address };
    const name = template.name;
    // (A root stands for its instance — the instance's label already names it.)
    const here =
      steps.length > 1
        ? [...labels, name ?? catalogTargetTypeName(graph, edit)]
        : labels;
    // (A root is its instance's place: the page node, or the nested position above it.)
    if (steps.length > 1) {
      const found = option(toRef(address), edit, here, "component", name);
      if (found) yield found;
    }
    if (at?.kind === "fillSlot") return;
    const nested =
      steps.length > 1 ? compositeOf(graph, template.definitionId) : undefined;
    if (nested)
      yield* visitTemplate(
        holder,
        [...instances, id],
        [nested.rootId],
        here,
        toRef,
        overrides,
      );
    for (const child of template.children)
      yield* visitTemplate(
        holder,
        instances,
        [...steps, child],
        here,
        toRef,
        overrides,
      );
  }
  const ownerDefinition = owner
    ? catalogTemplateDefinitionOf(graph, owner.ownerId)
    : undefined;
  if (ownerDefinition) {
    // The origin's own places (`local`): its template from the root, nested instances too.
    const origin = compositeOf(graph, ownerDefinition);
    if (!origin) return;
    const toLocal = (address: InstanceAddress): CatalogNodeRef => ({
      local: {
        instances: address.instances,
        templatePath: address.templatePath,
      },
    });
    function* visitOrigin(
      id: NodeId,
      labels: string[],
    ): Generator<CatalogTargetOption> {
      const node = graph.getEntry(id);
      if (node?.kind !== "node") return;
      const path = catalogTemplatePathOf(graph, id);
      if (!path) return;
      const edit: EditTarget = { kind: "node", id };
      const here = [...labels, node.name ?? catalogTargetTypeName(graph, edit)];
      const found = option(
        { local: { instances: [], templatePath: path } },
        edit,
        here,
        "component",
        node.name,
      );
      if (found) yield found;
      const nested = compositeOf(graph, node.definitionId);
      if (nested && id !== origin!.rootId)
        yield* visitTemplate(
          id,
          [id],
          [nested.rootId],
          here,
          toLocal,
          node.descendantOverrides,
        );
      for (const child of ownedChildren(node)) yield* visitOrigin(child, here);
    }
    yield* visitOrigin(origin.rootId as NodeId, []);
    return;
  }
  const page = pageId ? graph.getEntry(pageId) : undefined;
  if (page?.kind !== "page") return;
  function* visit(id: NodeId, pageRoot: boolean): Generator<CatalogTargetOption> {
    const node = graph.getEntry(id);
    if (node?.kind !== "node") return;
    const found = option(
      { nodeId: id },
      { kind: "node", id },
      [],
      "page",
      node.name,
      pageRoot,
    );
    if (found) yield found;
    const composite = compositeOf(graph, node.definitionId);
    if (composite)
      yield* visitTemplate(
        id,
        [id],
        [composite.rootId],
        [node.name ?? composite.name],
        (address) => ({ address }),
        node.descendantOverrides,
      );
    for (const child of ownedChildren(node)) yield* visit(child, false);
  }
  for (const root of page.children) yield* visit(root, true);
}

/**
 * ADR-283 — the option a stored target stands for (a rule's current target, which the page list
 * may not hold: another page's node, a place of an origin): its document place, type and labels.
 */
export function catalogTargetOptionOf(
  graph: CatalogVariableReader,
  ref: CatalogNodeRef,
): CatalogTargetOption | undefined {
  const steps = "address" in ref ? ref.address : "local" in ref ? ref.local : undefined;
  const edit: EditTarget | undefined =
    "nodeId" in ref
      ? { kind: "node", id: ref.nodeId }
      : steps!.instances.length
        ? {
            kind: "descendant",
            ownerId: steps!.instances[0] as NodeId,
            address: steps as InstanceAddress,
          }
        : { kind: "node", id: steps!.templatePath.at(-1) as NodeId };
  const type = catalogTargetTypeName(graph, edit);
  if (!type) return undefined;
  const nameOf = (id: string) =>
    id.startsWith("lib:")
      ? (graph.library.templates.get(id as `lib:template:${string}`) as
          | { name?: string }
          | undefined)?.name
      : (() => {
          const node = graph.getEntry(id);
          return node?.kind === "node" ? node.name : undefined;
        })();
  const leaf = edit.kind === "node" ? edit.id : edit.address.templatePath.at(-1)!;
  const name = nameOf(leaf);
  const distinct = edit.kind === "node" ? edit.id : edit.address.instances[0]!;
  const htmlId = htmlIdOf(graph, ref, distinct);
  const path =
    "address" in ref
      ? [
          // (The list's label: the instance's name, else its component's.)
          nameOf(ref.address.instances[0]!) ??
            (() => {
              const instance = graph.getEntry(ref.address.instances[0]!);
              return instance?.kind === "node"
                ? compositeOf(graph, instance.definitionId)?.name
                : undefined;
            })() ??
            catalogTargetTypeName(graph, { kind: "node", id: ref.address.instances[0] as NodeId }),
          ...ref.address.templatePath.slice(1).map((id) => nameOf(id) ?? catalogTargetTypeName(graph, { kind: "descendant", ownerId: ref.address.instances[0] as NodeId, address: { instances: ref.address.instances, templatePath: ref.address.templatePath.slice(0, ref.address.templatePath.indexOf(id) + 1) } as InstanceAddress })),
        ]
      : "local" in ref
        ? ref.local.templatePath.map((id) => nameOf(id) ?? type)
        : [];
  return {
    key: JSON.stringify(ref),
    ref,
    edit,
    type,
    ...(name ? { name } : {}),
    path,
    group: "nodeId" in ref ? "page" : "component",
    ...(htmlId ? { htmlId } : {}),
    shortId: shortIdOf(distinct),
  };
}

/** Every capability target of `catalogCapabilityTargetsOf`. */
export const catalogCapabilityTargets = (
  ...args: Parameters<typeof catalogCapabilityTargetsOf>
): CatalogTargetOption[] => [...catalogCapabilityTargetsOf(...args)];

/** A new capability rule's starting target (a page node first). */
export function catalogFirstCapabilityTarget(
  ...args: Parameters<typeof catalogCapabilityTargetsOf>
): CatalogTargetOption | undefined {
  // (A page node first — not the page body, not a part of the owner's own instance; else the
  // first place inside a component, else the body.)
  let root: CatalogTargetOption | undefined;
  let inside: CatalogTargetOption | undefined;
  for (const option of catalogCapabilityTargetsOf(...args)) {
    if (option.pageRoot) root ??= option;
    else if (option.group === "page") return option;
    else inside ??= option;
  }
  return inside ?? root;
}

export interface CatalogVisibleVariable {
  /** A page/element variable id, or a project variable's reference (`data:variable:<id>`). */
  id: EntryId<"stateVariable"> | `data:variable:${string}`;
  name: string;
  type: CatalogVariableType;
  group: "project" | "page" | "element";
}

/**
 * The variables a setState rule on the owner can set: its own, then its ancestors' (nearest first),
 * then the project variables (the data store's scalar ones, H1). Named RAC states are left out.
 */
export function catalogVisibleVariables(
  graph: CatalogVariableReader,
  ownerId: NodeId,
  projectVariables: readonly { id: string; name: string; type: string }[] = [],
): CatalogVisibleVariable[] {
  return [
    // (A named RAC state follows its component and is read only — no rule sets it.)
    ...catalogVisibleVariableEntries(graph, ownerId)
      .filter((variable) => !variable.source)
      .map((variable) => ({
      id: variable.id,
      name: variable.name,
      type: variable.valueType as CatalogVariableType,
      group: (graph.getEntry(variable.ownerId)?.kind === "page"
        ? "page"
        : "element") as CatalogVisibleVariable["group"],
    })),
    ...projectVariables
      .filter((variable) =>
        ["string", "number", "boolean"].includes(variable.type),
      )
      .map((variable) => ({
        id: `data:variable:${variable.id}` as const,
        name: variable.name,
        type: variable.type as CatalogVariableType,
        group: "project" as const,
      })),
  ];
}

/** The ops a variable type takes (the first is the default). */
export function catalogStateOps(
  type: CatalogVariableType | undefined,
): ("set" | "toggle" | "increment" | "reset")[] {
  if (type === "boolean") return ["toggle", "set", "reset"];
  if (type === "number") return ["increment", "set", "reset"];
  return ["set", "reset"];
}

/** A setState action for the variable and op; `set` always carries a value of the variable's type. */
export function catalogSetStateAction(
  variable: CatalogVisibleVariable,
  op: "set" | "toggle" | "increment" | "reset",
  value?: Scalar,
): CatalogInteractionAction {
  const ops = catalogStateOps(variable.type);
  const next = ops.includes(op) ? op : ops[0]!;
  if (next === "set")
    return {
      opcode: "setState",
      variableId: variable.id,
      op: next,
      // (A reference — `!event` · `!item` · `!var` — keeps; the run reads it.)
      value:
        typeof value === variable.type || parseRuleValueRef(value)
          ? value
          : catalogEmptyVariableValue(variable.type),
    };
  if (next === "increment" && typeof value === "number")
    return { opcode: "setState", variableId: variable.id, op: next, value };
  return { opcode: "setState", variableId: variable.id, op: next };
}

export interface CatalogActionContext {
  pages: readonly CatalogPageOption[];
  currentPageId: EntryId<"page"> | undefined;
  variables: readonly CatalogVisibleVariable[];
  /** ADR-283 — the places a capability can target, read when asked (a picker opening). */
  targets: () => readonly CatalogTargetOption[];
  /** A new capability rule's starting target (`catalogFirstCapabilityTarget` — stops early). */
  firstTarget?: () => CatalogTargetOption | undefined;
  /** ADR-281 Decision 5 — the project's API endpoints (the data store's, H1). */
  endpoints?: readonly CatalogEndpointOption[];
  /** The project's collections a rule can append to (the data store's, H1). */
  collections?: readonly CatalogCollectionOption[];
  /**
   * The owner's bound collection — the fields a rule's value can read from the item its `keys`
   * name (「선택한 항목」 — `useListData.getItem`), and whether its selection is single.
   */
  ownerItems?: {
    fields: readonly { key: string; type: string }[];
    single: boolean;
  };
}

export interface CatalogCollectionOption {
  id: DataCollectionId;
  name: string;
  /** Its schema fields (an `update` of one field names it — ADR-284 Phase 5). */
  fields?: readonly { id: string; key: string }[];
}

export interface CatalogEndpointOption {
  id: DataEndpointId;
  name: string;
  method: string;
}

/** The action a Do choice starts from, or undefined when it has nothing to point at. */
/**
 * A list-data action (`append` · `update` · `remove`) starts from what its When gives: a Form's
 * `formData` as the value, a row's `key` (an action) or a selection's `keys` as the key.
 */
export function catalogListDataEventDefaults(
  action: CatalogInteractionAction,
  eventArgs: readonly string[],
): CatalogInteractionAction {
  const has = (name: string) => eventArgs.includes(name);
  if (action.opcode === "append")
    return has("formData") ? { ...action, value: "!event.formData" } : action;
  if (action.opcode === "update")
    return {
      ...action,
      ...(has("key")
        ? { key: "!event.key" }
        : has("keys") && has("dropOperation")
          ? { key: "!event.keys" }
          : {}),
      ...(has("formData") ? { value: "!event.formData" } : {}),
    };
  // (ADR-284 Phase 5 — a drop moves the dragged keys next to its target, on the side it chose.)
  if (
    (action.opcode === "moveBefore" || action.opcode === "moveAfter") &&
    has("target") &&
    has("keys")
  )
    return {
      ...action,
      key: "!event.target.key",
      keys: "!event.keys",
      dropPosition: "!event.target.dropPosition",
    };
  if (action.opcode === "remove")
    return has("key")
      ? { ...action, keys: "!event.key" }
      : has("keys")
        ? { ...action, keys: "!event.keys" }
        : action;
  return action;
}

export function catalogDefaultAction(
  choice: CatalogActionChoice,
  context: CatalogActionContext,
): CatalogInteractionAction | undefined {
  if (choice === "navigate") {
    const page =
      context.pages.find((option) => option.id !== context.currentPageId) ??
      context.pages[0];
    return page ? { opcode: "navigate", pageId: page.id } : undefined;
  }
  // (A toast's message is required — an empty one is no complete rule: the document refuses it.)
  if (choice === "toast") return { opcode: "toast", message: "Message" };
  if (choice === "setState") {
    const variable = context.variables[0];
    return variable
      ? catalogSetStateAction(variable, catalogStateOps(variable.type)[0]!)
      : undefined;
  }
  if (choice === "callEndpoint") {
    // (A body goes with a method that carries one — a GET endpoint is offered last.)
    const endpoint =
      context.endpoints?.find((option) => option.method !== "GET") ??
      context.endpoints?.[0];
    return endpoint
      ? { opcode: "callEndpoint", endpointId: endpoint.id }
      : undefined;
  }
  if (
    choice === "append" ||
    choice === "update" ||
    choice === "remove" ||
    choice === "reload" ||
    choice === "loadMore" ||
    choice === "setFilterText" ||
    choice === "insert" ||
    choice === "insertBefore" ||
    choice === "insertAfter" ||
    choice === "prepend" ||
    choice === "move" ||
    choice === "moveBefore" ||
    choice === "moveAfter" ||
    choice === "removeSelectedItems"
  ) {
    const collection = context.collections?.[0];
    return collection ? { opcode: choice, collectionId: collection.id } : undefined;
  }
  if (choice === "capability") {
    const targets = context.firstTarget ? undefined : context.targets();
    const target = context.firstTarget
      ? context.firstTarget()
      : (targets!.find((option) => !option.pageRoot) ?? targets![0]);
    return target
      ? { opcode: "capability", target: target.ref, capabilityId: "hide" }
      : undefined;
  }
  return undefined;
}

/** A new rule: one Do, or a Do list (ADR-284 Decision 8 — run in order). */
export function catalogNewInteraction(
  owner: CatalogInteractionOwner,
  trigger: string,
  action: CatalogInteractionAction | readonly CatalogInteractionAction[],
  newId: NewId,
): InteractionEntry {
  return {
    kind: "interaction",
    id: newId("interaction") as EntryId<"interaction">,
    ownerId: owner.ownerId,
    ...(owner.address ? { address: owner.address } : {}),
    trigger,
    actions: Array.isArray(action)
      ? [...(action as readonly CatalogInteractionAction[])]
      : [action as CatalogInteractionAction],
  };
}

export const catalogInteractionsCommand = (
  owner: CatalogInteractionOwner,
  entries: readonly InteractionEntry[],
  label: string,
): CatalogCommand =>
  setNodeInteractions({
    ownerId: owner.ownerId,
    ...(owner.address ? { address: owner.address } : {}),
    entries,
    label,
  });

/** ADR-281 Decision 4 — a component's rule as one instance position sees it. */
export interface CatalogInheritedInteraction {
  rule: InteractionEntry;
  status: CatalogInteractionStatus;
}

/**
 * The position an owner stands at in its component (the instance root: its template root; a
 * descendant: the end of its template path), or undefined for a node that is not a project
 * component's instance.
 */
function inheritedPosition(
  graph: CatalogVariableReader,
  owner: CatalogInteractionOwner,
): { sourceId: NodeId; address: InstanceAddress } | undefined {
  if (owner.address) {
    const sourceId = owner.address.templatePath.at(-1);
    return sourceId?.startsWith("project:node:")
      ? { sourceId: sourceId as NodeId, address: owner.address }
      : undefined;
  }
  const node = graph.getEntry(owner.ownerId);
  if (node?.kind !== "node") return undefined;
  const definition = graph.getEntry(node.definitionId as never);
  if (
    definition?.kind !== "definition" ||
    definition.mode !== "composite" ||
    !definition.templateRootId?.startsWith("project:node:")
  )
    return undefined;
  const sourceId = definition.templateRootId as NodeId;
  return {
    sourceId,
    address: { instances: [owner.ownerId], templatePath: [sourceId] },
  };
}

/**
 * ADR-281 Decision 4: the rules an instance position inherits from its component's template node,
 * each with what this instance does with it — the same `effectiveInteractionsOf` the Preview reads.
 */
export function catalogInheritedInteractionsOf(
  graph: CatalogVariableReader,
  owner: CatalogInteractionOwner,
): CatalogInheritedInteraction[] {
  const position = inheritedPosition(graph, owner);
  if (!position) return [];
  const get = (id: string) => graph.getEntry(id as never);
  return effectiveInteractionsOf(
    get,
    catalogInteractionsOf(graph, { ownerId: position.sourceId }),
    catalogInteractionOverridesAt(get, position.address),
  );
}

/** The `upsertDescendant` op writing an instance position's map (empty map = cleared). */
function overrideMapOp(
  address: InstanceAddress,
  map: Readonly<Record<string, "off" | EntryId<"interaction">>>,
) {
  const empty = !Object.keys(map).length;
  return {
    kind: "upsertDescendant" as const,
    id: address.instances[0] as NodeId,
    override: {
      kind: "patch" as const,
      address,
      ...(empty
        ? {}
        : {
            interactions: map as Readonly<
              Record<EntryId<"interaction">, "off" | EntryId<"interaction">>
            >,
          }),
    },
    ...(empty ? { clear: ["interactions" as const] } : {}),
  };
}

/**
 * Turn an inherited rule off (or back on) at this instance position — one history step. Turning it
 * on drops the position's entry (a replacement rule it pointed at stays the owner's own).
 */
export const catalogInheritedRuleEnabledCommand =
  (
    owner: CatalogInteractionOwner,
    ruleId: EntryId<"interaction">,
    enabled: boolean,
  ): CatalogCommand =>
  (reader) => {
    const position = inheritedPosition(reader as CatalogVariableReader, owner);
    if (!position) throw new Error("NOT_AN_INSTANCE_POSITION");
    const get = (id: string) => reader.getEntry(id as never);
    const map: Record<string, "off" | EntryId<"interaction">> = {
      ...catalogInteractionOverridesAt(get, position.address),
    };
    if (enabled) delete map[ruleId];
    else map[ruleId] = "off";
    return {
      label: enabled ? "Turn inherited rule on" : "Turn inherited rule off",
      ops: [overrideMapOp(position.address, map)],
    };
  };

/**
 * 「이 instance 에서 바꾸기」 — a copy of the inherited rule as the owner's own rule, mapped to run
 * instead of it at this position (one history step). The copy is then edited as any own rule.
 */
export const catalogReplaceInheritedRuleCommand =
  (
    owner: CatalogInteractionOwner,
    rule: InteractionEntry,
    newId: NewId,
  ): CatalogCommand =>
  (reader) => {
    const position = inheritedPosition(reader as CatalogVariableReader, owner);
    if (!position) throw new Error("NOT_AN_INSTANCE_POSITION");
    const copy = catalogNewInteraction(owner, rule.trigger, rule.actions, newId);
    const own = catalogInteractionsOf(reader as CatalogVariableReader, owner);
    const planned = catalogInteractionsCommand(
      owner,
      [...own, copy],
      "Replace inherited rule",
    )(reader);
    const get = (id: string) => reader.getEntry(id as never);
    return {
      label: "Replace inherited rule",
      ops: [
        ...planned.ops,
        overrideMapOp(position.address, {
          ...catalogInteractionOverridesAt(get, position.address),
          [rule.id]: copy.id,
        }),
      ],
    };
  };

