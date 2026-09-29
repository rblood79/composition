import type {
  DescendantOverride,
  EntryId,
  EntryKind,
  InstanceAddress,
  InteractionEntry,
  LayoutWrites,
  LibraryTemplateNode,
  NodeEntry,
  NodeId,
  PropWrites,
  Scalar,
  TemplateId,
  VisualWrites,
} from "../document/types";
import {
  childList,
  fail,
  sameAddress,
  setChildList,
  type CommandDraft,
  type NodeParent,
} from "./context";

/** The caller's ID allocator: commands never invent IDs. */
export type NewId = <K extends EntryKind>(kind: K) => EntryId<K>;

const TEMPLATE_BINDING = /\{[a-zA-Z][a-zA-Z0-9_-]*\}/;
const TEMPLATE_BINDINGS = /\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g;
const WHOLE_TEMPLATE_BINDING = /^\{([a-zA-Z][a-zA-Z0-9_-]*)\}$/;
/** A composite's values for its template's `{key}` placeholders (detach freezes them). */
export type TemplateBindings = Readonly<Record<string, Scalar>>;
/** The resolver's `{key}` binding (whole value keeps its type; unbound keys stay placeholders). */
function bindProps(props: PropWrites, bindings: TemplateBindings): PropWrites {
  const out: Record<string, PropWrites[string]> = {};
  for (const [key, write] of Object.entries(props)) {
    if (
      write.kind !== "set" ||
      typeof write.value !== "string" ||
      !write.value.includes("{")
    ) {
      out[key] = write;
      continue;
    }
    const value = write.value;
    const whole = WHOLE_TEMPLATE_BINDING.exec(value);
    out[key] = {
      kind: "set",
      value: whole
        ? Object.hasOwn(bindings, whole[1])
          ? bindings[whole[1]]
          : value
        : value.replace(TEMPLATE_BINDINGS, (placeholder, name: string) =>
            Object.hasOwn(bindings, name)
              ? String(bindings[name])
              : placeholder,
          ),
    };
  }
  return out;
}
const sets = <T>(
  values: Readonly<Record<string, T>> | undefined,
): Record<string, { kind: "set"; value: T }> =>
  Object.fromEntries(
    Object.entries(values ?? {}).map(([key, value]) => [
      key,
      { kind: "set" as const, value },
    ]),
  );
const startsWith = (
  list: readonly string[],
  prefix: readonly string[],
): boolean =>
  list.length >= prefix.length &&
  prefix.every((id, index) => list[index] === id);

type TemplateView = Pick<
  LibraryTemplateNode,
  "definitionId" | "children" | "slot" | "enabled" | "stateRules"
> & {
  props: PropWrites;
  visual: VisualWrites;
  layout?: LayoutWrites;
  sizing?: NodeEntry["sizing"];
  /** A project template node's own fields that an owned copy keeps. */
  extra?: Partial<NodeEntry>;
  /** Library patches this template node applies to its own composite template. */
  descendantPatches?: LibraryTemplateNode["descendantPatches"];
  /** A project template node's own descendant overrides (they start at the template node). */
  overrides?: readonly DescendantOverride[];
  hasBinding: boolean;
  displayState?: LibraryTemplateNode["displayState"];
};

function readTemplate(draft: CommandDraft, id: TemplateId): TemplateView {
  if (id.startsWith("lib:")) {
    const node = draft.reader.library.templates.get(
      id as `lib:template:${string}`,
    );
    if (!node) return fail("DANGLING_TEMPLATE", id);
    return {
      definitionId: node.definitionId,
      children: node.children,
      slot: node.slot,
      enabled: node.enabled,
      stateRules: node.stateRules,
      props: sets(node.props) as PropWrites,
      visual: sets(node.visual) as VisualWrites,
      ...(node.layout ? { layout: sets(node.layout) as LayoutWrites } : {}),
      descendantPatches: node.descendantPatches,
      hasBinding: Object.values(node.props).some(
        (value) => typeof value === "string" && TEMPLATE_BINDING.test(value),
      ),
      displayState: node.displayState,
    };
  }
  const node = draft.node(id);
  const {
    kind: _kind,
    id: _id,
    children,
    descendantOverrides,
    definitionId,
    props,
    visual,
    sizing,
    layout,
    slot,
    enabled,
    stateRules,
    ...extra
  } = structuredClone(node);
  return {
    definitionId,
    children: children as readonly TemplateId[] as never,
    slot,
    enabled,
    stateRules,
    props,
    visual,
    sizing,
    ...(layout ? { layout } : {}),
    extra,
    overrides: descendantOverrides,
    hasBinding: Object.values(props).some(
      (write) =>
        write.kind === "set" &&
        typeof write.value === "string" &&
        TEMPLATE_BINDING.test(write.value),
    ),
  };
}

type Patch = Extract<DescendantOverride, { kind: "patch" }>;
function applyPatch(entry: NodeEntry, patch: Patch): NodeEntry {
  const next = { ...entry } as Record<string, unknown> & NodeEntry;
  const merge = (key: "props" | "visual" | "sizing" | "layout") => {
    const writes = patch[key];
    if (!writes) return;
    const merged: Record<string, unknown> = { ...next[key] };
    for (const [field, write] of Object.entries(writes))
      if (write.kind === "remove") delete merged[field];
      else merged[field] = write;
    next[key] = merged as never;
  };
  merge("props");
  merge("visual");
  merge("sizing");
  merge("layout");
  for (const key of [
    "fills",
    "fillSizing",
    "responsive",
    "visibility",
  ] as const)
    if (patch[key] !== undefined)
      next[key] = structuredClone(patch[key]) as never;
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.stateRules)
    next.stateRules = {
      ...next.stateRules,
      ...structuredClone(patch.stateRules),
    };
  return next;
}

export interface Materializer {
  /** Owned copy of the template position at `path` (at the owner's instance level). */
  node(path: readonly TemplateId[], fixedId?: NodeId): NodeId;
  /** The owner's overrides that stay: not absorbed and not under the `prefix` position. */
  remainingOverrides(prefix: readonly TemplateId[]): DescendantOverride[];
  /** The owner's interactions addressing a copied position now belong to the copy. */
  reanchorInteractions(): void;
}

/**
 * Copies an instance's template positions into owned nodes that show what the instance showed:
 * the template values, the enclosing library patches, and the owner's patch / replace / fillSlot
 * / nested-instance overrides at those positions. A `{key}` template binding needs `bindings`
 * (detach freezes the composite's values); without them, and for a display state (an owned node
 * has no display state), it fails explicitly.
 */
export function createMaterializer(
  draft: CommandDraft,
  ownerId: NodeId,
  instances: InstanceAddress["instances"],
  newId: NewId,
  bindings?: TemplateBindings,
): Materializer {
  const owner = draft.node(ownerId);
  const consumed = new Set<DescendantOverride>();
  /** Template path (at the owner's instance level) → the owned node now standing there. */
  const placed = new Map<string, NodeId>();
  const key = (path: readonly string[]) => path.join("\0");
  // Library patches of the nested template step the position sits in (the resolver's `patches`).
  const enclosing =
    instances.length > 1
      ? readTemplate(draft, instances[instances.length - 1] as TemplateId)
          .descendantPatches
      : undefined;
  const overrideAt = (address: InstanceAddress) =>
    owner.descendantOverrides.find((item) =>
      sameAddress(item.address, address),
    );

  const materialize = (
    path: readonly TemplateId[],
    fixedId?: NodeId,
  ): NodeId => {
    const address = { instances, templatePath: path };
    const change = overrideAt(address);
    if (change) consumed.add(change);
    if (change?.kind === "replace") {
      if (fixedId) fail("POSITION_REPLACED", path[path.length - 1]);
      placed.set(key(path), change.replacementId);
      return change.replacementId;
    }
    const templateId = path[path.length - 1];
    const template = readTemplate(draft, templateId);
    if (template.hasBinding && !bindings)
      fail("POSITION_HAS_TEMPLATE_BINDING", templateId);
    if (template.displayState) fail("POSITION_HAS_DISPLAY_STATE", templateId);
    const id = fixedId ?? newId("node");
    placed.set(key(path), id);
    let entry: NodeEntry = {
      ...(template.extra as object),
      kind: "node",
      id,
      definitionId: template.definitionId,
      children: [],
      props: bindings ? bindProps(template.props, bindings) : template.props,
      visual: template.visual,
      sizing: template.sizing ?? {},
      descendantOverrides: (template.overrides ?? []).map((item) => ({
        ...item,
        address: {
          ...item.address,
          instances: [id, ...item.address.instances.slice(1)],
        },
      })),
      ...(template.layout ? { layout: template.layout } : {}),
      ...(template.slot ? { slot: template.slot } : {}),
      ...(template.enabled !== undefined ? { enabled: template.enabled } : {}),
      ...(template.stateRules ? { stateRules: template.stateRules } : {}),
    };
    const libraryPatch = enclosing?.find((item) =>
      sameAddress(
        { instances: [], templatePath: item.templatePath },
        { instances: [], templatePath: path },
      ),
    );
    if (libraryPatch)
      entry = applyPatch(entry, {
        kind: "patch",
        address,
        ...(libraryPatch.props
          ? { props: sets(libraryPatch.props) as PropWrites }
          : {}),
        ...(libraryPatch.visual
          ? { visual: sets(libraryPatch.visual) as VisualWrites }
          : {}),
        ...(libraryPatch.layout
          ? { layout: sets(libraryPatch.layout) as LayoutWrites }
          : {}),
        ...(libraryPatch.enabled !== undefined
          ? { enabled: libraryPatch.enabled }
          : {}),
      });
    // This template node's own library patches reach into its composite template: they become
    // the owned instance's path patches.
    const ownPatches: DescendantOverride[] = (
      template.descendantPatches ?? []
    ).map((item) => ({
      kind: "patch",
      address: { instances: [id], templatePath: item.templatePath },
      ...(item.props ? { props: sets(item.props) as PropWrites } : {}),
      ...(item.visual ? { visual: sets(item.visual) as VisualWrites } : {}),
      ...(item.layout ? { layout: sets(item.layout) as LayoutWrites } : {}),
      ...(item.enabled !== undefined ? { enabled: item.enabled } : {}),
    }));
    // The owner's overrides inside this node's composite template move with it.
    const nestedPrefix = [...instances, templateId];
    const moved: DescendantOverride[] = [];
    for (const item of owner.descendantOverrides)
      if (
        item.address.instances.length > instances.length &&
        startsWith(item.address.instances, nestedPrefix)
      ) {
        consumed.add(item);
        moved.push({
          ...item,
          address: {
            instances: [
              id,
              ...item.address.instances.slice(nestedPrefix.length),
            ],
            templatePath: item.address.templatePath,
          },
        });
      }
    const overrides = [...entry.descendantOverrides];
    for (const item of [...ownPatches, ...moved]) {
      const index = overrides.findIndex((existing) =>
        sameAddress(existing.address, item.address),
      );
      if (index < 0) overrides.push(item);
      else if (overrides[index].kind === "patch" && item.kind === "patch")
        overrides[index] = mergePatches(overrides[index] as Patch, item);
      else overrides[index] = item;
    }
    entry = { ...entry, descendantOverrides: overrides };
    if (change?.kind === "patch") entry = applyPatch(entry, change);
    entry = {
      ...entry,
      children:
        change?.kind === "fillSlot"
          ? [...change.childIds]
          : template.children.map((childId) => materialize([...path, childId])),
    };
    if (fixedId) draft.write(entry);
    else draft.create(entry);
    return id;
  };

  return {
    node: materialize,
    remainingOverrides: (prefix) =>
      owner.descendantOverrides.filter(
        (item) =>
          !consumed.has(item) &&
          !(
            sameAddress(
              { instances: item.address.instances, templatePath: [] },
              { instances, templatePath: [] },
            ) &&
            item.address.templatePath.length > prefix.length &&
            startsWith(item.address.templatePath, prefix)
          ),
      ),
    reanchorInteractions: () =>
      reanchorInteractions(draft, ownerId, instances, placed),
  };
}

/**
 * ADR-248 Phase 4b: the first structural edit at an instance's template position makes the
 * template children there owned nodes (the position becomes a `fillSlot`).
 */
export function ensureChildList(
  draft: CommandDraft,
  parent: NodeParent,
  newId: NewId,
): readonly NodeId[] {
  const current = childList(draft, parent);
  if (current) return current;
  if (parent.kind !== "descendant") return fail("PARENT_REQUIRED", "parent");
  const path = parent.address.templatePath;
  const materializer = createMaterializer(
    draft,
    parent.ownerId,
    parent.address.instances,
    newId,
  );
  const ids = readTemplate(draft, path[path.length - 1]).children.map(
    (childId) => materializer.node([...path, childId]),
  );
  draft.write({
    ...draft.node(parent.ownerId),
    descendantOverrides: materializer.remainingOverrides(path),
  });
  setChildList(draft, parent, ids);
  materializer.reanchorInteractions();
  return ids;
}

function mergePatches(base: Patch, over: Patch): Patch {
  const merged = { ...base } as Record<string, unknown> & Patch;
  for (const key of ["props", "visual", "sizing", "layout"] as const)
    if (over[key]) merged[key] = { ...base[key], ...over[key] } as never;
  for (const key of [
    "fills",
    "fillSizing",
    "responsive",
    "visibility",
    "enabled",
    "stateRules",
  ] as const)
    if (over[key] !== undefined) merged[key] = over[key] as never;
  return merged;
}

/** The owner's interactions addressing a materialized position now belong to its owned copy. */
function reanchorInteractions(
  draft: CommandDraft,
  ownerId: NodeId,
  instances: InstanceAddress["instances"],
  placed: ReadonlyMap<string, NodeId>,
): void {
  for (const referrerId of draft.reader.referrersOf(ownerId)) {
    const entry = draft.read(referrerId);
    if (entry?.kind !== "interaction" || entry.ownerId !== ownerId) continue;
    const address = entry.address;
    if (!address) continue;
    let next: InteractionEntry | undefined;
    if (
      sameAddress(
        { instances: address.instances, templatePath: [] },
        {
          instances,
          templatePath: [],
        },
      )
    ) {
      const target = placed.get(address.templatePath.join("\0"));
      if (target) {
        const { address: _address, ...rest } = entry;
        next = { ...rest, ownerId: target };
      }
    } else if (
      address.instances.length > instances.length &&
      startsWith(address.instances, instances)
    ) {
      const step = address.instances[instances.length];
      for (const [path, id] of placed)
        if (path.split("\0").at(-1) === step) {
          next = {
            ...entry,
            ownerId: id,
            address: {
              instances: [id, ...address.instances.slice(instances.length + 1)],
              templatePath: address.templatePath,
            },
          };
          break;
        }
    }
    if (next) draft.write(next);
  }
}
