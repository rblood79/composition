import { RAC_STATE_KEYS } from "../generated/racStateKeys";
import type {
  CatalogShowWhen,
  CatalogStateKey,
  CatalogStateOwnerRef,
  NodeId,
} from "./types";

/**
 * ADR-256 Decision 7 · breakdown §1-1 — state owner references of a node's `showWhen`, at the
 * document level (commands · clone · detach): which keys a type gives, and the stored addresses.
 */

/** The RAC part a catalog type renders, where the names differ (its render props are that part's). */
const RAC_PART_OF_TYPE: Readonly<Record<string, string>> = {
  // ADR-256 Phase 3: the toggle roots are RAC's `*Field` (state, no interaction keys).
  Checkbox: "CheckboxField",
  Switch: "SwitchField",
  Radio: "RadioField",
  TextArea: "TextField",
};

/** The state keys a type gives its children (`RAC_STATE_KEYS` — the installed RAC's run). */
export function catalogStateKeysOf(type: string): readonly string[] {
  return RAC_STATE_KEYS[RAC_PART_OF_TYPE[type] ?? type] ?? [];
}

/** Each condition's key and the owner reference it uses (its own `from`, else the whole `from`). */
export function catalogShowWhenRefs(
  showWhen: CatalogShowWhen,
): { key: CatalogStateKey; from?: CatalogStateOwnerRef }[] {
  return showWhen.all.map((item) =>
    typeof item === "string"
      ? { key: item, from: showWhen.from }
      : "key" in item
        ? { key: item.key, from: item.from }
        : {
            key: item.not,
            from: ("from" in item ? item.from : undefined) ?? showWhen.from,
          },
  );
}

/** The `showWhen` with every stored node id passed through `map` (a copy's new ids). */
export function mapShowWhenNodeIds(
  showWhen: CatalogShowWhen,
  map: (id: NodeId) => NodeId,
): CatalogShowWhen {
  const ref = (from: CatalogStateOwnerRef): CatalogStateOwnerRef => {
    if (!("ancestor" in from)) return from;
    const ancestor = from.ancestor;
    if ("nodeId" in ancestor) return { ancestor: { nodeId: map(ancestor.nodeId) } };
    if ("address" in ancestor) {
      const node = (id: string) =>
        (id.startsWith("project:node:") ? map(id as NodeId) : id) as never;
      return {
        ancestor: {
          address: {
            instances: ancestor.address.instances.map(node),
            templatePath: ancestor.address.templatePath.map(node),
          },
        },
      };
    }
    return from;
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
 * The `showWhen` with each origin-local reference (`{ ancestor: { local } }`) of the same origin
 * (no nested instance step) passed through `place` — on detach, the position's new node.
 */
export function mapShowWhenLocal(
  showWhen: CatalogShowWhen,
  place: (templatePath: readonly string[]) => NodeId | undefined,
): CatalogShowWhen {
  const ref = (from: CatalogStateOwnerRef): CatalogStateOwnerRef => {
    if (!("ancestor" in from) || !("local" in from.ancestor)) return from;
    const local = from.ancestor.local;
    const nodeId = local.instances.length
      ? undefined
      : place(local.templatePath);
    return nodeId ? { ancestor: { nodeId } } : from;
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
