import type {
  CatalogEntry,
  CatalogLibrary,
  DefinitionOverrideEntry,
  EntryId,
  LibraryDefinition,
  LibraryDefinitionId,
  LibraryTemplateId,
  LibraryTemplateNode,
  NodeId,
  TemplateId,
} from "./types";

/**
 * ADR-282 — an unlocked library origin: the project override owns a copy of the origin's template
 * (`templateRootId`) and maps each library template node it copied to its copy (`templateMap`).
 */
export interface OriginFork {
  overrideId: EntryId<"definitionOverride">;
  templateRootId: NodeId;
  templateMap: Readonly<Record<LibraryTemplateId, NodeId>>;
}

/** The unlocked origins of a document read through `get` (its project's override list). */
export function originForksOf(
  get: (id: string) => CatalogEntry | undefined,
  projectId: string,
): Map<LibraryDefinitionId, OriginFork> {
  const forks = new Map<LibraryDefinitionId, OriginFork>();
  const project = get(projectId);
  if (project?.kind !== "project") return forks;
  for (const id of project.overrideIds) {
    const entry = get(id);
    if (entry?.kind === "definitionOverride" && entry.templateRootId)
      forks.set(entry.targetId, forkOf(entry));
  }
  return forks;
}

export function forkOf(entry: DefinitionOverrideEntry): OriginFork {
  return {
    overrideId: entry.id,
    templateRootId: entry.templateRootId!,
    templateMap: entry.templateMap ?? {},
  };
}

/** A read-only map whose values for some keys are replaced (`overlay`), the rest read from `base`. */
class OverlayMap<K, V> implements ReadonlyMap<K, V> {
  constructor(
    private readonly base: ReadonlyMap<K, V>,
    private readonly overlay: ReadonlyMap<K, V>,
  ) {}
  get size(): number {
    return this.base.size;
  }
  get(key: K): V | undefined {
    return this.overlay.get(key) ?? this.base.get(key);
  }
  has(key: K): boolean {
    return this.base.has(key);
  }
  keys(): MapIterator<K> {
    return this.base.keys();
  }
  *values(): MapIterator<V> {
    for (const [key, value] of this.base) yield this.overlay.get(key) ?? value;
  }
  *entries(): MapIterator<[K, V]> {
    for (const [key, value] of this.base)
      yield [key, this.overlay.get(key) ?? value];
  }
  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }
  forEach(
    callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this.entries())
      callback.call(thisArg, value, key, this);
  }
}

const BASE = Symbol("catalogBaseLibrary");

/** The code library under a forked view (the view itself is not one). */
export function catalogBaseLibrary(library: CatalogLibrary): CatalogLibrary {
  return (library as { [BASE]?: CatalogLibrary })[BASE] ?? library;
}

/**
 * ADR-282 Decision 2 — the library as a document with unlocked origins reads it: an unlocked
 * origin's definition has its copy's root as `templateRootId`, and a library template node's
 * patches and slot fills (`descendantPatches` · `slotFills` — another origin's positions in this
 * one, e.g. the Select's Button part) go through the copies of an unlocked origin's nodes. Every
 * reader of the graph (`CatalogReader.library` — commands, address validation, the resolver)
 * reads this one view, so none of them sees the library template of an unlocked origin.
 */
export function forkedCatalogLibrary(
  library: CatalogLibrary,
  forks: ReadonlyMap<LibraryDefinitionId, OriginFork>,
): CatalogLibrary {
  const base = catalogBaseLibrary(library);
  if (!forks.size) return base;
  const definitions = new Map<LibraryDefinitionId, LibraryDefinition>();
  const copyOf = new Map<string, NodeId>();
  for (const [id, fork] of forks) {
    const definition = base.definitions.get(id);
    if (!definition) continue;
    definitions.set(id, { ...definition, templateRootId: fork.templateRootId });
    for (const [templateId, nodeId] of Object.entries(fork.templateMap))
      copyOf.set(templateId, nodeId);
  }
  const path = (ids: readonly TemplateId[]): readonly TemplateId[] =>
    ids.some((id) => copyOf.has(id))
      ? ids.map((id) => copyOf.get(id) ?? id)
      : ids;
  const templates = new Map<LibraryTemplateId, LibraryTemplateNode>();
  for (const [id, node] of base.templates) {
    if (!node.descendantPatches && !node.slotFills) continue;
    const patches = node.descendantPatches?.map((patch) => {
      const templatePath = path(patch.templatePath);
      return templatePath === patch.templatePath
        ? patch
        : { ...patch, templatePath };
    });
    const fills = node.slotFills?.map((fill) => {
      const templatePath = path(fill.templatePath);
      return templatePath === fill.templatePath
        ? fill
        : { ...fill, templatePath };
    });
    if (
      patches?.every((patch, at) => patch === node.descendantPatches![at]) !==
        false &&
      fills?.every((fill, at) => fill === node.slotFills![at]) !== false
    )
      continue;
    templates.set(id, {
      ...node,
      ...(patches ? { descendantPatches: patches } : {}),
      ...(fills ? { slotFills: fills } : {}),
    });
  }
  return {
    ...base,
    definitions: new OverlayMap(base.definitions, definitions),
    templates: new OverlayMap(base.templates, templates),
    [BASE]: base,
  } as CatalogLibrary;
}
