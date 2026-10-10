import { RAC_STATE_KEYS } from "../generated/racStateKeys";
import type {
  CatalogShowWhen,
  CatalogStateKey,
  CatalogStateOwnerRef,
  InstanceAddress,
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

/**
 * State keys of composition parts outside RAC's structure (ADR-256 Phase 9): a calendar month
 * block's place among the shown months — the reference starter's `i === 0` · `i === months - 1`
 * around its previous · next Buttons.
 */
const COMPOSITION_STATE_KEYS: Readonly<Record<string, readonly string[]>> = {
  CalendarMonth: ["isFirstMonth", "isLastMonth"],
};

/** The state keys a type gives its children (`RAC_STATE_KEYS` — the installed RAC's run). */
export function catalogStateKeysOf(type: string): readonly string[] {
  return (
    COMPOSITION_STATE_KEYS[type] ??
    RAC_STATE_KEYS[RAC_PART_OF_TYPE[type] ?? type] ??
    []
  );
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
 * The `showWhen` with each origin-local reference (`{ ancestor: { local } }`) passed through `place`
 * — on detach, the position's new node. A reference through a nested instance step whose instance
 * node is placed (`placeInstance`) becomes that owned instance's address (ADR-256 후속 19 — the
 * owned instance's address rule, `[id, ...instances.slice(1)]`); one out of reach stays local.
 */
export function mapShowWhenLocal(
  showWhen: CatalogShowWhen,
  place: (templatePath: readonly string[]) => NodeId | undefined,
  placeInstance?: (templateId: string) => NodeId | undefined,
): CatalogShowWhen {
  const ref = (from: CatalogStateOwnerRef): CatalogStateOwnerRef => {
    if (!("ancestor" in from) || !("local" in from.ancestor)) return from;
    const local = from.ancestor.local;
    if (local.instances.length) {
      const head = placeInstance?.(local.instances[0]!);
      return head
        ? {
            ancestor: {
              address: {
                instances: [head, ...local.instances.slice(1)],
                templatePath: local.templatePath,
              } as InstanceAddress,
            },
          }
        : from;
    }
    const nodeId = place(local.templatePath);
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

/**
 * The `showWhen` with each instance-address reference passed through `place` (on detach, a
 * position of the detached instance becomes its new node); others unchanged.
 */
export function mapShowWhenAddress(
  showWhen: CatalogShowWhen,
  place: (address: {
    instances: readonly string[];
    templatePath: readonly string[];
  }) => NodeId | undefined,
): CatalogShowWhen {
  const ref = (from: CatalogStateOwnerRef): CatalogStateOwnerRef => {
    if (!("ancestor" in from) || !("address" in from.ancestor)) return from;
    const nodeId = place(from.ancestor.address);
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

/** The `showWhen` with each instance address passed through `map` (same ref when it returns it). */
export function mapShowWhenAddresses(
  showWhen: CatalogShowWhen,
  map: (address: InstanceAddress) => InstanceAddress,
): CatalogShowWhen {
  const ref = (from: CatalogStateOwnerRef): CatalogStateOwnerRef =>
    "ancestor" in from && "address" in from.ancestor
      ? { ancestor: { address: map(from.ancestor.address) } }
      : from;
  return {
    all: showWhen.all.map((item) =>
      typeof item === "string" || !("from" in item) || !item.from
        ? item
        : { ...item, from: ref(item.from) },
    ) as CatalogShowWhen["all"],
    ...(showWhen.from ? { from: ref(showWhen.from) } : {}),
  };
}
