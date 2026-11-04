/**
 * ADR-296 Phase 5 · Decision 4 (review h1 · round 2) — an instance's own share inside its component,
 * written on its page element as one `overrides` prop: a key per position — the inner path
 * `'<nested instance>/…/<node>'` (= `InstanceAddress`: each nested template instance by its name in
 * the template holding it, then the target node's name in the final template — names are classes,
 * unique per template, so the path is the address 1:1) — and its value (the position's props ·
 * `hidden` · per When `rules({inherited, own})`). The keys of `inherited` are the origin's rules by
 * their handler names (`on<Node><When>` · `2` …) — the rule ids. Reading it back is instance commands
 * only (descendant patch writes · the inherited rule's off / replace · the position's own rules).
 */
import type {
  CatalogReader,
  DefinitionEntry,
  DefinitionOverrideEntry,
  InstanceAddress,
  InteractionEntry,
  NodeEntry,
  ProjectEntry,
} from "../../catalog/document/types";
import { codeViewKebab, codeViewTypeName } from "./styles";

type Reader = Pick<CatalogReader, "projectId" | "getEntry" | "library">;

/** A template node as the names read it (a project node · a library template node). */
interface TreeNode {
  readonly id: string;
  readonly name?: string;
  readonly definitionId: string;
  readonly children: readonly string[];
  readonly descendantOverrides?: NodeEntry["descendantOverrides"];
  /** The slot this node declares (an instance's `<Slot name>` is this name). */
  readonly slot?: { readonly name: string };
}
function treeNode(reader: Reader, id: string): TreeNode | undefined {
  const entry = reader.getEntry(id);
  if (entry?.kind === "node") return entry as NodeEntry;
  return reader.library.templates.get(id as never) as TreeNode | undefined;
}
/**
 * A tree node's children as the names walk them: its own children, then its slot fills' (the one
 * set the class table and the address path read — 판독 Phase 5 MEDIUM-2 · 수리 검증).
 */
function ownedChildIds(node: TreeNode): readonly string[] {
  const fills = (node.descendantOverrides ?? []).flatMap((fill) =>
    fill.kind === "fillSlot" ? fill.childIds : [],
  );
  return fills.length ? [...node.children, ...fills] : node.children;
}
const typeOf = (reader: Reader, definitionId: string) =>
  codeViewTypeName(reader, definitionId);

/** Each node of a tree → its class (name kebab-case · type · `-2` — 사용자 결정 6), in tree order. */
export function codeViewTreeClasses(
  reader: Reader,
  roots: readonly string[],
): Map<string, string> {
  const taken = new Set<string>();
  const classes = new Map<string, string>();
  const walk = (ids: readonly string[]) => {
    for (const id of ids) {
      const node = treeNode(reader, id);
      if (!node) continue;
      const base = codeViewKebab(
        node.name ?? "",
        codeViewKebab(typeOf(reader, node.definitionId), "node"),
      );
      let name = base;
      for (let index = 2; taken.has(name); index += 1)
        name = `${base}-${index}`;
      taken.add(name);
      classes.set(id, name);
      // (A slot fill's nodes are the tree's too — `codeViewPageNodes` order.)
      walk(ownedChildIds(node));
    }
  };
  walk(roots);
  return classes;
}

/** The template a definition draws (a project component · an unlocked or a library origin). */
export function codeViewTemplateRoot(
  reader: Reader,
  definitionId: string,
): string | undefined {
  if (!definitionId.startsWith("lib:")) {
    const definition = reader.getEntry(definitionId) as
      DefinitionEntry | undefined;
    return definition?.kind === "definition"
      ? definition.templateRootId
      : undefined;
  }
  const project = reader.getEntry(reader.projectId) as ProjectEntry | undefined;
  for (const id of project?.overrideIds ?? []) {
    const override = reader.getEntry(id) as DefinitionOverrideEntry | undefined;
    if (override?.targetId === definitionId && override.templateRootId)
      return override.templateRootId;
  }
  return reader.library.definitions.get(definitionId as never)?.templateRootId;
}

const definitionOf = (reader: Reader, id: string) =>
  treeNode(reader, id)?.definitionId;

/** An address as its `overrides` key (`'left-picker/save-button'`); undefined = not nameable. */
export function codeViewAddressKey(
  reader: Reader,
  address: InstanceAddress,
): string | undefined {
  const [first, ...nested] = address.instances;
  if (!first) return undefined;
  const segments: string[] = [];
  let level = codeViewTemplateRoot(reader, definitionOf(reader, first) ?? "");
  for (const id of nested) {
    if (!level) return undefined;
    const name = codeViewTreeClasses(reader, [level]).get(id);
    if (!name) return undefined;
    segments.push(name);
    level = codeViewTemplateRoot(reader, definitionOf(reader, id) ?? "");
  }
  const target = address.templatePath.at(-1);
  const root = address.templatePath[0] ?? level;
  if (!target || !root) return undefined;
  const name = codeViewTreeClasses(reader, [root]).get(target);
  return name ? [...segments, name].join("/") : undefined;
}

/**
 * ADR-296 follow-up (2026-11-05) — a slot position's key for `<Slot name>`: the address key with
 * the declared slot name as its last segment (`content` — the Popover origin's content frame,
 * whose class would be `frame`). A position that declares no slot keeps its class.
 */
export function codeViewSlotKey(
  reader: Reader,
  address: InstanceAddress,
): string | undefined {
  const key = codeViewAddressKey(reader, address);
  const target = address.templatePath.at(-1);
  const slot = target ? treeNode(reader, target)?.slot?.name : undefined;
  if (!key || !slot) return key;
  const segments = key.split("/");
  segments[segments.length - 1] = slot;
  return segments.join("/");
}

/**
 * `codeViewAddressKey`'s · `codeViewSlotKey`'s inverse for an instance (undefined = no such
 * position). The last segment names a declared slot first, else a node's class.
 */
export function codeViewAddressOf(
  reader: Reader,
  instanceId: string,
  key: string,
  /** The instance's definition (a new instance — not in the document yet). */
  definitionId?: string,
): InstanceAddress | undefined {
  // A position the instance already writes (its own patch's address — the exact one).
  const own = reader.getEntry(instanceId) as NodeEntry | undefined;
  for (const override of own?.kind === "node" ? own.descendantOverrides : [])
    if (
      codeViewAddressKey(reader, override.address) === key ||
      codeViewSlotKey(reader, override.address) === key
    )
      return override.address;
  const segments = key.split("/");
  const instances: string[] = [instanceId];
  let level = codeViewTemplateRoot(
    reader,
    definitionId ?? definitionOf(reader, instanceId) ?? "",
  );
  const find = (root: string, name: string) =>
    [...codeViewTreeClasses(reader, [root])].find(
      ([, item]) => item === name,
    )?.[0];
  for (const segment of segments.slice(0, -1)) {
    if (!level) return undefined;
    const id = find(level, segment);
    if (!id) return undefined;
    instances.push(id);
    level = codeViewTemplateRoot(reader, definitionOf(reader, id) ?? "");
  }
  if (!level) return undefined;
  const last = segments.at(-1)!;
  const target =
    [...codeViewTreeClasses(reader, [level]).keys()].find(
      (id) => treeNode(reader, id)?.slot?.name === last,
    ) ?? find(level, last);
  if (!target) return undefined;
  // The path from the template's root to the target.
  const path = (id: string, trail: string[]): string[] | undefined => {
    const next = [...trail, id];
    if (id === target) return next;
    const node = treeNode(reader, id);
    for (const child of node ? ownedChildIds(node) : []) {
      const found = path(child, next);
      if (found) return found;
    }
    return undefined;
  };
  const templatePath = path(level, []);
  return templatePath
    ? ({ instances, templatePath } as unknown as InstanceAddress)
    : undefined;
}

const pascal = (kebab: string) =>
  kebab
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

/** A When as a handler name's tail (`onPress` → `Press` · `property:select` → `Select`). */
const whenName = (trigger: string) =>
  pascal(trigger.replace(/^on(?=[A-Z])/, "").replace(/^property:/, ""));

/**
 * The origin's rules on a template node by their handler names (`onSaveButtonPress` ·
 * `onSaveButtonPress2` — the component file's E9 names): rule id → name.
 */
export function codeViewRuleKeys(
  reader: Reader,
  nodeId: string,
  nodeClass: string,
): Map<string, string> {
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const counts = new Map<string, number>();
  const out = new Map<string, string>();
  for (const id of project.interactionIds) {
    const rule = reader.getEntry(id) as InteractionEntry | undefined;
    if (rule?.kind !== "interaction" || rule.ownerId !== nodeId || rule.address)
      continue;
    const base = `on${pascal(nodeClass)}${whenName(rule.trigger)}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    out.set(rule.id, count > 1 ? `${base}${count}` : base);
  }
  return out;
}

/** A slot fill of an instance: its position, its key, whether it is the template root's. */
export interface CodeViewSlotFill {
  readonly address: InstanceAddress;
  readonly key: string;
  /** The template root's own slot — its children are the instance element's children. */
  readonly root: boolean;
  readonly childIds: readonly string[];
}

/** An instance's slot fills (`fillSlot` overrides), the root's first. */
export function codeViewSlotFills(
  reader: Reader,
  node: Pick<NodeEntry, "descendantOverrides">,
): CodeViewSlotFill[] {
  const out: CodeViewSlotFill[] = [];
  for (const override of node.descendantOverrides ?? []) {
    if (override.kind !== "fillSlot") continue;
    const key = codeViewSlotKey(reader, override.address);
    if (!key) continue;
    out.push({
      address: override.address,
      key,
      root:
        override.address.instances.length === 1 &&
        override.address.templatePath.length === 1,
      childIds: override.childIds,
    });
  }
  // (The template's order — a fill's place in its override list moves when it is written.)
  const order = (fill: CodeViewSlotFill) => {
    const root = fill.address.templatePath[0];
    const target = fill.address.templatePath.at(-1);
    const ids = root ? [...codeViewTreeClasses(reader, [root]).keys()] : [];
    return target ? ids.indexOf(target) : -1;
  };
  return out.sort(
    (a, b) =>
      Number(b.root) - Number(a.root) ||
      a.address.instances.length - b.address.instances.length ||
      order(a) - order(b) ||
      a.key.localeCompare(b.key),
  );
}

/** Whether an instance's template root takes children (it declares a slot · it is filled). */
export function codeViewRootSlot(
  reader: Reader,
  node: Pick<NodeEntry, "definitionId" | "descendantOverrides">,
): InstanceAddress | undefined {
  const root = codeViewTemplateRoot(reader, node.definitionId);
  if (!root) return undefined;
  const filled = (node.descendantOverrides ?? []).find(
    (item) =>
      item.kind === "fillSlot" &&
      item.address.instances.length === 1 &&
      item.address.templatePath.length === 1,
  );
  if (filled) return filled.address;
  const template = treeNode(reader, root) as
    (TreeNode & { slot?: unknown }) | undefined;
  return template?.slot
    ? ({ instances: [], templatePath: [root] } as unknown as InstanceAddress)
    : undefined;
}

/** Two addresses name the same position (their ids, in order). */
export function codeViewSameAddress(
  a: InstanceAddress | undefined,
  b: InstanceAddress | undefined,
): boolean {
  const same = (x: readonly string[], y: readonly string[]) =>
    x.length === y.length && x.every((id, index) => id === y[index]);
  return (
    !!a &&
    !!b &&
    same(a.instances as readonly string[], b.instances as readonly string[]) &&
    same(
      a.templatePath as readonly string[],
      b.templatePath as readonly string[],
    )
  );
}
