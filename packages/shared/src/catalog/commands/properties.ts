import { ownedChildren } from "../document/graph";
import type {
  ComponentProperty,
  ComponentPropertyTarget,
  DefinitionEntry,
  DescendantOverride,
  EntryId,
  NodeEntry,
  NodeId,
} from "../document/types";
import type { CatalogCommand } from "./compose";
import { CommandDraft, fail } from "./context";

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

/** Write a component's property list; the keys it lost are cleared from every instance. */
function writeProperties(
  draft: CommandDraft,
  definition: DefinitionEntry,
  properties: readonly ComponentProperty[],
): void {
  const kept = new Set(properties.map((property) => property.key));
  const lost = new Set(
    (definition.properties ?? [])
      .map((property) => property.key)
      .filter((key) => !kept.has(key)),
  );
  const { properties: _old, ...rest } = definition;
  draft.write(properties.length ? { ...rest, properties } : rest);
  clearComponentPropertyValues(draft, definition.id, lost);
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
    writeProperties(
      draft,
      definition,
      definition.properties.map((item) =>
        item.key === input.key ? { ...item, name } : item,
      ),
    );
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
