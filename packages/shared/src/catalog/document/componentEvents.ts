import { componentPropertiesOf } from "./componentProperties";
import {
  COMPONENT_EVENT_TRIGGER_PREFIX,
  type CatalogEntry,
  type ComponentProperty,
  type DefinitionId,
  type InteractionEntry,
  type StateVariableEntry,
} from "./types";

/**
 * ADR-294 — the judgments the document · the panels · the Preview share about a component's
 * `event` and `variable` properties (one place, so the validation and what the panels offer give
 * the same answer).
 */

/** The event key a `property:<key>` trigger receives; undefined for a RAC callback. */
export function componentEventKeyOf(trigger: string): string | undefined {
  return trigger.startsWith(COMPONENT_EVENT_TRIGGER_PREFIX)
    ? trigger.slice(COMPONENT_EVENT_TRIGGER_PREFIX.length)
    : undefined;
}
/** The trigger an instance's rule receives the event `key` on. */
export const componentEventTrigger = (key: string): string =>
  `${COMPONENT_EVENT_TRIGGER_PREFIX}${key}`;

/** A definition's `event` properties (a library definition has none). */
export function componentEventPropertiesOf(
  definition: object | undefined,
): readonly ComponentProperty[] {
  return (componentPropertiesOf(definition) ?? []).filter(
    (property) => property.kind === "event",
  );
}

/** A component's input variable (a `variable` property's — derived, read only). */
export const isInputVariable = (
  entry: CatalogEntry | undefined,
): entry is StateVariableEntry & { input: { propertyKey: string } } =>
  entry?.kind === "stateVariable" && entry.input !== undefined;

/**
 * The project definition whose template holds `id` (the first definition up the owner chain — a
 * nested template node's own component), else undefined (a page node).
 */
export function templateDefinitionOf(
  id: string,
  get: (id: string) => CatalogEntry | undefined,
  ownerOf: (id: string) => string | undefined,
): DefinitionId | undefined {
  const seen = new Set<string>();
  for (
    let cursor = ownerOf(id);
    cursor && !seen.has(cursor);
    cursor = ownerOf(cursor)
  ) {
    seen.add(cursor);
    const owner = get(cursor);
    if (owner?.kind === "definition") return owner.id;
    if (owner?.kind === "definitionOverride") return owner.targetId;
    if (owner?.kind !== "node") return undefined;
  }
  return undefined;
}

/**
 * The component an origin rule's `emit` goes out of: the definition whose template holds the
 * rule's node — the addressed position's (an instance's own rule at an address: the innermost
 * instance of the address), else the owner's. Undefined = the rule is on a page node.
 */
export function emitDefinitionOf(
  rule: Pick<InteractionEntry, "ownerId" | "address">,
  get: (id: string) => CatalogEntry | undefined,
  ownerOf: (id: string) => string | undefined,
): DefinitionId | undefined {
  if (rule.address) {
    const inner = get(rule.address.instances.at(-1)!);
    return inner?.kind === "node" && inner.definitionId.startsWith("project:")
      ? (inner.definitionId as DefinitionId)
      : undefined;
  }
  return templateDefinitionOf(rule.ownerId, get, ownerOf);
}

/**
 * The instance a `property:<key>` rule receives on: the rule's node — the addressed position's
 * template node (a nested instance in the owner's component) or the owner itself.
 */
export function receivingInstanceOf(
  rule: Pick<InteractionEntry, "ownerId" | "address">,
  get: (id: string) => CatalogEntry | undefined,
): CatalogEntry | undefined {
  const id = rule.address ? rule.address.templatePath.at(-1) : rule.ownerId;
  return id ? get(id) : undefined;
}

/**
 * Whether a node sees a variable (ADR-288 visibility: the node's owner chain up to its page —
 * or its component's template root — and the project variables at the end of every chain).
 */
export function variableVisibleFrom(
  variable: CatalogEntry | undefined,
  nodeId: string,
  get: (id: string) => CatalogEntry | undefined,
  ownerOf: (id: string) => string | undefined,
): boolean {
  if (variable?.kind === "projectVariable") return true;
  if (variable?.kind !== "stateVariable") return false;
  for (let id: string | undefined = nodeId; id; id = ownerOf(id)) {
    const entry = get(id);
    if (entry?.kind !== "node" && entry?.kind !== "page") return false;
    if (variable.ownerId === id) return true;
    if (entry.kind === "page") return false;
  }
  return false;
}

/**
 * ADR-294 Decision 6 — a component property's name in the code (an instance element's attribute):
 * the name as an identifier (`roleFilter`), the key when nothing of the name is one.
 */
export function componentPropertyCodeName(
  property: Pick<ComponentProperty, "key" | "name">,
): string {
  const words = property.name.match(/[A-Za-z0-9_$]+/g) ?? [];
  const joined = words
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
  return /^[A-Za-z_$]/.test(joined) ? joined : property.key;
}
/** An event property's handler attribute — React's callback prop (`select` → `onSelect`). */
export function componentEventAttribute(
  property: Pick<ComponentProperty, "key" | "name">,
): string {
  const name = componentPropertyCodeName(property);
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}
/** The argument a received event gives its rule (`!event.value`). */
export const COMPONENT_EVENT_ARGS: readonly string[] = ["value"];
