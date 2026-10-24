import type {
  CatalogLibrary,
  CatalogStateOwnerRef,
  DefinitionOverrideEntry,
  DescendantOverride,
  InstanceAddress,
  LayoutWrites,
  LibraryDefinitionId,
  LibraryTemplateId,
  NodeEntry,
  NodeId,
  PropWrites,
  VisualWrites,
} from "../document/types";
import { ownedChildren } from "../document/graph";
import {
  mapShowWhenAddresses,
  mapShowWhenOwnerRefs,
} from "../document/stateOwnerRefs";
import type { CatalogCommand } from "./compose";
import { catalogBaseLibrary } from "../document/originFork";
import { CommandDraft, fail } from "./context";
import type { NewId } from "./materialize";
import { removeWithReferrers, subtree } from "./structure";

/**
 * ADR-282 — a library origin unlocked on the Library page: its override owns a copy of the
 * origin's template, which every instance of the origin projects (Framer Unlink — the project
 * keeps the origin, not a new component). Reset takes the origin back to the library default.
 */

const sets = <T>(
  values: Readonly<Record<string, T>> | undefined,
): Record<string, { kind: "set"; value: T }> =>
  Object.fromEntries(
    Object.entries(values ?? {}).map(([key, value]) => [
      key,
      { kind: "set" as const, value },
    ]),
  );

/** The override entry of a library origin (`undefined` = none yet). */
function overrideOf(
  draft: CommandDraft,
  definitionId: LibraryDefinitionId,
): DefinitionOverrideEntry | undefined {
  for (const id of draft.project().overrideIds) {
    const entry = draft.read(id);
    if (entry?.kind === "definitionOverride" && entry.targetId === definitionId)
      return entry;
  }
  return undefined;
}

/**
 * Every stored instance address of the document passed through `map` (ADR-282 Decision 9): the
 * nodes' `descendantOverrides` and `showWhen` owner references, the interactions' addresses. The
 * document is walked from its project root — pages, component templates, unlocked origins' copies
 * (a lib template id is not in the reverse reference index, which holds project ids only).
 * `undefined` from `map` drops a `showWhen` reference; overrides and interactions keep theirs.
 */
function rewriteDocumentAddresses(
  draft: CommandDraft,
  map: (address: InstanceAddress) => InstanceAddress | undefined,
): void {
  const project = draft.project();
  const roots: NodeId[] = [];
  // (The Components tab's stored pages too — their ◇ instances hold addresses, ADR-282 Phase 3.)
  for (const id of [...project.pageIds, ...(project.componentPageIds ?? [])]) {
    const page = draft.read(id);
    if (page?.kind === "page") roots.push(...page.children);
  }
  for (const id of [...project.definitionIds, ...project.overrideIds]) {
    const entry = draft.read(id);
    if (
      (entry?.kind === "definition" || entry?.kind === "definitionOverride") &&
      entry.templateRootId
    )
      roots.push(entry.templateRootId);
  }
  const same = (left: InstanceAddress, right: InstanceAddress) =>
    left.instances.length === right.instances.length &&
    left.templatePath.length === right.templatePath.length &&
    left.instances.every((id, at) => id === right.instances[at]) &&
    left.templatePath.every((id, at) => id === right.templatePath[at]);
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = draft.read(id);
    if (node?.kind !== "node") continue;
    stack.push(...ownedChildren(node));
    let changed = false;
    const descendantOverrides = node.descendantOverrides.map((override) => {
      const address = map(override.address);
      if (!address || same(address, override.address)) return override;
      changed = true;
      return { ...override, address };
    });
    let showWhen = node.showWhen;
    if (showWhen) {
      const next = mapShowWhenOwnerRefs(
        mapShowWhenAddresses(showWhen, (address) => map(address) ?? address),
        (from): CatalogStateOwnerRef | undefined => {
          if (!("ancestor" in from)) return from;
          const ancestor = from.ancestor;
          if ("address" in ancestor) return map(ancestor.address) && from;
          if (!("local" in ancestor)) return from;
          const local = map(ancestor.local as InstanceAddress);
          return local
            ? {
                ancestor: {
                  local: {
                    instances: local.instances as never,
                    templatePath: local.templatePath,
                  },
                },
              }
            : undefined;
        },
      );
      if (JSON.stringify(next) !== JSON.stringify(showWhen)) {
        showWhen = next;
        changed = true;
      }
    }
    if (changed)
      draft.write({
        ...node,
        descendantOverrides,
        ...(showWhen ? { showWhen } : {}),
      });
  }
  for (const id of project.interactionIds) {
    const entry = draft.read(id);
    if (entry?.kind !== "interaction" || !entry.address) continue;
    const address = map(entry.address);
    if (address && !same(address, entry.address))
      draft.write({ ...entry, address });
  }
}

/** An address with every id `table` names replaced (segment by segment — lib ids are unique). */
const mapAddress =
  (table: ReadonlyMap<string, string>) =>
  (address: InstanceAddress): InstanceAddress => {
    const swap = (id: string) => table.get(id) ?? id;
    return {
      instances: address.instances.map(swap) as InstanceAddress["instances"],
      templatePath: address.templatePath.map(
        swap,
      ) as InstanceAddress["templatePath"],
    };
  };

/**
 * The symbolic copy of a library origin's template (ADR-282 Decision 8): every library node under
 * `rootId` as an owned node, template bindings (`{label}`) kept as written — each instance fills
 * them — the node's library patches and slot fills as its own overrides. `idOf` names each copy
 * (a new id, or — to compare — the id an earlier copy gave it).
 */
function symbolicCopy(
  library: CatalogLibrary,
  rootId: LibraryTemplateId,
  idOf: (templateId: LibraryTemplateId) => NodeId,
): {
  root: NodeId;
  entries: NodeEntry[];
  templateMap: Record<LibraryTemplateId, NodeId>;
} {
  const templateMap: Record<LibraryTemplateId, NodeId> = {};
  const entries: NodeEntry[] = [];
  const copy = (templateId: LibraryTemplateId): NodeId => {
    // (Read through the library view: another unlocked origin's positions are its copies.)
    const template = library.templates.get(templateId);
    if (!template) return fail("DANGLING_TEMPLATE", templateId);
    const id = idOf(templateId);
    templateMap[templateId] = id;
    const filled = new Set<string>(
      template.slotFills?.flatMap((fill) => fill.childIds) ?? [],
    );
    const overrides: DescendantOverride[] = [];
    const at = (address: InstanceAddress) =>
      overrides.findIndex(
        (item) => JSON.stringify(item.address) === JSON.stringify(address),
      );
    // The node's library patches into the composite it instantiates (the Select's Button part)
    // and its slot fills become the copy's own overrides there — one per address.
    for (const patch of template.descendantPatches ?? [])
      overrides.push({
        kind: "patch",
        address: { instances: [id], templatePath: patch.templatePath },
        ...(patch.props ? { props: sets(patch.props) as PropWrites } : {}),
        ...(patch.visual ? { visual: sets(patch.visual) as VisualWrites } : {}),
        ...(patch.layout ? { layout: sets(patch.layout) as LayoutWrites } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      });
    for (const fill of template.slotFills ?? []) {
      const address = { instances: [id], templatePath: fill.templatePath };
      const childIds = fill.childIds.map((childId) => copy(childId));
      const found = at(address);
      if (found < 0) overrides.push({ kind: "fillSlot", address, childIds });
      else
        overrides[found] = {
          ...(overrides[found] as Extract<
            DescendantOverride,
            { kind: "patch" }
          >),
          kind: "fillSlot",
          childIds,
        };
    }
    const children = template.children
      .filter((childId) => !filled.has(childId))
      .map((childId) => copy(childId));
    entries.push({
      kind: "node",
      id,
      definitionId: template.definitionId,
      children,
      props: sets(template.props) as PropWrites,
      visual: sets(template.visual) as VisualWrites,
      sizing: {},
      descendantOverrides: overrides,
      ...(template.layout
        ? { layout: sets(template.layout) as LayoutWrites }
        : {}),
      ...(template.slot ? { slot: template.slot } : {}),
      ...(template.enabled !== undefined ? { enabled: template.enabled } : {}),
      ...(template.stateRules ? { stateRules: template.stateRules } : {}),
      ...(template.presentWhen ? { presentWhen: template.presentWhen } : {}),
      ...(template.showWhen ? { showWhen: template.showWhen } : {}),
      ...(template.displayState ? { displayState: template.displayState } : {}),
    });
    return id;
  };
  const root = copy(rootId);
  // (A `local` owner reference of the library node names positions of this template.)
  const remap = mapAddress(
    new Map<string, string>(Object.entries(templateMap)),
  );
  for (const [at, entry] of entries.entries())
    if (entry.showWhen)
      entries[at] = {
        ...entry,
        showWhen: mapShowWhenOwnerRefs(entry.showWhen, (from) =>
          "ancestor" in from && "local" in from.ancestor
            ? {
                ancestor: {
                  local: remap(from.ancestor.local as InstanceAddress) as never,
                },
              }
            : from,
        ),
      };
  return { root, entries, templateMap };
}

/** The library origins a document can unlock: a composite with a library template, not forked. */
function lockedOrigin(
  library: CatalogLibrary,
  definitionId: LibraryDefinitionId,
): LibraryTemplateId | undefined {
  const definition = library.definitions.get(definitionId);
  const rootId = definition?.templateRootId;
  return definition?.mode === "composite" && rootId?.startsWith("lib:")
    ? (rootId as LibraryTemplateId)
    : undefined;
}

/**
 * Fork one origin into `draft` (its copy and its override's fork fields — the addresses are the
 * caller's to rewrite, once for every origin it forks). Returns the copy's library → copy map.
 */
function forkInto(
  draft: CommandDraft,
  library: CatalogLibrary,
  definitionId: LibraryDefinitionId,
  rootId: LibraryTemplateId,
  newId: NewId,
): { root: NodeId; templateMap: Record<LibraryTemplateId, NodeId> } {
  const { root, entries, templateMap } = symbolicCopy(library, rootId, () =>
    newId("node"),
  );
  const existing = overrideOf(draft, definitionId);
  const overrideId = existing?.id ?? newId("definitionOverride");
  for (const entry of entries)
    draft.create(
      // The override's root style is the copy root's own from now on (Decision 1).
      entry.id === root && existing
        ? {
            ...entry,
            visual: { ...entry.visual, ...existing.visual } as VisualWrites,
          }
        : entry,
    );
  draft[existing ? "write" : "create"]({
    kind: "definitionOverride",
    id: overrideId,
    targetId: definitionId,
    defaults: existing?.defaults ?? {},
    visual: {},
    stateRules: existing?.stateRules ?? {},
    templateRootId: root,
    templateMap,
  });
  if (!existing) {
    const project = draft.project();
    draft.write({
      ...project,
      overrideIds: [...project.overrideIds, overrideId],
    });
  }
  return { root, templateMap };
}

/**
 * Unlock a library origin (ADR-282 Decision 1): its template is copied into owned nodes kept
 * symbolic — a template binding (`{label}`) stays a binding each instance fills (Decision 8 — not
 * detach, which freezes one instance's values) — and its override owns the copy (`templateRootId`
 * · `templateMap`). The document's stored addresses through the library template move to the copy
 * in the same step (Decision 9), the override's root style goes onto the copy's root; its defaults
 * and state rules stay (the origin's `accepts` namespace). Selects the copy's root.
 */
export const unlockOrigin =
  (input: {
    definitionId: LibraryDefinitionId;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const library = reader.library;
    const definition = library.definitions.get(input.definitionId);
    if (!definition) return fail("DANGLING_DEFINITION", input.definitionId);
    if (definition.mode !== "composite" || !definition.templateRootId)
      return fail("ORIGIN_NOT_COMPOSITE", input.definitionId);
    const rootId = lockedOrigin(library, input.definitionId);
    if (!rootId) return fail("ORIGIN_UNLOCKED", input.definitionId);
    const draft = new CommandDraft(reader);
    const { root, templateMap } = forkInto(
      draft,
      library,
      input.definitionId,
      rootId,
      input.newId,
    );
    rewriteDocumentAddresses(
      draft,
      mapAddress(new Map<string, string>(Object.entries(templateMap))),
    );
    return {
      label: input.label ?? "Unlock origin",
      ops: draft.ops(),
      selectAfter: [root],
    };
  };

/**
 * Unlock the whole Library (user 2026-10-24 「Library 전체 해제」): every component origin still
 * on its library template is forked in one step — the Library page's ◆ are all copies, edited as
 * a Local page card's. State variants (`--hover` …) stay: they are instances of their origin.
 */
export const unlockOrigins =
  (input: {
    newId: NewId;
    /** Absent = every `origin-` composite of the library. */
    definitionIds?: readonly LibraryDefinitionId[];
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const library = reader.library;
    const ids =
      input.definitionIds ??
      [...library.definitions.keys()].filter(
        (id) => id.startsWith("lib:definition:origin-") && !id.includes("--"),
      );
    const draft = new CommandDraft(reader);
    const table = new Map<string, string>();
    for (const definitionId of ids) {
      const rootId = lockedOrigin(library, definitionId);
      if (!rootId) continue;
      const { templateMap } = forkInto(
        draft,
        library,
        definitionId,
        rootId,
        input.newId,
      );
      for (const [templateId, nodeId] of Object.entries(templateMap))
        table.set(templateId, nodeId);
    }
    if (!table.size) return fail("ORIGINS_UNLOCKED", "library");
    // (One pass for all of them — the copies' own paths into another origin's template too.)
    rewriteDocumentAddresses(draft, mapAddress(table));
    return { label: input.label ?? "Unlock library", ops: draft.ops() };
  };

/** A JSON text with object keys sorted (two records equal whatever order their fields came in). */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : item,
  );

/**
 * Lock the Library (user 2026-10-24): the unlocked origins nobody edited go back to their library
 * template — their copy is exactly a fresh copy (nodes, fields, overrides; no rule or state on a
 * copy node), the root's own style apart, which goes back to the override as before the unlock.
 * Edited origins keep their copy. The addresses through the dropped copies go back to the library
 * positions (Decision 9). `undefined` ops = nothing to drop.
 */
export const lockOrigins =
  (input: { label?: string } = {}): CatalogCommand =>
  (reader) => {
    const library = reader.library;
    const draft = new CommandDraft(reader);
    const back = new Map<string, string>();
    const dropped: {
      override: DefinitionOverrideEntry;
      delta: VisualWrites;
      nodes: NodeId[];
    }[] = [];
    for (const id of draft.project().overrideIds) {
      const override = draft.read(id);
      if (override?.kind !== "definitionOverride" || !override.templateRootId)
        continue;
      const libraryRoot = graphRoot(reader, override.targetId) as
        LibraryTemplateId | undefined;
      if (!libraryRoot) continue;
      const map = override.templateMap ?? {};
      let expected: ReturnType<typeof symbolicCopy>;
      try {
        expected = symbolicCopy(library, libraryRoot, (templateId) => {
          const known = map[templateId];
          if (!known) throw new Error("UNMAPPED");
          return known;
        });
      } catch {
        continue;
      }
      const nodes = subtree(draft, override.templateRootId);
      const mapped = new Set<string>(Object.values(map));
      if (
        expected.root !== override.templateRootId ||
        nodes.length !== mapped.size ||
        nodes.some((nodeId) => !mapped.has(nodeId))
      )
        continue;
      // (A rule or a state variable a copy node owns is an edit too — an instance's rule that
      // only addresses a position through the copy is not.)
      const inCopy = new Set<string>(nodes);
      const held = nodes.some((nodeId) =>
        [...reader.referrersOf(nodeId)].some((referrer) => {
          const entry = draft.read(referrer);
          return (
            ((entry?.kind === "interaction" ||
              entry?.kind === "stateVariable") &&
              (inCopy.has(entry.ownerId) ||
                (entry.kind === "stateVariable" &&
                  !!entry.source &&
                  inCopy.has(entry.source.nodeId)))) ||
            entry?.kind === "definition"
          );
        }),
      );
      if (held) continue;
      let delta: VisualWrites = {};
      const same = expected.entries.every((entry) => {
        const current = draft.read(entry.id);
        if (current?.kind !== "node") return false;
        if (entry.id !== expected.root)
          return stable(current) === stable(entry);
        const { visual: currentVisual, ...currentRest } = current;
        const { visual: expectedVisual, ...expectedRest } = entry;
        if (stable(currentRest) !== stable(expectedRest)) return false;
        // The root's own style: the template's keys kept, the rest back to the override.
        const extra: Record<string, unknown> = {};
        for (const [key, write] of Object.entries(currentVisual))
          if (
            stable(write) !==
            stable((expectedVisual as Record<string, unknown>)[key])
          )
            extra[key] = write;
        if (Object.keys(expectedVisual).some((key) => !(key in currentVisual)))
          return false;
        delta = extra as VisualWrites;
        return true;
      });
      if (!same) continue;
      for (const [templateId, nodeId] of Object.entries(map))
        back.set(nodeId, templateId);
      dropped.push({ override, delta, nodes });
    }
    if (!dropped.length)
      return { label: input.label ?? "Lock library", ops: [] };
    rewriteDocumentAddresses(draft, mapAddress(back));
    removeWithReferrers(
      draft,
      dropped.flatMap((item) => item.nodes),
    );
    const gone = new Set<string>();
    for (const { override, delta } of dropped) {
      const { templateRootId: _root, templateMap: _map, ...rest } = override;
      const kept: DefinitionOverrideEntry = { ...rest, visual: delta };
      if (
        !Object.keys(kept.defaults).length &&
        !Object.keys(kept.visual).length &&
        !Object.keys(kept.stateRules).length
      ) {
        draft.remove(override.id);
        gone.add(override.id);
      } else draft.write(kept);
    }
    if (gone.size) {
      const project = draft.project();
      draft.write({
        ...project,
        overrideIds: project.overrideIds.filter((id) => !gone.has(id)),
      });
    }
    return { label: input.label ?? "Lock library", ops: draft.ops() };
  };

/** The library template root of an origin (the code library's — whatever the document forked). */
function graphRoot(
  reader: Parameters<CatalogCommand>[0],
  definitionId: LibraryDefinitionId,
): string | undefined {
  return catalogBaseLibrary(reader.library).definitions.get(definitionId)
    ?.templateRootId;
}

/**
 * Take library origins back to the library default (ADR-282 Decisions 1 · 10): for an unlocked
 * one, the addresses through a copy of a library position go back to that position (the
 * instances keep what they wrote there), the copy goes — and with it what stood only at positions
 * made after the unlock (an instance's `fillSlot` · `replace` there, their subtrees and records —
 * `removeWithReferrers`); then the whole override entry goes (its defaults and state rules too).
 */
function resetOverrides(
  draft: CommandDraft,
  overrides: readonly DefinitionOverrideEntry[],
): void {
  const back = new Map<string, string>();
  const copyNodes: NodeId[] = [];
  for (const override of overrides) {
    for (const [templateId, nodeId] of Object.entries(
      override.templateMap ?? {},
    ))
      back.set(nodeId, templateId);
    if (override.templateRootId)
      copyNodes.push(...subtree(draft, override.templateRootId));
  }
  if (copyNodes.length) {
    const copied = new Set<string>(copyNodes);
    const restore = mapAddress(back);
    rewriteDocumentAddresses(draft, (address) => {
      const next = restore(address);
      // (A state owner reference at a position made after the unlock has nothing to name.)
      return [...next.instances, ...next.templatePath].some((id) =>
        copied.has(id),
      )
        ? undefined
        : next;
    });
  }
  removeWithReferrers(draft, [
    ...copyNodes,
    ...overrides.map((override) => override.id),
  ]);
  const gone = new Set<string>(overrides.map((override) => override.id));
  const project = draft.project();
  draft.write({
    ...project,
    overrideIds: project.overrideIds.filter((id) => !gone.has(id)),
  });
}

/** Reset one library origin to its library default (its override entry — Decision 1). */
export const resetOrigin =
  (input: {
    definitionId: LibraryDefinitionId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const override = overrideOf(draft, input.definitionId);
    if (!override) return fail("ORIGIN_NOT_OVERRIDDEN", input.definitionId);
    resetOverrides(draft, [override]);
    return { label: input.label ?? "Reset origin", ops: draft.ops() };
  };

/** Reset every library origin the project overrides (the Library page row's reset — Decision 6). */
export const resetOrigins =
  (input: { label?: string } = {}): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const overrides = draft
      .project()
      .overrideIds.map((id) => draft.read(id))
      .filter(
        (entry): entry is DefinitionOverrideEntry =>
          entry?.kind === "definitionOverride",
      );
    if (!overrides.length) return fail("ORIGIN_NOT_OVERRIDDEN", "project");
    resetOverrides(draft, overrides);
    return { label: input.label ?? "Reset origins", ops: draft.ops() };
  };

/**
 * What a reset of `overrides` would take away (the confirm dialog — Decision 6 · 10): the
 * instances whose content stood only at positions made after an unlock, and the nodes of it.
 */
export function originResetLoss(
  reader: Parameters<CatalogCommand>[0],
  definitionIds: readonly LibraryDefinitionId[],
): { instances: number; nodes: number } {
  const draft = new CommandDraft(reader);
  const instances = new Set<string>();
  let nodes = 0;
  for (const definitionId of definitionIds) {
    const override = overrideOf(draft, definitionId);
    if (!override?.templateRootId) continue;
    const mapped = new Set<string>(Object.values(override.templateMap ?? {}));
    for (const id of subtree(draft, override.templateRootId)) {
      if (mapped.has(id)) continue;
      for (const referrer of reader.referrersOf(id)) {
        const holder = draft.read(referrer);
        if (holder?.kind !== "node") continue;
        for (const item of holder.descendantOverrides) {
          if (!item.address.templatePath.includes(id as never)) continue;
          const roots =
            item.kind === "fillSlot"
              ? item.childIds
              : item.kind === "replace"
                ? [item.replacementId]
                : [];
          if (!roots.length) continue;
          instances.add(holder.id);
          for (const root of roots) nodes += subtree(draft, root).length;
        }
      }
    }
  }
  return { instances: instances.size, nodes };
}
