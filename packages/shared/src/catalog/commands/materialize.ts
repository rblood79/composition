import { componentTypeSet } from "../../domain/componentTraits";
import { ownedChildren } from "../document/graph";
import {
  mapShowWhenAddress,
  mapShowWhenAddresses,
  mapShowWhenLocal,
  mapShowWhenNodeIds,
} from "../document/stateOwnerRefs";
import { DISPLAY_STATE_PROPS } from "../resolution/resolver";
import {
  innerOwnerPlace,
  layeredOverride,
  overridesAt,
} from "../resolution/templateOwners";
import { descendantPatchOf } from "../document/types";
import {
  componentPropertiesOf,
  componentPropertyWrites,
} from "../document/componentProperties";
import type {
  CatalogReader,
  DefinitionEntry,
  DefinitionId,
  DescendantOverride,
  DescendantPatchFields,
  EntryId,
  EntryKind,
  InstanceAddress,
  InteractionEntry,
  LayoutWrites,
  LibraryDefinitionId,
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
  definitionTypeName,
  listParent,
  fail,
  overrideAt,
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
  | "definitionId"
  | "children"
  | "slot"
  | "enabled"
  | "stateRules"
  | "presentWhen"
  | "showWhen"
> & {
  props: PropWrites;
  visual: VisualWrites;
  layout?: LayoutWrites;
  sizing?: NodeEntry["sizing"];
  /** A project template node's own fields that an owned copy keeps. */
  extra?: Partial<NodeEntry>;
  /** Library patches this template node applies to its own composite template. */
  descendantPatches?: LibraryTemplateNode["descendantPatches"];
  /** Children this template node places at slot positions of its composite template. */
  slotFills?: LibraryTemplateNode["slotFills"];
  /** A project template node's own descendant overrides (they start at the template node). */
  overrides?: readonly DescendantOverride[];
  hasBinding: boolean;
  displayState?: LibraryTemplateNode["displayState"];
};

export function readTemplate(
  draft: CommandDraft,
  id: TemplateId,
): TemplateView {
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
      presentWhen: node.presentWhen,
      showWhen: node.showWhen,
      stateRules: node.stateRules,
      props: sets(node.props) as PropWrites,
      visual: sets(node.visual) as VisualWrites,
      ...(node.layout ? { layout: sets(node.layout) as LayoutWrites } : {}),
      descendantPatches: node.descendantPatches,
      slotFills: node.slotFills,
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
    presentWhen,
    showWhen,
    displayState,
    ...extra
  } = structuredClone(node);
  return {
    definitionId,
    children: children as readonly TemplateId[] as never,
    slot,
    enabled,
    presentWhen,
    showWhen,
    stateRules,
    props,
    visual,
    sizing,
    ...(layout ? { layout } : {}),
    extra,
    overrides: descendantOverrides,
    ...(displayState ? { displayState } : {}),
    hasBinding: Object.values(props).some(
      (write) =>
        write.kind === "set" &&
        typeof write.value === "string" &&
        TEMPLATE_BINDING.test(write.value),
    ),
  };
}

type Patch = Extract<DescendantOverride, { kind: "patch" }>;
function applyPatch(entry: NodeEntry, patch: DescendantPatchFields): NodeEntry {
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
  /**
   * The owner's overrides that stay: not absorbed and not under the `prefix` position (no
   * `prefix`: only the absorbed ones go).
   */
  remainingOverrides(prefix?: readonly TemplateId[]): DescendantOverride[];
  /** The owner's interactions addressing a copied position now belong to the copy. */
  reanchorInteractions(): void;
}

/**
 * Copies an instance's template positions into owned nodes that show what the instance showed:
 * the template values, the enclosing library patches, and the owner's patch / replace / fillSlot
 * / nested-instance overrides at those positions. A `{key}` template binding needs `bindings`
 * (detach freezes the composite's values); without them it fails explicitly. An owned node has no
 * display state: a position's (a state origin's root — the palette Checkbox shows `selected`)
 * becomes the accepted props it stands for (`isSelected: true`, the resolver's
 * `DISPLAY_STATE_PROPS`), so the copy shows what the instance showed (ADR-256 후속 7).
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
  /** Template node → the owned node now standing there (a project template node's own id). */
  const placedByTemplate = new Map<string, NodeId>();
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
  // ADR-261 Decision 4: the copies keep what the instance's component properties show there — the
  // values of the composite position whose template this is (the owner's, or a nested instance's
  // own values under the owner's patch at it).
  const propertyWrites = (() => {
    const step = instances[instances.length - 1];
    const scope =
      instances.length === 1 ? owner : (draft.read(step) as NodeEntry | undefined);
    if (scope?.kind !== "node" || !scope.definitionId.startsWith("project:"))
      return undefined;
    const properties = componentPropertiesOf(draft.read(scope.definitionId));
    if (!properties) return undefined;
    const values: PropWrites = { ...scope.props };
    if (instances.length > 1)
      Object.assign(
        values,
        descendantPatchOf(
          owner.descendantOverrides.find(
            (item) =>
              item.address.templatePath[item.address.templatePath.length - 1] ===
                step &&
              sameAddress(
                { instances: item.address.instances, templatePath: [] },
                { instances: instances.slice(0, -1) as never, templatePath: [] },
              ),
          ),
        )?.props,
      );
    return componentPropertyWrites(properties, (key) => {
      const write = values[key];
      return write?.kind === "set" ? write.value : undefined;
    });
  })();

  /** Rewrite the instance addresses in the conditions of the subtrees of `childIds`. */
  const remapAddresses = (
    childIds: readonly NodeId[],
    map: (address: InstanceAddress) => InstanceAddress,
  ): void => {
    const stack = [...childIds];
    while (stack.length) {
      const entry = draft.read(stack.pop()!);
      if (entry?.kind !== "node") continue;
      if (entry.showWhen) {
        const showWhen = mapShowWhenAddresses(entry.showWhen, map);
        if (JSON.stringify(showWhen) !== JSON.stringify(entry.showWhen))
          draft.write({ ...entry, showWhen });
      }
      stack.push(...ownedChildren(entry));
    }
  };
  /**
   * ADR-256 §1-1: the owner's slot children stay its nodes, but an address of a position of this
   * instance in their conditions becomes that position's new node (placed above them).
   */
  const remapSlotChildren = (childIds: readonly NodeId[]): NodeId[] => {
    const stack = [...childIds];
    while (stack.length) {
      const entry = draft.read(stack.pop()!);
      if (entry?.kind !== "node") continue;
      if (entry.showWhen) {
        const showWhen = mapShowWhenAddress(entry.showWhen, (address) =>
          sameAddress(
            { instances: address.instances as never, templatePath: [] },
            { instances, templatePath: [] },
          )
            ? placed.get(key(address.templatePath))
            : undefined,
        );
        if (JSON.stringify(showWhen) !== JSON.stringify(entry.showWhen))
          draft.write({ ...entry, showWhen });
      }
      stack.push(...ownedChildren(entry));
    }
    return [...childIds];
  };
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
      placedByTemplate.set(path[path.length - 1], change.replacementId);
      // ADR-261 Phase 5 (Codex M1): the resolver shows a replacement by its own show / hide, else a
      // visibility property's value, else the position's origin value — once copied the property
      // no longer reaches it, so that value is kept on the node.
      const replacement = draft.node(change.replacementId);
      if (replacement.enabled === undefined) {
        const templateId = path[path.length - 1];
        const shown =
          propertyWrites?.get(templateId)?.enabled ??
          (templateId.startsWith("lib:")
            ? undefined
            : readTemplate(draft, templateId).enabled);
        if (shown !== undefined)
          draft.write({ ...replacement, enabled: shown });
      }
      return change.replacementId;
    }
    const templateId = path[path.length - 1];
    const template = readTemplate(draft, templateId);
    if (template.hasBinding && !bindings)
      fail("POSITION_HAS_TEMPLATE_BINDING", templateId);
    const id = fixedId ?? newId("node");
    placed.set(key(path), id);
    placedByTemplate.set(templateId, id);
    let entry: NodeEntry = {
      ...(template.extra as object),
      kind: "node",
      id,
      definitionId: template.definitionId,
      children: [],
      props: withDisplayState(
        draft,
        template,
        bindings ? bindProps(template.props, bindings) : template.props,
      ),
      visual: template.visual,
      sizing: template.sizing ?? {},
      // (A project template node's own overrides follow below, after the owner's moved ones.)
      descendantOverrides: [],
      ...(template.layout ? { layout: template.layout } : {}),
      ...(template.slot ? { slot: template.slot } : {}),
      ...(template.enabled !== undefined ? { enabled: template.enabled } : {}),
      ...(template.stateRules ? { stateRules: template.stateRules } : {}),
      ...(template.presentWhen ? { presentWhen: template.presentWhen } : {}),
      // ADR-256 §1-1: a reference to a position of this origin becomes that position's new node.
      ...(template.showWhen
        ? {
            showWhen: mapShowWhenNodeIds(
              mapShowWhenLocal(
                template.showWhen,
                (templatePath) => placed.get(key(templatePath)),
                // (Through a nested instance placed here: its owned instance's address.)
                (templateId) => placedByTemplate.get(templateId),
              ),
              // (A project origin's template node is a node id: its position's new node.)
              (nodeId) => placedByTemplate.get(nodeId) ?? nodeId,
            ),
          }
        : {}),
    };
    const libraryPatch = enclosing?.find((item) =>
      sameAddress(
        { instances: [], templatePath: item.templatePath },
        { instances: [], templatePath: path },
      ),
    );
    if (libraryPatch)
      entry = applyPatch(entry, {
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
    const propertyWrite = propertyWrites?.get(templateId);
    if (propertyWrite)
      entry = applyPatch(entry, {
        ...(propertyWrite.props
          ? { props: sets(propertyWrite.props) as PropWrites }
          : {}),
        ...(propertyWrite.enabled !== undefined
          ? { enabled: propertyWrite.enabled }
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
        // ADR-256 §1-1: a slot child's address of a position in this nested instance follows the
        // instance's new node too.
        if (item.kind === "fillSlot")
          remapAddresses(item.childIds, (address) =>
            address.instances.length > instances.length &&
            startsWith(address.instances, nestedPrefix)
              ? {
                  instances: [
                    id,
                    ...address.instances.slice(nestedPrefix.length),
                  ] as InstanceAddress["instances"],
                  templatePath: address.templatePath,
                }
              : address,
          );
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
    // This template node's slot fills (`slotFills`): its children at a slot position of its
    // composite template become the owned instance's `fillSlot` there — unless the owner filled
    // that position itself (that override moves with the node, above).
    const filled = new Set<TemplateId>();
    const ownFills: DescendantOverride[] = [];
    for (const fill of template.slotFills ?? []) {
      for (const childId of fill.childIds) filled.add(childId);
      if (
        overrideAt({ instances: nestedPrefix, templatePath: fill.templatePath })
          ?.kind === "fillSlot"
      )
        continue;
      ownFills.push({
        kind: "fillSlot",
        address: { instances: [id], templatePath: fill.templatePath },
        childIds: fill.childIds.map((childId) =>
          materialize([...path, childId]),
        ),
      });
    }
    // A project template node's own overrides (ADR-260 Decision 11): re-addressed from the copy.
    // Its slot contents and replacements are positions of this instance — owned copies of them
    // stand there, unless the owner's own child list at that address replaces them (moved above).
    const overrides: DescendantOverride[] = [];
    for (const item of template.overrides ?? []) {
      const address = {
        ...item.address,
        instances: [id, ...item.address.instances.slice(1)],
      } as InstanceAddress;
      const outer = moved.find((other) =>
        sameAddress(other.address, address),
      );
      if (item.kind === "patch" || (outer && outer.kind !== "patch")) {
        const fields = descendantPatchOf(item);
        if (fields) {
          const { childIds: _childIds, ...rest } = fields as Patch & {
            childIds?: unknown;
          };
          overrides.push({ ...rest, kind: "patch", address });
        }
        continue;
      }
      overrides.push(
        item.kind === "fillSlot"
          ? {
              ...item,
              address,
              childIds: item.childIds.map((childId) =>
                materialize([...path, childId as TemplateId]),
              ),
            }
          : {
              ...item,
              address,
              replacementId: materialize([
                ...path,
                item.replacementId as TemplateId,
              ]),
            },
      );
    }
    for (const item of [...ownPatches, ...ownFills, ...moved]) {
      const index = overrides.findIndex((existing) =>
        sameAddress(existing.address, item.address),
      );
      const existing = overrides[index];
      if (index < 0) overrides.push(item);
      else if (existing.kind === "replace" || item.kind === "replace")
        overrides[index] = item;
      else {
        // (A child list and field writes at one address combine — a `fillSlot` carries both.)
        const fields = mergePatches(
          { ...existing, kind: "patch" } as Patch,
          { ...item, kind: "patch" } as Patch,
        );
        const list =
          item.kind === "fillSlot"
            ? item
            : existing.kind === "fillSlot"
              ? existing
              : undefined;
        const { childIds: _childIds, ...patchFields } = fields as Patch & {
          childIds?: unknown;
        };
        overrides[index] = list
          ? { ...patchFields, kind: "fillSlot", childIds: list.childIds }
          : patchFields;
      }
    }
    entry = { ...entry, descendantOverrides: overrides };
    const changePatch = descendantPatchOf(change);
    if (changePatch) entry = applyPatch(entry, changePatch);
    entry = {
      ...entry,
      children:
        change?.kind === "fillSlot"
          ? remapSlotChildren(change.childIds)
          : template.children
              .filter((childId) => !filled.has(childId))
              .map((childId) => materialize([...path, childId])),
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
            prefix &&
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
  at: NodeParent,
  newId: NewId,
): readonly NodeId[] {
  const current = childList(draft, at);
  if (current) return current;
  const parent = listParent(draft, at);
  if (parent.kind !== "descendant") return fail("PARENT_REQUIRED", "parent");
  const path = parent.address.templatePath;
  // A slot position the enclosing library template node fills (`slotFills`) shows that node's
  // children: those are the positions copied (they sit in the enclosing node's own template).
  const fill =
    librarySlotFillAt(draft, parent.address) ??
    templateNodeFillAt(draft, parent.ownerId, parent.address);
  const materializer = createMaterializer(
    draft,
    parent.ownerId,
    fill ? fill.instances : parent.address.instances,
    newId,
    // (A composite position's root children take the position's values for their `{key}`
    // placeholders — its item label — as a detach does. A position of the instance's own template
    // takes the instance's current values: the copy keeps them and no longer follows the instance's
    // props — user decision 2026-10-12 「A」, the NumberField Group's Input `{placeholder}`.)
    fill
      ? undefined
      : parent !== at && at.kind === "descendant"
        ? positionBindings(draft, at.ownerId, at.address)
        : parent.address.instances.length === 1 &&
            parent.address.instances[0] === parent.ownerId
          ? instanceBindings(draft, parent.ownerId)
          : undefined,
  );
  const ids = fill
    ? fill.childIds.map((childId) => materializer.node([...fill.path, childId]))
    : readTemplate(draft, path[path.length - 1]).children.map((childId) =>
        materializer.node([...path, childId]),
      );
  draft.write({
    ...draft.node(parent.ownerId),
    descendantOverrides: materializer.remainingOverrides(
      fill ? undefined : path,
    ),
  });
  setChildList(draft, parent, ids);
  materializer.reanchorInteractions();
  return ids;
}

/**
 * The item lists the "+" of a collection writes (`collections.ts`): a template node holding
 * collection items (a MenuTrigger's Menu — no declared slot).
 */
const COLLECTION_ITEM_TYPES = componentTypeSet("staticCollectionItem");

/**
 * The child lists of a library origin's own template a placed instance holds as its own nodes:
 * the outermost declared slots that hold something (a ToggleButtonGroup's root "Buttons", a Card's
 * Preview · Content · Footer, a Tabs' tab list and panels), a node holding collection items (a
 * MenuTrigger's Menu), and a nested composite's slot the template fills with items (`slotFills` —
 * a Select's · ComboBox's ListBox: the address steps into that composite, as its "+" does). A slot
 * inside a slot goes with its outer one; a nested composite's other slots are its own.
 */
function librarySlotAddresses(
  reader: CommandDraft["reader"],
  definitionId: string,
): { steps: TemplateId[]; templatePath: TemplateId[] }[] {
  if (!definitionId.startsWith("lib:")) return [];
  const library = reader.library;
  const definition = library.definitions.get(
    definitionId as `lib:definition:${string}`,
  );
  if (definition?.mode !== "composite" || !definition.templateRootId)
    return [];
  const typeOf = (templateId: string): string => {
    const template = library.templates.get(
      templateId as `lib:template:${string}`,
    );
    try {
      return template
        ? definitionTypeName(reader, template.definitionId as DefinitionId)
        : "";
    } catch {
      return "";
    }
  };
  const holdsItems = (ids: readonly string[]) =>
    ids.some((id) => COLLECTION_ITEM_TYPES.has(typeOf(id)));
  // A slot whose contents follow the instance's props (`{label}` — an AvatarGroup's Text) stays
  // the template's: an owned copy would keep the value it had and stop following the prop. (A
  // bound collection repeats its own first item per row — `resolver.ts` fill-slot rows.)
  const holdsBinding = (ids: readonly string[]): boolean =>
    ids.some((id) => {
      const template = library.templates.get(id as `lib:template:${string}`);
      return (
        !!template &&
        (Object.values(template.props).some(
          (value) => typeof value === "string" && TEMPLATE_BINDING.test(value),
        ) ||
          holdsBinding(template.children))
      );
    });
  const out: { steps: TemplateId[]; templatePath: TemplateId[] }[] = [];
  const visit = (path: TemplateId[]) => {
    const node = library.templates.get(
      path[path.length - 1] as `lib:template:${string}`,
    );
    if (!node) return;
    if (node.slot || holdsItems(node.children)) {
      if (node.children.length && !holdsBinding(node.children))
        out.push({ steps: [], templatePath: path });
      return;
    }
    for (const child of node.children) {
      const template = library.templates.get(
        child as `lib:template:${string}`,
      );
      const nested = template
        ? library.definitions.get(
            template.definitionId as `lib:definition:${string}`,
          )
        : undefined;
      if (nested?.mode === "composite") {
        for (const fill of template?.slotFills ?? [])
          if (holdsItems(fill.childIds) && !holdsBinding(fill.childIds))
            out.push({
              steps: [child as TemplateId],
              templatePath: [...fill.templatePath],
            });
        continue;
      }
      visit([...path, child as TemplateId]);
    }
  };
  visit([definition.templateRootId as TemplateId]);
  return out;
}

/**
 * A placed library origin instance holds its slots' contents as its own nodes (each slot a
 * `fillSlot`), as the first structural edit there makes them (`ensureChildList`): the items a
 * ToggleButtonGroup starts with are ToggleButton instances with an id, detach and create
 * component, the same as one its "+" adds (user 2026-10-14 「slot 호스트 전부」). Down the new
 * nodes too (a CardView's Cards are Card instances with slots of their own). The Components page's
 * origin sample keeps its slots as template positions (shown empty) — it is not placed by this.
 */
export function ownSlotContents(
  draft: CommandDraft,
  rootIds: readonly NodeId[],
  newId: NewId,
): void {
  const stack = [...rootIds];
  while (stack.length) {
    const id = stack.pop()!;
    const node = draft.node(id);
    for (const { steps, templatePath } of librarySlotAddresses(
      draft.reader,
      node.definitionId,
    )) {
      const at: NodeParent = {
        kind: "descendant",
        ownerId: id,
        address: { instances: [id, ...steps], templatePath },
      };
      if (!childList(draft, at)) ensureChildList(draft, at, newId);
    }
    stack.push(...ownedChildren(draft.node(id)));
  }
}

/** A template position's display state as the accepted boolean props it sets (an owned node's). */
function withDisplayState(
  draft: CommandDraft,
  template: ReturnType<typeof readTemplate>,
  props: PropWrites,
): PropWrites {
  const shown = template.displayState
    ? DISPLAY_STATE_PROPS[template.displayState]
    : undefined;
  if (!shown) return props;
  const accepts =
    draft.reader.library.definitions.get(
      template.definitionId as `lib:definition:${string}`,
    )?.accepts ?? {};
  const out = { ...props };
  for (const [key, value] of Object.entries(shown))
    if (accepts[key] === "boolean") out[key] = { kind: "set", value };
  return out;
}

/** An authored value as a binding scalar (a token's value; a placeholder or a list is none). */
function scalarValue(draft: CommandDraft, value: unknown): Scalar | undefined {
  if (value === undefined || value === null || Array.isArray(value))
    return undefined;
  if (typeof value !== "object")
    return typeof value === "string" && TEMPLATE_BINDING.test(value)
      ? undefined
      : (value as Scalar);
  const tokenId = (value as { tokenId?: string }).tokenId;
  const token = tokenId?.startsWith("lib:")
    ? draft.reader.library.tokens.get(tokenId as `lib:token:${string}`)
    : tokenId
      ? draft.reader.getEntry(tokenId)
      : undefined;
  return token && "value" in token ? (token.value as Scalar) : undefined;
}

/**
 * The values an instance gives its template's `{key}` placeholders (detach's bindings): its own
 * value, else the composite's default.
 */
export function instanceBindings(
  draft: CommandDraft,
  instanceId: NodeId,
): TemplateBindings {
  const instance = draft.node(instanceId);
  const id = instance.definitionId as string;
  const definition = id.startsWith("lib:")
    ? draft.reader.library.definitions.get(id as `lib:definition:${string}`)
    : draft.reader.getEntry(id);
  const accepts =
    definition && "accepts" in definition ? definition.accepts : {};
  const defaults =
    definition && "defaults" in definition
      ? (definition.defaults as Record<string, unknown>)
      : {};
  const bindings: Record<string, Scalar> = {};
  for (const key of Object.keys(accepts)) {
    const write = instance.props[key];
    const value =
      write?.kind === "set"
        ? scalarValue(draft, write.value)
        : scalarValue(draft, defaults[key]);
    if (value !== undefined) bindings[key] = value;
  }
  return bindings;
}

/**
 * The values a composite template position gives its template's `{key}` placeholders (detach's
 * bindings at a position): the owner's patch there, else the position's own template value, else
 * the composite's default. A value that is itself a placeholder (bound one level up) is left out
 * — that placeholder stays, and copying it is refused.
 */
function positionBindings(
  draft: CommandDraft,
  ownerId: NodeId,
  address: InstanceAddress,
): TemplateBindings {
  const templateId = address.templatePath[address.templatePath.length - 1];
  const template = readTemplate(draft, templateId);
  const definition = draft.reader.library.definitions.get(
    template.definitionId as `lib:definition:${string}`,
  );
  const patch = overrideAt(draft.node(ownerId), address);
  const scalar = (value: unknown) => scalarValue(draft, value);
  const bindings: Record<string, Scalar> = {};
  for (const key of Object.keys(definition?.accepts ?? {})) {
    const patched = descendantPatchOf(patch)?.props?.[key];
    const own = template.props[key];
    const value =
      patched?.kind === "set"
        ? scalar(patched.value)
        : own?.kind === "set"
          ? scalar(own.value)
          : scalar(definition?.defaults[key]);
    if (value !== undefined) bindings[key] = value;
  }
  return bindings;
}

/**
 * The library slot fill shown at an instance address: the last instance step is a library
 * template node whose `slotFills` fill `templatePath`. Returns the filling children with the
 * address level they sit at (the step's own template: `instances` without the step, `path` =
 * the step's template path from its template root).
 */
/**
 * ADR-260 follow-up: a slot position a project template node above fills (an origin's own items —
 * a RadioGroup component's Radios) shows that node's slot contents. The instance's first edit
 * there copies those (positions of the template the node sits in — Decision 11), not the library
 * defaults under them.
 */
export function templateNodeFillAt(
  draft: CommandDraft,
  ownerId: NodeId,
  address: InstanceAddress,
):
  | {
      instances: InstanceAddress["instances"];
      path: readonly TemplateId[];
      childIds: readonly TemplateId[];
    }
  | undefined {
  const owner = draft.node(ownerId);
  const read = (id: string) => draft.read(id);
  const { structural } = layeredOverride(
    overridesAt(read, owner, address.instances, address.templatePath),
  );
  if (
    !structural ||
    structural.owner.id === ownerId ||
    structural.override.kind !== "fillSlot"
  )
    return undefined;
  const place = innerOwnerPlace(
    read,
    (id) => draft.reader.ownerOf(id),
    draft.reader.library,
    address.instances,
    structural.owner,
  );
  return place
    ? {
        instances: place.instancePath as InstanceAddress["instances"],
        path: place.templatePath,
        childIds: structural.override.childIds as readonly TemplateId[],
      }
    : undefined;
}

export function librarySlotFillAt(
  draft: CommandDraft,
  address: InstanceAddress,
):
  | {
      instances: InstanceAddress["instances"];
      path: readonly TemplateId[];
      childIds: readonly TemplateId[];
    }
  | undefined {
  const { instances, templatePath } = address;
  const step = instances[instances.length - 1];
  if (instances.length < 2 || !step.startsWith("lib:")) return undefined;
  const templates = draft.reader.library.templates;
  const fill = templates
    .get(step as `lib:template:${string}`)
    ?.slotFills?.find(
      (item) =>
        item.templatePath.length === templatePath.length &&
        item.templatePath.every((id, index) => id === templatePath[index]),
    );
  if (!fill) return undefined;
  return {
    instances: instances.slice(0, -1),
    path: libraryTemplatePath(draft.reader.library, step as TemplateId),
    childIds: fill.childIds,
  };
}

const templateParents = new WeakMap<object, Map<string, string>>();
/** A library template node's path from its template root (each node has one parent). */
function libraryTemplatePath(
  library: CommandDraft["reader"]["library"],
  id: TemplateId,
): TemplateId[] {
  let parents = templateParents.get(library);
  if (!parents) {
    parents = new Map();
    for (const node of library.templates.values())
      for (const child of node.children) parents.set(child, node.id);
    templateParents.set(library, parents);
  }
  const path = [id];
  for (let at = parents.get(id); at; at = parents.get(at))
    path.unshift(at as TemplateId);
  return path;
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

type AnyDefinition = Pick<
  DefinitionEntry,
  "name" | "mode" | "accepts" | "defaults" | "templateRootId"
>;
function definitionOf(reader: CatalogReader, id: DefinitionId): AnyDefinition {
  const definition = id.startsWith("lib:")
    ? reader.library.definitions.get(id as LibraryDefinitionId)
    : reader.getEntry(id);
  if (!definition || ("kind" in definition && definition.kind !== "definition"))
    return fail("DANGLING_DEFINITION", id);
  return definition as AnyDefinition;
}

/**
 * The instance becomes the owned copy of its template root, keeping its ID (references and the
 * selection stay valid). Template values, library patches, the instance's overrides and its own
 * authored root values carry over; `{key}` placeholders take the instance's current values.
 */
export function detachInto(draft: CommandDraft, id: NodeId, newId: NewId): void {
  const instance = draft.node(id);
  const definition = definitionOf(draft.reader, instance.definitionId);
  if (definition.mode !== "composite" || !definition.templateRootId)
    fail("NOT_AN_INSTANCE", id);
  const materializer = createMaterializer(
    draft,
    id,
    [id],
    newId,
    instanceBindings(draft, id),
  );
  materializer.node([definition.templateRootId!], id);
  const root = draft.node(id);
  const rootAccepts = definitionOf(draft.reader, root.definitionId).accepts;
  // The instance's authored values are its root's (the resolver's instance root layer).
  const props = { ...root.props };
  for (const [key, write] of Object.entries(instance.props))
    if (key in rootAccepts) props[key] = write;
  const {
    kind: _kind,
    id: _id,
    definitionId: _definitionId,
    children: _children,
    props: _props,
    visual,
    sizing,
    layout,
    descendantOverrides: _overrides,
    ...fields
  } = instance;
  draft.write({
    ...root,
    ...fields,
    props,
    visual: { ...root.visual, ...visual },
    sizing: { ...sizing, ...root.sizing },
    ...(root.layout || layout ? { layout: { ...root.layout, ...layout } } : {}),
  });
  materializer.reanchorInteractions();
}
