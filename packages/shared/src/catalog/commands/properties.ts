import { ownedChildren } from "../document/graph";
import { catalogActionsDeep, filterCatalogActionsDeep } from "../document/interactionActions";
import {
  componentEventAttribute,
  componentEventKeyOf,
  componentPropertyCodeName,
  emitDefinitionOf,
  receivingInstanceOf,
} from "../document/componentEvents";
import { resolveTriggers } from "../../interactions/capabilityRegistry";
import { definitionTypeName } from "./context";
import type {
  ComponentProperty,
  ComponentPropertyTarget,
  DefinitionEntry,
  DefinitionId,
  DescendantOverride,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../document/types";
import type { CatalogCommand } from "./compose";
import { CommandDraft, fail } from "./context";
import { removeWithReferrers } from "./structure";

/**
 * ADR-261 Decision 4 — a user component's properties (Figma component properties, Phase 4: text ·
 * boolean): make one on an origin node, apply it to more nodes, take a node off, rename, delete.
 * The default is the target's own value (nothing stored); an instance writes its value under the
 * property's key on its root (`setFields`). Deleting a property — or its last target — clears the
 * value every instance wrote, in the same step.
 */

const sameTarget = (
  kind: ComponentProperty["kind"],
  left: ComponentPropertyTarget,
  right: ComponentPropertyTarget,
): boolean =>
  left.id === right.id && (kind === "boolean" || left.prop === right.prop);

function definitionOf(
  draft: CommandDraft,
  id: EntryId<"definition">,
): DefinitionEntry {
  const definition = draft.read(id);
  if (definition?.kind !== "definition") return fail("DANGLING_DEFINITION", id);
  if (definition.usage === "layout" || definition.id.startsWith("lib:"))
    return fail("PROPERTIES_NOT_COMPONENT", id);
  return definition;
}

/** Remove `keys` from a prop write record (`undefined` when nothing was there). */
function withoutKeys<T extends Readonly<Record<string, unknown>>>(
  record: T | undefined,
  keys: ReadonlySet<string>,
): T | undefined {
  if (!record || !Object.keys(record).some((key) => keys.has(key)))
    return undefined;
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !keys.has(key)),
  ) as T;
}

/** A patch override left with no field write is gone (a child list or replacement stays). */
function isEmptyPatch(override: DescendantOverride): boolean {
  if (override.kind !== "patch") return false;
  const { kind: _kind, address: _address, ...fields } = override;
  return Object.values(fields).every(
    (value) =>
      value === undefined ||
      (typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0),
  );
}

/**
 * Clear the values instances wrote for `keys` of a component: on its instances' roots, and in the
 * patches other instances put on a nested instance of it (an override whose position is that
 * instance — `referrersOf` finds them by the template id in their address).
 */
export function clearComponentPropertyValues(
  draft: CommandDraft,
  definitionId: EntryId<"definition">,
  keys: ReadonlySet<string>,
): void {
  if (!keys.size) return;
  for (const id of draft.reader.instancesOf(definitionId)) {
    const instance = draft.read(id);
    if (instance?.kind !== "node") continue;
    const props = withoutKeys(instance.props, keys);
    if (props) draft.write({ ...instance, props });
    for (const referrerId of draft.reader.referrersOf(id)) {
      const referrer = draft.read(referrerId);
      if (referrer?.kind !== "node") continue;
      let changed = false;
      const overrides = referrer.descendantOverrides.flatMap((override) => {
        const path = override.address.templatePath;
        if (override.kind === "replace" || path[path.length - 1] !== id)
          return [override];
        const props = withoutKeys(override.props, keys);
        if (!props) return [override];
        changed = true;
        const next = { ...override } as DescendantOverride & {
          props?: unknown;
        };
        if (Object.keys(props).length) next.props = props;
        else delete next.props;
        return isEmptyPatch(next) ? [] : [next];
      });
      if (changed) draft.write({ ...referrer, descendantOverrides: overrides });
    }
  }
}

/**
 * ADR-294 R3 — a property's name in the code (an instance's attribute) is one name: an event's
 * callback prop must not be a RAC callback of the instance's root type (`onPress` would read back
 * as the RAC rule), and no two properties share a code name.
 */
function assertCodeNames(
  draft: CommandDraft,
  definition: DefinitionEntry,
  properties: readonly ComponentProperty[],
): void {
  const root = definition.templateRootId
    ? draft.read(definition.templateRootId)
    : undefined;
  let triggers: readonly string[] = [];
  if (root?.kind === "node")
    try {
      triggers = resolveTriggers(definitionTypeName(draft.reader, root.definitionId));
    } catch {
      triggers = [];
    }
  const codeName = (property: ComponentProperty) =>
    property.kind === "event"
      ? componentEventAttribute(property)
      : componentPropertyCodeName(property);
  // (Only an event · a variable is checked — text · boolean names stay as ADR-261 left them.)
  for (const property of properties) {
    if (property.kind !== "event" && property.kind !== "variable") continue;
    const name = codeName(property);
    if (
      (property.kind === "event" && triggers.includes(name)) ||
      properties.some(
        (other) => other.key !== property.key && codeName(other) === name,
      )
    )
      fail("PROPERTY_NAME_TAKEN", property.name);
  }
}
/** Write a component's property list; the keys it lost are cleared from every instance. */
function writeProperties(
  draft: CommandDraft,
  definition: DefinitionEntry,
  properties: readonly ComponentProperty[],
): void {
  const kept = new Set(properties.map((property) => property.key));
  const lostProperties = (definition.properties ?? []).filter(
    (property) => !kept.has(property.key),
  );
  const lost = new Set(lostProperties.map((property) => property.key));
  const { properties: _old, ...rest } = definition;
  draft.write(properties.length ? { ...rest, properties } : rest);
  clearComponentPropertyValues(draft, definition.id, lost);
  removeComponentOutputs(draft, definition.id, lostProperties);
}
/**
 * ADR-294 — what a deleted `event` · `variable` property takes with it (ADR-288 「사용처가 같이
 * 간다」): the origin rules' `emit` Do of it (a rule left with none goes), the instances'
 * `property:<key>` rules, and a variable property's input variable (the references to it with it).
 */
function removeComponentOutputs(
  draft: CommandDraft,
  definitionId: EntryId<"definition">,
  lost: readonly ComponentProperty[],
): void {
  const events = new Set(
    lost.filter((item) => item.kind === "event").map((item) => item.key),
  );
  const variables = lost.flatMap((item) =>
    item.kind === "variable" && item.variableId ? [item.variableId] : [],
  );
  if (!events.size && !variables.length) return;
  const get = (id: string) => draft.read(id);
  const ownerOf = (id: string) => draft.reader.ownerOf(id);
  const gone: EntryId<"interaction">[] = [];
  if (events.size)
    for (const id of draft.project().interactionIds) {
      const rule = draft.read(id) as InteractionEntry | undefined;
      if (!rule) continue;
      const key = componentEventKeyOf(rule.trigger);
      if (key !== undefined && events.has(key)) {
        const receiver = receivingInstanceOf(rule, get);
        if (receiver?.kind === "node" && receiver.definitionId === definitionId)
          gone.push(rule.id);
        continue;
      }
      if (
        !catalogActionsDeep(rule.actions).some(
          (action) => action.opcode === "emit" && events.has(action.propertyKey),
        ) ||
        emitDefinitionOf(rule, get, ownerOf) !== definitionId
      )
        continue;
      const actions = filterCatalogActionsDeep(
        rule.actions,
        (action) => action.opcode !== "emit" || !events.has(action.propertyKey),
      );
      if (actions.length) draft.write({ ...rule, actions });
      else gone.push(rule.id);
    }
  if (!gone.length && !variables.length) return;
  const removed = new Set<string>([...gone, ...variables]);
  const project = draft.project();
  draft.write({
    ...project,
    stateVariableIds: project.stateVariableIds.filter((id) => !removed.has(id)),
    interactionIds: project.interactionIds.filter((id) => !removed.has(id)),
  });
  removeWithReferrers(draft, [...gone, ...variables]);
}

/**
 * Take targets off a component's properties (`drop`); a property left with none is deleted (its
 * instance values cleared). No write when nothing changes.
 */
export function pruneComponentPropertyTargets(
  draft: CommandDraft,
  definition: DefinitionEntry,
  drop: (
    property: ComponentProperty,
    target: ComponentPropertyTarget,
  ) => boolean,
): void {
  if (!definition.properties?.length) return;
  let changed = false;
  const properties = definition.properties.flatMap((property) => {
    const targets = property.targets.filter(
      (target) => !drop(property, target),
    );
    if (targets.length === property.targets.length) return [property];
    changed = true;
    return targets.length ? [{ ...property, targets }] : [];
  });
  if (changed) writeProperties(draft, definition, properties);
}

/** The owner a node has after this command's writes (a moved node's new parent). */
function ownerInDraft(draft: CommandDraft, id: string): string | undefined {
  for (const entry of draft.writtenEntries())
    if ((ownedChildren(entry) as string[]).includes(id)) return entry.id;
  const owner = draft.reader.ownerOf(id);
  const now = owner ? draft.read(owner) : undefined;
  return now && (ownedChildren(now) as string[]).includes(id)
    ? owner
    : undefined;
}

/**
 * After a move: a property target that left its component's origin subtree is taken off the
 * property (ADR-261 Decision 4 — 「서브트리 밖으로 이동 → 그 대상을 속성에서 뺀다」).
 */
export function pruneMovedPropertyTargets(
  draft: CommandDraft,
  movedIds: readonly NodeId[],
): void {
  const definitions = new Set<EntryId<"definition">>();
  const stack: string[] = [...movedIds];
  while (stack.length) {
    const id = stack.pop()!;
    for (const referrer of draft.reader.referrersOf(id))
      if (referrer.startsWith("project:definition:"))
        definitions.add(referrer as EntryId<"definition">);
    const entry = draft.read(id);
    if (entry?.kind === "node") stack.push(...ownedChildren(entry));
  }
  for (const definitionId of definitions) {
    const definition = draft.read(definitionId);
    if (definition?.kind !== "definition" || !definition.templateRootId)
      continue;
    const rootId = definition.templateRootId;
    const inOrigin = (id: string): boolean => {
      const seen = new Set<string>();
      for (
        let cursor: string | undefined = id;
        cursor && !seen.has(cursor);
        cursor = ownerInDraft(draft, cursor)
      ) {
        if (cursor === rootId) return true;
        seen.add(cursor);
      }
      return false;
    };
    pruneComponentPropertyTargets(
      draft,
      definition,
      (_property, target) => !inOrigin(target.id),
    );
  }
}

export interface ComponentPropertyInput {
  definitionId: EntryId<"definition">;
  label?: string;
}

/**
 * Make a property on one origin node (Figma 「Create property」). The caller names the key (a
 * generated, stable prop name). A node · text prop another property already drives moves to the
 * new one (each is driven by one property).
 */
export const addComponentProperty =
  (
    input: ComponentPropertyInput & {
      key: string;
      name: string;
      kind: ComponentProperty["kind"];
      target: ComponentPropertyTarget;
    },
  ): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = definitionOf(draft, input.definitionId);
    if (definition.properties?.some((property) => property.key === input.key))
      return fail("DUPLICATE_PROPERTY_KEY", input.key);
    const name = input.name.trim() || fail("NAME_REQUIRED", input.key);
    const target: ComponentPropertyTarget =
      input.kind === "text"
        ? { id: input.target.id, prop: input.target.prop }
        : { id: input.target.id };
    const properties = takeOver(definition, input.kind, target);
    writeProperties(draft, definition, [
      ...properties,
      { key: input.key, name, kind: input.kind, targets: [target] },
    ]);
    return { label: input.label ?? "Create property", ops: draft.ops() };
  };

/** The properties without `target` (of `kind`) — it is about to be driven by another one. */
function takeOver(
  definition: DefinitionEntry,
  kind: ComponentProperty["kind"],
  target: ComponentPropertyTarget,
): ComponentProperty[] {
  return (definition.properties ?? []).flatMap((property) => {
    if (property.kind !== kind) return [property];
    const targets = property.targets.filter(
      (other) => !sameTarget(kind, other, target),
    );
    if (targets.length === property.targets.length) return [property];
    return targets.length ? [{ ...property, targets }] : [];
  });
}

/**
 * ADR-294 — make an `event` (the component's output: an origin rule `emit`s it, an instance's
 * `property:<key>` rule receives it) or a `variable` property (an input the instance passes; the
 * origin reads it as its template root's input variable, made in the same step). Neither drives
 * an origin node.
 */
export const addComponentOutputProperty =
  (
    input: ComponentPropertyInput & {
      key: string;
      name: string;
    } & (
        | {
            kind: "event";
            valueType?: ComponentProperty["valueType"];
          }
        | {
            kind: "variable";
            variable: Pick<
              StateVariableEntry,
              "id" | "valueType" | "defaultValue"
            >;
          }
      ),
  ): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = definitionOf(draft, input.definitionId);
    if (definition.properties?.some((property) => property.key === input.key))
      return fail("DUPLICATE_PROPERTY_KEY", input.key);
    const name = input.name.trim() || fail("NAME_REQUIRED", input.key);
    const property: ComponentProperty =
      input.kind === "event"
        ? {
            key: input.key,
            name,
            kind: "event",
            targets: [],
            ...(input.valueType ? { valueType: input.valueType } : {}),
          }
        : {
            key: input.key,
            name,
            kind: "variable",
            targets: [],
            variableId: input.variable.id,
          };
    if (input.kind === "variable") {
      const rootId =
        definition.templateRootId ??
        fail("PROPERTIES_NOT_COMPONENT", definition.id);
      draft.create({
        kind: "stateVariable",
        id: input.variable.id,
        ownerId: rootId as NodeId,
        name,
        valueType: input.variable.valueType,
        defaultValue: input.variable.defaultValue,
        input: { propertyKey: input.key },
      });
      const project = draft.project();
      draft.write({
        ...project,
        stateVariableIds: [...project.stateVariableIds, input.variable.id],
      });
    }
    const next = [...(definition.properties ?? []), property];
    assertCodeNames(draft, definition, next);
    writeProperties(draft, definition, next);
    return { label: input.label ?? "Create property", ops: draft.ops() };
  };

/** Apply an existing property to one more origin node (Figma 「Apply property」). */
export const applyComponentProperty =
  (
    input: ComponentPropertyInput & {
      key: string;
      target: ComponentPropertyTarget;
    },
  ): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = definitionOf(draft, input.definitionId);
    const property = definition.properties?.find(
      (item) => item.key === input.key,
    );
    if (!property) return fail("PROPERTY_NOT_FOUND", input.key);
    const target: ComponentPropertyTarget =
      property.kind === "text"
        ? { id: input.target.id, prop: input.target.prop }
        : { id: input.target.id };
    if (
      property.targets.some((other) => sameTarget(property.kind, other, target))
    )
      return { label: input.label ?? "Apply property", ops: [] };
    // (The node · text prop leaves the property that drove it.)
    writeProperties(
      draft,
      definition,
      takeOver(definition, property.kind, target).map((item) =>
        item.key === property.key
          ? { ...item, targets: [...item.targets, target] }
          : item,
      ),
    );
    return { label: input.label ?? "Apply property", ops: draft.ops() };
  };

/** Take one origin node off a property; its last node deletes it. */
export const detachComponentProperty =
  (
    input: ComponentPropertyInput & {
      key: string;
      target: ComponentPropertyTarget;
    },
  ): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = definitionOf(draft, input.definitionId);
    if (!definition.properties?.some((item) => item.key === input.key))
      return fail("PROPERTY_NOT_FOUND", input.key);
    pruneComponentPropertyTargets(
      draft,
      definition,
      (property, target) =>
        property.key === input.key &&
        sameTarget(property.kind, target, input.target),
    );
    return { label: input.label ?? "Detach property", ops: draft.ops() };
  };

export const renameComponentProperty =
  (
    input: ComponentPropertyInput & { key: string; name: string },
  ): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = definitionOf(draft, input.definitionId);
    if (!definition.properties?.some((item) => item.key === input.key))
      return fail("PROPERTY_NOT_FOUND", input.key);
    const name = input.name.trim() || fail("NAME_REQUIRED", input.key);
    const next = definition.properties.map((item) =>
      item.key === input.key ? { ...item, name } : item,
    );
    // (ADR-294 R3 — an event · a variable is named in the code by its name.)
    const renamed = next.find((item) => item.key === input.key)!;
    if (renamed.kind === "event" || renamed.kind === "variable")
      assertCodeNames(draft, definition, next);
    writeProperties(draft, definition, next);
    return { label: input.label ?? "Rename property", ops: draft.ops() };
  };

/** Delete a property: the origin nodes keep their own values; every instance's value is cleared. */
export const removeComponentProperty =
  (input: ComponentPropertyInput & { key: string }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = definitionOf(draft, input.definitionId);
    if (!definition.properties?.some((item) => item.key === input.key))
      return fail("PROPERTY_NOT_FOUND", input.key);
    writeProperties(
      draft,
      definition,
      definition.properties.filter((item) => item.key !== input.key),
    );
    return { label: input.label ?? "Delete property", ops: draft.ops() };
  };

/**
 * ADR-261 Phase 5 — an instance property's preferred components (Figma preferred values): offered
 * first when an instance picks its value. A suggestion, not a limit.
 */
export const setComponentPropertyPreferred =
  (
    input: ComponentPropertyInput & {
      key: string;
      preferred: readonly DefinitionId[];
    },
  ): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = definitionOf(draft, input.definitionId);
    const property = definition.properties?.find(
      (item) => item.key === input.key,
    );
    if (property?.kind !== "instance")
      return fail("PROPERTY_NOT_FOUND", input.key);
    const preferred = [...new Set(input.preferred)];
    writeProperties(
      draft,
      definition,
      definition.properties!.map((item) => {
        if (item.key !== input.key) return item;
        const { preferred: _old, ...rest } = item;
        return preferred.length ? { ...rest, preferred } : rest;
      }),
    );
    return { label: input.label ?? "Preferred components", ops: draft.ops() };
  };

/** Every property of a component on the given node (an origin node's Design panel). */
export function componentPropertiesOn(
  definition: Pick<DefinitionEntry, "properties">,
  nodeId: NodeEntry["id"],
): { property: ComponentProperty; target: ComponentPropertyTarget }[] {
  return (definition.properties ?? []).flatMap((property) =>
    property.targets
      .filter((target) => target.id === nodeId)
      .map((target) => ({ property, target })),
  );
}
