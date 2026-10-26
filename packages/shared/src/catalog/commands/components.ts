import type {
  AuthoredValue,
  CatalogCapabilityTarget,
  CatalogStateOwnerRef,
  DefinitionEntry,
  DefinitionOverrideEntry,
  EntryId,
  InstanceAddress,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  NodeResponsiveLayer,
  ResponsiveBreakpointName,
  StateName,
  TemplateId,
  WriteValue,
} from "../document/types";
import {
  positionLayout,
  withoutPositionLayout,
} from "../document/absoluteLayout";
import { cloneNodeSubgraph } from "../document/clone";
import { ownedChildren } from "../document/graph";
import {
  mapShowWhenAddresses,
  mapShowWhenOwnerRefs,
} from "../document/stateOwnerRefs";
import type { CatalogCommand } from "./compose";
import {
  childList,
  CommandDraft,
  fail,
  locate,
  setChildList,
  topLevel,
} from "./context";
import { detachInto, type NewId } from "./materialize";
import { pruneComponentPropertyTargets } from "./properties";
import {
  addRelated,
  relatedId,
  removeWithReferrers,
  subtree,
} from "./structure";

/**
 * ADR-248 Phase 4b component commands, revised by ADR-279 (Framer Assets): detach an instance,
 * write a library definition's project defaults, make a component from a node (the definition
 * owns it — the Local page draws it — and an instance stands where it stood), duplicate a
 * component, and dissolve one.
 */

export const detachInstances =
  (input: {
    ids: readonly NodeId[];
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const ids = topLevel(reader, input.ids);
    for (const id of ids) detachInto(draft, id, input.newId);
    return {
      label: input.label ?? "Detach",
      ops: draft.ops(),
      selectAfter: ids,
    };
  };

/**
 * A project default for a library definition (its `definitionOverride`, created on first use):
 * every instance of the definition shows it unless the instance overrides the key.
 */
export const setLibraryDefault =
  (input: {
    definitionId: LibraryDefinitionId;
    scope: "defaults" | "visual" | "stateRules";
    key: string;
    state?: StateName;
    write: WriteValue<AuthoredValue>;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    if (!reader.library.definitions.has(input.definitionId))
      fail("DANGLING_DEFINITION", input.definitionId);
    const draft = new CommandDraft(reader);
    const project = draft.project();
    let overrideId = project.overrideIds.find((id) => {
      const entry = draft.read(id);
      return (
        entry?.kind === "definitionOverride" &&
        entry.targetId === input.definitionId
      );
    });
    if (!overrideId) {
      overrideId = input.newId("definitionOverride");
      const entry: DefinitionOverrideEntry = {
        kind: "definitionOverride",
        id: overrideId,
        targetId: input.definitionId,
        defaults: {},
        visual: {},
        stateRules: {},
      };
      draft.create(entry);
      draft.write({
        ...project,
        overrideIds: [...project.overrideIds, overrideId],
      });
    }
    return {
      label: input.label ?? "Edit component default",
      ops: [
        ...draft.ops(),
        {
          kind: "patchDefinitionOverride",
          id: overrideId,
          scope: input.scope,
          key: input.key,
          ...(input.state ? { state: input.state } : {}),
          write: input.write,
        },
      ],
    };
  };

const keys = (value: object | undefined) =>
  value ? Object.keys(value).length > 0 : false;

/**
 * ADR-279 Decision 2 (review h2): the node's position keys (`POSITION_LAYOUT_KEYS`), layer by
 * layer — the base `layout` and each `responsive[bp].layout` — go to the instance's same layer
 * and leave the template's; everything else stays with the template. A layer left empty goes.
 */
export function splitPositionLayers(node: NodeEntry): {
  template: NodeEntry;
  instance: Pick<NodeEntry, "layout" | "responsive">;
} {
  const base = node.layout ? positionLayout(node.layout) : {};
  const templateBase = node.layout
    ? withoutPositionLayout(node.layout)
    : undefined;
  const instanceLayers: Partial<
    Record<ResponsiveBreakpointName, NodeResponsiveLayer>
  > = {};
  const templateLayers: Partial<
    Record<ResponsiveBreakpointName, NodeResponsiveLayer>
  > = {};
  for (const [name, layer] of Object.entries(node.responsive ?? {}) as [
    ResponsiveBreakpointName,
    NodeResponsiveLayer | undefined,
  ][]) {
    if (!layer) continue;
    const position = layer.layout ? positionLayout(layer.layout) : {};
    const rest = layer.layout ? withoutPositionLayout(layer.layout) : undefined;
    if (keys(position)) instanceLayers[name] = { layout: position };
    const { layout: _layout, ...others } = layer;
    const kept: NodeResponsiveLayer = {
      ...others,
      ...(keys(rest) ? { layout: rest } : {}),
    };
    if (keys(kept)) templateLayers[name] = kept;
  }
  const { layout: _base, responsive: _layers, ...rest } = node;
  return {
    template: {
      ...rest,
      ...(keys(templateBase) ? { layout: templateBase } : {}),
      ...(keys(templateLayers) ? { responsive: templateLayers } : {}),
    },
    instance: {
      ...(keys(base) ? { layout: base } : {}),
      ...(keys(instanceLayers) ? { responsive: instanceLayers } : {}),
    },
  };
}

/**
 * ADR-279 Decision 8 (review h1): the node made a component was inside another component's
 * template (`outerId`). Every stored address through it — an outer instance's `patch` · `fillSlot`
 * · `replace`, an interaction's address, a state owner reference (`showWhen`), a template node's
 * `local` reference — is rewritten in this same step to pass through the new instance: an address
 * **through** the node gains the instance (`instances += [J]`, `templatePath` from the node); one
 * **at** the node ends at the instance (a `fillSlot` at it fills the node's own slot, reached
 * through the instance). The outer definition's properties that drove a node inside it are
 * dropped (`PROPERTY_TARGET_OUTSIDE` — a nested instance's properties are not exposed, ADR-261).
 */
function rewriteAddressesThroughExtracted(
  draft: CommandDraft,
  extracted: NodeId,
  instanceId: NodeId,
  outerId: EntryId<"definition">,
): void {
  const reader = draft.reader;
  const through = (
    address: InstanceAddress,
    atSelf: "instance" | "slot",
  ): InstanceAddress | undefined => {
    const at = address.templatePath.indexOf(extracted);
    if (at < 0) return undefined;
    const rest = address.templatePath.slice(at);
    if (rest.length === 1 && atSelf === "instance")
      return {
        instances: address.instances,
        templatePath: [...address.templatePath.slice(0, at), instanceId],
      };
    return {
      instances: [...address.instances, instanceId],
      templatePath: rest,
    };
  };
  // Holders by reference (the reverse index): instances' overrides and interactions.
  for (const holderId of reader.referrersOf(extracted)) {
    const holder = draft.read(holderId);
    if (holder?.kind === "node") {
      let changed = false;
      const overrides = holder.descendantOverrides.map((override) => {
        const address = through(
          override.address,
          override.kind === "fillSlot" ? "slot" : "instance",
        );
        if (!address) return override;
        changed = true;
        return { ...override, address };
      });
      if (changed) draft.write({ ...holder, descendantOverrides: overrides });
    } else if (holder?.kind === "interaction") {
      let next = holder;
      const address = holder.address && through(holder.address, "instance");
      if (address) next = { ...next, address };
      // ADR-283 Decision 3: a capability target through the node. An address · a `local` held
      // outside the node passes through the instance; a `local` held inside it is relative to the
      // new template root (above it — unreachable from the new template: no target).
      const actions = next.actions.map((action) => {
        if (action.opcode !== "capability" || "nodeId" in action.target)
          return action;
        const target = action.target;
        let moved: typeof target | undefined;
        if ("address" in target) {
          const at = through(target.address, "instance");
          if (at) moved = { address: at };
        } else if ("local" in target) {
          const local = target.local;
          const at = local.templatePath.indexOf(extracted);
          if (subtree(draft, extracted).includes(next.ownerId))
            moved =
              at < 0
                ? // (Through a nested instance that moved in too: already the new template's.)
                  local.instances.length &&
                  subtree(draft, extracted).includes(
                    local.instances[0] as NodeId,
                  )
                  ? undefined
                  : { unset: true }
                : {
                    local: {
                      instances: local.instances,
                      templatePath: local.templatePath.slice(at),
                    },
                  };
          else if (at >= 0) {
            const step = through(local as InstanceAddress, "instance")!;
            moved = {
              local: {
                instances: step.instances,
                templatePath: step.templatePath,
              },
            };
          }
        }
        return moved ? { ...action, target: moved } : action;
      });
      if (actions.some((action, index) => action !== next.actions[index]))
        next = { ...next, actions };
      if (next !== holder) draft.write(next);
    } else if (holder?.kind === "definition" && holder.id === outerId) {
      const inside = new Set<string>(subtree(draft, extracted));
      pruneComponentPropertyTargets(draft, holder, (_property, target) =>
        inside.has(target.id),
      );
    }
  }
  // State owner references are not indexed: the nodes under the outer component's instances
  // (slot contents, replacements) may address a position through the node.
  for (const instance of reader.instancesOf(outerId))
    for (const id of subtree(draft, instance as NodeId)) {
      const node = draft.node(id);
      if (!node.showWhen) continue;
      let changed = false;
      const showWhen = mapShowWhenAddresses(node.showWhen, (address) => {
        const next = through(address, "instance");
        if (!next) return address;
        changed = true;
        return next;
      });
      if (changed) draft.write({ ...node, showWhen });
    }
  // A template node's `local` reference (its own origin's position, no instance): inside the
  // extracted node it is relative to the new template root (through the node → from it; above
  // it → unreachable from the new template, dropped); outside, through the node → through the instance.
  const outer = draft.read(outerId);
  const rootId =
    outer?.kind === "definition" ? outer.templateRootId : undefined;
  if (!rootId) return;
  const inside = new Set<string>(subtree(draft, extracted));
  for (const id of subtree(draft, rootId)) {
    const node = draft.node(id);
    if (!node.showWhen) continue;
    let changed = false;
    const showWhen = mapShowWhenOwnerRefs(node.showWhen, (from) => {
      if (!("ancestor" in from) || !("local" in from.ancestor)) return from;
      const local = from.ancestor.local;
      const at = local.templatePath.indexOf(extracted);
      changed = true;
      if (inside.has(id))
        return at < 0
          ? undefined
          : {
              ancestor: {
                local: {
                  instances: local.instances,
                  templatePath: local.templatePath.slice(at),
                },
              },
            };
      if (at < 0) {
        changed = false;
        return from;
      }
      const next = through(local as InstanceAddress, "instance")!;
      return {
        ancestor: {
          local: { instances: next.instances, templatePath: next.templatePath },
        },
      } as CatalogStateOwnerRef;
    });
    if (changed) draft.write({ ...node, showWhen });
  }
}

/**
 * ADR-283 Decision 3 — the nodes made a component's template now sit in the new definition's
 * template behind the instance `instanceId` that took the node's place. A capability target naming
 * one of them is rewritten in this same step:
 * - by id (`{ nodeId }`): from a rule inside the new template, a place of its own origin
 *   (`local`); from elsewhere, the place in the instance — `{ address }` on a page, a `local`
 *   through the instance inside an outer component's template (`outer`);
 * - a step through a nested instance that moved in (`address` · `local` instances): the instance
 *   is a step before it, unless the rule moved in too (then a `local` of the new template).
 * Steps of the moved node's own template path are `rewriteAddressesThroughExtracted`'s.
 */
function rewriteTargetsIntoComponent(
  draft: CommandDraft,
  rootId: NodeId,
  instanceId: NodeId,
  outer: boolean,
): void {
  const parentOf = new Map<NodeId, NodeId>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const child of ownedChildren(draft.node(id))) {
      parentOf.set(child, id);
      stack.push(child);
    }
  }
  const inside = new Set<string>([rootId, ...parentOf.keys()]);
  const pathTo = (id: NodeId): NodeId[] => {
    const path = [id];
    for (let at = parentOf.get(id); at; at = parentOf.get(at)) path.unshift(at);
    return path;
  };
  const done = new Set<string>();
  for (const nodeId of inside)
    for (const referrerId of draft.reader.referrersOf(nodeId)) {
      if (done.has(referrerId)) continue;
      const entry = draft.read(referrerId);
      if (entry?.kind !== "interaction") continue;
      const ruleInside = inside.has(entry.ownerId);
      const retarget = (
        target: CatalogCapabilityTarget,
      ): CatalogCapabilityTarget | undefined => {
      let next: CatalogCapabilityTarget | undefined;
      if ("nodeId" in target && inside.has(target.nodeId)) {
        const templatePath = pathTo(target.nodeId);
        next = ruleInside
          ? { local: { instances: [], templatePath } }
          : outer
            ? { local: { instances: [instanceId], templatePath } }
            : { address: { instances: [instanceId], templatePath } };
      } else if ("address" in target || "local" in target) {
        const steps = "address" in target ? target.address : target.local;
        const at = steps.instances.findIndex((id) => inside.has(id));
        if (at < 0 || steps.templatePath.includes(rootId)) return undefined;
        const instances = ruleInside
          ? steps.instances.slice(at)
          : [
              ...steps.instances.slice(0, at),
              instanceId,
              ...steps.instances.slice(at),
            ];
        const moved = {
          instances: instances as TemplateId[],
          templatePath: steps.templatePath,
        };
        next =
          "address" in target && !ruleInside
            ? { address: moved as InstanceAddress }
            : { local: moved };
      }
      return next;
      };
      // (ADR-284: every capability Do of the rule.)
      const actions = entry.actions.map((action) => {
        if (action.opcode !== "capability") return action;
        const next = retarget(action.target);
        return next ? { ...action, target: next } : action;
      });
      if (actions.every((action, index) => action === entry.actions[index]))
        continue;
      done.add(referrerId);
      draft.write({ ...entry, actions });
    }
}

/** The definition whose template holds `id` (owner chain top), or undefined on a page. */
function templateOwnerOf(
  draft: CommandDraft,
  id: string,
): EntryId<"definition"> | undefined {
  let top: string | undefined = id;
  const seen = new Set<string>();
  while (top && !seen.has(top)) {
    seen.add(top);
    const entry = draft.read(top);
    if (entry?.kind === "definition") return entry.id;
    if (entry?.kind === "page") return undefined;
    top = draft.reader.ownerOf(top);
  }
  return undefined;
}

/**
 * Make a component from an owned node (ADR-279 — Framer · Webflow · Plasmic): the new definition
 * owns the node as its template (the Local page draws and edits it there), and an instance of the
 * definition stands where the node stood — the same parent and index, the node's position keys
 * (layer by layer). Inside another component's template, the addresses through the node follow
 * it (Decision 8). Selects the instance.
 */
export const createComponent =
  (input: {
    id: NodeId;
    name: string;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const node = draft.node(input.id);
    // An owned node in a place an instance can stand (not a template root or a replacement).
    const { parent, index } = locate(draft, input.id);
    const name = input.name.trim() || fail("NAME_REQUIRED", input.id);
    const outerId = templateOwnerOf(draft, input.id);
    const definitionId = input.newId("definition");
    const instanceId = input.newId("node");
    const { template, instance } = splitPositionLayers(node);
    draft.write(template);
    const definition: DefinitionEntry = {
      kind: "definition",
      id: definitionId,
      name,
      mode: "composite",
      accepts: {},
      defaults: {},
      visual: {},
      stateRules: {},
      templateRootId: node.id,
      usage: "component",
    };
    draft.create(definition);
    draft.create({
      kind: "node",
      id: instanceId,
      definitionId,
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
      ...instance,
    });
    const list = [...(childList(draft, parent) ?? [])];
    list[index] = instanceId;
    setChildList(draft, parent, list);
    const project = draft.project();
    draft.write({
      ...project,
      definitionIds: [...project.definitionIds, definitionId],
    });
    rewriteTargetsIntoComponent(draft, node.id, instanceId, !!outerId);
    if (outerId)
      rewriteAddressesThroughExtracted(draft, node.id, instanceId, outerId);
    return {
      label: input.label ?? "Create component",
      ops: draft.ops(),
      selectAfter: [instanceId],
    };
  };

/**
 * Dissolve a project component (ADR-279 Decision 6 — Framer Unlink): every instance is detached
 * (it keeps what it showed, as owned nodes), then the definition and its template go. One step.
 */
export const dissolveComponent =
  (input: {
    definitionId: EntryId<"definition">;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = draft.read(input.definitionId);
    if (definition?.kind !== "definition")
      return fail("DANGLING_DEFINITION", input.definitionId);
    for (const id of reader.instancesOf(input.definitionId))
      detachInto(draft, id as NodeId, input.newId);
    const template = definition.templateRootId
      ? subtree(draft, definition.templateRootId)
      : [];
    removeWithReferrers(draft, [input.definitionId, ...template]);
    const project = draft.project();
    draft.write({
      ...project,
      definitionIds: project.definitionIds.filter(
        (id) => id !== input.definitionId,
      ),
    });
    return { label: input.label ?? "Delete component", ops: draft.ops() };
  };

/**
 * ADR-279 Decision 7 (Figma · Framer — duplicating a main component makes a new component): a
 * copy of the definition with a copy of its template (owned records and all), named
 * 「{name} copy」, listed right after it. Its properties drive the copied nodes. Selects the copy's
 * template root (the Local page card).
 */
export const duplicateDefinition =
  (input: {
    definitionId: EntryId<"definition">;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = draft.read(input.definitionId);
    if (definition?.kind !== "definition" || !definition.templateRootId)
      return fail("DANGLING_DEFINITION", input.definitionId);
    const copied = new Map<NodeId, NodeId>();
    const clone = cloneNodeSubgraph(
      {
        getEntry: (id) => draft.read(id),
        referrersOf: (id) => reader.referrersOf(id),
      },
      definition.templateRootId,
      (oldId) => {
        const next = input.newId("node");
        copied.set(oldId, next);
        return next;
      },
      relatedId(input.newId),
    );
    for (const entry of clone.entries) draft.create(entry);
    addRelated(draft, clone.relatedEntries);
    const copyId = input.newId("definition");
    const copy: DefinitionEntry = {
      ...definition,
      id: copyId,
      name: `${definition.name} copy`,
      templateRootId: clone.rootId,
      ...(definition.properties
        ? {
            properties: definition.properties.map((property) => ({
              ...property,
              targets: property.targets.map((target) => ({
                ...target,
                id: copied.get(target.id as NodeId) ?? target.id,
              })),
            })),
          }
        : {}),
    };
    draft.create(copy);
    const project = draft.project();
    const at = project.definitionIds.indexOf(input.definitionId);
    const definitionIds = [...project.definitionIds];
    definitionIds.splice(at < 0 ? definitionIds.length : at + 1, 0, copyId);
    draft.write({ ...project, definitionIds });
    return {
      label: input.label ?? "Duplicate component",
      ops: draft.ops(),
      selectAfter: [clone.rootId],
    };
  };

export { componentOriginOf } from "../document/componentOrigin";
