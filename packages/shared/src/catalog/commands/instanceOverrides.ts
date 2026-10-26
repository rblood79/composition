import {
  componentPropertiesOf,
  componentPropertyWrites,
} from "../document/componentProperties";
import type {
  AuthoredValue,
  BreakpointName,
  CatalogReader,
  DefinitionEntry,
  DefinitionOverrideEntry,
  DescendantOverride,
  DescendantPatchFields,
  EditTarget,
  InstanceAddress,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  NodeResponsiveLayer,
  ResponsiveBreakpointName,
  StateName,
  StateRules,
  WriteValue,
} from "../document/types";
import { descendantPatchOf } from "../document/types";
import { catalogNodeVisibleAt } from "../resolution/resolver";
import { layerPatchFields } from "../resolution/templateOwners";
import type { CatalogOperation } from "../transactions/transaction";
import type { CatalogCommand, CatalogCommandPlan } from "./compose";
import { stageOver } from "./compose";
import { CommandDraft, fail, sameAddress } from "./context";
import { resetReplacement } from "./instanceProperty";
import type { NewId } from "./materialize";

/**
 * ADR-262 — an instance's override clean-up (Figma 「Push changes to main component」 · 「Reset all
 * changes」).
 *
 * Push writes what the instance changed onto its component's origin, then drops it from the
 * instance, so the instance shows the same (the push invariant) and every other instance without
 * its own override at that position takes it. The origin's three shapes (a referenced origin on a
 * page, a hidden template, an owned template) are all project nodes and take the same writes.
 *
 * - A root field or a direct position (the address names a node of the origin's template) goes
 *   to that node. The instance's base and breakpoint layers all come after the node's own layers
 *   in the projection (`resolver.ts` — review Round 2 h1), so a key is matched breakpoint by
 *   breakpoint: from the first layer the instance wrote it in, the node's layer takes the
 *   instance's cascade value, and a layer the cascade already gives is cleared.
 * - A nested position (the address steps through a nested instance N of the origin) goes to N's
 *   own override at the shortened address — the projection layers owners inner-first
 *   (`layeredOverride`), so N's override takes the same merge and shows the same.
 * - Slot contents (`fillSlot.childIds`) and swaps (`replace`) stay the instance's (user decisions
 *   2026-10-15 · ADR-261); the root's `sizing` · `layout` are its placement and stay (decision 3).
 * - A library origin takes only the root's `props` · `visual`, as its project defaults (decision 1).
 *
 * - Rules (ADR-281 Decision 4 — the `interactions` map): a rule the instance replaced at a direct
 *   position becomes the origin's (the origin rule takes the replacement's When · Do, the
 *   replacement goes); a rule it turned off stays off in the instance (not pushed). A nested
 *   position's map stays the instance's.
 *
 * Reset all drops every override the instance holds except what stays by decision: the slot
 * contents keep their lists (`resetDescendant`'s rule), a swap folds back (`resetReplacement`),
 * the root keeps `placement` · `sizing` · `layout`. The result shows as a fresh instance of the
 * same component (the reset invariant).
 */

type Axis = "visual" | "layout" | "sizing";
const AXES: readonly Axis[] = ["visual", "layout", "sizing"];
const LAYERS: readonly ResponsiveBreakpointName[] = ["tablet", "mobile"];
const BREAKPOINTS: readonly BreakpointName[] = ["desktop", "tablet", "mobile"];
type Writes = Readonly<Record<string, WriteValue<unknown>>>;
type Responsive = Partial<
  Record<ResponsiveBreakpointName, NodeResponsiveLayer>
>;

/** The field writes of a node or a patch, in one shape (the base and the breakpoint layers). */
interface Layered {
  base: Partial<Record<Axis, Writes>>;
  responsive?: Responsive;
}

function definitionOf(reader: CatalogReader, instance: NodeEntry) {
  const id = instance.definitionId;
  return id.startsWith("lib:")
    ? reader.library.definitions.get(id as LibraryDefinitionId)
    : reader.getEntry(id);
}

const nonEmpty = <T extends object>(value: T | undefined): T | undefined =>
  value && Object.keys(value).length ? value : undefined;

/** A responsive map without empty layers (`undefined` when none is left). */
function pruneResponsive(responsive: Responsive | undefined) {
  if (!responsive) return undefined;
  const next: Record<string, NodeResponsiveLayer> = {};
  for (const [name, layer] of Object.entries(responsive)) {
    if (!layer) continue;
    const kept = Object.fromEntries(
      Object.entries(layer).filter(([, value]) => nonEmpty(value as object)),
    ) as NodeResponsiveLayer;
    if (Object.keys(kept).length) next[name] = kept;
  }
  return nonEmpty(next) as Responsive | undefined;
}

/**
 * Match one axis of a target's layers to the instance's: for every key the instance wrote (in its
 * base or a layer), from the first layer it wrote it in, the target's layer takes the instance's
 * cascade value — set where the instance wrote, cleared where the cascade already gives it. The
 * target's layers above the first write stay (the display there is the target's own).
 */
function matchAxis(target: Layered, instance: Layered, axis: Axis): Layered {
  const steps: readonly (ResponsiveBreakpointName | "base")[] = [
    "base",
    ...LAYERS,
  ];
  const writesAt = (
    side: Layered,
    step: ResponsiveBreakpointName | "base",
  ): Writes | undefined =>
    step === "base"
      ? side.base[axis]
      : (side.responsive?.[step]?.[axis] as Writes | undefined);
  const keys = new Set<string>();
  for (const step of steps)
    for (const key of Object.keys(writesAt(instance, step) ?? {}))
      keys.add(key);
  if (!keys.size) return target;
  const base: Record<string, WriteValue<unknown>> = { ...target.base[axis] };
  const responsive: Record<
    ResponsiveBreakpointName,
    Record<string, WriteValue<unknown>>
  > = {
    tablet: { ...(target.responsive?.tablet?.[axis] as Writes | undefined) },
    mobile: { ...(target.responsive?.mobile?.[axis] as Writes | undefined) },
  };
  for (const key of keys) {
    const first = steps.findIndex((step) => writesAt(instance, step)?.[key]);
    for (let index = first; index < steps.length; index += 1) {
      const step = steps[index];
      const write = writesAt(instance, step)?.[key];
      const into = step === "base" ? base : responsive[step];
      if (write) into[key] = write;
      else delete into[key];
    }
  }
  const nextResponsive: Responsive = {};
  for (const name of LAYERS) {
    const layer = { ...target.responsive?.[name] } as Record<string, unknown>;
    if (Object.keys(responsive[name]).length) layer[axis] = responsive[name];
    else delete layer[axis];
    if (Object.keys(layer).length)
      nextResponsive[name] = layer as NodeResponsiveLayer;
  }
  return {
    base: { ...target.base, [axis]: nonEmpty(base) },
    responsive: nonEmpty(nextResponsive),
  };
}

/** The instance's whole `fillSizing` cascade onto the target's (base and layers, replaced). */
function matchFillSizing(
  target: { fillSizing?: NodeEntry["fillSizing"]; responsive?: Responsive },
  instance: { fillSizing?: NodeEntry["fillSizing"]; responsive?: Responsive },
): { fillSizing?: NodeEntry["fillSizing"]; responsive?: Responsive } {
  // (Without a base write the instance's layer fill sizing is not read — `resolver.ts`.)
  if (!instance.fillSizing) return target;
  const responsive: Responsive = {};
  for (const name of LAYERS) {
    const layer = { ...target.responsive?.[name] } as Record<string, unknown>;
    const incoming = instance.responsive?.[name]?.fillSizing;
    if (incoming) layer.fillSizing = incoming;
    else delete layer.fillSizing;
    if (Object.keys(layer).length)
      responsive[name] = layer as NodeResponsiveLayer;
  }
  return { fillSizing: instance.fillSizing, responsive: nonEmpty(responsive) };
}

/** State rules merged state by state, the instance's keys winning. */
function mergeStateRules(
  under: StateRules | undefined,
  over: StateRules | undefined,
): StateRules | undefined {
  if (!over) return under;
  const rules: Record<string, Record<string, WriteValue<AuthoredValue>>> = {
    ...(under as Record<string, Record<string, WriteValue<AuthoredValue>>>),
  };
  for (const [state, writes] of Object.entries(over))
    rules[state] = { ...rules[state], ...writes };
  return nonEmpty(rules) as StateRules | undefined;
}

/**
 * The visibility an instance root and its origin root give together, as one map: the position is
 * drawn where both say so (`resolveOwned` reads the instance's, the root position the origin's).
 * Entries a smaller breakpoint's fallback already gives are left out.
 */
function andVisibility(
  instance: NodeEntry["visibility"],
  origin: NodeEntry["visibility"],
): NodeEntry["visibility"] {
  const next: Partial<Record<BreakpointName, boolean>> = {};
  for (const breakpoint of BREAKPOINTS) {
    const shown =
      catalogNodeVisibleAt({ visibility: instance }, breakpoint) &&
      catalogNodeVisibleAt({ visibility: origin }, breakpoint);
    if (catalogNodeVisibleAt({ visibility: next }, breakpoint) !== shown)
      next[breakpoint] = shown;
  }
  return nonEmpty(next);
}

/** A patch's field writes without its structure (`kind` · `address` · `childIds`). */
function fieldsOf(
  override: DescendantOverride | undefined,
): DescendantPatchFields | undefined {
  const fields = descendantPatchOf(override);
  if (!fields) return undefined;
  const { address: _address, ...rest } = fields as DescendantPatchFields & {
    address: InstanceAddress;
    kind?: unknown;
    childIds?: unknown;
  };
  delete (rest as { kind?: unknown }).kind;
  delete (rest as { childIds?: unknown }).childIds;
  return nonEmpty(rest as DescendantPatchFields);
}

/** The node with a position's field writes pushed onto it (its own value afterwards). */
function pushFieldsOntoNode(
  node: NodeEntry,
  fields: DescendantPatchFields,
  /** Root push: the root's `sizing` · `layout` stay the instance's (decision 3). */
  axes: readonly Axis[] = AXES,
): NodeEntry {
  let layered: Layered = {
    base: { visual: node.visual, layout: node.layout, sizing: node.sizing },
    responsive: node.responsive,
  };
  for (const axis of axes)
    layered = matchAxis(
      layered,
      {
        base: { [axis]: fields[axis] as Writes | undefined },
        responsive: fields.responsive,
      },
      axis,
    );
  const paint = matchFillSizing(
    { fillSizing: node.fillSizing, responsive: layered.responsive },
    { fillSizing: fields.fillSizing, responsive: fields.responsive },
  );
  const next: NodeEntry = {
    ...node,
    props: { ...node.props, ...fields.props },
    visual: (layered.base.visual ?? {}) as NodeEntry["visual"],
    sizing: (layered.base.sizing ?? {}) as NodeEntry["sizing"],
  };
  const record = next as unknown as Record<string, unknown>;
  const set = (key: string, value: unknown) => {
    if (value === undefined) delete record[key];
    else record[key] = value;
  };
  set("layout", layered.base.layout);
  set("responsive", pruneResponsive(paint.responsive));
  set("fillSizing", paint.fillSizing);
  if (fields.fills) set("fills", fields.fills);
  if (fields.stateRules)
    set("stateRules", mergeStateRules(node.stateRules, fields.stateRules));
  if (fields.enabled !== undefined)
    set("enabled", fields.enabled === false ? false : undefined);
  if (fields.visibility) set("visibility", fields.visibility);
  return next;
}

/** The instance root's own writes as a position's fields (decision 3: no `sizing` · `layout`). */
function rootFields(instance: NodeEntry): DescendantPatchFields {
  const responsive: Responsive = {};
  for (const name of LAYERS) {
    const layer = instance.responsive?.[name];
    if (!layer) continue;
    const kept: NodeResponsiveLayer = {
      ...(layer.visual ? { visual: layer.visual } : {}),
      ...(layer.fillSizing ? { fillSizing: layer.fillSizing } : {}),
    };
    if (Object.keys(kept).length) responsive[name] = kept;
  }
  return {
    ...(nonEmpty(instance.props) ? { props: instance.props } : {}),
    ...(nonEmpty(instance.visual) ? { visual: instance.visual } : {}),
    ...(instance.fills ? { fills: instance.fills } : {}),
    ...(instance.fillSizing ? { fillSizing: instance.fillSizing } : {}),
    ...(nonEmpty(instance.stateRules)
      ? { stateRules: instance.stateRules }
      : {}),
    ...(nonEmpty(responsive) ? { responsive } : {}),
  };
}

/** The instance root with its pushed (or reset) own fields gone; `sizing` · `layout` layers stay. */
function clearedRoot(instance: NodeEntry): NodeEntry {
  const responsive: Responsive = {};
  for (const name of LAYERS) {
    const layer = instance.responsive?.[name];
    if (!layer) continue;
    const kept: NodeResponsiveLayer = {
      ...(layer.layout ? { layout: layer.layout } : {}),
      ...(layer.sizing ? { sizing: layer.sizing } : {}),
    };
    if (Object.keys(kept).length) responsive[name] = kept;
  }
  const {
    fills: _fills,
    fillSizing: _fillSizing,
    stateRules: _stateRules,
    visibility: _visibility,
    responsive: _responsive,
    ...rest
  } = instance;
  return {
    ...rest,
    props: {},
    visual: {},
    ...(nonEmpty(responsive) ? { responsive } : {}),
  };
}

/** The override list with a position's field writes gone (a slot keeps its list). */
function withoutFields(
  overrides: readonly DescendantOverride[],
): DescendantOverride[] {
  return overrides.flatMap((item): DescendantOverride[] =>
    item.kind === "replace"
      ? [item]
      : item.kind === "fillSlot"
        ? [{ kind: "fillSlot", address: item.address, childIds: item.childIds }]
        : [],
  );
}

/** ADR-281 — the interaction ids an override list's `interactions` maps name as replacements. */
function replacementRules(overrides: readonly DescendantOverride[]): string[] {
  return overrides.flatMap((item) =>
    Object.values(descendantPatchOf(item)?.interactions ?? {}).filter(
      (value) => value !== "off",
    ),
  );
}

/** Drop interaction entries (and their project order slots). */
function removeRules(draft: CommandDraft, ids: readonly string[]): void {
  const gone = new Set(ids.filter((id) => draft.read(id)?.kind === "interaction"));
  if (!gone.size) return;
  for (const id of gone) draft.remove(id);
  const project = draft.project();
  draft.write({
    ...project,
    interactionIds: project.interactionIds.filter((id) => !gone.has(id)),
  });
}

/**
 * Push an instance's overrides onto its component's origin (one history step). Refused on a node
 * that is not a composite instance (`NOT_AN_INSTANCE`).
 */
export const pushInstanceOverrides =
  (input: { id: NodeId; newId: NewId; label?: string }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const instance = draft.node(input.id);
    const definition = definitionOf(reader, instance);
    if (
      !definition ||
      ("kind" in definition && definition.kind !== "definition") ||
      definition.mode !== "composite" ||
      !definition.templateRootId
    )
      return fail("NOT_AN_INSTANCE", input.id);
    const label = input.label ?? "Push changes to component";
    if (instance.definitionId.startsWith("lib:"))
      return {
        label,
        ops: pushLibraryDefaults(draft, instance, input.newId),
      };
    const rootId = (definition as DefinitionEntry).templateRootId!;
    const root = draft.node(rootId);
    // 1. The root's own fields: component property values go to the nodes they drive, the rest to
    //    the origin root (its `visibility` and the root's together).
    const properties = componentPropertiesOf(definition);
    const propertyKeys = new Set((properties ?? []).map((item) => item.key));
    const own = rootFields(instance);
    const rootProps = Object.fromEntries(
      Object.entries(own.props ?? {}).filter(([key]) => !propertyKeys.has(key)),
    );
    for (const [targetId, write] of componentPropertyWrites(
      properties,
      (key) => {
        const value = instance.props[key];
        return value?.kind === "set" ? value.value : undefined;
      },
    )) {
      const target = draft.node(targetId);
      const next = { ...target, props: { ...target.props } } as NodeEntry & {
        props: Record<string, WriteValue<AuthoredValue>>;
      };
      for (const [prop, value] of Object.entries(write.props ?? {}))
        next.props[prop] = { kind: "set", value };
      if (write.enabled !== undefined) {
        if (write.enabled === false) next.enabled = false;
        else delete (next as { enabled?: boolean }).enabled;
      }
      draft.write(next);
    }
    const rootNow = { ...draft.node(rootId) } as NodeEntry & {
      visibility?: NodeEntry["visibility"];
    };
    if (instance.visibility) {
      const together = andVisibility(instance.visibility, root.visibility);
      if (together) rootNow.visibility = together;
      else delete rootNow.visibility;
    }
    draft.write(
      pushFieldsOntoNode(rootNow, { ...own, props: rootProps }, ["visual"]),
    );
    // ADR-281 — a direct position's replaced rules become the origin's; its "off" entries and a
    // nested position's map stay the instance's (re-added in 3).
    const keptRules: { address: InstanceAddress; map: Record<string, string> }[] =
      [];
    const pushedRules: string[] = [];
    for (const override of instance.descendantOverrides) {
      const map = descendantPatchOf(override)?.interactions;
      if (!map) continue;
      const kept: Record<string, string> = {};
      for (const [ruleId, value] of Object.entries(map)) {
        const origin = draft.read(ruleId);
        const replacement = value === "off" ? undefined : draft.read(value);
        if (
          override.address.instances.length === 1 &&
          origin?.kind === "interaction" &&
          replacement?.kind === "interaction"
        ) {
          draft.write({
            ...origin,
            trigger: replacement.trigger,
            actions: replacement.actions,
          });
          pushedRules.push(value);
        } else kept[ruleId] = value;
      }
      if (Object.keys(kept).length)
        keptRules.push({ address: override.address, map: kept });
    }
    removeRules(draft, pushedRules);
    // 2. Each position: a direct one onto its template node, a nested one onto the nested
    //    instance's own override at the shortened address.
    for (const override of instance.descendantOverrides) {
      const withRules = fieldsOf(override);
      const { interactions: _rules, ...rest } = withRules ?? {};
      const fields = withRules ? (nonEmpty(rest) ?? undefined) : undefined;
      if (!fields) continue;
      const { instances, templatePath } = override.address;
      if (instances.length === 1) {
        const targetId = templatePath[templatePath.length - 1];
        if (!targetId.startsWith("project:node:"))
          return fail("PUSH_TARGET_NOT_PROJECT", targetId);
        draft.write(pushFieldsOntoNode(draft.node(targetId), fields));
        continue;
      }
      const ownerId = instances[1];
      if (!ownerId.startsWith("project:node:"))
        return fail("PUSH_TARGET_NOT_PROJECT", ownerId);
      const owner = draft.node(ownerId);
      const address: InstanceAddress = {
        instances: instances.slice(1),
        templatePath,
      };
      const index = owner.descendantOverrides.findIndex(
        (item) =>
          item.address.instances.length === address.instances.length &&
          item.address.templatePath.length === address.templatePath.length &&
          item.address.instances.every(
            (id, at) => id === address.instances[at],
          ) &&
          item.address.templatePath.every(
            (id, at) => id === address.templatePath[at],
          ),
      );
      const existing =
        index >= 0 ? owner.descendantOverrides[index] : undefined;
      if (existing?.kind === "replace")
        return fail("PUSH_TARGET_REPLACED", ownerId);
      const merged = layerPatchFields(fieldsOf(existing) ?? {}, fields);
      const next: DescendantOverride =
        existing?.kind === "fillSlot"
          ? {
              ...merged,
              kind: "fillSlot",
              address,
              childIds: existing.childIds,
            }
          : { ...merged, kind: "patch", address };
      const overrides = [...owner.descendantOverrides];
      if (index >= 0) overrides[index] = next;
      else overrides.push(next);
      draft.write({ ...owner, descendantOverrides: overrides });
    }
    // 3. The instance keeps only what stays its own (its rules turned off — ADR-281).
    const remaining = withoutFields(instance.descendantOverrides);
    for (const { address, map } of keptRules) {
      const index = remaining.findIndex((item) =>
        sameAddress(item.address, address),
      );
      const interactions = map as DescendantPatchFields["interactions"];
      if (index < 0) remaining.push({ kind: "patch", address, interactions });
      else if (remaining[index]!.kind === "fillSlot")
        remaining[index] = { ...remaining[index]!, interactions } as DescendantOverride;
    }
    draft.write({
      ...clearedRoot(draft.node(input.id)),
      descendantOverrides: remaining,
    });
    return { label, ops: draft.ops() };
  };

/**
 * Decision 1 — a library origin's instance pushes its root `props` · `visual` as the project's
 * defaults for that definition (the Library page's root edit); positions stay the instance's.
 */
function pushLibraryDefaults(
  draft: CommandDraft,
  instance: NodeEntry,
  newId: NewId,
): CatalogOperation[] {
  const definitionId = instance.definitionId as LibraryDefinitionId;
  const project = draft.project();
  let overrideId = project.overrideIds.find((id) => {
    const entry = draft.read(id);
    return (
      entry?.kind === "definitionOverride" && entry.targetId === definitionId
    );
  });
  if (!overrideId) {
    overrideId = newId("definitionOverride");
    const entry: DefinitionOverrideEntry = {
      kind: "definitionOverride",
      id: overrideId,
      targetId: definitionId,
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
  const writes: CatalogOperation[] = [];
  for (const [key, write] of Object.entries(instance.props))
    writes.push({
      kind: "patchDefinitionOverride",
      id: overrideId,
      scope: "defaults",
      key,
      write,
    });
  for (const [key, write] of Object.entries(instance.visual))
    if (write)
      writes.push({
        kind: "patchDefinitionOverride",
        id: overrideId,
        scope: "visual",
        key,
        write,
      });
  draft.write({ ...instance, props: {}, visual: {} });
  return [...draft.ops(), ...writes];
}

/**
 * Reset every override of an instance (one history step): the root's `props` · `visual` · `fills`
 * · `fillSizing` · `stateRules` · `responsive` (its `visual` · `fillSizing` layers) · `visibility`,
 * every position's field writes, and every swap (folded back). Slot contents, `placement`,
 * `sizing` and `layout` stay (user decisions 2 · 3).
 */
export const resetInstance =
  (input: { id: NodeId; label?: string }): CatalogCommand =>
  (reader) => {
    const instance = reader.getEntry(input.id);
    if (instance?.kind !== "node") return fail("NODE_REQUIRED", input.id);
    const definition = definitionOf(reader, instance);
    if (
      !definition ||
      ("kind" in definition && definition.kind !== "definition") ||
      definition.mode !== "composite"
    )
      return fail("NOT_AN_INSTANCE", input.id);
    const stage = stageOver(reader);
    const ops: CatalogCommandPlan["ops"][number][] = [];
    // Swaps first (ADR-261 Phase 5): each folds back into the instance's overrides, which the
    // field reset below then drops. A fold-back hands the replacement's own swaps to the instance
    // (`lowerPosition`), so the list is read again until no swap is left (review Round 3 m1).
    const folded = new Set<NodeId>();
    for (;;) {
      const swap = (
        stage.getEntry(input.id) as NodeEntry
      ).descendantOverrides.find(
        (item) => item.kind === "replace" && !folded.has(item.replacementId),
      );
      if (swap?.kind !== "replace") break;
      folded.add(swap.replacementId);
      const planned = resetReplacement({ id: swap.replacementId })(stage);
      stage.apply(planned.ops);
      ops.push(...planned.ops);
    }
    const draft = new CommandDraft(stage);
    const current = draft.node(input.id);
    // ADR-281 — the instance's replacement rules go with its `interactions` maps (a fresh
    // instance runs the origin's rules).
    removeRules(draft, replacementRules(current.descendantOverrides));
    draft.write({
      ...clearedRoot(current),
      descendantOverrides: withoutFields(current.descendantOverrides),
    });
    return {
      label: input.label ?? "Reset all changes",
      ops: [...ops, ...draft.ops()],
    };
  };

/** One override row of the Component section's list (ADR-262 Phase 2 — the kinds the list shows). */
export interface ResetOverrideFieldInput {
  target: EditTarget;
  field:
    | "fills"
    | "fillSizing"
    | "visibility"
    | "enabled"
    | "stateRules"
    | "responsive";
  /** `stateRules`: the state; `responsive`: the breakpoint layer. */
  state?: StateName;
  breakpoint?: ResponsiveBreakpointName;
  /** `stateRules`: the visual key; `responsive`: the `axis` key (absent = the layer's fill sizing). */
  key?: string;
  /**
   * `responsive`: the layer field the key is in (default `visual`). A position's `sizing` ·
   * `layout` layers are its overrides; the root's are its placement and stay (review Round 3 m2).
   */
  axis?: Axis;
  label?: string;
}

/**
 * Reset one override of a kind the per-key commands do not reach — a root's or a position's whole
 * field (`fills` · `fillSizing` · `visibility` · `enabled`), one state rule key, or one breakpoint
 * layer key (the Component section's rows — Figma 「Reset [property]」).
 */
export const resetOverrideField =
  (input: ResetOverrideFieldInput): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const label = input.label ?? "Reset override";
    const strip = (fields: DescendantPatchFields): DescendantPatchFields => {
      const next = { ...fields } as Record<string, unknown>;
      if (input.field === "stateRules") {
        const rules = { ...fields.stateRules } as Record<
          string,
          Record<string, WriteValue<AuthoredValue>>
        >;
        const state = input.state ?? fail("STATE_REQUIRED", label);
        const writes = { ...rules[state] };
        if (input.key) delete writes[input.key];
        if (input.key && Object.keys(writes).length) rules[state] = writes;
        else delete rules[state];
        if (Object.keys(rules).length) next.stateRules = rules;
        else delete next.stateRules;
      } else if (input.field === "responsive") {
        const name = input.breakpoint ?? fail("RESPONSIVE_BREAKPOINT", label);
        const responsive = { ...fields.responsive } as Record<
          string,
          NodeResponsiveLayer
        >;
        const layer = { ...responsive[name] } as Record<string, unknown>;
        if (input.key) {
          const axis = input.axis ?? "visual";
          const writes = { ...(layer[axis] as Writes | undefined) };
          delete writes[input.key];
          if (Object.keys(writes).length) layer[axis] = writes;
          else delete layer[axis];
        } else delete layer.fillSizing;
        if (Object.keys(layer).length)
          responsive[name] = layer as NodeResponsiveLayer;
        else delete responsive[name];
        if (Object.keys(responsive).length) next.responsive = responsive;
        else delete next.responsive;
      } else delete next[input.field];
      return next as DescendantPatchFields;
    };
    if (input.target.kind === "node") {
      const node = draft.node(input.target.id);
      const { props, visual, sizing, ...rest } = strip(
        node as unknown as DescendantPatchFields,
      ) as unknown as NodeEntry;
      draft.write({ ...rest, props, visual, sizing } as NodeEntry);
      return { label, ops: draft.ops() };
    }
    const owner = draft.node(input.target.ownerId);
    const address = input.target.address;
    const index = owner.descendantOverrides.findIndex((item) =>
      sameAddress(item.address, address),
    );
    const current = index >= 0 ? owner.descendantOverrides[index] : undefined;
    if (!current || current.kind === "replace")
      return fail("OVERRIDE_NOT_FOUND", owner.id);
    const fields = strip(fieldsOf(current) ?? {});
    const overrides = [...owner.descendantOverrides];
    const next: DescendantOverride | undefined =
      current.kind === "fillSlot"
        ? { ...fields, kind: "fillSlot", address, childIds: current.childIds }
        : Object.keys(fields).length
          ? { ...fields, kind: "patch", address }
          : undefined;
    if (next) overrides[index] = next;
    else overrides.splice(index, 1);
    draft.write({ ...owner, descendantOverrides: overrides });
    return { label, ops: draft.ops() };
  };
