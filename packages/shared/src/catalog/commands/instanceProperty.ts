import { componentPropertiesOf } from "../document/componentProperties";
import { ownedChildren } from "../document/graph";
import type {
  CatalogReader,
  CatalogShowWhen,
  CatalogStateOwnerRef,
  ComponentProperty,
  DefinitionEntry,
  DefinitionId,
  DescendantOverride,
  DescendantPatchFields,
  InstanceAddress,
  InteractionEntry,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../document/types";
import type { CatalogCommand, CatalogCommandPlan } from "./compose";
import { stageOver } from "./compose";
import { CommandDraft, fail, sameAddress } from "./context";
import { createMaterializer, type NewId } from "./materialize";
import {
  planSwapInstance,
  replacementPlace,
  type SwapInstanceReport,
} from "./swap";

/**
 * ADR-261 Decision 4 · Phase 5 — an instance swap property (Figma): the value an instance picks
 * for a nested instance of its component's origin. It is the instance's `replace` override at
 * that position — an owned instance of the picked component stands there (so the dependency,
 * clipboard, cycle, Layers and selection paths are the existing ones, review h3 · h4). Nothing
 * else is stored: the value is that node's `definitionId`, the default is the origin's nested
 * instance (no override).
 *
 * Picking a value the first time copies the position into an owned node (what the instance showed
 * there — the instance's writes and slot contents at it move with it, as a first structural edit
 * copies a position), then swaps that node (Decision 2: what the instance changed follows by the
 * same place). Picking the default swaps it back and folds it into the instance's overrides at the
 * position again; what its copy held stays the instance's (the slot contents a placed instance
 * owns — 2026-10-14). Every address through the position — the instance's overrides and
 * interactions, `showWhen` state owners and, when the instance stands in another component, the
 * addresses other instances hold through it — moves in the same step.
 */
export interface InstancePropertyInput {
  /** The node whose overrides hold the value: the instance, or an outer one (a nested instance). */
  ownerId: NodeId;
  /** The instance steps down to the component's template: `[ownerId]` or `[ownerId, …, step]`. */
  instances: InstanceAddress["instances"];
  key: string;
  /** The component the nested instance shows; `null` = the default (the origin's own). */
  definitionId: DefinitionId | null;
  newId: NewId;
  label?: string;
}

/** The component (project definition) whose template `instances` reach (its last step's). */
function componentAt(
  reader: CatalogReader,
  ownerId: NodeId,
  instances: InstanceAddress["instances"],
): DefinitionEntry {
  const step =
    instances.length === 1 ? ownerId : instances[instances.length - 1];
  const node = reader.getEntry(step);
  if (node?.kind !== "node") return fail("NODE_REQUIRED", step);
  const definition = reader.getEntry(node.definitionId);
  if (definition?.kind !== "definition" || definition.usage === "layout")
    return fail("PROPERTIES_NOT_COMPONENT", node.definitionId);
  return definition;
}

/**
 * The template path of an origin node: from its component's template root down the owned
 * children (ADR-260 Decision 11 — slot contents and replacements are positions of the template).
 */
export function originTemplatePath(
  reader: CatalogReader,
  rootId: string,
  id: string,
): TemplateId[] | undefined {
  const path: TemplateId[] = [];
  const seen = new Set<string>();
  for (
    let cursor: string | undefined = id;
    cursor && !seen.has(cursor);
    cursor = reader.ownerOf(cursor)
  ) {
    seen.add(cursor);
    path.unshift(cursor as TemplateId);
    if (cursor === rootId) return path;
  }
  return undefined;
}

/** The template path of a template node in the template it stands in (up to that template root). */
function standingPath(reader: CatalogReader, id: string): TemplateId[] {
  const path: TemplateId[] = [];
  const seen = new Set<string>();
  for (
    let cursor: string | undefined = id;
    cursor && !seen.has(cursor);
    cursor = reader.ownerOf(cursor)
  ) {
    seen.add(cursor);
    path.unshift(cursor as TemplateId);
    if (reader.definitionOfTemplateRoot(cursor)) return path;
    const owner = reader.ownerOf(cursor);
    if (owner && reader.getEntry(owner)?.kind === "definition") return path;
  }
  return fail("TEMPLATE_NODE_REQUIRED", id);
}

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);

/** Where `steps` sit in `instances` (`-1` = not there). */
function indexOfRun(
  instances: readonly string[],
  steps: readonly string[],
): number {
  for (let at = 0; at + steps.length <= instances.length; at++)
    if (steps.every((id, index) => instances[at + index] === id)) return at;
  return -1;
}

/** One state owner reference passed through `map` (`undefined` = unchanged). */
type OwnerRefMap = (
  ancestor: { nodeId: NodeId } | { address: InstanceAddress },
) => CatalogStateOwnerRef | undefined;
function mapStateOwners(
  showWhen: CatalogShowWhen,
  map: OwnerRefMap,
): CatalogShowWhen {
  const ref = (from: CatalogStateOwnerRef): CatalogStateOwnerRef => {
    if (!("ancestor" in from) || "local" in from.ancestor) return from;
    return map(from.ancestor) ?? from;
  };
  return {
    all: showWhen.all.map((item) =>
      typeof item === "string" || !("from" in item) || !item.from
        ? item
        : { ...item, from: ref(item.from) },
    ) as CatalogShowWhen["all"],
    ...(showWhen.from ? { from: ref(showWhen.from) } : {}),
  };
}

/**
 * How an address changes when the position (`instances` + `path`, a nested instance `T`) is
 * lifted into the owned node `nodeId`, or lowered back. An address is `{nodeId}` when it names the
 * node itself (a lifted position is a node: `ancestor.nodeId`, an interaction without address).
 */
interface PositionMove {
  instances: InstanceAddress["instances"];
  path: readonly TemplateId[];
  nodeId: NodeId;
  /** The lifted node's position in the template its owner stands in (`ownerId` is a template node). */
  standing: () => TemplateId[];
  ownerId: NodeId;
  /** The node's owned children (slot contents that moved to it from the owner). */
  owned: () => ReadonlySet<string>;
}

/**
 * Review M2: another instance's path through the owner (a template node) to content now owned by
 * the lifted node passes through it — the node is inserted after the owner (a lift) or taken out
 * from the middle (a lower).
 */
function liftPath(move: PositionMove, path: readonly TemplateId[]): TemplateId[] {
  const at = path.indexOf(move.ownerId as TemplateId);
  if (at < 0 || at + 1 >= path.length || !move.owned().has(path[at + 1]))
    return [...path];
  return [...path.slice(0, at + 1), move.nodeId as TemplateId, ...path.slice(at + 1)];
}
function lowerPath(path: readonly TemplateId[], nodeId: NodeId): TemplateId[] {
  const at = path.indexOf(nodeId as TemplateId);
  return at >= 0 && at < path.length - 1
    ? [...path.slice(0, at), ...path.slice(at + 1)]
    : [...path];
}
type Moved = InstanceAddress | { nodeId: NodeId } | undefined;

function liftAddress(move: PositionMove, address: InstanceAddress): Moved {
  const templateId = move.path[move.path.length - 1];
  const at = indexOfRun(address.instances, move.instances);
  if (at < 0) {
    const templatePath = liftPath(move, address.templatePath);
    return templatePath.length !== address.templatePath.length
      ? { instances: address.instances, templatePath }
      : undefined;
  }
  const after = at + move.instances.length;
  if (address.instances[after] === templateId)
    return at === 0
      ? {
          instances: [move.nodeId, ...address.instances.slice(after + 1)],
          templatePath: address.templatePath,
        }
      : {
          instances: [
            ...address.instances.slice(0, at),
            move.nodeId,
            ...address.instances.slice(after + 1),
          ],
          templatePath: address.templatePath,
        };
  if (
    address.instances.length !== after ||
    !sameIds(address.templatePath, move.path)
  )
    return undefined;
  if (at === 0) return { nodeId: move.nodeId };
  // (Another instance's address of the position: the node is a position of the template the
  // owner stands in — its replacement, ADR-260 Decision 11.)
  return {
    instances: address.instances.slice(0, at),
    templatePath: [...move.standing(), move.nodeId],
  };
}

function lowerAddress(move: PositionMove, address: InstanceAddress): Moved {
  const index = address.instances.indexOf(move.nodeId);
  const templateId = move.path[move.path.length - 1];
  if (index >= 0)
    return {
      instances: [
        ...address.instances.slice(0, index),
        ...move.instances,
        templateId,
        ...address.instances.slice(index + 1),
      ],
      templatePath: address.templatePath,
    };
  if (address.templatePath[address.templatePath.length - 1] !== move.nodeId) {
    const templatePath = lowerPath(address.templatePath, move.nodeId);
    return templatePath.length !== address.templatePath.length
      ? { instances: address.instances, templatePath }
      : undefined;
  }
  return {
    instances: [...address.instances, ...move.instances],
    templatePath: move.path,
  };
}

/**
 * Rewrite every address held through the position (lift or lower), except the owner's own
 * overrides (the materializer moves them on a lift; `lower` folds the node's back). Holders: the
 * owner's and the node's subtrees (`showWhen`), the interactions naming the owner or the node,
 * and other instances' overrides and subtrees through the owner (it stands in a component).
 */
function moveAddresses(
  draft: CommandDraft,
  ownerId: NodeId,
  move: PositionMove,
  map: (address: InstanceAddress) => Moved,
): void {
  const toRef = (moved: Moved): CatalogStateOwnerRef | undefined =>
    moved &&
    ("nodeId" in moved
      ? { ancestor: { nodeId: moved.nodeId } }
      : { ancestor: { address: moved } });
  const nodeRef: OwnerRefMap = (ancestor) =>
    "address" in ancestor
      ? toRef(map(ancestor.address))
      : ancestor.nodeId === move.nodeId
        ? toRef(map({ instances: [], templatePath: [move.nodeId] }))
        : undefined;
  const walk = (start: string) => {
    const queue = [start];
    const seen = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const entry = draft.read(id);
      if (entry?.kind !== "node") continue;
      queue.push(...ownedChildren(entry));
      if (!entry.showWhen) continue;
      const showWhen = mapStateOwners(entry.showWhen, nodeRef);
      if (JSON.stringify(showWhen) !== JSON.stringify(entry.showWhen))
        draft.write({ ...entry, showWhen });
    }
  };
  walk(ownerId);
  if (draft.read(move.nodeId)) walk(move.nodeId);
  const referrers = new Set([
    ...draft.reader.referrersOf(ownerId),
    ...draft.reader.referrersOf(move.nodeId),
  ]);
  for (const referrerId of referrers) {
    const entry = draft.read(referrerId);
    if (entry?.kind === "interaction") {
      const address = entry.address ?? {
        instances: [],
        templatePath: [entry.ownerId as TemplateId],
      };
      // (An interaction of the node itself has no address: the node is its owner.)
      const moved =
        entry.address || entry.ownerId === move.nodeId
          ? map(address)
          : undefined;
      if (!moved) continue;
      const { address: _old, ...rest } = entry;
      draft.write(
        "nodeId" in moved
          ? ({ ...rest, ownerId: moved.nodeId } as InteractionEntry)
          : ({
              ...rest,
              ownerId: moved.instances[0] as NodeId,
              address: moved,
            } as InteractionEntry),
      );
    } else if (
      entry?.kind === "node" &&
      entry.id !== ownerId &&
      entry.id !== move.nodeId
    ) {
      let changed = false;
      const overrides = entry.descendantOverrides.map((override) => {
        const moved = map(override.address);
        if (!moved || "nodeId" in moved) return override;
        changed = true;
        return { ...override, address: moved } as DescendantOverride;
      });
      if (changed) draft.write({ ...entry, descendantOverrides: overrides });
      walk(entry.id);
    }
  }
}

/** Copy the position into an owned node standing there (the instance's `replace` override). */
function liftPosition(
  draft: CommandDraft,
  input: Pick<InstancePropertyInput, "ownerId" | "instances" | "newId">,
  path: readonly TemplateId[],
  shownByProperty: boolean,
): NodeId {
  const direct = draft
    .node(input.ownerId)
    .descendantOverrides.find((item) =>
      sameAddress(item.address, { instances: input.instances, templatePath: path }),
    );
  const materializer = createMaterializer(
    draft,
    input.ownerId,
    input.instances,
    input.newId,
  );
  const nodeId = materializer.node(path);
  // (Review H1: a visibility property still reaches the position once swapped — the resolver reads
  // it there. The copy keeps only the instance's own show / hide, not the property's value nor the
  // origin's: what is not the instance's stays the property's.)
  if (shownByProperty) {
    const { enabled: _copied, ...lifted } = draft.node(nodeId);
    const own =
      direct && direct.kind !== "replace" ? direct.enabled : undefined;
    draft.write(own === undefined ? lifted : { ...lifted, enabled: own });
  }
  const owner = draft.node(input.ownerId);
  draft.write({
    ...owner,
    descendantOverrides: [
      ...materializer.remainingOverrides(),
      {
        kind: "replace",
        address: { instances: input.instances, templatePath: [...path] },
        replacementId: nodeId,
      },
    ],
  });
  materializer.reanchorInteractions();
  const move: PositionMove = {
    instances: input.instances,
    path,
    nodeId,
    standing: () => standingPath(draft.reader, input.ownerId),
    ownerId: input.ownerId,
    owned: () => new Set(ownedChildren(draft.node(nodeId))),
  };
  moveAddresses(draft, input.ownerId, move, (address) =>
    liftAddress(move, address),
  );
  return nodeId;
}

/** The writes a node holds over its template position (what differs from the template node). */
function writesOver(
  node: NodeEntry,
  template: NodeEntry,
): DescendantPatchFields {
  const fields: Record<string, unknown> = {};
  for (const key of ["props", "visual", "sizing", "layout"] as const) {
    const own = (node[key] ?? {}) as Record<string, unknown>;
    const base = (template[key] ?? {}) as Record<string, unknown>;
    const writes = Object.fromEntries(
      Object.entries(own).filter(
        ([field, write]) =>
          JSON.stringify(write) !== JSON.stringify(base[field]),
      ),
    );
    if (Object.keys(writes).length) fields[key] = writes;
  }
  for (const key of [
    "fills",
    "fillSizing",
    "responsive",
    "visibility",
    "stateRules",
  ] as const)
    if (
      node[key] !== undefined &&
      JSON.stringify(node[key]) !== JSON.stringify(template[key])
    )
      fields[key] = structuredClone(node[key]);
  // (A node with no show / hide of its own follows the position: no write.)
  if (node.enabled !== undefined && node.enabled !== (template.enabled ?? true))
    fields.enabled = node.enabled;
  return fields as DescendantPatchFields;
}

/** Fold the owned node back into the owner's overrides at the position (the default again). */
function lowerPosition(
  draft: CommandDraft,
  input: Pick<InstancePropertyInput, "ownerId" | "instances">,
  path: readonly TemplateId[],
  nodeId: NodeId,
): void {
  const node = draft.node(nodeId);
  const template = draft.node(path[path.length - 1]);
  const prefix = [
    ...input.instances,
    template.id,
  ] as InstanceAddress["instances"];
  const address: InstanceAddress = {
    instances: input.instances,
    templatePath: [...path],
  };
  const fields = writesOver(node, template);
  const folded: DescendantOverride[] = node.descendantOverrides.map(
    (override) =>
      ({
        ...override,
        address: {
          instances: [...prefix, ...override.address.instances.slice(1)],
          templatePath: override.address.templatePath,
        },
      }) as DescendantOverride,
  );
  // (Its own children stay the instance's: a child list at the position.)
  const atPosition: DescendantOverride[] = node.children.length
    ? [{ ...fields, kind: "fillSlot", address, childIds: [...node.children] }]
    : Object.keys(fields).length
      ? [{ ...fields, kind: "patch", address }]
      : [];
  const owner = draft.node(input.ownerId);
  draft.write({
    ...owner,
    descendantOverrides: [
      ...owner.descendantOverrides.filter(
        (item) => !(item.kind === "replace" && item.replacementId === nodeId),
      ),
      ...atPosition,
      ...folded,
    ],
  });
  draft.remove(nodeId);
  const move: PositionMove = {
    instances: input.instances,
    path,
    nodeId,
    standing: () => standingPath(draft.reader, input.ownerId),
    ownerId: input.ownerId,
    owned: () => new Set<string>(),
  };
  moveAddresses(draft, input.ownerId, move, (moved) =>
    lowerAddress(move, moved),
  );
}

/** The owner's replacement at a position (the value), if any. */
function replacementAt(
  reader: CatalogReader,
  owner: NodeEntry,
  address: InstanceAddress,
): NodeId | undefined {
  const found = owner.descendantOverrides.find(
    (item) => item.kind === "replace" && sameAddress(item.address, address),
  );
  const id = found?.kind === "replace" ? found.replacementId : undefined;
  return id && reader.getEntry(id)?.kind === "node" ? id : undefined;
}

/**
 * The positions of an instance property, as `instances` see them: each target's template path,
 * left out when the instance can no longer reach it (its own child list above it — a first
 * structural edit copied the position).
 */
export function instancePropertyPositions(
  reader: CatalogReader,
  owner: NodeEntry,
  instances: InstanceAddress["instances"],
  definition: DefinitionEntry,
  property: ComponentProperty,
): { target: NodeId; path: TemplateId[]; replacementId?: NodeId }[] {
  const rootId = definition.templateRootId;
  if (!rootId) return [];
  const cut = owner.descendantOverrides.filter(
    (item) =>
      item.kind !== "patch" && sameIds(item.address.instances, instances),
  );
  return property.targets.flatMap((target) => {
    const path = originTemplatePath(reader, rootId, target.id);
    if (!path) return [];
    if (
      cut.some(
        (item) =>
          item.address.templatePath.length < path.length &&
          item.address.templatePath.every((id, index) => path[index] === id),
      )
    )
      return [];
    const replacementId = replacementAt(reader, owner, {
      instances,
      templatePath: path,
    });
    return [
      { target: target.id, path, ...(replacementId ? { replacementId } : {}) },
    ];
  });
}

/** An instance property's current value: the first reachable position's component. */
export function instancePropertyValue(
  reader: CatalogReader,
  ownerId: NodeId,
  instances: InstanceAddress["instances"],
  key: string,
): { definitionId: DefinitionId; isDefault: boolean } | undefined {
  const owner = reader.getEntry(ownerId);
  if (owner?.kind !== "node") return undefined;
  const definition = componentAt(reader, ownerId, instances);
  const property = componentPropertiesOf(definition)?.find(
    (item) => item.key === key && item.kind === "instance",
  );
  if (!property) return undefined;
  const [first] = instancePropertyPositions(
    reader,
    owner,
    instances,
    definition,
    property,
  );
  if (!first) return undefined;
  const shown = reader.getEntry(first.replacementId ?? first.target);
  if (shown?.kind !== "node") return undefined;
  return { definitionId: shown.definitionId, isDefault: !first.replacementId };
}

/**
 * The instance property planner (exported for the Builder's notice: what the swaps kept, dropped
 * and moved out); the command is `setInstanceProperty`.
 */
export function planInstanceProperty(
  reader: CatalogReader,
  input: InstancePropertyInput,
): { plan: CatalogCommandPlan; report: SwapInstanceReport } {
  const owner = reader.getEntry(input.ownerId);
  if (owner?.kind !== "node") fail("NODE_REQUIRED", input.ownerId);
  if (input.instances[0] !== input.ownerId)
    fail("INSTANCE_ROOT_MISMATCH", input.ownerId);
  const definition = componentAt(reader, input.ownerId, input.instances);
  const property = componentPropertiesOf(definition)?.find(
    (item) => item.key === input.key,
  );
  if (property?.kind !== "instance") fail("PROPERTY_NOT_FOUND", input.key);
  // (A nested instance's own value — its template node's replacement — is that origin's; an outer
  // instance's value over it is out of scope.)
  const positions = instancePropertyPositions(
    reader,
    owner as NodeEntry,
    input.instances,
    definition,
    property!,
  );
  if (!positions.length) fail("PROPERTY_NOT_REACHABLE", input.key);
  if (input.instances.length > 1) {
    const step = reader.getEntry(input.instances[input.instances.length - 1]);
    for (const position of positions)
      // (Review M1: what the nested instance itself wrote at the position or inside it is the
      // origin's — an outer value over it would have to layer under it; out of scope, refused.)
      if (
        step?.kind === "node" &&
        step.descendantOverrides.some((item) => {
          const templateId = position.path[position.path.length - 1];
          return (
            (item.address.instances.length === 1 &&
              item.address.templatePath.length >= position.path.length &&
              position.path.every(
                (id, index) => item.address.templatePath[index] === id,
              )) ||
            item.address.instances[1] === templateId
          );
        })
      )
        fail("PROPERTY_VALUE_INHERITED", step.id);
  }
  const shownBy = (target: NodeId) =>
    !!componentPropertiesOf(definition)?.some(
      (item) =>
        item.kind === "boolean" &&
        item.targets.some((driven) => driven.id === target),
    );
  const report: SwapInstanceReport = {
    kept: 0,
    dropped: 0,
    movedOut: 0,
    targetsUnset: 0,
  };
  const stage = stageOver(reader);
  const ops: CatalogCommandPlan["ops"][number][] = [];
  const run = (step: (draft: CommandDraft) => void) => {
    const draft = new CommandDraft(stage);
    step(draft);
    const planned = draft.ops();
    stage.apply(planned);
    ops.push(...planned);
  };
  const swap = (id: NodeId, definitionId: DefinitionId) => {
    const planned = planSwapInstance(stage, { id, definitionId });
    stage.apply(planned.plan.ops);
    ops.push(...planned.plan.ops);
    report.kept += planned.report.kept;
    report.dropped += planned.report.dropped;
    report.movedOut += planned.report.movedOut;
    report.targetsUnset += planned.report.targetsUnset;
  };
  for (const position of positions) {
    const origin = stage.getEntry(position.target) as NodeEntry;
    const current = position.replacementId;
    const target = input.definitionId ?? origin.definitionId;
    if (target === origin.definitionId) {
      if (!current) continue;
      if ((stage.getEntry(current) as NodeEntry).definitionId !== target)
        swap(current, target);
      run((draft) => lowerPosition(draft, input, position.path, current));
      continue;
    }
    let nodeId = current;
    if (!nodeId) {
      let lifted: NodeId | undefined;
      run((draft) => {
        lifted = liftPosition(draft, input, position.path, shownBy(position.target));
      });
      nodeId = lifted!;
    }
    if ((stage.getEntry(nodeId) as NodeEntry).definitionId !== target)
      swap(nodeId, target);
  }
  return {
    plan: { label: input.label ?? "Set instance property", ops },
    report,
  };
}

/** ADR-261 Phase 5 — set an instance swap property (one history step). */
export const setInstanceProperty =
  (input: InstancePropertyInput): CatalogCommand =>
  (reader) =>
    planInstanceProperty(reader, input).plan;

/**
 * Reset a replaced position of an instance (the Overrides list's 「replaced」 row): the owned node
 * swaps back to the template's component and folds into the instance's overrides there.
 */
export const resetReplacement =
  (input: { id: NodeId; label?: string }): CatalogCommand =>
  (reader) => {
    const stage = stageOver(reader);
    const place = replacementPlace(new CommandDraft(stage), input.id);
    if (!place) return fail("REPLACEMENT_REQUIRED", input.id);
    const path = place.address.templatePath;
    const template = stage.getEntry(path[path.length - 1]);
    if (template?.kind !== "node") return fail("DANGLING_TEMPLATE", input.id);
    const ops: CatalogCommandPlan["ops"][number][] = [];
    if (
      (stage.getEntry(input.id) as NodeEntry).definitionId !==
      template.definitionId
    ) {
      const planned = planSwapInstance(stage, {
        id: input.id,
        definitionId: template.definitionId,
      });
      stage.apply(planned.plan.ops);
      ops.push(...planned.plan.ops);
    }
    const draft = new CommandDraft(stage);
    lowerPosition(
      draft,
      { ownerId: place.ownerId, instances: place.address.instances },
      path,
      input.id,
    );
    ops.push(...draft.ops());
    return { label: input.label ?? "Reset swap", ops };
  };
