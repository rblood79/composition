import type {
  CatalogLibrary,
  LibraryTemplateId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "./compositionRoot";

/** A template text that is one binding and nothing else: `{title}`. */
const WHOLE_BINDING = /^\{(\w+)\}$/;

/** Template id → its parent template id, per library (the trees the origins' templates form). */
const templateParents = new WeakMap<CatalogLibrary, Map<string, string>>();
/** Template root id → the names its origin accepts (the bindings its templates may read). */
const originAccepts = new WeakMap<CatalogLibrary, Map<string, Set<string>>>();

function acceptsOf(library: CatalogLibrary, root: string): Set<string> {
  let byRoot = originAccepts.get(library);
  if (!byRoot) {
    byRoot = new Map();
    for (const definition of library.definitions.values())
      if ("templateRootId" in definition && definition.templateRootId)
        byRoot.set(
          definition.templateRootId,
          new Set(Object.keys(definition.accepts)),
        );
    originAccepts.set(library, byRoot);
  }
  return byRoot.get(root) ?? new Set();
}

function templateRoot(library: CatalogLibrary, id: string): string {
  let parents = templateParents.get(library);
  if (!parents) {
    parents = new Map();
    for (const template of library.templates.values()) {
      for (const child of template.children) parents.set(child, template.id);
      for (const fill of template.slotFills ?? [])
        for (const child of fill.childIds) parents.set(child, template.id);
    }
    templateParents.set(library, parents);
  }
  let current = id;
  for (let parent = parents.get(current); parent; parent = parents.get(current))
    current = parent;
  return current;
}

/** Where a bound text is written: the record whose prop the template binds it to. */
export interface CatalogTextBinding {
  readonly source: CatalogConsumerNode;
  readonly prop: string;
}

/**
 * ADR-254 Decision 5: the prop a drawn record's text is bound to. A template position whose text is
 * `{name}` (a Card's title `{title}`, a field's Label `{label}`) shows the `name` prop of the
 * instance that unfolds the template — that prop is the text's one source; the position's own text
 * would hide it. Followed outward while the source's prop is itself bound (an instance inside
 * another origin's template). `undefined` = the text is the record's own (a free text, a Dialog's
 * title, a Text the author put in a slot).
 */
export function catalogTextBinding(
  library: CatalogLibrary,
  records: ReadonlyMap<string, CatalogConsumerNode>,
  record: CatalogConsumerNode,
  key: string,
): CatalogTextBinding | undefined {
  let found: CatalogTextBinding | undefined;
  let current = record;
  let currentKey = key;
  // (Bounded: each step moves to an ancestor.)
  for (let depth = 0; depth < 16; depth++) {
    const template = library.templates.get(
      current.sourceId as LibraryTemplateId,
    );
    const written = template?.props[currentKey];
    const match =
      typeof written === "string" ? WHOLE_BINDING.exec(written) : null;
    if (!template || !match) break;
    const root = templateRoot(library, template.id);
    let owner = records.get(current.parentId);
    while (
      owner &&
      owner.sourceId !== root &&
      !owner.collapsedSourceIds?.includes(root)
    )
      owner = records.get(owner.parentId);
    // (The origin does not take the name: the template shows it as written — not bound. The
    // value lives on the instance, not on its drawn record: a Card's record is its `Card` root.)
    if (!owner || !acceptsOf(library, root).has(match[1])) break;
    found = { source: owner, prop: match[1] };
    current = owner;
    currentKey = match[1];
  }
  return found;
}
