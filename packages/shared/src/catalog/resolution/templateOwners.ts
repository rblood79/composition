import type {
  CatalogEntry,
  CatalogLibrary,
  DescendantOverride,
  DescendantPatchFields,
  InstanceAddress,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../document/types";
import { descendantPatchOf } from "../document/types";

/**
 * ADR-260 Decision 11 — the overrides a template position takes on its projection path.
 *
 * An instance I projects its definition's template; a project template node T on the way (a
 * component inside the component — a Card, a ToggleButtonGroup) is an instance too and holds its
 * own `descendantOverrides` (its style writes, its owned slot contents). Both apply at a position
 * below T: T's as the origin's value, I's over it (Figma · pen.dev: an instance override beats the
 * main component's value). Each owner addresses the position from itself
 * (`validateInstanceAddress`): `instances` starts at that owner.
 *
 * A T's `fillSlot` · `replace` children are positions of the template T sits in — the template path
 * steps from T into them (`TEMPLATE_STEP` over the node's owned children, like a library template
 * node's `slotFills` children in its `children`).
 */

type Lookup = (id: string) => CatalogEntry | undefined;

/** A project node's owned children: children, `replace` nodes and `fillSlot` children. */
export function nodeOwnedChildren(node: NodeEntry): NodeId[] {
  const ids = [...node.children];
  for (const override of node.descendantOverrides) {
    if (override.kind === "replace") ids.push(override.replacementId);
    if (override.kind === "fillSlot") ids.push(...override.childIds);
  }
  return ids;
}

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);

const PATCH_FIELD_KEYS = [
  "props",
  "visual",
  "sizing",
  "stateRules",
  "enabled",
  "layout",
  "fills",
  "fillSizing",
  "responsive",
  "visibility",
] as const satisfies readonly (keyof DescendantPatchFields)[];

/** One owner's override at the position. */
export interface PositionOverride {
  owner: NodeEntry;
  override: DescendantOverride;
}

/**
 * The overrides at `templatePath` from `owner` (the authored instance) and every project template
 * node on `instancePath` after it, outermost first.
 */
export function overridesAt(
  get: Lookup,
  owner: NodeEntry,
  instancePath: readonly (NodeId | TemplateId)[],
  templatePath: readonly TemplateId[],
): PositionOverride[] {
  const start = instancePath.lastIndexOf(owner.id);
  const owners: NodeEntry[] = [owner];
  for (const id of instancePath.slice(start + 1)) {
    if (id.startsWith("lib:")) continue;
    const inner = get(id);
    if (inner?.kind === "node" && inner.descendantOverrides.length)
      owners.push(inner);
  }
  const found: PositionOverride[] = [];
  for (const at of owners) {
    const instances = instancePath.slice(instancePath.lastIndexOf(at.id));
    const override = at.descendantOverrides.find(
      (item) =>
        sameIds(item.address.instances, instances) &&
        sameIds(item.address.templatePath, templatePath),
    );
    if (override) found.push({ owner: at, override });
  }
  return found;
}

/** `over`'s field writes layered on `under`'s (the same order as one override over a template). */
export function layerPatchFields(
  under: DescendantPatchFields,
  over: DescendantPatchFields,
): DescendantPatchFields {
  const merged: Record<string, unknown> = { ...under };
  for (const key of ["props", "visual", "sizing", "layout"] as const)
    if (over[key]) merged[key] = { ...under[key], ...over[key] };
  if (over.stateRules) {
    const rules: Record<string, unknown> = { ...under.stateRules };
    for (const [state, writes] of Object.entries(over.stateRules))
      rules[state] = { ...(rules[state] as object), ...writes };
    merged.stateRules = rules;
  }
  for (const key of [
    "fills",
    "fillSizing",
    "responsive",
    "visibility",
    "enabled",
  ] as const)
    if (over[key] !== undefined) merged[key] = over[key];
  return merged as DescendantPatchFields;
}

/**
 * The position's structure (the outermost `replace` / `fillSlot`) and its field writes (every
 * owner's, inner first so the outer ones win).
 */
export function layeredOverride(found: readonly PositionOverride[]): {
  structural?: PositionOverride;
  patch?: DescendantPatchFields;
} {
  const structural = found.find((item) => item.override.kind !== "patch");
  let patch: DescendantPatchFields | undefined;
  for (const item of [...found].reverse()) {
    const fields = descendantPatchOf(item.override);
    if (!fields) continue;
    const own: DescendantPatchFields = {};
    for (const key of PATCH_FIELD_KEYS)
      if (fields[key] !== undefined)
        (own as Record<string, unknown>)[key] = fields[key];
    patch = patch ? layerPatchFields(patch, own) : own;
  }
  return { ...(structural ? { structural } : {}), ...(patch ? { patch } : {}) };
}

/**
 * Where an inner owner's slot contents stand: the instance path and the template path of that
 * owner T in the template it sits in. T's template path is its owner chain up to the root of the
 * definition the step before it instantiates (fill · replace steps included).
 */
export function innerOwnerPlace(
  get: Lookup,
  ownerOf: (id: string) => string | undefined,
  library: CatalogLibrary,
  instancePath: readonly (NodeId | TemplateId)[],
  inner: NodeEntry,
):
  | {
      instancePath: readonly (NodeId | TemplateId)[];
      templatePath: readonly TemplateId[];
    }
  | undefined {
  const index = instancePath.lastIndexOf(inner.id);
  if (index < 1) return undefined;
  const step = instancePath[index - 1];
  const stepEntry = step.startsWith("lib:")
    ? library.templates.get(step as `lib:template:${string}`)
    : get(step);
  const definitionId =
    stepEntry && "definitionId" in stepEntry
      ? stepEntry.definitionId
      : undefined;
  if (!definitionId) return undefined;
  const definition = definitionId.startsWith("lib:")
    ? library.definitions.get(definitionId as `lib:definition:${string}`)
    : get(definitionId);
  const root =
    definition && "templateRootId" in definition
      ? definition.templateRootId
      : undefined;
  if (!root) return undefined;
  const path: TemplateId[] = [inner.id];
  for (let at: string = inner.id; at !== root;) {
    const owner = ownerOf(at);
    if (!owner?.startsWith("project:node:")) return undefined;
    path.unshift(owner as TemplateId);
    at = owner;
  }
  return { instancePath: instancePath.slice(0, index), templatePath: path };
}
