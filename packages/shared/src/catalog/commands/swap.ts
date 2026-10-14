import { instanceContract } from "../document/library";
import { mapShowWhenAddresses } from "../document/stateOwnerRefs";
import type {
  CatalogReader,
  CatalogShowWhen,
  DefinitionEntry,
  DefinitionId,
  DescendantOverride,
  InstanceAddress,
  LibraryDefinition,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../document/types";
import { nodeOwnedChildren } from "../resolution/templateOwners";
import type { CatalogCommand, CatalogCommandPlan } from "./compose";
import { pruneComponentPropertyTargets } from "./properties";
import { catalogColorControlPropsError } from "../document/colorValue";
import { catalogPropValueFits } from "../document/valueType";
import {
  assertNestable,
  childList,
  CommandDraft,
  definitionTypeName,
  fail,
  locate,
  setChildList,
} from "./context";

/**
 * ADR-261 Decision 2 — Swap instance (Figma): the node keeps its id, placement and own root fields
 * and shows another component. What the instance changed follows by the same place in the new
 * component — a template position is read as its path of `name ?? type` steps (with the order among
 * siblings of the same step), and only a position the new template has exactly once takes it over
 * (Figma: overrides carry by layer names). Slot content goes to the slot of the same name.
 *
 * Every address into the swapped instance's template moves the same way in the same transaction:
 * the instance's own overrides, the interactions it owns, the `showWhen` state owners below it
 * and — when it stands in a component's template — the addresses other instances hold through it.
 * What finds no place: slot content and replacements move out right after the instance (user
 * decision 1 — nothing is lost); field writes, interactions and conditions are dropped (user
 * decision 6). The report counts both; one undo restores everything.
 */
export interface SwapInstanceReport {
  /** Overrides · interactions · conditions that found their place in the new component. */
  kept: number;
  /** Field writes · interactions · conditions dropped (no place). */
  dropped: number;
  /** Slot contents · replacements moved out after the instance (no slot of that name). */
  movedOut: number;
}

export interface SwapInstanceInput {
  id: NodeId;
  definitionId: DefinitionId;
  label?: string;
}

/** A definition's template as name paths: each position's key and the position of each key. */
interface TemplatePaths {
  root: TemplateId;
  keyOf: ReadonlyMap<string, string>;
  /** Key → position; `null` = more than one position has that key (no unique place). */
  atKey: ReadonlyMap<string, TemplateId | null>;
  parentOf: ReadonlyMap<string, TemplateId>;
  definitionOf: ReadonlyMap<string, string>;
  slotOf: ReadonlyMap<string, string>;
}

type AnyDefinition = DefinitionEntry | LibraryDefinition;

function readDefinition(
  reader: CatalogReader,
  id: string,
): AnyDefinition | undefined {
  if (id.startsWith("lib:"))
    return reader.library.definitions.get(id as `lib:definition:${string}`);
  const entry = reader.getEntry(id);
  return entry?.kind === "definition" ? entry : undefined;
}

/** A template node (library or project) as the swap reads it. */
function readTemplate(
  reader: CatalogReader,
  id: string,
):
  | {
      definitionId: string;
      name?: string;
      slot?: { name: string };
      children: readonly string[];
    }
  | undefined {
  if (id.startsWith("lib:")) {
    const node = reader.library.templates.get(id as `lib:template:${string}`);
    return node && { ...node, children: node.children };
  }
  const node = reader.getEntry(id);
  return node?.kind === "node"
    ? { ...node, children: nodeOwnedChildren(node) }
    : undefined;
}

function typeNameOf(reader: CatalogReader, definitionId: string): string {
  try {
    return definitionTypeName(reader, definitionId as DefinitionId);
  } catch {
    return definitionId;
  }
}

function templatePaths(
  reader: CatalogReader,
  definitionId: string,
): TemplatePaths | undefined {
  const definition = readDefinition(reader, definitionId);
  const root = (definition as { templateRootId?: TemplateId } | undefined)
    ?.templateRootId;
  if (!root) return undefined;
  const keyOf = new Map<string, string>([[root, ""]]);
  const atKey = new Map<string, TemplateId | null>([["", root]]);
  const parentOf = new Map<string, TemplateId>();
  const definitionOf = new Map<string, string>();
  const slotOf = new Map<string, string>();
  const queue: TemplateId[] = [root];
  while (queue.length) {
    const id = queue.shift()!;
    const node = readTemplate(reader, id);
    if (!node) continue;
    definitionOf.set(id, node.definitionId);
    if (node.slot) slotOf.set(id, node.slot.name);
    const counts = new Map<string, number>();
    for (const child of node.children) {
      const childNode = readTemplate(reader, child);
      if (!childNode || keyOf.has(child)) continue;
      const step = childNode.name ?? typeNameOf(reader, childNode.definitionId);
      const n = counts.get(step) ?? 0;
      counts.set(step, n + 1);
      const key = `${keyOf.get(id)}/${step}#${n}`;
      keyOf.set(child, key);
      atKey.set(key, atKey.has(key) ? null : (child as TemplateId));
      parentOf.set(child, id);
      queue.push(child as TemplateId);
    }
  }
  return { root, keyOf, atKey, parentOf, definitionOf, slotOf };
}

/**
 * ADR-261 Phase 5 — where a replacement (a `replace` override's node — an instance property's
 * swapped nested instance) stands: its owner and the position it takes.
 */
export function replacementPlace(
  draft: CommandDraft,
  id: NodeId,
): { ownerId: NodeId; address: InstanceAddress } | undefined {
  const ownerId = draft.reader.ownerOf(id);
  const owner = ownerId ? draft.read(ownerId) : undefined;
  if (owner?.kind !== "node") return undefined;
  const found = owner.descendantOverrides.find(
    (item) => item.kind === "replace" && item.replacementId === id,
  );
  return found && { ownerId: owner.id, address: found.address };
}

const pathTo = (paths: TemplatePaths, id: TemplateId): TemplateId[] => {
  const path = [id];
  for (let at = paths.parentOf.get(id); at; at = paths.parentOf.get(at))
    path.unshift(at);
  return path;
};

/**
 * The swap planner. Exported for the Builder's notice (it plans once and reads the report); the
 * command is `swapInstance`.
 */
export function planSwapInstance(
  reader: CatalogReader,
  input: SwapInstanceInput,
): { plan: CatalogCommandPlan; report: SwapInstanceReport } {
  const draft = new CommandDraft(reader);
  const node = draft.node(input.id);
  if (node.definitionId === input.definitionId)
    fail("SAME_DEFINITION", input.id);
  // An origin is the component itself (Figma: a main component is not swapped).
  if (reader.definitionOfTemplateRoot(input.id))
    fail("ORIGIN_NOT_SWAPPABLE", input.id);
  const target = readDefinition(reader, input.definitionId);
  if (!target) fail("DANGLING_DEFINITION", input.definitionId);
  if ((target as DefinitionEntry).usage === "layout")
    fail("NOT_A_COMPONENT", input.definitionId);
  // The new component must stand where the node stands (the insert's nesting check — review h2:
  // a ListBox item swapped to a Button). A template root is not swapped; a replacement (Phase 5 —
  // an instance property's value) stands in its position, under that position's parent.
  const replaced = replacementPlace(draft, input.id);
  if (!replaced)
    assertNestable(draft, locate(draft, input.id).parent, [input.definitionId]);
  else if (replaced.address.templatePath.length > 1)
    assertNestable(
      draft,
      {
        kind: "descendant",
        ownerId: replaced.ownerId,
        address: {
          instances: replaced.address.instances,
          templatePath: replaced.address.templatePath.slice(0, -1),
        },
      },
      [input.definitionId],
    );

  const before = templatePaths(reader, node.definitionId);
  const after = templatePaths(reader, input.definitionId);
  const report: SwapInstanceReport = { kept: 0, dropped: 0, movedOut: 0 };

  // The new component's instance contract: root props (and writes at its position) it takes.
  const contract = instanceContract(
    target as LibraryDefinition,
    (id) => readDefinition(reader, id) as LibraryDefinition | undefined,
    (id) => readTemplate(reader, id),
  );
  const previous = instanceContract(
    readDefinition(reader, node.definitionId) as LibraryDefinition,
    (id) => readDefinition(reader, id) as LibraryDefinition | undefined,
    (id) => readTemplate(reader, id),
  );
  /**
   * The props the new component takes as they are (review m1 — the graph refuses the rest, so the
   * whole swap would fail): the same value type in both contracts, a value that fits it and its
   * choices; a color combination the new control refuses drops its keys.
   */
  const acceptedProps = (written: NodeEntry["props"]): NodeEntry["props"] => {
    const kept = Object.entries(written).filter(([key, write]) => {
      const type = contract.accepts[key];
      if (!type || previous.accepts[key] !== type) return false;
      if (write.kind !== "set") return true;
      const value = (write as { value?: unknown }).value;
      const choices = contract.propChoices?.[key];
      return (
        catalogPropValueFits(value, type) &&
        (!choices || choices.includes(value as never))
      );
    });
    const typeName = typeNameOf(reader, input.definitionId).split("/")[0];
    const values = () =>
      Object.fromEntries(
        kept
          .filter(([, write]) => write.kind === "set")
          .map(([key, write]) => [key, (write as { value?: unknown }).value]),
      );
    while (kept.length && catalogColorControlPropsError(typeName, values()))
      kept.pop();
    return Object.fromEntries(kept) as NodeEntry["props"];
  };

  /** The new place of an old position (unique key), or `undefined`. */
  const placeOf = (id: string, sameType: boolean): TemplateId | undefined => {
    if (!before || !after) return undefined;
    const key = before.keyOf.get(id);
    const found = key === undefined ? undefined : after.atKey.get(key);
    if (!found) return undefined;
    if (
      sameType &&
      before.definitionOf.get(id) !== after.definitionOf.get(found)
    )
      return undefined;
    return found;
  };
  /** A slot position goes to the new template's one slot of the same name. */
  const slotPlace = (id: string): TemplateId | undefined => {
    const name = before?.slotOf.get(id);
    if (name === undefined || !after) return placeOf(id, true);
    const matches = [...after.slotOf].filter(([, slot]) => slot === name);
    return matches.length === 1 ? (matches[0][0] as TemplateId) : undefined;
  };
  /**
   * An address from the swapped instance (`instances[0]` = it), remapped into the new template:
   * the position itself (`instances` of one), or the nested instance step it goes through (whose
   * own definition must be the same — the rest of the address is that definition's).
   */
  const remap = (
    address: InstanceAddress,
    kind: "position" | "slot" | "nested",
  ): InstanceAddress | undefined => {
    if (!after) return undefined;
    if (address.instances.length > 1) {
      const step = placeOf(address.instances[1], true);
      return (
        step && {
          instances: [
            address.instances[0],
            step,
            ...address.instances.slice(2),
          ],
          templatePath: address.templatePath,
        }
      );
    }
    const last = address.templatePath[address.templatePath.length - 1];
    const found =
      kind === "slot" ? slotPlace(last) : placeOf(last, kind === "position");
    return (
      found && {
        instances: address.instances,
        templatePath: pathTo(after, found),
      }
    );
  };
  /** The address with the swapped node at `at` of `instances`, remapped from there on. */
  const remapThrough = (
    address: InstanceAddress,
    at: number,
    kind: "position" | "slot" | "nested",
  ): InstanceAddress | undefined => {
    const inner = remap(
      {
        instances: address.instances.slice(at),
        templatePath: address.templatePath,
      },
      kind,
    );
    return (
      inner && {
        instances: [...address.instances.slice(0, at), ...inner.instances],
        templatePath: inner.templatePath,
      }
    );
  };

  /**
   * Content an override owned, moved out right after `owner` (user decision 1) — after the
   * instance a replacement stands in (Phase 5: a replacement has no place of its own).
   */
  const moveOut = (owner: NodeId, ids: readonly NodeId[]) => {
    if (!ids.length) return;
    let anchor = owner;
    for (
      let place = replacementPlace(draft, anchor);
      place;
      place = replacementPlace(draft, anchor)
    )
      anchor = place.ownerId;
    const at = locate(draft, anchor);
    const list = [...(childList(draft, at.parent) ?? [])];
    const index = list.indexOf(anchor);
    list.splice(index + 1, 0, ...ids);
    setChildList(draft, at.parent, list);
    report.movedOut += ids.length;
  };
  /**
   * Another instance's write at the swapped node's own position (it stands in that instance's
   * template): its props the new component takes.
   */
  const keepAccepted = (override: DescendantOverride): DescendantOverride => {
    const path = override.address.templatePath;
    if (
      path[path.length - 1] !== input.id ||
      override.kind === "replace" ||
      !override.props
    )
      return override;
    const props = acceptedProps(override.props);
    report.dropped +=
      Object.keys(override.props).length - Object.keys(props).length;
    return { ...override, props };
  };
  /**
   * Slot content moved to a slot of the same name in another kind of part keeps only its children:
   * the writes it carried (`DescendantPatchFields`) were for the old part.
   */
  const slotFieldsAt = (
    override: Extract<DescendantOverride, { kind: "fillSlot" }>,
    address: InstanceAddress,
  ): DescendantOverride => {
    const from =
      override.address.templatePath[override.address.templatePath.length - 1];
    const to = address.templatePath[address.templatePath.length - 1];
    if (before?.definitionOf.get(from) === after?.definitionOf.get(to))
      return { ...override, address };
    const fields = Object.keys(override).filter(
      (key) => key !== "kind" && key !== "address" && key !== "childIds",
    );
    report.dropped += fields.length;
    return { kind: "fillSlot", address, childIds: override.childIds };
  };
  /** An owner's overrides through the swapped node (`at` = its index in `instances`). */
  const remapOverrides = (
    owner: NodeEntry,
    at: number,
  ): { overrides: DescendantOverride[]; out: NodeId[] } => {
    const overrides: DescendantOverride[] = [];
    const out: NodeId[] = [];
    for (const override of owner.descendantOverrides) {
      const index = override.address.instances.indexOf(input.id);
      if (index < 0 || (at === 0 && index !== 0)) {
        overrides.push(index < 0 ? keepAccepted(override) : override);
        continue;
      }
      const kind =
        override.address.instances.length > index + 1
          ? "nested"
          : override.kind === "fillSlot"
            ? "slot"
            : "position";
      const address = remapThrough(override.address, index, kind);
      if (address) {
        overrides.push(
          override.kind === "fillSlot"
            ? slotFieldsAt(override, address)
            : { ...override, address },
        );
        report.kept++;
      } else if (override.kind === "fillSlot") out.push(...override.childIds);
      else if (override.kind === "replace") out.push(override.replacementId);
      else report.dropped++;
    }
    return { overrides, out };
  };

  /** Slot contents · replacements with no place, moved out after the step's other writes. */
  const leaving: [NodeId, NodeId[]][] = [];
  // The instance itself: its root props the new contract takes, its overrides moved.
  const props = acceptedProps(node.props);
  report.dropped += Object.keys(node.props).length - Object.keys(props).length;
  const own = remapOverrides(node, 0);
  draft.write({
    ...node,
    definitionId: input.definitionId,
    props,
    descendantOverrides: own.overrides,
  });
  leaving.push([input.id, own.out]);
  // ADR-261 Phase 4 (review m1): a text property of an enclosing component driving this node's
  // text keeps it only if the new component takes that prop as text; otherwise the node leaves the
  // property (counted as dropped — as an override with no place).
  for (const referrer of reader.referrersOf(input.id)) {
    const definition = draft.read(referrer);
    if (definition?.kind !== "definition") continue;
    pruneComponentPropertyTargets(draft, definition, (property, target) => {
      const drop =
        property.kind === "text" &&
        target.id === input.id &&
        contract.accepts[target.prop!] !== "string";
      if (drop) report.dropped++;
      return drop;
    });
  }
  // Slot content the new slot does not take (its nesting rules) moves out too (user decision 1 —
  // review h2: ListBox items in a GridList's `Items`).
  const placed = draft.node(input.id);
  const refused = placed.descendantOverrides.filter((override) => {
    if (override.kind !== "fillSlot" || !override.childIds.length) return false;
    try {
      assertNestable(
        draft,
        { kind: "descendant", ownerId: input.id, address: override.address },
        override.childIds.map((id) => draft.node(id).definitionId),
      );
      return false;
    } catch {
      return true;
    }
  });
  if (refused.length) {
    draft.write({
      ...placed,
      descendantOverrides: placed.descendantOverrides.filter(
        (override) => !refused.includes(override),
      ),
    });
    report.kept -= refused.length;
    leaving.push([
      input.id,
      refused.flatMap((override) =>
        override.kind === "fillSlot" ? override.childIds : [],
      ),
    ]);
  }

  // Addresses others hold through the node: interactions it owns, other instances' overrides and
  // interactions when it stands in a component's template (the reference index lists them all).
  const goneInteractions = new Set<string>();
  const holders = new Set<NodeId>([input.id]);
  for (const referrerId of reader.referrersOf(input.id)) {
    const entry = draft.read(referrerId);
    if (entry?.kind === "interaction" && entry.address) {
      const index = entry.address.instances.indexOf(input.id);
      if (index < 0) continue;
      const kind =
        entry.address.instances.length > index + 1 ? "nested" : "position";
      const address = remapThrough(entry.address, index, kind);
      if (address) {
        draft.write({ ...entry, address });
        report.kept++;
      } else {
        draft.remove(entry.id);
        goneInteractions.add(entry.id);
        report.dropped++;
      }
    } else if (entry?.kind === "node" && entry.id !== input.id) {
      const { overrides, out } = remapOverrides(entry, 1);
      if (
        overrides.length + out.length !== entry.descendantOverrides.length ||
        overrides.some((item, i) => item !== entry.descendantOverrides[i])
      ) {
        draft.write({ ...entry, descendantOverrides: overrides });
        leaving.push([entry.id, out]);
      }
      holders.add(entry.id);
    }
  }
  if (goneInteractions.size) {
    const project = draft.project();
    draft.write({
      ...project,
      interactionIds: project.interactionIds.filter(
        (id) => !goneInteractions.has(id),
      ),
    });
  }

  // `showWhen` state owners below the holders (not in the reference index — walk their subtrees as
  // they were: content moving out is walked too). Content that moves out leaves its owner, so a
  // condition read from the swapped instance there has no owner any more (user decision 6).
  const outside = new Set<string>();
  for (const [, ids] of leaving)
    for (const queue = [...ids]; queue.length;) {
      const id = queue.shift()!;
      outside.add(id);
      const entry = reader.getEntry(id);
      if (entry?.kind === "node") queue.push(...nodeOwnedChildren(entry));
    }
  for (const holder of holders) {
    const start = reader.getEntry(holder);
    const queue = start?.kind === "node" ? nodeOwnedChildren(start) : [];
    while (queue.length) {
      const id = queue.shift()!;
      const before = reader.getEntry(id);
      if (before?.kind !== "node") continue;
      queue.push(...nodeOwnedChildren(before));
      const child = draft.read(id) as NodeEntry;
      if (!child.showWhen) continue;
      const showWhen = remapShowWhen(child.showWhen, outside.has(id));
      if (showWhen !== child.showWhen) {
        const { showWhen: _old, ...rest } = child;
        draft.write(showWhen ? { ...rest, showWhen } : rest);
      }
    }
  }

  for (const [owner, ids] of leaving) moveOut(owner, ids);

  function remapShowWhen(
    showWhen: CatalogShowWhen,
    leaves: boolean,
  ): CatalogShowWhen | undefined {
    let changed = false;
    let lost = false;
    const mapped = mapShowWhenAddresses(showWhen, (address) => {
      const index = address.instances.indexOf(input.id);
      if (index < 0) return address;
      changed = true;
      const kind = address.instances.length > index + 1 ? "nested" : "position";
      const next = leaves ? undefined : remapThrough(address, index, kind);
      if (next) {
        report.kept++;
        return next;
      }
      lost = true;
      report.dropped++;
      return address;
    });
    if (!changed) return showWhen;
    // A condition whose owner has no place in the new component is dropped (user decision 6).
    if (!lost) return mapped;
    return undefined;
  }

  return {
    plan: {
      label: input.label ?? "Swap instance",
      ops: draft.ops(),
      selectAfter: [input.id],
    },
    report,
  };
}

/** ADR-261 Decision 2 — Swap instance: the node shows another component (one history step). */
export const swapInstance =
  (input: SwapInstanceInput): CatalogCommand =>
  (reader) =>
    planSwapInstance(reader, input).plan;
